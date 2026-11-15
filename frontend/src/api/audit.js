/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Audit API Service
   Admin only, read-only, newest first.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
import client from './client'

/**
 * GET /audit-logs
 * Params: user_id, action, status, from_date, to_date, skip, limit
 * Dates should be sent as UTC ISO strings.
 */
export async function apiGetAuditLogs(params = {}) {
  const cleanParams = {}
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      cleanParams[k] = v
    }
  })
  const res = await client.get('/audit-logs', { params: cleanParams })
  return res.data
}

