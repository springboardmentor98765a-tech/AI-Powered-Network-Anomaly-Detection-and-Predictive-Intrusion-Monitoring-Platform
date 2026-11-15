/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Navigation items — data-driven sidebar.
   Each item is filtered by role in Sidebar.jsx.
   soon:true  → rendered disabled with a "Soon" pill.
   module     → "Arrives with Module N" label.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
import {
  LayoutDashboard,
  Users,
  UsersRound,
  FileText,
  Radio,
  Bell,
  AlertTriangle,
} from 'lucide-react'

export const NAV_ITEMS = [
  /* ── Live items ──────────────────────────────── */
  {
    key:   'dashboard',
    label: 'Dashboard',
    path:  '/dashboard',
    icon:  LayoutDashboard,
    roles: ['admin', 'security_analyst', 'team_lead'],
  },
  {
    key:   'users',
    label: 'Users',
    path:  '/users',
    icon:  Users,
    roles: ['admin'],
  },
  {
    key:   'teams',
    label: 'Teams',
    path:  '/teams',
    icon:  UsersRound,
    roles: ['admin'],
  },
  {
    key:   'my-teams',
    label: 'My Teams',
    path:  '/teams',
    icon:  UsersRound,
    roles: ['security_analyst', 'team_lead'],
  },
  {
    key:   'audit-logs',
    label: 'Audit Logs',
    path:  '/audit-logs',
    icon:  FileText,
    roles: ['admin'],
  },

  /* ── Coming soon (disabled links) ───────────── */
  {
    key:    'traffic',
    label:  'Traffic Monitor',
    path:   null,
    icon:   Radio,
    roles:  ['admin', 'security_analyst'],
    soon:   true,
    module: 2,
  },
  {
    key:    'alerts',
    label:  'Alerts',
    path:   null,
    icon:   Bell,
    roles:  ['admin', 'security_analyst', 'team_lead'],
    soon:   true,
    module: 5,
  },
  {
    key:    'incidents',
    label:  'Incidents',
    path:   null,
    icon:   AlertTriangle,
    roles:  ['security_analyst', 'team_lead'],
    soon:   true,
    module: 3,
  },
]

