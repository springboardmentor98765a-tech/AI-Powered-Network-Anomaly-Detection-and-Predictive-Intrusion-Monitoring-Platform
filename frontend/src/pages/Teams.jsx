/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Teams Page — Operational Security Teams
   - Admin sees all teams; analysts and leads see their own
   - Responsive grid of hoverable glass cards
   - Deep-link support: /teams?team=ID opens the drawer; closing clears it
   - Search by team name
   - "New team" button for admin only
   - Integrates TeamDrawer with member management
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  UsersRound,
  Plus,
  Search,
  Shield,
  RotateCw,
  XCircle,
} from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { useFetch } from '../hooks/useFetch'
import { apiGetTeams } from '../api/teams'

import PageHeader from '../components/ui/PageHeader'
import GlassCard from '../components/ui/GlassCard'
import Avatar from '../components/ui/Avatar'
import Skeleton from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'
import CreateTeamModal from '../components/CreateTeamModal'
import TeamDrawer from '../components/TeamDrawer'

export default function Teams() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const isAdmin = user?.role?.role_name === 'admin'

  // 1. Fetch teams (Backend returns all teams for admin, or led/joined for others)
  const {
    data: teams,
    loading,
    error,
    reload,
  } = useFetch(() => apiGetTeams(0, 100), [])

  // 2. Search query state
  const [searchQuery, setSearchQuery] = useState('')
  const [createModalOpen, setCreateModalOpen] = useState(false)

  // 3. Deep-link drawer synchronization
  const selectedTeamId = searchParams.get('team')

  const handleOpenDrawer = (teamId) => {
    setSearchParams({ team: teamId })
  }

  const handleCloseDrawer = () => {
    searchParams.delete('team')
    setSearchParams(searchParams)
  }

  // 4. Client-side search filtering by team name
  const filteredTeams = useMemo(() => {
    if (!teams) return []
    const q = searchQuery.trim().toLowerCase()
    if (!q) return teams

    return teams.filter((t) =>
      t.team_name?.toLowerCase().includes(q)
    )
  }, [teams, searchQuery])

  const pageTitle = isAdmin ? 'Security Teams' : 'My Operational Teams'
  const pageSubtitle = isAdmin
    ? 'Manage operational response teams, assignments, and leadership'
    : 'Teams you lead or actively contribute to as an analyst'

  return (
    <div>
      <PageHeader
        title={pageTitle}
        subtitle={pageSubtitle}
        actions={
          /* cosmetic: the backend enforces this */
          isAdmin && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => setCreateModalOpen(true)}
            >
              <Plus size={16} />
              <span>New Team</span>
            </button>
          )
        }
      />

      {/* Toolbar: Search */}
      <div style={{ marginBottom: '24px', maxWidth: '360px' }}>
        <div style={{ position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              display: 'flex',
              pointerEvents: 'none',
            }}
          >
            <Search size={16} />
          </div>
          <input
            type="text"
            className="input-glass"
            style={{ paddingLeft: '38px' }}
            placeholder="Search teams by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Main Grid View */}
      {loading ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '20px',
          }}
        >
          <Skeleton height="160px" />
          <Skeleton height="160px" />
          <Skeleton height="160px" />
        </div>
      ) : error ? (
        <GlassCard level={1} style={{ padding: '48px', textAlign: 'center' }}>
          <p style={{ color: 'var(--danger)', fontSize: '14px', marginBottom: '14px' }}>{error}</p>
          <button type="button" className="btn-glass" onClick={reload}>
            <RotateCw size={14} />
            <span>Retry Loading Teams</span>
          </button>
        </GlassCard>
      ) : filteredTeams.length === 0 ? (
        searchQuery ? (
          <EmptyState
            icon={XCircle}
            title="No teams match your search"
            description={`No teams found matching "${searchQuery}".`}
            action={
              <button
                type="button"
                className="btn-glass btn-sm"
                onClick={() => setSearchQuery('')}
              >
                Clear Search
              </button>
            }
          />
        ) : (
          <EmptyState
            icon={UsersRound}
            title={isAdmin ? 'No security teams configured' : 'No teams assigned'}
            description={
              isAdmin
                ? 'Create your first operational security team to organize incident response analysts.'
                : 'You are not assigned to any security teams yet. Ask an administrator to add you.'
            }
            action={
              isAdmin && (
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  onClick={() => setCreateModalOpen(true)}
                >
                  <Plus size={14} />
                  <span>Create First Team</span>
                </button>
              )
            }
          />
        )
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '20px',
          }}
        >
          {filteredTeams.map((team) => (
            <GlassCard
              key={team.id}
              level={2}
              hoverable
              onClick={() => handleOpenDrawer(team.id)}
              style={{
                padding: '22px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '160px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Shield size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  <h3
                    style={{
                      fontSize: '16px',
                      fontWeight: 600,
                      color: 'var(--text)',
                      margin: 0,
                    }}
                  >
                    {team.team_name}
                  </h3>
                </div>

                <p
                  style={{
                    fontSize: '13px',
                    color: 'var(--text-muted)',
                    lineHeight: 1.45,
                    margin: '0 0 16px 0',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {team.description || (
                    <span style={{ fontStyle: 'italic', opacity: 0.7 }}>
                      No description provided.
                    </span>
                  )}
                </p>
              </div>

              {/* Lead information footer */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '14px',
                  borderTop: '1px solid var(--glass-border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Avatar name={team.lead?.name || team.lead?.username} size={24} />
                  <span style={{ fontSize: '12px', color: 'var(--text)', fontWeight: 500 }}>
                    {team.lead ? team.lead.name || team.lead.username : 'No lead assigned'}
                  </span>
                </div>

                <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 500 }}>
                  View details →
                </span>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Create Team Modal (Admin only) */}
      <CreateTeamModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={reload}
      />

      {/* Right-Side Team Drawer */}
      <TeamDrawer
        teamId={selectedTeamId}
        isOpen={Boolean(selectedTeamId)}
        onClose={handleCloseDrawer}
        onTeamUpdated={reload}
        onTeamDeleted={reload}
      />
    </div>
  )
}
