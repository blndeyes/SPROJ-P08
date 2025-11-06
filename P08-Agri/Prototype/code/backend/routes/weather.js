// routes/weather.js
const express = require('express');
const axios = require('axios');

const router = express.Router();

router.get('/', async (req, res) => {
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

  const http = axios.create({
    timeout: 10000,
    headers: { 'User-Agent': 'AgriQual-Server/1.0' }
  });

  const reverse_open_meteo =
    `https://geocoding-api.open-meteo.com/v1/reverse` +
    `?latitude=${latitude}&longitude=${longitude}` +
    `&language=en&format=json&count=1`;

  const reverse_bdc =
    `https://api.bigdatacloud.net/data/reverse-geocode-client` +
    `?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`;

  const weather_url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${latitude}&longitude=${longitude}` +
    `&current_weather=true` +
    `&daily=precipitation_sum,temperature_2m_max,temperature_2m_min,uv_index_max,wind_gusts_10m_max` +
    `&forecast_days=1&timezone=auto`;

  try {
    const weather_resp = await http.get(weather_url);
    const w = weather_resp.data || {};
    const current = w.current_weather || {};
    const daily = w.daily || {};

    const today = {
      precipitation_mm: Array.isArray(daily.precipitation_sum) ? daily.precipitation_sum[0] : null,
      tmax_c: Array.isArray(daily.temperature_2m_max) ? daily.temperature_2m_max[0] : null,
      tmin_c: Array.isArray(daily.temperature_2m_min) ? daily.temperature_2m_min[0] : null,
      uv_index_max: Array.isArray(daily.uv_index_max) ? daily.uv_index_max[0] : null,
      wind_gust_max_kmh: Array.isArray(daily.wind_gusts_10m_max) ? daily.wind_gusts_10m_max[0] : null
    };

    const current_block = {
      temperature_c: typeof current.temperature === 'number' ? current.temperature : null,
      wind_speed_kmh: typeof current.windspeed === 'number' ? current.windspeed : null
    };

    // Build city label
    let city_label = 'Current location';
    try {
      const r1 = await http.get(reverse_open_meteo);
      if (r1.data && Array.isArray(r1.data.results) && r1.data.results.length > 0) {
        const top = r1.data.results[0] || {};
        const name = top.name || '';
        const admin1 = top.admin1 || '';
        const admin2 = top.admin2 || '';
        const country = top.country || '';
        const parts = [];
        if (name) parts.push(name);
        if (admin1) parts.push(admin1);
        if (!name && admin2) parts.push(admin2);
        if (parts.length === 0 && country) parts.push(country);
        if (parts.length > 0) city_label = parts.join(', ');
      } else {
        throw new Error('Open-Meteo reverse returned no results');
      }
    } catch (e) {
      console.warn('[weather] reverse via Open-Meteo failed:', e?.response?.status || '', e?.message || '');
      try {
        const r2 = await http.get(reverse_bdc);
        const b = r2.data || {};
        const parts = [];
        if (b.city || b.locality) parts.push(b.city || b.locality);
        if (b.principalSubdivision) parts.push(b.principalSubdivision);
        if (parts.length === 0 && b.countryName) parts.push(b.countryName);
        if (parts.length > 0) city_label = parts.join(', ');
      } catch (e2) {
        console.warn('[weather] reverse fallback (BDC) failed:', e2?.response?.status || '', e2?.message || '');
      }
    }

    // Advice
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
  } catch (err) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    console.error('[weather] fetch failed', { status, message: err?.message, data });

    const safe_message =
      status === 429
        ? 'Upstream weather service rate-limited. Please try again shortly.'
        : status
        ? `Upstream weather service error (${status}).`
        : 'Network error contacting weather service.';

    res.status(500).json({ message: 'Failed to fetch weather', detail: safe_message });
  }
});

module.exports = router;
