import { useState, useEffect, useRef } from 'react'
import Navbar from './components/Navbar'
import TripPlanner from './components/TripPlanner'
import WeatherWidget from './components/WeatherWidget'
import TrafficWidget from './components/TrafficWidget'
import RouteList from './components/RouteList'
import FlowMap from './components/FlowMap'
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
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const selectedRoute = tripResult?.routes?.find((r) => r.id === selectedRouteId) || tripResult?.routes?.[0]

  return (
    <div className="app-container">
      <Navbar theme={theme} onToggleTheme={handleToggleTheme} />
      
      <div className="app-body">
        <aside className="app-sidebar">
          <div className="sidebar-inner">
            <TripPlanner
              onFindRoutes={handleFindRoutes}
              isLoading={isLoading}
              error={error}
              initialSource={customOrigin}
              initialWaypoint={customWaypoint}
              initialDestination={customDest}
            />
            {tripResult?.weather && (
              <WeatherWidget
                weather={tripResult.weather}
                vehicle={tripResult.vehicle}
                destinationName={tripResult.destinationName}
              />
            )}
            {selectedRoute?.traffic && (
              <TrafficWidget
                trafficInfo={selectedRoute.traffic}
                vehicle={tripResult.vehicle}
              />
            )}
            <RouteList
              tripResult={tripResult}
              selectedRouteId={selectedRouteId}
              onSelectRoute={setSelectedRouteId}
            />
          </div>
        </aside>

        <main className="app-map-wrapper">
          <FlowMap
            tripResult={tripResult}
            selectedRouteId={selectedRouteId}
            onSelectRoute={setSelectedRouteId}
            isLoading={isLoading}
            theme={theme}
            onSetOrigin={(place) => setCustomOrigin(place)}
            onSetWaypoint={(place) => setCustomWaypoint(place)}
            onSetDestination={(place) => setCustomDest(place)}
          />
        </main>
      </div>
    </div>
  )
}

export default App
