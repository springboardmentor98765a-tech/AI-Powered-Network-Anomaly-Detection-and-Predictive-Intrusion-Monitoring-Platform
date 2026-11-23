import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDownUp,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Database,
  FileWarning,
  Filter,
  Gauge,
  Globe2,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  X,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import api, { getApiError } from "../services/api";
import "./AnomalyDetectionPage.css";

const SECTIONS = [
  { id: "behavior", label: "Network Behavior Analysis", icon: Activity },
  { id: "suspicious", label: "Suspicious Activity", icon: ShieldAlert },
  { id: "patterns", label: "Pattern Recognition", icon: ArrowDownUp },
  { id: "classification", label: "Anomaly Classification", icon: Gauge },
];

const WINDOWS = [
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 60, label: "1 hour" },
  { value: 120, label: "2 hours" },
];

const CHART_COLORS = ["#63d4b5", "#79aef0", "#e6b66f", "#bd98eb", "#ee8e80", "#8094ad"];

// Documentation-only addresses are used so the sample cannot be mistaken for
// a real endpoint observed by the packet collector.
const DEMO_ACTIVITY = {
  demo: true,
  activity_type: "DEMO_PORT_SWEEP",
  title: "Possible destination-port sweep from 203.0.113.77",
  description:
    "The source endpoint generated 47 connection observations toward 192.0.2.18 across 18 destination ports in 90 seconds. Review whether this traffic is expected and determine whether follow-up action is required.",
  source_ip: "203.0.113.77",
  destination_ip: "192.0.2.18",
  evidence: {
    demo: true,
    scenario: "PORT_SWEEP_REVIEW",
    source_ip: "203.0.113.77",
    destination_ip: "192.0.2.18",
    distinct_destination_ports: 18,
    sample_connection_observations: 47,
    observation_window_seconds: 90,
    risk_score: 76,
    risk_level: "HIGH",
    note: "Evidence details for analyst review.",
  },
};

function DonutPanel({ title, description, segments, emptyLabel = "No data available for this window" }) {
  const total = segments.reduce((sum, segment) => sum + Number(segment.value || 0), 0);
  let cursor = 0;
  const gradientStops = segments
    .filter((segment) => Number(segment.value || 0) > 0)
    .map((segment) => {
      const start = cursor;
      cursor += (Number(segment.value) / Math.max(total, 1)) * 100;
      return `${segment.color} ${start}% ${cursor}%`;
    });
  const background = gradientStops.length
    ? `conic-gradient(${gradientStops.join(", ")})`
    : "conic-gradient(#26384d 0deg 360deg)";

  return (
    <article className="anomaly-visual-card">
      <div className="anomaly-visual-card-heading">
        <div><h3>{title}</h3><p>{description}</p></div>
        <span className="anomaly-visual-kicker">DISTRIBUTION</span>
      </div>
      <div className="anomaly-donut-layout">
        <div className={`anomaly-donut ${total ? "has-data" : "is-empty"}`} style={{ background }} role="img" aria-label={`${title}: ${total} total observations`}>
          <div className="anomaly-donut-center"><strong>{formatNumber(total)}</strong><span>OBSERVATIONS</span></div>
        </div>
        <div className="anomaly-chart-legend">
          {segments.filter((segment) => Number(segment.value || 0) > 0).map((segment) => (
            <div className="anomaly-chart-legend-row" key={segment.label}>
              <span className="anomaly-chart-swatch" style={{ background: segment.color }} />
              <span>{segment.label}</span>
              <strong>{formatNumber(segment.value)}</strong>
            </div>
          ))}
          {!total && <p className="anomaly-chart-empty">{emptyLabel}</p>}
        </div>
      </div>
    </article>
  );
}

