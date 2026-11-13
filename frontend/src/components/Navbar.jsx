import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, LogOut, User as UserIcon, Users } from 'lucide-react';

export default function Navbar({ onNavigate, currentPage }) {
  const { user, logout } = useAuth();

  const getRoleVariant = (role) => {
    switch (role) {
      case 'Administrator':
        return 'admin';
      case 'Team Lead / Supervisor':
        return 'warning';
      case 'Security Analyst':
        return 'info';
      default:
        return 'secondary';
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-40">
      <div
        className="flex items-center gap-2.5 cursor-pointer select-none"
        onClick={() => onNavigate('dashboard')}
      >
        <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-xs">
          <Shield className="w-4 h-4" />
        </div>
        <span className="font-semibold text-sm tracking-tight text-slate-900">
          NetShield AI
        </span>
      </div>

      <div className="flex items-center gap-2.5">
        {user && (
          <>
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold text-slate-900">{user.full_name}</span>
              <div className="flex items-center gap-1.5 justify-end mt-0.5">
                <Badge variant={getRoleVariant(user.role)}>
                  {user.role}
                </Badge>
                {user.team_name && (
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Users className="w-3 h-3 text-slate-400" />
                    {user.team_name}
                  </span>
                )}
              </div>
            </div>

            <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block"></div>

            <Button
              type="button"
              variant={currentPage === 'profile' ? 'secondary' : 'outline'}
              size="icon"
              onClick={() => onNavigate('profile')}
              title="Account & Security"
            >
              <UserIcon className="w-3.5 h-3.5" />
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={logout}
              title="Sign Out"
              className="text-slate-700 hover:text-rose-700 hover:bg-rose-50 hover:border-rose-200"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
