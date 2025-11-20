const from_env =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  process.env.REACT_APP_API_BASE_URL

const api_base =
  from_env ||
  (window.location.hostname === 'localhost'
    ? 'http://localhost:5000'
    : 'https://sproj-p08.onrender.com')

export async function diagnose_image(file) {
  const form = new FormData()
  form.append('image', file)
  const res = await fetch(`${api_base}/api/diagnose`, { method: 'POST', body: form })
  let data = null
  try {
    data = await res.json()
  } catch {}
  if (!res.ok) {
    const message = (data && (data.message || data.error || data.detail)) || `Request failed (${res.status})`
    throw new Error(message)
  }
  return data
}
