/**
 * FlowX TomTom Traffic-Aware Routing Service
 * Directly integrates TomTom Calculate Route API with live traffic data,
 * real-time delay calculations, and alternatives routing around congestion.
 */

import { TOMTOM_API_KEY } from './traffic.js'

export async function fetchTomTomTrafficRoutes(from, to, vehicle, via = null, apiKey = TOMTOM_API_KEY) {
  if (!apiKey) return null

  // TomTom supported travel modes
  const modeMap = {
    car: 'car',
    bike: 'bicycle',
    walking: 'pedestrian',
  }

  const travelMode = modeMap[vehicle] || 'car'

  // Build coordinate points colon-separated: lat,lon:lat,lon
  const waypoints = via
    ? `${from.lat},${from.lon}:${via.lat},${via.lon}:${to.lat},${to.lon}`
    : `${from.lat},${from.lon}:${to.lat},${to.lon}`

  try {
    const params = new URLSearchParams({
      key: apiKey,
      traffic: 'true',
      departAt: 'now',
      maxAlternatives: '3',
      routeType: 'fastest',
      travelMode,
      computeTravelTimeFor: 'all',
      instructionsType: 'text',
      language: 'en-US',
    })

    const url = `https://api.tomtom.com/routing/1/calculateRoute/${waypoints}/json?${params}`
    const response = await fetch(url)

    if (!response.ok) {
      console.warn('TomTom Routing API response not ok:', response.status, response.statusText)
      return null
    }

    const data = await response.json()
    if (!data.routes || !Array.isArray(data.routes) || data.routes.length === 0) {
      return null
    }

    return data.routes.map((route, idx) => {
      const summary = route.summary || {}
      const distance = summary.lengthInMeters || 0
      const totalDuration = summary.travelTimeInSeconds || 0
      const trafficDelaySeconds = summary.trafficDelayInSeconds || 0
      const delayMinutes = Math.round(trafficDelaySeconds / 60)
      const baseDuration = Math.max(0, totalDuration - trafficDelaySeconds)

      // Flatten coordinates from all legs
      const path = []
      const legs = route.legs || []
      legs.forEach((leg) => {
        if (leg.points) {
          leg.points.forEach((pt) => {
            path.push([pt.latitude, pt.longitude])
          })
        }
      })

      // Extract guidance instructions if present
      const formattedSteps = []
      if (route.guidance?.instructions) {
        route.guidance.instructions.forEach((ins) => {
          if (ins.message) {
            formattedSteps.push({
              instruction: ins.message,
              distance: ins.routeOffsetInMeters || 0,
              duration: ins.travelTimeInSeconds || 0,
            })
          }
        })
      }

      // CO2 calculations
      const distanceKm = distance / 1000
      let co2 = 0
      if (vehicle === 'car') co2 = Number((distanceKm * 0.12).toFixed(2))

      return {
        id: `route-${idx + 1}`,
        path,
        distance,
        duration: totalDuration, // Real-time duration INCLUDING traffic delay!
        baseDuration,            // Free-flow base duration
        delayMinutes,            // Delay due to current traffic
        trafficDelaySeconds,
        co2Emissions: co2,
        steps: formattedSteps,
        isTrafficAware: true,
        dataSource: 'TomTom Live Traffic Engine',
      }
    })
  } catch (err) {
    console.warn('TomTom Routing API lookup failed:', err.message)
    return null
  }
}
