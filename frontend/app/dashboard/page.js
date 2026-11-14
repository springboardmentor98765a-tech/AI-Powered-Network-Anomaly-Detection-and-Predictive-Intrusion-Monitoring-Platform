// NetShield AI — Overview dashboard (security metrics, attack trends, forecast)
// Developed by Krish | SKK Projects
"use client";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { BarChart, COLORS, DoughnutChart, LineChart } from "@/components/Charts";
import { Empty, ErrorNote, Panel, RiskBar, Severity, Stat } from "@/components/ui";
import { api, fmtTime } from "@/lib/api";
import { usePolling } from "@/lib/usePolling";

async function loadDashboard() {
  const [overview, timeline, types, severity, forecast, alerts] = await Promise.all([
    api("/api/analytics/overview?minutes=60"),
    api("/api/analytics/timeline?minutes=120&bucket=5"),
    api("/api/analytics/attack-types?minutes=120"),
    api("/api/analytics/severity?minutes=120"),
    api("/api/detection/forecast?bucket_minutes=10&history=12&horizon=6"),
    api("/api/alerts?status=open&limit=6"),
  ]);
  return { overview, timeline, types, severity, forecast, alerts };
}

function threatLevel(ov, fc) {
  if (ov.critical_open_alerts > 10 || ov.attack_share > 0.3) return "Critical";
  if (ov.critical_open_alerts > 0 || ov.attack_share > 0.15) return "High";
  if (ov.attack_share > 0.05 || fc.trend === "rising") return "Medium";
  return "Low";
}

const LEVEL_BAND = {
  Low: "border-sev-low bg-sev-low/10", Medium: "border-sev-medium bg-sev-medium/10",
  High: "border-sev-high bg-sev-high/10", Critical: "border-sev-critical bg-sev-critical/10",
};
const LEVEL_TEXT = { Low: "text-sev-low", Medium: "text-sev-medium", High: "text-sev-high", Critical: "text-sev-critical" };

export default function Dashboard() {
  const { data, error } = usePolling(loadDashboard, 5000);

  return (
    <AppShell title="Overview" actions={<span className="text-xs text-muted">Refreshes every 5 seconds</span>}>
      <ErrorNote message={error} />
      {!data ? <Empty>Loading live data...</Empty> : <Content d={data} />}
    </AppShell>
  );
}

function Content({ d }) {
  const { overview: ov, timeline, types, severity, forecast: fc, alerts } = d;
  const level = threatLevel(ov, fc);
  const typeLabels = Object.keys(types);
  const fcLabels = [...fc.history.map((h) => fmtTime(h.time)), ...fc.forecast.map((f) => fmtTime(f.time))];
  const histLen = fc.history.length;

  return (
    <>
      {/* The one bold element: today's threat level in plain words */}
      <section className={`rounded-lg border-l-4 px-5 py-4 ${LEVEL_BAND[level]}`}>
        <p className="text-sm text-muted">Current threat level</p>
        <p className={`text-3xl font-semibold ${LEVEL_TEXT[level]}`}>{level}</p>
        <p className="mt-1 text-sm max-w-3xl leading-relaxed">
          {(ov.attack_share * 100).toFixed(1)}% of traffic in the last hour was malicious.
          The attack trend is {fc.trend}, with a {(fc.next_bucket_attack_probability * 100).toFixed(0)}% chance
          of at least one attack in the next {fc.bucket_minutes} minutes.
        </p>
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Flows analysed (1 h)" value={ov.total_flows.toLocaleString()} hint={`${ov.anomalies} anomalies found`} />
        <Stat label="Attack flows (1 h)" value={ov.attack_flows} tone="high" hint={`${ov.threat_intel_hits} from known-bad IPs`} />
        <Stat label="Open alerts" value={ov.open_alerts} tone="critical" hint={`${ov.critical_open_alerts} critical`} />
        <Stat label="Open incidents" value={ov.open_incidents} tone="signal" hint={`Average risk ${ov.avg_risk}/100`} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Panel title="Traffic and attacks" subtitle="Last 2 hours, 5-minute buckets" className="lg:col-span-2">
          <LineChart
            labels={timeline.map((t) => fmtTime(t.time))}
            datasets={[
              { label: "All flows", data: timeline.map((t) => t.total), borderColor: COLORS.signal, backgroundColor: "rgba(79,179,201,.12)", fill: true, tension: 0.3, pointRadius: 0 },
              { label: "Attacks", data: timeline.map((t) => t.attacks), borderColor: COLORS.critical, tension: 0.3, pointRadius: 0 },
              { label: "Anomalies", data: timeline.map((t) => t.anomalies), borderColor: COLORS.medium, borderDash: [4, 4], tension: 0.3, pointRadius: 0 },
            ]}
          />
        </Panel>
        <Panel title="Attack types" subtitle="Last 2 hours">
          {typeLabels.length ? <DoughnutChart labels={typeLabels} data={Object.values(types)} /> : <Empty>No attacks detected</Empty>}
        </Panel>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Panel title="Intrusion forecast" subtitle="Attacks per 10 minutes, dashed line is the prediction" className="lg:col-span-2">
          <LineChart
            labels={fcLabels}
            datasets={[
              { label: "Actual attacks", data: [...fc.history.map((h) => h.attacks), ...fc.forecast.map(() => null)], borderColor: COLORS.critical, tension: 0.3 },
              { label: "Forecast", data: [...Array(histLen - 1).fill(null), fc.history[histLen - 1].attacks, ...fc.forecast.map((f) => f.expected_attacks)], borderColor: COLORS.medium, borderDash: [6, 4], tension: 0.3 },
            ]}
          />
        </Panel>
        <Panel title="Alerts by severity" subtitle="Last 2 hours">
          <BarChart labels={Object.keys(severity)} data={Object.values(severity)}
            colors={[COLORS.low, COLORS.medium, COLORS.high, COLORS.critical]} label="Alerts" />
        </Panel>
      </div>

      <Panel title="Highest-priority open alerts" actions={<Link href="/alerts" className="btn-ghost">View all alerts</Link>}>
        {alerts.length === 0 ? <Empty>No open alerts. The network is quiet.</Empty> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Time</th><th>Alert</th><th>Severity</th><th>Source</th><th>Target</th><th>Risk</th></tr></thead>
              <tbody>
                {alerts.map((a) => (
                  <tr key={a.id}>
                    <td className="text-muted">{fmtTime(a.created_at)}</td>
                    <td>{a.title}</td>
                    <td><Severity level={a.severity} /></td>
                    <td className="ip">{a.src_ip}</td>
                    <td className="ip">{a.dst_ip}:{a.dst_port}</td>
                    <td><RiskBar score={a.risk_score} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
