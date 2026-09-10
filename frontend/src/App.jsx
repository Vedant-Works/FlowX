import { useState, useEffect } from 'react'
import Navbar from './components/Navbar'
import TripPlanner from './components/TripPlanner'
import WeatherWidget from './components/WeatherWidget'

import RouteList from './components/RouteList'
import FlowMap from './components/FlowMap'
import CommunityReviewsModal from './components/CommunityReviewsModal'
import { getRankedRoutes } from './services/routing'
import './App.css'

function App() {
  const [theme, setTheme] = useState(() => {
    return document.documentElement.getAttribute('data-theme') || 'dark'
  })
  const [tripResult, setTripResult] = useState(null)
  const [selectedRouteId, setSelectedRouteId] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [customOrigin, setCustomOrigin] = useState(null)
  const [customWaypoint, setCustomWaypoint] = useState(null)
  const [customDest, setCustomDest] = useState(null)
  const [userLocation, setUserLocation] = useState(null)
  const [isReviewsOpen, setIsReviewsOpen] = useState(false)

  const [mobileTab, setMobileTab] = useState('plan') // 'plan' | 'map'

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('flowx_theme', theme)
  }, [theme])

  function handleToggleTheme() {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  async function handleFindRoutes(trip) {
    setIsLoading(true)
    setError(null)
    setTripResult(null)
    setSelectedRouteId(null)

    try {
      const result = await getRankedRoutes(trip)
      setTripResult(result)
      setSelectedRouteId(result.routes[0]?.id ?? null)
      // Automatically switch to map view on mobile once routes are calculated!
      setMobileTab('map')
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  function handleSelectRoute(routeId) {
    setSelectedRouteId(routeId)
    // On mobile, selecting a route immediately shows it on the map
    if (window.innerWidth <= 768) {
      setMobileTab('map')
    }
  }

  const selectedRoute = tripResult?.routes?.find((r) => r.id === selectedRouteId) || tripResult?.routes?.[0]
  const routeCount = tripResult?.routes?.length || 0

  return (
    <div className={`app-container mobile-tab-${mobileTab}`}>
      <Navbar
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onOpenReviews={() => setIsReviewsOpen(true)}
      />
      
      <div className="app-body">
        <aside className={`app-sidebar ${mobileTab === 'plan' ? 'mobile-visible' : 'mobile-hidden'}`}>
          <div className="sidebar-inner">
            <TripPlanner
              onFindRoutes={handleFindRoutes}
              isLoading={isLoading}
              error={error}
              initialSource={customOrigin}
              initialWaypoint={customWaypoint}
              initialDestination={customDest}
              onUserLocation={setUserLocation}
              onViewMap={() => setMobileTab('map')}
              hasResults={Boolean(tripResult?.routes?.length)}
            />
            {tripResult?.weather && (
              <WeatherWidget
                weather={tripResult.weather}
                vehicle={tripResult.vehicle}
                destinationName={tripResult.destinationName}
              />
            )}

            <RouteList
              tripResult={tripResult}
              selectedRouteId={selectedRouteId}
              onSelectRoute={handleSelectRoute}
              onViewMap={() => setMobileTab('map')}
            />
          </div>
        </aside>

        <main className={`app-map-wrapper ${mobileTab === 'map' ? 'mobile-visible' : 'mobile-hidden'}`}>
          <FlowMap
            tripResult={tripResult}
            selectedRouteId={selectedRouteId}
            onSelectRoute={setSelectedRouteId}
            isLoading={isLoading}
            userLocation={userLocation}
            mobileTab={mobileTab}
            onSetOrigin={(place) => {
              setCustomOrigin(place)
              setMobileTab('plan')
            }}
            onSetWaypoint={(place) => {
              setCustomWaypoint(place)
              setMobileTab('plan')
            }}
            onSetDestination={(place) => {
              setCustomDest(place)
              setMobileTab('plan')
            }}
            onOpenPlanner={() => setMobileTab('plan')}
          />
        </main>
      </div>

      {/* Modern Mobile Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
        <button
          type="button"
          className={`mobile-nav-btn ${mobileTab === 'plan' ? 'active' : ''}`}
          onClick={() => setMobileTab('plan')}
          aria-label="Plan and Route List"
        >
          <div className="mobile-nav-icon-wrapper">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4"/>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
            {routeCount > 0 && <span className="nav-badge-count">{routeCount}</span>}
          </div>
          <span className="mobile-nav-label">
            {routeCount > 0 ? `Routes (${routeCount})` : 'Plan Trip'}
          </span>
        </button>

        <button
          type="button"
          className={`mobile-nav-btn ${mobileTab === 'map' ? 'active' : ''}`}
          onClick={() => setMobileTab('map')}
          aria-label="Map and Navigation View"
        >
          <div className="mobile-nav-icon-wrapper">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
              <line x1="8" y1="2" x2="8" y2="18"/>
              <line x1="16" y1="6" x2="16" y2="22"/>
            </svg>
            {routeCount > 0 && <span className="nav-pulse-dot" />}
          </div>
          <span className="mobile-nav-label">Map View</span>
        </button>
      </nav>

      {/* Community Reviews & Feedback Modal */}
      <CommunityReviewsModal
        isOpen={isReviewsOpen}
        onClose={() => setIsReviewsOpen(false)}
      />
    </div>
  )
}

export default App

