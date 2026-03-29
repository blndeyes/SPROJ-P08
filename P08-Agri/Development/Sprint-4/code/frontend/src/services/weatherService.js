/**
 * Open-Meteo-backed weather + tips for given coordinates; passes UI language for copy.
 */
import { API_BASE_URL } from './baseUrl'

export async function fetch_weather_by_coords(latitude, longitude, language = 'en') {
  const base = (API_BASE_URL == null || API_BASE_URL === '') ? '' : API_BASE_URL.replace(/\/$/, '')
  const url = `${base}/api/weather?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}&lang=${encodeURIComponent(language)}`

  let res
  try {
    res = await fetch(url, { headers: { 'Content-Type': 'application/json' } })
  } catch (networkErr) {
    const msg = networkErr?.message || 'Network error'
    throw new Error(msg.includes('fetch') || msg.includes('Failed') ? 'Cannot reach weather service. Check your connection and try again.' : msg)
  }

  let data = null
  try {
    data = await res.json()
  } catch {}

  if (!res.ok) {
    const msg =
      (data && (data.message || data.error || data.detail)) ||
      `Weather request failed (${res.status})`
    throw new Error(msg)
  }

  if (data?.today && data.today.wind_gust_max_kmh !== undefined && data.today.wind_gusts_kmh === undefined) {
    data.today.wind_gusts_kmh = data.today.wind_gust_max_kmh
  }

  return data
}

const weather_service = {
  fetch_weather_by_coords
}

export default weather_service
