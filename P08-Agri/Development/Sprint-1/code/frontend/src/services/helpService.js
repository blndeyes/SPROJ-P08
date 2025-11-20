import axios from 'axios'
import { getToken } from './authService'

const from_env =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  process.env.REACT_APP_API_BASE_URL

const is_localhost = typeof window !== 'undefined' && window.location.hostname === 'localhost'
const is_vercel = typeof window !== 'undefined' && /\.vercel\.app$/.test(window.location.hostname)
const api_base =
  from_env || (is_localhost ? 'http://localhost:5000' : (is_vercel ? '' : 'https://sproj-p08-2.onrender.com'))

const help_api = axios.create({
  baseURL: api_base + '/api/help',
  headers: { 'Content-Type': 'application/json' }
})

export async function send_complaint(payload) {
  const token = getToken()
  if (!token) {
    throw new Error('You must be logged in to send a help request')
  }

  const subject = payload && payload.subject ? String(payload.subject).trim() : ''
  const message = payload && payload.message ? String(payload.message).trim() : ''

  if (!subject || !message) {
    throw new Error('Subject and message are required')
  }

  try {
    const response = await help_api.post(
      '/complaints',
      { subject, message },
      { headers: { Authorization: 'Bearer ' + token } }
    )
    return response.data
  } catch (error) {
    const message_text =
      (error &&
        error.response &&
        (error.response.data && (error.response.data.message || error.response.data.error))) ||
      'Failed to send help request'
    throw new Error(message_text)
  }
}
