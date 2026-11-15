/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   AuditLogs Page — System Security Traces & Audit Logs
   - Admin only, strictly read-only (no edit, delete, or export)
   - Actor mapping: fetchAllUsers() once to resolve names; null = Anonymous
   - Filters bar (glass-2): user, action, status, datetime-local (converted to UTC ISO),
     quick range chips, "Failures only" toggle, and Reset button
   - Server-side pagination (limit=50, skip=(page-1)*50, hasNext=(len===50))
   - Plain text rendering for details (safeguard against injection)
   - Failure rows highlighted with faint red border
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
import { useState, useEffect } from 'react'
import { RotateCw, XCircle } from 'lucide-react'

import { useFetch } from '../hooks/useFetch'
import { fetchAllUsers } from '../api/users'
import { apiGetAuditLogs } from '../api/audit'
import { AUDIT_ACTIONS, AUDIT_ACTION_LABELS } from '../constants/auditActions'
import { formatDateTime } from '../utils/format'

import PageHeader from '../components/ui/PageHeader'
import GlassCard from '../components/ui/GlassCard'
import Badge from '../components/ui/Badge'
import Avatar from '../components/ui/Avatar'
import Skeleton from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'
import Pagination from '../components/ui/Pagination'

const PAGE_SIZE = 50

/** Helper to format a Date into local YYYY-MM-DDTHH:mm for datetime-local inputs */
function toLocalDatetimeInput(date) {
  if (!date) return ''
  const d = new Date(date)
  const offset = d.getTimezoneOffset()
  const local = new Date(d.getTime() - offset * 60000)
  return local.toISOString().slice(0, 16)
}

