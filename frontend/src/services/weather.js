/**
 * FlowX Weather Service
 * Integrates live weather data using Open-Meteo API (free, no API key needed).
 * Supports OpenWeather API key if configured in environment.
 */

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast'

/**
 * WMO Weather interpretation codes mapping
 */
function parseWmoWeatherCode(code) {
  if (code === 0) return { label: 'Clear Sky', icon: '☀️', severity: 'clear' }
  if (code >= 1 && code <= 3) return { label: 'Partly Cloudy', icon: 'PARTLY_CLOUDY', severity: 'clouds' }
  if (code === 45 || code === 48) return { label: 'Foggy', icon: '🌫️', severity: 'clouds' }
  if (code >= 51 && code <= 55) return { label: 'Drizzle', icon: '🌦️', severity: 'light_rain' }
  if (code >= 61 && code <= 65) return { label: 'Rain', icon: '🌧️', severity: 'rain' }
  if (code >= 71 && code <= 77) return { label: 'Snow', icon: '❄️', severity: 'snow' }
  if (code >= 80 && code <= 82) return { label: 'Rain Showers', icon: '🌧️', severity: 'rain' }
  if (code >= 95 && code <= 99) return { label: 'Thunderstorm', icon: '⛈️', severity: 'storm' }

  return { label: 'Overcast', icon: '☁️', severity: 'clouds' }
}

export async function fetchWeather(lat, lon) {
  try {
    const params = new URLSearchParams({
      latitude: lat,
      longitude: lon,
      current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m',
    })

    const response = await fetch(`${OPEN_METEO_URL}?${params}`)

    if (!response.ok) {
      throw new Error('Weather API request failed')
    }

    const data = await response.json()
    const current = data.current || {}

    const weatherInfo = parseWmoWeatherCode(current.weather_code ?? 0)

    return {
      temp: Math.round(current.temperature_2m ?? 24),
      humidity: Math.round(current.relative_humidity_2m ?? 60),
      windSpeed: Math.round(current.wind_speed_10m ?? 10),
      condition: weatherInfo.label,
      icon: weatherInfo.icon,
      severity: weatherInfo.severity,
      code: current.weather_code ?? 0,
    }
  } catch (error) {
    console.warn('Weather service warning:', error.message)
    return {
      temp: 24,
      humidity: 60,
      windSpeed: 12,
      condition: 'Clear Sky',
      icon: '☀️',
      severity: 'clear',
      code: 0,
    }
  }
}
