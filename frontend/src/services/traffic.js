/**
 * FlowX Live Traffic & Congestion Engine
 * Evaluates traffic flow, calculates delay estimates, and assigns congestion levels.
 * Supports TomTom Traffic API with intelligent urban peak-hour flow model fallback.
 */

export const TOMTOM_API_KEY = import.meta.env.VITE_TOMTOM_API_KEY || null

/**
 * Calculates current peak hour congestion multiplier based on local time
 */
function getPeakHourMultiplier() {
  const now = new Date()
  const hour = now.getHours() + now.getMinutes() / 60
  const isWeekend = now.getDay() === 0 || now.getDay() === 6

  if (isWeekend) {
    // Weekend afternoon slight peak (1pm - 6pm)
    if (hour >= 13 && hour <= 18) return 1.25
    return 1.0
  }

  // Morning rush hour (8:00 AM - 10:30 AM)
  if (hour >= 8.0 && hour <= 10.5) {
    return 1.65
  }

  // Evening rush hour (5:00 PM - 8:00 PM)
  if (hour >= 17.0 && hour <= 20.0) {
    return 1.75
  }

  // Mid-day traffic (11:00 AM - 4:00 PM)
  if (hour >= 11.0 && hour <= 16.0) {
    return 1.3
  }

  // Off-peak / late night (8:00 PM - 7:00 AM)
  return 1.0
}

/**
 * Fetch real-time traffic flow data from TomTom Flow Segment API for a specific coordinate
 */
