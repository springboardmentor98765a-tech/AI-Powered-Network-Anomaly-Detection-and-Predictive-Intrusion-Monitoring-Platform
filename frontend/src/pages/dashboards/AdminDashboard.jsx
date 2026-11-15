/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   AdminDashboard — Command Center
   - Row of 4 StatCards: Total users, Active, Inactive, Total teams
   - "Users by role" MiniBarChart (client-computed)
   - "Failed logins, last 24h" card (GET /audit-logs?status=failure)
   - "Recent activity" feed: latest 8 events with actor names, labels, badges, relative times
   - Quick actions links
   - Future module placeholders
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  UserCheck,
  UserX,
  UsersRound,
  ShieldAlert,
  Activity,
  UserPlus,
  FolderPlus,
  FileText,
  RotateCw,
  Radio,
  Zap,
  Bell,
  ArrowRight,
} from 'lucide-react'

import { useFetch } from '../../hooks/useFetch'
import { fetchAllUsers } from '../../api/users'
import { apiGetTeams } from '../../api/teams'
import { apiGetAuditLogs } from '../../api/audit'
import { AUDIT_ACTION_LABELS } from '../../constants/auditActions'
import { ROLE_LABELS } from '../../constants/roles'
import { timeAgo } from '../../utils/format'

import PageHeader from '../../components/ui/PageHeader'
import GlassCard from '../../components/ui/GlassCard'
import StatCard from '../../components/ui/StatCard'
import MiniBarChart from '../../components/ui/MiniBarChart'
import Badge from '../../components/ui/Badge'
import Skeleton from '../../components/ui/Skeleton'
import EmptyState from '../../components/ui/EmptyState'
import PlaceholderWidget from '../../components/ui/PlaceholderWidget'

