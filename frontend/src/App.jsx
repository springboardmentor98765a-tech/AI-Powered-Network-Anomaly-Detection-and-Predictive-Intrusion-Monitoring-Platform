import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";

import ProtectedRoute, {
  RoleGuard,
} from "./components/ProtectedRoute";

import AppLayout from "./components/AppLayout";

import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import NetworkMonitoringPage from "./pages/NetworkMonitoringPage";
import AnomalyDetectionPage from "./pages/AnomalyDetectionPage";
import TeamsPage from "./pages/TeamsPage";
import UsersPage from "./pages/UsersPage";
import RolesPage from "./pages/RolesPage";
import AuditLogsPage from "./pages/AuditLogsPage";
import ManagementPage from "./pages/ManagementPage";
import ProfilePage from "./pages/ProfilePage";
import ChangePasswordPage from "./pages/ChangePasswordPage";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />

          <Route
            path="/network-monitoring"
            element={
              <RoleGuard
                allowedRoles={[
                  "Administrator",
                  "Security Analyst",
                  "Team Lead / Supervisor",
                ]}
              >
                <NetworkMonitoringPage />
              </RoleGuard>
            }
          />

          <Route
            path="/anomaly-detection"
            element={
              <RoleGuard
                allowedRoles={[
                  "Administrator",
                  "Security Analyst",
                  "Team Lead / Supervisor",
                ]}
              >
                <AnomalyDetectionPage />
              </RoleGuard>
            }
          />

          {/* The three management pages share one tab bar while keeping
              their existing URLs, components and access rules. */}
          <Route element={<ManagementPage />}>
            <Route
              path="/users"
              element={
                <RoleGuard allowedRoles={["Administrator"]}>
                  <UsersPage />
                </RoleGuard>
              }
            />

            <Route
              path="/roles"
              element={
                <RoleGuard allowedRoles={["Administrator"]}>
                  <RolesPage />
                </RoleGuard>
              }
            />

            <Route path="/teams" element={<TeamsPage />} />
          </Route>

          {/* Audit Logs intentionally stays outside User Management. */}
          <Route
            path="/audit-logs"
            element={
              <RoleGuard allowedRoles={["Administrator"]}>
                <AuditLogsPage />
              </RoleGuard>
            }
          />

          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
