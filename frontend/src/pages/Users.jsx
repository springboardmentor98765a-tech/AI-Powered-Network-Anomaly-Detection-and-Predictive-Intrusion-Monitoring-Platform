/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Users Page — Admin User Administration
   - Full client-side search, filtering (status, role), and pagination (15/page)
   - Table columns: User (avatar, name, @username), Email, Role, Status, Created, Updated, Actions
   - Actions per row: Activate / Deactivate (ConfirmDialog), Change Role (ConfirmDialog old -> new)
   - Current admin's own row has actions disabled: "You can't change your own account"
   - Usernames and emails are read-only (no edit route exists)
   - New user modal with field-level backend validation mapping
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
import { useState, useMemo } from 'react'
import {
  UserPlus,
  Search,
  Users as UsersIcon,
  RotateCw,
  XCircle,
} from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { useFetch } from '../hooks/useFetch'
import { fetchAllUsers, apiUpdateUserStatus, apiUpdateUserRole } from '../api/users'
import { errorMessage } from '../api/client'
import { ROLE_LABELS, ROLE_IDS, ROLE_BADGE_VARIANT } from '../constants/roles'
import { formatDateTime } from '../utils/format'

import PageHeader from '../components/ui/PageHeader'
import Badge from '../components/ui/Badge'
import Avatar from '../components/ui/Avatar'
import Skeleton from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'
import Pagination from '../components/ui/Pagination'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import NewUserModal from '../components/NewUserModal'
import { useToast } from '../components/ui/Toast'

const PAGE_SIZE = 15

