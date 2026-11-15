/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Auth API wrappers — thin functions, return response data.
   No URL strings anywhere except this file.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
import client from './client'

/**
 * POST /auth/login
 * The backend expects application/x-www-form-urlencoded
 * with field name "username" (accepts email OR username).
 * Returns { access_token }
 */
export async function apiLogin(identifier, password) {
  const body = new URLSearchParams()
  body.append('username', identifier) // backend accepts email OR username
  body.append('password', password)
  const res = await client.post('/auth/login', body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  return res.data
}

/**
 * POST /auth/logout  → 204
 * Errors are intentionally ignored by AuthContext (we always clear local state).
 */
export async function apiLogout() {
  await client.post('/auth/logout')
}

/**
 * POST /auth/change-password → 204
 * Throws on 400 "Old password is incorrect" / "New password must be different".
 */
export async function apiChangePassword(oldPassword, newPassword) {
  await client.post('/auth/change-password', {
    old_password: oldPassword,
    new_password: newPassword,
  })
}

