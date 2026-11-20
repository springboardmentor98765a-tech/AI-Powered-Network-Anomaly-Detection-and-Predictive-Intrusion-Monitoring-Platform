import { useEffect, useState } from "react";
import api from "../api/api";
import { useAuth } from "../context/AuthContext";

const ROLE_OPTIONS = ["administrator", "security_analyst", "team_lead"];

// Turn any backend error into a simple text message
function getErrorMessage(err) {
  const detail = err.response?.data?.detail;
  if (Array.isArray(detail)) return detail[0].msg.replace("Value error, ", "");
  if (typeof detail === "string") return detail;
  return "Something went wrong. Please try again.";
}

const emptyForm = {
  name: "",
  username: "",
  email: "",
  password: "",
  role: "security_analyst",
};

export default function Users() {
  const { user: me } = useAuth();

  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const [resetTarget, setResetTarget] = useState(null); // the user whose password we reset
  const [resetPassword, setResetPassword] = useState("");

  // Load the list from the backend (with the search and status filter)
  const loadUsers = async () => {
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = statusFilter;
      const res = await api.get("/users", { params });
      setUsers(res.data);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  // Reload whenever the filter changes (also runs once when the page opens)
  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const showResult = (okMessage) => {
    setError("");
    setMessage(okMessage);
  };

  const showError = (err) => {
    setMessage("");
    setError(getErrorMessage(err));
  };

  // ----- Create user -----
  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post("/users", form);
      showResult(`User "${form.username}" created.`);
      setForm(emptyForm);
      setShowCreate(false);
      loadUsers();
    } catch (err) {
      showError(err);
    }
  };

  // ----- Activate / deactivate -----
  const toggleStatus = async (u) => {
    const action = u.status === "active" ? "deactivate" : "activate";
    try {
      await api.post(`/users/${u.id}/${action}`);
      showResult(`User "${u.username}" is now ${action}d.`);
      loadUsers();
    } catch (err) {
      showError(err);
    }
  };

  // ----- Change role -----
  const changeRole = async (u, newRole) => {
    try {
      await api.put(`/users/${u.id}/roles`, { roles: [newRole] });
      showResult(`Role of "${u.username}" changed to ${newRole.replace("_", " ")}.`);
      loadUsers();
    } catch (err) {
      showError(err);
    }
  };

  // ----- Reset password -----
  const handleReset = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/users/${resetTarget.id}/reset-password`, {
        new_password: resetPassword,
      });
      showResult(`Password reset for "${resetTarget.username}".`);
      setResetTarget(null);
      setResetPassword("");
    } catch (err) {
      showError(err);
    }
  };

  const updateField = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <div>
      <div style={styles.header}>
        <h2 style={{ margin: 0 }}>User Management</h2>
        <button style={styles.primary} onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? "Cancel" : "+ Create user"}
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}
      {message && <div style={styles.success}>{message}</div>}

      {/* ----- Create user form ----- */}
      {showCreate && (
        <form style={styles.card} onSubmit={handleCreate}>
          <h3 style={styles.cardTitle}>New user</h3>
          <div style={styles.formGrid}>
            <input style={styles.input} placeholder="Full name" value={form.name}
              onChange={updateField("name")} required />
            <input style={styles.input} placeholder="Username" value={form.username}
              onChange={updateField("username")} required minLength={3} />
            <input style={styles.input} type="email" placeholder="Email" value={form.email}
              onChange={updateField("email")} required />
            <input style={styles.input} type="password" placeholder="Password" value={form.password}
              onChange={updateField("password")} required autoComplete="new-password" />
            <select style={styles.input} value={form.role} onChange={updateField("role")}>
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>{r.replace("_", " ")}</option>
              ))}
            </select>
          </div>
          <small style={styles.hint}>
            Password: at least 8 characters, with an uppercase letter, a lowercase letter and a number.
          </small>
          <button style={{ ...styles.primary, marginTop: 12 }} type="submit">Create</button>
        </form>
      )}

      {/* ----- Reset password form ----- */}
      {resetTarget && (
        <form style={styles.card} onSubmit={handleReset}>
          <h3 style={styles.cardTitle}>Reset password for {resetTarget.username}</h3>
          <input style={styles.input} type="password" placeholder="New password"
            value={resetPassword} onChange={(e) => setResetPassword(e.target.value)}
            required autoComplete="new-password" />
          <div style={{ marginTop: 12 }}>
            <button style={styles.primary} type="submit">Reset password</button>
            <button className="btn-secondary" style={styles.secondary} type="button"
              onClick={() => { setResetTarget(null); setResetPassword(""); }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ----- Search and filter ----- */}
      <form
        style={styles.filters}
        onSubmit={(e) => { e.preventDefault(); loadUsers(); }}
      >
        <input style={{ ...styles.input, width: 260 }} placeholder="Search name, username or email"
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <select style={styles.input} value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button className="btn-secondary" style={styles.secondary} type="submit">Search</button>
      </form>

      {/* ----- Users table ----- */}
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Name</th>
            <th style={styles.th}>Username</th>
            <th style={styles.th}>Email</th>
            <th style={styles.th}>Role</th>
            <th style={styles.th}>Status</th>
            <th style={styles.th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const isMe = u.id === me.id;
            const currentRole = u.roles[0]?.role_name || "";
            return (
              <tr key={u.id}>
                <td style={styles.td}>{u.name}</td>
                <td style={styles.td}>{u.username}</td>
                <td style={styles.td}>{u.email}</td>
                <td style={styles.td}>
                  <select
                    style={styles.smallSelect}
                    value={currentRole}
                    disabled={isMe}
                    onChange={(e) => changeRole(u, e.target.value)}
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>{r.replace("_", " ")}</option>
                    ))}
                  </select>
                </td>
                <td style={styles.td}>
                  <span style={u.status === "active" ? styles.active : styles.inactive}>
                    {u.status}
                  </span>
                </td>
                <td style={styles.td}>
                  <button className="btn-secondary" style={styles.smallButton} disabled={isMe}
                    onClick={() => toggleStatus(u)}>
                    {u.status === "active" ? "Deactivate" : "Activate"}
                  </button>
                  <button className="btn-secondary" style={styles.smallButton}
                    onClick={() => { setResetTarget(u); setResetPassword(""); }}>
                    Reset password
                  </button>
                </td>
              </tr>
            );
          })}
          {users.length === 0 && (
            <tr>
              <td style={styles.td} colSpan={6}>No users found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  card: {
    background: "#0D2045", border: "1px solid #1B3566", color: "#E5ECF8",
    padding: 20, borderRadius: 10, marginBottom: 16, maxWidth: 700,
    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
  },
  cardTitle: { marginTop: 0, color: "#20C5F5" },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  filters: { display: "flex", gap: 10, marginBottom: 16, alignItems: "center" },
  input: {
    padding: 10, borderRadius: 6, border: "1px solid #1F3A70",
    background: "#07152F", color: "#FFFFFF", fontSize: 14,
  },
  hint: { display: "block", color: "#AFC4E5", marginTop: 8 },
  primary: {
    padding: "10px 16px", border: "none", borderRadius: 6,
    background: "#1677E8", color: "#FFFFFF", cursor: "pointer", fontSize: 14,
  },
  secondary: {
    padding: "10px 16px", border: "1px solid #24437F", borderRadius: 6, marginLeft: 8,
    background: "#16346F", color: "#FFFFFF", cursor: "pointer", fontSize: 14,
  },
  error: {
    background: "#3B1219", color: "#FCA5A5", border: "1px solid #7F1D1D",
    padding: 10, borderRadius: 6, marginBottom: 12,
  },
  success: {
    background: "#0F2E1D", color: "#86EFAC", border: "1px solid #166534",
    padding: 10, borderRadius: 6, marginBottom: 12,
  },
  table: {
    width: "100%", borderCollapse: "collapse", background: "#0D2045",
    border: "1px solid #1B3566", borderRadius: 10,
  },
  th: {
    textAlign: "left", padding: 12, borderBottom: "1px solid #1B3566",
    background: "#0A1A3C", color: "#20C5F5", fontSize: 14,
  },
  td: { padding: 12, borderBottom: "1px solid #1B3566", fontSize: 14, color: "#E5ECF8" },
  smallSelect: {
    padding: 6, borderRadius: 6, border: "1px solid #1F3A70",
    background: "#07152F", color: "#FFFFFF", textTransform: "capitalize",
  },
  smallButton: {
    padding: "6px 10px", marginRight: 6, border: "1px solid #24437F", borderRadius: 6,
    background: "#16346F", color: "#FFFFFF", cursor: "pointer", fontSize: 13,
  },
  active: { color: "#4ADE80", fontWeight: 600 },
  inactive: { color: "#F87171", fontWeight: 600 },
};