export async function fetchTomTomFlowSegment(lat, lon, apiKey = TOMTOM_API_KEY) {
  if (!apiKey) return null
  try {
    const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/relative0/10/json?point=${lat}%2C${lon}&unit=KMPH&key=${apiKey}`
    const response = await fetch(url)
    if (!response.ok) return null
    const data = await response.json()
    return data.flowSegmentData || null
  } catch (err) {
    console.warn('TomTom Flow Segment API warning:', err.message)
    return null
  }
}

/**
 * Evaluates traffic along a route using TomTom Traffic Flow API
 */
async function analyzeTomTomRouteTraffic(route, apiKey) {
  if (!route.path || route.path.length === 0) return null

  // Sample 5 points evenly along the route path (15%, 35%, 50%, 70%, 85%)
  const len = route.path.length
  const sampleIndices = [
    Math.floor(len * 0.15),
    Math.floor(len * 0.35),
    Math.floor(len * 0.5),
    Math.floor(len * 0.7),
    Math.floor(len * 0.85),
  ].filter((idx) => idx >= 0 && idx < len)

  const samplePoints = sampleIndices.map((idx) => route.path[idx])
  const flowResults = await Promise.all(
    samplePoints.map(([lat, lon]) => fetchTomTomFlowSegment(lat, lon, apiKey))
  )

  const validFlows = flowResults.filter(Boolean)
  if (validFlows.length === 0) return null

  let totalCurrentSpeed = 0
  let totalFreeFlowSpeed = 0
  let totalCurrentTravelTime = 0
  let totalFreeFlowTravelTime = 0
  let hasClosure = false

  for (const flow of validFlows) {
    if (flow.roadClosure) hasClosure = true
    totalCurrentSpeed += flow.currentSpeed || 30
    totalFreeFlowSpeed += flow.freeFlowSpeed || 50
    totalCurrentTravelTime += flow.currentTravelTime || 0
    totalFreeFlowTravelTime += flow.freeFlowTravelTime || 0
  }

  const avgCurrentSpeed = totalCurrentSpeed / validFlows.length
  const avgFreeFlowSpeed = totalFreeFlowSpeed / validFlows.length

  let congestionFactor = 0
  if (hasClosure) {
    congestionFactor = 95
  } else if (avgFreeFlowSpeed > 0) {
    const ratio = avgCurrentSpeed / avgFreeFlowSpeed
    congestionFactor = Math.max(0, Math.min(100, Math.round((1 - ratio) * 100)))
  }

  const delaySeconds = Math.max(0, totalCurrentTravelTime - totalFreeFlowTravelTime)
  const delayMinutes = Math.round(delaySeconds / 60)

  const trafficActivity = Math.round((validFlows.length / samplePoints.length) * 100)

  return {
    congestionFactor,
    delayMinutes,
    currentSpeedKmh: Math.round(avgCurrentSpeed),
    freeFlowSpeedKmh: Math.round(avgFreeFlowSpeed),
    trafficActivity,
  }
}

/**
 * Evaluates traffic data for a set of routes
 */
export async function analyzeTraffic(routes, vehicle) {
  const peakMultiplier = getPeakHourMultiplier()
  const isNonMotorized = vehicle === 'walking' || vehicle === 'bike'

  const results = await Promise.all(
    routes.map(async (route, index) => {
      const distanceKm = route.distance / 1000
      const durationMin = route.duration / 60
      const avgSpeedKmh = durationMin > 0 ? distanceKm / (durationMin / 60) : 30

      let congestionFactor = 0
      let delayMinutes = 0
      let dataSource = 'Urban Flow Model'
      let tomtomData = null

      // If TomTom API key is provided, fetch real-time TomTom traffic flow data
      if (TOMTOM_API_KEY) {
        try {
          tomtomData = await analyzeTomTomRouteTraffic(route, TOMTOM_API_KEY)
          if (tomtomData) {
            if (!isNonMotorized) {
              congestionFactor = tomtomData.congestionFactor
              delayMinutes = tomtomData.delayMinutes
            }
            dataSource = 'TomTom Real-Time'
          }
        } catch (err) {
          console.warn('TomTom traffic lookup failed, falling back to model:', err)
        }
      }

      // If TomTom was not used or had no points, use urban model
      if (dataSource === 'Urban Flow Model') {
        let freeFlowSpeed = 45
        if (vehicle === 'bike') freeFlowSpeed = 15
        if (vehicle === 'walking') freeFlowSpeed = 5

        if (!isNonMotorized) {
          const speedRatio = Math.min(avgSpeedKmh / freeFlowSpeed, 1.2)
          const altVariance = index === 0 ? 1.0 : 1.1 + index * 0.15
          congestionFactor = Math.max(
            0,
            Math.min(
              100,
              Math.round((1 - speedRatio / (peakMultiplier * altVariance)) * 100)
            )
          )

          if (congestionFactor > 70) {
            delayMinutes = Math.round(durationMin * 0.4)
          } else if (congestionFactor > 45) {
            delayMinutes = Math.round(durationMin * 0.25)
          } else if (congestionFactor > 20) {
            delayMinutes = Math.round(durationMin * 0.12)
          }
        } else {
          congestionFactor = 5
          delayMinutes = 0
        }
      }

      // Calculate street-level vehicular traffic activity (critical for pedestrian night safety)
      let trafficActivity = 0
      if (vehicle === 'walking') {
        if (tomtomData && tomtomData.trafficActivity != null) {
          trafficActivity = tomtomData.trafficActivity
        } else {
          // In the urban model: primary corridor (index 0) runs along busy arterial streets;
          // secondary (index 1) has moderate activity; alternative shortcuts (index >= 2)
          // cut through quiet or deserted residential lanes/alleys
          if (index === 0) trafficActivity = 85
          else if (index === 1) trafficActivity = 60
          else trafficActivity = 15 // Deserted backstreet / alley
        }
      } else {
        trafficActivity = Math.max(20, 100 - congestionFactor)
      }

      const isDeserted = vehicle === 'walking' && trafficActivity < 25
      const trafficPresenceLabel = isDeserted
        ? 'Deserted / No Live Traffic'
        : (trafficActivity >= 70 ? 'Active Traffic Flow' : 'Moderate Traffic')

      // Determine traffic severity level
      let level = 'low'
      let label = 'Smooth Flow'
      let color = '#10b981' // Green

      if (congestionFactor > 70) {
        level = 'severe'
        label = 'Severe Gridlock'
        color = '#ef4444' // Red
      } else if (congestionFactor > 45) {
        level = 'heavy'
        label = 'Heavy Congestion'
        color = '#f97316' // Orange
      } else if (congestionFactor > 20) {
        level = 'moderate'
        label = 'Moderate Traffic'
        color = '#f59e0b' // Amber
      }

      return {
        routeId: route.id,
        congestionFactor, // 0-100
        level, // 'low' | 'moderate' | 'heavy' | 'severe'
        label,
        color,
        delayMinutes,
        isPeakHour: peakMultiplier > 1.3,
        dataSource,
        currentSpeedKmh: tomtomData?.currentSpeedKmh ?? Math.round(avgSpeedKmh),
        freeFlowSpeedKmh: tomtomData?.freeFlowSpeedKmh ?? 50,
        trafficActivity,
        isDeserted,
        trafficPresenceLabel,
      }
    })
  )

  return results
}

