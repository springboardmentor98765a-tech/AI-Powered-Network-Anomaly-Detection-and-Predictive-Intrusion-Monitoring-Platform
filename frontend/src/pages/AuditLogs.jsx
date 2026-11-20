import { useEffect, useState } from "react";
import api from "../api/api";
import { useAuth } from "../context/AuthContext";

const ACTIONS = [
  "LOGIN",
  "LOGOUT",
  "CREATE_USER",
  "UPDATE_USER",
  "ACTIVATE_USER",
  "DEACTIVATE_USER",
  "ASSIGN_ROLES",
  "RESET_PASSWORD",
  "CHANGE_PASSWORD",
  "PASSWORD_RESET_REQUEST",
  "CREATE_TEAM",
  "ADD_TEAM_MEMBER",
  "REMOVE_TEAM_MEMBER",
];

const PAGE_SIZE = 20;

export default function AuditLogs() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("administrator");

  const [logs, setLogs] = useState([]);
  const [userNames, setUserNames] = useState({}); // id -> name (admin only)
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [action, setAction] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);

  const loadLogs = async (pageNumber = page) => {
    setLoading(true);
    setError("");
    try {
      const params = { skip: pageNumber * PAGE_SIZE, limit: PAGE_SIZE };
      if (action) params.action = action;
      if (status) params.status = status;
      if (dateFrom) params.date_from = new Date(dateFrom).toISOString();
      if (dateTo) params.date_to = new Date(dateTo + "T23:59:59").toISOString();

      const res = await api.get("/audit-logs", { params });
      setLogs(res.data);
    } catch (err) {
      setError("Unable to load audit logs. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Admin only: load names so we can show "Akanksha" instead of "User #1"
  useEffect(() => {
    if (isAdmin) {
      api
        .get("/users", { params: { limit: 100 } })
        .then((res) => {
          const map = {};
          res.data.forEach((u) => (map[u.id] = u.name));
          setUserNames(map);
        })
        .catch(() => {});
    }
  }, [isAdmin]);

  // Reload when the page number changes (also runs once on open)
  useEffect(() => {
    loadLogs(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const applyFilters = (e) => {
    e.preventDefault();
    if (page === 0) loadLogs(0);
    else setPage(0); // changing the page triggers the reload
  };

  const clearFilters = () => {
    setAction("");
    setStatus("");
    setDateFrom("");
    setDateTo("");
    setPage(0);
    setTimeout(() => loadLogs(0), 0);
  };

  const actorLabel = (id) => {
    if (id === null || id === undefined) return "Unknown / not logged in";
    return userNames[id] || `User #${id}`;
  };

  const targetLabel = (log) =>
    log.target_type ? `${log.target_type} #${log.target_id ?? "-"}` : "-";

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Audit Logs</h2>
      <p style={styles.muted}>
        A read-only record of important activities. Newest entries appear first.
      </p>

      {error && <div style={styles.error}>{error}</div>}

      <form style={styles.filters} onSubmit={applyFilters}>
        <select style={styles.input} value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">All actions</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        <select style={styles.input} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="success">Success</option>
          <option value="failure">Failure</option>
        </select>

        <label style={styles.dateLabel}>
          From
          <input style={styles.input} type="date" value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)} />
        </label>

        <label style={styles.dateLabel}>
          To
          <input style={styles.input} type="date" value={dateTo}
            onChange={(e) => setDateTo(e.target.value)} />
        </label>

        <button style={styles.primary} type="submit">Apply</button>
        <button className="btn-secondary" style={styles.secondary} type="button"
          onClick={clearFilters}>Clear</button>
      </form>

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Time</th>
            <th style={styles.th}>Who</th>
            <th style={styles.th}>Action</th>
            <th style={styles.th}>Target</th>
            <th style={styles.th}>Status</th>
            <th style={styles.th}>Details</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td style={styles.td}>{new Date(log.created_at).toLocaleString()}</td>
              <td style={styles.td}>{actorLabel(log.actor_user_id)}</td>
              <td style={styles.td}>{log.action}</td>
              <td style={styles.td}>{targetLabel(log)}</td>
              <td style={styles.td}>
                <span style={log.status === "success" ? styles.ok : styles.fail}>
                  {log.status}
                </span>
              </td>
              <td style={styles.td}>{log.details || "-"}</td>
            </tr>
          ))}
          {!loading && logs.length === 0 && (
            <tr>
              <td style={styles.td} colSpan={6}>No records found.</td>
            </tr>
          )}
        </tbody>
      </table>

      <div style={styles.pager}>
        <button className="btn-secondary" style={styles.secondary} disabled={page === 0}
          onClick={() => setPage(page - 1)}>
          Previous
        </button>
        <span style={styles.muted}>Page {page + 1}</span>
        <button className="btn-secondary" style={styles.secondary} disabled={logs.length < PAGE_SIZE}
          onClick={() => setPage(page + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}

const styles = {
  muted: { color: "#AFC4E5" },
  filters: { display: "flex", gap: 10, marginBottom: 16, alignItems: "flex-end", flexWrap: "wrap" },
  dateLabel: { display: "flex", flexDirection: "column", fontSize: 12, color: "#AFC4E5", gap: 4 },
  input: {
    padding: 10, borderRadius: 6, border: "1px solid #1F3A70",
    background: "#07152F", color: "#FFFFFF", fontSize: 14,
  },
  primary: {
    padding: "10px 16px", border: "none", borderRadius: 6,
    background: "#1677E8", color: "#FFFFFF", cursor: "pointer", fontSize: 14,
  },
  secondary: {
    padding: "10px 16px", border: "1px solid #24437F", borderRadius: 6,
    background: "#16346F", color: "#FFFFFF", cursor: "pointer", fontSize: 14,
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
  ok: { color: "#4ADE80", fontWeight: 600 },
  fail: { color: "#F87171", fontWeight: 600 },
  pager: { display: "flex", gap: 16, alignItems: "center", marginTop: 16 },
  error: {
    background: "#3B1219", color: "#FCA5A5", border: "1px solid #7F1D1D",
    padding: 10, borderRadius: 6, marginBottom: 12,
  },
};