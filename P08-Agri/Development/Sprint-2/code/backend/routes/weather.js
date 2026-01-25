const express = require('express')
const axios = require('axios')
const router = express.Router()
const { get_llm_weather_advice } = require('../lib/openaiClient')

const WEATHER_API_URL = 'https://api.open-meteo.com/v1/forecast'

function generate_advice(current, today) {
  const advice = []

  if ((today.precipitation_mm || 0) === 0) {
    advice.push(
      'No significant rain today: if soil is dry, plan irrigation early morning or late evening.'
    )
  } else {
    advice.push(
      'Rain expected today: avoid unnecessary irrigation and make sure fields have proper drainage.'
    )
  }

  if ((current.wind_speed_kmh || 0) < 10) {
    advice.push(
      'Calmer winds: if spraying is needed, this is a suitable window, but always follow label safety instructions.'
    )
  } else {
    advice.push(
      'Stronger winds: avoid spraying pesticides or fertilizers to prevent drift.'
    )
  }

  return advice
}

async function fetch_weather_api(latitude, longitude) {
  const params = {
    latitude,
    longitude,
    hourly: ['temperature_2m', 'precipitation', 'wind_speed_10m', 'uv_index'].join(','),
    daily: [
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_sum',
      'uv_index_max',
      'wind_gusts_10m_max'
    ].join(','),
    current_weather: true,
    timezone: 'auto'
  }

  try {
    const api_response = await axios.get(WEATHER_API_URL, { params, timeout: 10000 })
    return { success: true, data: api_response }
  } catch (axios_error) {
    console.error('[Weather] Open-Meteo API request failed:', axios_error?.message || axios_error)
    if (axios_error?.response?.status === 429) {
      return { success: false, status: 429, error: axios_error }
    }
    return { success: false, error: axios_error }
  }
}

router.get('/', async function (request, response) {
  try {
    const latitude = Number.parseFloat(request.query.lat)
    const longitude = Number.parseFloat(request.query.lon)
    const language = request.query.lang || 'en' // Default to English if not provided

    if (Number.isNaN(latitude) === true || Number.isNaN(longitude) === true) {
      return response.status(400).json({
        ok: false,
        message: 'lat and lon query parameters are required and must be numbers'
      })
    }

    const url =
      `${WEATHER_API_URL}?latitude=${latitude}&longitude=${longitude}` +
      '&hourly=temperature_2m,precipitation,wind_speed_10m,uv_index' +
      '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,uv_index_max,wind_gusts_10m_max' +
      '&current_weather=true&timezone=auto'

    console.log('[Weather] fetching from open-meteo:', url)

    const api_result = await fetch_weather_api(latitude, longitude)

    if (!api_result.success) {
      if (api_result.status === 429) {
        return response.status(429).json({
          ok: false,
          message: 'Daily API request limit exceeded. Please try again tomorrow.',
          detail: 'The weather service has reached its daily limit'
        })
      }
      throw api_result.error
    }

    const api_response = api_result.data

    if (!api_response?.data) {
      console.error('[Weather] Invalid API response structure')
      return response.status(502).json({
        ok: false,
        message: 'Invalid response from weather service',
        detail: 'The weather API returned an unexpected format'
      })
    }

    const data = api_response.data

    const current = {
      temperature_c: data.current_weather?.temperature || data.current?.temperature_2m,
      wind_speed_kmh: data.current_weather?.windspeed || data.current?.wind_speed_10m
    }

    const today = {
      tmax_c: data.daily?.temperature_2m_max?.[0],
      tmin_c: data.daily?.temperature_2m_min?.[0],
      precipitation_mm: data.daily?.precipitation_sum?.[0],
      uv_index_max: data.daily?.uv_index_max?.[0],
      wind_gust_max_kmh: data.daily?.wind_gusts_10m_max?.[0]
    }

    const advice = generate_advice(current, today)

    const city_label = data.timezone || 'Your location'

    console.log('[Weather] base payload for frontend + LLM:', {
      city: city_label,
      current,
      today,
      advice_count: advice.length
    })

    let llm_advice = null

    try {
      console.log('[Weather] calling get_llm_weather_advice...')
      llm_advice = await get_llm_weather_advice({
        city: city_label,
        latitude,
        longitude,
        current,
        today,
        advice,
        language
      })
      console.log(
        '[Weather] LLM advice result:',
        llm_advice ? `OK (length ${llm_advice.length})` : 'NULL'
      )
    } catch (error) {
      console.error(
        '[Weather] get_llm_weather_advice failed:',
        error?.message || error
      )
      llm_advice = null
    }

    const payload = {
      city: city_label,
      latitude,
      longitude,
      current,
      today,
      advice,
      llm_advice
    }

    response.json(payload)
  } catch (error) {
    const error_detail = error?.response?.data || error?.message || String(error)
    console.error('[Weather] Unexpected error:', error_detail)
    if (error?.stack) {
      console.error('[Weather] Error stack:', error.stack)
    }
    
    // Don't send error details in production to avoid exposing internals
    const detail = process.env.NODE_ENV === 'development' ? error_detail : 'Internal server error'
    
    response.status(500).json({
      ok: false,
      message: 'Failed to fetch weather data',
      detail: detail
    })
  }
})

module.exports = router
