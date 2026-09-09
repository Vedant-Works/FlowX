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
  normal: {
    time: 0.40,
    distance: 0.25,
    traffic: 0.15,
    weather: 0.10,
    safety: 0.10,
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
      return 82 // car
    case 'rain':
      if (vehicle === 'walking') return 20
      if (vehicle === 'bike') return 30
      return 68 // car
    case 'storm':
    case 'snow':
      if (vehicle === 'walking') return 10
      if (vehicle === 'bike') return 15
      return 40 // car
    default:
      return 85
  }
}

/**
 * Enhanced safety scoring.
 *
 * Walking mode:
 * - When night safety is active: prioritized by live traffic presence on the road.
 *   Deserted / low-traffic routes are heavily penalized regardless of length.
 *   Active corridors with steady vehicular flow receive high safety scores.
 * - Daytime walking: shorter distance and simpler routes.
 *
 * Bike mode:
 * - Duration-based (less time on road = safer)
 *
 * Car mode:
 * - Traffic-based (smoother traffic = safer)
 */
function scoreSafety(route, vehicle, allRoutes, trafficAnalysis, isNightSafetyActive) {
  const distances = allRoutes.map((item) => item.distance)

  if (vehicle === 'walking') {
    const trafficObj = trafficAnalysis?.find((t) => t.routeId === route.id)
    const trafficActivity = trafficObj?.trafficActivity ?? 50
    const isDeserted = trafficObj?.isDeserted || trafficActivity < 25

    if (isNightSafetyActive) {
      // At night, deserted/empty roads pose severe isolation and safety risks.
      // Active vehicle traffic provides natural surveillance, street lighting, and visibility.
      if (isDeserted) {
        // Severe penalty for deserted roads regardless of short distance
        return Math.min(10, Math.max(2, Math.round(trafficActivity * 0.2)))
      }
      // Active traffic corridor: continuous vehicle flow provides high safety
      return Math.min(100, Math.round(75 + (trafficActivity * 0.25)))
    }

    // Daytime walking mode or safety ignored: shorter distance is preferred
    let baseScore = normalizeLowerIsBetter(
      route.distance,
      Math.min(...distances),
      Math.max(...distances),
    )

    // Route complexity bonus: fewer points in path = simpler/more direct
    const pathPoints = route.path?.length || 0
    const maxPoints = Math.max(...allRoutes.map((r) => r.path?.length || 0))
    if (maxPoints > 0) {
      const complexityRatio = pathPoints / maxPoints
      const complexityPenalty = complexityRatio * 8
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

  // Cars: prioritize routes with lower congestion for smoother and safer travel
  return scoreTraffic(route, trafficAnalysis)
}

function getWeights(preference) {
  return PREFERENCE_WEIGHTS[preference] || PREFERENCE_WEIGHTS.balanced
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
export function getWalkingSafetyWarnings(
  route,
  vehicle,
  isNightSafetyActive = false,
  isSafetyIgnoredByUser = false,
  trafficAnalysis = null
) {
  if (vehicle !== 'walking') return []

  const warnings = []
  const distanceKm = route.distance / 1000
  const durationMin = route.duration / 60
  const trafficObj = trafficAnalysis?.find((t) => t.routeId === route.id)
  const isDeserted = trafficObj?.isDeserted || (trafficObj?.trafficActivity != null && trafficObj.trafficActivity < 25)

  if (isNightSafetyActive) {
    if (isDeserted) {
      warnings.push({
        type: 'deserted_night',
        icon: '🚨',
        message: 'Deserted route with little/no live traffic at night. High isolation risk — NOT suggested regardless of length.',
      })
    } else {
      warnings.push({
        type: 'safe_night_corridor',
        icon: '🛡️',
        message: 'Active traffic corridor: Continuous live vehicle presence provides natural lighting and surveillance.',
      })
    }
  } else if (isSafetyIgnoredByUser && isDeserted) {
    warnings.push({
      type: 'deserted_ignored',
      icon: '⚠️',
      message: 'Deserted road at night (Safety bypassed for direct shortest route).',
    })
  }

  // Long walking route warning
  if (distanceKm > 3) {
    warnings.push({
      type: 'distance',
      icon: '🚶',
      message: `Long walk: ${distanceKm.toFixed(1)} km (~${Math.round(durationMin)} min)`,
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
export function rankRoutes(routes, { vehicle, preference, weather, trafficAnalysis, nightSafety }) {
  if (!routes.length) {
    return []
  }

  const hour = new Date().getHours()
  const isNightHours = hour >= 20 || hour < 6

  // Night safety mode applies STRICTLY AND ONLY to walking mode when preference is 'safest' (or explicit nightSafety)
  const isNightSafetyActive =
    vehicle === 'walking' &&
    (preference === 'safest' || (nightSafety === true && isNightHours))

  const isSafetyIgnoredByUser = vehicle === 'walking' && preference === 'normal' && isNightHours

  const weights = getWeights(preference)

  const scored = routes.map((route) => {
    const trafficObj = trafficAnalysis?.find((t) => t.routeId === route.id) || null
    const isDeserted = trafficObj?.isDeserted || (trafficObj?.trafficActivity != null && trafficObj.trafficActivity < 25)

    const breakdown = {
      time: Math.round(scoreTime(route, routes)),
      distance: Math.round(scoreDistance(route, routes)),
      traffic: Math.round(scoreTraffic(route, trafficAnalysis)),
      weather: Math.round(scoreWeather(weather, vehicle)),
      safety: Math.round(scoreSafety(route, vehicle, routes, trafficAnalysis, isNightSafetyActive)),
    }

    const safetyWarnings = getWalkingSafetyWarnings(
      route,
      vehicle,
      isNightSafetyActive,
      isSafetyIgnoredByUser,
      trafficAnalysis
    )

    let totalScore = computeTotalScore(breakdown, weights)

    // When night safety is active, heavily penalize deserted routes so they cannot outrank active routes
    if (isNightSafetyActive && isDeserted) {
      totalScore = Math.min(totalScore, 25)
    }

    return {
      ...route,
      traffic: trafficObj,
      breakdown,
      score: totalScore,
      safetyWarnings,
      isDesertedAtNight: isNightSafetyActive && isDeserted,
      isNightSafetyActive,
    }
  })

  let finalOrder = []

  if (vehicle === 'walking') {
    if (preference === 'safest') {
      // 1) Safest walking mode (Night only): Strictly 1 route option
      // Prioritizes corridors with active live vehicular traffic; rejects deserted/empty streets
      const activeRoutes = scored
        .filter((r) => !r.isDesertedAtNight)
        .sort((a, b) => b.score - a.score)

      const fallbackRoutes = [...scored].sort((a, b) => b.score - a.score)
      const topSafeRoute = activeRoutes[0] || fallbackRoutes[0]

      if (topSafeRoute) {
        finalOrder = [
          {
            ...topSafeRoute,
            rank: 1,
            label: '🌟 Recommended Safe Night Corridor',
          },
        ]
      }
    } else {
      // 2) Normal walking mode: Suggests the fastest route and ONE alternative route (strictly 2 routes)
      // Route 1: Fastest walking route (lowest duration, then shortest distance)
      const sortedByTime = [...scored].sort((a, b) => {
        if (a.duration !== b.duration) return a.duration - b.duration
        return a.distance - b.distance
      })

      const fastestRoute = sortedByTime[0]

      // Route 2: Distinct alternative walking corridor
      let alternativeRoute = sortedByTime.find((r) => r.id !== fastestRoute?.id)
      if (!alternativeRoute && scored.length > 1) {
        const sortedByScore = [...scored].sort((a, b) => b.score - a.score)
        alternativeRoute = sortedByScore.find((r) => r.id !== fastestRoute?.id)
      }

      if (fastestRoute && alternativeRoute) {
        finalOrder = [
          {
            ...fastestRoute,
            rank: 1,
            label: '⚡ Fastest Route',
          },
          {
            ...alternativeRoute,
            rank: 2,
            label: '🌿 Alternative Route',
          },
        ]
      } else if (fastestRoute) {
        finalOrder = [
          {
            ...fastestRoute,
            rank: 1,
            label: '⚡ Fastest Route',
          },
        ]
      }
    }
  } else {
    // Motorized vehicles: Four-Wheeler (car) & Two-Wheeler (bike)
    if (preference === 'fastest') {
      // Fastest route: Show ONLY ONE route which is fastest considering live traffic delays
      const sortedFastest = [...scored].sort((a, b) => {
        if (a.duration !== b.duration) return a.duration - b.duration
        const aDelay = a.traffic?.delayMinutes || 0
        const bDelay = b.traffic?.delayMinutes || 0
        if (aDelay !== bDelay) return aDelay - bDelay
        return a.distance - b.distance
      })

      const topFastest = sortedFastest[0]
      if (topFastest) {
        finalOrder = [
          {
            ...topFastest,
            rank: 1,
            label: '⚡ Fastest Direct (Least Traffic)',
          },
        ]
      }
    } else {
      // Balanced route (default): Show EXACTLY TWO route options (one balanced, one fastest alternative)
      // Route 1: Balanced route (highest overall score under balanced weights)
      const sortedByScore = [...scored].sort((a, b) => b.score - a.score)
      const balancedRoute = sortedByScore[0]

      // Route 2: Fastest route (lowest total duration including live traffic)
      const sortedByTime = [...scored].sort((a, b) => {
        if (a.duration !== b.duration) return a.duration - b.duration
        return a.distance - b.distance
      })

      let secondRoute = sortedByTime.find((r) => r.id !== balancedRoute?.id)
      if (!secondRoute && sortedByScore.length > 1) {
        secondRoute = sortedByScore[1]
      }

      if (balancedRoute && secondRoute) {
        const isFirstAlsoFastest = balancedRoute.duration <= secondRoute.duration
        finalOrder = [
          {
            ...balancedRoute,
            rank: 1,
            label: '🌟 Recommended Balanced Corridor',
          },
          {
            ...secondRoute,
            rank: 2,
            label: isFirstAlsoFastest
              ? '🌿 Smooth Traffic Alternative'
              : '⚡ Fastest Corridor',
          },
        ]
      } else if (balancedRoute) {
        finalOrder = [
          {
            ...balancedRoute,
            rank: 1,
            label: '🌟 Recommended Balanced Corridor',
          },
        ]
      }
    }
  }

  return finalOrder
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
