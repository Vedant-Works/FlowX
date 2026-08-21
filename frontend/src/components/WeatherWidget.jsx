import './WeatherWidget.css'

function WeatherWidget({ weather, vehicle, destinationName }) {
  if (!weather) return null

  const isPrecipitation = ['light_rain', 'rain', 'storm', 'snow'].includes(weather.severity)
  const isOutdoorVehicle = ['walking', 'bike'].includes(vehicle)

  return (
    <div className="weather-widget-card animate-fade-in">
      <div className="weather-header">
        <div className="weather-main-info">
          <span className="weather-icon-emoji">{weather.icon === 'PARTLY_CLOUDY' ? '⛅' : weather.icon}</span>
          <div>
            <div className="weather-temp-row">
              <span className="weather-temp">{weather.temp}°C</span>
              <span className="weather-condition">{weather.condition}</span>
            </div>
            <p className="weather-location-label">
              Destination Weather
            </p>
          </div>
        </div>
      </div>

      <div className="weather-stats-grid">
        <div className="weather-stat-box">
          <span className="stat-label">Humidity</span>
          <span className="stat-value">💧 {weather.humidity}%</span>
        </div>
        <div className="weather-stat-box">
          <span className="stat-label">Wind Speed</span>
          <span className="stat-value">💨 {weather.windSpeed} km/h</span>
        </div>
      </div>

      {isPrecipitation && isOutdoorVehicle && (
        <div className="weather-warning-banner">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span>Weather Warning: Rain detected along your {vehicle} route. Consider gear or alternative transit.</span>
        </div>
      )}
    </div>
  )
}

export default WeatherWidget
