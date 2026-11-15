/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   NetShield AI — App Root
   Mounts AppBackground, ToastProvider, AuthProvider, and Routes
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './components/ui/Toast'
import AppBackground from './components/AppBackground'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'

import Login from './pages/Login'
import DashboardRouter from './pages/dashboards/DashboardRouter'
import Users from './pages/Users'
import Teams from './pages/Teams'
import AuditLogs from './pages/AuditLogs'

export default function App() {
  return (
    <BrowserRouter>
      {/* Layered dark glass background rendered once behind everything */}
      <AppBackground />

      <ToastProvider>
        <AuthProvider>
          <Routes>
            {/* Public route */}
            <Route path="/login" element={<Login />} />

            {/* Authenticated routes inside Layout */}
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                {/* Role-specific dashboard router */}
                <Route path="/dashboard" element={<DashboardRouter />} />

                {/* Admin-only routes */}
                <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                  <Route path="/users" element={<Users />} />
                  <Route path="/audit-logs" element={<AuditLogs />} />
                </Route>

                {/* Teams route (admin, analyst, lead) */}
                <Route element={<ProtectedRoute allowedRoles={['admin', 'security_analyst', 'team_lead']} />}>
                  <Route path="/teams" element={<Teams />} />
                </Route>
              </Route>
            </Route>

            {/* Redirect root to dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
