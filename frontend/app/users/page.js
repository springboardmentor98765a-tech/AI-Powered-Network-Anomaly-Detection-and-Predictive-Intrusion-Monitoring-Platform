// NetShield AI — Admin: users, roles, teams and audit log
// Developed by Krish | SKK Projects
"use client";
import { useState } from "react";
import AppShell from "@/components/AppShell";
import { Empty, ErrorNote, Panel } from "@/components/ui";
import { api, can, fmtDateTime, getUser } from "@/lib/api";
import { usePolling } from "@/lib/usePolling";

const EMPTY_USER = { username: "", email: "", full_name: "", password: "", role: "analyst", team_id: "" };

export default function UsersPage() {
  const me = getUser();
  const users = usePolling(() => api("/api/users"), 30000);
  const teams = usePolling(() => api("/api/teams"), 60000);
  const audit = usePolling(() => api("/api/audit-logs?limit=100"), 15000);
  const [form, setForm] = useState(EMPTY_USER);
  const [team, setTeam] = useState({ name: "", description: "" });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  if (!can(me, "admin")) return <AppShell title="Users and audit"><ErrorNote message="Only administrators can open this page." /></AppShell>;

  async function run(fn, success) {
    setErr(""); setMsg("");
    try { await fn(); setMsg(success); users.refresh(); teams.refresh(); audit.refresh(); return true; }
    catch (e) { setErr(e.message); return false; }
  }

  const createUser = async (e) => {
    e.preventDefault();
    const ok = await run(() => api("/api/users", { method: "POST", body: { ...form, team_id: form.team_id ? Number(form.team_id) : null } }), `User ${form.username} created.`);
    if (ok) setForm(EMPTY_USER);
  };
  const createTeam = async (e) => {
    e.preventDefault();
    const ok = await run(() => api("/api/teams", { method: "POST", body: team }), `Team ${team.name} created.`);
    if (ok) setTeam({ name: "", description: "" });
  };
  const patch = (u, body, text) => run(() => api(`/api/users/${u.id}`, { method: "PATCH", body }), text);
  const teamName = (id) => teams.data?.find((t) => t.id === id)?.name || "-";

  return (
    <AppShell title="Users and audit">
      <ErrorNote message={err || users.error} />
      {msg && <p className="text-sm text-sev-low" role="status">{msg}</p>}

      <div className="grid xl:grid-cols-3 gap-4">
        <Panel title="Team members" subtitle="Admins manage users. Analysts handle alerts. Viewers can only look." className="xl:col-span-2">
          {!users.data ? <Empty>Loading...</Empty> : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Username</th><th>Name</th><th>Email</th><th>Team</th><th>Role</th><th>Status</th></tr></thead>
                <tbody>
                  {users.data.map((u) => (
                    <tr key={u.id}>
                      <td className="font-medium">{u.username}</td><td>{u.full_name}</td><td className="text-muted">{u.email}</td>
                      <td>{teamName(u.team_id)}</td>
                      <td>
                        <select className="input w-auto py-1" value={u.role} disabled={u.id === me.id} aria-label={`Role for ${u.username}`}
                          onChange={(e) => patch(u, { role: e.target.value }, `${u.username} is now ${e.target.value}.`)}>
                          <option value="admin">admin</option><option value="analyst">analyst</option><option value="viewer">viewer</option>
                        </select>
                      </td>
                      <td>
                        <button className="btn-ghost" disabled={u.id === me.id}
                          onClick={() => patch(u, { is_active: !u.is_active }, `${u.username} ${u.is_active ? "disabled" : "enabled"}.`)}>
                          {u.is_active ? "Disable" : "Enable"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel title="Add a user">
            <form onSubmit={createUser} className="space-y-3">
              <input className="input" placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required minLength={3} aria-label="Username" />
              <input className="input" placeholder="Full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} aria-label="Full name" />
              <input className="input" type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required aria-label="Email" />
              <input className="input" type="password" placeholder="Password (6+ characters)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} aria-label="Password" />
              <div className="grid grid-cols-2 gap-2">
                <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} aria-label="Role">
                  <option value="analyst">analyst</option><option value="viewer">viewer</option><option value="admin">admin</option>
                </select>
                <select className="input" value={form.team_id} onChange={(e) => setForm({ ...form, team_id: e.target.value })} aria-label="Team">
                  <option value="">No team</option>
                  {(teams.data || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <button className="btn-primary">Add user</button>
            </form>
          </Panel>
          <Panel title="Teams">
            <ul className="text-sm space-y-1 mb-3">{(teams.data || []).map((t) => <li key={t.id}>{t.name} <span className="text-muted">{t.description}</span></li>)}</ul>
            <form onSubmit={createTeam} className="flex gap-2">
              <input className="input" placeholder="New team name" value={team.name} onChange={(e) => setTeam({ ...team, name: e.target.value })} required minLength={2} aria-label="Team name" />
              <button className="btn-ghost">Add</button>
            </form>
          </Panel>
        </div>
      </div>

      <Panel title="Audit log" subtitle="Every login and change is recorded here">
        {!audit.data ? <Empty>Loading...</Empty> : (
          <div className="overflow-x-auto max-h-[420px]">
            <table className="table">
              <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Details</th><th>IP</th></tr></thead>
              <tbody>
                {audit.data.map((l) => (
                  <tr key={l.id}><td className="text-muted">{fmtDateTime(l.timestamp)}</td><td>{l.username}</td>
                    <td className={l.action === "login_failed" ? "text-sev-critical" : ""}>{l.action}</td>
                    <td className="text-muted">{l.details}</td><td className="ip">{l.ip_address}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </AppShell>
  );
}
