/**
 * Chooses the API origin: REACT_APP_* or window.__ENV__ override; otherwise dev localhost,
 * Vercel same-origin (proxy), or production api host.
 */
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
const is_vercel = is_browser && /\.vercel\.app$/i.test(hostname)

// Local: hit dev backend. Vercel: use relative URLs so vercel.json proxy sends /api/* to Oracle backend (avoids CORS). Other: hit API directly.
const default_base = is_localhost
  ? 'http://localhost:5001'
  : is_vercel
    ? ''
    : 'https://api.agriqual.xyz'

export const API_BASE_URL = env_base || default_base
