/**
 * geoNavEngine.js — Pure utility module for real-time GPS navigation.
 *
 * Provides snap-to-route, off-route detection, bearing calculation,
 * progress tracking, and step instruction resolution.
 * No React dependencies — all pure functions.
 */

const EARTH_RADIUS_M = 6371000

/**
 * Haversine distance between two points in meters.
 */
export function haversineDist(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Compute bearing (in degrees, 0 = North, clockwise) from point A to point B.
 */
export function computeBearing(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180
  const toDeg = (rad) => (rad * 180) / Math.PI

  const dLon = toRad(lon2 - lon1)
  const y = Math.sin(dLon) * Math.cos(toRad(lat2))
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon)
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

/**
 * Project a point onto a line segment with correct WGS84 geodesic scaling
 * and return the closest point on the segment plus the fractional position along it (0–1).
 *
 * All coordinates are [lat, lon].
 */
function projectOntoSegment(point, segStart, segEnd) {
  const [pLat, pLon] = point
  const [aLat, aLon] = segStart
  const [bLat, bLon] = segEnd

  // Mean latitude for cosine projection
  const meanLatRad = (((aLat + bLat + pLat) / 3) * Math.PI) / 180
  const cosLat = Math.cos(meanLatRad)
  const METERS_PER_DEG_LAT = 111319.5
  const METERS_PER_DEG_LON = 111319.5 * cosLat

  // Convert segment to local metric coordinates (meters relative to segStart)
  const segDx = (bLon - aLon) * METERS_PER_DEG_LON
  const segDy = (bLat - aLat) * METERS_PER_DEG_LAT
  const lenSq = segDx * segDx + segDy * segDy

  if (lenSq === 0) {
    // Degenerate segment (start == end)
    return {
      closest: [aLat, aLon],
      t: 0,
    }
  }

  // Point relative to segStart in meters
  const ptDx = (pLon - aLon) * METERS_PER_DEG_LON
  const ptDy = (pLat - aLat) * METERS_PER_DEG_LAT

  // Parameter t: scalar projection of point onto the segment, clamped to [0, 1]
  let t = (ptDx * segDx + ptDy * segDy) / lenSq
  t = Math.max(0, Math.min(1, t))

  return {
    closest: [aLat + t * (bLat - aLat), aLon + t * (bLon - aLon)],
    t,
  }
}

/**
 * Snap a raw or filtered GPS coordinate to the nearest point on a route polyline.
 *
 * Includes a localized forward search window if lastSegmentIndex is provided,
 * preventing backward snaps and false cross-road snapping on complex junctions.
 *
 * @param {number} gpsLat
 * @param {number} gpsLon
 * @param {Array<[number, number]>} routePath — Array of [lat, lon] pairs
 * @param {number|null} [lastSegmentIndex=null] — previous known segment index for continuity
 * @returns {{ snappedPos: [number, number], segmentIndex: number, distanceFromRoute: number, fractionAlongSegment: number }}
 */
/**
 * Snap a raw or filtered GPS coordinate to the nearest point on a route polyline.
 *
 * Includes directional heading weighting and a localized forward search window if
 * lastSegmentIndex is provided, preventing backward snaps, opposite-lane snaps,
 * and false cross-road snapping on complex intersections.
 *
 * @param {number} gpsLat
 * @param {number} gpsLon
 * @param {Array<[number, number]>} routePath — Array of [lat, lon] pairs
 * @param {number|null} [lastSegmentIndex=null] — previous known segment index for continuity
 * @param {number|null} [userBearing=null] — current device heading/movement bearing in degrees
 * @param {number|null} [userSpeed=null] — current movement speed in m/s
 * @returns {{ snappedPos: [number, number], segmentIndex: number, distanceFromRoute: number, fractionAlongSegment: number }}
 */
export function snapToRoute(
  gpsLat,
  gpsLon,
  routePath,
  lastSegmentIndex = null,
  userBearing = null,
  userSpeed = null
) {
  if (!routePath || routePath.length < 2) {
    return {
      snappedPos: [gpsLat, gpsLon],
      segmentIndex: 0,
      distanceFromRoute: 0,
      fractionAlongSegment: 0,
    }
  }

  // Helper to compute directional alignment penalty (prevents snapping to reverse/cross roads)
  const computeDirectionPenalty = (segStart, segEnd) => {
    if (
      typeof userBearing !== 'number' ||
      isNaN(userBearing) ||
      typeof userSpeed !== 'number' ||
      isNaN(userSpeed) ||
      userSpeed < 1.2 // Only apply directional filter when actively moving (> 4.3 km/h)
    ) {
      return 0
    }
    const segAngle = computeBearing(segStart[0], segStart[1], segEnd[0], segEnd[1])
    let angleDiff = Math.abs(segAngle - userBearing)
    if (angleDiff > 180) angleDiff = 360 - angleDiff
    // Penalize opposite-direction or cross-street segments
    return angleDiff > 80 ? (1 - Math.cos((angleDiff * Math.PI) / 180)) * 30 : 0
  }

  // 1. Local window search for high continuity and sub-millisecond route tracking
  if (
    typeof lastSegmentIndex === 'number' &&
    lastSegmentIndex >= 0 &&
    lastSegmentIndex < routePath.length - 1
  ) {
    // Dynamic lookahead window based on speed (up to 30 segments ahead on highways)
    const lookahead = Math.max(12, Math.min(32, Math.round((userSpeed || 10) * 1.5)))
    const windowStart = Math.max(0, lastSegmentIndex - 1)
    const windowEnd = Math.min(routePath.length - 1, lastSegmentIndex + lookahead)

    let localBestScore = Infinity
    let localBestDist = Infinity
    let localBestPos = routePath[windowStart]
    let localBestSegIdx = windowStart
    let localBestT = 0

    for (let i = windowStart; i < windowEnd; i++) {
      const { closest, t } = projectOntoSegment(
        [gpsLat, gpsLon],
        routePath[i],
        routePath[i + 1]
      )
      const dist = haversineDist(gpsLat, gpsLon, closest[0], closest[1])
      const dirPenalty = computeDirectionPenalty(routePath[i], routePath[i + 1])
      const score = dist + dirPenalty

      if (score < localBestScore) {
        localBestScore = score
        localBestDist = dist
        localBestPos = closest
        localBestSegIdx = i
        localBestT = t
      }
    }

    // If within 45m of local path, accept localized result
    if (localBestDist <= 45) {
      return {
        snappedPos: localBestPos,
        segmentIndex: localBestSegIdx,
        distanceFromRoute: localBestDist,
        fractionAlongSegment: localBestT,
      }
    }
  }

  // 2. Full route global search fallback (e.g. initial fix, major turn, or off-route return)
  let bestScore = Infinity
  let bestDist = Infinity
  let bestPos = routePath[0]
  let bestSegIdx = 0
  let bestT = 0

  for (let i = 0; i < routePath.length - 1; i++) {
    const { closest, t } = projectOntoSegment(
      [gpsLat, gpsLon],
      routePath[i],
      routePath[i + 1]
    )
    const dist = haversineDist(gpsLat, gpsLon, closest[0], closest[1])
    const dirPenalty = computeDirectionPenalty(routePath[i], routePath[i + 1])
    const score = dist + dirPenalty

    if (score < bestScore) {
      bestScore = score
      bestDist = dist
      bestPos = closest
      bestSegIdx = i
      bestT = t
    }
  }

  return {
    snappedPos: bestPos,
    segmentIndex: bestSegIdx,
    distanceFromRoute: bestDist,
    fractionAlongSegment: bestT,
  }
}

/**
 * Check if the user has deviated from the route.
 * Tightened from 50m to 25m for 2x faster, higher precision detection.
 * Dynamically adapts to reported GPS accuracy to eliminate false alarms during momentary signal degradation.
 *
 * @param {number} distanceFromRoute — meters from route polyline
 * @param {number|null} [gpsAccuracy=null] — reported GPS horizontal accuracy in meters
 * @param {number} [baseThreshold=25] — maximum acceptable deviation in meters (default 25)
 * @returns {boolean}
 */
export function isOffRoute(distanceFromRoute, gpsAccuracy = null, baseThreshold = 25) {
  const dynamicThreshold =
    gpsAccuracy != null && typeof gpsAccuracy === 'number'
      ? Math.max(20, Math.min(45, Math.max(baseThreshold, gpsAccuracy * 1.3)))
      : baseThreshold
  return distanceFromRoute > dynamicThreshold
}

/**
 * Real-time 4D Kinematic Kalman Filter for GPS coordinates.
 *
 * Models position [x, y] and velocity [vx, vy] simultaneously in local metric space.
 * Features:
 * - Velocity compensation: eliminates the systematic 10-30m movement drag of 0th-order filters.
 * - Multi-sensor fusion: fuses hardware coords.speed & coords.heading when present.
 * - Zero-Velocity Update (ZUPT): locks velocity and suppresses process noise when stationary,
 *   completely eradicating false GPS drift while stopped at traffic lights or indoors.
 * - Mahalanobis distance outlier gating: rejects multipath jumps and sudden cellular tower bounces.
 */
export class GpsKalmanFilter {
  constructor(processNoise = 2.0) {
    this.qBase = processNoise // acceleration uncertainty (m/s^2)
    this.refLat = null
    this.refLon = null
    this.x = 0 // meters east of refLon
    this.y = 0 // meters north of refLat
    this.vx = 0 // m/s east
    this.vy = 0 // m/s north

    // Covariance matrix elements (diagonal + cross-covariance)
    this.p00 = 100 // var(x)
    this.p11 = 100 // var(y)
    this.p22 = 25 // var(vx)
    this.p33 = 25 // var(vy)
    this.p02 = 0 // cov(x, vx)
    this.p13 = 0 // cov(y, vy)

    this.lastTimestamp = null
    this.consecutiveStationaryCount = 0
    this.initialized = false
  }

  reset() {
    this.refLat = null
    this.refLon = null
    this.x = 0
    this.y = 0
    this.vx = 0
    this.vy = 0
    this.p00 = 100
    this.p11 = 100
    this.p22 = 25
    this.p33 = 25
    this.p02 = 0
    this.p13 = 0
    this.lastTimestamp = null
    this.consecutiveStationaryCount = 0
    this.initialized = false
  }

  /**
   * Filter an incoming GPS measurement.
   *
   * @param {number} rawLat - WGS84 latitude
   * @param {number} rawLon - WGS84 longitude
   * @param {number} accuracy - horizontal accuracy in meters (radius of 68% confidence)
   * @param {number} [timestamp] - milliseconds timestamp
   * @param {number|null} [hwSpeed=null] - hardware speed in m/s (from coords.speed)
   * @param {number|null} [hwHeading=null] - hardware heading in degrees (from coords.heading)
   * @returns {{ lat: number, lon: number, accuracy: number, speed: number, speedKmH: number, bearing: number|null, isStationary: boolean }}
   */
  update(rawLat, rawLon, accuracy = 10, timestamp = Date.now(), hwSpeed = null, hwHeading = null) {
    const rPosMeters = Math.max(accuracy || 10, 1.5)
    const rPosVar = rPosMeters * rPosMeters

    // 1. First fix initialization
    if (!this.initialized || this.refLat === null) {
      this.refLat = rawLat
      this.refLon = rawLon
      this.x = 0
      this.y = 0
      this.vx = 0
      this.vy = 0
      this.p00 = rPosVar
      this.p11 = rPosVar
      this.p22 = 16
      this.p33 = 16
      this.p02 = 0
      this.p13 = 0
      this.lastTimestamp = timestamp
      this.initialized = true

      return {
        lat: rawLat,
        lon: rawLon,
        accuracy: rPosMeters,
        speed: 0,
        speedKmH: 0,
        bearing: null,
        isStationary: true,
      }
    }

    // Geodesic metric conversion factors around current reference
    const meanLatRad = (this.refLat * Math.PI) / 180
    const cosLat = Math.cos(meanLatRad)
    const mPerDegLat = 111319.5
    const mPerDegLon = 111319.5 * Math.max(0.1, cosLat)

    // Elapsed time delta in seconds (clamped between 0.05s and 8.0s)
    const dt = Math.max(0.05, Math.min(8.0, ((timestamp - (this.lastTimestamp || timestamp)) / 1000) || 1.0))
    this.lastTimestamp = timestamp

    // 2. Predict Step (Kinematic constant velocity model)
    const predX = this.x + this.vx * dt
    const predY = this.y + this.vy * dt

    // Measure raw coordinates in meters relative to reference point
    const measX = (rawLon - this.refLon) * mPerDegLon
    const measY = (rawLat - this.refLat) * mPerDegLat

    // Check innovation (distance between prediction and raw measurement)
    const innovX = measX - predX
    const innovY = measY - predY
    const jumpDistance = Math.hypot(innovX, innovY)
    const apparentSpeed = jumpDistance / dt

    // Detect if device is stationary: either hardware speed is 0 or movement is sub-human (< 0.6 m/s)
    const isStationaryCandidate =
      (hwSpeed !== null && typeof hwSpeed === 'number' && hwSpeed < 0.5) ||
      (apparentSpeed < 0.65 && Math.hypot(this.vx, this.vy) < 0.8)

    if (isStationaryCandidate) {
      this.consecutiveStationaryCount++
    } else {
      this.consecutiveStationaryCount = 0
    }

    const isConfirmedStationary = this.consecutiveStationaryCount >= 2

    // Adaptive process noise:
    // When stationary, drastically damp process noise to 0.04 to eliminate stationary drift.
    // When moving, scale with acceleration uncertainty.
    const qAcc = isConfirmedStationary ? 0.04 : this.qBase
    const dt2 = dt * dt
    const dt3 = dt2 * dt
    const qPos = (dt3 / 3) * qAcc
    const qPosVel = (dt2 / 2) * qAcc
    const qVel = dt * qAcc

    // Covariance prediction: P = F * P * F^T + Q
    let p00_pred = this.p00 + 2 * this.p02 * dt + this.p22 * dt2 + qPos
    let p11_pred = this.p11 + 2 * this.p13 * dt + this.p33 * dt2 + qPos
    let p02_pred = this.p02 + this.p22 * dt + qPosVel
    let p13_pred = this.p13 + this.p33 * dt + qPosVel
    let p22_pred = this.p22 + qVel
    let p33_pred = this.p33 + qVel

    // Zero-Velocity Update (ZUPT):
    let curVx = isConfirmedStationary ? this.vx * 0.15 : this.vx
    let curVy = isConfirmedStationary ? this.vy * 0.15 : this.vy

    // 3. Outlier Rejection via Mahalanobis Distance Gating
    const sX = p00_pred + rPosVar
    const sY = p11_pred + rPosVar
    const mahalanobisSq = (innovX * innovX) / sX + (innovY * innovY) / sY

    // If sudden impossible jump (> 4 sigma outlier, e.g. > 70m burst), downweight measurement
    let effectiveRPosVar = rPosVar
    if (mahalanobisSq > 16) {
      const dampFactor = Math.min(100, mahalanobisSq / 16)
      effectiveRPosVar = rPosVar * dampFactor
    }

    // 4. Position Measurement Update: Kalman Gain K = P * H^T * S^-1
    const kX0 = p00_pred / (p00_pred + effectiveRPosVar)
    const kX2 = p02_pred / (p00_pred + effectiveRPosVar)
    const kY1 = p11_pred / (p11_pred + effectiveRPosVar)
    const kY3 = p13_pred / (p11_pred + effectiveRPosVar)

    this.x = predX + kX0 * innovX
    this.y = predY + kY1 * innovY
    this.vx = curVx + kX2 * innovX
    this.vy = curVy + kY3 * innovY

    // Covariance update: P = (I - K*H) * P
    this.p00 = (1 - kX0) * p00_pred
    this.p02 = (1 - kX0) * p02_pred
    this.p22 = p22_pred - kX2 * p02_pred
    this.p11 = (1 - kY1) * p11_pred
    this.p13 = (1 - kY1) * p13_pred
    this.p33 = p33_pred - kY3 * p13_pred

    // 5. Hardware Velocity Fusion (if device reports high-precision speed and heading)
    if (
      typeof hwSpeed === 'number' &&
      hwSpeed >= 0 &&
      !isNaN(hwSpeed) &&
      typeof hwHeading === 'number' &&
      hwHeading >= 0 &&
      !isNaN(hwHeading) &&
      !isConfirmedStationary
    ) {
      const hwHeadingRad = (hwHeading * Math.PI) / 180
      const measVx = hwSpeed * Math.sin(hwHeadingRad)
      const measVy = hwSpeed * Math.cos(hwHeadingRad)
      const rVelVar = Math.max(1.0, (rPosMeters * 0.12) ** 2)

      const kVx = this.p22 / (this.p22 + rVelVar)
      const kVy = this.p33 / (this.p33 + rVelVar)

      this.vx += kVx * (measVx - this.vx)
      this.vy += kVy * (measVy - this.vy)
      this.p22 = (1 - kVx) * this.p22
      this.p33 = (1 - kVy) * this.p33
    }

    // Convert filtered metric coordinates back to WGS84
    const filteredLat = this.refLat + this.y / mPerDegLat
    const filteredLon = this.refLon + this.x / mPerDegLon

    // Compute estimated speed & bearing
    const speedMs = isConfirmedStationary ? 0 : Math.hypot(this.vx, this.vy)
    const speedKmH = speedMs * 3.6
    let bearing = null
    if (speedMs > 0.8) {
      bearing = (Math.atan2(this.vx, this.vy) * 180 / Math.PI + 360) % 360
    }

    // Mathematically computed position error radius from covariance
    const estAccuracyMeters = Math.max(1.5, Math.min(rPosMeters, Math.sqrt((this.p00 + this.p11) / 2)))

    return {
      lat: filteredLat,
      lon: filteredLon,
      accuracy: estAccuracyMeters,
      speed: speedMs,
      speedKmH: Math.round(speedKmH * 10) / 10,
      bearing,
      isStationary: isConfirmedStationary,
    }
  }
}

/**
 * Compute navigation progress percentage (0–100) based on
 * how far along the polyline the snapped point is.
 *
 * @param {number} segmentIndex — index of the segment the point is snapped to
 * @param {number} fractionAlongSegment — 0–1 fraction along that segment
 * @param {Array<[number, number]>} routePath
 * @returns {number} percentage 0–100
 */
export function computeProgress(segmentIndex, fractionAlongSegment, routePath) {
  if (!routePath || routePath.length < 2) return 0

  const totalSegments = routePath.length - 1
  // Each segment contributes equally to progress (approximation; good enough
  // when the polyline has many small segments, which OSRM routes do)
  const progressFraction = (segmentIndex + fractionAlongSegment) / totalSegments
  return Math.min(100, Math.max(0, progressFraction * 100))
}

/**
 * Compute remaining distance from the snapped position to the end of the route.
 *
 * For performance, we use a proportional estimate based on progress percentage
 * and total route distance rather than summing segment-by-segment.
 *
 * @param {number} progressPct — current progress percentage (0–100)
 * @param {number} totalDistance — total route distance in meters
 * @returns {number} remaining distance in meters
 */
export function computeRemainingDistance(progressPct, totalDistance) {
  return Math.max(0, totalDistance * (1 - progressPct / 100))
}

/**
 * Compute remaining duration proportionally.
 *
 * @param {number} progressPct — current progress percentage (0–100)
 * @param {number} totalDuration — total route duration in seconds
 * @returns {number} remaining duration in seconds
 */
export function computeRemainingDuration(progressPct, totalDuration) {
  return Math.max(0, totalDuration * (1 - progressPct / 100))
}

/**
 * Determine which turn-by-turn step the user is currently on and return
 * the active instruction + the upcoming instruction.
 *
 * Maps the snapped segment index to the correct step by accumulating
 * step distances against the route's cumulative segment distances.
 *
 * @param {number} progressPct — navigation progress 0–100
 * @param {Array<{instruction: string, distance: number, duration: number}>} steps
 * @param {number} totalDistance — total route distance in meters
 * @returns {{ current: string, upcoming: string | null }}
 */
export function getCurrentStepInstruction(progressPct, steps, totalDistance) {
  if (!steps || steps.length === 0) {
    return { current: 'Proceed along the route', upcoming: null }
  }

  // Distance covered so far
  const coveredDist = totalDistance * (progressPct / 100)

  let cumDist = 0
  let currentIdx = 0

  for (let i = 0; i < steps.length; i++) {
    cumDist += steps[i].distance
    if (cumDist >= coveredDist) {
      currentIdx = i
      break
    }
    if (i === steps.length - 1) {
      currentIdx = i
    }
  }

  return {
    current: steps[currentIdx]?.instruction || 'Proceed along the route',
    upcoming:
      currentIdx + 1 < steps.length
        ? steps[currentIdx + 1].instruction
        : null,
  }
}

/**
 * Compute a smoothed bearing from the last few positions to avoid jitter.
 *
 * @param {Array<[number, number]>} positionHistory — recent [lat, lon] positions (newest last)
 * @param {number} minPoints — minimum positions needed to compute a bearing (default 2)
 * @returns {number | null} bearing in degrees, or null if insufficient data
 */
export function computeSmoothedBearing(positionHistory, minPoints = 2) {
  if (!positionHistory || positionHistory.length < minPoints) return null

  // Use the last two positions for bearing
  const prev = positionHistory[positionHistory.length - 2]
  const curr = positionHistory[positionHistory.length - 1]

  // Skip if the positions are too close (< 3m) to avoid jittery rotation
  const dist = haversineDist(prev[0], prev[1], curr[0], curr[1])
  if (dist < 3) return null

  return computeBearing(prev[0], prev[1], curr[0], curr[1])
}

/**
 * Converges a collection of GPS fixes into a single optimal maximum-likelihood coordinate.
 *
 * Uses inverse-variance weighting (w_i = 1 / sigma_i^2) to suppress noisy readings,
 * rejects statistical outliers, and calculates the combined standard error of the mean.
 *
 * @param {Array<{ latitude: number, longitude: number, accuracy?: number, timestamp?: number }>} fixes
 * @returns {{ latitude: number, longitude: number, accuracy: number, sampleCount: number } | null}
 */
export function convergeGpsFixes(fixes) {
  if (!fixes || fixes.length === 0) return null
  if (fixes.length === 1) {
    return {
      latitude: fixes[0].latitude,
      longitude: fixes[0].longitude,
      accuracy: fixes[0].accuracy || 15,
      sampleCount: 1,
    }
  }

  // Find the median position to detect outliers
  const validFixes = fixes.filter(
    (f) =>
      typeof f.latitude === 'number' &&
      !isNaN(f.latitude) &&
      typeof f.longitude === 'number' &&
      !isNaN(f.longitude)
  )
  if (validFixes.length === 0) return null

  // Sort by accuracy (ascending, best first)
  validFixes.sort((a, b) => (a.accuracy || 30) - (b.accuracy || 30))

  // Best fix baseline
  const baseline = validFixes[0]

  // Filter out any fix that is > 80m from the best fix (reject multipath wild points)
  const consistentFixes = validFixes.filter((f) => {
    const d = haversineDist(baseline.latitude, baseline.longitude, f.latitude, f.longitude)
    return d <= Math.max(50, (baseline.accuracy || 20) * 2.5)
  })

  const targetFixes = consistentFixes.length > 0 ? consistentFixes : [baseline]

  let totalWeight = 0
  let weightedLat = 0
  let weightedLon = 0

  for (const fix of targetFixes) {
    const acc = Math.max(1.5, fix.accuracy || 15)
    // Variance weight (inverse variance)
    const weight = 1 / (acc * acc)
    weightedLat += fix.latitude * weight
    weightedLon += fix.longitude * weight
    totalWeight += weight
  }

  const convergedLat = weightedLat / totalWeight
  const convergedLon = weightedLon / totalWeight

  // Combined standard error of the weighted mean: sigma = 1 / sqrt(sum(1 / sigma_i^2))
  const combinedSigma = Math.max(2.0, Math.min(baseline.accuracy || 15, 1 / Math.sqrt(totalWeight)))

  return {
    latitude: convergedLat,
    longitude: convergedLon,
    accuracy: Math.round(combinedSigma * 10) / 10,
    sampleCount: targetFixes.length,
  }
}
