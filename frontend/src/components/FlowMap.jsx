import React, { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '../leafletSetup.js'
import { formatDistance, formatDuration, formatETA, reverseGeocode } from '../services/routing'
import { getRouteColor } from '../utils/routeColors'
import { fetchNearbyPOIs, POI_CATEGORIES } from '../services/poi'
import { TOMTOM_API_KEY } from '../services/traffic'
import { useLiveLocation } from '../services/useLiveLocation'
import NavSimulatorHUD from './NavSimulatorHUD'
import './FlowMap.css'

// India geographic center
const DEFAULT_CENTER = [20.5937, 78.9629]
const DEFAULT_ZOOM = 5

// India bounding box – prevents panning outside the country
const INDIA_BOUNDS = [
  [6.4, 68.1],   // SW corner
  [37.6, 97.4],  // NE corner
]

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

const VEHICLE_EMOJIS = {
  car: '🚗',
  bike: '🛵',
  walking: '🚶',
}

function createVehicleIcon(vehicle) {
  const emoji = VEHICLE_EMOJIS[vehicle] || '🚗'
  return L.divIcon({
    className: 'nav-vehicle-map-icon',
    html: `<div class="vehicle-marker-inner">${emoji}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  })
}

function createPoiIcon(iconEmoji) {
  return L.divIcon({
    className: 'custom-poi-marker',
    html: `<div class="poi-marker-inner"><span>${iconEmoji}</span></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  })
}

// "You are here" pulsing dot icon
const userLocationIcon = L.divIcon({
  className: 'user-location-marker',
  html: `
    <div class="user-loc-outer">
      <div class="user-loc-pulse"></div>
      <div class="user-loc-dot"></div>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -14],
})

// Continuous Live Tracking Cursor with directional pointer
function createLiveTrackingIcon(heading = 0) {
  const rotation = heading || 0
  return L.divIcon({
    className: 'live-tracking-cursor-marker',
    html: `
      <div class="live-cursor-outer">
        <div class="live-cursor-pulse"></div>
        <div class="live-cursor-dot" style="transform: rotate(${rotation}deg);">
          <div class="live-cursor-pointer"></div>
        </div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  })
}

// New Modern Origin Marker (Green Pill Badge)
const originIcon = L.divIcon({
  className: 'custom-location-marker origin-marker-badge',
  html: `
    <div class="marker-pill origin-pill animate-fade-in">
      <span class="pill-dot origin-dot"></span>
      <span class="pill-text">START</span>
    </div>
  `,
  iconSize: [84, 32],
  iconAnchor: [42, 16],
  popupAnchor: [0, -18],
})

// New Modern Destination Marker (Red Pill Badge)
const destinationIcon = L.divIcon({
  className: 'custom-location-marker destination-marker-badge',
  html: `
    <div class="marker-pill destination-pill animate-fade-in">
      <span class="pill-dot destination-dot"></span>
      <span class="pill-text">END</span>
    </div>
  `,
  iconSize: [76, 32],
  iconAnchor: [38, 16],
  popupAnchor: [0, -18],
})

// Custom Waypoint Marker Icon (Amber Pill Badge)
const waypointIcon = L.divIcon({
  className: 'custom-location-marker waypoint-marker-badge',
  html: `
    <div class="marker-pill waypoint-pill animate-fade-in">
      <span class="pill-dot waypoint-dot"></span>
      <span class="pill-text">STOP</span>
    </div>
  `,
  iconSize: [76, 32],
  iconAnchor: [38, 16],
  popupAnchor: [0, -18],
})

const EMPTY_PATH = []

function FitBounds({ path, routeId }) {
  const map = useMap()

  useEffect(() => {
    if (path?.length) {
      try {
        const size = map.getSize()
        if (size.x > 0 && size.y > 0) {
          map.fitBounds(path, { padding: [50, 50] })
        }
      } catch (err) {
        console.warn('FitBounds error:', err)
      }
    }
  }, [map, routeId, path])

  return null
}

function CameraFollow({ position, isNavigating }) {
  const map = useMap()

  useEffect(() => {
    if (isNavigating && position && Array.isArray(position) && position.length === 2) {
      try {
        const size = map.getSize()
        if (size.x > 0 && size.y > 0) {
          map.panTo(position, { animate: true, duration: 0.5 })
        }
      } catch (err) {
        console.warn('CameraFollow error:', err)
      }
    }
  }, [map, position, isNavigating])

  return null
}

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    dblclick(e) {
      onMapClick(e.latlng)
    },
  })
  return null
}

