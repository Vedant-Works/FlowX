/**
 * FlowX Location Autocomplete Service
 * Provides real-time typeahead suggestions restricted to India.
 * Uses Photon (Komoot) + Nominatim with India-only filters.
 */

const PHOTON_URL = 'https://photon.komoot.io/api/'
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'

// India geographic bounds
const INDIA_BOUNDS = { south: 6.4, west: 68.1, north: 37.6, east: 97.4 }

function isInIndia(lat, lon) {
  return (
    lat >= INDIA_BOUNDS.south &&
    lat <= INDIA_BOUNDS.north &&
    lon >= INDIA_BOUNDS.west &&
    lon <= INDIA_BOUNDS.east
  )
}

/**
 * Fetch location suggestions for a partial query string.
 * Returns an array of { lat, lon, name, description } objects — India only.
 */
export async function fetchSuggestions(query) {
  if (!query || query.trim().length < 2) return []

  const trimmed = query.trim()

  // Run Photon and Nominatim in parallel for speed + coverage
  const [photonResults, nominatimResults] = await Promise.allSettled([
    fetchPhotonSuggestions(trimmed),
    fetchNominatimSuggestions(trimmed),
  ])

  const photon = photonResults.status === 'fulfilled' ? photonResults.value : []
  const nominatim = nominatimResults.status === 'fulfilled' ? nominatimResults.value : []

  // Merge and deduplicate by proximity (within ~200m = same place)
  const merged = [...photon]
  for (const nom of nominatim) {
    const isDup = merged.some(
      (m) =>
        Math.abs(m.lat - nom.lat) < 0.002 &&
        Math.abs(m.lon - nom.lon) < 0.002
    )
    if (!isDup) merged.push(nom)
  }

  return merged.slice(0, 7) // Cap at 7 suggestions
}

async function fetchPhotonSuggestions(query) {
  try {
    const params = new URLSearchParams({
      q: query,
      limit: '8',
      // Bias results toward India's geographic center
      lat: '20.5937',
      lon: '78.9629',
    })
    const res = await fetch(`${PHOTON_URL}?${params}`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return []
    const data = await res.json()

    return (data.features || [])
      .filter((f) => {
        if (!f.geometry?.coordinates) return false
        const lat = f.geometry.coordinates[1]
        const lon = f.geometry.coordinates[0]
        // Hard-filter: only keep results inside India's bounding box
        if (!isInIndia(lat, lon)) return false
        // Also filter by country name if available
        const country = f.properties?.country || ''
        if (country && !country.toLowerCase().includes('india')) return false
        return true
      })
      .map((f) => {
        const props = f.properties || {}
        const parts = [
          props.name,
          props.street,
          props.district,
          props.city,
          props.state,
          props.country,
        ].filter(Boolean)
        const name = parts[0] || query
        const description = parts.slice(1).join(', ')

        return {
          lat: f.geometry.coordinates[1],
          lon: f.geometry.coordinates[0],
          name,
          description,
          fullName: parts.join(', '),
          type: props.osm_value || props.type || 'place',
        }
      })
  } catch {
    return []
  }
}

async function fetchNominatimSuggestions(query) {
  try {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      addressdetails: '1',
      limit: '6',
      dedupe: '1',
      countrycodes: 'in',              // India only
      viewbox: '68.1,37.6,97.4,6.4',  // W,N,E,S bounding box of India
      bounded: '1',                    // Restrict strictly to viewbox
    })
    const res = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'FlowX-Hackathon/1.0' },
    })
    if (!res.ok) return []
    const results = await res.json()

    return results
      .filter((r) => {
        const lat = Number(r.lat)
        const lon = Number(r.lon)
        // Double-check coordinates are actually within India
        return isInIndia(lat, lon)
      })
      .map((r) => {
        const addr = r.address || {}
        const mainName =
          r.name ||
          addr.amenity ||
          addr.tourism ||
          addr.shop ||
          addr.road ||
          r.display_name?.split(',')[0] ||
          query

        const descParts = [
          addr.suburb || addr.neighbourhood,
          addr.city || addr.town || addr.village,
          addr.state,
        ].filter(Boolean)

        return {
          lat: Number(r.lat),
          lon: Number(r.lon),
          name: mainName,
          description: descParts.join(', '),
          fullName: r.display_name,
          type: r.type || 'place',
        }
      })
  } catch {
    return []
  }
}
