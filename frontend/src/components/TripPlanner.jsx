import { useState, useEffect } from 'react'
import { reverseGeocode } from '../services/routing'
import LocationInput from './LocationInput'
import './TripPlanner.css'

const VEHICLE_OPTIONS = [
  { value: 'car', label: 'Car', icon: '🚗' },
  { value: 'bike', label: 'Bike', icon: '🚲' },
  { value: 'truck', label: 'Truck', icon: '🚚' },
  { value: 'walking', label: 'Walking', icon: '🚶' },
]

const PREFERENCE_OPTIONS = [
  { value: 'fastest', label: 'Fastest', desc: 'Prioritize time' },
  { value: 'balanced', label: 'Balanced', desc: 'Best overall' },
  { value: 'safest', label: 'Safest', desc: 'Avoid hazards' },
]

const QUICK_TRIPS = [
  { source: 'Bandra West, Mumbai', destination: 'Colaba, Mumbai', label: 'Bandra ➔ Colaba' },
  { source: 'Andheri East, Mumbai', destination: 'BKC, Mumbai', label: 'Andheri ➔ BKC' },
  { source: 'Connaught Place, Delhi', destination: 'India Gate, Delhi', label: 'CP ➔ India Gate' },
  { source: 'Times Square, New York', destination: 'Central Park, New York', label: 'NYC Demo' },
]

