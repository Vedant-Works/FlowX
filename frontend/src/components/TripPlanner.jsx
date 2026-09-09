import { useState, useEffect } from 'react'
import { reverseGeocode } from '../services/routing'
import LocationInput from './LocationInput'
import './TripPlanner.css'

const VEHICLE_OPTIONS = [
  { value: 'car', label: 'Four-Wheeler', icon: '🚗' },
  { value: 'bike', label: 'Two-Wheeler', icon: '🛵' },
  { value: 'walking', label: 'Walking', icon: '🚶' },
]

const MOTORIZED_PREFERENCES = [
  { value: 'fastest', label: 'Fastest', desc: '1 fastest route (least traffic)' },
  { value: 'balanced', label: 'Balanced', desc: 'Balanced + 1 alternative' },
]

const WALKING_NIGHT_PREFERENCES = [
  { value: 'safest', label: 'Safest Mode', desc: '1 active traffic corridor' },
  { value: 'normal', label: 'Normal Mode', desc: 'Fastest + 1 alternative' },
]

const WALKING_DAY_PREFERENCES = [
  { value: 'normal', label: 'Normal Mode', desc: 'Fastest + 1 alternative' },
]

const QUICK_TRIPS = [
  { source: 'Bandra West, Mumbai', destination: 'Colaba, Mumbai', label: 'Bandra ➔ Colaba' },
  { source: 'Andheri East, Mumbai', destination: 'BKC, Mumbai', label: 'Andheri ➔ BKC' },
  { source: 'Connaught Place, Delhi', destination: 'India Gate, Delhi', label: 'CP ➔ India Gate' },
  { source: 'MG Road, Bengaluru', destination: 'Koramangala, Bengaluru', label: 'BLR Tech Corridor' },
]

function TripPlanner({
  onFindRoutes,
  isLoading,
  error,
  initialSource,
  initialWaypoint,
  initialDestination,
  onUserLocation,
  onViewMap,
  hasResults,
}) {
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

  const isNight = (() => {
    const h = new Date().getHours()
    return h >= 20 || h < 6
  })()

  // Dynamic available preferences based on vehicle and time of day
  const availablePreferences = vehicle === 'walking'
    ? (isNight ? WALKING_NIGHT_PREFERENCES : WALKING_DAY_PREFERENCES)
    : MOTORIZED_PREFERENCES

  // Keep preference synchronized when vehicle or time of day changes
  useEffect(() => {
    if (vehicle === 'walking') {
      if (!isNight && preference === 'safest') {
        setPreference('normal')
      } else if (preference !== 'safest' && preference !== 'normal') {
        setPreference(isNight ? 'safest' : 'normal')
      }
    } else {
      // Four-Wheeler or Two-Wheeler
      if (preference !== 'fastest' && preference !== 'balanced') {
        setPreference('balanced')
      }
    }
  }, [vehicle, isNight, preference])

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
      nightSafety: vehicle === 'walking' ? (preference === 'safest') : undefined,
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
      nightSafety: vehicle === 'walking' ? (preference === 'safest') : undefined,
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

    const processLocation = async (position) => {
      try {
        const { latitude, longitude, accuracy } = position.coords
        if (typeof latitude !== 'number' || typeof longitude !== 'number' || isNaN(latitude) || isNaN(longitude)) {
          throw new Error('Invalid coordinate format received.')
        }

        let placeName = ''
        try {
          placeName = await reverseGeocode(latitude, longitude)
        } catch {
          placeName = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
        }

        const label = accuracy ? `${placeName} (±${Math.round(accuracy)}m)` : placeName
        setSource(label)
        setSourceObj({ lat: latitude, lon: longitude, name: label })
        // Notify parent so map can pan + show marker
        onUserLocation?.({ lat: latitude, lon: longitude, name: label, accuracy })
      } catch (err) {
        console.error('Location processing error:', err)
        setLocationError('Could not resolve location address. Please type origin manually.')
      } finally {
        setIsLocating(false)
      }
    }

    const handleError = (geoErr) => {
      // If high accuracy timed out (e.g. indoors on mobile), try with low accuracy (cellular/WiFi)
      if (geoErr.code === geoErr.TIMEOUT) {
        navigator.geolocation.getCurrentPosition(
          processLocation,
          (fallbackErr) => {
            setIsLocating(false)
            if (fallbackErr.code === fallbackErr.PERMISSION_DENIED) {
              setLocationError('Location permission was denied. Please enable location in browser settings.')
            } else {
              setLocationError('Location request timed out. Please enter origin manually.')
            }
          },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
        )
        return
      }

      setIsLocating(false)
      if (geoErr.code === geoErr.PERMISSION_DENIED) {
        setLocationError('Location permission denied. Please allow location access in your browser.')
      } else {
        setLocationError('Unable to retrieve location. Please type origin manually.')
      }
    }

    navigator.geolocation.getCurrentPosition(
      processLocation,
      handleError,
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 30000,
      }
    )
  }

  return (
    <div className="trip-planner-card">
      <div className="card-header">
        <div className="card-header-text">
          <h2 className="card-title">Plan Your Journey</h2>
          <p className="card-subtitle">AI-driven multi-route congestion balancer</p>
        </div>
        {hasResults && onViewMap && (
          <button
            type="button"
            className="mobile-view-map-quick-btn"
            onClick={onViewMap}
            title="Switch to Map View"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
              <line x1="8" y1="2" x2="8" y2="18"/>
              <line x1="16" y1="6" x2="16" y2="22"/>
            </svg>
            <span>View Map</span>
          </button>
        )}
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
                onChange={(e) => {
                  const newVehicle = e.target.value
                  setVehicle(newVehicle)
                  if (newVehicle === 'walking') {
                    setPreference(isNight ? 'safest' : 'normal')
                  } else {
                    setPreference('balanced')
                  }
                }}
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
                {availablePreferences.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Walking Mode Information & Safety Card */}
        {vehicle === 'walking' && (
          <div className="walking-night-safety-card animate-fade-in">
            <div className="night-safety-left">
              <span className="night-safety-badge-icon">
                {preference === 'safest' ? '🛡️' : isNight ? '🌙' : '🚶'}
              </span>
              <div className="night-safety-info">
                <span className="night-safety-label">
                  {preference === 'safest'
                    ? 'Safest Mode (Active Night Corridor)'
                    : isNight
                    ? 'Normal Walking Mode (Night)'
                    : 'Normal Walking Mode'}
                </span>
                <span className="night-safety-desc">
                  {preference === 'safest'
                    ? 'Prioritizing 1 well-lit corridor with active live vehicular traffic. Low/no traffic streets are avoided.'
                    : isNight
                    ? 'Suggesting fastest route + 1 alternative route. (Select "Safest Mode" in preference for well-trafficked corridor)'
                    : 'Suggesting fastest route + 1 alternative route. Safest Mode unlocks automatically at night (8:00 PM – 6:00 AM).'}
                </span>
              </div>
            </div>
            <div className="night-safety-badge-pill">
              {preference === 'safest' ? '1 Safe Route' : '2 Route Options'}
            </div>
          </div>
        )}

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
