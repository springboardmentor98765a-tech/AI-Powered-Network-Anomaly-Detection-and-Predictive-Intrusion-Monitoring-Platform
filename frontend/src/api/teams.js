/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Teams API Service
   Admin sees all teams; analysts/leads see teams they belong to or lead.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
import client from './client'

/**
 * GET /teams?skip&limit
 */
export async function apiGetTeams(skip = 0, limit = 100) {
  const res = await client.get('/teams', { params: { skip, limit } })
  return res.data
}

/**
 * GET /teams/{id} -> TeamDetail with members array
 */
export async function apiGetTeam(id) {
  const res = await client.get(`/teams/${id}`)
  return res.data
}

/**
 * POST /teams
 * Admin only.
 */
export async function apiCreateTeam(payload) {
  const res = await client.post('/teams', payload)
  return res.data
}

/**
 * PATCH /teams/{id}
 * Admin or that team's lead.
 */
export async function apiUpdateTeam(id, payload) {
  const res = await client.patch(`/teams/${id}`, payload)
  return res.data
}

/**
 * PATCH /teams/{id}/lead
 * Admin only. Lead must be an active team_lead.
 */
export async function apiUpdateTeamLead(id, leadUserId) {
  const res = await client.patch(`/teams/${id}/lead`, { lead_user_id: leadUserId })
  return res.data
}

/**
 * DELETE /teams/{id}
 * Admin only.
 */
export async function apiDeleteTeam(id) {
  await client.delete(`/teams/${id}`)
}

/**
 * POST /teams/{id}/members
 * Admin or team's lead.
 */
export async function apiAddTeamMember(teamId, userId) {
  const res = await client.post(`/teams/${teamId}/members`, { user_id: userId })
  return res.data
}

/**
 * DELETE /teams/{id}/members/{user_id}
 * Admin or team's lead.
 */
export async function apiRemoveTeamMember(teamId, userId) {
  await client.delete(`/teams/${teamId}/members/${userId}`)
}