function RankedBars({ title, description, items, valueLabel = "count", emptyLabel = "No ranked records available", scaleMax = null }) {
  const maxValue = scaleMax ? Math.max(1, Number(scaleMax)) : Math.max(1, ...items.map((item) => Number(item.value || 0)));
  return (
    <article className="anomaly-visual-card">
      <div className="anomaly-visual-card-heading">
        <div><h3>{title}</h3><p>{description}</p></div>
        <span className="anomaly-visual-kicker">TOP {items.length}</span>
      </div>
      {items.length ? (
        <div className="anomaly-ranked-bars">
          {items.map((item, index) => (
            <div className="anomaly-ranked-bar-row" key={`${item.label}-${index}`}>
              <div className="anomaly-ranked-bar-meta"><span title={item.label}>{item.label}</span><strong>{formatNumber(item.value)} {item.unit || valueLabel}</strong></div>
              <div className="anomaly-ranked-track"><span style={{ width: `${Math.max(2, Math.min(100, (Number(item.value || 0) / maxValue) * 100))}%`, background: item.color || CHART_COLORS[index % CHART_COLORS.length] }} /></div>
              {item.detail && <small>{item.detail}</small>}
            </div>
          ))}
        </div>
      ) : <p className="anomaly-chart-empty">{emptyLabel}</p>}
    </article>
  );
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function Severity({ value }) {
  const tone = String(value || "INFORMATIONAL").toLowerCase();
  return <span className={`anomaly-severity ${tone}`}>{value || "INFORMATIONAL"}</span>;
}

function EmptyState({ title, description }) {
  return (
    <div className="anomaly-empty-state">
      <Database size={24} />
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}

function SectionHeading({ eyebrow, title, description, right }) {
  return (
    <div className="anomaly-section-heading">
      <div>
        <span className="anomaly-eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {right}
    </div>
  );
}

export default function AnomalyDetectionPage() {
  const { user } = useAuth();
  const roles = user?.roles || [];
  const isAnalyst = roles.includes("Security Analyst");
  const isTeamLead = roles.includes("Team Lead / Supervisor");

  const [activeSection, setActiveSection] = useState("behavior");
  const [windowMinutes, setWindowMinutes] = useState(60);
  const [analysis, setAnalysis] = useState(null);
  const [reports, setReports] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [reportDialog, setReportDialog] = useState(null);
  const [reportTeamId, setReportTeamId] = useState("");
  const [reportTitle, setReportTitle] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);

  const [reviewDialog, setReviewDialog] = useState(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const loadData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [analysisResponse, reportsResponse, teamsResponse] = await Promise.all([
        api.get("/anomaly/analysis", { params: { window_minutes: windowMinutes } }),
        api.get("/anomaly/reports"),
        api.get("/anomaly/teams"),
      ]);
      setAnalysis(analysisResponse.data);
      setReports(reportsResponse.data || []);
      setTeams(teamsResponse.data || []);
      setError("");
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [windowMinutes]);

  useEffect(() => {
    loadData();
  }, [loadData]);


  // Demo reports stay in the review queue but are excluded from live KPI charts.
  const pendingReports = useMemo(
    () => reports.filter((report) => report.status === "PENDING" && !report.evidence?.demo),
    [reports]
  );
  const reviewedReports = useMemo(
    () => reports.filter((report) => report.status !== "PENDING" && !report.evidence?.demo),
    [reports]
  );
  const reportableTeams = useMemo(
    () => teams.filter((team) => team.team_lead_id && !team.is_team_lead),
    [teams]
  );

  const openReportDialog = (activity) => {
    setReportDialog(activity);
    setReportTeamId(reportableTeams[0] ? String(reportableTeams[0].id) : "");
    setReportTitle(activity.title || "Suspicious network activity");
    setReportDescription(activity.description || "");
    setSuccess("");
  };

  const submitReport = async (event) => {
    event.preventDefault();
    if (!reportDialog || !reportTeamId) return;

    setReportSubmitting(true);
    setError("");
    try {
      await api.post("/anomaly/reports", {
        team_id: Number(reportTeamId),
        activity_type: reportDialog.activity_type || reportDialog.finding_type || "MANUAL_REVIEW",
        title: reportTitle,
        description: reportDescription,
        source_ip: reportDialog.source_ip || null,
        destination_ip: reportDialog.destination_ip || null,
        evidence: reportDialog.evidence || reportDialog,
      });
      setReportDialog(null);
      setSuccess("Suspicious activity report submitted to the selected team.");
      await loadData(true);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setReportSubmitting(false);
    }
  };


  const submitReview = async (event) => {
    event.preventDefault();
    if (!reviewDialog) return;

    setReviewSubmitting(true);
    setError("");
    try {
      await api.patch(`/anomaly/reports/${reviewDialog.id}/review`, {
        decision: reviewDialog.decision,
        review_note: reviewNote,
      });
      setReviewDialog(null);
      setReviewNote("");
      setSuccess(
        reviewDialog.decision === "ACTION_TAKEN"
          ? "Report marked as action taken."
          : "Report dismissed and decision recorded."
      );
      await loadData(true);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setReviewSubmitting(false);
    }
  };

  const summary = analysis?.summary || {};
  const networkBehavior = analysis?.network_behavior || [];
  const protocolSegments = useMemo(() => {
    const totals = new Map();
    networkBehavior.forEach((row) => {
      const label = row.protocol || "UNKNOWN";
      totals.set(label, (totals.get(label) || 0) + Number(row.packet_count || 0));
    });
    const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    const main = sorted.slice(0, 5).map(([label, value], index) => ({ label, value, color: CHART_COLORS[index % CHART_COLORS.length] }));
    const other = sorted.slice(5).reduce((sum, [, value]) => sum + value, 0);
    if (other) main.push({ label: "Other", value: other, color: CHART_COLORS[5] });
    return main;
  }, [networkBehavior]);
  const topTalkers = useMemo(() => {
    const totals = new Map();
    networkBehavior.forEach((row) => {
      if (!row.source_ip) return;
      const previous = totals.get(row.source_ip) || { value: 0, bytes: 0, flows: 0 };
      previous.value += Number(row.packet_count || 0);
      previous.bytes += Number(row.total_bytes || 0);
      previous.flows += 1;
      totals.set(row.source_ip, previous);
    });
    return [...totals.entries()]
      .map(([label, item]) => ({ label, value: item.value, detail: `${formatBytes(item.bytes)} across ${item.flows} flow records` }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [networkBehavior]);
  const suspiciousSegments = useMemo(() => [
    { label: "First-seen IPs", value: analysis?.suspicious_activity?.new_ips?.length || 0, color: CHART_COLORS[0] },
    { label: "RBAC denial groups", value: analysis?.suspicious_activity?.access_denials?.length || 0, color: CHART_COLORS[2] },
    { label: "Pending team reports", value: pendingReports.length, color: CHART_COLORS[4] },
    { label: "Reviewed reports", value: reviewedReports.length, color: CHART_COLORS[1] },
  ], [analysis, pendingReports.length, reviewedReports.length]);
  const patternSegments = useMemo(() => [
    { label: "Recurring flows", value: analysis?.patterns?.regular_flows?.length || 0, color: CHART_COLORS[0] },
    { label: "Provisional flows", value: analysis?.patterns?.provisional_flows?.length || 0, color: CHART_COLORS[2] },
  ], [analysis]);
  const recurringIpLeaders = useMemo(
    () => (analysis?.patterns?.regular_ips || [])
      .map((row) => ({ label: row.ip_address, value: Number(row.observations || 0), detail: `${row.active_days} active days · ${row.capture_sessions} capture sessions` }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6),
    [analysis]
  );
  const riskSegments = useMemo(() => {
    const order = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFORMATIONAL"];
    const colors = { CRITICAL: "#e56b7f", HIGH: "#ec8b79", MEDIUM: "#dfb36e", LOW: "#62c9ad", INFORMATIONAL: "#7e91a7" };
    const counts = new Map(order.map((level) => [level, 0]));
    (analysis?.classifications || []).forEach((item) => {
      const level = String(item.risk_level || "INFORMATIONAL").toUpperCase();
      counts.set(level, (counts.get(level) || 0) + 1);
    });
    return order.map((label) => ({ label, value: counts.get(label) || 0, color: colors[label] }));
  }, [analysis]);
  const highestRiskFindings = useMemo(
    () => (analysis?.classifications || [])
      .slice()
      .sort((a, b) => Number(b.risk_score || 0) - Number(a.risk_score || 0))
      .slice(0, 6)
      .map((item) => ({ label: item.title, value: Number(item.risk_score || 0), unit: "/100", detail: `${item.risk_level} · ${item.source_ip || "Source unavailable"}` })),
    [analysis]
  );

  return (
    <div className="anomaly-page">
      <div className="anomaly-page-header">
        <div>
          <p className="page-eyebrow">NETWORK INTELLIGENCE</p>
          <h1>Anomaly Detection</h1>
          <p className="page-description">
            Analyze network behavior, identify suspicious activity, learn recurring communication patterns and assess anomaly risk.
          </p>
        </div>
        <div className="anomaly-header-actions">
          <label className="anomaly-window-select">
            <Filter size={14} />
            <select value={windowMinutes} onChange={(event) => setWindowMinutes(Number(event.target.value))}>
              {WINDOWS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <button className="anomaly-refresh-button" onClick={() => loadData(true)} disabled={refreshing || loading}>
            <RefreshCw size={15} className={refreshing ? "anomaly-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="anomaly-message error"><AlertTriangle size={16} />{error}</div>}
      {success && <div className="anomaly-message success"><CheckCircle2 size={16} />{success}<button onClick={() => setSuccess("")} aria-label="Dismiss message"><X size={14} /></button></div>}

      <section className="anomaly-summary-grid">
        <div className="anomaly-summary-card"><span>PACKETS ANALYZED</span><strong>{formatNumber(summary.packets_analyzed_in_window)}</strong><small>Selected observation window</small></div>
        <div className="anomaly-summary-card"><span>UNIQUE SOURCE IPS</span><strong>{formatNumber(summary.unique_source_ips)}</strong><small>Observed source endpoints</small></div>
        <div className="anomaly-summary-card"><span>NEW IP ADDRESSES</span><strong>{formatNumber(summary.new_ip_count)}</strong><small>First seen in retained packet history</small></div>
        <div className="anomaly-summary-card"><span>CLASSIFIED FINDINGS</span><strong>{formatNumber(summary.classified_findings)}</strong><small>Rule and baseline assessments</small></div>
        <div className="anomaly-summary-card"><span>PENDING TEAM REPORTS</span><strong>{formatNumber(pendingReports.length)}</strong><small>Awaiting team-lead review</small></div>
      </section>

      <nav className="anomaly-section-nav" aria-label="Anomaly detection sections">
        {SECTIONS.map((section, index) => {
          const Icon = section.icon;
          return (
            <button
              key={section.id}
              className={activeSection === section.id ? "active" : ""}
              onClick={() => setActiveSection(section.id)}
            >
              <span className="anomaly-tab-index">0{index + 1}</span>
              <Icon size={16} />
              <span>{section.label}</span>
              {activeSection === section.id && <ChevronRight size={14} className="anomaly-tab-arrow" />}
            </button>
          );
        })}
      </nav>

      {activeSection === "behavior" && (
        <section className="anomaly-workspace">
          <SectionHeading
            eyebrow="LIVE TRAFFIC"
            title="Network Behavior Analysis"
            description="Flow-level traffic telemetry grouped by the 5-tuple: source IP, destination IP, protocol, source port and destination port."
            right={<span className="anomaly-data-label"><Activity size={13} /> Packet metadata</span>}
          />
          <div className="anomaly-technical-strip">
            <div><span>OBSERVATION WINDOW</span><strong>{WINDOWS.find((item) => item.value === windowMinutes)?.label}</strong></div>
            <div><span>TRAFFIC VOLUME</span><strong>{formatBytes(summary.bytes_analyzed_in_window)}</strong></div>
            <div><span>DESTINATION IPS</span><strong>{formatNumber(summary.unique_destination_ips)}</strong></div>
            <div><span>DATA SOURCE</span><strong>PostgreSQL / TShark</strong></div>
          </div>
          <div className="anomaly-visual-grid">
            <DonutPanel title="Protocol composition" description="Packet share across the observed 5-tuple flow records." segments={protocolSegments} emptyLabel="Capture packets to calculate protocol composition." />
            <RankedBars title="Highest-volume source flows" description="Source endpoints ranked by packet count in the selected observation window." items={topTalkers} valueLabel="packets" emptyLabel="Source endpoint rankings will appear after packet capture." />
          </div>
          <div className="anomaly-table-heading"><div><h3>Observed communication flows</h3><p>Sorted by packet count · Top 150 flow records</p></div><span>{analysis?.network_behavior?.length || 0} rows · scroll inside</span></div>
          <div className="anomaly-table-wrap anomaly-scroll-panel">
            <table className="anomaly-table wide">
              <thead><tr><th>Source IP</th><th>Destination IP</th><th>Protocol</th><th>Src Port</th><th>Dst Port</th><th>Packets</th><th>Bytes</th><th>Avg. Size</th><th>Packets / sec</th><th>Last Seen</th></tr></thead>
              <tbody>
                {(analysis?.network_behavior || []).map((row, index) => (
                  <tr key={`${row.source_ip}-${row.destination_ip}-${row.protocol}-${row.source_port}-${row.destination_port}-${index}`}>
                    <td className="mono">{row.source_ip || "—"}</td><td className="mono">{row.destination_ip || "—"}</td><td><span className="protocol-chip">{row.protocol}</span></td><td className="mono">{row.source_port ?? "—"}</td><td className="mono">{row.destination_port ?? "—"}</td><td>{formatNumber(row.packet_count)}</td><td>{formatBytes(row.total_bytes)}</td><td>{formatNumber(row.average_packet_size)} B</td><td>{Number(row.packets_per_second || 0).toFixed(3)}</td><td>{formatDate(row.last_seen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && !analysis?.network_behavior?.length && <EmptyState title="No packets in this observation window" description="Start a capture in Network Monitoring or choose a wider time window." />}
          </div>
          <p className="anomaly-method-note"><AlertCircle size={14} /> Packet rate is calculated over each flow's first-to-last observed packet interval. The table reports captured metadata and does not inspect encrypted payload content.</p>
        </section>
      )}

      {activeSection === "suspicious" && (
        <section className="anomaly-workspace">
          <SectionHeading
            eyebrow="ACTIVITY REVIEW"
            title="Suspicious Activity Detection"
            description="Review newly observed endpoints and role-based access-denied events, then escalate relevant activity to the assigned team lead."
            right={<span className="anomaly-data-label"><ShieldAlert size={13} /> Review queue</span>}
          />
          <div className="anomaly-info-note"><AlertCircle size={15} /> A new IP address is a first-seen observation, not proof of an attack. Access events currently reflect role-based authorization denials; explicit per-data security-clearance levels are not yet defined in the user model.</div>
          <div className="anomaly-visual-grid anomaly-suspicious-grid">
            <DonutPanel title="Suspicious-signal composition" description="Counts from first-seen observations, RBAC denial groups and the analyst review queue." segments={suspiciousSegments} emptyLabel="No suspicious signals or team reports in the current data." />
            <article className="anomaly-demo-card">
              <div className="anomaly-demo-topline">
                <span className="anomaly-demo-pill"><Sparkles size={13} /> ALERT REVIEW</span>
                <span className="anomaly-demo-risk">HIGH · 76/100</span>
              </div>
              <h3>Possible destination-port sweep</h3>
              <p className="anomaly-demo-copy">Review a connection pattern involving repeated attempts across multiple destination ports and escalate it to the assigned team lead when further investigation is required.</p>
              <div className="anomaly-demo-facts">
                <div><span>SOURCE IP</span><strong>203.0.113.77</strong></div>
                <div><span>TARGET IP</span><strong>192.0.2.18</strong></div>
                <div><span>DESTINATION PORTS</span><strong>18 distinct ports</strong></div>
                <div><span>OBSERVATION WINDOW</span><strong>90 seconds · 47 observations</strong></div>
              </div>
              {isAnalyst ? (
                <button className="anomaly-demo-button" onClick={() => openReportDialog(DEMO_ACTIVITY)} disabled={!reportableTeams.length}>
                  <Send size={15} /> Send report to team lead
                </button>
              ) : (
                <p className="anomaly-demo-permission">Sign in with a Security Analyst account to send this activity report.</p>
              )}
              {isAnalyst && !reportableTeams.length && <p className="anomaly-demo-permission">Your analyst account needs team membership and an assigned team lead before it can send a report.</p>}
            </article>
          </div>

          <div className="anomaly-table-heading"><div><h3>Newly observed IP addresses</h3><p>First occurrence in the locally retained packet history</p></div><span>{analysis?.suspicious_activity?.new_ips?.length || 0} IPs · scroll inside</span></div>
          <div className="anomaly-table-wrap anomaly-scroll-panel">
            <table className="anomaly-table">
              <thead><tr><th>IP address</th><th>Scope</th><th>First seen</th><th>Source observations</th><th>Destination observations</th><th>Observed bytes</th><th>Action</th></tr></thead>
              <tbody>
                {(analysis?.suspicious_activity?.new_ips || []).map((row) => (
                  <tr key={row.ip_address}><td className="mono">{row.ip_address}</td><td><span className={`scope-chip ${row.scope.toLowerCase()}`}>{row.scope}</span></td><td>{formatDate(row.first_seen)}</td><td>{formatNumber(row.source_observations)}</td><td>{formatNumber(row.destination_observations)}</td><td>{formatBytes(row.observed_bytes)}</td><td>{isAnalyst ? <button className="anomaly-small-action" onClick={() => openReportDialog({ activity_type: "NEW_IP", title: `Review newly observed IP ${row.ip_address}`, description: `The IP ${row.ip_address} was first observed in the retained packet history. Scope: ${row.scope}. Please verify whether this endpoint is expected.`, source_ip: row.ip_address, evidence: row })}><Send size={13} /> Report</button> : <span className="anomaly-muted">Analyst report only</span>}</td></tr>
                ))}
              </tbody>
            </table>
            {!loading && !analysis?.suspicious_activity?.new_ips?.length && <EmptyState title="No newly observed IPs" description="No endpoint first-seen events were found in the selected window." />}
          </div>

          <div className="anomaly-table-heading anomaly-subtable-heading"><div><h3>Unauthorized access attempts</h3><p>Authenticated requests rejected by the existing role-based access controls</p></div><span>{analysis?.suspicious_activity?.access_denials?.length || 0} groups · scroll inside</span></div>
          <div className="anomaly-table-wrap anomaly-scroll-panel">
            <table className="anomaly-table">
              <thead><tr><th>Actor ID</th><th>Client IP</th><th>Protected endpoint</th><th>Attempts</th><th>Required roles</th><th>Last attempt</th><th>Action</th></tr></thead>
              <tbody>
                {(analysis?.suspicious_activity?.access_denials || []).map((row, index) => (
                  <tr key={`${row.actor_user_id}-${row.client_ip}-${row.path}-${index}`}><td>#{row.actor_user_id ?? "Unknown"}</td><td className="mono">{row.client_ip || "Unavailable"}</td><td className="mono path-cell">{row.path || "—"}</td><td><strong>{row.attempt_count}</strong></td><td>{(row.required_roles || []).join(", ") || "—"}</td><td>{formatDate(row.last_seen)}</td><td>{isAnalyst ? <button className="anomaly-small-action" onClick={() => openReportDialog({ activity_type: "ACCESS_DENIED", title: `Access denial for ${row.path || "protected endpoint"}`, description: `${row.attempt_count} request(s) were denied for actor ${row.actor_user_id ?? "unknown"} from ${row.client_ip || "an unrecorded client IP"}. Endpoint: ${row.path || "unknown"}.`, source_ip: row.client_ip, evidence: row })}><Send size={13} /> Report</button> : <span className="anomaly-muted">Review event</span>}</td></tr>
                ))}
              </tbody>
            </table>
            {!loading && !analysis?.suspicious_activity?.access_denials?.length && <EmptyState title="No role-based access denials recorded" description="Denied requests will appear here after an authenticated user attempts an endpoint outside their assigned roles." />}
          </div>

          <div className="anomaly-table-heading anomaly-subtable-heading"><div><h3>Analyst reports and team-lead decisions</h3><p>Team-scoped suspicious activity reporting workflow</p></div><span>{reports.length} reports · scroll inside</span></div>
          <div className="anomaly-report-list anomaly-scroll-panel">
            {reports.map((report) => (
              <article className="anomaly-report-card" key={report.id}>
                <div className="anomaly-report-main"><div className="anomaly-report-title-row"><strong>#{report.id} · {report.title}</strong><span className={`report-status ${report.status.toLowerCase()}`}>{report.status.replaceAll("_", " ")}</span></div><p>{report.description}</p><div className="anomaly-report-meta"><span><Users size={13} /> {report.team_name || "Team"}</span><span>Reported by {report.reporter_name}</span><span>{formatDate(report.created_at)}</span>{report.source_ip && <span className="mono">IP: {report.source_ip}</span>}</div>{report.review_note && <div className="anomaly-review-note"><strong>Review note:</strong> {report.review_note} <span>— {report.reviewer_name || "Reviewer"}</span></div>}</div>
                {isTeamLead && report.status === "PENDING" && <div className="anomaly-report-actions"><button className="action-taken-button" onClick={() => { setReviewDialog({ ...report, decision: "ACTION_TAKEN" }); setReviewNote(""); }}><CheckCircle2 size={13} /> Take action</button><button className="dismiss-button" onClick={() => { setReviewDialog({ ...report, decision: "DISMISSED" }); setReviewNote(""); }}><X size={13} /> Dismiss</button></div>}
              </article>
            ))}
            {!reports.length && <EmptyState title="No team reports yet" description="Analyst-submitted reports will appear here for the analyst and assigned team lead." />}
          </div>
        </section>
      )}

      {activeSection === "patterns" && (
        <section className="anomaly-workspace">
          <SectionHeading
            eyebrow="HISTORICAL BASELINE"
            title="Pattern Recognition"
            description="Identify recurring endpoints and communication flows using historical packet observations across capture sessions and active days."
            right={<span className="anomaly-data-label"><Sparkles size={13} /> {analysis?.patterns?.lookback_days || 30}-day lookback</span>}
          />
          <div className="anomaly-info-note"><Clock3 size={15} /> A flow is considered recurrent when it appears on at least two different active days or in at least two separate capture sessions. Single-session activity is shown separately as provisional history.</div>
          <div className="anomaly-visual-grid">
            <DonutPanel title="Flow-baseline maturity" description="Returned recurring and provisional flow-pattern records in the 30-day lookback." segments={patternSegments} emptyLabel="No repeated flow records have been identified yet." />
            <RankedBars title="Most frequently observed endpoints" description="Recurring endpoints ranked by packet observations, with active-day and session context." items={recurringIpLeaders} valueLabel="observations" emptyLabel="Capture on multiple days or sessions to establish a recurring baseline." />
          </div>

          <div className="anomaly-table-heading"><div><h3>Regularly communicating IP addresses</h3><p>Endpoint frequency, traffic volume and recurrence across captures</p></div><span>{analysis?.patterns?.regular_ips?.length || 0} recurring IPs · scroll inside</span></div>
          <div className="anomaly-table-wrap anomaly-scroll-panel">
            <table className="anomaly-table">
              <thead><tr><th>IP address</th><th>Scope</th><th>Observations</th><th>Source packets</th><th>Destination packets</th><th>Active days</th><th>Capture sessions</th><th>Avg. observations / session</th><th>Last seen</th></tr></thead>
              <tbody>
                {(analysis?.patterns?.regular_ips || []).map((row) => (
                  <tr key={row.ip_address}><td className="mono">{row.ip_address}</td><td><span className={`scope-chip ${row.scope.toLowerCase()}`}>{row.scope}</span></td><td>{formatNumber(row.observations)}</td><td>{formatNumber(row.source_observations)}</td><td>{formatNumber(row.destination_observations)}</td><td>{row.active_days}</td><td>{row.capture_sessions}</td><td>{formatNumber(row.average_observations_per_session)}</td><td>{formatDate(row.last_seen)}</td></tr>
                ))}
              </tbody>
            </table>
            {!loading && !analysis?.patterns?.regular_ips?.length && <EmptyState title="No recurring IP baseline yet" description="Capture the same network over multiple days or separate sessions to establish recurring endpoint patterns." />}
          </div>

          <div className="anomaly-table-heading anomaly-subtable-heading"><div><h3>Regular packet-transfer patterns</h3><p>Source/destination/protocol/port flow recurrence · 30-day history</p></div><span>{analysis?.patterns?.regular_flows?.length || 0} recurring flows · scroll inside</span></div>
          <div className="anomaly-table-wrap anomaly-scroll-panel">
            <table className="anomaly-table wide">
              <thead><tr><th>Source IP</th><th>Destination IP</th><th>Protocol</th><th>Src Port</th><th>Dst Port</th><th>Packets</th><th>Avg. packets / session</th><th>Avg. packet size</th><th>Active days</th><th>Sessions</th></tr></thead>
              <tbody>
                {(analysis?.patterns?.regular_flows || []).map((row, index) => (
                  <tr key={`${row.source_ip}-${row.destination_ip}-${row.protocol}-${row.source_port}-${row.destination_port}-${index}`}><td className="mono">{row.source_ip || "—"}</td><td className="mono">{row.destination_ip || "—"}</td><td><span className="protocol-chip">{row.protocol}</span></td><td>{row.source_port ?? "—"}</td><td>{row.destination_port ?? "—"}</td><td>{formatNumber(row.packet_count)}</td><td>{formatNumber(row.average_packets_per_session)}</td><td>{formatNumber(row.average_packet_size)} B</td><td>{row.active_days}</td><td>{row.capture_sessions}</td></tr>
                ))}
              </tbody>
            </table>
            {!loading && !analysis?.patterns?.regular_flows?.length && <EmptyState title="No cross-session flow patterns yet" description="We need repeated observations across multiple capture sessions or active days before marking a flow as regular." />}
          </div>

          {!!analysis?.patterns?.provisional_flows?.length && (
            <div className="anomaly-provisional-panel"><strong>Provisional repeated flows</strong><span>These flows repeated within one capture but do not yet meet the cross-session recurrence rule.</span><div>{analysis.patterns.provisional_flows.slice(0, 8).map((row, index) => <span key={index} className="anomaly-provisional-chip">{row.source_ip || "?"} → {row.destination_ip || "?"} · {row.protocol} · {row.packet_count} packets</span>)}</div></div>
          )}
        </section>
      )}

      {activeSection === "classification" && (
        <section className="anomaly-workspace">
          <SectionHeading
            eyebrow="RISK ASSESSMENT"
            title="Anomaly Classification"
            description="Translate observed deviations into a risk-ranked assessment, with supporting metrics and an explanation for each classification."
            right={(
              <div className="anomaly-heading-controls">
                <span className="anomaly-data-label"><Target size={13} /> Explainable assessment</span>

              </div>
            )}
          />
          <div className="anomaly-model-status">
            <div><span>ASSESSMENT ENGINE</span><strong>Explainable network risk assessment</strong></div>
            <div><span>ASSESSMENT BASIS</span><strong>Rules &amp; historical baseline comparisons</strong></div>
            <div><span>CLASSIFIED FINDINGS</span><strong>{formatNumber(analysis?.classifications?.length || 0)}</strong></div>
            <div><span>RISK SCALE</span><strong>0–100 per finding</strong></div>
          </div>
          <div className="anomaly-risk-legend">
            <div><span className="risk-dot informational" />Informational <strong>0–14</strong></div>
            <div><span className="risk-dot low" />Low <strong>15–39</strong></div>
            <div><span className="risk-dot medium" />Medium <strong>40–64</strong></div>
            <div><span className="risk-dot high" />High <strong>65–84</strong></div>
            <div><span className="risk-dot critical" />Critical <strong>85–100</strong></div>
          </div>
          <div className="anomaly-visual-grid">
            <DonutPanel title="Risk-level distribution" description="Classified findings grouped into the defined severity bands." segments={riskSegments} emptyLabel="No live findings have been classified in this observation window." />
            <RankedBars title="Highest risk findings" description="Top findings ranked on a fixed 0–100 risk scale." items={highestRiskFindings} valueLabel="risk score" scaleMax={100} emptyLabel="There are no findings to rank." />
          </div>
          <div className="anomaly-method-card"><div className="anomaly-method-icon"><Gauge size={19} /></div><div><strong>Explainable network risk assessment</strong><p>Each result includes a 0–100 risk score, severity band, classification label and supporting evidence, calculated from explainable network rules and historical baseline comparisons.</p></div></div>

          <div className="anomaly-table-heading"><div><h3>Classified network anomalies and security events</h3><p>Highest risk first · Select a row's evidence by expanding the details</p></div><span>{analysis?.classifications?.length || 0} findings</span></div>
          <div className="anomaly-classification-list anomaly-scroll-panel">
            {(analysis?.classifications || []).map((item, index) => (
              <details className="anomaly-classification-card" key={`${item.finding_type}-${item.source_ip}-${index}`} open={index === 0}>
                <summary>
                  <div className="classification-leading"><span className={`classification-icon ${item.risk_level.toLowerCase()}`}><FileWarning size={17} /></span><div><strong>{item.title}</strong><small>{item.finding_type.replaceAll("_", " ")} · {item.source_ip || "Source unavailable"}</small></div></div>
                  <div className="classification-result"><Severity value={item.risk_level} /><strong>{item.risk_score}/100</strong><ChevronRight size={15} /></div>
                </summary>
                <div className="classification-details"><div><span>CLASSIFICATION</span><strong>{item.classification.replaceAll("_", " ")}</strong></div><div><span>ASSESSMENT</span><strong>{item.assessment}</strong></div><div><span>DETECTED AT</span><strong>{formatDate(item.detected_at)}</strong></div><p>{item.description}</p><pre>{JSON.stringify(item.evidence, null, 2)}</pre>{isAnalyst && <button className="anomaly-small-action" onClick={() => openReportDialog({ activity_type: item.finding_type, title: item.title, description: item.description, source_ip: item.source_ip, evidence: item })}><Send size={13} /> Report to team lead</button>}</div>
              </details>
            ))}
            {!loading && !analysis?.classifications?.length && <EmptyState title="No anomalies classified in this window" description="The analysis engine evaluates captured traffic and access-control activity against network rules and the available communication baseline." />}
          </div>
          <div className="anomaly-info-note"><ShieldCheck size={15} /> A newly observed IP address is not automatically malicious. A traffic spike alone does not establish a DDoS attack. Role-based and data-clearance denials indicate authorization failures, not confirmed data exfiltration. Packet capture retains network metadata and does not store HTTP payloads or application request bodies.</div>
        </section>
      )}

      <footer className="anomaly-footer"><span><Globe2 size={13} /> Analysis source: local packet capture history and application audit events</span><span>Snapshot generated: {formatDate(analysis?.generated_at)}</span></footer>
      {(loading || refreshing) && <div className="anomaly-loading"><span className="loader" /> {refreshing ? "Refreshing anomaly analysis..." : "Loading network analysis..."}</div>}

      {reportDialog && (
        <div className="anomaly-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setReportDialog(null); }}>
          <form className="anomaly-modal" onSubmit={submitReport}>
            <div className="anomaly-modal-heading"><div><span className="anomaly-eyebrow">ANALYST ESCALATION</span><h2>Report suspicious activity</h2><p>Submit this activity to the selected team's lead for review.</p></div><button type="button" className="anomaly-modal-close" onClick={() => setReportDialog(null)} aria-label="Close"><X size={18} /></button></div>
            <label>Assigned team<select required value={reportTeamId} onChange={(event) => setReportTeamId(event.target.value)}><option value="">Select your team</option>{reportableTeams.map((team) => <option key={team.id} value={team.id}>{team.team_name}</option>)}</select></label>
            <label>Report title<input required minLength={5} maxLength={180} value={reportTitle} onChange={(event) => setReportTitle(event.target.value)} /></label>
            <label>Activity description<textarea required minLength={10} maxLength={3000} rows={5} value={reportDescription} onChange={(event) => setReportDescription(event.target.value)} /></label>
            <div className="anomaly-modal-ip-row"><span>Source IP: <strong>{reportDialog.source_ip || "Not available"}</strong></span><span>Destination IP: <strong>{reportDialog.destination_ip || "Not available"}</strong></span></div>
            <div className="anomaly-modal-actions"><button type="button" className="anomaly-secondary-button" onClick={() => setReportDialog(null)}>Cancel</button><button type="submit" className="anomaly-primary-button" disabled={reportSubmitting || !reportTeamId}><Send size={14} />{reportSubmitting ? "Submitting..." : "Send to team lead"}</button></div>
            {!reportableTeams.length && <p className="anomaly-form-hint">You must belong to a team with an assigned team lead before submitting a report.</p>}
          </form>
        </div>
      )}

      {reviewDialog && (
        <div className="anomaly-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setReviewDialog(null); }}>
          <form className="anomaly-modal" onSubmit={submitReview}>
            <div className="anomaly-modal-heading"><div><span className="anomaly-eyebrow">TEAM LEAD REVIEW</span><h2>{reviewDialog.decision === "ACTION_TAKEN" ? "Record action taken" : "Dismiss activity report"}</h2><p>Report #{reviewDialog.id} · {reviewDialog.title}</p></div><button type="button" className="anomaly-modal-close" onClick={() => setReviewDialog(null)} aria-label="Close"><X size={18} /></button></div>
            <label>Decision note<textarea required minLength={3} maxLength={1500} rows={5} placeholder={reviewDialog.decision === "ACTION_TAKEN" ? "Describe the action taken..." : "Explain why this report is being dismissed..."} value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} /></label>
            <div className="anomaly-modal-actions"><button type="button" className="anomaly-secondary-button" onClick={() => setReviewDialog(null)}>Cancel</button><button type="submit" className="anomaly-primary-button" disabled={reviewSubmitting}><CheckCircle2 size={14} />{reviewSubmitting ? "Saving..." : "Confirm decision"}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
