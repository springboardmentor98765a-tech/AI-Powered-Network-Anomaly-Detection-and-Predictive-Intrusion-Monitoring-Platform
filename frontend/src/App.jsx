import React, { useState } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import DashboardPage from '@/pages/DashboardPage';
import AlertsPage from '@/pages/AlertsPage';
import TrafficMonitorPage from '@/pages/TrafficMonitorPage';
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
  const [authView, setAuthView] = useState('login');
  const [trafficFilter, setTrafficFilter] = useState({});

  const handleNavigate = (page, filter = null) => {
    setCurrentPage(page);
    if (filter !== null && filter !== undefined) {
      setTrafficFilter(filter);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-500 gap-3">
        <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-xs animate-pulse">
          <Shield className="w-4 h-4" />
        </div>
        <p className="text-xs font-medium text-slate-500">Loading NetShield AI...</p>
      </div>
    );
  }

  if (!user) {
    return authView === 'login' ? (
      <LoginPage onSwitchToRegister={() => setAuthView('register')} />
    ) : (
      <RegisterPage onSwitchToLogin={() => setAuthView('login')} />
    );
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage onNavigate={handleNavigate} />;
      case 'alerts':
        return (
          <AlertsPage
            initialFilter={trafficFilter}
            onNavigate={handleNavigate}
          />
        );
      case 'traffic':
        return (
          <TrafficMonitorPage
            initialFilter={trafficFilter}
            onClearFilter={() => setTrafficFilter({})}
          />
        );
      case 'users':
        return <UsersPage />;
      case 'teams':
        return <TeamsPage />;
      case 'audit':
        if (!isAdmin && !isTeamLead) {
          return (
            <Card className="max-w-md mx-auto mt-12 text-center p-6 bg-white border border-slate-200">
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
        return <DashboardPage onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Navbar onNavigate={handleNavigate} currentPage={currentPage} />
      <div className="flex flex-1">
        <Sidebar
          currentPage={currentPage}
          onNavigate={handleNavigate}
        />
        <main className="flex-1 p-5 overflow-y-auto w-full max-w-[1550px] mx-auto">
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
