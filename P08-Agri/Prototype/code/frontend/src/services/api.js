const from_env =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) ||
  process.env.REACT_APP_API_URL;

const api_base =
  from_env ||
  (window.location.hostname === 'localhost'
    ? 'http://localhost:5000'
    : 'https://<your-backend>.onrender.com');

export async function register_user(payload) {
  const res = await fetch(`${api_base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  let data = null;
  try {
    data = await res.json();
  } catch {}
  if (!res.ok) {
    const message = (data && (data.message || data.error)) || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}
