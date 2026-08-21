/**
 * FlowX route ranking engine.
 *
 * Each route gets a score from 0–100 (higher = better).
 * We combine several factors: time, distance, traffic, weather, and safety.
 */

// How much each factor matters for each user preference
const PREFERENCE_WEIGHTS = {
  fastest: {
    time: 0.50,
    distance: 0.15,
    traffic: 0.25,
    weather: 0.05,
    safety: 0.05,
  },
  balanced: {
    time: 0.30,
    distance: 0.15,
    traffic: 0.25,
    weather: 0.15,
    safety: 0.15,
  },
  safest: {
    time: 0.15,
    distance: 0.10,
    traffic: 0.20,
    weather: 0.15,
    safety: 0.40,
  },
}

function normalizeLowerIsBetter(value, min, max) {
  if (max === min) {
    return 85
  }
  return 40 + 60 * ((max - value) / (max - min))
}

function scoreTime(route, allRoutes) {
  const durations = allRoutes.map((item) => item.duration)
  return normalizeLowerIsBetter(
    route.duration,
    Math.min(...durations),
    Math.max(...durations),
  )
}

function scoreDistance(route, allRoutes) {
  const distances = allRoutes.map((item) => item.distance)
  return normalizeLowerIsBetter(
    route.distance,
    Math.min(...distances),
    Math.max(...distances),
  )
}

/**
 * Dynamic traffic scoring based on traffic congestion analysis.
 */
function scoreTraffic(route, trafficAnalysis) {
  if (trafficAnalysis && Array.isArray(trafficAnalysis)) {
    const info = trafficAnalysis.find((item) => item.routeId === route.id)
    if (info) {
      return Math.max(10, 100 - info.congestionFactor)
    }
  }
  return 85 // Fallback neutral score
}

/**
 * Dynamic weather scoring based on live weather condition and vehicle profile.
 */
function scoreWeather(weather, vehicle) {
  if (!weather || !weather.severity) {
    return 85 // Neutral fallback
  }

  const { severity } = weather

  switch (severity) {
    case 'clear':
      return 100
    case 'clouds':
      return 92
    case 'light_rain':
      if (vehicle === 'walking') return 35
      if (vehicle === 'bike') return 45
      return 82 // car / truck
    case 'rain':
      if (vehicle === 'walking') return 20
      if (vehicle === 'bike') return 30
      return 68 // car / truck
    case 'storm':
    case 'snow':
      if (vehicle === 'walking') return 10
      if (vehicle === 'bike') return 15
      return 40 // car / truck
    default:
      return 85
  }
}

/**
 * Enhanced safety scoring.
 *
 * Walking mode:
 * - Penalizes longer routes (shorter = safer for pedestrians)
 * - Time-of-day factor: night hours (8 PM – 6 AM) lower safety for long routes
 * - Route complexity: fewer turns / more direct = safer
 *
 * Bike mode:
 * - Duration-based (less time on road = safer)
 *
 * Car/Truck:
 * - Traffic-based (smoother traffic = safer)
 */
function scoreSafety(route, vehicle, allRoutes) {
  const distances = allRoutes.map((item) => item.distance)

  if (vehicle === 'walking') {
    // Base distance score (shorter is safer)
    let baseScore = normalizeLowerIsBetter(
      route.distance,
      Math.min(...distances),
      Math.max(...distances),
    )

    // Time-of-day penalty: walking at night is riskier for longer routes
    const hour = new Date().getHours()
    const isNightTime = hour >= 20 || hour < 6

    if (isNightTime) {
      // Penalize longer routes more during night
      const maxDist = Math.max(...distances)
      const distRatio = maxDist > 0 ? route.distance / maxDist : 0
      const nightPenalty = distRatio * 20 // Up to -20 for longest route at night
      baseScore = Math.max(10, baseScore - nightPenalty)
    }

    // Route complexity bonus: fewer points in path = simpler/more direct
    const pathPoints = route.path?.length || 0
    const maxPoints = Math.max(...allRoutes.map((r) => r.path?.length || 0))
    if (maxPoints > 0) {
      const complexityRatio = pathPoints / maxPoints
      const complexityPenalty = complexityRatio * 8 // Up to -8 for most complex
      baseScore = Math.max(10, baseScore - complexityPenalty)
    }

    return baseScore
  }

  if (vehicle === 'bike') {
    return normalizeLowerIsBetter(
      route.duration,
      Math.min(...allRoutes.map((item) => item.duration)),
      Math.max(...allRoutes.map((item) => item.duration)),
    )
  }

  // Cars/trucks: slight preference for steady speeds (often main roads)
  return scoreTraffic(route, allRoutes)
}