export default function AuditLogs() {
  // 1. Users map for actor resolution
  const [usersMap, setUsersMap]         = useState(new Map())
  const [usersList, setUsersList]       = useState([])
  const [loadingUsers, setLoadingUsers] = useState(true)

  // 2. Filter states
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedAction, setSelectedAction] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('all') // 'all' | 'success' | 'failure'
  const [fromDate, setFromDate]             = useState('')
  const [toDate, setToDate]                 = useState('')
  const [activeChip, setActiveChip]         = useState('all_time') // '1h' | '24h' | '7d' | 'all_time' | 'custom'

  // 3. Server Pagination
  const [page, setPage] = useState(1)

  // Load users directory once on mount to resolve actor IDs
  useEffect(() => {
    let isMounted = true
    fetchAllUsers()
      .then((users) => {
        if (!isMounted) return
        const map = new Map()
        users.forEach((u) => {
          map.set(u.id, {
            name: u.name,
            username: u.username,
          })
        })
        setUsersMap(map)
        setUsersList(users)
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setLoadingUsers(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  // 4. Fetch audit logs based on current filters and page using useFetch hook
  const {
    data: logsData,
    loading: loadingLogs,
    error: fetchError,
    reload: fetchLogs,
  } = useFetch(() => {
    const params = {
      skip: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
    }

    if (selectedUserId) {
      params.user_id = Number(selectedUserId)
    }
    if (selectedAction) {
      params.action = selectedAction
    }
    if (selectedStatus !== 'all') {
      params.status = selectedStatus
    }

    // Convert local datetime to UTC ISO strings
    if (fromDate) {
      params.from_date = new Date(fromDate).toISOString()
    }
    if (toDate) {
      params.to_date = new Date(toDate).toISOString()
    }

    return apiGetAuditLogs(params)
  }, [page, selectedUserId, selectedAction, selectedStatus, fromDate, toDate])

  const logs = Array.isArray(logsData) ? logsData : []

  // Reset to page 1 whenever any filter changes
  const handleFilterChange = (setter, val) => {
    setter(val)
    setPage(1)
  }

  // Quick range chip handler
  const handleQuickRange = (rangeKey) => {
    setActiveChip(rangeKey)
    setPage(1)

    const now = new Date()

    if (rangeKey === '1h') {
      const past = new Date(now.getTime() - 60 * 60 * 1000)
      setFromDate(toLocalDatetimeInput(past))
      setToDate(toLocalDatetimeInput(now))
    } else if (rangeKey === '24h') {
      const past = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      setFromDate(toLocalDatetimeInput(past))
      setToDate(toLocalDatetimeInput(now))
    } else if (rangeKey === '7d') {
      const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      setFromDate(toLocalDatetimeInput(past))
      setToDate(toLocalDatetimeInput(now))
    } else {
      // All time
      setFromDate('')
      setToDate('')
    }
  }

  // "Failures only" toggle
  const handleFailuresToggle = (e) => {
    const isChecked = e.target.checked
    setSelectedStatus(isChecked ? 'failure' : 'all')
    setPage(1)
  }

  // Reset all filters
  const handleResetFilters = () => {
    setSelectedUserId('')
    setSelectedAction('')
    setSelectedStatus('all')
    setFromDate('')
    setToDate('')
    setActiveChip('all_time')
    setPage(1)
  }

  const isFiltersActive =
    selectedUserId !== '' ||
    selectedAction !== '' ||
    selectedStatus !== 'all' ||
    fromDate !== '' ||
    toDate !== ''

  const hasNext = logs.length === PAGE_SIZE

  return (
    <div>
      <PageHeader
        title="Security Audit Logs"
        subtitle="Immutable administrative action history and authentication traces"
        actions={
          <button
            type="button"
            className="btn-glass"
            onClick={fetchLogs}
            disabled={loadingLogs}
          >
            <RotateCw size={14} className={loadingLogs ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        }
      />

      {/* Filters Bar (Glass-2) */}
      <GlassCard level={2} style={{ padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Top Row: User, Action, Status selects */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '14px',
            }}
          >
            {/* User Select */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                Actor
              </label>
              <select
                className="input-glass"
                style={{ padding: '8px 12px', fontSize: '13px', cursor: 'pointer' }}
                value={selectedUserId}
                onChange={(e) => handleFilterChange(setSelectedUserId, e.target.value)}
                disabled={loadingUsers}
              >
                <option value="" style={{ background: '#12161a', color: '#fff' }}>
                  All Users & Anonymous
                </option>
                {usersList.map((u) => (
                  <option key={u.id} value={u.id} style={{ background: '#12161a', color: '#fff' }}>
                    {u.name ? `${u.name} (@${u.username})` : `@${u.username}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Select */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                Action Type
              </label>
              <select
                className="input-glass"
                style={{ padding: '8px 12px', fontSize: '13px', cursor: 'pointer' }}
                value={selectedAction}
                onChange={(e) => handleFilterChange(setSelectedAction, e.target.value)}
              >
                <option value="" style={{ background: '#12161a', color: '#fff' }}>
                  All Actions
                </option>
                {Object.entries(AUDIT_ACTIONS).map(([key, actionValue]) => (
                  <option key={key} value={actionValue} style={{ background: '#12161a', color: '#fff' }}>
                    {AUDIT_ACTION_LABELS[actionValue] || actionValue}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Select */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                Result Status
              </label>
              <select
                className="input-glass"
                style={{ padding: '8px 12px', fontSize: '13px', cursor: 'pointer' }}
                value={selectedStatus}
                onChange={(e) => handleFilterChange(setSelectedStatus, e.target.value)}
              >
                <option value="all" style={{ background: '#12161a', color: '#fff' }}>All Outcomes</option>
                <option value="success" style={{ background: '#12161a', color: '#fff' }}>Success Only</option>
                <option value="failure" style={{ background: '#12161a', color: '#fff' }}>Failure Only</option>
              </select>
            </div>

            {/* From Datetime */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                From Date
              </label>
              <input
                type="datetime-local"
                className="input-glass"
                style={{ padding: '8px 12px', fontSize: '12px' }}
                value={fromDate}
                onChange={(e) => {
                  setActiveChip('custom')
                  handleFilterChange(setFromDate, e.target.value)
                }}
              />
            </div>

            {/* To Datetime */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                To Date
              </label>
              <input
                type="datetime-local"
                className="input-glass"
                style={{ padding: '8px 12px', fontSize: '12px' }}
                value={toDate}
                onChange={(e) => {
                  setActiveChip('custom')
                  handleFilterChange(setToDate, e.target.value)
                }}
              />
            </div>
          </div>

          {/* Bottom Row: Quick Range Chips, Failures Only Toggle, Reset */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              paddingTop: '12px',
              borderTop: '1px solid var(--glass-border)',
            }}
          >
            {/* Quick Range Chips */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
                Range:
              </span>
              {[
                { key: '1h', label: 'Last hour' },
                { key: '24h', label: '24 hours' },
                { key: '7d', label: '7 days' },
                { key: 'all_time', label: 'All time' },
              ].map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className={activeChip === chip.key ? 'btn-primary btn-sm' : 'btn-glass btn-sm'}
                  style={{ fontSize: '12px', padding: '4px 10px' }}
                  onClick={() => handleQuickRange(chip.key)}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Right: Failures Only Checkbox & Reset */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: selectedStatus === 'failure' ? 'var(--danger)' : 'var(--text)',
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedStatus === 'failure'}
                  onChange={handleFailuresToggle}
                  style={{ accentColor: 'var(--danger)', cursor: 'pointer' }}
                />
                <span>Failures only</span>
              </label>

              {isFiltersActive && (
                <button
                  type="button"
                  className="btn-glass btn-sm"
                  onClick={handleResetFilters}
                  style={{ fontSize: '12px' }}
                >
                  Reset filters
                </button>
              )}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Main Table / States */}
      {loadingLogs ? (
        <div className="table-container" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Skeleton height="36px" />
            <Skeleton height="42px" />
            <Skeleton height="42px" />
            <Skeleton height="42px" />
            <Skeleton height="42px" />
          </div>
        </div>
      ) : fetchError ? (
        <div className="table-container" style={{ padding: '48px', textAlign: 'center' }}>
          <p style={{ color: 'var(--danger)', fontSize: '14px', marginBottom: '14px' }}>
            {fetchError}
          </p>
          <button type="button" className="btn-glass" onClick={fetchLogs}>
            <RotateCw size={14} />
            <span>Retry Loading Logs</span>
          </button>
        </div>
      ) : logs.length === 0 ? (
        <EmptyState
          icon={XCircle}
          title="No events match these filters"
          description="Try broadening your time range or clearing the active user and action filters."
          action={
            isFiltersActive && (
              <button type="button" className="btn-glass btn-sm" onClick={handleResetFilters}>
                Clear filters
              </button>
            )
          }
        />
      ) : (
        <div className="table-container">
          <table className="glass-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Target</th>
                <th>Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const isFailure = log.status === 'failure'
                const actionLabel = AUDIT_ACTION_LABELS[log.action] || log.action

                // Resolve actor name from map
                const actorInfo = log.actor_user_id ? usersMap.get(log.actor_user_id) : null
                const actorName = actorInfo
                  ? actorInfo.name || actorInfo.username
                  : log.actor_user_id
                  ? `User #${log.actor_user_id}`
                  : 'Anonymous'

                // Target formatting
                const targetText =
                  log.target_type && log.target_id
                    ? `${log.target_type} #${log.target_id}`
                    : log.target_type || (log.target_id ? `#${log.target_id}` : '—')

                // Details string representation (plain text only)
                let detailText = '—'
                if (log.details !== null && log.details !== undefined) {
                  detailText =
                    typeof log.details === 'object'
                      ? JSON.stringify(log.details)
                      : String(log.details)
                }

                return (
                  <tr
                    key={log.id}
                    style={{
                      borderLeft: isFailure
                        ? '3px solid rgba(248, 113, 113, 0.7)'
                        : '3px solid transparent',
                    }}
                  >
                    {/* Timestamp */}
                    <td className="mono" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                      {formatDateTime(log.timestamp)}
                    </td>

                    {/* Actor */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Avatar name={actorName} size={24} />
                        <span style={{ fontWeight: 500, color: 'var(--text)' }}>
                          {actorName}
                        </span>
                      </div>
                    </td>

                    {/* Action */}
                    <td>
                      <span style={{ color: 'var(--text)', fontWeight: 500 }}>
                        {actionLabel}
                      </span>
                    </td>

                    {/* Target */}
                    <td className="mono" style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                      {targetText}
                    </td>

                    {/* Status Badge */}
                    <td>
                      <Badge variant={isFailure ? 'danger' : 'success'} size="sm">
                        {log.status}
                      </Badge>
                    </td>

                    {/* Details: Untrusted plain text, truncated with full title tooltip */}
                    <td style={{ maxWidth: '320px' }}>
                      <span
                        className="mono"
                        title={detailText}
                        style={{
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: 'var(--text-muted)',
                          fontSize: '11px',
                        }}
                      >
                        {detailText}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Server-side Pagination */}
          <Pagination
            page={page}
            hasNext={hasNext}
            onChange={(newPage) => setPage(newPage)}
          />
        </div>
      )}
    </div>
  )
}
