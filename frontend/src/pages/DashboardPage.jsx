import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarClock,
  CheckCircle2,
  CircleHelp,
  Cpu,
  Download,
  HardDrive,
  MemoryStick,
  RadioTower,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Wifi,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import api, { getApiError } from "../services/api";
import "./DashboardPage.css";

function number(value) {
  return new Intl.NumberFormat("en-IN").format(Number(value || 0));
}

function bytes(value) {
  const amount = Number(value || 0);
  if (amount < 1024) return `${amount} B`;
  if (amount < 1024 * 1024) return `${(amount / 1024).toFixed(1)} KB`;
  if (amount < 1024 ** 3) return `${(amount / 1024 ** 2).toFixed(2)} MB`;
  return `${(amount / 1024 ** 3).toFixed(2)} GB`;
}

function StatCard({ icon: Icon, label, value, detail, tone, pending = false }) {
  return (
    <article className="nids-stat-card">
      <div className={`nids-stat-icon ${tone}`}><Icon size={19} /></div>
      <div className="nids-stat-title">{label}</div>
      <div className={`nids-stat-value ${pending ? "is-pending" : ""}`}>{value}</div>
      <div className="nids-stat-caption">{detail}</div>
    </article>
  );
}

function HealthCard({ icon: Icon, label, value, used, total }) {
  const percentage = typeof value === "number"
    ? Math.max(0, Math.min(100, value))
    : null;
  const tone = percentage >= 85 ? "high" : percentage >= 70 ? "medium" : "normal";

  return (
    <div className="nids-health-card">
      <div className="nids-health-top">
        <span className="nids-health-icon"><Icon size={17} /></span>
        <span>{label}</span>
        <strong>{percentage === null ? "—" : `${percentage.toFixed(1)}%`}</strong>
      </div>
      <div className="nids-health-track">
        <div className={`nids-health-fill ${tone}`} style={{ width: `${percentage ?? 0}%` }} />
      </div>
      {used != null && total != null && <small>{bytes(used)} of {bytes(total)}</small>}
      {percentage === null && <small>Telemetry unavailable</small>}
    </div>
  );
}

