const read_env = (key) => {
  if (typeof window !== 'undefined' && window.__ENV__ && window.__ENV__[key]) {
    return window.__ENV__[key]
  }
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key]
  }
  return ''
}

const env_base =
  read_env('VITE_API_BASE_URL') ||
  read_env('VITE_API_URL') ||
  read_env('REACT_APP_API_BASE_URL') ||
  read_env('REACT_APP_API_URL')

const is_browser = typeof window !== 'undefined'
const hostname = is_browser ? window.location.hostname : ''
const is_localhost = hostname === 'localhost' || hostname === '127.0.0.1'
const is_vercel = /\.vercel\.app$/.test(hostname)

const default_base = is_localhost
  ? 'http://localhost:5001'
  : (is_vercel ? '' : 'https://sproj-p08-qnpt.onrender.com')

export const API_BASE_URL = env_base || default_base
