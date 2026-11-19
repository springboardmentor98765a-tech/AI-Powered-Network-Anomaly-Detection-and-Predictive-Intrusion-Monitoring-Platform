import { useEffect, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Bell,
  Boxes,
  CircleUserRound,
  Database,
  LogOut,
  RefreshCw,
  Shield,
  ShieldAlert,
  Users,
} from "lucide-react";

const API = "/api";
const CHART_COLORS = ["#35c7a2", "#8d78f6", "#f0ac55", "#46a6ff", "#ef6c89", "#8b9bb4"];

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
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("security_analyst");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (isRegistering && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await request(isRegistering ? "/auth/register" : "/auth/login", {
        method: "POST",
        body: JSON.stringify(isRegistering
          ? {
            name,
            email: identifier,
            password,
            confirm_password: confirmPassword,
            role,
          }
          : { identifier, password }),
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
        <h1>{isRegistering ? "Create your account" : "Welcome back"}</h1>
        <p className="muted">
          {isRegistering
            ? "Register to access your network monitoring workspace."
            : "Sign in to your network monitoring workspace."}
        </p>
        <form onSubmit={submit} className="login-form">
          {isRegistering && <>
            <label htmlFor="name">Full name</label>
            <input id="name" autoComplete="name" maxLength={100} value={name}
              onChange={(event) => setName(event.target.value)} required />
          </>}
          <label htmlFor="identifier">{isRegistering ? "Email address" : "Email or username"}</label>
          <input id="identifier" type={isRegistering ? "email" : "text"} autoComplete="username"
            value={identifier} onChange={(event) => setIdentifier(event.target.value)} required />
          <label htmlFor="password">Password</label>
          <input id="password" type="password"
            autoComplete={isRegistering ? "new-password" : "current-password"}
            minLength={isRegistering ? 8 : undefined} maxLength={isRegistering ? 72 : undefined}
            value={password} onChange={(event) => setPassword(event.target.value)} required />
          {isRegistering && <>
            <label htmlFor="confirm-password">Confirm password</label>
            <input id="confirm-password" type="password" autoComplete="new-password"
              minLength={8} maxLength={72} value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)} required />
            <label htmlFor="role">Job role</label>
            <select id="role" value={role} onChange={(event) => setRole(event.target.value)} required>
              <option value="security_analyst">Security Analyst</option>
              <option value="team_lead">Team Lead / Supervisor</option>
            </select>
          </>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" disabled={busy}>
            {busy
              ? (isRegistering ? "Creating account..." : "Signing in...")
              : (isRegistering ? "Create account" : "Sign in")}
          </button>
        </form>
        {isRegistering && <p className="login-footnote">
          Select one job role. Administrator access can only be assigned by an administrator.
        </p>}
        <p className="auth-switch">
          {isRegistering ? "Already have an account?" : "Need an account?"}{" "}
          <button type="button" className="auth-switch-button" onClick={() => {
            setIsRegistering(!isRegistering);
            setError("");
          }}>
            {isRegistering ? "Sign in" : "Sign up"}
          </button>
        </p>
      </section>
    </main>
  );
}

function Stat({ icon: Icon, label, value, tone = "" }) {
  return (
    <article className="stat-card">
      <div className={`stat-icon ${tone}`}><Icon size={20} /></div>
      <div><p>{label}</p><strong>{value}</strong></div>
    </article>
  );
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (bytes < 1000) return `${formatNumber(bytes)} B`;
  if (bytes < 1000000) return `${(bytes / 1000).toFixed(1)} KB`;
  if (bytes < 1000000000) return `${(bytes / 1000000).toFixed(1)} MB`;
  return `${(bytes / 1000000000).toFixed(1)} GB`;
}

function LabelChart({ labels, selected, onSelect, loading, error }) {
  const total = labels.reduce((sum, item) => sum + item.count, 0);
  const circumference = 2 * Math.PI * 48;
  let offset = 0;
  if (loading) {
    return (
      <div className="analytics-donut-layout chart-loading" role="status" aria-label="Loading label distribution">
        <div className="analytics-donut">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle cx="60" cy="60" r="48" className="donut-track" />
            <circle cx="60" cy="60" r="48" className="chart-skeleton-ring"
              strokeDasharray={`${circumference * 0.28} ${circumference * 0.72}`}
              transform="rotate(-90 60 60)" />
            <text x="60" y="64" className="donut-total">...</text>
          </svg>
        </div>
        <div className="analytics-legend" aria-hidden="true">
          {[0, 1, 2, 3].map((item) => <span className="chart-skeleton-row" key={item} />)}
        </div>
        <span className="chart-loading-text">Loading label counts…</span>
      </div>
    );
  }
  if (error) return <p className="chart-empty">Label data is unavailable.</p>;

  return (
    <div className="analytics-donut-layout">
      <div className="analytics-donut">
        <svg viewBox="0 0 120 120" role="img" aria-label="Flow label distribution">
          <circle cx="60" cy="60" r="48" className="donut-track" />
          {labels.map((item, index) => {
            const length = total ? (item.count / total) * circumference : 0;
            const segment = (
              <circle key={item.name} cx="60" cy="60" r="48" fill="none"
                stroke={CHART_COLORS[index % CHART_COLORS.length]} strokeWidth="14"
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-offset} transform="rotate(-90 60 60)">
                <title>{item.name}: {formatNumber(item.count)} flows</title>
              </circle>
            );
            offset += length;
            return segment;
          })}
          <text x="60" y="57" className="donut-total">{formatNumber(total)}</text>
          <text x="60" y="74" className="donut-caption">flows</text>
        </svg>
      </div>
      <div className="analytics-legend">
        {labels.map((item, index) => (
          <button type="button" key={item.name}
            className={selected === item.name ? "legend-item selected" : "legend-item"}
            onClick={() => onSelect(selected === item.name ? "" : item.name)}
            title={`Click to filter by ${item.name}`}>
            <i style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />
            <span>{item.name}</span><b>{formatNumber(item.count)}</b>
          </button>
        ))}
        {!labels.length && <span className="chart-empty">No flows match the current selection.</span>}
      </div>
    </div>
  );
}

