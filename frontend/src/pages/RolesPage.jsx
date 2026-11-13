
import { useEffect, useState } from "react";
import {
  Shield,
  ShieldCheck,
  Users,
  RefreshCw,
  Info,
  LockKeyhole,
} from "lucide-react";
import api from "../services/api";
import "./RolesPage.css";

function getRoleIcon(roleName) {
  if (roleName === "Administrator") return ShieldCheck;
  if (roleName === "Security Analyst") return Shield;
  return Users;
}

function RolesPage() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchRoles = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/roles");
      setRoles(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(
        typeof detail === "string"
          ? detail
          : "Unable to load roles. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  return (
    <div className="roles-page">
      <div className="roles-header">
        <div>
          <p className="roles-eyebrow">ACCESS CONTROL</p>
          <h1>Role Management</h1>
          <p className="roles-subtitle">
            View the roles configured for the NetShield AI platform.
          </p>
        </div>

        <button
          className="roles-refresh-btn"
          onClick={fetchRoles}
          disabled={loading}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <div className="roles-summary">
        <div className="roles-summary-icon">
          <LockKeyhole size={22} />
        </div>
        <div>
          <span>Configured Roles</span>
          <strong>{loading ? "—" : roles.length}</strong>
        </div>
      </div>

      <section className="roles-section">
        <div className="roles-section-heading">
          <div>
            <h2>Available Roles</h2>
            <p>These roles can be assigned to users by an administrator.</p>
          </div>
        </div>

        {error && (
          <div className="roles-error">
            <span>{error}</span>
            <button onClick={fetchRoles}>Retry</button>
          </div>
        )}

        {loading ? (
          <div className="roles-message">Loading roles...</div>
        ) : !error && roles.length === 0 ? (
          <div className="roles-message">No roles have been configured.</div>
        ) : (
          <div className="roles-grid">
            {roles.map((role) => {
              const Icon = getRoleIcon(role.role_name);

              return (
                <article className="role-card" key={role.id}>
                  <div className="role-card-top">
                    <div className="role-icon">
                      <Icon size={23} />
                    </div>
                    <span className="role-id">ROLE #{role.id}</span>
                  </div>

                  <h3>{role.role_name}</h3>

                  <p className="role-description">
                    {role.description || "No description is available for this role."}
                  </p>

                  <div className="role-card-footer">
                    <span>
                      <Shield size={14} />
                      Platform access role
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <div className="roles-info">
        <Info size={18} />
        <div>
          <strong>Managing role assignments</strong>
          <p>
            To assign or change a user's roles, open User Management,
            select the user, and edit their assigned roles. Role creation
            and deletion are not available through the current backend API.
          </p>
        </div>
      </div>
    </div>
  );
}

export default RolesPage;
