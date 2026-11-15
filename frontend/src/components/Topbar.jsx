/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Topbar — Sticky header with hamburger & user profile menu
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
import { useState, useRef, useEffect } from 'react'
import { Menu, KeyRound, LogOut, ChevronDown } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { ROLE_LABELS, ROLE_BADGE_VARIANT } from '../constants/roles'
import Avatar from './ui/Avatar'
import Badge from './ui/Badge'
import GlassCard from './ui/GlassCard'

export default function Topbar({ onToggleSidebar, onOpenChangePassword }) {
  const { user, logout } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const menuRef = useRef(null)

  const roleName = user?.role?.role_name || ''
  const roleLabel = ROLE_LABELS[roleName] || roleName
  const badgeVariant = ROLE_BADGE_VARIANT[roleName] || 'neutral'

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [dropdownOpen])

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="hamburger"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation menu"
        >
          <Menu size={20} />
        </button>
      </div>

      <div className="topbar-right">
        <div className="user-menu" ref={menuRef}>
          <button
            type="button"
            className="user-menu-trigger"
            onClick={() => setDropdownOpen((prev) => !prev)}
            aria-expanded={dropdownOpen}
            aria-haspopup="true"
          >
            <Avatar name={user?.name || user?.username} size={32} />
            <div className="user-menu-info">
              <div className="user-menu-name">{user?.name || user?.username}</div>
              <div style={{ marginTop: '2px' }}>
                <Badge variant={badgeVariant} size="sm">
                  {roleLabel}
                </Badge>
              </div>
            </div>
            <ChevronDown
              size={14}
              style={{
                color: 'var(--text-muted)',
                transform: dropdownOpen ? 'rotate(180deg)' : 'none',
                transition: 'transform 150ms',
                marginLeft: '4px',
              }}
            />
          </button>

          {dropdownOpen && (
            <GlassCard level={3} className="user-menu-dropdown">
              <button
                type="button"
                className="user-menu-dropdown-item"
                onClick={() => {
                  setDropdownOpen(false)
                  onOpenChangePassword()
                }}
              >
                <KeyRound size={15} />
                <span>Change password</span>
              </button>

              <div className="user-menu-divider" />

              <button
                type="button"
                className="user-menu-dropdown-item danger"
                onClick={() => {
                  setDropdownOpen(false)
                  logout()
                }}
              >
                <LogOut size={15} />
                <span>Log out</span>
              </button>
            </GlassCard>
          )}
        </div>
      </div>
    </header>
  )
}

