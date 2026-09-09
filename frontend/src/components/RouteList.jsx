import { useState } from 'react'
import { formatDistance, formatDuration, formatETA } from '../services/routing'
import { getScoreColor } from '../services/routeRanking'
import { getRouteColor } from '../utils/routeColors'
import { exportRouteToGpx } from '../utils/gpxExport'
import './RouteList.css'

function RouteList({ tripResult, selectedRouteId, onSelectRoute, onViewMap }) {
  const [copiedRouteId, setCopiedRouteId] = useState(null)
  const [expandedStepsRouteId, setExpandedStepsRouteId] = useState(null)

  if (!tripResult?.routes?.length) {
    return null
  }

  function handleShareRoute(e, route) {
    e.stopPropagation()
    const summary = `FlowX Route ${route.rank} (${route.label}):\n📍 Origin: ${tripResult.sourceName?.split(',')[0]}\n🏁 Destination: ${tripResult.destinationName?.split(',')[0]}\n⏱️ Duration: ${formatDuration(route.duration)}\n🕒 ETA: ${formatETA(route.duration)}\n📏 Distance: ${formatDistance(route.distance)}\n🌟 FlowX Score: ${route.score}/100`

    navigator.clipboard.writeText(summary)
    setCopiedRouteId(route.id)
    setTimeout(() => setCopiedRouteId(null), 2000)
  }

  function handleExportGpx(e, route) {
    e.stopPropagation()
    exportRouteToGpx(route, tripResult.sourceName, tripResult.destinationName)
  }

  function toggleExpandSteps(e, routeId) {
    e.stopPropagation()
    setExpandedStepsRouteId((prev) => (prev === routeId ? null : routeId))
  }

  return (
    <section className="route-list-container animate-fade-in" aria-label="Ranked routes">
      <div className="route-list-header">
        <h3 className="route-list-title">
          Available Routes ({tripResult.routes.length})
        </h3>
        <div className="header-badges">
          <span className="pref-badge">
            {tripResult.preference
              ? tripResult.preference.charAt(0).toUpperCase() + tripResult.preference.slice(1)
              : ''}{' '}
            Mode
          </span>
          {onViewMap && (
            <button
              type="button"
              className="route-list-map-btn"
              onClick={onViewMap}
              title="Show routes on live map"
            >
              🗺️ Map
            </button>
          )}
        </div>
      </div>

      <div className="route-cards-stack">
        {tripResult.routes.map((route, idx) => {
          const isSelected = route.id === selectedRouteId
          const isStepsExpanded = expandedStepsRouteId === route.id
          const scoreClass = getScoreColor(route.score)
          const routeTheme = getRouteColor(idx)
          const isCopied = copiedRouteId === route.id

          return (
            <div
              key={route.id}
              className={`route-card ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelectRoute(route.id)}
              style={{
                '--route-theme': routeTheme.main,
                '--route-theme-bg': routeTheme.bg,
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onSelectRoute(route.id)
              }}
            >
              <div className="card-stripe" style={{ backgroundColor: routeTheme.main }}></div>
              
              <div className="route-card-inner">
                <div className="card-top-row">
                  <div className="rank-and-label">
                    <span className="rank-badge" style={{ color: routeTheme.main }}>
                      #{route.rank}
                    </span>
                    <span className="route-title">{route.label}</span>
                    {route.isDesertedAtNight ? (
                      <span className="route-traffic-badge deserted-badge" style={{ color: '#ef4444', borderColor: '#ef4444', background: 'rgba(239, 68, 68, 0.1)' }}>
                        🚨 Deserted (No Traffic)
                      </span>
                    ) : tripResult?.vehicle === 'walking' && route.traffic?.trafficActivity >= 50 ? (
                      <span className="route-traffic-badge active-night-badge" style={{ color: '#10b981', borderColor: '#10b981', background: 'rgba(16, 185, 129, 0.1)' }}>
                        🛡️ Live Street Traffic
                      </span>
                    ) : (
                      route.traffic && (
                        <span className="route-traffic-badge" style={{ color: route.traffic.color, borderColor: route.traffic.color }}>
                          ● {route.traffic.label}
                        </span>
                      )
                    )}
                  </div>

                  <div className="top-right-actions">
                    <button
                      type="button"
                      className="share-route-btn"
                      onClick={(e) => handleExportGpx(e, route)}
                      title="Download Route as GPX File"
                    >
                      GPX
                    </button>

                    <button
                      type="button"
                      className="share-route-btn"
                      onClick={(e) => handleShareRoute(e, route)}
                      title="Copy route summary to clipboard"
                    >
                      {isCopied ? 'Copied!' : 'Share'}
                    </button>

                    <span className={`score-badge score-${scoreClass}`}>
                      Score {route.score}/100
                    </span>
                  </div>
                </div>


                <div className="card-main-stats">
                  <div className="stat-item primary-stat">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <polyline points="12 6 12 12 16 14"/>
                    </svg>
                    <span>{formatDuration(route.duration)}</span>
                    {route.delayMinutes > 0 && (
                      <span className="route-delay-tag" title={`Includes estimated ${route.delayMinutes} min traffic delay`}>
                        +{route.delayMinutes}m delay
                      </span>
                    )}
                  </div>

                  <div className="stat-item secondary-stat">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                      <circle cx="12" cy="10" r="3"/>
                    </svg>
                    <span>{formatDistance(route.distance)}</span>
                  </div>

                  <span className="eta-badge" title="Estimated Arrival Clock Time">
                    🕒 Arrival {formatETA(route.duration)}
                  </span>
                </div>

                <div className="score-progress-bar-container">
                  <div
                    className={`score-progress-bar bar-${scoreClass}`}
                    style={{ width: `${Math.max(route.score, 5)}%` }}
                  ></div>
                </div>

                <div className="breakdown-pills">
                  <span className="breakdown-pill">
                    ⏱️ Time <strong>{route.breakdown.time}</strong>
                  </span>
                  <span className="breakdown-pill">
                    🚦 Traffic <strong>{route.breakdown.traffic}</strong>
                  </span>
                  <span className="breakdown-pill">
                    🌤️ Weather <strong>{route.breakdown.weather}</strong>
                  </span>
                  <span className="breakdown-pill">
                    🛡️ Safety <strong>{route.breakdown.safety}</strong>
                  </span>
                </div>

                {route.safetyWarnings?.length > 0 && (
                  <div className="safety-warnings">
                    {route.safetyWarnings.map((warning, wIdx) => (
                      <div key={wIdx} className={`safety-warning-badge warning-${warning.type || 'default'}`}>
                        <span className="warning-badge-icon">{warning.icon}</span>
                        <span className="warning-badge-msg">{warning.message}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Turn-by-Turn Steps Toggle */}
                {route.steps?.length > 0 && (
                  <div className="steps-section">
                    <button
                      type="button"
                      className="toggle-steps-btn"
                      onClick={(e) => toggleExpandSteps(e, route.id)}
                    >
                      <span>{isStepsExpanded ? 'Hide Directions' : `View Directions (${route.steps.length} steps)`}</span>
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        style={{ transform: isStepsExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>

                    {isStepsExpanded && (
                      <ol className="steps-list animate-fade-in">
                        {route.steps.map((step, sIdx) => (
                          <li key={sIdx} className="step-item">
                            <span className="step-num">{sIdx + 1}</span>
                            <span className="step-text">{step.instruction}</span>
                            <span className="step-dist">{formatDistance(step.distance)}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default RouteList
