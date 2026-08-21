import { getRouteColor } from '../utils/routeColors'
import './BalancedRoutingBanner.css'

function BalancedRoutingBanner({ tripResult }) {
  if (!tripResult?.routes?.length || tripResult.routes.length < 2) {
    return null
  }

  const routes = tripResult.routes
  const distribution = tripResult.distribution

  if (!distribution) return null

  return (
    <section className="balanced-banner animate-fade-in" aria-label="Balanced routing">
      <div className="balanced-header">
        <div className="balanced-header-left">
          <span className="balanced-icon">⚡</span>
          <div>
            <h3 className="balanced-title">FlowX Smart Distribution</h3>
            <p className="balanced-subtitle">
              Optimally distributing vehicles to minimize congestion
            </p>
          </div>
        </div>
      </div>

      <div className="distribution-bars">
        {routes.map((route, idx) => {
          const pct = distribution[idx]?.percentage ?? 0
          const routeColor = getRouteColor(idx)

          return (
            <div key={route.id} className="dist-row">
              <div className="dist-label-row">
                <div className="dist-label-left">
                  <span
                    className="dist-color-dot"
                    style={{ backgroundColor: routeColor.main }}
                  />
                  <span className="dist-route-name">{route.label}</span>
                </div>
                <span className="dist-pct" style={{ color: routeColor.main }}>
                  {pct}%
                </span>
              </div>
              <div className="dist-bar-track">
                <div
                  className="dist-bar-fill"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: routeColor.main,
                    boxShadow: `0 0 12px ${routeColor.main}44`,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="balanced-insight">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <span>
          Instead of sending all drivers on Route #1, FlowX recommends distributing
          traffic to reduce overall congestion by up to <strong>{distribution.congestionReduction}%</strong>.
        </span>
      </div>
    </section>
  )
}

export default BalancedRoutingBanner
