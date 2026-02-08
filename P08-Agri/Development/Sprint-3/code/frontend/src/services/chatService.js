import axios from 'axios'
import { getToken } from './authService'
import { API_BASE_URL } from './baseUrl'

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: { 'Content-Type': 'application/json' }
})

export async function send_chat_message({ diagnosis, messages, language = 'en' }) {
  const token = getToken()
  if (!token) {
    throw new Error('You must be logged in to use the assistant')
  }

  if (!diagnosis) {
    throw new Error('No diagnosis found to discuss')
  }

  if (!diagnosis.diagnosis) {
    throw new Error('No diagnosis found to discuss')
  }

  try {
    const response = await api.post(
      '/chat',
      { diagnosis, messages, language },
      {
        headers: { Authorization: 'Bearer ' + token }
      }
    )

    const data = response.data || {}
    const text = data.reply || data.message || data.answer || data.text || ''

    if (!text) {
      throw new Error('Assistant returned an empty response')
    }

    return { content: text, raw: data }
  } catch (error) {
    const message =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error.message ||
      'Assistant request failed'
    throw new Error(message)
  }
}

const chat_service = { send_chat_message }

export default chat_service
