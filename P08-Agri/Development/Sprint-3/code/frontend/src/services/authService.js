import axios from 'axios'
import { API_BASE_URL } from './baseUrl'

const api = axios.create({
  baseURL: `${API_BASE_URL}/api/auth`,
  headers: { 'Content-Type': 'application/json' }
})

export const register = async (user_data) => {
  try {
    const response = await api.post('/register', user_data)
    if (response.data?.token) {
      localStorage.setItem('token', response.data.token)
      localStorage.setItem('user', JSON.stringify(response.data.user))
    }
    return response.data
  } catch (error) {
    const message =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      'Registration failed'
    throw new Error(message)
  }
}

export const registerWithOtp = async (user_data) => {
  try {
    const response = await api.post('/register-otp', user_data)
    if (response.data?.debug_otp && process.env.NODE_ENV !== 'production') {
      console.log('[Auth] Debug OTP (dev only):', response.data.debug_otp)
    }
    return response.data
  } catch (error) {
    const message =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      'Registration failed'
    throw new Error(message)
  }
}

export const verifyOtp = async ({ email, otp }) => {
  try {
    const response = await api.post('/verify-otp', { email, otp })
    if (response.data?.token) {
      localStorage.setItem('token', response.data.token)
      localStorage.setItem('user', JSON.stringify(response.data.user))
    }
    return response.data
  } catch (error) {
    const message =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      'OTP verification failed'
    throw new Error(message)
  }
}

export const googleSignIn = async (idToken, role) => {
  try {
    const payload = role != null ? { id_token: idToken, role } : { id_token: idToken }
    const response = await api.post('/google', payload)
    if (response.data?.token) {
      localStorage.setItem('token', response.data.token)
      localStorage.setItem('user', JSON.stringify(response.data.user))
    }
    return response.data
  } catch (error) {
    const message =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      'Google sign-in failed'
    throw new Error(message)
  }
}

export const login = async (credentials) => {
  try {
    const response = await api.post('/login', credentials)
    if (response.data?.token) {
      localStorage.setItem('token', response.data.token)
      localStorage.setItem('user', JSON.stringify(response.data.user))
    }
    return response.data
  } catch (error) {
    let message =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      'Login failed'

    if (error?.response?.status === 429) {
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
        message = `${message} You can try again in approximately ${time_part}.`
      }
    }

    throw new Error(message)
  }
}

export const getToken = () => localStorage.getItem('token')

export const changePassword = async ({ oldPassword, newPassword }) => {
  const token = getToken()
  if (!token) {
    throw new Error('You must be logged in to change your password')
  }

  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/account/change-password`,
      { oldPassword, newPassword },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        }
      }
    )
    return response.data
  } catch (error) {
    let message =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      'Failed to change password'

    if (error?.response?.status === 429) {
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
        message = `${message} You can try again in approximately ${time_part}.`
      }
    }

    throw new Error(message)
  }
}

export const logout = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
}

export const getCurrentUser = () => {
  const userStr = localStorage.getItem('user')
  return userStr ? JSON.parse(userStr) : null
}

export const isAuthenticated = () => !!getToken()

const auth_service = {
  register,
  registerWithOtp,
  verifyOtp,
  login,
  googleSignIn,
  changePassword,
  logout,
  getCurrentUser,
  getToken,
  isAuthenticated
}

export default auth_service
