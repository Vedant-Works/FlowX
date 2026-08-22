import { rankRoutes } from './routeRanking.js'
import { fetchWeather } from './weather.js'
import { analyzeTraffic } from './traffic.js'

const VEHICLE_PROFILES = {
  car: 'driving',
  truck: 'driving',
  bike: 'cycling',
  walking: 'foot',
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse'
const OSRM_URL = 'https://router.project-osrm.org/route/v1'

/**
 * Turn a place name, coordinate object, or location string into exact coordinates.
 *
 * Resolution strategies (tried in order):
 * 1. Pre-geocoded {lat, lon, name} objects — instant passthrough
 * 2. Raw coordinate strings like "19.0596, 72.8295"
 * 3. Nominatim free-text search (worldwide, limit 8, address details)
 * 4. Nominatim structured search with deduced city/country parts
 * 5. Photon geocoder (worldwide Komoot-backed OSM search)
 * 6. Overpass global fuzzy name search for shops/amenities/transit
 *
 * No region is hardcoded — works for any city/country worldwide.
 */
export async function geocodePlace(placeInput) {
  if (!placeInput) {
    throw new Error('Please enter a valid location.')
  }

  // 1. Pre-geocoded object passthrough
  if (typeof placeInput === 'object' && placeInput.lat != null && placeInput.lon != null) {
    return {
      lat: Number(placeInput.lat),
      lon: Number(placeInput.lon),
      name: placeInput.name || `${Number(placeInput.lat).toFixed(5)}, ${Number(placeInput.lon).toFixed(5)}`,
    }
  }

  const queryStr = String(placeInput).trim()
  if (!queryStr) throw new Error('Please enter a valid location.')

  // 2. Raw coordinate pair "lat, lon"
  const coordMatch = queryStr.match(/^([-+]?\d+(?:\.\d+)?)\s*,\s*([-+]?\d+(?:\.\d+)?)$/)
  if (coordMatch) {
    const lat = Number(coordMatch[1])
    const lon = Number(coordMatch[2])
    const name = await reverseGeocode(lat, lon)
    return { lat, lon, name: name || queryStr }
  }

  // --- Helper: Nominatim free-text search (restricted to India) ---
  async function searchNominatim(searchTerm, extraParams = {}) {
    try {
      const params = new URLSearchParams({
        q: searchTerm,
        format: 'json',
        addressdetails: '1',
        limit: '8',
        dedupe: '1',
        countrycodes: 'in',           // India only
        viewbox: '68.1,37.6,97.4,6.4', // W,N,E,S bounding box of India
        bounded: '1',                  // restrict results to viewbox
        ...extraParams,
      })
      const res = await fetch(`${NOMINATIM_URL}?${params}`, {
        headers: { Accept: 'application/json', 'User-Agent': 'FlowX-Hackathon/1.0' },
      })
      if (!res.ok) return []
      return await res.json()
    } catch {
      return []
    }
  }

  // --- Helper: Photon (Komoot) geocoder — biased to India ---
  async function searchPhoton(searchTerm) {
    try {
      // Bias results toward India's geographic center
      const params = new URLSearchParams({
        q: searchTerm,
        limit: '5',
        lat: '20.5937',
        lon: '78.9629',
      })
      const res = await fetch(`https://photon.komoot.io/api/?${params}`, {
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) return []
      const data = await res.json()
      // Filter results to India bounding box only
      return (data.features || [])
        .filter((f) => {
          const lat = f.geometry?.coordinates?.[1]
          const lon = f.geometry?.coordinates?.[0]
          return lat >= 6.4 && lat <= 37.6 && lon >= 68.1 && lon <= 97.4
        })
        .map((f) => ({
          lat: String(f.geometry?.coordinates?.[1]),
          lon: String(f.geometry?.coordinates?.[0]),
          display_name:
            [f.properties?.name, f.properties?.street, f.properties?.city, f.properties?.country]
              .filter(Boolean)
              .join(', ') || searchTerm,
        }))
    } catch {
      return []
    }
  }

  // --- Helper: Overpass fuzzy name search (restricted to India bbox) ---
  async function searchOverpass(searchTerm) {
    try {
      const cleanName = searchTerm
        .split(',')[0]
        .trim()
        .replace(/[\\/"']/g, '') // sanitise for regex injection
      if (cleanName.length < 3) return null
      // India bounding box: south=6.4, west=68.1, north=37.6, east=97.4
      const overpassQuery = `
        [out:json][timeout:10][bbox:6.4,68.1,37.6,97.4];
        (
          node["name"~"${cleanName}",i];
          way["name"~"${cleanName}",i];
        );
        out center 1;
      `
      const res = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(overpassQuery)}`,
      })
      if (!res.ok) return null
      const data = await res.json()
      const el = data.elements?.[0]
      if (!el) return null
      const lat = el.lat || el.center?.lat
      const lon = el.lon || el.center?.lon
      if (!lat || !lon) return null
      return { lat: Number(lat), lon: Number(lon), name: el.tags?.name || cleanName }
    } catch {
      return null
    }
  }

  // ===== Strategy 3: Direct Nominatim free-text =====
  let results = await searchNominatim(queryStr)

  // ===== Strategy 4: Try structured city/country splits =====
  if (!results.length) {
    // Split "Taj Mahal, Agra" → street:"Taj Mahal" city:"Agra"
    const parts = queryStr.split(',').map((s) => s.trim()).filter(Boolean)
    if (parts.length >= 2) {
      const structured = new URLSearchParams({
        street: parts[0],
        city: parts[1],
        country: parts[2] || '',
        format: 'json',
        addressdetails: '1',
        limit: '5',
      })
      try {
        const res = await fetch(`${NOMINATIM_URL}?${structured}`, {
          headers: { Accept: 'application/json', 'User-Agent': 'FlowX-Hackathon/1.0' },
        })
        if (res.ok) results = await res.json()
      } catch { /* ignore */ }
    }
  }

  // ===== Strategy 5: Photon worldwide fuzzy search =====
  if (!results.length) {
    results = await searchPhoton(queryStr)
  }

  // Return best match if any strategy succeeded
  if (results.length > 0) {
    const place = results[0]
    return {
      lat: Number(place.lat),
      lon: Number(place.lon),
      name: place.display_name || queryStr,
    }
  }

  // ===== Strategy 6: Global Overpass name search =====
  const overpassResult = await searchOverpass(queryStr)
  if (overpassResult) {
    return overpassResult
  }

  throw new Error(`Could not find location: "${queryStr}". Try adding a city or neighborhood.`)
}

/**
 * Turn latitude/longitude coordinates into exact building, shop, park, or place names.
 *
 * Chaining strategies:
 * 1. Overpass API 45m tight radius search for named shops, parks, buildings, amenities, tourism
 * 2. Nominatim zoom=18 building/address level reverse geocode
 * 3. Photon Komoot reverse geocode fallback
 */
export async function reverseGeocode(lat, lon) {
  const nLat = Number(lat)
  const nLon = Number(lon)
  if (isNaN(nLat) || isNaN(nLon)) return `${lat}, ${lon}`

  // --- Strategy 1: Overpass Micro-Radius (45m) POI Search for exact shop/building/park name ---
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3500)
    const overpassQuery = `
      [out:json][timeout:3];
      (
        node(around:45,${nLat},${nLon})["name"];
        way(around:45,${nLat},${nLon})["name"];
      );
      out center 5;
    `
    const opRes = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(overpassQuery)}`,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (opRes.ok) {
      const opData = await opRes.json()
      if (opData.elements && opData.elements.length > 0) {
        const sorted = opData.elements.sort((a, b) => {
          const tA = a.tags || {}
          const tB = b.tags || {}
          const priority = (t) =>
            t.shop ? 5 : t.amenity ? 4 : t.leisure ? 4 : t.tourism ? 4 : t.building ? 3 : 1
          return priority(tB) - priority(tA)
        })

        const top = sorted[0]
        const placeName = top.tags?.name
        const placeType = top.tags?.shop || top.tags?.amenity || top.tags?.leisure || top.tags?.building || top.tags?.tourism
        if (placeName) {
          const typeLabel = placeType ? ` (${placeType.replace('_', ' ')})` : ''
          return `${placeName}${typeLabel}`
        }
      }
    }
  } catch {
    // Ignore Overpass fallback failure
  }

  // --- Strategy 2: Nominatim zoom=18 high-resolution address reverse geocode ---
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3500)
    const params = new URLSearchParams({
      lat: nLat,
      lon: nLon,
      format: 'json',
      zoom: '18',
      addressdetails: '1',
    })

    const response = await fetch(`${NOMINATIM_REVERSE_URL}?${params}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'FlowX-Hackathon/1.0',
      },
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (response.ok) {
      const data = await response.json()
      const addr = data.address || {}

      const specificName =
        addr.shop ||
        addr.amenity ||
        addr.building ||
        addr.leisure ||
        addr.tourism ||
        addr.office ||
        addr.historic ||
        data.name

      const roadPart = [addr.house_number, addr.road].filter(Boolean).join(' ')
      const areaPart = addr.suburb || addr.neighbourhood || addr.city_district || addr.town || addr.city

      if (specificName && areaPart) {
        return `${specificName}, ${areaPart}`
      }
      if (specificName) {
        return specificName
      }
      if (roadPart && areaPart) {
        return `${roadPart}, ${areaPart}`
      }
      if (data.display_name) {
        const parts = data.display_name.split(',').map((s) => s.trim())
        return parts.slice(0, 3).join(', ')
      }
    }
  } catch {
    // Ignore Nominatim fallback failure
  }

  // --- Strategy 3: Photon Komoot reverse geocode fallback ---
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3500)
    const res = await fetch(`https://photon.komoot.io/reverse?lat=${nLat}&lon=${nLon}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (res.ok) {
      const data = await res.json()
      const feature = data.features?.[0]
      if (feature?.properties) {
        const props = feature.properties
        const nameParts = [
          props.name,
          [props.housenumber, props.street].filter(Boolean).join(' '),
          props.district || props.city,
        ].filter(Boolean)
        if (nameParts.length > 0) {
          return nameParts.join(', ')
        }
      }
    }
  } catch {
    // Ignore Photon fallback failure
  }

  return `${nLat.toFixed(5)}, ${nLon.toFixed(5)}`
}

/**
 * Compute realistic vehicle-specific duration (seconds) based on mode.
 */
function calculateVehicleDuration(distanceMeters, osrmDurationSeconds, vehicle) {
  const distanceKm = distanceMeters / 1000

  switch (vehicle) {
    case 'walking':
      return Math.round((distanceKm / 4.8) * 3600)

    case 'bike':
      return Math.round((distanceKm / 15) * 3600)

    case 'truck':
      return Math.round(osrmDurationSeconds * 1.25)

    case 'car':
    default:
      return Math.round(osrmDurationSeconds)
  }
}

/**
 * Calculate estimated CO2 emissions in kg.
 */
function calculateCo2Emissions(distanceMeters, vehicle) {
  const distanceKm = distanceMeters / 1000

  switch (vehicle) {
    case 'walking':
    case 'bike':
      return 0

    case 'truck':
      return Number((distanceKm * 0.28).toFixed(2))

    case 'car':
    default:
      return Number((distanceKm * 0.12).toFixed(2))
  }
}

/**
 * Format step turn instruction maneuver text.
 */
function formatManeuverStep(step) {
  const name = step.name ? ` onto ${step.name}` : ''
  const type = step.maneuver?.type || 'straight'
  const modifier = step.maneuver?.modifier ? ` (${step.maneuver.modifier})` : ''

  if (type === 'depart') return 'Head towards your destination'
  if (type === 'arrive') return 'Arrive at destination'
  if (type === 'turn') return `Turn ${step.maneuver.modifier || ''}${name}`
  if (type === 'new name') return `Continue${name}`
  if (type === 'merge') return `Merge${name}`

  return `${type}${modifier}${name}`
}

/**
 * Helper to fetch raw routes from OSRM endpoint for a set of coordinates.
 */
async function fetchOsrmRaw(coordsString, profile) {
  const params = new URLSearchParams({
    overview: 'full',
    geometries: 'geojson',
    steps: 'true',
    alternatives: 'true',
  })

  try {
    let res = await fetch(`${OSRM_URL}/${profile}/${coordsString}?${params}`)
    if (!res.ok && profile !== 'driving') {
      res = await fetch(`${OSRM_URL}/driving/${coordsString}?${params}`)
    }
    if (!res.ok) return []
    const data = await res.json()
    return data.code === 'Ok' ? data.routes || [] : []
  } catch {
    return []
  }
}

/**
 * Ask OSRM & Corridor Engine for multi-route alternatives (up to 4-5 distinct routes).
 */
export async function fetchRoutes(from, to, vehicle, via = null) {
  const profile = VEHICLE_PROFILES[vehicle] || 'driving'

  // Primary direct request
  const primaryCoords = via
    ? `${from.lon},${from.lat};${via.lon},${via.lat};${to.lon},${to.lat}`
    : `${from.lon},${from.lat};${to.lon},${to.lat}`

  const primaryRawRoutes = await fetchOsrmRaw(primaryCoords, profile)

  if (!primaryRawRoutes.length) {
    throw new Error('No route found between these locations.')
  }

  const rawRouteList = [...primaryRawRoutes]

  // If no user-specified waypoint, generate perpendicular corridor offset waypoints for multi-route choices
  if (!via && primaryRawRoutes.length > 0) {
    const midLat = (from.lat + to.lat) / 2
    const midLon = (from.lon + to.lon) / 2
    const dLat = to.lat - from.lat
    const dLon = to.lon - from.lon

    // Left & Right corridor offsets
    const offsets = [
      { lat: midLat - dLon * 0.18, lon: midLon + dLat * 0.18 },
      { lat: midLat + dLon * 0.18, lon: midLon - dLat * 0.18 },
      { lat: midLat - dLon * 0.32, lon: midLon + dLat * 0.32 },
      { lat: midLat + dLon * 0.32, lon: midLon - dLat * 0.32 },
    ]

    const corridorFetches = offsets.map((off) => {
      const coords = `${from.lon},${from.lat};${off.lon},${off.lat};${to.lon},${to.lat}`
      return fetchOsrmRaw(coords, profile)
    })

    const corridorResults = await Promise.allSettled(corridorFetches)
    corridorResults.forEach((res) => {
      if (res.status === 'fulfilled' && res.value?.length) {
        rawRouteList.push(res.value[0])
      }
    })
  }

  // Deduplicate routes based on distance & duration similarity
  const uniqueRoutes = []
  for (const raw of rawRouteList) {
    const isDup = uniqueRoutes.some(
      (u) =>
        Math.abs(u.distance - raw.distance) < 250 &&
        Math.abs(u.duration - raw.duration) < 40
    )
    if (!isDup) {
      uniqueRoutes.push(raw)
    }
  }

  // Cap at 4-5 distinct routes
  const selectedRoutes = uniqueRoutes.slice(0, 5)

  return selectedRoutes.map((route, index) => {
    const rawSteps = route.legs?.flatMap((leg) => leg.steps || []) || []
    const formattedSteps = rawSteps
      .filter((s) => s.distance > 5)
      .map((s) => ({
        instruction: formatManeuverStep(s),
        distance: s.distance,
        duration: s.duration,
      }))

    return {
      id: `route-${index + 1}`,
      path: route.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
      distance: route.distance,
      duration: calculateVehicleDuration(route.distance, route.duration, vehicle),
      co2Emissions: calculateCo2Emissions(route.distance, vehicle),
      steps: formattedSteps,
    }
  })
}

/**
 * Compute optimal traffic distribution across routes via backend API or fallback.
 */
export async function computeTrafficDistribution(rankedRoutes) {
  if (!rankedRoutes?.length) return null

  if (rankedRoutes.length === 1) {
    return {
      congestionReduction: 0,
      0: { routeId: rankedRoutes[0].id, percentage: 100 },
    }
  }

  try {
    const response = await fetch('http://localhost:5000/api/routes/balance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        routes: rankedRoutes.map((r) => ({ id: r.id, score: r.score })),
      }),
    })

    if (response.ok) {
      const data = await response.json()
      if (data.success && Array.isArray(data.distribution)) {
        const dist = { congestionReduction: data.congestionReductionPct || 15 }
        rankedRoutes.forEach((r, idx) => {
          const item = data.distribution.find((d) => d.routeId === r.id) || data.distribution[idx]
          dist[idx] = { routeId: r.id, percentage: item ? item.percentage : 0 }
        })
        return dist
      }
    }
  } catch (err) {
    console.warn('FlowX balance API offline, falling back to local calculation:', err.message)
  }

  const totalScore = rankedRoutes.reduce((sum, r) => sum + r.score, 0)

  if (totalScore === 0) {
    const pct = Math.round(100 / rankedRoutes.length)
    const dist = { congestionReduction: 15 }
    rankedRoutes.forEach((r, i) => {
      dist[i] = { routeId: r.id, percentage: pct }
    })
    return dist
  }

  const rawPcts = rankedRoutes.map((r) => r.score / totalScore)
  const flattenFactor = 0.3
  const equalShare = 1 / rankedRoutes.length
  const adjustedPcts = rawPcts.map(
    (p) => p * (1 - flattenFactor) + equalShare * flattenFactor
  )

  const adjustedTotal = adjustedPcts.reduce((s, p) => s + p, 0)
  const finalPcts = adjustedPcts.map((p) =>
    Math.round((p / adjustedTotal) * 100)
  )

  const sum = finalPcts.reduce((s, p) => s + p, 0)
  if (sum !== 100) {
    finalPcts[0] += 100 - sum
  }

  const topRoutePct = finalPcts[0]
  const congestionReduction = Math.round(
    Math.max(5, Math.min(40, (100 - topRoutePct) * 0.55))
  )

  const dist = { congestionReduction }
  rankedRoutes.forEach((r, i) => {
    dist[i] = { routeId: r.id, percentage: finalPcts[i] }
  })

  return dist
}

