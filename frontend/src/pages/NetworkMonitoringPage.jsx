import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowDownToLine, ArrowUpFromLine, BarChart3, CheckCircle2,
  Clock3, Cpu, Database, Filter, HardDrive, MemoryStick, Network, Play,
  RefreshCw, Search, Server, ShieldCheck, Square, Wifi, XCircle,
} from "lucide-react";
import api, { getApiError } from "../services/api";
import "./NetworkMonitoringPage.css";

const number = (value) => new Intl.NumberFormat("en-IN").format(Number(value || 0));
const bytes = (value) => {
  const n = Number(value || 0);
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(2)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
};
const time = (value) => value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";
const protocolClass = (value = "") => {
  const p = value.toLowerCase();
  if (p.includes("https") || p.includes("tls")) return "https";
  if (p.includes("http")) return "http";
  if (p.includes("dns")) return "dns";
  if (p.includes("tcp")) return "tcp";
  if (p.includes("udp")) return "udp";
  if (p.includes("arp")) return "arp";
  return "other";
};

function Metric({ label, value, detail, icon: Icon, color }) {
  return <article className="nm-metric-card">
    <div className={`nm-metric-icon ${color}`}><Icon size={19} /></div>
    <div className="nm-metric-label">{label}</div>
    <div className="nm-metric-value">{value}</div>
    <div className="nm-metric-detail">{detail}</div>
  </article>;
}

function Empty({ children = "No data available for this selection." }) {
  return <div className="nm-empty"><Database size={20} /><span>{children}</span></div>;
}

function IpList({ items = [] }) {
  if (!items.length) return <Empty>No IP statistics available.</Empty>;
  return <div className="nm-ip-list">{items.map((item, i) => <div className="nm-ip-row" key={item.ip_address}>
    <span className="nm-rank">{i + 1}</span><code>{item.ip_address}</code>
    <span>{number(item.packet_count)} packets</span><strong>{bytes(item.total_bytes)}</strong>
  </div>)}</div>;
}

function SystemMetric({ icon: Icon, label, value }) {
  return <div className="nm-system-metric"><div className="nm-system-icon"><Icon size={18} /></div>
    <div><span>{label}</span><strong>{typeof value === "number" ? `${value.toFixed(1)}%` : "Loading…"}</strong></div>
  </div>;
}

