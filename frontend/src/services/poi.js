/**
 * FlowX Points of Interest (POI) Finder Service
 * Uses OpenStreetMap Overpass API to fetch shops, tourist sites, parks, transit, cafes, and amenities worldwide.
 */

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'

export const POI_CATEGORIES = [
  { value: 'all', label: 'All Places', icon: '📍' },
  { value: 'tourist', label: 'Attractions & Landmarks', icon: '🏛️' },
  { value: 'parks', label: 'Parks & Nature', icon: '🌳' },
  { value: 'shops', label: 'Shops & Malls', icon: '🛍️' },
  { value: 'food', label: 'Food & Cafes', icon: '☕' },
  { value: 'transit', label: 'Transit & Metro', icon: '🚆' },
  { value: 'health', label: 'Hospitals & Medical', icon: '🏥' },
  { value: 'lodging', label: 'Hotels & Stay', icon: '🏨' },
  { value: 'fuel', label: 'Fuel & EV Charging', icon: '⛽' },
]

function getPoiCategory(tags) {
  if (tags.tourism || tags.historic) {
    if (tags.tourism === 'hotel' || tags.tourism === 'hostel' || tags.tourism === 'motel') {
      return { type: 'lodging', label: 'Hotel / Lodging', icon: '🏨' }
    }
    return { type: 'tourist', label: tags.tourism || 'Tourist Spot', icon: '🏛️' }
  }
  if (tags.leisure === 'park' || tags.leisure === 'garden' || tags.landuse === 'grass' || tags.leisure === 'nature_reserve') {
    return { type: 'parks', label: 'Park / Nature', icon: '🌳' }
  }
  if (tags.shop) {
    return { type: 'shops', label: `${tags.shop} Shop`, icon: '🛍️' }
  }
  if (tags.amenity === 'restaurant' || tags.amenity === 'cafe' || tags.amenity === 'fast_food' || tags.amenity === 'bakery') {
    return { type: 'food', label: tags.amenity === 'cafe' ? 'Cafe' : 'Restaurant', icon: '☕' }
  }
  if (tags.railway || tags.public_transport || tags.station || tags.amenity === 'bus_station' || tags.aeroway === 'aerodrome') {
    return { type: 'transit', label: 'Transit Station', icon: '🚆' }
  }
  if (tags.amenity === 'fuel' || tags.amenity === 'charging_station') {
    return { type: 'fuel', label: 'Fuel / EV Charging', icon: '⛽' }
  }
  if (tags.amenity === 'hospital' || tags.amenity === 'pharmacy' || tags.amenity === 'clinic') {
    return { type: 'health', label: 'Medical Center', icon: '🏥' }
  }
  return { type: 'place', label: 'Point of Interest', icon: '📍' }
}

function getPoiFallbackName(tags) {
  if (tags.tourism) return `${tags.tourism.toUpperCase()} Site`
  if (tags.shop) return `${tags.shop.toUpperCase()} Store`
  if (tags.amenity) return `${tags.amenity.toUpperCase()}`
  if (tags.railway) return `${tags.railway.toUpperCase()} Station`
  return 'Local Place'
}

/**
 * Fetch nearby POIs within given map bounds { south, west, north, east }
 */
export async function fetchNearbyPOIs(bounds, category = 'all') {
  if (!bounds || !bounds.south || !bounds.north) return []

  const { south, west, north, east } = bounds

  // Bounding box string for Overpass query
  const bbox = `${south},${west},${north},${east}`

  let filter = ''
  if (category === 'tourist') {
    filter = `node["tourism"](${bbox}); node["historic"](${bbox}); way["tourism"](${bbox});`
  } else if (category === 'parks') {
    filter = `node["leisure"="park"](${bbox}); node["leisure"="garden"](${bbox}); way["leisure"="park"](${bbox});`
  } else if (category === 'shops') {
    filter = `node["shop"](${bbox}); node["amenity"="supermarket"](${bbox}); way["shop"](${bbox});`
  } else if (category === 'food') {
    filter = `node["amenity"~"restaurant|cafe|fast_food|bakery"](${bbox});`
  } else if (category === 'transit') {
    filter = `node["railway"="station"](${bbox}); node["amenity"="bus_station"](${bbox}); node["station"](${bbox});`
  } else if (category === 'health') {
    filter = `node["amenity"~"hospital|pharmacy|clinic"](${bbox});`
  } else if (category === 'lodging') {
    filter = `node["tourism"~"hotel|hostel|motel|guest_house"](${bbox});`
  } else if (category === 'fuel') {
    filter = `node["amenity"~"fuel|charging_station"](${bbox});`
  } else {
    filter = `
      node["tourism"](${bbox});
      node["leisure"="park"](${bbox});
      node["shop"~"supermarket|mall|clothes|convenience|department_store"](${bbox});
      node["amenity"~"restaurant|cafe|pharmacy|fuel|hospital|bus_station"](${bbox});
      node["railway"="station"](${bbox});
    `
  }

  const query = `[out:json][timeout:15];(${filter});out center 80;`

  try {
    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    })

    if (!response.ok) return []

    const data = await response.json()
    const elements = data.elements || []

    return elements
      .map((item) => {
        const lat = item.lat || item.center?.lat
        const lon = item.lon || item.center?.lon
        const tags = item.tags || {}
        const name = tags.name || tags['name:en'] || tags.brand || tags.operator || getPoiFallbackName(tags)
        const catInfo = getPoiCategory(tags)

        return {
          id: `poi-${item.id}`,
          lat,
          lon,
          name,
          category: catInfo.type,
          icon: catInfo.icon,
          typeLabel: catInfo.label,
          address: tags['addr:street'] || tags['addr:suburb'] || tags['addr:city'] || '',
          cuisine: tags.cuisine || '',
          openingHours: tags.opening_hours || '',
        }
      })
      .filter((poi) => poi.lat && poi.lon && poi.name)
  } catch (err) {
    console.warn('Overpass POI query warning:', err.message)
    return []
  }
}
