// NetShield AI — Incident management (investigate, contain, close)
// Developed by Krish | SKK Projects
"use client";
import { useState } from "react";
import AppShell from "@/components/AppShell";
import { Empty, ErrorNote, Panel, Severity, Status } from "@/components/ui";
import { api, can, fmtDateTime, getUser } from "@/lib/api";
import { usePolling } from "@/lib/usePolling";

export default function IncidentsPage() {
  const user = getUser();
  const incidents = usePolling(() => api("/api/incidents"), 10000);
  const users = usePolling(() => (can(user, "analyst") ? api("/api/users") : Promise.resolve([])), 60000);
  const [openId, setOpenId] = useState(null);

  return (
    <AppShell title="Incidents">
      <ErrorNote message={incidents.error} />
      <Panel title="Security incidents" subtitle="An incident groups related alerts so the team can investigate them together">
        {!incidents.data ? <Empty>Loading...</Empty> : incidents.data.length === 0 ? (
          <Empty>No incidents yet. Create one from the Alerts page.</Empty>
        ) : (
          <div className="space-y-2">
            {incidents.data.map((i) => (
              <div key={i.id} className="rounded-md border border-rule">
                <button className="w-full flex flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-rule/30"
                  onClick={() => setOpenId(openId === i.id ? null : i.id)} aria-expanded={openId === i.id}>
                  <span className="text-muted">#{i.id}</span>
                  <span className="font-medium flex-1 min-w-[12rem]">{i.title}</span>
                  <Severity level={i.severity} />
                  <Status value={i.status} />
                  <span className="text-sm text-muted">{i.alert_count} alerts</span>
                  <span className="text-sm text-muted">{fmtDateTime(i.created_at)}</span>
                </button>
                {openId === i.id && <IncidentDetail id={i.id} users={users.data || []} canEdit={can(user, "analyst")} onSaved={incidents.refresh} />}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </AppShell>
  );
}

function IncidentDetail({ id, users, canEdit, onSaved }) {
  const detail = usePolling(() => api(`/api/incidents/${id}`), 15000);
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  if (!detail.data) return <Empty>Loading...</Empty>;
  const d = detail.data;
  const f = form || { status: d.status, severity: d.severity, notes: d.notes, assigned_to_id: d.assigned_to_id || "" };

  async function save() {
    setErr(""); setMsg("");
    try {
      await api(`/api/incidents/${id}`, { method: "PATCH", body: { ...f, assigned_to_id: f.assigned_to_id ? Number(f.assigned_to_id) : null } });
      setMsg("Incident saved."); setForm(null); detail.refresh(); onSaved();
    } catch (e) { setErr(e.message); }
  }

  return (
    <div className="border-t border-rule px-4 py-4 grid lg:grid-cols-2 gap-6">
      <div className="space-y-3">
        <p className="text-sm text-muted">{d.description}</p>
        {canEdit ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Status</label>
                <select className="input" value={f.status} onChange={(e) => setForm({ ...f, status: e.target.value })}>
                  {["open", "investigating", "contained", "closed"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Severity</label>
                <select className="input" value={f.severity} onChange={(e) => setForm({ ...f, severity: e.target.value })}>
                  {["Low", "Medium", "High", "Critical"].map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Assigned to</label>
              <select className="input" value={f.assigned_to_id} onChange={(e) => setForm({ ...f, assigned_to_id: e.target.value })}>
                <option value="">Unassigned</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.username}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Investigation notes</label>
              <textarea className="input min-h-[110px]" value={f.notes} onChange={(e) => setForm({ ...f, notes: e.target.value })}
                placeholder="What did you find? What action was taken?" />
            </div>
            <ErrorNote message={err} />
            {msg && <p className="text-sm text-sev-low">{msg}</p>}
            <button className="btn-primary" onClick={save}>Save incident</button>
            <p className="text-xs text-muted">Closing an incident also resolves all of its alerts.</p>
          </>
        ) : <p className="text-sm whitespace-pre-wrap">{d.notes || "No notes yet."}</p>}
      </div>
      <div>
        <h3 className="font-medium mb-2">Linked alerts</h3>
        <div className="overflow-x-auto max-h-80">
          <table className="table">
            <thead><tr><th>#</th><th>Alert</th><th>Severity</th><th>Source</th><th>Status</th></tr></thead>
            <tbody>
              {d.alerts.map((a) => (
                <tr key={a.id}><td className="text-muted">{a.id}</td><td>{a.title}</td><td><Severity level={a.severity} /></td>
                  <td className="ip">{a.src_ip}</td><td><Status value={a.status} /></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
