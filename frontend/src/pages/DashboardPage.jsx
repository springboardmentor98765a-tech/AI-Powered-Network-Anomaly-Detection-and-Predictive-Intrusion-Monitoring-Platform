import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
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
  Download,
  Calendar,
  ChevronDown,
  ArrowUpRight,
  Shield,
  Activity,
  ArrowRight,
  Server,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export default function DashboardPage({ onNavigate }) {
  const { user, isAdmin } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const [timeframe, setTimeframe] = useState('7d');
  const [dateRange, setDateRange] = useState('may14-20');

  const fetchDashboard = async () => {
    try {
      const data = await api.getNidsDashboard({ timeframe, date_range: dateRange });
      setDashboardData(data);
    } catch (err) {
      console.error('Error loading NIDS dashboard telemetry:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshStatus = async () => {
    setRefreshingStatus(true);
    await fetchDashboard();
    setTimeout(() => setRefreshingStatus(false), 500);
  };

  useEffect(() => {
    fetchDashboard();
  }, [timeframe, dateRange]);

  const handleExport = () => {
    if (!dashboardData) return;
    const blob = new Blob([JSON.stringify(dashboardData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `netshield_nids_report_${new Date().toISOString().substring(0, 10)}.json`;
    a.click();
  };

  const getSeverityStyle = (sev) => {
    switch (sev) {
      case 'Critical':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'High':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'Medium':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
  };

  const handleKpiClick = (kpiId) => {
    if (kpiId === 'total_alerts') {
      onNavigate('alerts');
    } else if (kpiId === 'critical_alerts') {
      onNavigate('alerts', { severity: 'Critical' });
    } else if (kpiId === 'blocked_attacks') {
      onNavigate('alerts', { action: 'Blocked' });
    } else {
      onNavigate('traffic');
    }
  };

  const getKpiTitle = (kpiId) => {
    if (kpiId === 'total_alerts') return 'Click to view all security alerts';
    if (kpiId === 'critical_alerts') return 'Click to filter critical alerts';
    if (kpiId === 'blocked_attacks') return 'Click to filter blocked attacks';
    return 'Click to open network traffic monitor';
  };

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">
            Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time intrusion detection, threat analytics, and system telemetry
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date Range Selector */}
          <div className="w-52">
            <Select
              value={dateRange}
              onValueChange={(val) => {
                setDateRange(val);
                if (val === 'today') setTimeframe('24h');
                else if (val === 'may07-13') setTimeframe('7d');
                else if (val === 'may01-20') setTimeframe('30d');
                else setTimeframe('7d');
              }}
            >
              <SelectTrigger className="h-8 text-xs bg-white border-slate-200 font-medium text-slate-700 shadow-2xs">
                <div className="flex items-center gap-1.5 truncate">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <SelectValue placeholder="Date Range" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="may14-20">May 14 - May 20, 2024</SelectItem>
                <SelectItem value="may07-13">May 07 - May 13, 2024</SelectItem>
                <SelectItem value="may01-20">May 01 - May 20, 2024</SelectItem>
                <SelectItem value="today">Today (May 20, 2024)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Export Report */}
          <Button
            type="button"
            size="sm"
            onClick={handleExport}
            className="h-8 bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 font-medium shadow-xs text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Report</span>
          </Button>
        </div>
      </div>

      {/* Row 1: 5 KPI Metric Cards with Sparklines */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {dashboardData?.kpis?.map((kpi) => {
          const isAlert = kpi.id.includes('alert');
          const trendColor = kpi.changeColor || (isAlert ? 'text-rose-600' : 'text-emerald-600');

          return (
            <div
              key={kpi.id}
              onClick={() => handleKpiClick(kpi.id)}
              className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col justify-between transition shadow-xs hover:border-blue-400 hover:shadow-sm cursor-pointer relative overflow-hidden group"
              title={getKpiTitle(kpi.id)}
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
                  <span className={`text-xs font-semibold flex items-center gap-0.5 ${trendColor}`}>
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
          );
        })}
      </div>

      {/* Row 2: Traffic Overview (2/3) + Top Attack Types Donut (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        {/* Traffic Overview Line Chart */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-1 border-b border-slate-100 gap-2">
            <div className="flex items-center gap-4 flex-wrap">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-900">
                Traffic Overview
              </h2>

              {/* Inline Legend */}
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2563eb]" />
                  <span className="text-slate-600 font-medium">Normal</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
                  <span className="text-slate-600 font-medium">Suspicious</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
                  <span className="text-slate-600 font-medium">Malicious</span>
                </div>
              </div>
            </div>

            <div className="w-28 self-end sm:self-auto">
              <Select
                value={timeframe}
                onValueChange={(val) => {
                  setTimeframe(val);
                  if (val === '24h') setDateRange('today');
                  else if (val === '7d') setDateRange('may14-20');
                  else if (val === '14d') setDateRange('may07-20');
                  else if (val === '30d') setDateRange('may01-20');
                }}
              >
                <SelectTrigger className="h-7 text-[11px] bg-slate-50 border-slate-200 text-slate-700 px-2 font-medium">
                  <SelectValue placeholder="Period" />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="24h">24 Hours</SelectItem>
                  <SelectItem value="7d">7 Days</SelectItem>
                  <SelectItem value="14d">14 Days</SelectItem>
                  <SelectItem value="30d">30 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="relative pt-2">
            <span className="text-[10px] font-mono text-slate-400 absolute -top-1 left-0 z-10">
              Packets
            </span>
            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dashboardData?.traffic_overview} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                  <YAxis
                    tickFormatter={(val) => `${val / 1000}k`}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickLine={false}
                    domain={[0, 50000]}
                    ticks={[0, 10000, 20000, 30000, 40000, 50000]}
                  />
                  <Tooltip
                    formatter={(val, name) => [`${val.toLocaleString()} pkts`, name]}
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderColor: '#e2e8f0',
                      borderRadius: '0.5rem',
                      fontSize: '11px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="normal"
                    name="Normal"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={{ r: 3.5, fill: '#2563eb' }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="suspicious"
                    name="Suspicious"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ r: 3.5, fill: '#f59e0b' }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="malicious"
                    name="Malicious"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ r: 3.5, fill: '#ef4444' }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Top Attack Types Donut Chart */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div className="pb-2 border-b border-slate-100">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-900">
              Attack Types
            </h2>
          </div>

          <div className="flex items-center justify-between gap-2 my-auto py-2">
            {/* Donut Chart with Center Number */}
            <div className="relative w-44 h-44 shrink-0 mx-auto">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dashboardData?.top_attacks}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={68}
                    paddingAngle={2}
                  >
                    {dashboardData?.top_attacks?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val, name, item) => [`${val} (${item.payload.percentage}%)`, name]}
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
                <span className="text-xl font-bold text-slate-900 font-sans">
                  {dashboardData?.total_alerts?.toLocaleString() || '2,458'}
                </span>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">
                  Total
                </span>
              </div>
            </div>

            {/* Attack Legend List with Percentages & Counts */}
            <div className="flex flex-col gap-1.5 text-xs w-full max-w-[170px]">
              {dashboardData?.top_attacks?.map((attack) => (
                <div
                  key={attack.name}
                  onClick={() => onNavigate('alerts', { attack_type: attack.name })}
                  className="flex items-center justify-between cursor-pointer hover:bg-slate-50 px-1.5 py-0.5 rounded transition group"
                  title={`Filter alerts by ${attack.name}`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: attack.color }}
                    />
                    <span className="text-slate-700 group-hover:text-blue-600 font-medium truncate text-xs">
                      {attack.name}
                    </span>
                  </div>
                  <span className="text-slate-400 font-mono text-[11px] shrink-0 ml-1">
                    {attack.percentage}% ({attack.value})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Recent Alerts Table + System Status (Admin Only) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        {/* Recent Alerts Table */}
        <div className={`${isAdmin ? 'lg:col-span-2' : 'lg:col-span-3'} rounded-xl border border-slate-200 bg-white p-5 shadow-xs`}>
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-900">
              Recent Alerts
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate('alerts')}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              View All
            </Button>
          </div>

          <div className="overflow-x-auto pt-1">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] text-slate-500">
                  <th className="py-2.5 font-medium">Time</th>
                  <th className="py-2.5 font-medium">Type</th>
                  <th className="py-2.5 font-medium">Source IP</th>
                  <th className="py-2.5 font-medium">Destination IP</th>
                  <th className="py-2.5 font-medium">Severity</th>
                  <th className="py-2.5 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {dashboardData?.recent_alerts?.map((alert) => (
                  <tr
                    key={alert.id}
                    onClick={() => onNavigate('alerts', { search: alert.src_ip })}
                    className="hover:bg-slate-50 transition cursor-pointer"
                    title={`Click to inspect alert incident ${alert.id}`}
                  >
                    <td className="py-2.5 text-slate-500 text-[11px]">
                      {alert.time}
                    </td>
                    <td className="py-2.5 text-slate-800 font-sans font-medium text-xs">
                      {alert.type}
                    </td>
                    <td className="py-2.5 text-slate-600 text-xs">
                      {alert.src_ip}
                    </td>
                    <td className="py-2.5 text-slate-500 text-xs">
                      {alert.dst_ip}
                    </td>
                    <td className="py-2.5 font-sans">
                      <span
                        className={`inline-block px-1.5 py-0.5 text-[10px] font-semibold rounded border ${getSeverityStyle(alert.severity)}`}
                      >
                        {alert.severity}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-sans">
                      <span
                        className={`text-xs font-semibold ${
                          alert.action === 'Blocked' ? 'text-rose-600' : 'text-blue-600'
                        }`}
                      >
                        {alert.action}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* System Status Resource Gauges - Administrator Only */}
        {isAdmin && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-900">
                System Status
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleRefreshStatus}
                disabled={refreshingStatus}
                title="Refresh system status"
                className="h-7 w-7 text-slate-500 hover:text-slate-800"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshingStatus ? 'animate-spin text-blue-600' : ''}`} />
              </Button>
            </div>

            {/* Progress Bars */}
            <div className="space-y-4 my-auto py-2">
              {/* CPU Usage */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-700 font-medium">CPU Usage</span>
                  <span className="text-slate-500 font-mono">{dashboardData?.system_status?.cpu}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-500"
                    style={{ width: `${dashboardData?.system_status?.cpu || 32}%` }}
                  />
                </div>
              </div>

              {/* Memory Usage */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-700 font-medium">Memory Usage</span>
                  <span className="text-slate-500 font-mono">{dashboardData?.system_status?.memory}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-600 rounded-full transition-all duration-500"
                    style={{ width: `${dashboardData?.system_status?.memory || 65}%` }}
                  />
                </div>
              </div>

              {/* Disk Usage */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-700 font-medium">Disk Usage</span>
                  <span className="text-slate-500 font-mono">{dashboardData?.system_status?.disk}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-500"
                    style={{ width: `${dashboardData?.system_status?.disk || 76}%` }}
                  />
                </div>
              </div>

              {/* Network I/O */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-700 font-medium">Network I/O</span>
                  <span className="text-slate-500 font-mono">{dashboardData?.system_status?.network_io}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${dashboardData?.system_status?.network_io || 45}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
