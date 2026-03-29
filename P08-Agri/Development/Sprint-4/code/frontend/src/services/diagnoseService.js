/**
 * Upload an image for ML diagnosis (multipart) with auth header.
 */
import { API_BASE_URL } from './baseUrl'

async function post_diagnose(file) {
  const form = new FormData()
  form.append('image', file)

  const token = localStorage.getItem('token')
  const headers = {}
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE_URL}/api/diagnose`, {
    method: 'POST',
    body: form,
    headers
  })

  let json = null
  try {
    json = await response.json()
  } catch {}

  if (!response.ok) {
    const msg =
      (json && (json.message || json.error || json.detail)) ||
      `Request failed (${response.status})`
    throw new Error(msg)
  }

  return json
}

export async function diagnose_image(file) {
  return post_diagnose(file)
}

const diagnose_service = { diagnose_image }

export default diagnose_service
