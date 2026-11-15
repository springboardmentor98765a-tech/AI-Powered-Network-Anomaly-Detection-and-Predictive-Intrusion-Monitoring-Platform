/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   DashboardRouter — Role-driven dashboard selector
   Reads user.role.role_name and renders exactly ONE of the
   three dedicated dashboard components.
   Never combines them into one mega-component full of if statements.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
import { useAuth } from '../../context/AuthContext'
import { ROLES } from '../../constants/roles'
import AdminDashboard from './AdminDashboard'
import AnalystDashboard from './AnalystDashboard'
import TeamLeadDashboard from './TeamLeadDashboard'

export default function DashboardRouter() {
  const { user } = useAuth()
  const role = user?.role?.role_name

  switch (role) {
    case ROLES.ADMIN:
      return <AdminDashboard />

    case ROLES.LEAD:
      return <TeamLeadDashboard />

    case ROLES.ANALYST:
    default:
      return <AnalystDashboard />
  }
}

