import React, { useState } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import UsersPage from '@/pages/UsersPage';
import TeamsPage from '@/pages/TeamsPage';
import AuditLogsPage from '@/pages/AuditLogsPage';
import ProfilePage from '@/pages/ProfilePage';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Shield, ShieldAlert } from 'lucide-react';

function AppContent() {
  const { user, loading, isAdmin, isTeamLead } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-500 gap-3">
        <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-xs animate-pulse">
          <Shield className="w-4 h-4" />
        </div>
        <p className="text-xs font-medium text-slate-500">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage onNavigate={setCurrentPage} />;
      case 'users':
        return <UsersPage />;
      case 'teams':
        return <TeamsPage />;
      case 'audit':
        if (!isAdmin && !isTeamLead) {
          return (
            <Card className="max-w-md mx-auto mt-12 text-center p-6">
              <CardContent className="space-y-3 pt-2">
                <div className="inline-flex p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-600">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <h2 className="text-sm font-semibold text-slate-900">403 Forbidden: RBAC Restriction</h2>
                <p className="text-xs text-slate-500 leading-normal">
                  Security audit logs require <strong>Administrator</strong> or <strong>Team Lead / Supervisor</strong> privileges.
                </p>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setCurrentPage('dashboard')}
                  className="mt-2"
                >
                  Return to Dashboard
                </Button>
              </CardContent>
            </Card>
          );
        }
        return <AuditLogsPage />;
      case 'profile':
        return <ProfilePage />;
      default:
        return <DashboardPage onNavigate={setCurrentPage} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <Navbar onNavigate={setCurrentPage} currentPage={currentPage} />
      <div className="flex flex-1">
        <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
        <main className="flex-1 p-6 overflow-y-auto max-w-6xl">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
