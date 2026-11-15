/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Permission helpers — cosmetic only.
   IMPORTANT: The backend enforces every permission.
   These functions are only used to show/hide UI.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/**
 * Returns true if the given user may manage (edit, add/remove
 * members from) the given team.
 *
 * Rules:
 *   - Admin can manage any team.
 *   - Team lead can manage only the teams they lead.
 *
 * @param {object|null} user  - UserOut from /users/me
 * @param {object|null} team  - TeamOut or TeamDetail from /teams/{id}
 */
export function canManageTeam(user, team) {
  if (!user || !team) return false
  // cosmetic: the backend enforces this
  const role = user.role?.role_name
  if (role === 'admin') return true
  if (role === 'team_lead' && team.lead?.id === user.id) return true
  return false
}

