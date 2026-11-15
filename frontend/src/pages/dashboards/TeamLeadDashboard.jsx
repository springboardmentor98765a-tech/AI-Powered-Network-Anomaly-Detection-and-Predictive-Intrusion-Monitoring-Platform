/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TeamLeadDashboard — Team Operations Overview
   - StatCards computed from the teams user LEADS:
     Teams I lead, Total members, Active members, Inactive members.
   - Calls GET /teams/{id} for each led team (max 6) in parallel.
   - Glass cards per led team with roster avatars, names, status badges.
   - "Teams I belong to" list (where user is member but not lead).
   - Placeholders for Team Alert Workload & Open Incidents by Analyst.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  UsersRound,
  UserCheck,
  UserX,
  Shield,
  ExternalLink,
  RotateCw,
  Bell,
  AlertTriangle,
} from 'lucide-react'

import { useAuth } from '../../context/AuthContext'
import { useFetch } from '../../hooks/useFetch'
import { apiGetTeams, apiGetTeam } from '../../api/teams'

import PageHeader from '../../components/ui/PageHeader'
import GlassCard from '../../components/ui/GlassCard'
import StatCard from '../../components/ui/StatCard'
import Badge from '../../components/ui/Badge'
import Avatar from '../../components/ui/Avatar'
import Skeleton from '../../components/ui/Skeleton'
import EmptyState from '../../components/ui/EmptyState'
import PlaceholderWidget from '../../components/ui/PlaceholderWidget'

