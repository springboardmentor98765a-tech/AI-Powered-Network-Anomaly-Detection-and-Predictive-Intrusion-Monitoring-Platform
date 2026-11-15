/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Sidebar — Glass sidebar navigation
   - Filtered by user role
   - Lucide icons
   - Active link = accent left bar + glow
   - "Soon" items disabled with "Soon" pill
   - Drawer toggle for screen widths < 900px
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
import { NavLink } from 'react-router-dom'
import { X } from 'lucide-react'
import { NAV_ITEMS } from '../constants/nav'
import { useAuth } from '../context/AuthContext'
import NetShieldLogo from './NetShieldLogo'

export default function Sidebar({ isOpen, onClose }) {
  const { user } = useAuth()
  const userRole = user?.role?.role_name

  // Filter navigation items by active user's role
  // cosmetic: the backend enforces this
  const visibleNav = NAV_ITEMS.filter((item) =>
    item.roles.includes(userRole)
  )

  return (
    <>
      {/* Mobile drawer backdrop */}
      {isOpen && (
        <div
          className="sidebar-overlay"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        {/* Mobile close button */}
        <button
          type="button"
          className="sidebar-close-btn"
          onClick={onClose}
          aria-label="Close sidebar"
        >
          <X size={18} />
        </button>

        {/* Branding */}
        <div className="sidebar-logo">
          <NetShieldLogo size={30} />
          <div className="sidebar-logo-text">
            NetShield <span>AI</span>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="sidebar-nav" aria-label="Main Navigation">
          {visibleNav.map((item) => {
            const Icon = item.icon

            if (item.soon) {
              return (
                <div
                  key={item.key}
                  className="sidebar-nav-item disabled"
                  title={`Arrives with Module ${item.module}`}
                  aria-disabled="true"
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                  <span className="sidebar-soon-pill">Soon</span>
                </div>
              )
            }

            return (
              <NavLink
                key={item.key}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) =>
                  `sidebar-nav-item ${isActive ? 'active' : ''}`
                }
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>
      </aside>
    </>
  )
}

