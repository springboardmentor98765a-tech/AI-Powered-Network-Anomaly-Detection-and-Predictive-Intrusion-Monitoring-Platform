/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TeamDrawer — Right-side glass-3 panel for TeamDetail
   - Deep-linked via ?team=ID
   - Members roster: Avatar, name, @username, status Badge (inactive dimmed), added date, Remove button
   - Add member combobox: 300ms debounce on GET /users/directory?q=, excludes existing members
   - Edit details (admin or team lead)
   - Change lead select (admin only, active team_leads)
   - Delete team button (admin only, ConfirmDialog)
   - Analysts get read-only drawer with NO action buttons (hidden, not disabled)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
import { useState, useEffect, useRef } from 'react'
import {
  X,
  UserPlus,
  Trash2,
  Edit2,
  Calendar,
  RotateCw,
  Search,
} from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import {
  apiGetTeam,
  apiAddTeamMember,
  apiRemoveTeamMember,
  apiUpdateTeamLead,
  apiDeleteTeam,
} from '../api/teams'
import { apiGetUsersDirectory, fetchAllUsers } from '../api/users'
import { canManageTeam } from '../utils/permissions'
import { formatDateTime } from '../utils/format'
import { errorMessage } from '../api/client'

import Avatar from './ui/Avatar'
import Badge from './ui/Badge'
import Skeleton from './ui/Skeleton'
import Spinner from './ui/Spinner'
import ConfirmDialog from './ui/ConfirmDialog'
import EditTeamModal from './EditTeamModal'
import { useToast } from './ui/Toast'