function TrendChart({ points, loading, error }) {
  if (loading) {
    const heights = [52, 94, 68, 128, 83, 148, 105, 62, 120, 76, 138, 91];
    return (
      <div className="trend-chart-loading" role="status" aria-label="Loading traffic chart">
        <svg className="analytics-trend" viewBox="0 0 760 235" aria-hidden="true">
          {[18, 73, 128, 184].map((y) => (
            <line key={y} x1="0" x2="760" y1={y} y2={y} className="chart-gridline" />
          ))}
          {heights.map((height, index) => (
            <rect key={index} x={index * 62 + 12} y={184 - height} width="24" height={height}
              rx="3" className="chart-skeleton-bar" />
          ))}
        </svg>
        <span className="chart-loading-text">Loading traffic history…</span>
      </div>
    );
  }
  if (error) return <p className="chart-empty">Traffic data is unavailable.</p>;
  if (!points.length) return <p className="chart-empty">No timestamped flows are available for this selection.</p>;
  const width = 760;
  const height = 235;
  const top = 18;
  const baseline = 184;
  const max = Math.max(1, ...points.map((point) => point.flows));
  const step = width / points.length;
  const barWidth = Math.max(4, Math.min(21, step * 0.56));
  const labelStep = Math.max(1, Math.ceil(points.length / 6));
  return (
    <svg className="analytics-trend" viewBox={`0 0 ${width} ${height}`}
      role="img" aria-label="Hourly benign and non-benign flow counts">
      {[0, 1, 2, 3].map((line) => {
        const y = top + ((baseline - top) / 3) * line;
        return <line key={line} x1="0" x2={width} y1={y} y2={y} className="chart-gridline" />;
      })}
      {points.map((point, index) => {
        const x = step * index + (step - barWidth) / 2;
        const benignHeight = (point.benign / max) * (baseline - top);
        const threatHeight = (point.threats / max) * (baseline - top);
        return (
          <g key={`${point.time}-${index}`}>
            <rect x={x} y={baseline - benignHeight} width={barWidth} height={benignHeight}
              rx="3" fill="#35c7a2">
              <title>{point.time}: {formatNumber(point.benign)} benign flows</title>
            </rect>
            <rect x={x} y={baseline - benignHeight - threatHeight} width={barWidth}
              height={threatHeight} rx="3" fill="#8d78f6">
              <title>{point.time}: {formatNumber(point.threats)} non-benign flows</title>
            </rect>
            {index % labelStep === 0 && (
              <text x={x + barWidth / 2} y="216" textAnchor="middle" className="chart-axis-label">
                {point.time}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function Dashboard({ data, onLogout }) {
  const { user, nav, teams, stats, events, actions, roles } = data;
  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [selectedLabel, setSelectedLabel] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams();
    if (selectedLabel) params.set("label", selectedLabel);
    const query = params.toString();
    setSummaryLoading(true);
    request(`/monitoring/summary${query ? `?${query}` : ""}`)
      .then((result) => {
        if (active) {
          setSummary(result);
          setSummaryError("");
        }
      })
      .catch((reason) => {
        if (active) setSummaryError(reason.message);
      })
      .finally(() => {
        if (active) setSummaryLoading(false);
      });
    return () => { active = false; };
  }, [selectedLabel, refreshKey]);

  const firstName = user.name.trim().split(/\s+/)[0] || user.name;
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
            const href = item.href === "/dashboard" ? "/dashboard" : item.href;
            const Icon = item.label.includes("Team") ? Users
              : item.label.includes("Activity") ? Activity
                : item.label.includes("Alert") ? Bell
                  : item.label.includes("User") ? CircleUserRound
                    : item.label.includes("Audit") ? ShieldAlert : Boxes;
            return (
              <a className={item.href === "/dashboard" ? "nav-link active" : "nav-link"}
                href={href} key={item.href}>
                <Icon size={18} /><span>{item.label}</span>
                {item.href !== "/dashboard" && <ArrowUpRight size={15} className="nav-arrow" />}
              </a>
            );
          })}
        </nav>
        <div className="sidebar-note">
          <span className="status-dot" />
          <div><b>Dataset ready</b><small>Full CIC-IDS 2018 CSV</small></div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumbs">Workspace <span>/</span> Overview</div>
          <div className="account">
            <div className="avatar">{user.name.trim().charAt(0).toUpperCase()}</div>
            <div className="account-name"><b>{user.name}</b><small>{data.role_label}</small></div>
            <button className="icon-button" onClick={onLogout} aria-label="Log out" title="Log out">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div>
              <p className="eyebrow">SECURITY OVERVIEW</p>
              <h1>Good to see you, {firstName}</h1>
              <p className="muted">Here’s a summary of your network monitoring workspace.</p>
            </div>
            <div className="dashboard-actions">
              <span className="date-chip"><span className="status-dot" /> CIC-IDS 2018 · historical data</span>
              <button className="icon-button refresh-button" type="button" onClick={() => setRefreshKey((key) => key + 1)}
                aria-label="Refresh dashboard data" title="Refresh dashboard data">
                <RefreshCw size={17} />
              </button>
            </div>
          </section>

          {stats && (
            <section className="stats-grid" aria-label="Platform statistics">
              <Stat icon={Users} label="Total users" value={formatNumber(stats.total_users)} />
              <Stat icon={CircleUserRound} label="Active users" value={formatNumber(stats.active_users)} tone="green" />
              <Stat icon={Boxes} label="Teams" value={formatNumber(stats.teams)} tone="blue" />
              <Stat icon={ShieldAlert} label="Failed logins (24h)" value={formatNumber(stats.failed_logins_24h)} tone="amber" />
            </section>
          )}

          {summaryError && <p className="dashboard-error" role="alert">
            Could not load network charts: {summaryError}
          </p>}
          {summaryLoading && !summary && !summaryError && (
            <p className="dashboard-loading-note">
              Calculating charts from the full CIC-IDS 2018 file. The first load may take a little while.
            </p>
          )}
          {summary && (
            <section className="stats-grid dataset-stats" aria-label="Full dataset counts">
              <Stat icon={Activity} label="Total dataset flows" value={formatNumber(summary.total_flows)} />
              <Stat icon={Shield} label="Benign flows" value={formatNumber(summary.benign_flows)} tone="green" />
              <Stat icon={ShieldAlert} label="Non-benign flows" value={formatNumber(summary.threat_flows)} tone="amber" />
              <Stat icon={Database} label="Observed bytes" value={formatBytes(summary.total_bytes)} tone="blue" />
            </section>
          )}

          {summary && selectedLabel && (
            <div className="chart-filter-note">
              Showing <b>{selectedLabel}</b> flows.
              <button type="button" onClick={() => setSelectedLabel("")}>Show all labels</button>
            </div>
          )}

          <section className="analytics-grid" aria-label="Network analytics charts" aria-busy={summaryLoading}>
            <article className="analytics-panel trend-panel">
              <div className="analytics-heading">
                <div><p className="eyebrow">FLOW VOLUME</p><h2>Traffic over time</h2></div>
                <span className="chart-unit">Flows per hour</span>
              </div>
              <div className="chart-key">
                <span><i className="key-benign" /> Benign</span>
                <span><i className="key-threat" /> Non-benign</span>
              </div>
              <TrendChart points={summary?.trend ?? []} loading={summaryLoading && !summary}
                error={Boolean(summaryError && !summary)} />
            </article>
            <article className="analytics-panel distribution-panel">
              <div className="analytics-heading">
                <div><p className="eyebrow">CLASSIFICATION</p><h2>Label distribution</h2></div>
                <span className="chart-unit">Click a label to filter</span>
              </div>
              <LabelChart labels={summary?.labels ?? []} selected={selectedLabel} onSelect={setSelectedLabel}
                loading={summaryLoading && !summary} error={Boolean(summaryError && !summary)} />
            </article>
          </section>

          <section className="content-grid">
            <article className="panel profile-panel">
              <div className="panel-heading"><div><p className="eyebrow">YOUR ACCOUNT</p><h2>Profile</h2></div>
                <CircleUserRound className="heading-icon" size={21} /></div>
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
                <Shield className="heading-icon" size={21} /></div>
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
              <a className="text-link" href="/admin/audit-logs">View audit logs <ArrowUpRight size={15} /></a></div>
            <div className="table-wrap"><table>
              <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Result</th></tr></thead>
              <tbody>{events.map((event, index) => <tr key={`${event.time}-${index}`}>
                <td>{event.time}</td><td>{event.actor}</td><td>{event.action}</td>
                <td><span className={`pill ${event.status === "success" ? "success" : "failure"}`}>{event.status}</span></td>
              </tr>)}</tbody>
            </table></div>
          </section>}
          <footer className="footer-note">NetShield AI <span>·</span> Charts use the full historical CSV and do not represent live traffic.</footer>
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
    const result = await request("/dashboard");
    setDashboard(result);
    setError("");
  }

  useEffect(() => {
    let active = true;
    request("/auth/me")
      .then(() => request("/dashboard"))
      .then((result) => { if (active) setDashboard(result); })
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