export default function AdminDashboard() {
  // 1. Users stats fetcher (pages through users)
  const {
    data: users,
    loading: usersLoading,
    error: usersError,
    reload: reloadUsers,
  } = useFetch(fetchAllUsers, [])

  // 2. Teams fetcher
  const {
    data: teams,
    loading: teamsLoading,
    error: teamsError,
    reload: _reloadTeams,
  } = useFetch(() => apiGetTeams(0, 100), [])

  // 3. Failed logins in last 24h
  const {
    data: failedLogins,
    loading: failedLoading,
    error: failedError,
    reload: reloadFailed,
  } = useFetch(() => {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    return apiGetAuditLogs({
      status: 'failure',
      from_date: since24h,
      limit: 200,
    })
  }, [])

  // 4. Recent audit activity (latest 8 items)
  const {
    data: recentLogs,
    loading: logsLoading,
    error: logsError,
    reload: reloadLogs,
  } = useFetch(() => apiGetAuditLogs({ limit: 8 }), [])

  // Compute stats from user list
  const userStats = useMemo(() => {
    if (!users) return { total: 0, active: 0, inactive: 0, byRole: [] }
    let active = 0
    let inactive = 0
    const roleCounts = { admin: 0, security_analyst: 0, team_lead: 0 }

    users.forEach((u) => {
      if (u.status === 'active') active++
      else inactive++

      const roleKey = u.role?.role_name
      if (roleKey && roleCounts[roleKey] !== undefined) {
        roleCounts[roleKey]++
      }
    })

    const byRole = [
      { label: ROLE_LABELS.admin, value: roleCounts.admin },
      { label: ROLE_LABELS.security_analyst, value: roleCounts.security_analyst },
      { label: ROLE_LABELS.team_lead, value: roleCounts.team_lead },
    ]

    return { total: users.length, active, inactive, byRole }
  }, [users])

  // Lookup map to resolve actor_user_id to user name
  const userMap = useMemo(() => {
    const map = new Map()
    if (users) {
      users.forEach((u) => map.set(u.id, u.name || u.username))
    }
    return map
  }, [users])

  return (
    <div>
      <PageHeader
        title="SOC Command Center"
        subtitle="System administration, team telemetry, and authentication logs"
      />

      {/* Row of 4 StatCards */}
      <div className="stat-grid">
        <StatCard
          icon={Users}
          label="Total Users"
          value={userStats.total}
          hint={usersError ? 'Failed to fetch users' : 'All accounts'}
          loading={usersLoading}
        />
        <StatCard
          icon={UserCheck}
          label="Active Users"
          value={userStats.active}
          hint="Operational status active"
          loading={usersLoading}
        />
        <StatCard
          icon={UserX}
          label="Inactive Users"
          value={userStats.inactive}
          hint="Deactivated accounts"
          loading={usersLoading}
        />
        <StatCard
          icon={UsersRound}
          label="Total Teams"
          value={teams ? teams.length : '—'}
          hint={teamsError ? 'Failed to fetch teams' : 'Active security teams'}
          loading={teamsLoading}
        />
      </div>

      {/* Quick Action Bar */}
      <GlassCard
        level={1}
        style={{
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600 }}>
          <Zap size={16} style={{ color: 'var(--accent)' }} />
          <span>Quick Administrative Actions</span>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Link to="/users" className="btn-glass btn-sm">
            <UserPlus size={14} />
            <span>Manage Users</span>
          </Link>
          <Link to="/teams" className="btn-glass btn-sm">
            <FolderPlus size={14} />
            <span>Manage Teams</span>
          </Link>
          <Link to="/audit-logs" className="btn-glass btn-sm">
            <FileText size={14} />
            <span>View Full Audit Logs</span>
          </Link>
        </div>
      </GlassCard>

      {/* Middle Row: Users by Role & Failed Logins */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '20px',
          marginBottom: '24px',
        }}
      >
        {/* Left: Users by Role */}
        <GlassCard level={2} style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
              Users by Role
            </h3>
            {usersError && (
              <button type="button" onClick={reloadUsers} className="btn-glass btn-sm" title="Retry">
                <RotateCw size={12} />
              </button>
            )}
          </div>

          {usersLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Skeleton height="36px" />
              <Skeleton height="36px" />
              <Skeleton height="36px" />
            </div>
          ) : usersError ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <p style={{ color: 'var(--danger)', fontSize: '13px', marginBottom: '10px' }}>{usersError}</p>
              <button type="button" className="btn-glass btn-sm" onClick={reloadUsers}>Retry</button>
            </div>
          ) : (
            <MiniBarChart data={userStats.byRole} />
          )}
        </GlassCard>

        {/* Right: Failed Logins in Last 24h */}
        <GlassCard level={2} style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={18} style={{ color: 'var(--danger)' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                Failed Logins (Last 24h)
              </h3>
            </div>
            {failedError && (
              <button type="button" onClick={reloadFailed} className="btn-glass btn-sm" title="Retry">
                <RotateCw size={12} />
              </button>
            )}
          </div>

          {failedLoading ? (
            <Skeleton height="64px" />
          ) : failedError ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <p style={{ color: 'var(--danger)', fontSize: '13px', marginBottom: '10px' }}>{failedError}</p>
              <button type="button" className="btn-glass btn-sm" onClick={reloadFailed}>Retry</button>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '38px', fontWeight: 700, color: (failedLogins?.length || 0) > 0 ? 'var(--danger)' : 'var(--success)' }}>
                {failedLogins?.length === 200 ? '200+' : (failedLogins?.length ?? 0)}
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {(failedLogins?.length || 0) === 0
                  ? 'No failed authentication attempts recorded in the past 24 hours.'
                  : 'Failed sign-in attempts detected. Trace details in the audit logs.'}
              </p>
            </div>
          )}
        </GlassCard>
      </div>

      {/* Recent Activity Feed */}
      <GlassCard level={2} style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={18} style={{ color: 'var(--accent)' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
              Recent Security Activity
            </h3>
          </div>
          <Link
            to="/audit-logs"
            style={{ fontSize: '13px', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <span>Audit log history</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        {logsLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Skeleton height="40px" />
            <Skeleton height="40px" />
            <Skeleton height="40px" />
          </div>
        ) : logsError ? (
          <div style={{ textAlign: 'center', padding: '24px' }}>
            <p style={{ color: 'var(--danger)', fontSize: '13px', marginBottom: '10px' }}>{logsError}</p>
            <button type="button" className="btn-glass btn-sm" onClick={reloadLogs}>Retry</button>
          </div>
        ) : !recentLogs || recentLogs.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No activity recorded"
            description="System activity and authentication traces will appear here as events occur."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recentLogs.map((log) => {
              const actorName = log.actor_user_id
                ? userMap.get(log.actor_user_id) || `User #${log.actor_user_id}`
                : 'Anonymous'
              const actionLabel = AUDIT_ACTION_LABELS[log.action] || log.action
              const isSuccess = log.status === 'success'

              return (
                <div
                  key={log.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--glass-1)',
                    border: '1px solid var(--glass-border)',
                    fontSize: '13px',
                    gap: '12px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                      {actorName}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>{actionLabel}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Badge variant={isSuccess ? 'success' : 'danger'} size="sm">
                      {log.status}
                    </Badge>
                    <span className="mono" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                      {timeAgo(log.timestamp)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </GlassCard>

      {/* Placeholders for Later Modules */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '16px',
        }}
      >
        <PlaceholderWidget
          icon={Radio}
          title="Live Traffic Overview"
          description="Real-time packet flow inspection and bandwidth utilization graph"
          moduleNumber={2}
        />
        <PlaceholderWidget
          icon={ShieldAlert}
          title="Active Threats & Risk Score"
          description="Machine learning intrusion risk index and threat classification"
          moduleNumber={4}
        />
        <PlaceholderWidget
          icon={Bell}
          title="Alert Volume & Categorization"
          description="SOC event categorization queue and escalation distribution"
          moduleNumber={5}
        />
      </div>
    </div>
  )
}
