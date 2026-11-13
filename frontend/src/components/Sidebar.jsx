import React from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  FileText,
  UserCircle,
} from 'lucide-react';

export default function Sidebar({ currentPage, onNavigate }) {
  const { user } = useAuth();

  const navItems = [
    {
      id: 'dashboard',
      label: 'Overview',
      icon: LayoutDashboard,
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
      icon: UserCircle,
      roles: ['Administrator', 'Team Lead / Supervisor', 'Security Analyst'],
    },
  ];

  return (
    <aside className="w-56 bg-white border-r border-slate-200 p-3 min-h-[calc(100vh-57px)] shrink-0">
      <nav className="space-y-0.5">
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
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs transition cursor-pointer ${
                isActive
                  ? 'bg-slate-100 text-slate-900 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
              }`}
            >
              <Icon className="w-4 h-4 text-slate-500" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
