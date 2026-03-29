/**
 * List and fetch single diagnosis records for the current user.
 */
import { API_BASE_URL } from './baseUrl'

export async function get_diagnosis_history(limit = 50, skip = 0) {
  const token = localStorage.getItem('token')
  if (!token) {
    throw new Error('Not authenticated')
  }

  const res = await fetch(`${API_BASE_URL}/api/history?limit=${limit}&skip=${skip}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
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

export async function get_diagnosis_by_id(id) {
  const token = localStorage.getItem('token')
  if (!token) {
    throw new Error('Not authenticated')
  }

  const res = await fetch(`${API_BASE_URL}/api/history/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
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

const history_service = {
  get_diagnosis_history,
  get_diagnosis_by_id
}

export default history_service
