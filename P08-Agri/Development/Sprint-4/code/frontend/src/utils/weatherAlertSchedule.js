/** Weather refresh interval aligned to account `createdAt` (signup instant). */
export const WEATHER_ALERT_INTERVAL_MS = 5 * 60 * 1000

/**
 * Milliseconds until the next aligned boundary after account creation (signup + n × interval).
 * If `createdAtMs` is unknown, returns one full interval (legacy sessions).
 */
export function msUntilNextAlignedWeatherFetch(createdAtMs, nowMs = Date.now()) {
  if (createdAtMs == null || !Number.isFinite(createdAtMs)) {
    return WEATHER_ALERT_INTERVAL_MS
  }
  const elapsed = nowMs - createdAtMs
  const slots = Math.max(1, Math.ceil(elapsed / WEATHER_ALERT_INTERVAL_MS))
  const next = createdAtMs + slots * WEATHER_ALERT_INTERVAL_MS
  return Math.max(0, next - nowMs)
}
