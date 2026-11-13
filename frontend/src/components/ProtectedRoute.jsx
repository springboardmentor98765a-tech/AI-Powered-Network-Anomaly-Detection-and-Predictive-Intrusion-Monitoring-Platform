
import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader" />
        <p>Verifying your session...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export function RoleGuard({ allowedRoles, children }) {
  const { user } = useAuth();

  const hasPermission = user?.roles?.some((role) =>
    allowedRoles.includes(role)
  );

  if (!hasPermission) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
