import { useEffect, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Bell,
  Boxes,
  CircleUserRound,
  LogOut,
  Shield,
  ShieldAlert,
  Users,
} from "lucide-react";

const API = "/api";

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.detail || `Request failed (${response.status})`);
  }
  return body;
}

function Login({ onLogin }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await request("/auth/login", {
        method: "POST",
        body: JSON.stringify({ identifier, password }),
      });
      await onLogin();
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand-mark"><Shield size={22} /></div>
        <p className="eyebrow">NETSHIELD AI</p>
        <h1>Welcome back</h1>
        <p className="muted">Sign in to your network monitoring workspace.</p>
        <form onSubmit={submit} className="login-form">
          <label htmlFor="identifier">Email or username</label>
          <input
            id="identifier"
            autoComplete="username"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            required
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" disabled={busy}>
            {busy ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <p className="login-footnote">Access is protected by your assigned role.</p>
      </section>
    </main>
  );
}

function Stat({ icon: Icon, label, value, tone = "" }) {
  return (
    <article className="stat-card">
      <div className={`stat-icon ${tone}`}><Icon size={19} /></div>
      <div><p>{label}</p><strong>{value}</strong></div>
    </article>
  );
}

function Dashboard({ data, onLogout }) {
  const { user, nav, teams, stats, events, actions, roles } = data;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="NetShield AI home">
          <span className="brand-mark"><Shield size={20} /></span>
          <span><b>NetShield</b><small>AI SECURITY PLATFORM</small></span>
        </a>
        <p className="nav-caption">WORKSPACE</p>
        <nav>
          {nav.map((item) => {
            const href = item.href === "/dashboard" ? "/" : item.href;
            const Icon = item.label.includes("Team") ? Users
              : item.label.includes("Activity") ? Activity
                : item.label.includes("Alert") ? Bell
                  : item.label.includes("User") ? CircleUserRound
                    : item.label.includes("Audit") ? ShieldAlert : Boxes;
            return (
              <a className={item.href === "/dashboard" ? "nav-link active" : "nav-link"}
                href={href} key={item.href}>
                <Icon size={17} /><span>{item.label}</span>
                {item.href !== "/dashboard" && <ArrowUpRight size={14} className="nav-arrow" />}
              </a>
            );
          })}
        </nav>
        <div className="sidebar-note">
          <span className="status-dot" />
          <div><b>Platform active</b><small>Monitoring services online</small></div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumbs">Workspace <span>/</span> Overview</div>
          <div className="account">
            <div className="avatar">{user.name.trim().charAt(0).toUpperCase()}</div>
            <div className="account-name"><b>{user.name}</b><small>{data.role_label}</small></div>
            <button className="icon-button" onClick={onLogout} aria-label="Log out" title="Log out">
              <LogOut size={17} />
            </button>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div>
              <p className="eyebrow">SECURITY OVERVIEW</p>
              <h1>Good to see you, {user.name.split(" ")[0]}</h1>
              <p className="muted">Here’s a summary of your network monitoring workspace.</p>
            </div>
            <span className="date-chip"><span className="status-dot" /> Live workspace</span>
          </section>

          {stats && (
            <section className="stats-grid" aria-label="Platform statistics">
              <Stat icon={Users} label="Total users" value={stats.total_users} />
              <Stat icon={CircleUserRound} label="Active users" value={stats.active_users} tone="green" />
              <Stat icon={Boxes} label="Teams" value={stats.teams} tone="blue" />
              <Stat icon={ShieldAlert} label="Failed logins (24h)" value={stats.failed_logins_24h} tone="amber" />
            </section>
          )}

          <section className="content-grid">
            <article className="panel profile-panel">
              <div className="panel-heading"><div><p className="eyebrow">YOUR ACCOUNT</p><h2>Profile</h2></div>
                <CircleUserRound className="heading-icon" size={20} /></div>
              <div className="profile-identity">
                <div className="avatar large">{user.name.trim().charAt(0).toUpperCase()}</div>
                <div><b>{user.name}</b><span>{user.email}</span></div>
              </div>
              <dl className="profile-list">
                <div><dt>Role</dt><dd>{roles.join(", ")}</dd></div>
                <div><dt>Account status</dt><dd><span className="pill success">{user.status}</span></dd></div>
                <div><dt>Member since</dt><dd>{user.member_since}</dd></div>
                <div><dt>Last sign-in</dt><dd>{user.last_login}</dd></div>
              </dl>
            </article>

            <article className="panel actions-panel">
              <div className="panel-heading"><div><p className="eyebrow">ACCESS</p><h2>Your capabilities</h2></div>
                <Shield className="heading-icon" size={20} /></div>
              <ul className="action-list">
                {actions.map((action) => <li key={action}><span className="check-mark">✓</span>{action}</li>)}
              </ul>
            </article>
          </section>

          <section className="panel">
            <div className="panel-heading"><div><p className="eyebrow">TEAM ACCESS</p>
              <h2>{stats ? "All teams" : "Your teams"}</h2></div>
              <span className="count-chip">{teams.length} {teams.length === 1 ? "team" : "teams"}</span></div>
            {teams.length ? (
              <div className="table-wrap"><table>
                <thead><tr><th>Team</th><th>Description</th><th>Members</th>
                  {data.can_see_members && <th>Roster</th>}</tr></thead>
                <tbody>{teams.map((team) => <tr key={team.name}>
                  <td className="strong-cell">{team.name}</td><td>{team.description || "—"}</td>
                  <td>{team.member_count}</td>
                  {data.can_see_members && <td><div className="roster">
                    {team.members.map((member) => <span className="member-chip" key={member.name}>{member.name}</span>)}
                  </div></td>}
                </tr>)}</tbody>
              </table></div>
            ) : <p className="empty-state">You haven’t been assigned to a team yet.</p>}
          </section>

          {events && <section className="panel">
            <div className="panel-heading"><div><p className="eyebrow">SECURITY TRAIL</p><h2>Recent activity</h2></div>
              <a className="text-link" href="/admin/audit-logs">View audit logs <ArrowUpRight size={14} /></a></div>
            <div className="table-wrap"><table>
              <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Result</th></tr></thead>
              <tbody>{events.map((event, index) => <tr key={`${event.time}-${index}`}>
                <td>{event.time}</td><td>{event.actor}</td><td>{event.action}</td>
                <td><span className={`pill ${event.status === "success" ? "success" : "failure"}`}>{event.status}</span></td>
              </tr>)}</tbody>
            </table></div>
          </section>}
          <footer className="footer-note">NetShield AI <span>·</span> Role-based access enforced by the backend</footer>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const [dashboard, setDashboard] = useState(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  async function loadDashboard() {
    const data = await request("/dashboard");
    setDashboard(data);
    setError("");
  }

  useEffect(() => {
    let active = true;
    request("/auth/me")
      .then(() => request("/dashboard"))
      .then((data) => { if (active) setDashboard(data); })
      .catch(() => { if (active) setDashboard(null); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);

  async function logout() {
    try {
      await request("/auth/logout", { method: "POST" });
      setDashboard(null);
    } catch (reason) {
      setError(reason.message);
    }
  }

  if (checking) return <main className="loading-screen">Loading your secure workspace…</main>;
  if (dashboard) return <><Dashboard data={dashboard} onLogout={logout} />{error && <div className="toast-error">{error}</div>}</>;
  return <Login onLogin={loadDashboard} />;
}
