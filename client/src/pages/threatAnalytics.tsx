import { useState } from "react";
import {
  AlertTriangle,
  Cpu,
  Download,
  HardDrive,
  MemoryStick,
  Network,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import Sidebar from "../components/sidebar";

interface AttackCategory {
  name: string;
  count: number;
  percentage: number;
  color: string;
}

interface RecentAlert {
  id: string;
  timestamp: string;
  type: string;
  sourceIp: string;
  destinationIp: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  action: "Blocked" | "Logged" | "Mitigated";
}

const DUMMY_ATTACK_TYPES: AttackCategory[] = [
  { name: "DDoS Flood", count: 802, percentage: 32.6, color: "#F43F5E" },
  { name: "Port Scan", count: 561, percentage: 22.8, color: "#F59E0B" },
  { name: "SQL Injection", count: 450, percentage: 18.3, color: "#22D3EE" },
  { name: "XSS Payload", count: 312, percentage: 12.7, color: "#A78BFA" },
  { name: "Brute Force", count: 194, percentage: 7.9, color: "#60A5FA" },
  { name: "Other / Anomaly", count: 139, percentage: 5.7, color: "#10B981" },
];

const DUMMY_RECENT_ALERTS: RecentAlert[] = [
  {
    id: "ALT-9041",
    timestamp: "Nov 19, 2026 14:32:21",
    type: "DDoS Flood",
    sourceIp: "185.220.101.4",
    destinationIp: "192.168.1.10",
    severity: "Critical",
    action: "Blocked",
  },
  {
    id: "ALT-9040",
    timestamp: "Nov 19, 2026 14:31:45",
    type: "SQL Injection",
    sourceIp: "45.33.32.156",
    destinationIp: "192.168.1.15",
    severity: "High",
    action: "Blocked",
  },
  {
    id: "ALT-9039",
    timestamp: "Nov 19, 2026 14:30:11",
    type: "Port Scan",
    sourceIp: "103.21.244.8",
    destinationIp: "192.168.1.22",
    severity: "Medium",
    action: "Logged",
  },
  {
    id: "ALT-9038",
    timestamp: "Nov 19, 2026 14:29:33",
    type: "XSS Payload",
    sourceIp: "91.132.147.19",
    destinationIp: "192.168.1.18",
    severity: "Medium",
    action: "Blocked",
  },
  {
    id: "ALT-9037",
    timestamp: "Nov 19, 2026 14:28:09",
    type: "Brute Force",
    sourceIp: "172.67.188.42",
    destinationIp: "192.168.1.1",
    severity: "Low",
    action: "Mitigated",
  },
];

const SYSTEM_METRICS = [
  { label: "CPU Utilization (Inference Engine)", value: 32, icon: Cpu, color: "bg-primary" },
  { label: "Memory Usage (Packet Buffer)", value: 65, icon: MemoryStick, color: "bg-warning" },
  { label: "Disk Storage (Flow & Audit Logs)", value: 48, icon: HardDrive, color: "bg-success" },
  { label: "Network I/O Throughput", value: 45, icon: Network, color: "bg-primary" },
];

export default function ThreatAnalytics() {
  const [timeRange, setTimeRange] = useState("Last 7 Days");
  const [exportNotice, setExportNotice] = useState(false);

  const totalAttacks = DUMMY_ATTACK_TYPES.reduce((sum, item) => sum + item.count, 0);
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  let offsetAccumulator = 0;

  const handleExportReport = () => {
    setExportNotice(true);
    setTimeout(() => setExportNotice(false), 3000);
  };

  const severityBadge = (severity: RecentAlert["severity"]) => {
    switch (severity) {
      case "Critical":
        return "bg-danger/15 text-danger border border-danger/30";
      case "High":
        return "bg-warning/15 text-warning border border-warning/30";
      case "Medium":
        return "bg-primary/15 text-primary border border-primary/30";
      case "Low":
        return "bg-success/15 text-success border border-success/30";
    }
  };

  return (
    <div className="min-h-screen bg-background text-text flex">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold font-heading text-text-h flex items-center gap-2.5">
                <ShieldAlert className="text-primary" size={24} /> Threat Intelligence & Analytics
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-warning/15 text-warning border border-warning/30">
                PREVIEW MODE (MODULE 3–6)
              </span>
            </div>
            <p className="text-sm text-muted mt-1">
              Simulated intrusion classification, risk scoring, and SOC incident telemetry
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text-h outline-none focus:border-primary cursor-pointer"
            >
              <option value="Last 24 Hours">Last 24 Hours</option>
              <option value="Last 7 Days">Last 7 Days</option>
              <option value="Last 30 Days">Last 30 Days</option>
            </select>

            <button
              onClick={handleExportReport}
              className="px-4 py-2 rounded-lg bg-primary text-background font-semibold text-xs flex items-center gap-1.5 hover:bg-primary/90 transition-all cursor-pointer"
            >
              <Download size={14} /> Export Report
            </button>
          </div>
        </header>

        {exportNotice && (
          <div className="p-3 bg-success/10 border border-success/30 text-success text-xs font-mono rounded-lg">
            Threat analytics snapshot ({timeRange}) prepared for export.
          </div>
        )}

        {/* Top KPI Row */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          <div className="bg-surface border border-border rounded-xl p-5 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-muted uppercase">
              <span>Total Alerts</span>
              <AlertTriangle size={16} className="text-primary" />
            </div>
            <p className="text-2xl font-bold text-text-h">2,458</p>
            <p className="text-xs font-mono text-danger">+12.5% vs previous period</p>
          </div>

          <div className="bg-surface border border-border rounded-xl p-5 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-muted uppercase">
              <span>Critical Threats</span>
              <ShieldAlert size={16} className="text-danger" />
            </div>
            <p className="text-2xl font-bold text-danger">156</p>
            <p className="text-xs font-mono text-danger">+8.2% high-risk signatures</p>
          </div>

          <div className="bg-surface border border-border rounded-xl p-5 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-muted uppercase">
              <span>Blocked Intrusions</span>
              <ShieldCheck size={16} className="text-success" />
            </div>
            <p className="text-2xl font-bold text-success">1,324</p>
            <p className="text-xs font-mono text-success">98.4% automated mitigation</p>
          </div>

          <div className="bg-surface border border-border rounded-xl p-5 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-muted uppercase">
              <span>Avg Risk Score</span>
              <Network size={16} className="text-warning" />
            </div>
            <p className="text-2xl font-bold text-text-h">
              42 <span className="text-xs font-mono text-muted">/ 100</span>
            </p>
            <p className="text-xs font-mono text-warning">Moderate baseline posture</p>
          </div>
        </section>

        {/* Middle Row: Multi-Line Threat Trend + Donut Attack Breakdown */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Multi-Series SVG Trend Chart */}
          <div className="lg:col-span-2 bg-surface border border-border rounded-xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-base font-heading font-semibold text-text-h">
                Threat Classification Trend ({timeRange})
              </h2>
              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="flex items-center gap-1.5 text-primary">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary" /> Normal
                </span>
                <span className="flex items-center gap-1.5 text-warning">
                  <span className="w-2.5 h-2.5 rounded-full bg-warning" /> Suspicious
                </span>
                <span className="flex items-center gap-1.5 text-danger">
                  <span className="w-2.5 h-2.5 rounded-full bg-danger" /> Malicious
                </span>
              </div>
            </div>

            <svg viewBox="0 0 560 180" className="w-full h-48">
              {[30, 75, 120, 155].map((yPos, i) => (
                <line
                  key={i}
                  x1="28"
                  y1={yPos}
                  x2="532"
                  y2={yPos}
                  stroke="#243247"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
              ))}

              {/* Normal Traffic Curve */}
              <path
                d="M 35 85 L 118 72 L 201 78 L 284 58 L 367 48 L 450 62 L 525 42"
                fill="none"
                stroke="#22D3EE"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              {/* Suspicious Traffic Curve */}
              <path
                d="M 35 122 L 118 116 L 201 124 L 284 114 L 367 118 L 450 110 L 525 113"
                fill="none"
                stroke="#F59E0B"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              {/* Malicious Traffic Curve */}
              <path
                d="M 35 144 L 118 140 L 201 146 L 284 136 L 367 142 L 450 135 L 525 138"
                fill="none"
                stroke="#F43F5E"
                strokeWidth="2.2"
                strokeLinecap="round"
              />

              {["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7"].map((lbl, idx) => (
                <text
                  key={lbl}
                  x={35 + idx * 81.6}
                  y="172"
                  textAnchor="middle"
                  fill="#64748B"
                  fontSize="10"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {lbl}
                </text>
              ))}
            </svg>
          </div>

          {/* Top Attack Types Donut Chart */}
          <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
            <h2 className="text-base font-heading font-semibold text-text-h">Top Attack Types</h2>
            <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center gap-5">
              <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
                <svg width="112" height="112" viewBox="0 0 112 112" className="-rotate-90">
                  <circle cx="56" cy="56" r={radius} fill="transparent" stroke="#1E293B" strokeWidth="14" />
                  {DUMMY_ATTACK_TYPES.map((item) => {
                    const segLen = (item.count / totalAttacks) * circumference;
                    const dashArray = `${segLen} ${circumference}`;
                    const dashOffset = -offsetAccumulator;
                    offsetAccumulator += segLen;
                    return (
                      <circle
                        key={item.name}
                        cx="56"
                        cy="56"
                        r={radius}
                        fill="transparent"
                        stroke={item.color}
                        strokeWidth="14"
                        strokeDasharray={dashArray}
                        strokeDashoffset={dashOffset}
                      />
                    );
                  })}
                </svg>
                <div className="absolute text-center">
                  <p className="text-sm font-bold text-text-h">{totalAttacks.toLocaleString()}</p>
                  <p className="text-[10px] font-mono text-muted">Total</p>
                </div>
              </div>

              <div className="flex-1 w-full space-y-2 text-xs font-mono">
                {DUMMY_ATTACK_TYPES.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-text-h">
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block"
                        style={{ backgroundColor: item.color }}
                      />
                      {item.name}
                    </span>
                    <span className="text-muted">
                      {item.percentage}% ({item.count})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Bottom Row: Recent Alerts Table + System Health */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-surface border border-border rounded-xl overflow-hidden">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h2 className="text-base font-heading font-semibold text-text-h">Recent Intrusion Alerts</h2>
              <span className="text-xs font-mono text-primary">Simulated Feed</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-background border-b border-border text-xs font-mono text-muted uppercase">
                    <th className="p-3.5">Time</th>
                    <th className="p-3.5">Attack Type</th>
                    <th className="p-3.5">Source IP</th>
                    <th className="p-3.5">Target IP</th>
                    <th className="p-3.5">Severity</th>
                    <th className="p-3.5">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs font-mono">
                  {DUMMY_RECENT_ALERTS.map((alert) => (
                    <tr key={alert.id} className="hover:bg-surface-hover transition-colors">
                      <td className="p-3.5 text-muted">{alert.timestamp}</td>
                      <td className="p-3.5 text-text-h font-semibold">{alert.type}</td>
                      <td className="p-3.5 text-primary">{alert.sourceIp}</td>
                      <td className="p-3.5 text-text">{alert.destinationIp}</td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded font-bold ${severityBadge(alert.severity)}`}>
                          {alert.severity}
                        </span>
                      </td>
                      <td className="p-3.5 text-text-h">{alert.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-xl p-6 space-y-5">
            <h2 className="text-base font-heading font-semibold text-text-h">Engine & System Status</h2>
            <div className="space-y-4">
              {SYSTEM_METRICS.map((m) => {
                const Icon = m.icon;
                return (
                  <div key={m.label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-text-h flex items-center gap-2">
                        <Icon size={14} className="text-primary" /> {m.label}
                      </span>
                      <span className="text-muted">{m.value}%</span>
                    </div>
                    <div className="w-full h-2 bg-background rounded-full overflow-hidden">
                      <div className={`h-full ${m.color} rounded-full`} style={{ width: `${m.value}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}