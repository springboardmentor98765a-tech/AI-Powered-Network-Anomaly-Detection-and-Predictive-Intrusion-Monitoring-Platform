import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Usage: <ProtectedRoute roles={["administrator"]}> ...page... </ProtectedRoute>
// If "roles" is not given, any logged-in user can open the page.
export default function ProtectedRoute({ roles, children }) {
  const { user, loading, hasRole } = useAuth();

  // Still checking the token after a page refresh
  if (loading) {
    return <p style={{ padding: 20 }}>Loading...</p>;
  }

  // Not logged in -> go to login page
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Logged in, but role not allowed -> access denied
  if (roles && !hasRole(...roles)) {
    return (
      <div style={{ padding: 40 }}>
        <h2>Access denied</h2>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  return children;
}