export default function TeamDrawer({
  teamId,
  isOpen,
  onClose,
  onTeamUpdated,
  onTeamDeleted,
}) {
  const { user } = useAuth()
  const { success, error: toastError } = useToast()

  const [teamDetail, setTeamDetail]         = useState(null)
  const [loading, setLoading]               = useState(true)
  const [fetchError, setFetchError]         = useState(null)

  // Modals state
  const [editModalOpen, setEditModalOpen]   = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteLoading, setDeleteLoading]   = useState(false)

  // Remove member state
  const [memberToRemove, setMemberToRemove] = useState(null)
  const [removeLoading, setRemoveLoading]   = useState(false)

  // Change lead state (Admin only)
  const [availableLeads, setAvailableLeads] = useState([])
  const [updatingLead, setUpdatingLead]     = useState(false)

  // Add member combobox state
  const [memberSearchQuery, setMemberSearchQuery] = useState('')
  const [directoryResults, setDirectoryResults]   = useState([])
  const [searchingDirectory, setSearchingDirectory] = useState(false)
  const [addingUserId, setAddingUserId]           = useState(null)
  const debounceTimer = useRef(null)

  const isAdmin = user?.role?.role_name === 'admin'
  const isManager = canManageTeam(user, teamDetail)

  // 1. Fetch team details when opened
  const loadTeamDetail = async () => {
    if (!teamId) return
    setLoading(true)
    setFetchError(null)
    try {
      const data = await apiGetTeam(teamId)
      setTeamDetail(data)
    } catch (err) {
      const status = err?.response?.status
      const msg = errorMessage(err)
      if (status === 403 || status === 404) {
        toastError(msg)
        onClose()
      } else {
        setFetchError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && teamId) {
      loadTeamDetail()
    } else {
      setTeamDetail(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, teamId])

  // 2. Fetch eligible team leads if user is admin
  useEffect(() => {
    if (isOpen && isAdmin) {
      fetchAllUsers()
        .then((users) => {
          const leads = users.filter(
            (u) => u.role?.role_name === 'team_lead' && u.status === 'active'
          )
          setAvailableLeads(leads)
        })
        .catch(() => {})
    }
  }, [isOpen, isAdmin])

  // 3. Debounced directory search for adding members
  useEffect(() => {
    if (!memberSearchQuery.trim()) {
      setDirectoryResults([])
      setSearchingDirectory(false)
      return
    }

    setSearchingDirectory(true)
    clearTimeout(debounceTimer.current)

    debounceTimer.current = setTimeout(async () => {
      try {
        const results = await apiGetUsersDirectory(memberSearchQuery.trim(), 20)
        // Exclude members already on the team
        const currentMemberIds = new Set(
          (teamDetail?.members || []).map((m) => m.user?.id)
        )
        const filtered = results.filter((u) => !currentMemberIds.has(u.id))
        setDirectoryResults(filtered)
      } catch {
        setDirectoryResults([])
      } finally {
        setSearchingDirectory(false)
      }
    }, 300)

    return () => clearTimeout(debounceTimer.current)
  }, [memberSearchQuery, teamDetail])

  // Close on Escape key & manage focus restoration
  const previousActiveElement = useRef(null)
  const drawerRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement
      // Focus drawer container
      setTimeout(() => {
        if (drawerRef.current) {
          const focusable = drawerRef.current.querySelector(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
          if (focusable) focusable.focus()
          else drawerRef.current.focus()
        }
      }, 50)
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (previousActiveElement.current && previousActiveElement.current.focus) {
        previousActiveElement.current.focus()
      }
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  // Handlers
  const handleAddMember = async (targetUser) => {
    setAddingUserId(targetUser.id)
    try {
      const updatedDetail = await apiAddTeamMember(teamId, targetUser.id)
      setTeamDetail(updatedDetail)
      setMemberSearchQuery('')
      setDirectoryResults([])
      success(`Added @${targetUser.username} to ${teamDetail.team_name}`)
      onTeamUpdated?.(updatedDetail)
    } catch (err) {
      toastError(errorMessage(err))
    } finally {
      setAddingUserId(null)
    }
  }

  const handleConfirmRemoveMember = async () => {
    if (!memberToRemove) return
    setRemoveLoading(true)
    try {
      await apiRemoveTeamMember(teamId, memberToRemove.user.id)
      success(`Removed @${memberToRemove.user.username} from team`)
      setMemberToRemove(null)
      // Reload team details
      loadTeamDetail()
      onTeamUpdated?.()
    } catch (err) {
      toastError(errorMessage(err))
    } finally {
      setRemoveLoading(false)
    }
  }

  const handleChangeLead = async (newLeadId) => {
    setUpdatingLead(true)
    try {
      const leadIdVal = newLeadId ? Number(newLeadId) : null
      const updated = await apiUpdateTeamLead(teamId, leadIdVal)
      setTeamDetail((prev) => ({ ...prev, lead: updated.lead }))
      success('Team lead updated')
      onTeamUpdated?.()
    } catch (err) {
      toastError(errorMessage(err))
    } finally {
      setUpdatingLead(false)
    }
  }

  const handleDeleteTeam = async () => {
    setDeleteLoading(true)
    try {
      await apiDeleteTeam(teamId)
      success(`Team "${teamDetail?.team_name}" deleted`)
      setDeleteDialogOpen(false)
      onClose()
      onTeamDeleted?.()
    } catch (err) {
      toastError(errorMessage(err))
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />

      <aside ref={drawerRef} className="glass-drawer" role="dialog" aria-modal="true" tabIndex={-1}>
        {/* Drawer Header */}
        <div
          style={{
            padding: '22px 24px',
            borderBottom: '1px solid var(--glass-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            {loading ? (
              <Skeleton width="180px" height="24px" />
            ) : (
              <h3
                style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: 'var(--text)',
                  margin: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {teamDetail?.team_name || 'Team Details'}
              </h3>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Edit details button: admin or that team's lead */}
            {/* cosmetic: the backend enforces this */}
            {isManager && !loading && (
              <button
                type="button"
                className="btn-glass btn-sm"
                onClick={() => setEditModalOpen(true)}
                title="Edit team details"
              >
                <Edit2 size={13} />
                <span>Edit</span>
              </button>
            )}

            <button
              type="button"
              className="btn-glass btn-sm"
              onClick={onClose}
              aria-label="Close drawer"
              style={{ padding: '6px' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Drawer Body */}
        <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Skeleton height="70px" />
              <Skeleton height="100px" />
              <Skeleton height="200px" />
            </div>
          ) : fetchError ? (
            <div style={{ textAlign: 'center', padding: '36px' }}>
              <p style={{ color: 'var(--danger)', fontSize: '13px', marginBottom: '12px' }}>
                {fetchError}
              </p>
              <button type="button" className="btn-glass btn-sm" onClick={loadTeamDetail}>
                <RotateCw size={12} />
                <span>Retry</span>
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Description */}
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Description
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.5, margin: 0 }}>
                  {teamDetail.description || (
                    <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No description provided.
                    </span>
                  )}
                </p>
              </div>

              {/* Lead Information */}
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Operational Team Lead
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--glass-1)',
                    border: '1px solid var(--glass-border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Avatar name={teamDetail.lead?.name || teamDetail.lead?.username} size={32} />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                        {teamDetail.lead ? teamDetail.lead.name || teamDetail.lead.username : 'Unassigned'}
                      </div>
                      {teamDetail.lead && (
                        <div className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          @{teamDetail.lead.username}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Change Lead selector: Admin Only */}
                  {/* cosmetic: the backend enforces this */}
                  {isAdmin && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {updatingLead && <Spinner size={14} />}
                      <select
                        className="input-glass"
                        style={{ fontSize: '12px', padding: '4px 8px', width: 'auto', cursor: 'pointer' }}
                        value={teamDetail.lead?.id || ''}
                        disabled={updatingLead}
                        onChange={(e) => handleChangeLead(e.target.value)}
                        aria-label="Change team lead"
                      >
                        <option value="" style={{ background: '#12161a', color: '#fff' }}>
                          — No Lead —
                        </option>
                        {availableLeads.map((l) => (
                          <option key={l.id} value={l.id} style={{ background: '#12161a', color: '#fff' }}>
                            {l.name || `@${l.username}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Timestamps */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Calendar size={13} />
                  <span>Created: {formatDateTime(teamDetail.created_at)}</span>
                </div>
              </div>

              {/* Member Add Combobox (Manager only) */}
              {/* cosmetic: the backend enforces this */}
              {isManager && (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                    Add Team Member
                  </div>

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
                      <Search size={14} />
                    </div>

                    <input
                      type="text"
                      className="input-glass"
                      style={{ paddingLeft: '34px', fontSize: '13px' }}
                      placeholder="Search active users by name or username..."
                      value={memberSearchQuery}
                      onChange={(e) => setMemberSearchQuery(e.target.value)}
                    />

                    {searchingDirectory && (
                      <div
                        style={{
                          position: 'absolute',
                          right: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                        }}
                      >
                        <Spinner size={14} />
                      </div>
                    )}

                    {/* Results Dropdown */}
                    {directoryResults.length > 0 && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 4px)',
                          left: 0,
                          right: 0,
                          background: 'var(--glass-3)',
                          backdropFilter: 'blur(20px)',
                          WebkitBackdropFilter: 'blur(20px)',
                          border: '1px solid var(--glass-border-strong)',
                          borderRadius: 'var(--radius-sm)',
                          maxHeight: '180px',
                          overflowY: 'auto',
                          zIndex: 50,
                          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                        }}
                      >
                        {directoryResults.map((u) => (
                          <div
                            key={u.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 12px',
                              cursor: 'pointer',
                              borderBottom: '1px solid var(--glass-border)',
                              fontSize: '13px',
                            }}
                            onClick={() => handleAddMember(u)}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Avatar name={u.name || u.username} size={24} />
                              <div>
                                <span style={{ color: 'var(--text)', fontWeight: 500 }}>
                                  {u.name || u.username}
                                </span>
                                <span className="mono" style={{ color: 'var(--text-muted)', marginLeft: '6px', fontSize: '11px' }}>
                                  @{u.username}
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              className="btn-glass btn-sm"
                              style={{ padding: '3px 8px', fontSize: '11px' }}
                              disabled={addingUserId === u.id}
                            >
                              {addingUserId === u.id ? <Spinner size={12} /> : <UserPlus size={12} />}
                              <span>Add</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Members Table */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                    Members ({teamDetail.members?.length || 0})
                  </div>
                </div>

                {!teamDetail.members || teamDetail.members.length === 0 ? (
                  <div
                    style={{
                      padding: '24px',
                      textAlign: 'center',
                      background: 'var(--glass-1)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--glass-border)',
                      color: 'var(--text-muted)',
                      fontSize: '13px',
                    }}
                  >
                    No personnel currently assigned to this team.
                  </div>
                ) : (
                  <div className="table-container" style={{ border: '1px solid var(--glass-border)' }}>
                    <table className="glass-table">
                      <thead>
                        <tr>
                          <th>Member</th>
                          <th>Status</th>
                          <th>Assigned</th>
                          {/* cosmetic: the backend enforces this */}
                          {isManager && <th style={{ textAlign: 'right' }}>Action</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {teamDetail.members.map((m) => {
                          const memUser = m.user
                          const isInactive = memUser?.status === 'inactive'

                          return (
                            <tr key={memUser.id} style={{ opacity: isInactive ? 0.55 : 1 }}>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <Avatar name={memUser.name || memUser.username} size={26} />
                                  <div>
                                    <div style={{ fontWeight: 500, color: 'var(--text)' }}>
                                      {memUser.name || memUser.username}
                                    </div>
                                    <div className="mono" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                                      @{memUser.username}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              <td>
                                <Badge variant={memUser.status === 'active' ? 'success' : 'danger'} size="sm">
                                  {memUser.status}
                                </Badge>
                              </td>

                              <td className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                {formatDateTime(m.assigned_at)}
                              </td>

                              {/* Remove Member button (manager only) */}
                              {/* cosmetic: the backend enforces this */}
                              {isManager && (
                                <td style={{ textAlign: 'right' }}>
                                  <button
                                    type="button"
                                    className="btn-danger btn-sm"
                                    style={{ padding: '3px 7px' }}
                                    title="Remove from team"
                                    onClick={() => setMemberToRemove(m)}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </td>
                              )}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Admin Danger Zone: Delete Team */}
              {/* cosmetic: the backend enforces this */}
              {isAdmin && (
                <div
                  style={{
                    marginTop: '20px',
                    paddingTop: '20px',
                    borderTop: '1px solid rgba(248, 113, 113, 0.2)',
                  }}
                >
                  <button
                    type="button"
                    className="btn-danger"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 size={15} />
                    <span>Delete This Team</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Edit Team Modal */}
      <EditTeamModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        team={teamDetail}
        onUpdated={(updated) => {
          setTeamDetail((prev) => ({ ...prev, ...updated }))
          onTeamUpdated?.(updated)
        }}
      />

      {/* Remove Member ConfirmDialog */}
      <ConfirmDialog
        isOpen={Boolean(memberToRemove)}
        onClose={() => setMemberToRemove(null)}
        onConfirm={handleConfirmRemoveMember}
        title="Remove Team Member"
        message={`Are you sure you want to remove @${memberToRemove?.user?.username} from ${teamDetail?.team_name}?`}
        confirmText="Remove Member"
        isDanger={true}
        loading={removeLoading}
      />

      {/* Delete Team ConfirmDialog */}
      <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeleteTeam}
        title="Delete Team"
        message={`Are you sure you want to delete "${teamDetail?.team_name}"? All member associations will be permanently removed.`}
        confirmText="Delete Team"
        isDanger={true}
        loading={deleteLoading}
      />
    </>
  )
}
