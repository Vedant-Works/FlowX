/**
 * FlowX Location Autocomplete Service
 * Provides real-time typeahead suggestions using Photon (Komoot) + Nominatim.
 * Debounced to avoid excessive API calls.
 */

const PHOTON_URL = 'https://photon.komoot.io/api/'
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'

/**
 * Fetch location suggestions for a partial query string.
 * Returns an array of { lat, lon, name, description } objects.
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
    const params = new URLSearchParams({ q: query, limit: '5' })
    const res = await fetch(`${PHOTON_URL}?${params}`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return []
    const data = await res.json()

    return (data.features || [])
      .filter((f) => f.geometry?.coordinates)
      .map((f) => {
        const props = f.properties || {}
        const parts = [props.name, props.street, props.district, props.city, props.state, props.country].filter(Boolean)
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
      limit: '4',
      dedupe: '1',
    })
    const res = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'FlowX-Hackathon/1.0' },
    })
    if (!res.ok) return []
    const results = await res.json()

    return results.map((r) => {
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
        addr.country,
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
