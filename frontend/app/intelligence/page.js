// NetShield AI — Threat intelligence report + AI model performance
// Developed by Krish | SKK Projects
"use client";
import { useState } from "react";
import AppShell from "@/components/AppShell";
import { BarChart } from "@/components/Charts";
import { Empty, ErrorNote, Panel, RiskBar, Stat } from "@/components/ui";
import { api, can, downloadText, fmtDateTime, getUser } from "@/lib/api";
import { usePolling } from "@/lib/usePolling";

const pct = (v) => `${(v * 100).toFixed(1)}%`;

export default function IntelligencePage() {
  const user = getUser();
  const intel = usePolling(() => api("/api/analytics/threat-intel?minutes=1440"), 15000);
  const metrics = usePolling(() => api("/api/detection/metrics"), 20000);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function downloadReport() {
    try {
      const text = await api("/api/analytics/report?minutes=1440", { text: true });
      downloadText(`netshield-threat-report-${new Date().toISOString().slice(0, 10)}.md`, text);
    } catch (e) { setErr(e.message); }
  }

  async function downloadModelReport() {
    try { downloadText("netshield-detection-report.md", await api("/api/detection/report", { text: true })); }
    catch (e) { setErr(e.message); }
  }

  async function retrain() {
    setErr(""); setMsg("");
    try { const r = await api("/api/detection/retrain", { method: "POST" }); setMsg(r.message); }
    catch (e) { setErr(e.message); }
  }

  return (
    <AppShell title="Threat intelligence" actions={
      <>
        <button className="btn-ghost" onClick={downloadModelReport}>Download model report</button>
        <button className="btn-primary" onClick={downloadReport}>Download threat report</button>
      </>}>
      <ErrorNote message={intel.error || err} />
      {msg && <p className="text-sm text-sev-low">{msg}</p>}

      {intel.data && (
        <div className="grid lg:grid-cols-3 gap-4">
          <Panel title="Top attackers" subtitle="Last 24 hours, with reputation from the threat feed" className="lg:col-span-2">
            {intel.data.top_attackers.length === 0 ? <Empty>No attackers seen.</Empty> : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead><tr><th>IP address</th><th>Attacks</th><th>Main attack</th><th>Reputation</th><th>Country</th><th>Max risk</th></tr></thead>
                  <tbody>
                    {intel.data.top_attackers.map((a) => (
                      <tr key={a.ip}>
                        <td className="ip">{a.ip}</td><td className="tabular-nums">{a.attacks}</td><td>{a.main_attack}</td>
                        <td className={a.reputation === "Unknown" ? "text-muted" : "text-sev-critical"}>{a.reputation}</td>
                        <td>{a.country}</td><td><RiskBar score={a.max_risk} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
          <Panel title="Most targeted services">
            <BarChart horizontal labels={intel.data.top_targets.map((t) => t.target)} data={intel.data.top_targets.map((t) => t.attacks)} height={300} label="Attacks" />
          </Panel>
        </div>
      )}

      {metrics.data && <ModelSection m={metrics.data} isAdmin={can(user, "admin")} onRetrain={retrain} />}
    </AppShell>
  );
}

function ModelSection({ m, isAdmin, onRetrain }) {
  const max = Math.max(...m.confusion_matrix.flat());
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Detection accuracy" value={pct(m.classifier.accuracy)} tone="signal" hint={`${m.best_model} classifier`} />
        <Stat label="F1-score" value={pct(m.classifier.f1)} hint={`Precision ${pct(m.classifier.precision)}, recall ${pct(m.classifier.recall)}`} />
        <Stat label="Threat detection rate" value={pct(m.security.detection_rate)} tone="low" />
        <Stat label="False positive rate" value={pct(m.security.false_positive_rate)} tone="medium" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Model comparison" subtitle={`Trained ${fmtDateTime(m.trained_at)} on ${m.data_source}, ${m.rows_used.toLocaleString()} rows`}
          actions={isAdmin && <button className="btn-ghost" onClick={onRetrain} disabled={m.training_in_progress}>{m.training_in_progress ? "Training..." : "Retrain models"}</button>}>
          <table className="table">
            <thead><tr><th>Model</th><th>Accuracy</th><th>Precision</th><th>Recall</th><th>F1</th></tr></thead>
            <tbody>
              {Object.entries(m.models).map(([name, r]) => (
                <tr key={name}><td>{name}{name === m.best_model && <span className="ml-2 text-xs text-signal">selected</span>}</td>
                  <td>{pct(r.accuracy)}</td><td>{pct(r.precision)}</td><td>{pct(r.recall)}</td><td>{pct(r.f1)}</td></tr>
              ))}
              <tr><td>Isolation Forest <span className="text-xs text-muted">(anomaly)</span></td>
                <td>{pct(m.anomaly_detector.accuracy)}</td><td>{pct(m.anomaly_detector.precision)}</td>
                <td>{pct(m.anomaly_detector.recall)}</td><td>{pct(m.anomaly_detector.f1)}</td></tr>
            </tbody>
          </table>
          <h3 className="font-medium mt-5 mb-2">Per attack type</h3>
          <table className="table">
            <thead><tr><th>Class</th><th>Precision</th><th>Recall</th><th>F1</th><th>Test rows</th></tr></thead>
            <tbody>
              {m.labels.map((l) => (
                <tr key={l}><td>{l}</td><td>{pct(m.per_class[l].precision)}</td><td>{pct(m.per_class[l].recall)}</td>
                  <td>{pct(m.per_class[l]["f1-score"])}</td><td className="tabular-nums">{m.per_class[l].support}</td></tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Confusion matrix" subtitle="Rows are the true class, columns are what the model predicted. A perfect model has numbers only on the diagonal.">
          <div className="overflow-x-auto">
            <table className="text-xs">
              <thead><tr><th></th>{m.labels.map((l) => <th key={l} className="px-2 py-1 font-medium text-muted">{l}</th>)}</tr></thead>
              <tbody>
                {m.confusion_matrix.map((row, i) => (
                  <tr key={i}>
                    <th className="pr-2 py-1 text-right font-medium text-muted">{m.labels[i]}</th>
                    {row.map((v, j) => (
                      <td key={j} className="px-2 py-2 text-center tabular-nums rounded"
                        style={{ background: v ? `rgba(${i === j ? "79,179,201" : "229,72,77"},${0.12 + 0.75 * (v / max)})` : "transparent" }}>
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </>
  );
}