export default function TeamLeadDashboard() {
  const { user } = useAuth()

  // 1. Fetch user's teams (led or member)
  const {
    data: allUserTeams,
    loading: teamsLoading,
    error: teamsError,
    reload: reloadTeams,
  } = useFetch(() => apiGetTeams(0, 50), [])

  // Partition into led teams vs member-only teams
  const { ledTeamsBasic, memberOnlyTeams } = useMemo(() => {
    if (!allUserTeams || !user) return { ledTeamsBasic: [], memberOnlyTeams: [] }

    const led = []
    const member = []

    allUserTeams.forEach((t) => {
      if (t.lead?.id === user.id) {
        led.push(t)
      } else {
        member.push(t)
      }
    })

    return { ledTeamsBasic: led, memberOnlyTeams: member }
  }, [allUserTeams, user])

  // 2. Fetch full team details (rosters) for led teams in parallel (capped at max 6 teams)
  const {
    data: ledTeamDetails,
    loading: detailsLoading,
    error: detailsError,
    reload: reloadDetails,
  } = useFetch(async () => {
    if (!ledTeamsBasic || ledTeamsBasic.length === 0) return []
    const targetTeams = ledTeamsBasic.slice(0, 6)
    // Parallel fetch for each led team
    return Promise.all(targetTeams.map((t) => apiGetTeam(t.id)))
  }, [ledTeamsBasic])

  // Compute aggregate membership statistics across led teams
  const stats = useMemo(() => {
    if (!ledTeamDetails) {
      return { totalMembers: 0, activeMembers: 0, inactiveMembers: 0 }
    }

    // Collect unique users across led teams
    const uniqueUsers = new Map()
    ledTeamDetails.forEach((teamDetail) => {
      if (Array.isArray(teamDetail?.members)) {
        teamDetail.members.forEach((m) => {
          if (m?.user && !uniqueUsers.has(m.user.id)) {
            uniqueUsers.set(m.user.id, m.user)
          }
        })
      }
    })

    let active = 0
    let inactive = 0
    uniqueUsers.forEach((u) => {
      if (u.status === 'active') active++
      else inactive++
    })

    return {
      totalMembers: uniqueUsers.size,
      activeMembers: active,
      inactiveMembers: inactive,
    }
  }, [ledTeamDetails])

  const isLoading = teamsLoading || detailsLoading
  const combinedError = teamsError || detailsError

  return (
    <div>
      <PageHeader
        title="Team Operations Lead"
        subtitle={`Command dashboard for ${user?.name || user?.username}`}
      />

      {/* Row of StatCards for led teams */}
      <div className="stat-grid">
        <StatCard
          icon={Shield}
          label="Teams I Lead"
          value={ledTeamsBasic.length}
          hint="Assigned lead operations"
          loading={teamsLoading}
        />
        <StatCard
          icon={UsersRound}
          label="Total Assigned Members"
          value={stats.totalMembers}
          hint="Distinct personnel across led teams"
          loading={isLoading}
        />
        <StatCard
          icon={UserCheck}
          label="Active Personnel"
          value={stats.activeMembers}
          hint="Operational and active"
          loading={isLoading}
        />
        <StatCard
          icon={UserX}
          label="Inactive Personnel"
          value={stats.inactiveMembers}
          hint="Deactivated accounts"
          loading={isLoading}
        />
      </div>

      {/* Led Teams Rosters */}
      <div style={{ marginBottom: '28px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={18} style={{ color: 'var(--accent)' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
              Teams You Lead
            </h3>
          </div>
          {combinedError && (
            <button
              type="button"
              className="btn-glass btn-sm"
              onClick={() => {
                reloadTeams()
                reloadDetails()
              }}
              title="Retry"
            >
              <RotateCw size={12} />
              <span>Retry</span>
            </button>
          )}
        </div>

        {isLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            <Skeleton height="180px" />
            <Skeleton height="180px" />
          </div>
        ) : combinedError ? (
          <GlassCard level={1} style={{ padding: '24px', textAlign: 'center' }}>
            <p style={{ color: 'var(--danger)', fontSize: '13px', marginBottom: '12px' }}>{combinedError}</p>
            <button
              type="button"
              className="btn-glass btn-sm"
              onClick={() => {
                reloadTeams()
                reloadDetails()
              }}
            >
              Retry
            </button>
          </GlassCard>
        ) : !ledTeamDetails || ledTeamDetails.length === 0 ? (
          <EmptyState
            icon={Shield}
            title="No led teams assigned"
            description="You are not designated as lead for any security response team. An administrator can assign you as lead."
          />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: '18px',
            }}
          >
            {ledTeamDetails.map((team) => (
              <GlassCard key={team.id} level={2} style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <h4 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                      {team.team_name}
                    </h4>
                    {team.description && (
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {team.description}
                      </p>
                    )}
                  </div>
                  <Link
                    to={`/teams?team=${team.id}`}
                    className="btn-glass btn-sm"
                    style={{ fontSize: '12px' }}
                  >
                    <span>Manage</span>
                    <ExternalLink size={12} />
                  </Link>
                </div>

                <div style={{ marginTop: 'auto', paddingTop: '14px', borderTop: '1px solid var(--glass-border)' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                    Roster ({team.members?.length || 0})
                  </div>

                  {!team.members || team.members.length === 0 ? (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No analysts assigned to this team yet.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {team.members.map((m) => {
                        const memberUser = m.user
                        const isInactive = memberUser?.status === 'inactive'
                        return (
                          <div
                            key={memberUser.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '6px 8px',
                              borderRadius: 'var(--radius-sm)',
                              background: 'var(--glass-1)',
                              opacity: isInactive ? 0.55 : 1,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Avatar name={memberUser.name || memberUser.username} size={24} />
                              <span style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 500 }}>
                                {memberUser.name || memberUser.username}
                              </span>
                            </div>
                            <Badge
                              variant={memberUser.status === 'active' ? 'success' : 'danger'}
                              size="sm"
                            >
                              {memberUser.status}
                            </Badge>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>

      {/* Teams I Belong To (Member but not lead) */}
      {memberOnlyTeams.length > 0 && (
        <div style={{ marginBottom: '28px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)', marginBottom: '14px' }}>
            Teams I Belong To (Contributing Member)
          </h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '14px',
            }}
          >
            {memberOnlyTeams.map((team) => (
              <GlassCard key={team.id} level={1} style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>
                      {team.team_name}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Lead: {team.lead ? team.lead.name || team.lead.username : 'Unassigned'}
                    </div>
                  </div>
                  <Link to={`/teams?team=${team.id}`} className="btn-glass btn-sm">
                    View
                  </Link>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      )}

      {/* Placeholders for Team Lead Modules */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '16px',
        }}
      >
        <PlaceholderWidget
          icon={Bell}
          title="Team Alert Workload Distribution"
          description="Real-time alert assignment load and analyst shift distribution matrix"
          moduleNumber={5}
        />
        <PlaceholderWidget
          icon={AlertTriangle}
          title="Open Incidents by Analyst"
          description="Active security escalation queues, SLAs, and mean-time-to-contain metrics"
          moduleNumber={5}
        />
      </div>
    </div>
  )
}

