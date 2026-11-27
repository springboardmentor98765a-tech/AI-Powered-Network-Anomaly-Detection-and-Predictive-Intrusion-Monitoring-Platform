import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/authContext";
import Login from "./pages/auth/login";
import RegisterPage from "./pages/auth/register";
import Dashboard from "./pages/dashboard";
import UserManagement from "./pages/userManagement";
import TeamManagement from "./pages/teamManagement";
import AuditLogs from "./pages/auditlogs";
import NetworkStream from "./pages/networkStream";
import ThreatAnalytics from "./pages/threatAnalytics";
import AnomalyDetection from "./pages/anomalyDetection";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { token, user } = useAuth();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const roles = user?.roles?.map((r: { role_name: string }) => r.role_name) || [];
    const hasAccess = allowedRoles.some((role) => roles.includes(role));
    if (!hasAccess) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/monitoring"
          element={
            <ProtectedRoute>
              <NetworkStream />
            </ProtectedRoute>
          }
        />
        <Route
          path="/threats"
          element={
            <ProtectedRoute>
              <ThreatAnalytics />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teams"
          element={
            <ProtectedRoute>
              <TeamManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute allowedRoles={["Administrator"]}>
              <UserManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/audit-logs"
          element={
            <ProtectedRoute allowedRoles={["Administrator", "Team Lead", "Security Analyst"]}>
              <AuditLogs />
            </ProtectedRoute>
          }
        />

        <Route
          path="/anomaly-detection"
          element={
            <ProtectedRoute allowedRoles={["Administrator", "Team Lead", "Security Analyst"]}>
              <AnomalyDetection />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  );
}