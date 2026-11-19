import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "./api";
import type { Audit, Team, User } from "./types";

type Session = { access_token: string; user: User; role: string };

function Login({ onLogin }: { onLogin: (session: Session) => void }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post<Session>("/api/auth/login", { identifier, password });
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));
      onLogin(data);
      navigate("/");
    } catch (requestError: any) {
      setError(requestError.response?.data?.detail || "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="login-shell"><form className="card login-card" onSubmit={submit}>
    <p className="eyebrow">SENTINEL PLATFORM</p><h1>Security access</h1>
    <p className="muted">Sign in to manage users, teams, and audit activity.</p>
    <label>Username or email<input required value={identifier} onChange={(e) => setIdentifier(e.target.value)} /></label>
    <label>Password<input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
    {error && <div className="error">{error}</div>}
    <button disabled={busy}>{busy ? "Authenticating..." : "Sign in"}</button>
    <small className="muted">Development seed: admin / Admin123!</small>
  </form></main>;
}

function App() {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });
  const [section, setSection] = useState("Overview");
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isAdmin = user?.role.role_name === "Administrator";
  async function load() {
    if (!user) return;
    setLoading(true); setError("");
    try {
      if (isAdmin) {
        const [u, t, a] = await Promise.all([
          api.get("/api/users/"), api.get("/api/teams/"), api.get("/api/audit-logs/"),
        ]);
        setUsers(u.data.items); setTeams(t.data.items); setAudit(a.data.items);
      } else {
        const response = await api.get("/api/teams/");
        setTeams(response.data.items);
      }
    } catch (requestError: any) {
      setError(requestError.response?.data?.detail || "Could not load platform data.");
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [isAdmin, user]);

  if (!user) return <Login onLogin={(session) => setUser(session.user)} />;

  async function logout() {
    try { await api.post("/api/auth/logout"); } finally {
      localStorage.clear(); setUser(null);
    }
  }
  async function createTeam() {
    const name = window.prompt("Team name");
    if (!name) return;
    try { await api.post("/api/teams/", { team_name: name }); await load(); }
    catch (requestError: any) { setError(requestError.response?.data?.detail || "Unable to create team."); }
  }

  const cards = isAdmin
    ? [["Users", users.length], ["Active users", users.filter((item) => item.is_active).length], ["Teams", teams.length], ["Audit events", audit.length]]
    : [["Assigned teams", teams.length], ["Role", user.role.role_name], ["Account", user.is_active ? "Active" : "Inactive"]];

  return <div className="app-shell"><aside><div className="brand"><span>◆</span> SENTINEL</div>
    <p className="muted">Identity & access control</p>
    {["Overview", ...(isAdmin ? ["Users", "Teams", "Audit logs"] : ["Teams"])].map((item) =>
      <button key={item} className={section === item ? "nav active" : "nav"} onClick={() => setSection(item)}>{item}</button>)}
    <button className="nav logout" onClick={logout}>Sign out</button>
  </aside><main className="content"><header><div><p className="eyebrow">CONTROL CENTER</p><h1>{section}</h1></div><div className="profile"><strong>{user.name}</strong><span>{user.role.role_name}</span></div></header>
    {error && <div className="error">{error}</div>}{loading && <p className="muted">Loading current data...</p>}
    {section === "Overview" && <><div className="cards">{cards.map(([label, value]) => <div className="card stat" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><section className="card"><h2>Access posture</h2><p className="muted">Backend-enforced role permissions and audit trails protect this workspace.</p></section></>}
    {section === "Users" && <section className="card"><h2>Users</h2><div className="table-wrap"><table><thead><tr><th>Name</th><th>Username</th><th>Email</th><th>Role</th><th>Status</th></tr></thead><tbody>{users.map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.username}</td><td>{item.email}</td><td>{item.role?.role_name || "—"}</td><td><span className={item.is_active ? "pill good" : "pill"}>{item.is_active ? "Active" : "Inactive"}</span></td></tr>)}</tbody></table></div></section>}
    {section === "Teams" && <section className="card"><div className="section-head"><h2>Teams</h2>{isAdmin && <button onClick={createTeam}>Create team</button>}</div><div className="table-wrap"><table><thead><tr><th>Team</th><th>Description</th><th>Members</th><th>Created</th></tr></thead><tbody>{teams.map((team) => <tr key={team.id}><td>{team.team_name}</td><td>{team.description || "—"}</td><td>{team.member_count}</td><td>{new Date(team.created_at).toLocaleDateString()}</td></tr>)}</tbody></table></div></section>}
    {section === "Audit logs" && <section className="card"><h2>Audit logs</h2><div className="table-wrap"><table><thead><tr><th>Action</th><th>Target</th><th>Status</th><th>Timestamp</th></tr></thead><tbody>{audit.map((item) => <tr key={item.id}><td>{item.action}</td><td>{item.target_type} #{item.target_id ?? "—"}</td><td>{item.status}</td><td>{new Date(item.timestamp).toLocaleString()}</td></tr>)}</tbody></table></div></section>}
  </main></div>;
}

export default App;