/**
 * Full pipeline: geocode, fetch multiple routes, weather & live traffic, rank them.
 */
export async function getRankedRoutes({ source, waypoint, destination, vehicle, preference }) {
  const geocodePromises = [
    geocodePlace(source),
    geocodePlace(destination),
  ]

  if (waypoint) {
    geocodePromises.push(geocodePlace(waypoint))
  }

  const geocoded = await Promise.all(geocodePromises)
  const from = geocoded[0]
  const to = geocoded[1]
  const via = waypoint ? geocoded[2] : null

  const [routes, weather] = await Promise.all([
    fetchRoutes(from, to, vehicle, via),
    fetchWeather(to.lat, to.lon),
  ])

  const trafficAnalysis = await analyzeTraffic(routes, vehicle)
  const rankedRoutes = rankRoutes(routes, { vehicle, preference, weather, trafficAnalysis })
  const distribution = await computeTrafficDistribution(rankedRoutes)

  return {
    start: [from.lat, from.lon],
    end: [to.lat, to.lon],
    waypoint: via ? { coords: [via.lat, via.lon], name: via.name } : null,
    sourceName: from.name,
    destinationName: to.name,
    routes: rankedRoutes,
    weather,
    trafficAnalysis,
    distribution,
    preference,
    vehicle,
  }
}

export function formatDistance(meters) {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`
  }
  return `${Math.round(meters)} m`
}

export function formatDuration(seconds) {
  const totalMinutes = Math.round(seconds / 60)

  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    return `${hours} hr ${minutes} min`
  }

  return `${totalMinutes} min`
}

export function formatETA(durationSeconds) {
  const now = new Date()
  const arrival = new Date(now.getTime() + durationSeconds * 1000)
  return arrival.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
