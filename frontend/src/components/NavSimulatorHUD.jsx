import { formatDistance, formatDuration } from '../services/routing'
import './NavSimulatorHUD.css'

const VEHICLE_EMOJIS = {
  car: '🚗',
  bike: '🚲',
  truck: '🚚',
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
}) {
  if (!selectedRoute) return null

  const vehicleEmoji = VEHICLE_EMOJIS[vehicle] || '🚗'

  return (
    <div className="nav-hud-container animate-fade-in">
      <div className="nav-hud-header">
        <div className="nav-hud-title-group">
          <span className="nav-vehicle-badge">{vehicleEmoji}</span>
          <div>
            <span className="nav-mode-label">LIVE NAVIGATION MODE</span>
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
        <div className="instruction-text">
          <span className="instruction-heading">{currentInstruction}</span>
          <span className="instruction-sub">FlowX Intelligent Route Navigation</span>
        </div>
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
      </div>
    </div>
  )
}

export default NavSimulatorHUD