export default function Users() {
  const { user: currentAdmin } = useAuth()
  const { success, error: toastError } = useToast()

  // 1. Fetch all users
  const {
    data: allUsers,
    loading,
    error,
    reload,
  } = useFetch(fetchAllUsers, [])

  // 2. Filter states
  const [searchQuery, setSearchQuery]   = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'active' | 'inactive'
  const [roleFilter, setRoleFilter]     = useState('all')   // 'all' | role_name
  const [page, setPage]                 = useState(1)

  // 3. Modals & Dialogs state
  const [newUserModalOpen, setNewUserModalOpen] = useState(false)

  // Status toggle confirmation
  const [statusDialogTarget, setStatusDialogTarget] = useState(null)
  const [statusLoading, setStatusLoading]           = useState(false)

  // Role change confirmation
  const [roleDialogTarget, setRoleDialogTarget] = useState(null)
  const [pendingRoleId, setPendingRoleId]       = useState(null)
  const [roleLoading, setRoleLoading]           = useState(false)

  // 4. Client-side filtering & search
  const filteredUsers = useMemo(() => {
    if (!allUsers) return []

    const q = searchQuery.trim().toLowerCase()

    return allUsers.filter((u) => {
      // Status filter
      if (statusFilter !== 'all' && u.status !== statusFilter) return false

      // Role filter
      if (roleFilter !== 'all' && u.role?.role_name !== roleFilter) return false

      // Search match: name, username, email
      if (q) {
        const nameMatch     = u.name?.toLowerCase().includes(q)
        const usernameMatch = u.username?.toLowerCase().includes(q)
        const emailMatch    = u.email?.toLowerCase().includes(q)
        if (!nameMatch && !usernameMatch && !emailMatch) return false
      }

      return true
    })
  }, [allUsers, searchQuery, statusFilter, roleFilter])

  // Reset to page 1 whenever filters change
  const handleFilterChange = (setter, val) => {
    setter(val)
    setPage(1)
  }

  const clearFilters = () => {
    setSearchQuery('')
    setStatusFilter('all')
    setRoleFilter('all')
    setPage(1)
  }

  // 5. Pagination slicing
  const totalFiltered = filteredUsers.length
  const totalPages    = Math.ceil(totalFiltered / PAGE_SIZE) || 1
  const hasNext       = page < totalPages
  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filteredUsers.slice(start, start + PAGE_SIZE)
  }, [filteredUsers, page])

  // 6. Action handlers
  const handleToggleStatusClick = (u) => {
    // If user is active, deactivating requires confirmation
    if (u.status === 'active') {
      setStatusDialogTarget(u)
    } else {
      // Activating immediately
      executeStatusUpdate(u, 'active')
    }
  }

  const executeStatusUpdate = async (targetUser, newStatus) => {
    setStatusLoading(true)
    try {
      await apiUpdateUserStatus(targetUser.id, newStatus)
      success(`User @${targetUser.username} is now ${newStatus}`)
      setStatusDialogTarget(null)
      reload()
    } catch (err) {
      toastError(errorMessage(err))
    } finally {
      setStatusLoading(false)
    }
  }

  const handleRoleSelectChange = (u, newRoleId) => {
    const roleIdNum = Number(newRoleId)
    if (roleIdNum === u.role?.id) return
    setRoleDialogTarget(u)
    setPendingRoleId(roleIdNum)
  }

  const executeRoleUpdate = async () => {
    if (!roleDialogTarget || !pendingRoleId) return
    setRoleLoading(true)
    try {
      await apiUpdateUserRole(roleDialogTarget.id, pendingRoleId)
      const roleName = Object.keys(ROLE_IDS).find((k) => ROLE_IDS[k] === pendingRoleId)
      success(`Updated role for @${roleDialogTarget.username} to ${ROLE_LABELS[roleName] || roleName}`)
      setRoleDialogTarget(null)
      setPendingRoleId(null)
      reload()
    } catch (err) {
      toastError(errorMessage(err))
    } finally {
      setRoleLoading(false)
    }
  }

  const isFiltersActive = searchQuery.trim() !== '' || statusFilter !== 'all' || roleFilter !== 'all'

  return (
    <div>
      <PageHeader
        title="User Accounts"
        subtitle="Manage SOC credentials, system privileges, and access states"
        actions={
          <button
            type="button"
            className="btn-primary"
            onClick={() => setNewUserModalOpen(true)}
          >
            <UserPlus size={16} />
            <span>New User</span>
          </button>
        }
      />

      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          marginBottom: '20px',
        }}
      >
        {/* Left: Search input */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
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
            placeholder="Search name, username, email..."
            value={searchQuery}
            onChange={(e) => handleFilterChange(setSearchQuery, e.target.value)}
          />
        </div>

        {/* Right: Status Segmented Control & Role Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Status Segmented Control */}
          <div className="segmented-control" role="group" aria-label="Filter users by status">
            <button
              type="button"
              className={`segmented-control-btn ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => handleFilterChange(setStatusFilter, 'all')}
            >
              All
            </button>
            <button
              type="button"
              className={`segmented-control-btn ${statusFilter === 'active' ? 'active' : ''}`}
              onClick={() => handleFilterChange(setStatusFilter, 'active')}
            >
              Active
            </button>
            <button
              type="button"
              className={`segmented-control-btn ${statusFilter === 'inactive' ? 'active' : ''}`}
              onClick={() => handleFilterChange(setStatusFilter, 'inactive')}
            >
              Inactive
            </button>
          </div>

          {/* Role Dropdown */}
          <select
            className="input-glass"
            style={{ width: 'auto', padding: '7px 12px', cursor: 'pointer', fontSize: '13px' }}
            value={roleFilter}
            onChange={(e) => handleFilterChange(setRoleFilter, e.target.value)}
            aria-label="Filter users by role"
          >
            <option value="all" style={{ background: '#12161a', color: '#fff' }}>All Roles</option>
            <option value="admin" style={{ background: '#12161a', color: '#fff' }}>Administrator</option>
            <option value="security_analyst" style={{ background: '#12161a', color: '#fff' }}>Security Analyst</option>
            <option value="team_lead" style={{ background: '#12161a', color: '#fff' }}>Team Lead</option>
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="table-container" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Skeleton height="36px" />
            <Skeleton height="44px" />
            <Skeleton height="44px" />
            <Skeleton height="44px" />
            <Skeleton height="44px" />
          </div>
        </div>
      ) : error ? (
        <div className="table-container" style={{ padding: '48px', textAlign: 'center' }}>
          <p style={{ color: 'var(--danger)', fontSize: '14px', marginBottom: '14px' }}>{error}</p>
          <button type="button" className="btn-glass" onClick={reload}>
            <RotateCw size={14} />
            <span>Retry Loading Users</span>
          </button>
        </div>
      ) : paginatedUsers.length === 0 ? (
        isFiltersActive ? (
          <EmptyState
            icon={XCircle}
            title="No matching users"
            description="No user accounts match your current search and filter criteria."
            action={
              <button type="button" className="btn-glass btn-sm" onClick={clearFilters}>
                Clear filters
              </button>
            }
          />
        ) : (
          <EmptyState
            icon={UsersIcon}
            title="No users found"
            description="There are currently no accounts in the directory. Create a new user to get started."
            action={
              <button type="button" className="btn-primary btn-sm" onClick={() => setNewUserModalOpen(true)}>
                <UserPlus size={14} />
                <span>Create User</span>
              </button>
            }
          />
        )
      ) : (
        <div className="table-container">
          <table className="glass-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Updated</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.map((u) => {
                const isSelf = u.id === currentAdmin?.id
                const roleKey = u.role?.role_name || ''
                const roleBadgeVariant = ROLE_BADGE_VARIANT[roleKey] || 'neutral'
                const roleLabel = ROLE_LABELS[roleKey] || roleKey
                const isActive = u.status === 'active'

                return (
                  <tr key={u.id}>
                    {/* User */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Avatar name={u.name || u.username} size={32} />
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                            {u.name || u.username}
                          </div>
                          <div className="mono" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                            @{u.username}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Email (Read-only) */}
                    <td style={{ color: 'var(--text-muted)' }}>
                      {u.email}
                    </td>

                    {/* Role */}
                    <td>
                      <Badge variant={roleBadgeVariant} size="sm">
                        {roleLabel}
                      </Badge>
                    </td>

                    {/* Status */}
                    <td>
                      <Badge variant={isActive ? 'success' : 'danger'} size="sm">
                        {u.status}
                      </Badge>
                    </td>

                    {/* Created */}
                    <td className="mono" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                      {formatDateTime(u.created_at)}
                    </td>

                    {/* Updated */}
                    <td className="mono" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                      {formatDateTime(u.updated_at)}
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        {/* Change Role Select */}
                        {/* cosmetic: the backend enforces this */}
                        <select
                          className="input-glass"
                          style={{
                            padding: '4px 8px',
                            fontSize: '12px',
                            width: 'auto',
                            cursor: isSelf ? 'not-allowed' : 'pointer',
                            opacity: isSelf ? 0.45 : 1,
                          }}
                          value={u.role?.id ?? ''}
                          disabled={isSelf}
                          title={isSelf ? "You can't change your own account" : 'Change user role'}
                          onChange={(e) => handleRoleSelectChange(u, e.target.value)}
                        >
                          <option value={ROLE_IDS.admin} style={{ background: '#12161a', color: '#fff' }}>Admin</option>
                          <option value={ROLE_IDS.security_analyst} style={{ background: '#12161a', color: '#fff' }}>Analyst</option>
                          <option value={ROLE_IDS.team_lead} style={{ background: '#12161a', color: '#fff' }}>Lead</option>
                        </select>

                        {/* Status Toggle Button */}
                        {/* cosmetic: the backend enforces this */}
                        <button
                          type="button"
                          className={isActive ? 'btn-danger btn-sm' : 'btn-glass btn-sm'}
                          style={{ fontSize: '12px', padding: '5px 10px' }}
                          disabled={isSelf}
                          title={isSelf ? "You can't change your own account" : isActive ? 'Deactivate account' : 'Activate account'}
                          onClick={() => handleToggleStatusClick(u)}
                        >
                          {isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Pagination Controls */}
          <Pagination
            page={page}
            hasNext={hasNext}
            onChange={(newPage) => setPage(newPage)}
          />
        </div>
      )}

      {/* New User Modal */}
      <NewUserModal
        isOpen={newUserModalOpen}
        onClose={() => setNewUserModalOpen(false)}
        onCreated={reload}
      />

      {/* Deactivate Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(statusDialogTarget)}
        onClose={() => setStatusDialogTarget(null)}
        onConfirm={() => executeStatusUpdate(statusDialogTarget, 'inactive')}
        title="Deactivate User Account"
        message={`Are you sure you want to deactivate @${statusDialogTarget?.username}? They will be signed out on their next request.`}
        confirmText="Deactivate"
        isDanger={true}
        loading={statusLoading}
      />

      {/* Role Change Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(roleDialogTarget)}
        onClose={() => {
          setRoleDialogTarget(null)
          setPendingRoleId(null)
        }}
        onConfirm={executeRoleUpdate}
        title="Change Access Privileges"
        message={
          roleDialogTarget && pendingRoleId ? (
            <>
              Confirm role modification for <strong>@{roleDialogTarget.username}</strong>:
              <br />
              <span style={{ color: 'var(--text-muted)' }}>
                {ROLE_LABELS[roleDialogTarget.role?.role_name] || roleDialogTarget.role?.role_name}
              </span>
              {' → '}
              <strong style={{ color: 'var(--accent)' }}>
                {ROLE_LABELS[Object.keys(ROLE_IDS).find((k) => ROLE_IDS[k] === pendingRoleId)]}
              </strong>
            </>
          ) : ''
        }
        confirmText="Apply Role Change"
        isDanger={false}
        loading={roleLoading}
      />
    </div>
  )
}
