const from_env =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) ||
  process.env.REACT_APP_API_URL

const is_localhost = window.location.hostname === 'localhost'
const is_vercel = /\.vercel\.app$/.test(window.location.hostname)
const api_base =
  from_env ||
  (is_localhost
    ? 'http://localhost:5000'
    : (is_vercel ? '' : 'https://sproj-p08-2.onrender.com'))

export async function get_diagnosis_history(limit = 50, skip = 0) {
  const token = localStorage.getItem('token')
  if (!token) {
    throw new Error('Not authenticated')
  }

  const url = `${api_base}/api/history?limit=${limit}&skip=${skip}`
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
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

  const url = `${api_base}/api/history/${id}`
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
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