// Smoothly pans + zooms the map to a given position
function PanTo({ position, zoom = 16 }) {
  const map = useMap()
  useEffect(() => {
    if (position && Array.isArray(position) && position.length === 2) {
      const [lat, lon] = position
      if (typeof lat === 'number' && !isNaN(lat) && typeof lon === 'number' && !isNaN(lon)) {
        try {
          const size = map.getSize()
          if (size.x > 0 && size.y > 0) {
            map.flyTo([lat, lon], zoom, { animate: true, duration: 1.2 })
          } else {
            map.setView([lat, lon], zoom)
          }
        } catch (err) {
          console.warn('PanTo flyTo error:', err)
        }
      }
    }
  }, [map, position, zoom])
  return null
}

// Automatically recalculates map dimensions on mobile tab switch or resize
function MapInvalidator({ mobileTab }) {
  const map = useMap()
  useEffect(() => {
    const handleResize = () => {
      try {
        map.invalidateSize()
      } catch (err) {
        console.warn('invalidateSize error:', err)
      }
    }

    handleResize()
    const timer = setTimeout(handleResize, 150)
    window.addEventListener('resize', handleResize)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', handleResize)
    }
  }, [map, mobileTab])

  return null
}

function FlowMap({
  tripResult,
  selectedRouteId,
  onSelectRoute,
  isLoading,
  userLocation,
  mobileTab,
  onSetOrigin,
  onSetWaypoint,
  onSetDestination,
  onOpenPlanner,
}) {
  const routes = tripResult?.routes ?? []
  const selectedRouteIndex = routes.findIndex((route) => route.id === selectedRouteId)
  const selectedRoute = routes[selectedRouteIndex] ?? routes[0]
  const hasRoutes = routes.length > 0

  // Map Layer Controls
  const [showAltRoutesLayer, setShowAltRoutesLayer] = useState(false)
  const [showTrafficFlowLayer, setShowTrafficFlowLayer] = useState(Boolean(TOMTOM_API_KEY))

  // POI (Places of Interest) state
  const [showPoisLayer, setShowPoisLayer] = useState(false)
  const [poiCategory, setPoiCategory] = useState('all')
  const [pois, setPois] = useState([])
  const [isFetchingPois, setIsFetchingPois] = useState(false)

  // Continuous Live GPS Tracking Hook
  const {
    isTracking: isLiveTracking,
    liveLocation,
    toggleTracking: toggleLiveTracking,
    startTracking,
  } = useLiveLocation()

  // Navigation mode: 'sim' (demo simulation) or 'live' (real device GPS tracking)
  const [navMode, setNavMode] = useState('sim')

  // Navigation simulation state
  const [isNavigating, setIsNavigating] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [speedMultiplier, setSpeedMultiplier] = useState(1)
  const [navIndex, setNavIndex] = useState(0)
  const [navPos, setNavPos] = useState(null)
  // Turn-by-Turn Steps Modal state
  const [showStepsDrawer, setShowStepsDrawer] = useState(false)
  const animRef = useRef(null)

  // Helper: closest point on path to user live coordinates
  function getClosestPathIndex(point, routePath) {
    if (!point || !routePath?.length) return 0
    let minDistance = Infinity
    let closestIdx = 0
    for (let i = 0; i < routePath.length; i++) {
      const dLat = routePath[i][0] - point[0]
      const dLon = routePath[i][1] - point[1]
      const distSq = dLat * dLat + dLon * dLon
      if (distSq < minDistance) {
        minDistance = distSq
        closestIdx = i
      }
    }
    return closestIdx
  }

  // Map Click Popup state
  const [clickedLocation, setClickedLocation] = useState(null)
  const [clickedPlaceName, setClickedPlaceName] = useState('')

  const path = selectedRoute?.path || EMPTY_PATH

  // Reset navigation when route changes
  useEffect(() => {
    setIsNavigating(false)
    setNavIndex(0)
    setNavPos(null)
  }, [selectedRouteId])

  // Fetch POIs when POI layer enabled or route/category changes
  useEffect(() => {
    if (!showPoisLayer) {
      setPois([])
      return
    }

    async function loadPois() {
      setIsFetchingPois(true)
      let bounds

      if (path.length) {
        const lats = path.map(([lat]) => lat)
        const lons = path.map(([, lon]) => lon)
        const minLat = Math.min(...lats)
        const maxLat = Math.max(...lats)
        const minLon = Math.min(...lons)
        const maxLon = Math.max(...lons)
        // Add 0.03 deg (~3.5km) padding around route
        bounds = {
          south: minLat - 0.03,
          north: maxLat + 0.03,
          west: minLon - 0.03,
          east: maxLon + 0.03,
        }
      } else {
        bounds = {
          south: DEFAULT_CENTER[0] - 0.06,
          north: DEFAULT_CENTER[0] + 0.06,
          west: DEFAULT_CENTER[1] - 0.06,
          east: DEFAULT_CENTER[1] + 0.06,
        }
      }

      const results = await fetchNearbyPOIs(bounds, poiCategory)
      setPois(results)
      setIsFetchingPois(false)
    }

    loadPois()
  }, [showPoisLayer, poiCategory, selectedRoute?.id])

  // Navigation simulation loop
  useEffect(() => {
    if (!isNavigating || !path.length || isPaused || navMode === 'live') {
      if (animRef.current) clearInterval(animRef.current)
      return
    }

    const intervalMs = Math.max(50, Math.floor(400 / speedMultiplier))

    animRef.current = setInterval(() => {
      setNavIndex((prevIndex) => {
        const nextIndex = prevIndex + 1
        if (nextIndex >= path.length) {
          setIsNavigating(false)
          clearInterval(animRef.current)
          return path.length - 1
        }
        setNavPos(path[nextIndex])
        return nextIndex
      })
    }, intervalMs)

    return () => {
      if (animRef.current) clearInterval(animRef.current)
    }
  }, [isNavigating, isPaused, speedMultiplier, path])

  async function handleMapClick(latlng) {
    setClickedLocation(latlng)
    setClickedPlaceName('Finding address…')
    const placeName = await reverseGeocode(latlng.lat, latlng.lng)
    setClickedPlaceName(placeName)
  }

  function handleStartNavigation() {
    if (!path.length) return
    setIsNavigating(true)
    setIsPaused(false)
    if (isLiveTracking) {
      setNavMode('live')
    } else {
      setNavMode('sim')
      setNavIndex(0)
      setNavPos(path[0])
    }
  }

  function handleStopNavigation() {
    setIsNavigating(false)
    setIsPaused(false)
    setNavIndex(0)
    setNavPos(null)
  }

  // If GPS is turned off while navigating, immediately fallback to simulation
  useEffect(() => {
    if (isNavigating && !isLiveTracking && navMode === 'live') {
      setNavMode('sim')
      if (!navPos && path.length > 0) {
        setNavIndex(0)
        setNavPos(path[0])
      }
    }
  }, [isNavigating, isLiveTracking, navMode, navPos, path])

  // Active navigation indices and metrics (Live GPS vs Simulation)
  const activeNavIndex = navMode === 'live' && liveLocation
    ? getClosestPathIndex([liveLocation.lat, liveLocation.lon], path)
    : navIndex

  const progressPct = path.length > 1 ? (activeNavIndex / (path.length - 1)) * 100 : 0
  const remainingFraction = Math.max(0, 1 - progressPct / 100)
  const remainingDistance = (selectedRoute?.distance || 0) * remainingFraction
  const remainingDuration = (selectedRoute?.duration || 0) * remainingFraction

  const displayedSpeed = navMode === 'live' && liveLocation
    ? liveLocation.speedKmh
    : (tripResult?.vehicle === 'walking' ? 5 : tripResult?.vehicle === 'bike' ? 15 : 45) * speedMultiplier

  const vehicleIcon = createVehicleIcon(tripResult?.vehicle || 'car')

  return (
    <div className="flow-map-container">
      {isLoading && (
        <div className="map-loading-overlay">
          <div className="map-spinner"></div>
          <span>Calculating intelligent routes…</span>
        </div>
      )}

      {/* Map Layer Toolbar Controls (Separate buttons for desktop & mobile) */}
      {!isNavigating && (
        <div className="map-layer-toolbar animate-fade-in">
          <button
            type="button"
            className={`layer-btn live-gps-btn ${isLiveTracking ? 'active' : ''}`}
            onClick={() => {
              toggleLiveTracking()
              if (!isLiveTracking && !isNavigating) startTracking()
            }}
            title="Continuous Live GPS Location Tracking"
            aria-label="Toggle Continuous Live GPS Tracking"
          >
            📡 Live GPS {isLiveTracking ? 'ON' : 'OFF'}
          </button>

          {TOMTOM_API_KEY && (
            <button
              type="button"
              className={`layer-btn traffic-btn ${showTrafficFlowLayer ? 'active' : ''}`}
              onClick={() => setShowTrafficFlowLayer((prev) => !prev)}
              title="Toggle Real-Time TomTom Traffic Flow Layer"
              aria-label="Toggle Real-Time Traffic Layer"
            >
              🚦 Traffic {showTrafficFlowLayer ? 'ON' : 'OFF'}
            </button>
          )}


          {hasRoutes && routes.length > 1 && (
            <button
              type="button"
              className={`layer-btn alt-routes-btn ${showAltRoutesLayer ? 'active' : ''}`}
              onClick={() => setShowAltRoutesLayer((prev) => !prev)}
              title="Toggle Alternative Routes"
              aria-label="Toggle Alternative Routes"
            >
              🛣️ Alts {showAltRoutesLayer ? 'ON' : 'OFF'}
            </button>
          )}
        </div>
      )}

      {/* POI Category Filter Sub-toolbar */}
      {showPoisLayer && !isNavigating && (
        <div className="poi-category-bar animate-fade-in">
          <span className="poi-bar-title">
            {isFetchingPois ? 'Loading…' : `Places (${pois.length})`}
          </span>
          <div className="poi-category-scroll">
            {POI_CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                type="button"
                className={`poi-cat-chip ${poiCategory === cat.value ? 'selected' : ''}`}
                onClick={() => setPoiCategory(cat.value)}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Floating Route Banner (Desktop) & Floating Route Bottom Card (Mobile) */}
      {selectedRoute && !isLoading && !isNavigating && (
        <div className="floating-route-banner animate-fade-in">
          {/* Quick Route Switcher on mobile/desktop when multiple routes exist */}
          {routes.length > 1 && (
            <div className="banner-route-switcher">
              {routes.map((r, idx) => (
                <button
                  key={r.id}
                  type="button"
                  className={`banner-switch-chip ${r.id === selectedRoute.id ? 'active' : ''}`}
                  onClick={() => onSelectRoute(r.id)}
                  style={{
                    '--chip-color': getRouteColor(idx).main,
                  }}
                >
                  <span className="chip-rank">#{r.rank}</span>
                  <span className="chip-time">{formatDuration(r.duration)}</span>
                </button>
              ))}
            </div>
          )}

          <div className="banner-main-row">
            <div
              className="banner-color-dot"
              style={{ backgroundColor: getRouteColor(selectedRouteIndex).main }}
            ></div>
            <div className="banner-details">
              <span className="banner-title">{selectedRoute.label}</span>
              <div className="banner-meta">
                <span className="meta-time">⏱️ {formatDuration(selectedRoute.duration)}</span>
                <span className="meta-dist">📍 {formatDistance(selectedRoute.distance)}</span>
                <span className="banner-score">Score: {selectedRoute.score}/100</span>
              </div>
            </div>

            <div className="banner-actions-group">
              <button
                type="button"
                className="start-nav-banner-btn"
                onClick={handleStartNavigation}
                title={isLiveTracking ? 'Start Live Turn-by-Turn GPS Navigation' : 'Live GPS is OFF — Start Route Simulation'}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                {isLiveTracking ? 'Live GPS Nav' : 'Simulate Route'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation HUD */}
      {isNavigating && selectedRoute && (
        <NavSimulatorHUD
          selectedRoute={selectedRoute}
          vehicle={tripResult?.vehicle}
          progressPct={progressPct}
          currentSpeed={displayedSpeed}
          isPaused={isPaused}
          speedMultiplier={speedMultiplier}
          currentInstruction={
            activeNavIndex < path.length / 3
              ? `Proceed onto ${tripResult.sourceName?.split(',')[0] || 'Origin route'}`
              : activeNavIndex < (path.length * 2) / 3
              ? 'Follow optimal FlowX balanced corridor'
              : `Arriving soon at ${tripResult.destinationName?.split(',')[0] || 'Destination'}`
          }
          remainingDistance={remainingDistance}
          remainingDuration={remainingDuration}
          onPauseToggle={() => setIsPaused((prev) => !prev)}
          onSpeedChange={setSpeedMultiplier}
          onStop={handleStopNavigation}
          navMode={navMode}
          onToggleNavMode={() => setNavMode((prev) => (prev === 'live' ? 'sim' : 'live'))}
          isLiveTracking={isLiveTracking}
          onShowSteps={() => {
            setShowStepsDrawer(true)
            onOpenPlanner?.()
          }}
        />
      )}

      {/* Map Legend Bar */}
      {!isNavigating && (
        <div className="map-legend-bar">
          <span className="legend-item">
            <span className="legend-dot rec" /> {showAltRoutesLayer ? 'Selected Route' : 'Selected Corridor'}
          </span>
          {showTrafficFlowLayer && TOMTOM_API_KEY && (
            <span className="legend-item"><span className="legend-dot" style={{ backgroundColor: '#10b981' }} /> Live Flow</span>
          )}
          {showAltRoutesLayer && <span className="legend-item"><span className="legend-dot alt" /> Alternative</span>}
          {showPoisLayer && <span className="legend-item">📍 Place</span>}
        </div>
      )}

      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        minZoom={3}
        scrollWheelZoom={true}
        doubleClickZoom={false}
        className="flow-map-canvas"
        zoomControl={true}
      >
        <MapInvalidator mobileTab={mobileTab} />

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url={TILE_URL}
          maxZoom={19}
        />

        {/* TomTom Real-Time Live Traffic Raster Tile Layer */}
        {showTrafficFlowLayer && TOMTOM_API_KEY && (
          <TileLayer
            url={`https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${TOMTOM_API_KEY}`}
            zIndex={350}
            opacity={0.78}
            maxZoom={19}
          />
        )}

        <MapClickHandler onMapClick={handleMapClick} />

        {/* Continuous Live User GPS Tracking Marker */}
        {liveLocation && (
          <>
            <Marker
              position={[liveLocation.lat, liveLocation.lon]}
              icon={createLiveTrackingIcon(liveLocation.heading)}
              zIndexOffset={1200}
            >
              <Popup>
                <div className="location-marker-popup">
                  <span className="location-popup-tag" style={{ background: '#10b981' }}>📡 LIVE GPS TRACKING</span>
                  <strong>Live Position</strong>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
                    Speed: {liveLocation.speedKmh} km/h • Accuracy: ±{Math.round(liveLocation.accuracy)}m
                  </span>
                </div>
              </Popup>
            </Marker>
            {isNavigating && navMode === 'live' && (
              <CameraFollow position={[liveLocation.lat, liveLocation.lon]} isNavigating={true} />
            )}
          </>
        )}

        {/* Pan to user location when GPS fix is received */}
        {!liveLocation && userLocation && !hasRoutes && typeof userLocation.lat === 'number' && !isNaN(userLocation.lat) && typeof userLocation.lon === 'number' && !isNaN(userLocation.lon) && (
          <PanTo position={[userLocation.lat, userLocation.lon]} zoom={16} />
        )}

        {/* Static "You are here" marker if not continuous tracking */}
        {!liveLocation && userLocation && typeof userLocation.lat === 'number' && !isNaN(userLocation.lat) && typeof userLocation.lon === 'number' && !isNaN(userLocation.lon) && (
          <Marker
            position={[userLocation.lat, userLocation.lon]}
            icon={userLocationIcon}
            zIndexOffset={1100}
          >
            <Popup>
              <div className="location-marker-popup">
                <span className="location-popup-tag" style={{ background: '#3b82f6' }}>📡 YOUR LOCATION</span>
                <strong>{userLocation.name?.split(' (±')[0] || 'Current Location'}</strong>
                {userLocation.accuracy && (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
                    Accuracy: ±{Math.round(userLocation.accuracy)}m
                  </span>
                )}
              </div>
            </Popup>
          </Marker>
        )}

        {/* Map Click Context Menu Popup */}
        {clickedLocation && (
          <Popup position={clickedLocation} onClose={() => setClickedLocation(null)}>
            <div className="map-context-popup">
              <strong>📍 Map Location</strong>
              <p className="context-place-name">{clickedPlaceName}</p>
              <div className="context-action-btns">
                <button
                  type="button"
                  className="ctx-btn origin-btn"
                  onClick={() => {
                    onSetOrigin?.({ lat: clickedLocation.lat, lon: clickedLocation.lng, name: clickedPlaceName })
                    setClickedLocation(null)
                  }}
                >
                  🟢 Set as Origin
                </button>
                <button
                  type="button"
                  className="ctx-btn dest-btn"
                  onClick={() => {
                    onSetDestination?.({ lat: clickedLocation.lat, lon: clickedLocation.lng, name: clickedPlaceName })
                    setClickedLocation(null)
                  }}
                >
                  🔴 Set as Destination
                </button>
                {onSetWaypoint && (
                  <button
                    type="button"
                    className="ctx-btn waypoint-btn"
                    onClick={() => {
                      onSetWaypoint?.({ lat: clickedLocation.lat, lon: clickedLocation.lng, name: clickedPlaceName })
                      setClickedLocation(null)
                    }}
                  >
                    📍 Add as Waypoint
                  </button>
                )}
              </div>
            </div>
          </Popup>
        )}

        {hasRoutes && (
          <>
            {routes.map((route, idx) => {
              const isSelected = route.id === (selectedRouteId || routes[0]?.id)
              const routeColor = isSelected ? getRouteColor(idx).main : getRouteColor(idx).muted

              // When a user selects a route, other routes are not visible unless explicitly toggled
              if (!isSelected && !showAltRoutesLayer) return null

              const displayPath = (isNavigating && isSelected) ? route.path.slice(activeNavIndex) : route.path

              return (
                <React.Fragment key={route.id}>
                  {/* Outer shadow/outline */}
                  <Polyline
                    positions={displayPath}
                    color="#1a1a2e"
                    weight={isSelected ? 9 : 6}
                    opacity={isSelected ? 0.65 : 0.3}
                    eventHandlers={{
                      click: () => onSelectRoute?.(route.id),
                    }}
                  />
                  {/* Colored route line on top */}
                  <Polyline
                    positions={displayPath}
                    color={routeColor}
                    weight={isSelected ? 6 : 4.5}
                    opacity={isSelected ? 1 : 0.65}
                    eventHandlers={{
                      click: () => onSelectRoute?.(route.id),
                    }}
                  />
                </React.Fragment>
              )
            })}

            {/* Custom Origin Marker (Green Pin) */}
            {tripResult.start && (
              <Marker position={tripResult.start} icon={originIcon} zIndexOffset={900}>
                <Popup>
                  <div className="location-marker-popup origin-popup">
                    <span className="location-popup-tag origin-tag">🟢 ORIGIN</span>
                    <strong>{tripResult.sourceName || 'Start Location'}</strong>
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Custom Stopover Waypoint Marker */}
            {tripResult.waypoint && (
              <Marker position={tripResult.waypoint.coords} icon={waypointIcon} zIndexOffset={850}>
                <Popup>
                  <div className="location-marker-popup waypoint-popup">
                    <span className="location-popup-tag waypoint-tag">📍 STOPOVER</span>
                    <strong>{tripResult.waypoint.name || 'Stopover Location'}</strong>
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Custom Destination Marker (Red Pin) */}
            {tripResult.end && (
              <Marker position={tripResult.end} icon={destinationIcon} zIndexOffset={900}>
                <Popup>
                  <div className="location-marker-popup destination-popup">
                    <span className="location-popup-tag dest-tag">🏁 DESTINATION</span>
                    <strong>{tripResult.destinationName || 'End Location'}</strong>
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Live Navigating Vehicle Marker */}
            {isNavigating && navPos && (
              <>
                <Marker position={navPos} icon={vehicleIcon} zIndexOffset={1000} />
                <CameraFollow position={navPos} isNavigating={isNavigating} />
              </>
            )}

            {!isNavigating && selectedRoute && <FitBounds path={selectedRoute.path} routeId={selectedRoute.id} />}
          </>
        )}

        {/* Places of Interest (POI) Markers */}
        {showPoisLayer &&
          pois.map((poi) => (
            <Marker
              key={poi.id}
              position={[poi.lat, poi.lon]}
              icon={createPoiIcon(poi.icon)}
              zIndexOffset={750}
            >
              <Popup>
                <div className="poi-popup">
                  <div className="poi-popup-header">
                    <span className="poi-popup-icon">{poi.icon}</span>
                    <div>
                      <strong className="poi-popup-name">{poi.name}</strong>
                      <span className="poi-popup-cat">{poi.typeLabel}</span>
                    </div>
                  </div>
                  {poi.address && <p className="poi-popup-sub">📍 {poi.address}</p>}
                  {poi.cuisine && <p className="poi-popup-sub">🍽️ Cuisine: {poi.cuisine}</p>}
                  {poi.openingHours && <p className="poi-popup-sub">🕒 {poi.openingHours}</p>}

                  <div className="context-action-btns">
                    <button
                      type="button"
                      className="ctx-btn origin-btn"
                      onClick={() => onSetOrigin?.({ lat: poi.lat, lon: poi.lon, name: poi.name })}
                    >
                      🟢 Set as Origin
                    </button>
                    <button
                      type="button"
                      className="ctx-btn dest-btn"
                      onClick={() => onSetDestination?.({ lat: poi.lat, lon: poi.lon, name: poi.name })}
                    >
                      🔴 Set as Destination
                    </button>
                    {onSetWaypoint && (
                      <button
                        type="button"
                        className="ctx-btn waypoint-btn"
                        onClick={() => onSetWaypoint?.({ lat: poi.lat, lon: poi.lon, name: poi.name })}
                      >
                        📍 Add as Waypoint
                      </button>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
      </MapContainer>

      {/* In-Map Turn-by-Turn Directions Modal */}
      {showStepsDrawer && selectedRoute && (
        <div className="flowmap-steps-modal-backdrop animate-fade-in" onClick={() => setShowStepsDrawer(false)}>
          <div className="flowmap-steps-modal" onClick={(e) => e.stopPropagation()}>
            <div className="steps-modal-header">
              <div className="steps-modal-title-group">
                <span className="steps-modal-badge">Turn-by-Turn Guide</span>
                <h3 className="steps-modal-title">{selectedRoute.label}</h3>
                <span className="steps-modal-subtitle">
                  📍 {formatDistance(selectedRoute.distance)} • ⏱️ {formatDuration(selectedRoute.duration)} • 🕒 Arrival {formatETA(selectedRoute.duration)}
                </span>
              </div>
              <button
                type="button"
                className="steps-modal-close-btn"
                onClick={() => setShowStepsDrawer(false)}
                title="Close directions"
                aria-label="Close directions"
              >
                ✕
              </button>
            </div>

            <div className="steps-modal-body">
              {selectedRoute.steps?.length > 0 ? (
                <ol className="modal-steps-list">
                  {selectedRoute.steps.map((step, sIdx) => (
                    <li key={sIdx} className="modal-step-item">
                      <span className="modal-step-num">{sIdx + 1}</span>
                      <div className="modal-step-content">
                        <span className="modal-step-text">{step.instruction}</span>
                        {step.distance > 0 && (
                          <span className="modal-step-dist">{formatDistance(step.distance)}</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="modal-steps-fallback">
                  <div className="modal-step-item">
                    <span className="modal-step-num">1</span>
                    <div className="modal-step-content">
                      <span className="modal-step-text">
                        Depart from {tripResult?.sourceName?.split(',')[0] || 'Origin'} along designated corridor
                      </span>
                    </div>
                  </div>
                  {tripResult?.waypoint && (
                    <div className="modal-step-item">
                      <span className="modal-step-num">2</span>
                      <div className="modal-step-content">
                        <span className="modal-step-text">
                          Pass through stopover at {tripResult.waypoint.name?.split(',')[0] || 'Stopover'}
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="modal-step-item">
                    <span className="modal-step-num">{tripResult?.waypoint ? 3 : 2}</span>
                    <div className="modal-step-content">
                      <span className="modal-step-text">
                        Arrive at {tripResult?.destinationName?.split(',')[0] || 'Destination'}
                      </span>
                      <span className="modal-step-dist">{formatDistance(selectedRoute.distance)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="steps-modal-footer">
              <button
                type="button"
                className="steps-modal-start-btn"
                onClick={() => {
                  setShowStepsDrawer(false)
                  handleStartNavigation()
                }}
              >
                ▶️ {isLiveTracking ? 'Start Live GPS Navigation' : 'Start Route Simulation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default FlowMap
