// NetShield AI — Alert management: prioritised list, bulk actions, correlation, escalation
// Developed by Krish | SKK Projects
"use client";
import { useState } from "react";
import AppShell from "@/components/AppShell";
import { Empty, ErrorNote, Panel, RiskBar, Severity, Status } from "@/components/ui";
import { api, can, fmtDateTime, getUser } from "@/lib/api";
import { usePolling } from "@/lib/usePolling";

export default function AlertsPage() {
  const user = getUser();
  const canAct = can(user, "analyst");
  const [status, setStatus] = useState("open");
  const [severity, setSeverity] = useState("");
  const [selected, setSelected] = useState([]);
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");

  const qs = new URLSearchParams({ limit: "150" });
  if (status) qs.set("status", status);
  if (severity) qs.set("severity", severity);
  const alerts = usePolling(() => api(`/api/alerts?${qs}`), 6000);
  const groups = usePolling(() => api("/api/alerts/correlate?min_alerts=3"), 15000);

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const allIds = (alerts.data || []).map((a) => a.id);

  async function run(fn, success) {
    setActionError(""); setMessage("");
    try { await fn(); setMessage(success); setSelected([]); alerts.refresh(); groups.refresh(); }
    catch (e) { setActionError(e.message); }
  }

  const bulk = (newStatus) => run(
    () => api("/api/alerts/bulk", { method: "POST", body: { ids: selected, status: newStatus } }),
    `${selected.length} alert(s) marked ${newStatus}.`);

  const makeIncident = (ids, title, sev) => run(
    () => api("/api/incidents", { method: "POST", body: { title, severity: sev, alert_ids: ids, description: `Created from ${ids.length} alert(s).` } }),
    "Incident created. You can track it on the Incidents page.");

  return (
    <AppShell title="Alerts">
      <ErrorNote message={alerts.error || actionError} />
      {message && <p className="text-sm text-sev-low" role="status">{message}</p>}

      {canAct && groups.data?.length > 0 && (
        <Panel title="Correlated attackers" subtitle="Several open alerts from the same source are probably one attack. Group them into an incident.">
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {groups.data.slice(0, 6).map((g) => (
              <div key={g.src_ip} className="rounded-md border border-rule p-3">
                <div className="flex items-center justify-between">
                  <span className="ip">{g.src_ip}</span><Severity level={g.max_severity} />
                </div>
                <p className="text-sm text-muted mt-1">{g.alert_count} alerts: {g.attack_types.join(", ")}</p>
                <p className="text-sm text-muted">Targets: {g.targets.length} server(s)</p>
                <button className="btn-ghost mt-2" onClick={() => makeIncident(g.alert_ids, `Attack campaign from ${g.src_ip}`, g.max_severity)}>
                  Create incident
                </button>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel actions={
        <div className="flex flex-wrap gap-2">
          <select className="input w-auto py-1" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="">All statuses</option><option value="open">Open</option>
            <option value="acknowledged">Acknowledged</option><option value="resolved">Resolved</option>
          </select>
          <select className="input w-auto py-1" value={severity} onChange={(e) => setSeverity(e.target.value)} aria-label="Severity">
            <option value="">All severities</option>
            {["Critical", "High", "Medium", "Low"].map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>}
        title="Alert queue" subtitle="Sorted by priority: open first, then severity and risk">
        {canAct && selected.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">{selected.length} selected</span>
            <button className="btn-ghost" onClick={() => bulk("acknowledged")}>Acknowledge</button>
            <button className="btn-ghost" onClick={() => bulk("resolved")}>Resolve</button>
            <button className="btn-primary" onClick={() => makeIncident(selected, `Investigation of ${selected.length} alerts`, "High")}>Create incident</button>
          </div>
        )}
        {!alerts.data ? <Empty>Loading...</Empty> : alerts.data.length === 0 ? <Empty>No alerts match these filters.</Empty> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr>
                {canAct && <th><input type="checkbox" aria-label="Select all"
                  checked={selected.length > 0 && selected.length === allIds.length}
                  onChange={(e) => setSelected(e.target.checked ? allIds : [])} /></th>}
                <th>#</th><th>Raised</th><th>Alert</th><th>Severity</th><th>Source</th><th>Target</th><th>Risk</th><th>Status</th><th>Incident</th>
              </tr></thead>
              <tbody>
                {alerts.data.map((a) => (
                  <tr key={a.id}>
                    {canAct && <td><input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggle(a.id)} aria-label={`Select alert ${a.id}`} /></td>}
                    <td className="text-muted">{a.id}</td>
                    <td className="text-muted">{fmtDateTime(a.created_at)}</td>
                    <td>{a.title}<span className="block text-xs text-muted">{a.attack_type}</span></td>
                    <td><Severity level={a.severity} /></td>
                    <td className="ip">{a.src_ip}</td>
                    <td className="ip">{a.dst_ip}:{a.dst_port}</td>
                    <td><RiskBar score={a.risk_score} /></td>
                    <td><Status value={a.status} /></td>
                    <td className="text-muted">{a.incident_id ? `#${a.incident_id}` : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </AppShell>
  );
}
