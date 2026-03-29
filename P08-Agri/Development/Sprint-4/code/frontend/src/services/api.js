/**
 * Thin fetch wrapper for legacy register call (uses API_BASE_URL).
 */
import { API_BASE_URL } from './baseUrl'

export async function register_user(payload) {
  const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

  let data = null
  try {
    data = await res.json()
  } catch {}

  if (!res.ok) {
    const message = (data && (data.message || data.error)) || `Request failed (${res.status})`
    throw new Error(message)
  }

  return data
}
