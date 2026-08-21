/**
 * FlowX Community Incident Reporting Service
 *
 * Stores user-reported incidents in localStorage.
 * Reports auto-expire after 4 hours.
 * Provides proximity detection to penalize routes passing near incidents.
 */

const STORAGE_KEY = 'flowx_incidents'
const EXPIRY_MS = 4 * 60 * 60 * 1000 // 4 hours

export const INCIDENT_TYPES = [
  { value: 'accident', label: 'Accident', icon: '🚗💥', severity: 'high' },
  { value: 'closure', label: 'Road Closure', icon: '🚧', severity: 'high' },
  { value: 'flooding', label: 'Flooding', icon: '🌊', severity: 'high' },
  { value: 'construction', label: 'Construction', icon: '🏗️', severity: 'medium' },
  { value: 'hazard', label: 'Hazard', icon: '⚠️', severity: 'medium' },
  { value: 'police', label: 'Police Activity', icon: '🚔', severity: 'low' },
  { value: 'pothole', label: 'Pothole / Bad Road', icon: '🕳️', severity: 'low' },
]

export const SEVERITY_OPTIONS = [
  { value: 'low', label: 'Low', color: '#f59e0b' },
  { value: 'medium', label: 'Medium', color: '#f97316' },
  { value: 'high', label: 'High', color: '#ef4444' },
]

/**
 * Get all stored incidents, filtering out expired ones.
 */
const API_BASE_URL = 'http://localhost:5000/api'

/**
 * Get all stored incidents, filtering out expired ones.
 */
export function getIncidents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []

    const incidents = JSON.parse(raw)
    const now = Date.now()

    // Filter expired
    const active = incidents.filter((inc) => now - inc.timestamp < EXPIRY_MS)

    // Persist cleaned list
    if (active.length !== incidents.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(active))
    }

    return active
  } catch {
    return []
  }
}

/**
 * Fetch active incidents from Express Backend API with local cache fallback
 */
export async function fetchIncidentsFromApi() {
  try {
    const res = await fetch(`${API_BASE_URL}/incidents`)
    if (res.ok) {
      const data = await res.json()
      if (data.success && Array.isArray(data.incidents)) {
        const local = getIncidents()
        // Merge backend incidents with local unique ones
        const merged = [...data.incidents]
        local.forEach((l) => {
          if (!merged.some((m) => m.id === l.id)) {
            merged.push(l)
          }
        })
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
        return merged
      }
    }
  } catch (err) {
    console.warn('FlowX API offline, using local storage fallback for incidents:', err.message)
  }
  return getIncidents()
}

/**
 * Add a new incident report to backend API & localStorage
 */
export async function addIncident({ type, severity, lat, lon, description }) {
  const localIncident = {
    id: `inc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    severity,
    lat,
    lon,
    description: description || '',
    timestamp: Date.now(),
  }

  try {
    const res = await fetch(`${API_BASE_URL}/incidents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, severity, lat, lon, description }),
    })
    if (res.ok) {
      const data = await res.json()
      if (data.success && data.incident) {
        const incidents = getIncidents()
        incidents.push(data.incident)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(incidents))
        return data.incident
      }
    }
  } catch (err) {
    console.warn('Backend server offline, saving incident to localStorage:', err.message)
  }

  const incidents = getIncidents()
  incidents.push(localIncident)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(incidents))
  return localIncident
}

/**
 * Remove an incident by ID.
 */
export function removeIncident(id) {
  const incidents = getIncidents().filter((inc) => inc.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(incidents))
}

/**
 * Clear all stored incidents.
 */
export function clearAllIncidents() {
  localStorage.removeItem(STORAGE_KEY)
}

/**
 * Haversine distance between two points (in km).
 */
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Check how many incidents are near a route path.
 * "Near" = within `radiusKm` of any point on the route.
 *
 * We sample every Nth point on the route for performance.
 */
export function getNearbyIncidents(routePath, incidents, radiusKm = 0.5) {
  if (!routePath?.length || !incidents?.length) return []

  // Sample route at every ~10th point for performance
  const step = Math.max(1, Math.floor(routePath.length / 80))
  const sampledPath = routePath.filter((_, i) => i % step === 0)

  return incidents.filter((inc) =>
    sampledPath.some(
      ([lat, lon]) => haversineKm(lat, lon, inc.lat, inc.lon) <= radiusKm
    )
  )
}

/**
 * Calculate a score penalty (0–100) for a route based on nearby incidents.
 * 100 = no incidents (perfect), lower = more incidents nearby.
 */
export function getIncidentScore(routePath, incidents) {
  if (!incidents?.length) return 100

  const nearby = getNearbyIncidents(routePath, incidents)

  if (nearby.length === 0) return 100

  // Each incident contributes a penalty based on severity
  const severityPenalty = { high: 25, medium: 15, low: 8 }

  let totalPenalty = 0
  for (const inc of nearby) {
    totalPenalty += severityPenalty[inc.severity] || 10
  }

  return Math.max(5, 100 - totalPenalty)
}

/**
 * Get the icon config for an incident type.
 */
export function getIncidentTypeInfo(typeValue) {
  return INCIDENT_TYPES.find((t) => t.value === typeValue) || INCIDENT_TYPES[4]
}

/**
 * Format a timestamp as relative time (e.g. "12 min ago").
 */
export function formatTimeAgo(timestamp) {
  const diffMs = Date.now() - timestamp
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin} min ago`

  const diffHr = Math.floor(diffMin / 60)
  return `${diffHr}h ${diffMin % 60}m ago`
}