function TripPlanner({ onFindRoutes, isLoading, error, initialSource, initialWaypoint, initialDestination, onUserLocation }) {
  const [source, setSource] = useState('')
  const [waypoint, setWaypoint] = useState('')
  const [destination, setDestination] = useState('')
  const [sourceObj, setSourceObj] = useState(null)
  const [waypointObj, setWaypointObj] = useState(null)
  const [destObj, setDestObj] = useState(null)
  const [showWaypoint, setShowWaypoint] = useState(false)
  const [vehicle, setVehicle] = useState('car')
  const [preference, setPreference] = useState('balanced')
  const [isLocating, setIsLocating] = useState(false)
  const [locationError, setLocationError] = useState(null)
  const [recentTrips, setRecentTrips] = useState([])

  useEffect(() => {
    if (initialSource) {
      if (typeof initialSource === 'object' && initialSource.lat != null) {
        setSource(initialSource.name || `${initialSource.lat}, ${initialSource.lon}`)
        setSourceObj(initialSource)
      } else {
        setSource(initialSource)
        setSourceObj(null)
      }
    }
  }, [initialSource])

  useEffect(() => {
    if (initialWaypoint) {
      if (typeof initialWaypoint === 'object' && initialWaypoint.lat != null) {
        setWaypoint(initialWaypoint.name || `${initialWaypoint.lat}, ${initialWaypoint.lon}`)
        setWaypointObj(initialWaypoint)
      } else {
        setWaypoint(initialWaypoint)
        setWaypointObj(null)
      }
      setShowWaypoint(true)
    }
  }, [initialWaypoint])

  useEffect(() => {
    if (initialDestination) {
      if (typeof initialDestination === 'object' && initialDestination.lat != null) {
        setDestination(initialDestination.name || `${initialDestination.lat}, ${initialDestination.lon}`)
        setDestObj(initialDestination)
      } else {
        setDestination(initialDestination)
        setDestObj(null)
      }
    }
  }, [initialDestination])

  useEffect(() => {
    try {
      const saved = localStorage.getItem('flowx_recent_trips')
      if (saved) setRecentTrips(JSON.parse(saved))
    } catch {
      setRecentTrips([])
    }
  }, [])

  function saveRecentTrip(src, dest) {
    try {
      const srcName = typeof src === 'object' ? src.name : src
      const destName = typeof dest === 'object' ? dest.name : dest
      const newTrip = { source: srcName, destination: destName }
      const filtered = recentTrips.filter(
        (t) => !(t.source === srcName && t.destination === destName)
      )
      const updated = [newTrip, ...filtered].slice(0, 4)
      setRecentTrips(updated)
      localStorage.setItem('flowx_recent_trips', JSON.stringify(updated))
    } catch {
      // ignore storage errors
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!source.trim() || !destination.trim()) return

    const finalSource = sourceObj && sourceObj.name === source.trim() ? sourceObj : source.trim()
    const finalDest = destObj && destObj.name === destination.trim() ? destObj : destination.trim()
    const finalWaypoint = showWaypoint && waypoint.trim()
      ? (waypointObj && waypointObj.name === waypoint.trim() ? waypointObj : waypoint.trim())
      : null

    saveRecentTrip(finalSource, finalDest)

    onFindRoutes({
      source: finalSource,
      waypoint: finalWaypoint,
      destination: finalDest,
      vehicle,
      preference,
    })
  }

  function handleQuickTripClick(src, dest) {
    setSource(src)
    setDestination(dest)
    onFindRoutes({
      source: src,
      waypoint: '',
      destination: dest,
      vehicle,
      preference,
    })
  }

  function handleSwapLocations() {
    setSource(destination)
    setDestination(source)
  }

  function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.')
      return
    }

    setIsLocating(true)
    setLocationError(null)

    // Use watchPosition for an initial fast fix, then stop after first high-accuracy result
    let resolved = false
    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        if (resolved) return
        resolved = true
        navigator.geolocation.clearWatch(watchId)

        try {
          const { latitude, longitude, accuracy } = position.coords
          const placeName = await reverseGeocode(latitude, longitude)
          const label = `${placeName} (±${Math.round(accuracy)}m)`
          setSource(label)
          setSourceObj({ lat: latitude, lon: longitude, name: label })
          // Notify parent so map can pan + show marker
          onUserLocation?.({ lat: latitude, lon: longitude, name: label, accuracy })
        } catch {
          setLocationError('Could not determine address from current location.')
        } finally {
          setIsLocating(false)
        }
      },
      (geoErr) => {
        if (resolved) return
        resolved = true
        navigator.geolocation.clearWatch(watchId)
        setIsLocating(false)
        if (geoErr.code === geoErr.PERMISSION_DENIED) {
          setLocationError('Location access denied. Please allow location permissions.')
        } else {
          setLocationError('Unable to retrieve your location. Please type origin manually.')
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    )
  }

  return (
    <div className="trip-planner-card">
      <div className="card-header">
        <h2 className="card-title">Plan Your Journey</h2>
        <p className="card-subtitle">AI-driven multi-route congestion balancer</p>
      </div>

      <form className="trip-form" onSubmit={handleSubmit}>
        {/* Quick Recent Trips */}
        <div className="quick-trips-row">
          <span className="quick-trips-label">Quick Trips:</span>
          <div className="quick-chips">
            {(recentTrips.length > 0
              ? recentTrips.map((t) => ({
                  ...t,
                  label: `${t.source.split(',')[0]} ➔ ${t.destination.split(',')[0]}`,
                }))
              : QUICK_TRIPS
            ).map((qt, idx) => (
              <button
                key={idx}
                type="button"
                className="quick-chip-btn"
                onClick={() => handleQuickTripClick(qt.source, qt.destination)}
              >
                {qt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="location-inputs-wrapper">
          <div className="input-group">
            <div className="label-with-action">
              <label htmlFor="source">Origin</label>
              <button
                type="button"
                className="use-location-btn"
                onClick={handleUseCurrentLocation}
                disabled={isLocating}
                title="Use current device location"
              >
                {isLocating ? (
                  <>
                    <span className="btn-spinner-sm" />
                    Locating…
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="8"/>
                      <line x1="12" y1="2" x2="12" y2="6"/>
                      <line x1="12" y1="18" x2="12" y2="22"/>
                      <line x1="2" y1="12" x2="6" y2="12"/>
                      <line x1="18" y1="12" x2="22" y2="12"/>
                    </svg>
                    My Location
                  </>
                )}
              </button>
            </div>
            <LocationInput
              id="source"
              placeholder="Enter origin (e.g. Gateway of India)"
              value={source}
              onChange={(val) => {
                setSource(val)
                setSourceObj(null)
              }}
              onSelectLocation={(locObj) => setSourceObj(locObj)}
              iconClass="origin-icon"
              required
            />
          </div>

          {locationError && (
            <div className="location-error-msg animate-fade-in">
              ⚠️ {locationError}
            </div>
          )}

          {/* Toggle Waypoint Button */}
          {!showWaypoint && (
            <button
              type="button"
              className="add-waypoint-btn"
              onClick={() => setShowWaypoint(true)}
              title="Add a stopover waypoint"
            >
              + Add stopover waypoint
            </button>
          )}

          {/* Waypoint Field */}
          {showWaypoint && (
            <div className="input-group animate-fade-in">
              <div className="waypoint-label-row">
                <label htmlFor="waypoint">Stopover Waypoint</label>
                <button
                  type="button"
                  className="remove-waypoint-btn"
                  onClick={() => {
                    setShowWaypoint(false)
                    setWaypoint('')
                    setWaypointObj(null)
                  }}
                  title="Remove waypoint"
                >
                  Remove
                </button>
              </div>
              <LocationInput
                id="waypoint"
                placeholder="Enter stopover (e.g. Dadar)"
                value={waypoint}
                onChange={(val) => {
                  setWaypoint(val)
                  setWaypointObj(null)
                }}
                onSelectLocation={(locObj) => setWaypointObj(locObj)}
                iconClass="waypoint-icon"
              />
            </div>
          )}

          <button
            type="button"
            className="swap-btn"
            onClick={handleSwapLocations}
            title="Swap origin and destination"
            aria-label="Swap locations"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 1 21 5 17 9"/>
              <line x1="3" y1="5" x2="21" y2="5"/>
              <polyline points="7 23 3 19 7 15"/>
              <line x1="21" y1="19" x2="3" y2="19"/>
            </svg>
          </button>

          <div className="input-group">
            <label htmlFor="destination">Destination</label>
            <LocationInput
              id="destination"
              placeholder="Enter destination (e.g. Colaba)"
              value={destination}
              onChange={(val) => {
                setDestination(val)
                setDestObj(null)
              }}
              onSelectLocation={(locObj) => setDestObj(locObj)}
              iconClass="dest-icon"
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="input-group">
            <label htmlFor="vehicle">Vehicle</label>
            <div className="select-wrapper">
              <select
                id="vehicle"
                value={vehicle}
                onChange={(e) => setVehicle(e.target.value)}
              >
                {VEHICLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.icon} {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="preference">Preference</label>
            <div className="select-wrapper">
              <select
                id="preference"
                value={preference}
                onChange={(e) => setPreference(e.target.value)}
              >
                {PREFERENCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <button type="submit" className="find-routes-btn" disabled={isLoading}>
          {isLoading ? (
            <>
              <span className="btn-spinner"></span>
              Finding optimal routes…
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              Calculate Routes
            </>
          )}
        </button>

        {error && (
          <div className="form-error-banner animate-fade-in" role="alert">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>{error}</span>
          </div>
        )}
      </form>
    </div>
  )
}

export default TripPlanner
