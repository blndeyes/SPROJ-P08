/**
 * Admin dashboard API: complaints, email blast, password reset, inspection/SLA stats.
 */
import { API_BASE_URL } from './baseUrl'
import { getToken } from './authService'

function get_auth_headers() {
  const token = getToken()
  if (!token) {
    throw new Error('You must be logged in to access admin features')
  }
  return {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + token
  }
}

export async function fetch_complaints({ status = '', limit = 50, skip = 0 } = {}) {
  const params = new URLSearchParams()
  if (status) {
    params.set('status', status)
  }
  params.set('limit', String(limit))
  params.set('skip', String(skip))

  const res = await fetch(`${API_BASE_URL}/api/admin/complaints?${params.toString()}`, {
    method: 'GET',
    headers: get_auth_headers()
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

export async function update_complaint_status(id, status) {
  const res = await fetch(`${API_BASE_URL}/api/admin/complaints/${id}`, {
    method: 'PATCH',
    headers: get_auth_headers(),
    body: JSON.stringify({ status })
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

export async function send_admin_email({ subject, message, mode, recipients }) {
  const res = await fetch(`${API_BASE_URL}/api/admin/email`, {
    method: 'POST',
    headers: get_auth_headers(),
    body: JSON.stringify({ subject, message, mode, recipients })
  })

  let data = null
  try {
    data = await res.json()
  } catch {}

  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || `Request failed (${res.status})`
    throw new Error(msg)
  }

  return data
}

export async function respond_to_complaint(id, response) {
  const res = await fetch(`${API_BASE_URL}/api/admin/complaints/${id}/respond`, {
    method: 'POST',
    headers: get_auth_headers(),
    body: JSON.stringify({ response })
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

export async function fetch_inspection_statistics({ startDate, endDate } = {}) {
  const params = new URLSearchParams()
  if (startDate) {
    params.set('startDate', startDate)
  }
  if (endDate) {
    params.set('endDate', endDate)
  }

  const res = await fetch(`${API_BASE_URL}/api/admin/statistics?${params.toString()}`, {
    method: 'GET',
    headers: get_auth_headers()
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

export async function fetch_sla_statistics({ startDate, endDate } = {}) {
  const params = new URLSearchParams()
  if (startDate) {
    params.set('startDate', startDate)
  }
  if (endDate) {
    params.set('endDate', endDate)
  }

  const res = await fetch(`${API_BASE_URL}/api/admin/sla?${params.toString()}`, {
    method: 'GET',
    headers: get_auth_headers()
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

export async function reset_farmer_password({ email, newPassword }) {
  const res = await fetch(`${API_BASE_URL}/api/admin/users/reset-password`, {
    method: 'POST',
    headers: get_auth_headers(),
    body: JSON.stringify({ email, newPassword })
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

const admin_service = {
  fetch_complaints,
  update_complaint_status,
  send_admin_email,
  respond_to_complaint,
  reset_farmer_password,
  fetch_inspection_statistics,
  fetch_sla_statistics
}

export default admin_service
