import React, { useEffect, useState } from "react";
import {
  Activity,
  AlertOctagon,
  CheckCircle2,
  Cpu,
  Layers,
  RefreshCw,
  Send,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import api from "../api/axios";
import Sidebar from "../components/sidebar";
import { useAuth } from "../context/authContext";

type ActiveTab = "behavior" | "suspicious" | "patterns" | "classification";

interface BehaviorRow {
  id: number;
  source_ip: string;
  destination_ip: string;
  protocol: string;
  destination_port: number;
  packet_count: number;
  total_bytes: number;
  avg_packet_size: number;
  flow_rate_pps: number;
  syn_ratio: number;
  behavioral_profile: string;
  detection_trigger: string;
  is_new_ip: boolean;
  unauthorized_clearance: boolean;
  risk_score: number;
  risk_level: string;
  classification: "DANGEROUS" | "RISK_ASSESSED" | "MISTAKE" | string;
  rationale: string;
}

interface RegularPatternItem {
  pattern_key: string;
  ip_address: string;
  role: string;
  protocol: string;
  port: number;
  avg_bytes: number;
  frequency: number;
  cadence: string;
}

interface SuspiciousReport {
  id: number;
  anomaly_id: number | null;
  reported_by_user_id: number;
  reported_by_name: string | null;
  source_ip: string;
  destination_ip: string;
  reason: string;
  clearance_violation: string;
  severity: string;
  status: string;
  lead_resolution_note: string | null;
  created_at: string;
}

interface AnomalyOverviewResponse {
  behaviors: BehaviorRow[];
  suspicious_detections: BehaviorRow[];
  regular_patterns: RegularPatternItem[];
  classifications: BehaviorRow[];
  reports: SuspiciousReport[];
}

export default function AnomalyDetection() {
  const { user } = useAuth();
  const roles: string[] = user?.roles?.map((r: { role_name: string }) => r.role_name) || [];
  const isLeadOrAdmin = roles.includes("Team Lead") || roles.includes("Administrator");

  const [activeTab, setActiveTab] = useState<ActiveTab>("behavior");
  const [data, setData] = useState<AnomalyOverviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [classFilter, setClassFilter] = useState<string>("ALL");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Analyst report form state
  const [reportSourceIp, setReportSourceIp] = useState("");
  const [reportDestIp, setReportDestIp] = useState("");
  const [reportClearance, setReportClearance] = useState("Restricted Admin Port / Clearance");
  const [reportSeverity, setReportSeverity] = useState("High");
  const [reportReason, setReportReason] = useState("");
  const [selectedAnomalyId, setSelectedAnomalyId] = useState<number | null>(null);

  const loadOverview = async (forceRefresh = false) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.get<AnomalyOverviewResponse>("/anomaly/overview", {
        params: forceRefresh ? { refresh: true } : undefined,
      });
      setData(res.data);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || "Failed to load anomaly telemetry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview(true);
  }, []);

  const prefillReportFromRow = (row: BehaviorRow) => {
    setSelectedAnomalyId(row.id);
    setReportSourceIp(row.source_ip);
    setReportDestIp(row.destination_ip);
    setReportClearance(
      row.unauthorized_clearance
        ? `Unauthorized Access (Port ${row.destination_port})`
        : row.is_new_ip
          ? "Unverified New External IP"
          : "Standard Clearance"
    );
    setReportSeverity(row.risk_level === "Critical" || row.risk_level === "High" ? "High" : "Medium");
    setReportReason(`Escalated ${row.behavioral_profile} (${row.detection_trigger})`);
    setActiveTab("suspicious");
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportSourceIp.trim() || !reportReason.trim()) return;
    setFeedback(null);
    setErrorMsg(null);

    try {
      await api.post("/anomaly/reports", {
        anomaly_id: selectedAnomalyId,
        source_ip: reportSourceIp.trim(),
        destination_ip: reportDestIp.trim() || "0.0.0.0",
        reason: reportReason.trim(),
        clearance_violation: reportClearance,
        severity: reportSeverity,
      });
      setFeedback("Suspicious activity reported to Team Lead.");
      setReportReason("");
      setSelectedAnomalyId(null);
      loadOverview(false);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || "Failed to submit suspicious report.");
    }
  };

  const handleLeadDecision = async (reportId: number, decision: "ACTION_TAKEN" | "DISMISSED") => {
    setFeedback(null);
    setErrorMsg(null);
    try {
      await api.post(`/anomaly/reports/${reportId}/resolve`, {
        decision,
        note:
          decision === "ACTION_TAKEN"
            ? "Team Lead initiated containment / mitigation action."
            : "Team Lead dismissed alert after review.",
      });
      setFeedback(
        decision === "ACTION_TAKEN"
          ? `Report #${reportId} marked as Action Taken.`
          : `Report #${reportId} dismissed.`
      );
      loadOverview(false);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || "Failed to update report status.");
    }
  };

  const classificationBadge = (cls: string) => {
    if (cls === "DANGEROUS") return "bg-danger/15 text-danger border border-danger/30";
    if (cls === "RISK_ASSESSED") return "bg-warning/15 text-warning border border-warning/30";
    return "bg-success/15 text-success border border-success/30";
  };

  const behaviors = data?.behaviors || [];
  const suspiciousDetections = data?.suspicious_detections || [];
  const regularPatterns = data?.regular_patterns || [];
  const allClassifications = data?.classifications || [];
  const reports = data?.reports || [];

  const filteredClassifications = allClassifications.filter((c) =>
    classFilter === "ALL" ? true : c.classification === classFilter
  );

  // Metrics across all 4 sections
  const dangerousCount = allClassifications.filter((c) => c.classification === "DANGEROUS").length;
  const riskAssessedCount = allClassifications.filter((c) => c.classification === "RISK_ASSESSED").length;
  const mistakeCount = allClassifications.filter((c) => c.classification === "MISTAKE").length;
  const totalClassified = Math.max(allClassifications.length, 1);

  const avgRiskScore =
    behaviors.length > 0
      ? Math.round(behaviors.reduce((acc, b) => acc + b.risk_score, 0) / behaviors.length)
      : 0;

  const newIpCount = suspiciousDetections.filter((s) => s.is_new_ip).length;
  const clearanceViolationCount = suspiciousDetections.filter((s) => s.unauthorized_clearance).length;

  // Common Anomaly Metrics (SVG Bar Chart matching screenshot aesthetic)
  const commonBarItems = [
    {
      name: "Risk Score",
      short: "Risk",
      valueText: `${avgRiskScore}/100`,
      pct: Math.max(8, avgRiskScore),
      hex: "#22D3EE",
    },
    {
      name: "New IPs",
      short: "New IP",
      valueText: `${newIpCount}`,
      pct: suspiciousDetections.length
        ? Math.max(10, Math.min(100, Math.round((newIpCount / suspiciousDetections.length) * 100)))
        : 0,
      hex: "#F59E0B",
    },
    {
      name: "Clearance",
      short: "Clearance",
      valueText: `${clearanceViolationCount}`,
      pct: suspiciousDetections.length
        ? Math.max(
          10,
          Math.min(100, Math.round((clearanceViolationCount / suspiciousDetections.length) * 100))
        )
        : 0,
      hex: "#F43F5E",
    },
    {
      name: "Patterns",
      short: "Patterns",
      valueText: `${regularPatterns.length}`,
      pct: regularPatterns.length ? Math.min(100, regularPatterns.length * 10) : 0,
      hex: "#10B981",
    },
    {
      name: "Dangerous",
      short: "Danger",
      valueText: `${dangerousCount}`,
      pct: dangerousCount ? Math.max(10, Math.round((dangerousCount / totalClassified) * 100)) : 0,
      hex: "#F43F5E",
    },
    {
      name: "Risky",
      short: "Risky",
      valueText: `${riskAssessedCount}`,
      pct: riskAssessedCount
        ? Math.max(10, Math.round((riskAssessedCount / totalClassified) * 100))
        : 0,
      hex: "#F59E0B",
    },
    {
      name: "Mistake",
      short: "Mistake",
      valueText: `${mistakeCount}`,
      pct: mistakeCount ? Math.max(10, Math.round((mistakeCount / totalClassified) * 100)) : 0,
      hex: "#10B981",
    },
  ];

  // Threat & Baseline Split (Pie / Donut)
  const pieSlices = [
    { label: "Dangerous", count: dangerousCount, hex: "#F43F5E", textClass: "text-danger" },
    { label: "Risk Assessed", count: riskAssessedCount, hex: "#F59E0B", textClass: "text-warning" },
    { label: "Mistake", count: mistakeCount, hex: "#10B981", textClass: "text-success" },
    { label: "Baselines", count: regularPatterns.length, hex: "#22D3EE", textClass: "text-primary" },
  ];
  const pieTotal = Math.max(
    pieSlices.reduce((sum, s) => sum + s.count, 0),
    1
  );
  const pieRadius = 42;
  const pieCircumference = 2 * Math.PI * pieRadius;
  let pieOffset = 0;

  // Tab 1 (Behavior) chart helpers
  const topBehaviors = behaviors.slice(0, 7);
  const maxBehaviorPps = Math.max(...topBehaviors.map((b) => b.flow_rate_pps), 1);

  // Tab 2 (Suspicious) triage counts
  const pendingCount = reports.filter((r) => r.status === "PENDING_LEAD_REVIEW").length;
  const actionCount = reports.filter((r) => r.status === "ACTION_TAKEN").length;
  const dismissedCount = reports.filter((r) => r.status === "DISMISSED").length;
  const triageTotal = Math.max(pendingCount + actionCount + dismissedCount, 1);

  // Tab 3 (Patterns) chart helpers
  const topPatterns = regularPatterns.slice(0, 8);
  const maxPatternFreq = Math.max(...topPatterns.map((p) => p.frequency), 1);

  // Tab 4 (Classification) chart helpers
  const classPieSlices = [
    { label: "Dangerous", count: dangerousCount, hex: "#F43F5E", textClass: "text-danger" },
    { label: "Risk Assessed", count: riskAssessedCount, hex: "#F59E0B", textClass: "text-warning" },
    { label: "Mistake", count: mistakeCount, hex: "#10B981", textClass: "text-success" },
  ];
  let classPieOffset = 0;

  const tabs: {
    id: ActiveTab;
    label: string;
    icon: React.ReactNode;
    count: number;
  }[] = [
      { id: "behavior", label: "Behavior Analysis", icon: <Activity size={16} />, count: behaviors.length },
      {
        id: "suspicious",
        label: "Suspicious Activity",
        icon: <ShieldAlert size={16} />,
        count: suspiciousDetections.length,
      },
      { id: "patterns", label: "Pattern Recognition", icon: <Layers size={16} />, count: regularPatterns.length },
      {
        id: "classification",
        label: "Anomaly Classification",
        icon: <AlertOctagon size={16} />,
        count: allClassifications.length,
      },
    ];

  // SVG bar chart geometry matching the reference card
  const barSvgW = 560;
  const barSvgH = 185;
  const barTop = 22;
  const barBottom = 152;
  const barPlotH = barBottom - barTop;
  const barLeft = 24;
  const barRight = 536;
  const barSlotW = (barRight - barLeft) / commonBarItems.length;

  return (
    <div className="min-h-screen bg-background text-text flex">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto space-y-6">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-border">
          <div>
            <h1 className="text-2xl font-bold font-heading text-text-h flex items-center gap-2.5">
              <Cpu className="text-primary" size={24} /> AI Anomaly Detection
            </h1>
            <p className="text-sm text-muted mt-1">
              Side-by-side anomaly bar and pie overview above, with dedicated tabs below for all four sections
            </p>
          </div>

          <button
            onClick={() => loadOverview(true)}
            className="px-4 py-2 rounded-lg bg-surface border border-border text-text-h font-semibold text-xs flex items-center gap-2 hover:bg-surface-hover transition-colors cursor-pointer self-start"
          >
            <RefreshCw size={15} className={loading ? "animate-spin text-primary" : "text-primary"} />
            Re-Analyze
          </button>
        </header>

        {/* SIDE-BY-SIDE: COMMON ANOMALY METRICS (BAR CHART) + THREAT & BASELINE SPLIT (PIE) */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left 7 Cols: Common Anomaly Metrics (Bar Chart styled like Threat Trend card) */}
          <div className="lg:col-span-7 bg-[#0B1220] border border-[#1E293B] rounded-2xl p-6 flex flex-col justify-between gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-heading font-semibold text-text-h">
                Common Anomaly Metrics (Bar Chart)
              </h2>
              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="flex items-center gap-1.5 text-[#22D3EE]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#22D3EE]" /> Risk / Baseline
                </span>
                <span className="flex items-center gap-1.5 text-[#F59E0B]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" /> Suspicious
                </span>
                <span className="flex items-center gap-1.5 text-[#F43F5E]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#F43F5E]" /> Dangerous
                </span>
              </div>
            </div>

            <svg viewBox={`0 0 ${barSvgW} ${barSvgH}`} className="w-full h-44">
              {[0, 0.5, 1].map((ratio, idx) => {
                const gy = barBottom - ratio * barPlotH;
                return (
                  <line
                    key={idx}
                    x1={barLeft}
                    y1={gy}
                    x2={barRight}
                    y2={gy}
                    stroke="#1E293B"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                );
              })}

              {commonBarItems.map((item, idx) => {
                const hPx = Math.max(6, (item.pct / 100) * barPlotH);
                const xPos = barLeft + idx * barSlotW + barSlotW * 0.25;
                const bWidth = Math.max(16, barSlotW * 0.5);
                const yPos = barBottom - hPx;

                return (
                  <g key={item.name}>
                    <rect
                      x={xPos}
                      y={yPos}
                      width={bWidth}
                      height={hPx}
                      rx="4"
                      fill={item.hex}
                    >
                      <title>{`${item.name}: ${item.valueText}`}</title>
                    </rect>
                    <text
                      x={xPos + bWidth / 2}
                      y={yPos - 6}
                      textAnchor="middle"
                      fill="#E2E8F0"
                      fontSize="9.5"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {item.valueText}
                    </text>
                    <text
                      x={xPos + bWidth / 2}
                      y={barSvgH - 8}
                      textAnchor="middle"
                      fill="#64748B"
                      fontSize="9.5"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {item.short}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Right 5 Cols: Threat & Baseline Split (Pie) side by side */}
          <div className="lg:col-span-5 bg-[#0B1220] border border-[#1E293B] rounded-2xl p-6 flex flex-col justify-between gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-heading font-semibold text-text-h">
                Threat & Baseline Split (Pie)
              </h2>
              <span className="text-xs font-mono text-muted">{pieTotal} total</span>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-around gap-6 my-auto py-2">
              <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
                <svg width="128" height="128" viewBox="0 0 112 112" className="-rotate-90">
                  <circle cx="56" cy="56" r={pieRadius} fill="transparent" stroke="#1E293B" strokeWidth="15" />
                  {pieSlices.map((sl) => {
                    const segLen = (sl.count / pieTotal) * pieCircumference;
                    const dashArray = `${segLen} ${pieCircumference}`;
                    const dashOffset = -pieOffset;
                    pieOffset += segLen;
                    return (
                      <circle
                        key={sl.label}
                        cx="56"
                        cy="56"
                        r={pieRadius}
                        fill="transparent"
                        stroke={sl.hex}
                        strokeWidth="15"
                        strokeDasharray={dashArray}
                        strokeDashoffset={dashOffset}
                      />
                    );
                  })}
                </svg>
                <div className="absolute text-center font-mono">
                  <p className="text-base font-bold text-text-h">{pieTotal}</p>
                  <p className="text-[10px] text-muted">Items</p>
                </div>
              </div>

              <div className="flex-1 w-full space-y-2.5 text-xs font-mono">
                {pieSlices.map((sl) => {
                  const pct = Math.round((sl.count / pieTotal) * 100);
                  return (
                    <div key={sl.label} className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-text-h">
                        <span
                          className="w-2.5 h-2.5 rounded-full inline-block"
                          style={{ backgroundColor: sl.hex }}
                        />
                        {sl.label}
                      </span>
                      <span className={`font-bold ${sl.textClass}`}>
                        {sl.count} ({pct}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* TABS FOR ALL 4 SECTIONS */}
        <div
          role="tablist"
          aria-label="Anomaly Detection Sections"
          className="flex items-center gap-2 border-b border-border overflow-x-auto pb-px"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-mono font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${isActive
                  ? "border-primary text-primary bg-surface/80 rounded-t-lg"
                  : "border-transparent text-muted hover:text-text-h hover:bg-surface/40 rounded-t-lg"
                  }`}
              >
                <span className={isActive ? "text-primary" : "text-muted"}>{tab.icon}</span>
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] ${isActive
                    ? "bg-primary/15 text-primary"
                    : "bg-background text-muted border border-border"
                    }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {feedback && (
          <div className="p-3.5 rounded-lg bg-success/10 border border-success/30 text-success text-xs font-mono">
            {feedback}
          </div>
        )}
        {errorMsg && (
          <div className="p-3.5 rounded-lg bg-danger/10 border border-danger/30 text-danger text-xs font-mono">
            {errorMsg}
          </div>
        )}

        {/* TAB 1: BEHAVIOR ANALYSIS */}
        {activeTab === "behavior" && (
          <div className="space-y-6">
            <section className="bg-surface border border-border rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-heading font-semibold text-text-h">
                  Flow Rate (PPS) & Risk Score Chart
                </h2>
                <div className="flex items-center gap-4 text-xs font-mono">
                  <span className="flex items-center gap-1.5 text-primary">
                    <span className="w-2.5 h-2.5 rounded-sm bg-primary" /> PPS
                  </span>
                  <span className="flex items-center gap-1.5 text-warning">
                    <span className="w-2.5 h-2.5 rounded-sm bg-warning" /> Risk %
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {topBehaviors.map((b) => {
                  const ppsPct = Math.max(10, Math.round((b.flow_rate_pps / maxBehaviorPps) * 100));
                  const riskPct = Math.max(8, Math.min(100, b.risk_score));
                  return (
                    <div
                      key={b.id}
                      className="bg-background border border-border rounded-lg p-3 flex flex-col justify-between gap-2"
                    >
                      <div className="h-24 flex items-end justify-center gap-2">
                        <div
                          className="w-4 rounded-t bg-primary"
                          style={{ height: `${ppsPct}%` }}
                          title={`${b.flow_rate_pps} pps`}
                        />
                        <div
                          className="w-4 rounded-t bg-warning"
                          style={{ height: `${riskPct}%` }}
                          title={`Risk ${b.risk_score}/100`}
                        />
                      </div>
                      <div className="text-center font-mono text-[10px]">
                        <p className="text-text-h font-semibold truncate">{b.source_ip}</p>
                        <p className="text-muted">
                          {b.flow_rate_pps}p / {b.risk_score}r
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="bg-surface border border-border rounded-xl overflow-hidden">
              <div className="p-5 border-b border-border flex items-center justify-between">
                <h2 className="text-base font-heading font-semibold text-text-h">
                  Network Behavior Analysis Table
                </h2>
                <span className="text-xs font-mono text-muted">{behaviors.length} flows</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-background border-b border-border text-[11px] font-mono text-muted uppercase">
                      <th className="p-3.5">Src → Dst</th>
                      <th className="p-3.5">Proto / Port</th>
                      <th className="p-3.5">Behavioral Profile</th>
                      <th className="p-3.5">Rate (PPS)</th>
                      <th className="p-3.5">SYN Ratio</th>
                      <th className="p-3.5">Avg Payload</th>
                      <th className="p-3.5">Risk Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-xs font-mono">
                    {behaviors.length > 0 ? (
                      behaviors.map((row) => (
                        <tr key={row.id} className="hover:bg-surface-hover transition-colors">
                          <td className="p-3.5 text-text-h">
                            {row.source_ip} <span className="text-primary">→</span> {row.destination_ip}
                          </td>
                          <td className="p-3.5 text-text">
                            {row.protocol}:<span className="text-muted">{row.destination_port}</span>
                          </td>
                          <td className="p-3.5 text-text-h font-sans font-medium">
                            {row.behavioral_profile}
                          </td>
                          <td className="p-3.5 text-primary">{row.flow_rate_pps} pps</td>
                          <td className="p-3.5 text-text">{row.syn_ratio.toFixed(2)}</td>
                          <td className="p-3.5 text-muted">{row.avg_packet_size} B</td>
                          <td className="p-3.5 font-bold text-text-h">{row.risk_score}/100</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-muted">
                          No network flow telemetry available yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* TAB 2: SUSPICIOUS ACTIVITY */}
        {activeTab === "suspicious" && (
          <div className="space-y-6">
            <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
                <h2 className="text-sm font-heading font-semibold text-text-h">
                  Suspicious Trigger Bars
                </h2>
                <div className="space-y-3 text-xs font-mono">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-warning">New / Unseen IP Addresses</span>
                      <span className="text-text-h font-bold">{newIpCount}</span>
                    </div>
                    <div className="w-full h-2.5 bg-background rounded-full overflow-hidden">
                      <div
                        className="h-full bg-warning rounded-full"
                        style={{
                          width: `${Math.min(
                            100,
                            (newIpCount / Math.max(suspiciousDetections.length, 1)) * 100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-danger">Unauthorized Clearance / Restricted Ports</span>
                      <span className="text-text-h font-bold">{clearanceViolationCount}</span>
                    </div>
                    <div className="w-full h-2.5 bg-background rounded-full overflow-hidden">
                      <div
                        className="h-full bg-danger rounded-full"
                        style={{
                          width: `${Math.min(
                            100,
                            (clearanceViolationCount / Math.max(suspiciousDetections.length, 1)) * 100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
                <h2 className="text-sm font-heading font-semibold text-text-h">
                  Team Lead Triage Progress
                </h2>
                <div className="space-y-2.5 text-xs font-mono">
                  <div className="flex justify-between text-muted">
                    <span>Pending: {pendingCount}</span>
                    <span className="text-success">Action Taken: {actionCount}</span>
                    <span>Dismissed: {dismissedCount}</span>
                  </div>
                  <div className="w-full h-3 bg-background rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-warning"
                      style={{ width: `${(pendingCount / triageTotal) * 100}%` }}
                    />
                    <div
                      className="h-full bg-success"
                      style={{ width: `${(actionCount / triageTotal) * 100}%` }}
                    />
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${(dismissedCount / triageTotal) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-surface border border-border rounded-xl p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {suspiciousDetections.slice(0, 6).map((item) => (
                  <div
                    key={item.id}
                    className="bg-background border border-border rounded-lg p-4 flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-1 text-xs font-mono">
                      <div className="flex items-center justify-between">
                        <span className="text-primary font-semibold">{item.source_ip}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${classificationBadge(
                            item.classification
                          )}`}
                        >
                          {item.classification}
                        </span>
                      </div>
                      <p className="text-muted">
                        Target: {item.destination_ip}:{item.destination_port}
                      </p>
                      <p className="text-text-h font-sans font-medium">{item.detection_trigger}</p>
                    </div>

                    <button
                      onClick={() => prefillReportFromRow(item)}
                      className="w-full py-1.5 px-3 rounded bg-primary/15 text-primary border border-primary/30 text-xs font-semibold hover:bg-primary/25 transition-colors cursor-pointer"
                    >
                      Report This Activity
                    </button>
                  </div>
                ))}
              </div>

              <form
                onSubmit={handleReportSubmit}
                className="bg-background border border-border rounded-xl p-4 space-y-3"
              >
                <p className="text-xs font-mono uppercase text-primary font-semibold">
                  Report Suspicious Activity to Team Lead
                </p>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <input
                    type="text"
                    required
                    value={reportSourceIp}
                    onChange={(e) => setReportSourceIp(e.target.value)}
                    placeholder="Source IP"
                    className="bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text-h outline-none focus:border-primary"
                  />
                  <input
                    type="text"
                    value={reportDestIp}
                    onChange={(e) => setReportDestIp(e.target.value)}
                    placeholder="Destination IP"
                    className="bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text-h outline-none focus:border-primary"
                  />
                  <input
                    type="text"
                    value={reportClearance}
                    onChange={(e) => setReportClearance(e.target.value)}
                    placeholder="Clearance / Access Context"
                    className="bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text-h outline-none focus:border-primary"
                  />
                  <select
                    value={reportSeverity}
                    onChange={(e) => setReportSeverity(e.target.value)}
                    className="bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text-h outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    required
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    placeholder="Reason (new IP, unauthorized access above security clearance, anomalous burst)..."
                    className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text-h outline-none focus:border-primary"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-primary text-background font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-primary/90 transition-colors cursor-pointer"
                  >
                    <Send size={14} /> Report to Team Lead
                  </button>
                </div>
              </form>

              {reports.length > 0 && (
                <div className="divide-y divide-border border border-border rounded-xl overflow-hidden bg-background">
                  {reports.map((rep) => (
                    <div
                      key={rep.id}
                      className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-xs font-mono"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-text-h font-bold">#{rep.id}</span>
                          <span className="text-primary font-semibold">
                            {rep.source_ip} → {rep.destination_ip}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-surface border border-border text-muted">
                            {rep.severity}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded font-bold ${rep.status === "ACTION_TAKEN"
                              ? "bg-success/15 text-success"
                              : rep.status === "DISMISSED"
                                ? "bg-muted/20 text-muted"
                                : "bg-warning/15 text-warning"
                              }`}
                          >
                            {rep.status}
                          </span>
                        </div>
                        <p className="text-text-h font-sans">{rep.reason}</p>
                        <p className="text-muted">
                          Clearance: {rep.clearance_violation} • By {rep.reported_by_name || "Analyst"}
                        </p>
                      </div>

                      {isLeadOrAdmin && rep.status === "PENDING_LEAD_REVIEW" && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleLeadDecision(rep.id, "ACTION_TAKEN")}
                            className="px-3 py-1.5 rounded-lg bg-success/15 text-success border border-success/30 font-semibold flex items-center gap-1 hover:bg-success/25 transition-colors cursor-pointer"
                          >
                            <CheckCircle2 size={14} /> Take Action
                          </button>
                          <button
                            onClick={() => handleLeadDecision(rep.id, "DISMISSED")}
                            className="px-3 py-1.5 rounded-lg bg-danger/15 text-danger border border-danger/30 font-semibold flex items-center gap-1 hover:bg-danger/25 transition-colors cursor-pointer"
                          >
                            <XCircle size={14} /> Dismiss
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB 3: PATTERN RECOGNITION (Trend Line Chart + Regular IPs & Packet Transfers Table) */}
        {activeTab === "patterns" && (
          <div className="space-y-6">
            {(() => {
              const srcSeries = regularPatterns.filter((p) => p.role === "Regular Source IP").slice(0, 4);
              const dstSeries = regularPatterns
                .filter((p) => p.role === "Regular Destination IP")
                .slice(0, 4);
              const flowSeries = regularPatterns
                .filter((p) => p.role === "Recurring Packet Transfer")
                .slice(0, 4);

              const pointCount = Math.max(
                srcSeries.length,
                dstSeries.length,
                flowSeries.length,
                1
              );

              const allFreqs = [
                ...srcSeries.map((p) => p.frequency),
                ...dstSeries.map((p) => p.frequency),
                ...flowSeries.map((p) => p.frequency),
                1,
              ];
              const maxFreq = Math.max(...allFreqs, 1);

              const trendW = 640;
              const trendH = 195;
              const padLeft = 48;
              const padRight = 36;
              const padTop = 24;
              const padBottom = 154;
              const plotW = trendW - padLeft - padRight;
              const plotH = padBottom - padTop;

              const buildPoints = (items: RegularPatternItem[]) =>
                items.map((item, idx) => {
                  const x =
                    pointCount === 1
                      ? padLeft + plotW / 2
                      : padLeft + (idx / (pointCount - 1)) * plotW;
                  const ratio = item.frequency / maxFreq;
                  const y = padBottom - ratio * plotH;
                  return { x, y, label: item.ip_address, freq: item.frequency };
                });

              const srcPts = buildPoints(srcSeries);
              const dstPts = buildPoints(dstSeries);
              const flowPts = buildPoints(flowSeries);

              const toPolyline = (pts: { x: number; y: number }[]) =>
                pts.map((p) => `${p.x},${p.y}`).join(" ");

              const xAxisLabels = Array.from({ length: pointCount }, (_, idx) => {
                const candidate =
                  flowSeries[idx]?.ip_address ||
                  srcSeries[idx]?.ip_address ||
                  `Baseline ${idx + 1}`;
                return candidate.length > 18 ? `${candidate.slice(0, 17)}…` : candidate;
              });

              return (
                <section className="bg-[#0B1220] border border-[#1E293B] rounded-2xl p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-base font-heading font-semibold text-text-h">
                      Regular Transfer Frequency Trend
                    </h2>

                    <div className="flex flex-wrap items-center gap-5 text-xs font-mono">
                      <span className="flex items-center gap-1.5 text-[#22D3EE]">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#22D3EE]" /> Source IP
                      </span>
                      <span className="flex items-center gap-1.5 text-[#F59E0B]">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" /> Destination IP
                      </span>
                      <span className="flex items-center gap-1.5 text-[#F43F5E]">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#F43F5E]" /> Packet Transfer
                      </span>
                    </div>
                  </div>

                  <svg viewBox={`0 0 ${trendW} ${trendH}`} className="w-full h-48">
                    {[0, 0.5, 1].map((tick, i) => {
                      const yLine = padBottom - tick * plotH;
                      const tickVal = Math.round(tick * maxFreq);
                      return (
                        <g key={i}>
                          <line
                            x1={padLeft}
                            y1={yLine}
                            x2={trendW - padRight}
                            y2={yLine}
                            stroke="#1E293B"
                            strokeDasharray="3 3"
                            strokeWidth="1"
                          />
                          <text
                            x={padLeft - 8}
                            y={yLine + 3}
                            textAnchor="end"
                            fill="#64748B"
                            fontSize="9.5"
                            fontFamily="JetBrains Mono, monospace"
                          >
                            {tickVal}x
                          </text>
                        </g>
                      );
                    })}

                    {srcPts.length > 1 && (
                      <polyline
                        fill="none"
                        stroke="#22D3EE"
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        points={toPolyline(srcPts)}
                      />
                    )}
                    {dstPts.length > 1 && (
                      <polyline
                        fill="none"
                        stroke="#F59E0B"
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        points={toPolyline(dstPts)}
                      />
                    )}
                    {flowPts.length > 1 && (
                      <polyline
                        fill="none"
                        stroke="#F43F5E"
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        points={toPolyline(flowPts)}
                      />
                    )}

                    {[
                      { pts: srcPts, color: "#22D3EE", role: "Source IP" },
                      { pts: dstPts, color: "#F59E0B", role: "Destination IP" },
                      { pts: flowPts, color: "#F43F5E", role: "Packet Transfer" },
                    ].map((series) =>
                      series.pts.map((pt, i) => (
                        <circle
                          key={`${series.role}-${i}`}
                          cx={pt.x}
                          cy={pt.y}
                          r="3.5"
                          fill={series.color}
                        >
                          <title>{`${series.role} (${pt.label}): ${pt.freq} transfers`}</title>
                        </circle>
                      ))
                    )}

                    {xAxisLabels.map((lbl, idx) => {
                      const xPos =
                        pointCount === 1
                          ? padLeft + plotW / 2
                          : padLeft + (idx / (pointCount - 1)) * plotW;
                      return (
                        <text
                          key={idx}
                          x={xPos}
                          y={trendH - 10}
                          textAnchor="middle"
                          fill="#64748B"
                          fontSize="9.5"
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {lbl}
                        </text>
                      );
                    })}
                  </svg>
                </section>
              );
            })()}

            <section className="bg-surface border border-border rounded-xl overflow-hidden">
              <div className="p-5 border-b border-border flex items-center justify-between">
                <h2 className="text-base font-heading font-semibold text-text-h">
                  Regular IPs & Packet Transfers Table
                </h2>
                <span className="text-xs font-mono text-muted">{regularPatterns.length} baselines</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-background border-b border-border text-[11px] font-mono text-muted uppercase">
                      <th className="p-3.5">Pattern Role</th>
                      <th className="p-3.5">IP / Flow</th>
                      <th className="p-3.5">Proto / Port</th>
                      <th className="p-3.5">Frequency</th>
                      <th className="p-3.5">Avg Payload</th>
                      <th className="p-3.5">Cadence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-xs font-mono">
                    {regularPatterns.length > 0 ? (
                      regularPatterns.map((pat) => (
                        <tr key={pat.pattern_key} className="hover:bg-surface-hover transition-colors">
                          <td className="p-3.5">
                            <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold">
                              {pat.role}
                            </span>
                          </td>
                          <td className="p-3.5 text-text-h font-semibold">{pat.ip_address}</td>
                          <td className="p-3.5 text-text">
                            {pat.protocol}:{pat.port}
                          </td>
                          <td className="p-3.5 text-success font-bold">{pat.frequency}x</td>
                          <td className="p-3.5 text-muted">{pat.avg_bytes} B</td>
                          <td className="p-3.5 text-text font-sans">{pat.cadence}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-muted">
                          No regular traffic patterns detected yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* TAB 4: ANOMALY CLASSIFICATION */}
        {activeTab === "classification" && (
          <div className="space-y-6">
            <section className="bg-surface border border-border rounded-xl p-6">
              <h2 className="text-base font-heading font-semibold text-text-h mb-4">
                Classification Split (Pie Chart)
              </h2>

              <div className="flex flex-col sm:flex-row items-center gap-8">
                <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
                  <svg width="112" height="112" viewBox="0 0 112 112" className="-rotate-90">
                    <circle cx="56" cy="56" r={pieRadius} fill="transparent" stroke="#1E293B" strokeWidth="15" />
                    {classPieSlices.map((sl) => {
                      const segLen = (sl.count / totalClassified) * pieCircumference;
                      const dashArray = `${segLen} ${pieCircumference}`;
                      const dashOffset = -classPieOffset;
                      classPieOffset += segLen;
                      return (
                        <circle
                          key={sl.label}
                          cx="56"
                          cy="56"
                          r={pieRadius}
                          fill="transparent"
                          stroke={sl.hex}
                          strokeWidth="15"
                          strokeDasharray={dashArray}
                          strokeDashoffset={dashOffset}
                        />
                      );
                    })}
                  </svg>
                  <div className="absolute text-center font-mono">
                    <p className="text-sm font-bold text-text-h">{allClassifications.length}</p>
                    <p className="text-[10px] text-muted">Total</p>
                  </div>
                </div>

                <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
                  {classPieSlices.map((sl) => (
                    <div key={sl.label} className="bg-background border border-border rounded-lg p-4">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full inline-block"
                          style={{ backgroundColor: sl.hex }}
                        />
                        <span className="text-text-h font-semibold">{sl.label}</span>
                      </div>
                      <p className="text-xl font-bold text-text-h mt-2">{sl.count}</p>
                      <p className="text-muted">
                        {Math.round((sl.count / totalClassified) * 100)}%
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="bg-surface border border-border rounded-xl overflow-hidden">
              <div className="p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-base font-heading font-semibold text-text-h">
                  Classified Events & Risk Assessment
                </h2>

                <select
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  className="bg-background border border-border rounded-lg px-3 py-1.5 text-xs font-mono text-text-h outline-none focus:border-primary cursor-pointer self-start sm:self-auto"
                >
                  <option value="ALL">All Classifications</option>
                  <option value="DANGEROUS">Dangerous</option>
                  <option value="RISK_ASSESSED">Risk Assessed</option>
                  <option value="MISTAKE">Mistake</option>
                </select>
              </div>

              <div className="divide-y divide-border">
                {filteredClassifications.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap font-mono">
                        <span
                          className={`px-2.5 py-0.5 rounded font-bold ${classificationBadge(
                            item.classification
                          )}`}
                        >
                          {item.classification}
                        </span>
                        <span className="text-text-h font-semibold">
                          {item.source_ip} → {item.destination_ip} ({item.protocol}:
                          {item.destination_port})
                        </span>
                        <span className="text-muted">
                          Risk: {item.risk_level} ({item.risk_score}/100)
                        </span>
                      </div>
                      <p className="text-muted">{item.rationale}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}