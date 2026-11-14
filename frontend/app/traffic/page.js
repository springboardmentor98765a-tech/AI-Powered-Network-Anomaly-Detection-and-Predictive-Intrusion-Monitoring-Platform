// NetShield AI — Network monitoring: live flows, protocol analysis, CSV upload
// Developed by Krish | SKK Projects
"use client";
import { useState } from "react";
import AppShell from "@/components/AppShell";
import { BarChart, DoughnutChart } from "@/components/Charts";
import { Empty, ErrorNote, Panel, RiskBar, Severity, Stat } from "@/components/ui";
import { api, can, fmtBytes, fmtTime, getUser } from "@/lib/api";
import { usePolling } from "@/lib/usePolling";

const ATTACKS = ["", "BENIGN", "DDoS", "PortScan", "BruteForce", "WebAttack", "Botnet"];

export default function TrafficPage() {
  const user = getUser();
  const [live, setLive] = useState(true);
  const [threatsOnly, setThreatsOnly] = useState(false);
  const [attack, setAttack] = useState("");

  const params = new URLSearchParams({ limit: "60" });
  if (threatsOnly) params.set("threats_only", "true");
  if (attack) params.set("attack", attack);

  const flows = usePolling(() => api(`/api/traffic/flows?${params}`), 4000, live);
  const stats = usePolling(() => api("/api/traffic/stats?minutes=60"), 8000, live);

  return (
    <AppShell title="Network traffic" actions={
      <button className="btn-ghost" onClick={() => setLive(!live)} aria-pressed={live}>
        {live ? "Pause live view" : "Resume live view"}
      </button>}>
      <ErrorNote message={flows.error || stats.error} />

      {stats.data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat label="Flows (1 h)" value={stats.data.flows.toLocaleString()} />
            <Stat label="Packets (1 h)" value={stats.data.total_packets.toLocaleString()} />
            <Stat label="Data moved (1 h)" value={fmtBytes(stats.data.total_bytes)} />
            <Stat label="Protocols seen" value={Object.keys(stats.data.protocols).length} />
          </div>
          <div className="grid lg:grid-cols-3 gap-4">
            <Panel title="Protocol analysis">
              <DoughnutChart labels={Object.keys(stats.data.protocols)} data={Object.values(stats.data.protocols)}
                colors={["#4FB3C9", "#B48EDB", "#E3B341", "#7FB685"]} height={200} />
            </Panel>
            <Panel title="Top talkers" subtitle="Source IPs with most flows">
              <BarChart horizontal labels={stats.data.top_sources.map((s) => s.ip)} data={stats.data.top_sources.map((s) => s.flows)} height={200} label="Flows" />
            </Panel>
            <Panel title="Most used ports">
              <BarChart labels={stats.data.top_ports.map((p) => String(p.port))} data={stats.data.top_ports.map((p) => p.flows)} height={200} label="Flows" />
            </Panel>
          </div>
        </>
      )}

      {can(user, "analyst") && <UploadPanel onDone={flows.refresh} />}

      <Panel title="Live flows" subtitle="Every row has been checked by the AI models" actions={
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={threatsOnly} onChange={(e) => setThreatsOnly(e.target.checked)} /> Threats only
          </label>
          <select className="input w-auto py-1" value={attack} onChange={(e) => setAttack(e.target.value)} aria-label="Filter by prediction">
            {ATTACKS.map((a) => <option key={a} value={a}>{a || "All predictions"}</option>)}
          </select>
        </div>}>
        {!flows.data ? <Empty>Loading...</Empty> : flows.data.length === 0 ? <Empty>No flows match this filter.</Empty> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Time</th><th>Source</th><th>Destination</th><th>Proto</th><th>Packets</th><th>Bytes</th><th>AI prediction</th><th>Anomaly</th><th>Risk</th></tr></thead>
              <tbody>
                {flows.data.map((f) => (
                  <tr key={f.id}>
                    <td className="text-muted">{fmtTime(f.timestamp)}</td>
                    <td className="ip">{f.src_ip}{f.threat_intel_hit && <span className="ml-1 text-sev-critical" title="Known-bad IP">●</span>}</td>
                    <td className="ip">{f.dst_ip}:{f.dst_port}</td>
                    <td>{f.protocol}</td>
                    <td className="tabular-nums">{f.fwd_packets + f.bwd_packets}</td>
                    <td className="tabular-nums">{fmtBytes(Math.round(f.fwd_bytes + f.bwd_bytes))}</td>
                    <td>{f.predicted_attack === "BENIGN" ? <span className="text-muted">Normal</span> :
                      <span className="text-sev-high font-medium">{f.predicted_attack} <span className="text-muted font-normal">{Math.round(f.attack_probability * 100)}%</span></span>}</td>
                    <td>{f.is_anomaly ? <Severity level="Medium" /> : <span className="text-muted">-</span>}</td>
                    <td><RiskBar score={f.risk_score} /></td>
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

function UploadPanel({ onDone }) {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function upload() {
    if (!file) return;
    setBusy(true); setError(""); setResult(null);
    const form = new FormData();
    form.append("file", file);
    try {
      setResult(await api("/api/traffic/upload", { method: "POST", form }));
      onDone();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  return (
    <Panel title="Analyse a traffic file" subtitle="Upload a CSV exported from CICFlowMeter, CICIDS2017, or the sample file in backend/data">
      <div className="flex flex-wrap items-center gap-3">
        <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files[0])} className="text-sm" aria-label="CSV file" />
        <button className="btn-primary" onClick={upload} disabled={!file || busy}>{busy ? "Analysing..." : "Analyse file"}</button>
      </div>
      <div className="mt-3"><ErrorNote message={error} /></div>
      {result && (
        <p className="mt-3 text-sm">
          Analysed {result.rows_processed} flows:{" "}
          {Object.entries(result.predictions).map(([k, v]) => `${k} ${v}`).join(", ")}
        </p>
      )}
    </Panel>
  );
}