export default function NetworkMonitoringPage() {
  const [interfaces, setInterfaces] = useState([]);
  const [captures, setCaptures] = useState([]);
  const [status, setStatus] = useState({ running: false, capture_id: null });
  const [interfaceIndex, setInterfaceIndex] = useState("");
  const [captureId, setCaptureId] = useState("");
  const [windowMinutes, setWindowMinutes] = useState(60);
  const [summary, setSummary] = useState(null);
  const [protocolData, setProtocolData] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [packets, setPackets] = useState([]);
  const [packetTotal, setPacketTotal] = useState(0);
  const [health, setHealth] = useState(null);
  const [filters, setFilters] = useState({ source_ip: "", destination_ip: "", protocol: "", port: "" });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedCapture = captures.find((c) => String(c.id) === String(captureId));
  const running = status.running || selectedCapture?.status === "running";
  const protocols = protocolData?.protocols || [];

  const refreshCaptures = useCallback(async () => {
    try {
      const [list, current] = await Promise.all([
        api.get("/network/captures", { params: { limit: 50, offset: 0 } }),
        api.get("/network/captures/status"),
      ]);
      const items = list.data.items || [];
      setCaptures(items);
      setStatus(current.data);
      setCaptureId((old) => {
        if (old && items.some((item) => String(item.id) === old)) return old;
        const active = current.data.capture_id || items.find((item) => item.status === "running")?.id || items[0]?.id;
        return active ? String(active) : "";
      });
    } catch (e) { setError(getApiError(e)); }
  }, []);

  const refreshInterfaces = useCallback(async () => {
    try {
      const response = await api.get("/network/interfaces");
      const items = response.data.interfaces || [];
      setInterfaces(items);
      setInterfaceIndex((old) => old && items.some((i) => String(i.index) === old) ? old : String(items.find((i) => /wi-?fi/i.test(i.name || ""))?.index ?? items[0]?.index ?? ""));
    } catch (e) { setError(getApiError(e)); }
  }, []);

  const loadAnalytics = useCallback(async (id) => {
    if (!id) { setSummary(null); setProtocolData(null); setTimeline([]); setPackets([]); setPacketTotal(0); setLoading(false); return; }
    try {
      const [s, p, t, rows] = await Promise.all([
        api.get(`/network/captures/${id}/summary`, { params: { window_minutes: windowMinutes } }),
        api.get(`/network/captures/${id}/protocol-stats`, { params: { window_minutes: windowMinutes } }),
        api.get(`/network/captures/${id}/traffic-timeline`, { params: { window_minutes: windowMinutes } }),
        api.get(`/network/captures/${id}/packets`, { params: { limit: 12, offset: 0 } }),
      ]);
      setSummary(s.data); setProtocolData(p.data); setTimeline(t.data.points || []);
      setPackets(rows.data.items || []); setPacketTotal(rows.data.total || 0);
      setError("");
    } catch (e) { setError(getApiError(e)); }
    finally { setLoading(false); }
  }, [windowMinutes]);

  useEffect(() => {
    refreshInterfaces(); refreshCaptures();
    const timer = window.setInterval(refreshCaptures, 5000);
    return () => window.clearInterval(timer);
  }, [refreshInterfaces, refreshCaptures]);

  useEffect(() => {
    loadAnalytics(captureId);
    const timer = window.setInterval(() => loadAnalytics(captureId), 10000);
    return () => window.clearInterval(timer);
  }, [captureId, loadAnalytics]);

  useEffect(() => {
    let active = true;
    const fetchHealth = async () => {
      try { const response = await api.get("/network/system-health"); if (active) setHealth(response.data); }
      catch (e) { console.error("System health request failed:", e); }
    };
    fetchHealth();
    const timer = window.setInterval(fetchHealth, 10000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const chart = useMemo(() => {
    const max = Math.max(1, ...timeline.map((p) => Number(p.packet_count || 0)));
    return timeline.map((p, i) => ({ ...p, x: timeline.length === 1 ? 370 : 24 + i / (timeline.length - 1) * 712, y: 176 - Number(p.packet_count || 0) / max * 145 }));
  }, [timeline]);
  const chartLine = chart.map((p) => `${p.x},${p.y}`).join(" ");

  async function startCapture() {
    if (!interfaceIndex || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const r = await api.post("/network/captures/start", { interface_index: Number(interfaceIndex) });
      setCaptureId(String(r.data.capture_id)); setNotice(`Capture started on ${r.data.interface_name}.`);
      await refreshCaptures(); setCaptureId(String(r.data.capture_id));
    } catch (e) { setError(getApiError(e)); }
    finally { setBusy(false); }
  }

  async function stopCapture() {
    const id = status.capture_id || captureId;
    if (!id || busy) return;
    setBusy(true); setError("");
    try { await api.post(`/network/captures/${id}/stop`); setNotice("Capture stop requested. Saving packets…"); await refreshCaptures(); }
    catch (e) { setError(getApiError(e)); }
    finally { setBusy(false); }
  }

  async function refreshAll() { await refreshCaptures(); if (captureId) await loadAnalytics(captureId); }

  async function applyFilters(event) {
    event.preventDefault(); if (!captureId) return;
    const params = { limit: 50, offset: 0 };
    Object.entries(filters).forEach(([key, value]) => { if (value.trim()) params[key] = key === "port" ? Number(value) : value.trim(); });
    try {
      const r = await api.get(`/network/captures/${captureId}/packets`, { params });
      setPackets(r.data.items || []); setPacketTotal(r.data.total || 0);
    } catch (e) { setError(getApiError(e)); }
  }

  async function clearFilters() {
    setFilters({ source_ip: "", destination_ip: "", protocol: "", port: "" });
    if (!captureId) return;
    try { const r = await api.get(`/network/captures/${captureId}/packets`, { params: { limit: 12, offset: 0 } }); setPackets(r.data.items || []); setPacketTotal(r.data.total || 0); }
    catch (e) { setError(getApiError(e)); }
  }

  return <div className="network-monitoring-page">
    <div className="nm-page-heading"><div><p className="page-eyebrow">NETWORK OPERATIONS / MONITORING</p><h1>Network Monitoring</h1><p className="page-description">Live packet capture, network traffic analytics and protocol visibility.</p></div>
      <button className="nm-refresh-button" onClick={refreshAll}><RefreshCw size={15} /> Refresh</button>
    </div>
    {error && <div className="nm-alert nm-alert-error"><XCircle size={16} />{error}</div>}
    {notice && <div className="nm-alert nm-alert-success"><CheckCircle2 size={16} />{notice}<button onClick={() => setNotice("")}>Dismiss</button></div>}

    <section className="nm-capture-panel"><div className="nm-capture-title"><div className="nm-section-icon"><Wifi size={20} /></div><div><h2>Packet Capture</h2><p>Capture live traffic through a selected network interface.</p></div></div>
      <div className="nm-capture-controls">
        <label className="nm-field"><span>Network interface</span><select value={interfaceIndex} onChange={(e) => setInterfaceIndex(e.target.value)} disabled={running || busy}><option value="">Select interface</option>{interfaces.map((i) => <option key={i.index} value={i.index}>{i.name} — {i.device}</option>)}</select></label>
        <label className="nm-field"><span>Capture session</span><select value={captureId} onChange={(e) => setCaptureId(e.target.value)}><option value="">Select capture</option>{captures.map((c) => <option key={c.id} value={c.id}>#{c.id} · {c.interface_name} · {c.status}</option>)}</select></label>
        {!running ? <button className="nm-start-button" onClick={startCapture} disabled={!interfaceIndex || busy}><Play size={15} />{busy ? "Starting…" : "Start capture"}</button> : <button className="nm-stop-button" onClick={stopCapture} disabled={busy}><Square size={14} />{busy ? "Stopping…" : "Stop capture"}</button>}
      </div>
      <div className="nm-capture-status"><span className={`nm-status-dot ${running ? "live" : ""}`} />{running ? `Capturing live traffic${status.interface_name ? ` on ${status.interface_name}` : ""}` : "No active capture"}{selectedCapture && <span className="nm-session-meta">Session #{selectedCapture.id}</span>}</div>
    </section>

    <div className="nm-section-toolbar"><div><h2>Traffic overview</h2><p>Selected capture · last {windowMinutes} minutes</p></div><div className="nm-toolbar-actions"><label className="nm-window-control">Time range<select value={windowMinutes} onChange={(e) => setWindowMinutes(Number(e.target.value))}><option value={15}>15 minutes</option><option value={30}>30 minutes</option><option value={60}>1 hour</option><option value={120}>2 hours</option></select></label><span className="nm-data-source"><Database size={13} /> PostgreSQL</span></div></div>

    {!captureId ? <div className="nm-no-capture"><Network size={34} /><h3>No capture selected</h3><p>Select a saved session or start a live capture.</p></div> : <>
      <div className="nm-metrics-grid">
        <Metric label="TOTAL PACKETS" value={number(summary?.total_packets)} detail="Packets collected" icon={Activity} color="teal" />
        <Metric label="TOTAL TRAFFIC" value={bytes(summary?.total_bytes)} detail="Combined packet size" icon={Database} color="blue" />
        <Metric label="UNIQUE HOSTS" value={number(summary?.unique_hosts)} detail={`${number(summary?.unique_source_ips)} sources · ${number(summary?.unique_destination_ips)} destinations`} icon={Network} color="purple" />
        <Metric label="PROTOCOL TYPES" value={number(protocols.length)} detail="Detected protocol groups" icon={ShieldCheck} color="orange" />
      </div>

      <section className="nm-panel"><div className="nm-panel-heading"><div><h2>Traffic activity</h2><p>Packets grouped by minute</p></div><span className="nm-panel-tag"><Clock3 size={13} />{windowMinutes} minutes</span></div>
        {chart.length ? <><div className="nm-chart"><div className="nm-chart-grid"><span /><span /><span /><span /></div><svg viewBox="0 0 760 200" role="img" aria-label="Network packet activity"><defs><linearGradient id="nm-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#36d9b2" stopOpacity=".28" /><stop offset="100%" stopColor="#36d9b2" stopOpacity="0" /></linearGradient></defs>{chart.length > 1 && <polygon points={`24,190 ${chartLine} 736,190`} fill="url(#nm-fill)" />}{chart.length === 1 && <line x1={chart[0].x} y1={chart[0].y} x2={chart[0].x} y2="190" stroke="#36d9b2" strokeWidth="18" strokeLinecap="round" opacity=".48" />}{chart.length > 1 && <polyline points={chartLine} fill="none" stroke="#36d9b2" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}{chart.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={chart.length === 1 ? "5" : "3"} fill="#36d9b2" />)}</svg></div><div className="nm-chart-labels"><span>{time(chart[0]?.timestamp)}</span><span>{time(chart[Math.floor(chart.length / 2)]?.timestamp)}</span><span>{time(chart.at(-1)?.timestamp)}</span></div>{chart.length === 1 && <p className="nm-chart-single-note">Only one minute of traffic is available in this capture. Keep a capture running for 2–3 minutes to build a trend line.</p>}</> : <Empty>No timeline data in this time window.</Empty>}
      </section>

      <div className="nm-two-column"><section className="nm-panel"><div className="nm-panel-heading"><div><h2>Protocol distribution</h2><p>Packets and bytes per protocol</p></div><BarChart3 size={18} /></div>{protocols.length ? <div className="nm-protocol-list">{protocols.map((p) => <div className="nm-protocol-row" key={p.protocol}><div className="nm-protocol-top"><span className={`nm-protocol-name ${protocolClass(p.protocol)}`}>{p.protocol}</span><strong>{number(p.packet_count)} packets</strong></div><div className="nm-progress-track"><div className={`nm-progress-fill ${protocolClass(p.protocol)}`} style={{ width: `${Math.min(100, p.packet_percentage || 0)}%` }} /></div><div className="nm-protocol-meta"><span>{p.packet_percentage}% of packets</span><span>{bytes(p.total_bytes)}</span></div></div>)}</div> : <Empty>No protocol statistics available.</Empty>}</section>
        <section className="nm-panel"><div className="nm-panel-heading"><div><h2>Traffic direction</h2><p>Estimated using local interface IPs</p></div><Network size={18} /></div>{[{ label: "Incoming", value: summary?.incoming, icon: ArrowDownToLine, color: "incoming" }, { label: "Outgoing", value: summary?.outgoing, icon: ArrowUpFromLine, color: "outgoing" }, { label: "Unknown direction", value: summary?.unknown_direction, icon: Network, color: "unknown" }].map((d) => { const Icon = d.icon; return <div className="nm-direction-row" key={d.label}><div className={`nm-direction-icon ${d.color}`}><Icon size={18} /></div><div className="nm-direction-copy"><strong>{d.label}</strong><span>{number(d.value?.packets)} packets</span></div><b>{bytes(d.value?.bytes)}</b></div>; })}<p className="nm-direction-note">Packets without usable IP addresses may have unknown direction.</p></section></div>

      <div className="nm-two-column"><section className="nm-panel"><div className="nm-panel-heading"><div><h2>Top source IPs</h2><p>Highest traffic by source</p></div><ArrowUpFromLine size={18} /></div><IpList items={summary?.top_source_ips} /></section><section className="nm-panel"><div className="nm-panel-heading"><div><h2>Top destination IPs</h2><p>Highest traffic by destination</p></div><ArrowDownToLine size={18} /></div><IpList items={summary?.top_destination_ips} /></section></div>

      <section className="nm-panel"><div className="nm-panel-heading"><div><h2>Packet explorer</h2><p>Filter captured packets by IP, protocol and port · {number(packetTotal)} matches</p></div><Search size={18} /></div>
        <form className="nm-filter-form" onSubmit={applyFilters}>{[["source_ip", "Source IP", "10.20.50.195"], ["destination_ip", "Destination IP", "Destination address"], ["protocol", "Protocol", "HTTPS or DNS"], ["port", "Port", "443"]].map(([name, label, placeholder]) => <label className="nm-field" key={name}><span>{label}</span><input name={name} type={name === "port" ? "number" : "text"} min={name === "port" ? 0 : undefined} max={name === "port" ? 65535 : undefined} value={filters[name]} onChange={(e) => setFilters((old) => ({ ...old, [name]: e.target.value }))} placeholder={placeholder} /></label>)}<div className="nm-filter-actions"><button className="nm-filter-button" type="submit"><Filter size={14} /> Apply</button><button className="nm-clear-button" type="button" onClick={clearFilters}>Clear</button></div></form>
        <div className="nm-table-wrap"><table className="nm-packet-table"><thead><tr><th>Time</th><th>Source IP</th><th>Destination IP</th><th>Protocol</th><th>Source Port</th><th>Destination Port</th><th>Length</th></tr></thead><tbody>{packets.map((p) => <tr key={p.id}><td>{time(p.captured_at)}</td><td>{p.source_ip || "—"}</td><td>{p.destination_ip || "—"}</td><td><span className={`nm-protocol-name ${protocolClass(p.protocol)}`}>{p.protocol}</span></td><td>{p.source_port ?? "—"}</td><td>{p.destination_port ?? "—"}</td><td>{bytes(p.packet_length)}</td></tr>)}</tbody></table>{!packets.length && <Empty>No packets match these filters.</Empty>}</div>
      </section>

      <section className="nm-system-panel"><div className="nm-system-heading"><div className="nm-section-icon"><Server size={18} /></div><div><h2>System health</h2><p>Live host resource telemetry</p></div></div><div className="nm-system-grid"><SystemMetric icon={Cpu} label="CPU usage" value={health?.cpu_percent} /><SystemMetric icon={MemoryStick} label="Memory usage" value={health?.memory_percent} /><SystemMetric icon={HardDrive} label="Disk usage" value={health?.disk_percent} /></div><p className="nm-system-note">System telemetry refreshes every 10 seconds.</p></section>
    </>}
    {loading && <div className="nm-loading-note">Loading network monitoring data…</div>}
  </div>;
}