function getWeights(preference, vehicle) {
  const base = PREFERENCE_WEIGHTS[preference] || PREFERENCE_WEIGHTS.balanced

  // Trucks care more about traffic flow (highway suitability proxy)
  if (vehicle === 'truck') {
    return {
      ...base,
      traffic: base.traffic + 0.1,
      time: Math.max(base.time - 0.05, 0.05),
    }
  }

  return base
}

function computeTotalScore(breakdown, weights) {
  const total =
    breakdown.time * weights.time +
    breakdown.distance * weights.distance +
    breakdown.traffic * weights.traffic +
    breakdown.weather * weights.weather +
    breakdown.safety * weights.safety

  return Math.round(total)
}

/**
 * Generate walking safety warnings for a route.
 */
export function getWalkingSafetyWarnings(route, vehicle) {
  if (vehicle !== 'walking') return []

  const warnings = []
  const distanceKm = route.distance / 1000
  const durationMin = route.duration / 60
  const hour = new Date().getHours()
  const isNightTime = hour >= 20 || hour < 6

  // Long walking route warning
  if (distanceKm > 3) {
    warnings.push({
      type: 'distance',
      icon: '🚶',
      message: `Long walk: ${distanceKm.toFixed(1)} km (~${Math.round(durationMin)} min)`,
    })
  }

  // Night safety warning
  if (isNightTime && distanceKm > 1.5) {
    warnings.push({
      type: 'night',
      icon: '🌙',
      message: 'Night hours — consider well-lit main roads',
    })
  }

  // Very long duration warning
  if (durationMin > 45) {
    warnings.push({
      type: 'fatigue',
      icon: '⏱️',
      message: 'Extended walk — consider alternative transport',
    })
  }

  return warnings
}

/**
 * Rank routes best-first and attach score breakdown to each.
 */
export function rankRoutes(routes, { vehicle, preference, weather, trafficAnalysis }) {
  if (!routes.length) {
    return []
  }

  const weights = getWeights(preference, vehicle)

  const scored = routes.map((route) => {
    const trafficObj = trafficAnalysis?.find((t) => t.routeId === route.id) || null

    const breakdown = {
      time: Math.round(scoreTime(route, routes)),
      distance: Math.round(scoreDistance(route, routes)),
      traffic: Math.round(scoreTraffic(route, trafficAnalysis)),
      weather: Math.round(scoreWeather(weather, vehicle)),
      safety: Math.round(scoreSafety(route, vehicle, routes)),
    }

    const safetyWarnings = getWalkingSafetyWarnings(route, vehicle)

    return {
      ...route,
      traffic: trafficObj,
      breakdown,
      score: computeTotalScore(breakdown, weights),
      safetyWarnings,
    }
  })

  scored.sort((a, b) => b.score - a.score)

  const ROUTE_LABELS = [
    '🌟 Recommended Corridor',
    '⚡ Express Direct',
    '🌿 Low-Traffic Bypass',
    '🛡️ Safe Corridor',
    '🛣️ Outer Bypass',
  ]

  return scored.map((route, index) => ({
    ...route,
    rank: index + 1,
    label: ROUTE_LABELS[index] || `Corridor ${index + 1}`,
  }))
}

export function getScoreColor(score) {
  if (score >= 80) {
    return 'good'
  }
  if (score >= 60) {
    return 'medium'
  }
  return 'low'
}
