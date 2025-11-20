// backend/routes/weather.js
const express = require('express');
const axios = require('axios');

const router = express.Router();

/** Small helper: fetch with timeout + 1 retry using axios */
async function fetch_json(url, { timeout_ms = 12000, retry = 1, headers = {} } = {}) {
  for (let attempt = 0; attempt <= retry; attempt++) {
    try {
      const res = await axios.get(url, {
        headers,
        timeout: timeout_ms,
        validateStatus: () => true // Don't throw on any status code
      });
      if (res.status >= 200 && res.status < 300) {
        return { ok: true, status: res.status, data: res.data };
      }
      // Return structured error so caller can decide
      return { ok: false, status: res.status, data: res.data || { error: 'Request failed' } };
    } catch (e) {
      if (attempt === retry) {
        return { ok: false, status: undefined, data: { error: e?.message || 'network' } };
      }
      // brief backoff before retry
      await new Promise(r => setTimeout(r, 300));
    }
  }
}

/** Build label via reverse geocoding (best-effort). Never throws. */
async function reverse_label(lat, lon) {
  const headers = { 'User-Agent': 'AgriQual-Server/1.0' };

  // 1) Try Open-Meteo reverse
  const r1 = await fetch_json(
    `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=en&format=json&count=1`,
    { timeout_ms: 8000, retry: 0, headers }
  );
  if (r1.ok && Array.isArray(r1.data?.results) && r1.data.results.length > 0) {
    const top = r1.data.results[0] || {};
    const parts = [];
    if (top.name) parts.push(top.name);
    if (top.admin1) parts.push(top.admin1);
    if (!top.name && top.admin2) parts.push(top.admin2);
    if (parts.length === 0 && top.country) parts.push(top.country);
    if (parts.length > 0) return parts.join(', ');
  }

  // 2) Fallback BigDataCloud
  const r2 = await fetch_json(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
    { timeout_ms: 8000, retry: 0, headers }
  );
  if (r2.ok) {
    const b = r2.data || {};
    const parts = [];
    if (b.city || b.locality) parts.push(b.city || b.locality);
    if (b.principalSubdivision) parts.push(b.principalSubdivision);
    if (parts.length === 0 && b.countryName) parts.push(b.countryName);
    if (parts.length > 0) return parts.join(', ');
  }

  return 'Current location';
}

/** Forecast + advice (never depends on reverse geocode) */
router.get('/', async (req, res) => {
  try {
    const lat_param = req.query.lat;
    const lon_param = req.query.lon;

    if (!lat_param || !lon_param) {
      res.status(400).json({ message: 'lat and lon are required' });
      return;
    }
    const latitude = Number(lat_param);
    const longitude = Number(lon_param);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      res.status(400).json({ message: 'lat and lon must be numbers' });
      return;
    }

    const headers = { 'User-Agent': 'AgriQual-Server/1.0' };
    const weather_url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${latitude}&longitude=${longitude}` +
      `&current_weather=true` +
      `&daily=precipitation_sum,temperature_2m_max,temperature_2m_min,uv_index_max,wind_gusts_10m_max` +
      `&forecast_days=1&timezone=auto`;

    // Forecast first (primary)
    const w = await fetch_json(weather_url, { timeout_ms: 12000, retry: 1, headers });
    if (!w.ok) {
      const safe_message =
        w.status === 429
          ? 'Upstream weather service rate-limited. Please try again shortly.'
          : w.status
          ? `Upstream weather service error (${w.status}).`
          : 'Network error contacting weather service.';
      res.status(500).json({ message: 'Failed to fetch weather', detail: safe_message });
      return;
    }

    const wd = w.data || {};
    const current = wd.current_weather || {};
    const daily = wd.daily || {};

    const today = {
      precipitation_mm: Array.isArray(daily.precipitation_sum) ? daily.precipitation_sum[0] : null,
      tmax_c: Array.isArray(daily.temperature_2m_max) ? daily.temperature_2m_max[0] : null,
      tmin_c: Array.isArray(daily.temperature_2m_min) ? daily.temperature_2m_min[0] : null,
      uv_index_max: Array.isArray(daily.uv_index_max) ? daily.uv_index_max[0] : null,
      wind_gust_max_kmh: Array.isArray(daily.wind_gusts_10m_max) ? daily.wind_gusts_10m_max[0] : null,
    };

    const current_block = {
      temperature_c: typeof current.temperature === 'number' ? current.temperature : null,
      wind_speed_kmh: typeof current.windspeed === 'number' ? current.windspeed : null,
    };

    // Best-effort label (does not affect success)
    const city_label = await reverse_label(latitude, longitude);

    // Advice (same as your original)
    const advice = [];
    if (today.precipitation_mm !== null && today.precipitation_mm >= 2) {
      advice.push('Rain expected today: postpone irrigation and N top-dress; check low fields for waterlogging.');
    } else {
      advice.push('No significant rain today: if soil is dry, plan irrigation early morning or late evening.');
    }
    if (
      (current_block.wind_speed_kmh !== null && current_block.wind_speed_kmh >= 25) ||
      (today.wind_gust_max_kmh !== null && today.wind_gust_max_kmh >= 40)
    ) {
      advice.push('Windy conditions: avoid pesticide/herbicide spraying; secure mulches and covers.');
    } else {
      advice.push('Calmer winds: if spraying is needed, this is a suitable window.');
    }
    if (today.tmax_c !== null && today.tmax_c >= 35) {
      advice.push('High heat: shallow irrigation to reduce stress; avoid transplanting at midday; monitor for wilting.');
    } else if (today.tmin_c !== null && today.tmin_c <= 5) {
      advice.push('Cold risk: use row covers for sensitive crops; avoid night irrigation.');
    }
    if (today.uv_index_max !== null && today.uv_index_max >= 8) {
      advice.push('Strong UV: schedule field work earlier/later; ensure sun protection for workers.');
    }

    res.json({
      city: city_label,
      latitude,
      longitude,
      current: current_block,
      today,
      advice
    });
  } catch (error) {
    console.error('Weather route error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch weather', 
      detail: error?.message || 'Internal server error' 
    });
  }
});

module.exports = router;