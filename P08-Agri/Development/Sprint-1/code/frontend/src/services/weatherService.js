// src/services/weatherService.js

// resolve backend base url (works for cra or vite)
const fromEnv =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
  process.env.REACT_APP_API_BASE_URL;

const isLocalhost = window.location.hostname === 'localhost'
const isVercel = /\.vercel\.app$/.test(window.location.hostname)
const API_BASE =
  fromEnv || (isLocalhost ? 'http://localhost:5000' : (isVercel ? '' : 'https://sproj-p08-2.onrender.com'));

export async function fetch_weather_by_coords(latitude, longitude) {
  // call backend weather endpoint with lat lon
  const url = `${API_BASE}/api/weather?lat=${encodeURIComponent(
    latitude
  )}&lon=${encodeURIComponent(longitude)}`;

  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // keep data as null
  }

  if (!res.ok) {
    const msg =
      (data && (data.message || data.error || data.detail)) ||
      `Weather request failed (${res.status})`;
    throw new Error(msg);
  }

  // normalize gust field for dashboard usage
  if (data?.today && data.today.wind_gust_max_kmh !== undefined && data.today.wind_gusts_kmh === undefined) {
    data.today.wind_gusts_kmh = data.today.wind_gust_max_kmh;
  }

  return data; // { city, latitude, longitude, current:{...}, today:{...}, advice:[...] }
}
