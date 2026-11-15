/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   AnalystDashboard — Analyst Workbench (Monitoring-First)
   - Welcome header with analyst name, role, and status badge
   - Main wide monitoring area with intentional module placeholders
   - Right rail with real data: My Teams list and Account Security card
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Radio,
  AlertOctagon,
  Bell,
  AlertTriangle,
  UsersRound,
  ShieldCheck,
  KeyRound,
  ExternalLink,
  RotateCw,
} from 'lucide-react'

import { useAuth } from '../../context/AuthContext'
import { useFetch } from '../../hooks/useFetch'
import { apiGetTeams } from '../../api/teams'
import { ROLE_LABELS, ROLE_BADGE_VARIANT } from '../../constants/roles'

import PageHeader from '../../components/ui/PageHeader'
import GlassCard from '../../components/ui/GlassCard'
import Badge from '../../components/ui/Badge'
import Skeleton from '../../components/ui/Skeleton'
import EmptyState from '../../components/ui/EmptyState'
import PlaceholderWidget from '../../components/ui/PlaceholderWidget'
import ChangePasswordModal from '../../components/ChangePasswordModal'

export default function AnalystDashboard() {
  const { user } = useAuth()
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)

  // Fetch teams for this analyst (backend only returns teams they lead or belong to)
  const {
    data: teams,
    loading: teamsLoading,
    error: teamsError,
    reload: reloadTeams,
  } = useFetch(() => apiGetTeams(0, 50), [])

  const roleName = user?.role?.role_name || 'security_analyst'
  const roleLabel = ROLE_LABELS[roleName] || 'Security Analyst'
  const badgeVariant = ROLE_BADGE_VARIANT[roleName] || 'info'

  return (
    <div>
      {/* Welcome Header */}
      <PageHeader
        title={`Welcome back, ${user?.name || user?.username}`}
        subtitle="Analyst Operations Desk — Real-time telemetry and triage queue"
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Badge variant={badgeVariant}>{roleLabel}</Badge>
            <Badge variant={user?.status === 'active' ? 'success' : 'danger'}>
              {user?.status || 'Active'}
            </Badge>
          </div>
        }
      />

      {/* Grid Layout: Wide Monitoring Panel (Left) & Real Data Rail (Right) */}
      <div className="analyst-grid">
        {/* Left: Wide Monitoring Area (Placeholders sized like production panels) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <PlaceholderWidget
            icon={Radio}
            title="Live Network Traffic Stream"
            description="Packet capture probe listening on ingress interfaces — awaiting Module 2 ingestion engine"
            moduleNumber={2}
            minHeight="170px"
          />

          <PlaceholderWidget
            icon={AlertOctagon}
            title="Recent Anomalies & Outliers"
            description="Isolation Forest and unsupervised autoencoders outlier detections"
            moduleNumber={3}
            minHeight="170px"
          />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '20px',
            }}
          >
            <PlaceholderWidget
              icon={Bell}
              title="Alert Queue by Priority"
              description="High, medium, and low severity alerts assigned to your operational group"
              moduleNumber={5}
              minHeight="160px"
            />
            <PlaceholderWidget
              icon={AlertTriangle}
              title="Assigned Incidents"
              description="SOC incident response tracking, escalation status, and containment logs"
              moduleNumber={5}
              minHeight="160px"
            />
          </div>
        </div>

        {/* Right Rail: Real Data */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* My Teams Card */}
          <GlassCard level={2} style={{ padding: '22px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UsersRound size={17} style={{ color: 'var(--accent)' }} />
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                  My Teams
                </h3>
              </div>
              {teamsError && (
                <button type="button" onClick={reloadTeams} className="btn-glass btn-sm" title="Retry">
                  <RotateCw size={12} />
                </button>
              )}
            </div>

            {teamsLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Skeleton height="46px" />
                <Skeleton height="46px" />
              </div>
            ) : teamsError ? (
              <div style={{ textAlign: 'center', padding: '16px' }}>
                <p style={{ color: 'var(--danger)', fontSize: '12px', marginBottom: '8px' }}>{teamsError}</p>
                <button type="button" className="btn-glass btn-sm" onClick={reloadTeams}>Retry</button>
              </div>
            ) : !teams || teams.length === 0 ? (
              <EmptyState
                icon={UsersRound}
                title="No team assigned"
                description="You are not in any team yet. Ask an administrator to add you."
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {teams.map((team) => (
                  <Link
                    key={team.id}
                    to={`/teams?team=${team.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--glass-1)',
                      border: '1px solid var(--glass-border)',
                      textDecoration: 'none',
                      transition: 'border-color 150ms',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                        {team.team_name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Lead: {team.lead ? team.lead.name || team.lead.username : 'Unassigned'}
                      </div>
                    </div>
                    <ExternalLink size={14} style={{ color: 'var(--text-muted)' }} />
                  </Link>
                ))}
              </div>
            )}
          </GlassCard>

          {/* Account Security Card */}
          <GlassCard level={2} style={{ padding: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <ShieldCheck size={18} style={{ color: 'var(--accent)' }} />
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                Account Security
              </h3>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '16px' }}>
              Keep your analyst credentials secure with regular password rotation.
            </p>

            <button
              type="button"
              className="btn-glass"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => setChangePasswordOpen(true)}
            >
              <KeyRound size={14} />
              <span>Change Password</span>
            </button>
          </GlassCard>
        </div>
      </div>

      <ChangePasswordModal
        isOpen={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </div>
  )
}

