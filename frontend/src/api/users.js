/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Users API Service
   All endpoints return response data directly.
   Usernames and emails can NEVER be changed (no edit route).
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
import client from './client'

/**
 * Fetch a single page of users.
 * Admin only.
 */
export async function apiGetUsers(skip = 0, limit = 100) {
  const res = await client.get('/users', { params: { skip, limit } })
  return res.data
}

/**
 * Pages through GET /users with limit=100 until a page returns
 * fewer than 100 items.
 *
 * NOTE: Capped at 10 pages (max 1000 users) to protect browser memory
 * and avoid unbounded network loops when computing client-side stats.
 */
export async function fetchAllUsers() {
  const MAX_PAGES = 10
  const PAGE_SIZE = 100
  let allUsers = []

  for (let page = 0; page < MAX_PAGES; page++) {
    const batch = await apiGetUsers(page * PAGE_SIZE, PAGE_SIZE)
    if (!Array.isArray(batch) || batch.length === 0) break

    allUsers = allUsers.concat(batch)
    if (batch.length < PAGE_SIZE) break
  }

  return allUsers
}

/**
 * Search active users directory.
 * Used for autocompletion / dropdowns by Admin & Team Lead.
 */
export async function apiGetUsersDirectory(q = '', limit = 50) {
  const res = await client.get('/users/directory', { params: { q, limit } })
  return res.data
}

/**
 * Create a new user account.
 * Admin only.
 */
export async function apiCreateUser(payload) {
  const res = await client.post('/users', payload)
  return res.data
}

/**
 * Update user active/inactive status.
 * Admin only (cannot modify own status).
 */
export async function apiUpdateUserStatus(userId, status) {
  const res = await client.patch(`/users/${userId}/status`, { status })
  return res.data
}

/**
 * Update user role.
 * Admin only (cannot modify own role).
 */
export async function apiUpdateUserRole(userId, roleId) {
  const res = await client.patch(`/users/${userId}/role`, { role_id: roleId })
  return res.data
}

