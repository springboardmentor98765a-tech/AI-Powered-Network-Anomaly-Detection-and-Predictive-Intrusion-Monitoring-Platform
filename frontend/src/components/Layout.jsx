/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Layout — Application Shell
   Wraps authenticated routes with Sidebar, Topbar, and
   ChangePasswordModal.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import ChangePasswordModal from './ChangePasswordModal'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)

  return (
    <div className="app-layout">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="main-area">
        <Topbar
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          onOpenChangePassword={() => setChangePasswordOpen(true)}
        />

        <main className="page-content">
          <Outlet />
        </main>
      </div>

      <ChangePasswordModal
        isOpen={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </div>
  )
}
