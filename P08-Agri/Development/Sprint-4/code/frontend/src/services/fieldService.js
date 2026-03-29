/**
 * Farmer field CRUD and linking a saved diagnosis to a field.
 */
import { API_BASE_URL } from './baseUrl'

function get_headers() {
  const token = localStorage.getItem('token')
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

const base = () => (API_BASE_URL != null && API_BASE_URL !== '' ? API_BASE_URL.replace(/\/$/, '') : '')

export async function get_fields() {
  const res = await fetch(`${base()}/api/fields`, { headers: get_headers() })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message || `Failed to load fields (${res.status})`)
  return data.fields || []
}

export async function create_field(payload) {
  const res = await fetch(`${base()}/api/fields`, {
    method: 'POST',
    headers: get_headers(),
    body: JSON.stringify(payload)
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message || `Failed to create field (${res.status})`)
  return data
}

export async function update_field(id, payload) {
  const res = await fetch(`${base()}/api/fields/${id}`, {
    method: 'PUT',
    headers: get_headers(),
    body: JSON.stringify(payload)
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message || `Failed to update field (${res.status})`)
  return data
}

export async function delete_field(id) {
  const res = await fetch(`${base()}/api/fields/${id}`, {
    method: 'DELETE',
    headers: get_headers()
  })
  if (res.status === 204) return
  const data = await res.json().catch(() => ({}))
  throw new Error(data.message || `Failed to delete field (${res.status})`)
}

export async function link_diagnosis_to_field(diagnosis_id, field_id) {
  const url = `${base()}/api/history/${encodeURIComponent(diagnosis_id)}/field`
  const res = await fetch(url, {
    method: 'PATCH',
    headers: get_headers(),
    body: JSON.stringify({ field_id: field_id || null })
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message || `Failed to link to field (${res.status})`)
  return data
}

export async function save_and_link_diagnosis_to_field(result, field_id) {
  const url = `${base()}/api/diagnose/save-and-link`
  const res = await fetch(url, {
    method: 'POST',
    headers: get_headers(),
    body: JSON.stringify({
      diagnosis: result.diagnosis,
      confidence: result.confidence,
      alternatives: result.alternatives,
      recommendations: result.recommendations,
      processing_ms: result.processing_ms,
      field_id
    })
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message || `Failed to save and link (${res.status})`)
  return data
}

const fieldService = {
  get_fields,
  create_field,
  update_field,
  delete_field,
  link_diagnosis_to_field
}

export default fieldService
