import { useEffect, useState } from "react";
import api from "../api/api";
import { useAuth } from "../context/AuthContext";

function getErrorMessage(err) {
  const detail = err.response?.data?.detail;
  if (Array.isArray(detail)) return detail[0].msg.replace("Value error, ", "");
  if (typeof detail === "string") return detail;
  return "Something went wrong. Please try again.";
}

export default function Teams() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("administrator");
  const canManageMembers = hasRole("administrator", "team_lead");

  const [teams, setTeams] = useState([]);
  const [selected, setSelected] = useState(null); // the team being viewed
  const [members, setMembers] = useState([]);
  const [allUsers, setAllUsers] = useState([]); // only loaded for administrators

  const [teamName, setTeamName] = useState("");
  const [description, setDescription] = useState("");
  const [memberChoice, setMemberChoice] = useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const showResult = (text) => {
    setError("");
    setMessage(text);
  };
  const showError = (err) => {
    setMessage("");
    setError(getErrorMessage(err));
  };

  const loadTeams = async () => {
    try {
      const res = await api.get("/teams");
      setTeams(res.data);
    } catch (err) {
      showError(err);
    }
  };

  // When the page opens: load teams, and (admin only) the list of users
  useEffect(() => {
    loadTeams();
    if (isAdmin) {
      api
        .get("/users", { params: { limit: 100 } })
        .then((res) => setAllUsers(res.data))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openTeam = async (team) => {
    setSelected(team);
    setMemberChoice("");
    try {
      const res = await api.get(`/teams/${team.id}/members`);
      setMembers(res.data);
    } catch (err) {
      showError(err);
    }
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    try {
      await api.post("/teams", { team_name: teamName, description: description || null });
      showResult(`Team "${teamName}" created.`);
      setTeamName("");
      setDescription("");
      loadTeams();
    } catch (err) {
      showError(err);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post(`/teams/${selected.id}/members`, {
        user_id: Number(memberChoice),
      });
      setMembers(res.data);
      setMemberChoice("");
      showResult("Member added.");
    } catch (err) {
      showError(err);
    }
  };

  const handleRemoveMember = async (userId) => {
    try {
      const res = await api.delete(`/teams/${selected.id}/members/${userId}`);
      setMembers(res.data);
      showResult("Member removed.");
    } catch (err) {
      showError(err);
    }
  };

  // Admin dropdown: hide people who are already in the team
  const memberIds = members.map((m) => m.id);
  const availableUsers = allUsers.filter((u) => !memberIds.includes(u.id));

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Teams</h2>

      {error && <div style={styles.error}>{error}</div>}
      {message && <div style={styles.success}>{message}</div>}

      {/* ----- Create team (administrator only) ----- */}
      {isAdmin && (
        <form style={styles.card} onSubmit={handleCreateTeam}>
          <h3 style={styles.cardTitle}>Create team</h3>
          <div style={styles.row}>
            <input style={styles.input} placeholder="Team name" value={teamName}
              onChange={(e) => setTeamName(e.target.value)} required />
            <input style={{ ...styles.input, flex: 1 }} placeholder="Description (optional)"
              value={description} onChange={(e) => setDescription(e.target.value)} />
            <button style={styles.primary} type="submit">Create</button>
          </div>
        </form>
      )}

      <div style={styles.columns}>
        {/* ----- Team list ----- */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>{isAdmin ? "All teams" : "My teams"}</h3>
          {teams.length === 0 && <p style={styles.muted}>No teams to show.</p>}
          {teams.map((t) => (
            <div
              key={t.id}
              style={{
                ...styles.teamItem,
                background: selected?.id === t.id ? "#CCFBF1" : "#FFFFFF",
                border: selected?.id === t.id ? "1px solid #0F766E" : "1px solid #E2E8F0",
              }}
              onClick={() => openTeam(t)}
            >
              <strong>{t.team_name}</strong>
              {t.description && <div style={styles.small}>{t.description}</div>}
            </div>
          ))}
        </div>

        {/* ----- Members of the selected team ----- */}
        <div style={styles.card}>
          {!selected ? (
            <p style={styles.muted}>Select a team to see its members.</p>
          ) : (
            <>
              <h3 style={styles.cardTitle}>Members of {selected.team_name}</h3>

              {members.length === 0 && <p style={styles.muted}>No members yet.</p>}
              {members.map((m) => (
                <div key={m.id} style={styles.memberRow}>
                  <div>
                    <strong>{m.name}</strong>
                    <div style={styles.small}>
                      {m.username} · {m.roles.map((r) => r.role_name.replace("_", " ")).join(", ")}
                    </div>
                  </div>
                  {canManageMembers && (
                    <button className="btn-secondary" style={styles.secondary}
                      onClick={() => handleRemoveMember(m.id)}>
                      Remove
                    </button>
                  )}
                </div>
              ))}

              {/* Add member */}
              {canManageMembers && (
                <form style={{ ...styles.row, marginTop: 16 }} onSubmit={handleAddMember}>
                  {isAdmin ? (
                    <select style={{ ...styles.input, flex: 1 }} value={memberChoice}
                      onChange={(e) => setMemberChoice(e.target.value)} required>
                      <option value="">Select a user</option>
                      {availableUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.username})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input style={{ ...styles.input, flex: 1 }} type="number" min="1"
                      placeholder="User ID to add" value={memberChoice}
                      onChange={(e) => setMemberChoice(e.target.value)} required />
                  )}
                  <button style={styles.primary} type="submit">Add</button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  card: {
    background: "#FFFFFF", border: "1px solid #E2E8F0", color: "#172033",
    padding: 20, borderRadius: 10, marginBottom: 16,
    boxShadow: "0 1px 2px rgba(23,32,51,0.06)",
  },
  cardTitle: { marginTop: 0, color: "#0F766E" },
  columns: { display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 16, alignItems: "start" },
  row: { display: "flex", gap: 10 },
  input: {
    padding: 10, borderRadius: 6, border: "1px solid #E2E8F0",
    background: "#FFFFFF", color: "#172033", fontSize: 14,
  },
  primary: {
    padding: "10px 16px", border: "none", borderRadius: 6,
    background: "#0F766E", color: "#FFFFFF", cursor: "pointer", fontSize: 14,
  },
  secondary: {
    padding: "6px 12px", border: "1px solid #E2E8F0", borderRadius: 6,
    background: "#FFFFFF", color: "#172033", cursor: "pointer", fontSize: 13,
  },
  teamItem: { padding: 12, borderRadius: 8, marginBottom: 8, cursor: "pointer", color: "#172033" },
  memberRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "10px 0", borderBottom: "1px solid #E2E8F0",
  },
  small: { fontSize: 13, color: "#64748B", textTransform: "capitalize" },
  muted: { color: "#64748B" },
  error: {
    background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA",
    padding: 10, borderRadius: 6, marginBottom: 12,
  },
  success: {
    background: "#F0FDF4", color: "#166534", border: "1px solid #BBF7D0",
    padding: 10, borderRadius: 6, marginBottom: 12,
  },
};