// src/App.tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/authContext';
import Login from './pages/auth/login';
import RegisterPage from './pages/auth/register';
import Dashboard from './pages/dashboard';
import UserManagement from './pages/userManagement';
import TeamManagement from './pages/teamManagement';
import AuditLogs from './pages/auditlogs';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
        <Route path="/teams" element={<ProtectedRoute><TeamManagement /></ProtectedRoute>} />
        <Route path="/audit-logs" element={<ProtectedRoute><AuditLogs /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  );
}