const DETECTORS = [
  { name: "DDoS / traffic flood", description: "High-rate traffic anomaly rules" },
  { name: "Port scanning", description: "Multi-port connection behaviour" },
  { name: "Brute force", description: "Repeated authentication attempts" },
  { name: "SQL injection", description: "HTTP request payload inspection" },
  { name: "Cross-site scripting", description: "HTTP request payload inspection" },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [captures, setCaptures] = useState([]);
  const [captureTotal, setCaptureTotal] = useState(0);
  const [captureStatus, setCaptureStatus] = useState({ running: false, capture_id: null });
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const totals = useMemo(() => captures.reduce((acc, item) => ({
    packets: acc.packets + Number(item.packet_count || 0),
    traffic: acc.traffic + Number(item.total_bytes || 0),
  }), { packets: 0, traffic: 0 }), [captures]);

  const loadDashboard = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const [captureResponse, statusResponse, healthResponse] = await Promise.all([
        api.get("/network/captures", { params: { limit: 50, offset: 0 } }),
        api.get("/network/captures/status"),
        api.get("/network/system-health"),
      ]);
      setCaptures(captureResponse.data.items || []);
      setCaptureTotal(Number(captureResponse.data.total || 0));
      setCaptureStatus(statusResponse.data);
      setHealth(healthResponse.data);
      setError("");
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    const timer = window.setInterval(() => loadDashboard(), 10000);
    return () => window.clearInterval(timer);
  }, [loadDashboard]);

  const systemState = useMemo(() => {
    if (!health) return { label: "Checking telemetry", tone: "unknown" };
    const highest = Math.max(
      Number(health.cpu_percent || 0),
      Number(health.memory_percent || 0),
      Number(health.disk_percent || 0)
    );
    if (highest >= 90) return { label: "Attention required", tone: "high" };
    if (highest >= 80) return { label: "Resource usage elevated", tone: "medium" };
    return { label: "Resources normal", tone: "normal" };
  }, [health]);

  const exportReport = () => {
    const rows = [
      ["Metric", "Value"],
      ["Capture sessions returned", captures.length],
      ["Total capture sessions", captureTotal],
      ["Active capture", captureStatus.running ? "Yes" : "No"],
      ["Packets across latest returned sessions", totals.packets],
      ["Traffic across latest returned sessions (bytes)", totals.traffic],
      ["CPU percent", health?.cpu_percent ?? "Unavailable"],
      ["Memory percent", health?.memory_percent ?? "Unavailable"],
      ["Disk percent", health?.disk_percent ?? "Unavailable"],
      ["Intrusion alerts", "Detection engine not connected"],
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "netshield-security-overview.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="nids-dashboard">
      <div className="nids-heading">
        <div>
          <p className="page-eyebrow">SECURITY CENTER / OVERVIEW</p>
          <h1>Network Intrusion Detection System</h1>
          <p className="page-description">Security posture, detection coverage and host health at a glance.</p>
        </div>
        <div className="nids-heading-actions">
          <button className="nids-icon-button" onClick={() => loadDashboard(true)} disabled={refreshing} title="Refresh overview">
            <RefreshCw size={16} className={refreshing ? "nids-spin" : ""} />
          </button>
          <button className="nids-export-button" onClick={exportReport}>
            <Download size={15} /> Export report
          </button>
        </div>
      </div>

      {error && <div className="nids-error"><AlertTriangle size={16} />{error}</div>}

      <section className="nids-welcome-strip">
        <div className="nids-welcome-mark"><ShieldCheck size={24} /></div>
        <div className="nids-welcome-copy">
          <span>NETSHIELD SECURITY OPERATIONS</span>
          <strong>Welcome back, {user?.name?.split(" ")[0] || "Analyst"}</strong>
          <p>Capture infrastructure is connected. Intrusion detection rules are not yet active.</p>
        </div>
        <div className={`nids-capture-state ${captureStatus.running ? "is-live" : ""}`}>
          <span className={`nids-live-dot ${captureStatus.running ? "active" : ""}`} />
          {captureStatus.running ? "Live capture running" : "Capture idle"}
        </div>
      </section>

      <section className="nids-stat-grid">
        <StatCard label="TOTAL ALERTS" value="Not connected" detail="No detection engine yet" icon={Bell} tone="red" pending />
        <StatCard label="CRITICAL ALERTS" value="—" detail="Awaiting alert integration" icon={ShieldAlert} tone="orange" pending />
        <StatCard label="BLOCKED ATTACKS" value="—" detail="Blocking is not implemented" icon={ShieldCheck} tone="purple" pending />
        <StatCard label="TRAFFIC ANALYZED" value={bytes(totals.traffic)} detail={`Across latest ${captures.length} returned sessions`} icon={Activity} tone="teal" />
        <StatCard label="ACTIVE CAPTURES" value={captureStatus.running ? "1" : "0"} detail="Live TShark capture processes" icon={RadioTower} tone="purple" />
      </section>

      <div className="nids-overview-grid">
        <section className="nids-panel nids-detection-panel">
          <div className="nids-panel-heading">
            <div><h2>Threat detection coverage</h2><p>Detection modules planned for NetShield</p></div>
            <span className="nids-pending-badge"><CircleHelp size={13} /> Not active yet</span>
          </div>
          <div className="nids-detector-list">
            {DETECTORS.map((detector) => (
              <div className="nids-detector-item" key={detector.name}>
                <span className="nids-detector-icon"><ShieldAlert size={17} /></span>
                <div className="nids-detector-copy"><strong>{detector.name}</strong><small>{detector.description}</small></div>
                <span className="nids-not-configured">Pending</span>
              </div>
            ))}
          </div>
          <div className="nids-detection-note"><AlertTriangle size={15} /> These are planned detector categories, not detected attacks. No alert counts are being fabricated.</div>
        </section>

        <section className="nids-panel nids-health-panel">
          <div className="nids-panel-heading">
            <div><h2>System status</h2><p>Windows host telemetry · refreshes every 10 seconds</p></div>
            <span className={`nids-health-state ${systemState.tone}`}>{systemState.label}</span>
          </div>
          <div className="nids-health-list">
            <HealthCard icon={Cpu} label="CPU usage" value={health?.cpu_percent} />
            <HealthCard icon={MemoryStick} label="Memory usage" value={health?.memory_percent} used={health?.memory_used_bytes} total={health?.memory_total_bytes} />
            <HealthCard icon={HardDrive} label="Disk usage" value={health?.disk_percent} used={health?.disk_used_bytes} total={health?.disk_total_bytes} />
          </div>
          <div className="nids-network-io">
            <div><span>Network received</span><strong>{bytes(health?.network_bytes_received)}</strong></div>
            <div><span>Network sent</span><strong>{bytes(health?.network_bytes_sent)}</strong></div>
          </div>
        </section>
      </div>

      <section className="nids-panel nids-events-panel">
        <div className="nids-panel-heading">
          <div><h2>Recent security alerts</h2><p>Persisted detection events will appear here</p></div>
          <span className="nids-pending-badge"><Bell size={13} /> Alert engine pending</span>
        </div>
        <div className="nids-alert-empty">
          <ShieldCheck size={25} />
          <strong>No security alerts to display</strong>
          <span>Packet capture is operational, but intrusion detection and alert persistence have not been implemented yet.</span>
        </div>
      </section>

      <section className="nids-panel nids-session-panel">
        <div className="nids-panel-heading">
          <div><h2>Recent capture activity</h2><p>Operational history from the network capture service</p></div>
          <button className="nids-text-action" onClick={() => navigate("/network-monitoring")}>Open traffic monitor <ArrowRight size={15} /></button>
        </div>
        {captures.length ? (
          <div className="nids-sessions-table-wrap">
            <table className="nids-sessions-table">
              <thead><tr><th>Session</th><th>Interface</th><th>Status</th><th>Packets</th><th>Traffic</th><th>Started</th></tr></thead>
              <tbody>{captures.slice(0, 6).map((item) => (
                <tr key={item.id}>
                  <td>#{item.id}</td><td>{item.interface_name}</td>
                  <td><span className={`nids-session-status ${item.status}`}>{item.status}</span></td>
                  <td>{number(item.packet_count)}</td><td>{bytes(item.total_bytes)}</td>
                  <td>{new Date(item.started_at).toLocaleString()}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : (
          <div className="nids-empty-captures"><Wifi size={22} /><span>No capture sessions yet. Start one from Network Monitoring.</span></div>
        )}
      </section>

      <div className="nids-footer-note"><CheckCircle2 size={15} /> Security overview shows real capture and host telemetry. Attack detection and automatic blocking are not yet enabled.</div>
      {loading && <div className="nids-loading"><span className="loader" />Loading security overview...</div>}
    </div>
  );
}
