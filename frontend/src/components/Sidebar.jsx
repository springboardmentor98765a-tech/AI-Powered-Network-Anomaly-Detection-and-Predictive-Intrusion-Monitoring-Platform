import React from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard,
  Activity,
  Radar,
  ShieldAlert,
  BarChart3,
  FileText,
  Sliders,
  Server,
  Settings,
  Users,
  ShieldCheck,
  UserCircle,
} from 'lucide-react';

export default function Sidebar({ currentPage, onNavigate }) {
  const { user } = useAuth();

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      roles: ['Administrator', 'Team Lead / Supervisor', 'Security Analyst'],
    },
    {
      id: 'traffic',
      label: 'Network Monitoring',
      icon: Activity,
      roles: ['Administrator', 'Team Lead / Supervisor', 'Security Analyst'],
    },
    {
      id: 'anomaly',
      label: 'Anomaly Detection',
      icon: Radar,
      roles: ['Administrator', 'Team Lead / Supervisor', 'Security Analyst'],
    },
    {
      id: 'alerts',
      label: 'Alerts',
      icon: ShieldAlert,
      roles: ['Administrator', 'Team Lead / Supervisor', 'Security Analyst'],
    },
    {
      id: 'users',
      label: 'Users',
      icon: Users,
      roles: ['Administrator', 'Team Lead / Supervisor', 'Security Analyst'],
    },
    {
      id: 'teams',
      label: 'Teams',
      icon: ShieldCheck,
      roles: ['Administrator', 'Team Lead / Supervisor', 'Security Analyst'],
    },
    {
      id: 'audit',
      label: 'Audit Logs',
      icon: FileText,
      roles: ['Administrator', 'Team Lead / Supervisor'],
    },
    {
      id: 'profile',
      label: 'Account',
      icon: Settings,
      roles: ['Administrator', 'Team Lead / Supervisor', 'Security Analyst'],
    },
  ];

  return (
    <aside className="w-56 p-3 bg-white border-r border-slate-200 flex flex-col shrink-0 min-h-[calc(100vh-57px)]">
      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isAllowed = item.roles.includes(user?.role);
          const isActive = currentPage === item.id;

          if (!isAllowed) return null;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition cursor-pointer ${
                isActive
                  ? 'bg-slate-100 text-slate-900 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-500'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
