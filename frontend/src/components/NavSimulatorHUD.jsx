import { formatDistance, formatDuration } from '../services/routing'
import './NavSimulatorHUD.css'

const VEHICLE_EMOJIS = {
  car: '🚗',
  bike: '🛵',
  walking: '🚶',
}

function NavSimulatorHUD({
  selectedRoute,
  vehicle = 'car',
  progressPct = 0,
  currentSpeed = 45,
  isPaused = false,
  speedMultiplier = 1,
  currentInstruction = 'Proceed along designated route',
  remainingDistance = 0,
  remainingDuration = 0,
  onPauseToggle,
  onSpeedChange,
  onStop,
  navMode = 'sim',
  onToggleNavMode,
  isLiveTracking = false,
  onShowSteps,
}) {
  if (!selectedRoute) return null

  const vehicleEmoji = VEHICLE_EMOJIS[vehicle] || '🚗'
  const isLive = navMode === 'live'

  return (
    <div className="nav-hud-container animate-fade-in">
      <div className="nav-hud-header">
        <div className="nav-hud-title-group">
          <span className="nav-vehicle-badge">{vehicleEmoji}</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="nav-mode-label">
                {isLive ? '📡 LIVE GPS NAVIGATION' : '🧭 ROUTE SIMULATOR'}
              </span>
              {isLive && (
                <span style={{ fontSize: '10px', background: '#10b981', color: '#fff', padding: '1px 6px', borderRadius: '8px', fontWeight: 'bold' }}>
                  ACTIVE
                </span>
              )}
            </div>
            <h4 className="nav-route-name">{selectedRoute.label}</h4>
          </div>
        </div>
        <button
          type="button"
          className="nav-stop-btn"
          onClick={onStop}
          title="Exit Navigation"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          Exit
        </button>
      </div>

      <div className="nav-instruction-card">
        <div className="instruction-icon-wrapper">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
        <div className="instruction-text" style={{ flex: 1 }}>
          <span className="instruction-heading">{currentInstruction}</span>
          <span className="instruction-sub">FlowX Intelligent Route Navigation</span>
        </div>
        {onShowSteps && (
          <button
            type="button"
            className="banner-details-btn"
            onClick={onShowSteps}
            title="View full turn-by-turn directions"
            style={{ marginLeft: 'auto', padding: '6px 12px', background: 'var(--bg-glass)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="8" y1="6" x2="21" y2="6"/>
              <line x1="8" y1="12" x2="21" y2="12"/>
              <line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/>
              <line x1="3" y1="12" x2="3.01" y2="12"/>
              <line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
            <span>Steps</span>
          </button>
        )}
      </div>

      <div className="nav-stats-row">
        <div className="nav-stat-box">
          <span className="nav-stat-value">{formatDuration(remainingDuration)}</span>
          <span className="nav-stat-label">REMAINING TIME</span>
        </div>
        <div className="nav-stat-box">
          <span className="nav-stat-value">{formatDistance(remainingDistance)}</span>
          <span className="nav-stat-label">REMAINING DIST</span>
        </div>
        <div className="nav-stat-box">
          <span className="nav-stat-value">{Math.round(currentSpeed)} <small>km/h</small></span>
          <span className="nav-stat-label">SPEED</span>
        </div>
      </div>

      <div className="nav-progress-section">
        <div className="nav-progress-bar-track">
          <div
            className="nav-progress-bar-fill"
            style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
          />
        </div>
        <span className="nav-pct-text">{Math.round(progressPct)}% Complete</span>
      </div>

      <div className="nav-controls-row">
        {isLive ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
              Live GPS Tracking Motion
            </span>
            {onToggleNavMode && (
              <button
                type="button"
                className="nav-control-btn"
                onClick={onToggleNavMode}
                style={{ fontSize: '11px', padding: '6px 12px' }}
                title="Switch to Demo Simulation"
              >
                Switch to Simulator
              </button>
            )}
          </div>
        ) : (
          <>
            <button
              type="button"
              className="nav-control-btn pause-btn"
              onClick={onPauseToggle}
            >
              {isPaused ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  Resume
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                  Pause
                </>
              )}
            </button>

            <div className="speed-multiplier-group">
              {[1, 2, 5].map((mult) => (
                <button
                  key={mult}
                  type="button"
                  className={`speed-multiplier-btn ${speedMultiplier === mult ? 'active' : ''}`}
                  onClick={() => onSpeedChange(mult)}
                >
                  {mult}x
                </button>
              ))}
            </div>

            {onToggleNavMode && isLiveTracking && (
              <button
                type="button"
                className="nav-control-btn"
                onClick={onToggleNavMode}
                style={{ fontSize: '11px', padding: '6px 10px', marginLeft: 'auto' }}
                title="Use Live GPS"
              >
                Live GPS
              </button>
            )}
            {!isLiveTracking && (
              <span
                style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: 'auto', padding: '4px 8px', background: 'var(--bg-glass)', borderRadius: '4px' }}
                title="GPS is OFF — Simulation Mode Only"
              >
                GPS OFF (Sim Only)
              </span>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default NavSimulatorHUD
