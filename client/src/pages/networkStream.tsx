import React, { useEffect, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Network,
  Play,
  RefreshCw,
  Search,
  ShieldAlert,
  Upload,
} from "lucide-react";
import api from "../api/axios";
import Sidebar from "../components/sidebar";
import { useAuth } from "../context/authContext";

interface NetworkFlow {
  id: number;
  timestamp: string;
  source_ip: string;
  destination_ip: string;
  source_port: number;
  destination_port: number;
  protocol: string;
  packet_length: number;
  flow_duration: number;
  flag: string | null;
  status: string;
}

interface ProtocolStat {
  protocol: string;
  count: number;
  total_bytes: number;
}

interface HostStat {
  ip: string;
  packet_count: number;
  total_bytes: number;
}

interface DirectionStat {
  direction: string;
  count: number;
  total_bytes: number;
}

interface TimeSeriesPoint {
  time_bucket: string;
  packet_count: number;
  total_bytes: number;
}

interface TrafficSummary {
  total_flows: number;
  total_bytes: number;
  suspicious_count: number;
  protocols: ProtocolStat[];
  top_sources: HostStat[];
  top_destinations: HostStat[];
  directions: DirectionStat[];
  activity_over_time: TimeSeriesPoint[];
}

const PROTOCOL_COLORS = [
  "#22D3EE",
  "#10B981",
  "#60A5FA",
  "#F59E0B",
  "#A78BFA",
  "#F43F5E",
  "#34D399",
  "#94A3B8",
];

