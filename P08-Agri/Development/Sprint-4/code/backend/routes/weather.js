/**
 * Open-Meteo weather plus short farmer tips (EN/Urdu) and optional LLM summary.
 */
const express = require('express')
const axios = require('axios')
const router = express.Router()
const { get_llm_weather_advice } = require('../lib/openaiClient')

const WEATHER_API_URL = 'https://api.open-meteo.com/v1/forecast'

function weathercode_to_condition(code) {
  if (code == null) return null
  const c = Number(code)
  if (c === 0) return 'Clear'
  if (c >= 1 && c <= 3) return ['Mainly clear', 'Partly cloudy', 'Overcast'][c - 1]
  if (c >= 45 && c <= 48) return 'Fog'
  if (c >= 51 && c <= 57) return 'Drizzle'
  if (c >= 61 && c <= 67) return 'Rain'
  if (c >= 71 && c <= 77) return 'Snow'
  if (c >= 80 && c <= 82) return 'Rain showers'
  if (c >= 85 && c <= 86) return 'Snow showers'
  if (c >= 95 && c <= 99) return 'Thunderstorm'
  return 'Unknown'
}

const ADVICE_STRINGS = {
  en: {
    noRain: 'No significant rain today: if soil is dry, plan irrigation early morning or late evening.',
    rain: 'Rain expected today: avoid unnecessary irrigation and make sure fields have proper drainage.',
    calmWind: 'Calmer winds: if spraying is needed, this is a suitable window, but always follow label safety instructions.',
    strongWind: 'Stronger winds: avoid spraying pesticides or fertilizers to prevent drift.'
  },
  ur: {
    noRain: 'آج خاص بارش نہیں: اگر مٹی خشک ہے تو آبپاشی صبح سویرے یا شام دیر سے کریں۔',
    rain: 'آج بارش کا امکان: غیر ضروری آبپاشی سے گریز کریں اور کھیتوں میں نکاسی کا خیال رکھیں۔',
    calmWind: 'ہوا کم ہے: اگر سپرے کرنا ہو تو یہ موافق وقت ہے، پر ہمیشہ لیبل پر دی گئی ہدایات پر عمل کریں۔',
    strongWind: 'تیز ہوا: زہریلی یا کھادی سپرے سے گریز کریں تاکہ دوسری جگہ نہ اڑے۔'
  }
}

function generate_advice(current, today, language = 'en') {
  const strings = ADVICE_STRINGS[language] || ADVICE_STRINGS.en
  const advice = []

  if ((today.precipitation_mm || 0) === 0) {
    advice.push(strings.noRain)
  } else {
    advice.push(strings.rain)
  }

  if ((current.wind_speed_kmh || 0) < 10) {
    advice.push(strings.calmWind)
  } else {
    advice.push(strings.strongWind)
  }

  return advice
}

async function fetch_weather_api(latitude, longitude) {
  const params = {
    latitude,
    longitude,
    hourly: ['temperature_2m', 'precipitation', 'wind_speed_10m', 'uv_index', 'relative_humidity_2m'].join(','),
    daily: [
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_sum',
      'uv_index_max',
      'wind_gusts_10m_max'
    ].join(','),
    current_weather: true,
    current: 'relative_humidity_2m',
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

    const weathercode = data.current_weather?.weathercode ?? data.current?.weather_code
    const humidity = data.current?.relative_humidity_2m ?? (data.hourly?.relative_humidity_2m?.[0])
    const current = {
      temperature_c: data.current_weather?.temperature || data.current?.temperature_2m,
      wind_speed_kmh: data.current_weather?.windspeed || data.current?.wind_speed_10m,
      condition: weathercode_to_condition(weathercode) || null,
      humidity: humidity != null ? Math.round(Number(humidity)) : null
    }

    const today = {
      tmax_c: data.daily?.temperature_2m_max?.[0],
      tmin_c: data.daily?.temperature_2m_min?.[0],
      precipitation_mm: data.daily?.precipitation_sum?.[0],
      uv_index_max: data.daily?.uv_index_max?.[0],
      wind_gust_max_kmh: data.daily?.wind_gusts_10m_max?.[0]
    }

    const advice = generate_advice(current, today, language)

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
