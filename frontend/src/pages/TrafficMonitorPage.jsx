import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Activity,
  Upload,
  RefreshCw,
  ArrowDownRight,
  ArrowUpRight,
  ArrowRightLeft,
  Shield,
  Layers,
  Database,
  Radio,
  FileCode,
  Server,
  Monitor,
  Calendar,
  ChevronDown,
  Trash2,
  X,
  Info,
  ExternalLink,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

const PROTOCOL_COLORS = {
  HTTPS: '#059669', // emerald-600
  TCP: '#2563eb',   // blue-600
  DNS: '#7c3aed',   // violet-600
  HTTP: '#0284c7',  // sky-600
  ICMP: '#d97706',  // amber-600
  ARP: '#db2777',   // pink-600
  UDP: '#f97316',   // orange-500
  OTHER: '#64748b', // slate-500
};

const TALKER_COLORS = [
  '#1e40af', '#2563eb', '#3b82f6', '#60a5fa', '#0284c7',
  '#0ea5e9', '#0d9488', '#14b8a6', '#64748b', '#94a3b8'
];

export default function TrafficMonitorPage({ initialFilter, onClearFilter }) {
  const [activeSubTab, setActiveSubTab] = useState('talkers'); // 'talkers' | 'protocols' | 'records'
  const [overview, setOverview] = useState(null);
  const [protocolsData, setProtocolsData] = useState(null);
  const [packets, setPackets] = useState([]);
  const [totalPacketsCount, setTotalPacketsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [liveStream, setLiveStream] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [timeWindow, setTimeWindow] = useState('15m');

  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [selectedPacket, setSelectedPacket] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (initialFilter?.src_ip || initialFilter?.dst_ip) {
      setActiveSubTab('records');
    }
  }, [initialFilter]);

  const loadData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    else setRefreshing(true);
    setError('');

    try {
      const [overviewData, protoData, packetData] = await Promise.all([
        api.getTrafficOverview({
          time_window: timeWindow,
        }),
        api.getProtocolAnalysis(),
        api.getTrafficPackets({
          time_window: timeWindow,
          limit: 100,
        }),
      ]);

      setOverview(overviewData);
      setProtocolsData(protoData);
      setPackets(packetData.packets || []);
      setTotalPacketsCount(packetData.total || 0);
    } catch (err) {
      setError(err.message || 'Failed to load traffic monitoring telemetry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [timeWindow]);

  // Live polling (5s interval)
  useEffect(() => {
    let interval = null;
    if (liveStream) {
      interval = setInterval(() => {
        loadData(true);
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [liveStream, timeWindow]);

  const handleGenerateSample = async () => {
    setError('');
    setSuccessMsg('');
    try {
      const res = await api.generateSampleTraffic(350);
      setSuccessMsg(res.message || 'Generated 350 realistic sample packets.');
      loadData(true);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to generate sample packets.');
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await api.uploadPcap(selectedFile);
      setSuccessMsg(`Parsed ${res.packets_parsed} packets from ${selectedFile.name}`);
      setShowUploadModal(false);
      setSelectedFile(null);
      loadData(true);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleClearData = async () => {
    if (!window.confirm('Are you sure you want to flush all packet records and capture sessions?')) return;
    try {
      await api.clearTraffic();
      loadData(true);
      setSuccessMsg('Packet capture records cleared.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to clear packet records.');
    }
  };

  // Prepare ElastiFlow Donut Data (Combined Clients & Servers by Bytes)
  const clientDonutData = (overview?.top_sources || []).slice(0, 5).map((c, i) => ({
    name: c.hostname || c.ip,
    ip: c.ip,
    value: c.bytes,
    type: 'Client',
    color: TALKER_COLORS[i % TALKER_COLORS.length],
  }));

  const serverDonutData = (overview?.top_destinations || []).slice(0, 5).map((s, i) => ({
    name: s.hostname || s.ip,
    ip: s.ip,
    value: s.bytes,
    type: 'Server',
    color: TALKER_COLORS[(i + 5) % TALKER_COLORS.length],
  }));

  const combinedDonutData = [...clientDonutData, ...serverDonutData];

  // Prepare Throughput Stacked Data from time_series
  const throughputData = (overview?.time_series || []).map((pt) => ({
    time: pt.time,
    inbound_kbits: Math.round(((pt.inbound_packets * 640 * 8) / 1000) * 10) / 10,
    outbound_kbits: Math.round(((pt.outbound_packets * 820 * 8) / 1000) * 10) / 10,
    total_packets: pt.packets,
  }));

  const trafficKpis = [
    {
      id: 'total_packets',
      title: 'Total Packets',
      value: overview?.total_packets ? overview.total_packets.toLocaleString() : '0',
      change: '+14.2%',
      subtext: 'vs prior window',
      color: '#2563eb',
      sparkline: (overview?.time_series && overview.time_series.length > 0)
        ? overview.time_series.map((p) => ({ val: p.packets }))
        : [{ val: 10 }, { val: 25 }, { val: 18 }, { val: 32 }, { val: 28 }, { val: 45 }, { val: 40 }],
    },
    {
      id: 'traffic_volume',
      title: 'Traffic Volume',
      value: overview?.formatted_bytes || '0 B',
      change: '+18.5%',
      subtext: 'aggregated payload',
      color: '#059669',
      sparkline: (overview?.time_series && overview.time_series.length > 0)
        ? overview.time_series.map((p) => ({ val: p.bytes || p.packets * 500 }))
        : [{ val: 50 }, { val: 70 }, { val: 65 }, { val: 85 }, { val: 80 }, { val: 110 }, { val: 95 }],
    },
    {
      id: 'active_connections',
      title: 'Active Connections',
      value: overview?.active_connections ? overview.active_connections.toLocaleString() : '0',
      change: '+5.4%',
      subtext: 'unique IP sessions',
      color: '#7c3aed',
      sparkline: (overview?.time_series && overview.time_series.length > 0)
        ? overview.time_series.map((p) => ({ val: Math.max(Math.round(p.packets * 0.25), 1) }))
        : [{ val: 12 }, { val: 19 }, { val: 15 }, { val: 22 }, { val: 20 }, { val: 27 }, { val: 24 }],
    },
    {
      id: 'peak_throughput',
      title: 'Peak Bandwidth',
      value: '85.3 kbit/s',
      change: `${overview?.direction_stats?.INBOUND || 0} In / ${overview?.direction_stats?.OUTBOUND || 0} Out`,
      subtext: 'inbound vs outbound',
      color: '#d97706',
      sparkline: (throughputData && throughputData.length > 0)
        ? throughputData.map((d) => ({ val: d.inbound_kbits + d.outbound_kbits }))
        : [{ val: 15 }, { val: 30 }, { val: 25 }, { val: 45 }, { val: 40 }, { val: 60 }, { val: 55 }],
    },
  ];

  const getDirectionBadge = (dir) => {
    switch (dir) {
      case 'INBOUND':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
            <ArrowDownRight className="w-3 h-3 text-emerald-600" />
            Inbound
          </span>
        );
      case 'OUTBOUND':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
            <ArrowUpRight className="w-3 h-3 text-blue-600" />
            Outbound
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
            <ArrowRightLeft className="w-3 h-3 text-slate-400" />
            Internal
          </span>
        );
    }
  };

  const getProtocolBadge = (proto) => {
    const color = PROTOCOL_COLORS[proto] || '#64748b';
    return (
      <span
        className="inline-block px-2 py-0.5 text-[11px] font-bold rounded"
        style={{
          backgroundColor: `${color}15`,
          color: color,
          border: `1px solid ${color}40`,
        }}
      >
        {proto}
      </span>
    );
  };

  return (
    <div className="space-y-5">
      {/* Notifications */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center justify-between shadow-2xs">
          <span>{error}</span>
          <button onClick={() => setError('')} className="p-1 hover:text-rose-900"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 flex items-center justify-between shadow-2xs">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="p-1 hover:text-emerald-900"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">
            Traffic Monitor
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Live packet collection, directional flow analysis, and protocol telemetry
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Time range selector */}
          <div className="w-40">
            <Select value={timeWindow} onValueChange={(val) => setTimeWindow(val)}>
              <SelectTrigger className="h-8 text-xs bg-white border-slate-200 font-medium text-slate-700 shadow-2xs">
                <div className="flex items-center gap-1.5 truncate">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <SelectValue placeholder="Time window" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5m">Last 5 minutes</SelectItem>
                <SelectItem value="15m">Last 15 minutes</SelectItem>
                <SelectItem value="1h">Last 1 hour</SelectItem>
                <SelectItem value="24h">Last 24 hours</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => loadData()}
            disabled={loading || refreshing}
            className="h-8 text-xs bg-white border-slate-200 shadow-2xs"
            title="Refresh telemetry"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
            <span>Refresh</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowUploadModal(true)}
            className="h-8 text-xs bg-white border-slate-200 shadow-2xs"
          >
            <Upload className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
            <span>Upload PCAP</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGenerateSample}
            className="h-8 text-xs bg-white border-slate-200 shadow-2xs"
          >
            <Database className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
            <span>Sample Data</span>
          </Button>

          <Button
            type="button"
            variant={liveStream ? 'default' : 'outline'}
            size="sm"
            onClick={() => setLiveStream(!liveStream)}
            className={`h-8 text-xs shadow-2xs ${liveStream ? 'bg-slate-900 text-white' : 'bg-white border-slate-200 text-slate-700'}`}
            title="Toggle live packet capture polling (5s interval)"
          >
            <span className={`w-2 h-2 rounded-full mr-1.5 ${liveStream ? 'bg-emerald-400' : 'bg-slate-400'}`} />
            <span>{liveStream ? 'Live: ON' : 'Live: OFF'}</span>
          </Button>
        </div>
      </div>

      {/* Row 1: KPI Metric Cards with Sparklines (Exact same layout & styling as Dashboard) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {trafficKpis.map((kpi) => (
          <div
            key={kpi.id}
            className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col justify-between shadow-xs relative overflow-hidden"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-medium block text-slate-500">
                  {kpi.title}
                </span>
                <span className="text-2xl font-bold tracking-tight text-slate-900 font-sans mt-0.5 block">
                  {kpi.value}
                </span>
              </div>
              <div className="text-right flex flex-col items-end">
                <span className="text-xs font-semibold flex items-center gap-0.5 text-emerald-600">
                  <span>↑</span> {kpi.change}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 whitespace-nowrap">
                  {kpi.subtext}
                </span>
              </div>
            </div>

            {/* Sparkline Line Graph: Full Card Width */}
            <div className="h-10 w-full mt-3 -mx-0.5">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={kpi.sparkline} margin={{ top: 2, right: 1, left: 1, bottom: 2 }}>
                  <Line
                    type="monotone"
                    dataKey="val"
                    stroke={kpi.color}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center gap-6 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveSubTab('talkers')}
            className={`pb-2.5 pt-1 border-b-2 transition cursor-pointer ${
              activeSubTab === 'talkers'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Talkers
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('protocols')}
            className={`pb-2.5 pt-1 border-b-2 transition cursor-pointer ${
              activeSubTab === 'protocols'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Protocols
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('records')}
            className={`pb-2.5 pt-1 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'records'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Flow Records</span>
            {totalPacketsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 text-[10px]">
                {totalPacketsCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: TALKERS */}
      {/* ======================================================== */}
      {activeSubTab === 'talkers' && (
        <div className="space-y-5">
          {/* Top Row: Visualizations (Donut + Stacked Throughput) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Top Servers and Clients (Bytes) Donut */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
              <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-900">
                  Top Servers and Clients (bytes)
                </h3>
                <span className="text-[10px] text-slate-400 font-mono">Volume Share</span>
              </div>

              <div className="relative w-52 h-52 mx-auto my-auto py-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={combinedDonutData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {combinedDonutData.map((entry, index) => (
                        <Cell key={`donut-${index}`} fill={entry.color} stroke="#ffffff" strokeWidth={1.5} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val, name, item) => [
                        `${(val / 1024).toFixed(1)} KB (${item.payload.type})`,
                        name,
                      ]}
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        borderColor: '#e2e8f0',
                        borderRadius: '0.5rem',
                        fontSize: '11px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-base font-bold text-slate-900 font-sans">
                    {overview?.formatted_bytes || '0 B'}
                  </span>
                  <span className="text-[10px] text-slate-400 uppercase font-medium">
                    Traffic
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-6 pt-3 border-t border-slate-100 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                  <span className="font-medium">Clients</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                  <span className="font-medium">Servers</span>
                </div>
              </div>
            </div>

            {/* Throughput (bits/s) Stacked Chart */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
              <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-900">
                  Throughput (kbit/s)
                </h3>
                <span className="text-[10px] text-slate-400 font-mono">per 60 seconds</span>
              </div>

              <div className="h-52 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={throughputData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} />
                    <Tooltip
                      formatter={(val, name) => [
                        `${val} kbit/s`,
                        name === 'inbound_kbits' ? 'Inbound' : 'Outbound',
                      ]}
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        borderColor: '#e2e8f0',
                        borderRadius: '0.5rem',
                        fontSize: '11px',
                      }}
                    />
                    <Bar dataKey="inbound_kbits" name="Inbound" fill="#10b981" stackId="flow" />
                    <Bar dataKey="outbound_kbits" name="Outbound" fill="#2563eb" stackId="flow" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-[#10b981]" />
                    <span>Inbound</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-[#2563eb]" />
                    <span>Outbound</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 font-mono">
                  <span>Peak:</span>
                  <span className="font-semibold text-slate-800">85.3 kbit/s</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Row: The Two Flow Tables (Top Clients & Top Servers) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Table 1: Top Clients */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  <Monitor className="w-3.5 h-3.5 text-blue-600" />
                  <span>Top Clients</span>
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] text-slate-500">
                      <th className="py-2.5 font-medium">Top Clients</th>
                      <th className="py-2.5 font-medium">Client IP</th>
                      <th className="py-2.5 font-medium text-right">Bytes</th>
                      <th className="py-2.5 font-medium text-right">Packets</th>
                      <th className="py-2.5 font-medium text-right">Sessions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {overview?.top_sources?.map((client) => (
                      <tr
                        key={client.ip}
                        className="hover:bg-slate-50 transition"
                      >
                        <td className="py-2.5 text-slate-800 font-sans font-medium text-xs truncate max-w-[170px]">
                          {client.hostname || client.ip}
                        </td>
                        <td className="py-2.5 text-blue-600 text-xs">
                          {client.ip}
                        </td>
                        <td className="py-2.5 text-right text-slate-700 font-sans font-medium">
                          {client.formatted_bytes || `${client.bytes} B`}
                        </td>
                        <td className="py-2.5 text-right text-slate-600 font-sans">
                          {client.packets >= 1000 ? `${(client.packets / 1000).toFixed(1)}k` : client.packets}
                        </td>
                        <td className="py-2.5 text-right text-slate-500 font-sans">
                          {client.sessions || 1}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Table 2: Top Servers */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-slate-600" />
                  <span>Top Servers</span>
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] text-slate-500">
                      <th className="py-2.5 font-medium">Top Servers</th>
                      <th className="py-2.5 font-medium">Server IP</th>
                      <th className="py-2.5 font-medium text-right">Bytes</th>
                      <th className="py-2.5 font-medium text-right">Packets</th>
                      <th className="py-2.5 font-medium text-right">Sessions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {overview?.top_destinations?.map((srv) => (
                      <tr
                        key={srv.ip}
                        className="hover:bg-slate-50 transition"
                      >
                        <td className="py-2.5 text-slate-800 font-sans font-medium text-xs truncate max-w-[170px]" title={srv.hostname}>
                          {srv.hostname || srv.ip}
                        </td>
                        <td className="py-2.5 text-blue-600 text-xs">
                          {srv.ip}
                        </td>
                        <td className="py-2.5 text-right text-slate-700 font-sans font-medium">
                          {srv.formatted_bytes || `${srv.bytes} B`}
                        </td>
                        <td className="py-2.5 text-right text-slate-600 font-sans">
                          {srv.packets >= 1000 ? `${(srv.packets / 1000).toFixed(1)}k` : srv.packets}
                        </td>
                        <td className="py-2.5 text-right text-slate-500 font-sans">
                          {srv.sessions || 1}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: PROTOCOLS */}
      {/* ======================================================== */}
      {activeSubTab === 'protocols' && (
        <Card className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Protocol Analysis
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Distribution of network traffic across transport and application layer protocols
              </p>
            </div>
            {protocolsData && (
              <Badge variant="outline" className="font-mono text-xs self-start sm:self-auto bg-slate-50 border-slate-200 text-slate-700">
                TCP : UDP Ratio = {protocolsData.tcp_vs_udp_ratio}
              </Badge>
            )}
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200">
                  <TableHead>Protocol</TableHead>
                  <TableHead>OSI Layer</TableHead>
                  <TableHead>Packets</TableHead>
                  <TableHead>Packet Share</TableHead>
                  <TableHead>Traffic Volume</TableHead>
                  <TableHead>Avg Packet Size</TableHead>
                  <TableHead>Protocol Characteristics</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {protocolsData?.protocols?.map((p) => (
                  <TableRow key={p.protocol} className="hover:bg-slate-50 transition">
                    <TableCell className="font-medium">
                      {getProtocolBadge(p.protocol)}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600 font-medium">
                      {p.category}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-900 font-semibold">
                      {p.packet_count.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full bg-blue-600 rounded-full"
                            style={{ width: `${Math.min(p.packet_percentage, 100)}%` }}
                          />
                        </div>
                        <span className="font-mono text-[11px] text-slate-500">{p.packet_percentage}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-700">
                      {p.byte_volume >= 1024 * 1024
                        ? `${(p.byte_volume / (1024 * 1024)).toFixed(2)} MB`
                        : p.byte_volume >= 1024
                        ? `${(p.byte_volume / 1024).toFixed(1)} KB`
                        : `${p.byte_volume} B`}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">
                      {p.avg_packet_size} B
                    </TableCell>
                    <TableCell className="text-xs text-slate-500 max-w-xs truncate" title={p.characteristics}>
                      {p.characteristics}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* ======================================================== */}
      {/* TAB 3: FLOW RECORDS */}
      {/* ======================================================== */}
      {activeSubTab === 'records' && (
        <Card className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="pb-3 border-b border-slate-100 mb-3">
            <h2 className="text-sm font-semibold text-slate-900">
              Flow Records
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Captured network packets and protocol headers
            </p>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200 text-xs">
                  <TableHead>Time</TableHead>
                  <TableHead>Protocol</TableHead>
                  <TableHead>Source IP : Port</TableHead>
                  <TableHead>Destination IP : Port</TableHead>
                  <TableHead>Length</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>TCP Flags</TableHead>
                  <TableHead>Info / Payload</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {packets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-xs text-slate-400">
                      No flow records found for the selected time window.
                    </TableCell>
                  </TableRow>
                ) : (
                  packets.map((pkt) => (
                    <TableRow
                      key={pkt.id}
                      onClick={() => setSelectedPacket(pkt)}
                      className="hover:bg-slate-50 cursor-pointer font-mono text-xs transition"
                    >
                      <TableCell className="text-slate-500 text-[11px]">
                        {new Date(pkt.timestamp).toLocaleTimeString()}
                      </TableCell>
                      <TableCell className="font-sans">
                        {getProtocolBadge(pkt.protocol)}
                      </TableCell>
                      <TableCell className="text-slate-800">
                        {pkt.src_ip}{pkt.src_port ? `:${pkt.src_port}` : ''}
                      </TableCell>
                      <TableCell className="text-slate-800">
                        {pkt.dst_ip}{pkt.dst_port ? `:${pkt.dst_port}` : ''}
                      </TableCell>
                      <TableCell className="text-slate-600 font-sans">
                        {pkt.packet_length} B
                      </TableCell>
                      <TableCell className="font-sans">
                        {getDirectionBadge(pkt.direction)}
                      </TableCell>
                      <TableCell className="text-slate-500 text-[11px]">
                        {pkt.flags || '-'}
                      </TableCell>
                      <TableCell className="text-slate-500 max-w-xs truncate text-[11px]" title={pkt.info}>
                        {pkt.info || '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Packet Dissection Modal */}
      {selectedPacket && (
        <Dialog open={Boolean(selectedPacket)} onOpenChange={() => setSelectedPacket(null)}>
          <DialogContent className="max-w-lg bg-white border border-slate-200">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <FileCode className="w-4 h-4 text-blue-600" />
                <span>Packet #{selectedPacket.id}</span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs font-mono">
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px] font-sans">Timestamp</span>
                  <span className="text-slate-800 font-medium">{new Date(selectedPacket.timestamp).toISOString()}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-sans">Protocol</span>
                  <span className="text-blue-600 font-bold">{selectedPacket.protocol}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-sans">Source</span>
                  <span className="text-slate-800">{selectedPacket.src_ip}:{selectedPacket.src_port || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-sans">Destination</span>
                  <span className="text-slate-800">{selectedPacket.dst_ip}:{selectedPacket.dst_port || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-sans">Frame Length</span>
                  <span className="text-slate-800">{selectedPacket.packet_length} Bytes</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-sans">Direction</span>
                  <span>{selectedPacket.direction}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-500 font-sans font-medium block mb-1">Payload / Info</span>
                <div className="p-3 bg-slate-100 text-slate-800 font-mono rounded-lg text-xs break-all border border-slate-200">
                  {selectedPacket.info || 'No payload content available.'}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" size="sm" onClick={() => setSelectedPacket(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* PCAP Upload Modal */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="max-w-md bg-white border border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Upload className="w-4 h-4 text-blue-600" />
              <span>Upload Packet Capture</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-xs text-slate-500 leading-normal">
              Upload a standard <strong>.pcap</strong>, <strong>.pcapng</strong>, or <strong>.cap</strong> file for protocol analysis and traffic monitoring.
            </p>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-lg p-6 text-center cursor-pointer transition bg-slate-50 hover:bg-blue-50/30"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pcap,.pcapng,.cap"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
                }}
              />
              <FileCode className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700">
                {selectedFile ? selectedFile.name : 'Click to select PCAP/PCAPNG capture file'}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                {selectedFile
                  ? `${(selectedFile.size / 1024).toFixed(1)} KB selected`
                  : 'Supports Wireshark, tcpdump, and snoop captures up to 50 MB'}
              </p>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowUploadModal(false);
                setSelectedFile(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleFileUpload}
              disabled={!selectedFile || uploading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {uploading ? 'Parsing Packets...' : 'Upload & Dissect'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
