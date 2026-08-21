import './TrafficWidget.css'

function TrafficWidget({ trafficInfo, vehicle }) {
  if (!trafficInfo) return null

  const isMotorized = vehicle === 'car' || vehicle === 'truck'

  return (
    <div className="traffic-widget-card animate-fade-in">
      <div className="traffic-header">
        <div className="traffic-main-info">
          <span
            className="traffic-status-dot"
            style={{ backgroundColor: trafficInfo.color }}
          ></span>
          <div>
            <div className="traffic-title-row">
              <span className="traffic-level-label" style={{ color: trafficInfo.color }}>
                {trafficInfo.label}
              </span>
              <span className="congestion-percent">
                {trafficInfo.congestionFactor}% Congested
              </span>
            </div>
            <p className="traffic-sublabel">
              {isMotorized ? 'Live Flow Monitor' : 'Non-motorized route'}
            </p>
          </div>
        </div>
      </div>

      {isMotorized && (
        <div className="traffic-details-row">
          <div className="traffic-detail-box">
            <span className="detail-title">Estimated Delay</span>
            <span className="detail-value">
              {trafficInfo.delayMinutes > 0 ? `+${trafficInfo.delayMinutes} min` : 'No delay'}
            </span>
          </div>

          <div className="traffic-detail-box">
            <span className="detail-title">Flow Condition</span>
            <span className="detail-value">
              {trafficInfo.congestionFactor > 50 ? 'Slow Traffic' : 'Optimal'}
            </span>
          </div>
        </div>
      )}

      {trafficInfo.isPeakHour && isMotorized && (
        <div className="traffic-peak-alert">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <span>Peak Hours Active: Heavy urban traffic expected on major arterial roads.</span>
        </div>
      )}
    </div>
  )
}

export default TrafficWidget
