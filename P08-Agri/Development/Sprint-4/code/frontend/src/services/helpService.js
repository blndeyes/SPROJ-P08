/**
 * Submit help/complaint tickets as a logged-in user.
 */
import axios from 'axios'
import { getToken } from './authService'
import { API_BASE_URL } from './baseUrl'

const help_api = axios.create({
  baseURL: `${API_BASE_URL}/api/help`,
  headers: { 'Content-Type': 'application/json' }
})

export async function send_complaint(payload) {
  const token = getToken()
  if (!token) {
    throw new Error('You must be logged in to send a help request')
  }

  const subject = payload?.subject ? String(payload.subject).trim() : ''
  const message = payload?.message ? String(payload.message).trim() : ''

  if (!subject) {
    throw new Error('Subject is required')
  }
  if (!message) {
    throw new Error('Message is required')
  }

  try {
    const response = await help_api.post(
      '/complaints',
      { subject, message },
      { headers: { Authorization: 'Bearer ' + token } }
    )
    return response.data
  } catch (error) {
    const status = error?.response?.status
    let message_text =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      'Failed to send help request'

    if (status === 429) {
      const raw_seconds = Number(error?.response?.data?.retryAfterSeconds)
      if (!Number.isNaN(raw_seconds) && raw_seconds > 0) {
        const minutes = Math.floor(raw_seconds / 60)
        const seconds = raw_seconds % 60
        let time_part = ''
        if (minutes > 0) {
          time_part += `${minutes} minute${minutes === 1 ? '' : 's'}`
        }
        if (seconds > 0) {
          if (time_part) {
            time_part += ' and '
          }
          time_part += `${seconds} second${seconds === 1 ? '' : 's'}`
        }
        if (!time_part) {
          time_part = `${raw_seconds} seconds`
        }
        message_text = `${message_text} You can try again in approximately ${time_part}.`
      }
    }

    throw new Error(message_text)
  }
}

const help_service = { send_complaint }

export default help_service