export default function NetworkStream() {
  const { user } = useAuth();
  const roleNames = user?.roles?.map((r) => r.role_name) || [];
  const canIngest = roleNames.includes("Administrator") || roleNames.includes("Team Lead");

  const [flows, setFlows] = useState<NetworkFlow[]>([]);
  const [summary, setSummary] = useState<TrafficSummary | null>(null);
  const [protocolFilter, setProtocolFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchIp, setSearchIp] = useState("");
  const [portFilter, setPortFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchTrafficData = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (protocolFilter) params.protocol = protocolFilter;
      if (statusFilter) params.status = statusFilter;
      if (searchIp.trim()) params.search_ip = searchIp.trim();
      if (portFilter.trim()) params.port = portFilter.trim();

      const [flowsRes, summaryRes] = await Promise.all([
        api.get<NetworkFlow[]>("/traffic/flows", { params }),
        api.get<TrafficSummary>("/traffic/summary"),
      ]);
      setFlows(flowsRes.data);
      setSummary(summaryRes.data);
    } catch (err) {
      console.error("Failed to fetch traffic telemetry", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrafficData();
  }, [protocolFilter, statusFilter]);

  const handleSimulateTraffic = async () => {
    setMessage(null);
    setError(null);
    try {
      const res = await api.post("/traffic/simulate?count=50");
      setMessage(res.data.message);
      fetchTrafficData();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Simulation failed.");
    }
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMessage(null);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api.post("/traffic/upload-csv", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessage(res.data.message);
      fetchTrafficData();
    } catch (err: any) {
      setError(err.response?.data?.detail || "CSV upload failed.");
    } finally {
      e.target.value = "";
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  // SVG Time-Series Chart calculations
  const series = summary?.activity_over_time || [];
  const maxVal = Math.max(...series.map((s) => s.total_bytes), 1);
  const chartW = 560;
  const chartH = 170;
  const padX = 28;
  const padY = 20;
  const plotW = chartW - padX * 2;
  const plotH = chartH - padY * 2;

  const points = series.map((pt, idx) => {
    const x =
      series.length === 1
        ? chartW / 2
        : padX + (idx / (series.length - 1)) * plotW;
    const y = padY + plotH - ((pt.total_bytes || 0) / maxVal) * plotH;
    return { ...pt, x, y };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(padY + plotH).toFixed(
          1
        )} L ${points[0].x.toFixed(1)} ${(padY + plotH).toFixed(1)} Z`
      : "";

  // Donut Chart stroke segments
  const totalProtoCount = summary?.protocols.reduce((acc, p) => acc + p.count, 0) || 0;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let cumulativeOffset = 0;

  return (
    <div className="min-h-screen bg-background text-text flex">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border">
          <div>
            <h1 className="text-2xl font-bold font-heading text-text-h flex items-center gap-2.5">
              <Network className="text-primary" size={24} /> Network Traffic & Packet Stream
            </h1>
            <p className="text-sm text-muted mt-1">
              Traffic volume over time, protocol breakdown, direction analysis, and CSV upload
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {canIngest && (
              <>
                <button
                  onClick={handleSimulateTraffic}
                  className="px-4 py-2 rounded-lg bg-primary text-background font-semibold text-xs flex items-center gap-1.5 hover:bg-primary/90 transition-all cursor-pointer"
                >
                  <Play size={14} /> Simulate Burst (50 Flows)
                </button>
                <label className="px-4 py-2 rounded-lg bg-surface border border-border text-text-h font-semibold text-xs flex items-center gap-1.5 hover:bg-surface-hover transition-all cursor-pointer">
                  <Upload size={14} className="text-primary" /> Upload Traffic CSV
                  <input type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" />
                </label>
              </>
            )}
            <button
              onClick={fetchTrafficData}
              className="p-2 rounded-lg bg-surface border border-border text-text-h hover:bg-surface-hover transition-colors cursor-pointer"
              title="Refresh Stream"
            >
              <RefreshCw size={16} className={loading ? "animate-spin text-primary" : ""} />
            </button>
          </div>
        </header>

        {error && <div className="p-3 bg-danger/10 border border-danger/30 text-danger text-sm rounded-lg">{error}</div>}
        {message && <div className="p-3 bg-success/10 border border-success/30 text-success text-sm rounded-lg">{message}</div>}

        {/* KPI Cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-surface border border-border rounded-xl p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-mono uppercase text-muted">Total Packets Collected</p>
              <p className="text-2xl font-bold text-text-h mt-1">{summary?.total_flows.toLocaleString() ?? 0}</p>
            </div>
            <div className="p-3 rounded-lg bg-primary/10 text-primary">
              <Activity size={24} />
            </div>
          </div>

          <div className="bg-surface border border-border rounded-xl p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-mono uppercase text-muted">Total Network Traffic</p>
              <p className="text-2xl font-bold text-text-h mt-1">{formatBytes(summary?.total_bytes ?? 0)}</p>
            </div>
            <div className="p-3 rounded-lg bg-success/10 text-success">
              <ArrowUpRight size={24} />
            </div>
          </div>

          <div className="bg-surface border border-border rounded-xl p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-mono uppercase text-muted">Suspicious / Flagged Flows</p>
              <p className="text-2xl font-bold text-danger mt-1">{summary?.suspicious_count.toLocaleString() ?? 0}</p>
            </div>
            <div className="p-3 rounded-lg bg-danger/10 text-danger">
              <ShieldAlert size={24} />
            </div>
          </div>
        </section>

        {/* Time-Series Line/Area Chart & Direction Breakdown */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-surface border border-border rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-heading font-semibold text-text-h">Traffic Activity Over Time</h2>
              <span className="text-xs font-mono text-muted">Bytes per time bucket</span>
            </div>

            {points.length > 0 ? (
              <div className="w-full overflow-x-auto">
                <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-44">
                  <defs>
                    <linearGradient id="trafficAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#22D3EE" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {[0, 0.5, 1].map((ratio, idx) => {
                    const gy = padY + plotH - ratio * plotH;
                    return (
                      <line
                        key={idx}
                        x1={padX}
                        y1={gy}
                        x2={chartW - padX}
                        y2={gy}
                        stroke="#243247"
                        strokeDasharray="3 3"
                        strokeWidth="1"
                      />
                    );
                  })}

                  {areaPath && <path d={areaPath} fill="url(#trafficAreaGrad)" />}
                  {linePath && (
                    <path
                      d={linePath}
                      fill="none"
                      stroke="#22D3EE"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {points.map((p, i) => (
                    <g key={i}>
                      <circle cx={p.x} cy={p.y} r="3.5" fill="#22D3EE" />
                      <text
                        x={p.x}
                        y={chartH - 4}
                        textAnchor="middle"
                        fill="#64748B"
                        fontSize="10"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {p.time_bucket}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            ) : (
              <p className="text-xs text-muted">No time-series data available yet.</p>
            )}
          </div>

          <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
            <h2 className="text-base font-heading font-semibold text-text-h">Traffic Direction</h2>
            {summary?.directions && summary.directions.length > 0 ? (
              <div className="space-y-3">
                {summary.directions.map((d) => {
                  const pct =
                    summary.total_flows > 0
                      ? Math.round((d.count / summary.total_flows) * 100)
                      : 0;
                  return (
                    <div key={d.direction} className="bg-background border border-border rounded-lg p-3.5 space-y-1.5">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-primary font-semibold">{d.direction}</span>
                        <span className="text-muted">{pct}%</span>
                      </div>
                      <p className="text-base font-bold text-text-h">
                        {d.count} pkts • <span className="text-xs font-mono text-text">{formatBytes(d.total_bytes)}</span>
                      </p>
                      <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted">No directional traffic recorded yet.</p>
            )}
          </div>
        </section>

        {/* Protocol Donut Chart, Top Sources & Top Destinations */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
            <h2 className="text-base font-heading font-semibold text-text-h">Protocol Distribution</h2>
            {summary?.protocols && summary.protocols.length > 0 && totalProtoCount > 0 ? (
              <div className="flex flex-col sm:flex-row items-center gap-5">
                <svg width="112" height="112" viewBox="0 0 112 112" className="shrink-0 -rotate-90">
                  <circle
                    cx="56"
                    cy="56"
                    r={radius}
                    fill="transparent"
                    stroke="#1E293B"
                    strokeWidth="14"
                  />
                  {summary.protocols.map((p, idx) => {
                    const frac = p.count / totalProtoCount;
                    const segLen = frac * circumference;
                    const dashArray = `${segLen} ${circumference}`;
                    const dashOffset = -cumulativeOffset;
                    cumulativeOffset += segLen;
                    return (
                      <circle
                        key={p.protocol}
                        cx="56"
                        cy="56"
                        r={radius}
                        fill="transparent"
                        stroke={PROTOCOL_COLORS[idx % PROTOCOL_COLORS.length]}
                        strokeWidth="14"
                        strokeDasharray={dashArray}
                        strokeDashoffset={dashOffset}
                      />
                    );
                  })}
                </svg>

                <div className="flex-1 w-full space-y-2 text-xs font-mono">
                  {summary.protocols.map((p, idx) => (
                    <div key={p.protocol} className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-text-h">
                        <span
                          className="w-2.5 h-2.5 rounded-full inline-block"
                          style={{ backgroundColor: PROTOCOL_COLORS[idx % PROTOCOL_COLORS.length] }}
                        />
                        {p.protocol}
                      </span>
                      <span className="text-muted">
                        {p.count} ({formatBytes(p.total_bytes)})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted">No protocol telemetry recorded yet.</p>
            )}
          </div>

          <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
            <h2 className="text-base font-heading font-semibold text-text-h">Most Active Source IPs</h2>
            {summary?.top_sources && summary.top_sources.length > 0 ? (
              <div className="divide-y divide-border text-xs font-mono">
                {summary.top_sources.map((t) => (
                  <div key={t.ip} className="py-2.5 flex items-center justify-between">
                    <span className="text-primary font-semibold">{t.ip}</span>
                    <div className="text-right">
                      <span className="text-text-h font-medium">{formatBytes(t.total_bytes)}</span>
                      <span className="text-muted ml-2">({t.packet_count} pkts)</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted">No source hosts recorded.</p>
            )}
          </div>

          <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
            <h2 className="text-base font-heading font-semibold text-text-h">Most Active Destination IPs</h2>
            {summary?.top_destinations && summary.top_destinations.length > 0 ? (
              <div className="divide-y divide-border text-xs font-mono">
                {summary.top_destinations.map((t) => (
                  <div key={t.ip} className="py-2.5 flex items-center justify-between">
                    <span className="text-primary font-semibold">{t.ip}</span>
                    <div className="text-right">
                      <span className="text-text-h font-medium">{formatBytes(t.total_bytes)}</span>
                      <span className="text-muted ml-2">({t.packet_count} pkts)</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted">No destination hosts recorded.</p>
            )}
          </div>
        </section>

        {/* Packet Stream Table with IP, Port, Protocol & Status Filters */}
        <section className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="p-5 border-b border-border flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <h2 className="text-base font-heading font-semibold text-text-h">Packet Flow Stream</h2>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-muted" />
                <input
                  type="text"
                  value={searchIp}
                  onChange={(e) => setSearchIp(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchTrafficData()}
                  placeholder="IP address + Enter..."
                  className="bg-background border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-text-h outline-none focus:border-primary"
                />
              </div>

              <input
                type="number"
                value={portFilter}
                onChange={(e) => setPortFilter(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchTrafficData()}
                placeholder="Port (e.g. 443)"
                className="w-28 bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-text-h outline-none focus:border-primary"
              />

              <select
                value={protocolFilter}
                onChange={(e) => setProtocolFilter(e.target.value)}
                className="bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-text-h outline-none focus:border-primary cursor-pointer"
              >
                <option value="">All Protocols</option>
                <option value="TCP">TCP</option>
                <option value="UDP">UDP</option>
                <option value="HTTP">HTTP</option>
                <option value="HTTPS">HTTPS</option>
                <option value="DNS">DNS</option>
                <option value="ICMP">ICMP</option>
                <option value="ARP">ARP</option>
                <option value="UNKNOWN">UNKNOWN</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-text-h outline-none focus:border-primary cursor-pointer"
              >
                <option value="">All Status</option>
                <option value="NORMAL">NORMAL</option>
                <option value="SUSPICIOUS">SUSPICIOUS</option>
              </select>

              <button
                onClick={fetchTrafficData}
                className="px-3 py-1.5 rounded-lg bg-primary/15 text-primary border border-primary/30 text-xs font-semibold hover:bg-primary/25 transition-colors cursor-pointer"
              >
                Apply
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-background border-b border-border text-xs font-mono text-muted uppercase">
                  <th className="p-3.5">Timestamp</th>
                  <th className="p-3.5">Source</th>
                  <th className="p-3.5">Destination</th>
                  <th className="p-3.5">Protocol</th>
                  <th className="p-3.5">Size / Duration</th>
                  <th className="p-3.5">Flag</th>
                  <th className="p-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs font-mono">
                {flows.length > 0 ? (
                  flows.map((f) => (
                    <tr key={f.id} className="hover:bg-surface-hover transition-colors">
                      <td className="p-3.5 text-muted">{new Date(f.timestamp).toLocaleTimeString()}</td>
                      <td className="p-3.5 text-text-h">
                        {f.source_ip}:<span className="text-muted">{f.source_port}</span>
                      </td>
                      <td className="p-3.5 text-text-h">
                        {f.destination_ip}:<span className="text-muted">{f.destination_port}</span>
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-semibold">
                          {f.protocol}
                        </span>
                      </td>
                      <td className="p-3.5 text-text">
                        {f.packet_length} B <span className="text-muted">({f.flow_duration} ms)</span>
                      </td>
                      <td className="p-3.5 text-muted">{f.flag || "-"}</td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded font-bold ${
                            f.status === "NORMAL"
                              ? "bg-success/10 text-success"
                              : "bg-danger/10 text-danger"
                          }`}
                        >
                          {f.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted">
                      No network flows match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}