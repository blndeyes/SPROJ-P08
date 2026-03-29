/**
 * One-line actionable summary for the scheduled weather alert banner.
 * `labels` is `t.farmerDashboard` from translations.
 */
function fill(template, map) {
  if (!template) return ''
  let s = template
  Object.entries(map).forEach(([key, value]) => {
    s = s.split(`{${key}}`).join(String(value))
  })
  return s
}

export function buildCrucialWeatherAlertText(data, labels) {
  if (!data || !labels) {
    return { text: '', severe: false }
  }

  const current = data.current || {}
  const today = data.today || {}
  const condition = String(current.condition || '').toLowerCase()

  const precip = Number(today.precipitation_mm) || 0
  const wind = Number(current.wind_speed_kmh) || 0
  const gust = Number(today.wind_gust_max_kmh ?? today.wind_gusts_kmh ?? 0) || 0
  const windShow = Math.round(Math.max(wind, gust))
  const uv = Number(today.uv_index_max) || 0
  const tmax = Number(today.tmax_c)
  const tmin = Number(today.tmin_c)
  const tempNow = current.temperature_c

  const parts = []
  let severe = false

  if (condition.includes('thunder')) {
    parts.push(labels.weatherAlertThunder)
    severe = true
  }

  if (precip >= 20) {
    parts.push(fill(labels.weatherAlertHeavyRain, { mm: precip.toFixed(0) }))
    severe = true
  } else if (precip >= 10) {
    parts.push(fill(labels.weatherAlertModerateRain, { mm: precip.toFixed(0) }))
    severe = true
  } else if (precip >= 3) {
    parts.push(fill(labels.weatherAlertLightRain, { mm: precip.toFixed(1) }))
  }

  if (gust >= 45 || wind >= 32) {
    parts.push(fill(labels.weatherAlertWindStrong, { kmh: windShow }))
    severe = true
  } else if (gust >= 35 || wind >= 24) {
    parts.push(fill(labels.weatherAlertWindModerate, { kmh: windShow }))
  }

  if (uv >= 9) {
    parts.push(fill(labels.weatherAlertUvHigh, { uv: uv.toFixed(1) }))
    severe = true
  } else if (uv >= 7) {
    parts.push(fill(labels.weatherAlertUvModerate, { uv: uv.toFixed(1) }))
  }

  if (Number.isFinite(tmax) && tmax >= 41) {
    parts.push(fill(labels.weatherAlertHeatSevere, { c: tmax.toFixed(0) }))
    severe = true
  } else if (Number.isFinite(tmax) && tmax >= 38) {
    parts.push(fill(labels.weatherAlertHeatHigh, { c: tmax.toFixed(0) }))
  }

  if (Number.isFinite(tmin) && tmin <= 3) {
    parts.push(fill(labels.weatherAlertCold, { c: tmin.toFixed(0) }))
  }

  if (parts.length === 0) {
    const rainStr = precip > 0 ? precip.toFixed(1) : '0'
    const tempStr = tempNow != null && Number.isFinite(Number(tempNow)) ? Number(tempNow).toFixed(1) : '—'
    const windStr = Number.isFinite(wind) ? String(Math.round(wind)) : '—'
    return {
      text: fill(labels.weatherAlertMildSummary, {
        temp: tempStr,
        rain: rainStr,
        wind: windStr
      }),
      severe: false
    }
  }

  const text = parts.filter(Boolean).slice(0, 3).join(' ')
  return { text, severe }
}
