/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Axios instance — the ONLY place that knows the base URL.
   All other API modules import this file.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
import axios from 'axios'

/* ── Token storage (key is the localStorage key) ─── */
const TOKEN_KEY = 'netshield_token'

export const tokenStore = {
  get:   ()      => localStorage.getItem(TOKEN_KEY),
  set:   (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: ()      => localStorage.removeItem(TOKEN_KEY),
}

/**
 * Extract a readable message from any Axios error.
 * Handles both string detail and 422 array detail formats.
 */
export function errorMessage(err) {
  const data = err?.response?.data
  if (!data) return err?.message ?? 'An unexpected error occurred'
  if (typeof data.detail === 'string') return data.detail
  if (Array.isArray(data.detail))
    return data.detail.map(e => e.msg ?? e.message ?? JSON.stringify(e)).join(', ')
  return 'An unexpected error occurred'
}

/* ── Axios instance ──────────────────────────────── */
const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
})

/* Attach JWT to every request */
client.interceptors.request.use((config) => {
  const token = tokenStore.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

/* Global 401 handler: wipe token and redirect to /login */
client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      tokenStore.clear()
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export default client
