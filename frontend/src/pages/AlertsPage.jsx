import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  Download,
  X,
  FileCode,
  Shield,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';

export default function AlertsPage({ initialFilter, onNavigate }) {
  const [alerts, setAlerts] = useState([]);
  const [summary, setSummary] = useState({
    total_alerts: 2458,
    critical_count: 156,
    blocked_count: 1324,
    active_signatures: 48,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);

  // Filters
  const [search, setSearch] = useState(initialFilter?.search || '');
  const [severityFilter, setSeverityFilter] = useState(initialFilter?.severity || 'ALL');
  const [actionFilter, setActionFilter] = useState(initialFilter?.action || 'ALL');
  const [attackTypeFilter, setAttackTypeFilter] = useState(initialFilter?.attack_type || 'ALL');

  const fetchAlerts = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    else setRefreshing(true);

    try {
      const data = await api.getAlerts({
        severity: severityFilter,
        action: actionFilter,
        attack_type: attackTypeFilter,
        search,
      });

      setAlerts(data.alerts || []);
      if (data.summary) {
        setSummary(data.summary);
      }
    } catch (err) {
      console.error('Error fetching alerts:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [severityFilter, actionFilter, attackTypeFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchAlerts();
  };

  const handleClearFilters = () => {
    setSearch('');
    setSeverityFilter('ALL');
    setActionFilter('ALL');
    setAttackTypeFilter('ALL');
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(alerts, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `security_alerts_export_${new Date().toISOString().substring(0, 10)}.json`;
    a.click();
  };

  const getSeverityBadge = (sev) => {
    switch (sev) {
      case 'Critical':
        return <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">Critical</span>;
      case 'High':
        return <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold bg-orange-50 text-orange-700 border border-orange-200">High</span>;
      case 'Medium':
        return <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">Medium</span>;
      default:
        return <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">Low</span>;
    }
  };

  const getActionBadge = (action) => {
    if (action === 'Blocked') {
      return <span className="text-xs font-semibold text-rose-600">Blocked</span>;
    }
    return <span className="text-xs font-semibold text-blue-600">Logged</span>;
  };

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">
            Alerts
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time security events, intrusion detections, and firewall mitigations
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fetchAlerts()}
            disabled={loading || refreshing}
            className="h-8 text-xs bg-white border-slate-200 shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
            <span>Refresh</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleExport}
            className="h-8 bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 text-xs font-medium shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Log</span>
          </Button>
        </div>
      </div>

      {/* Row 1: KPI Summary Cards with Sparklines (Exact same layout & styling as Dashboard) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div
          onClick={() => { setSeverityFilter('ALL'); setActionFilter('ALL'); }}
          className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs cursor-pointer hover:border-slate-300 transition flex flex-col justify-between"
          title="Click to view all alerts"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-medium text-slate-500 block">Total Alerts</span>
              <span className="text-2xl font-bold tracking-tight text-slate-900 mt-0.5 block font-sans">
                {summary.total_alerts.toLocaleString()}
              </span>
            </div>
            <div className="text-right flex flex-col items-end">
              <span className="text-xs font-semibold flex items-center gap-0.5 text-rose-600">
                <span>↑</span> +12.5%
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">vs last 7 days</span>
            </div>
          </div>
          <div className="h-10 w-full mt-3 -mx-0.5">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={[{ val: 120 }, { val: 240 }, { val: 180 }, { val: 310 }, { val: 290 }, { val: 420 }, { val: 380 }]} margin={{ top: 2, right: 1, left: 1, bottom: 2 }}>
                <Line type="monotone" dataKey="val" stroke="#2563eb" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div
          onClick={() => setSeverityFilter('Critical')}
          className="p-4 rounded-xl border border-rose-200 bg-rose-50/20 shadow-xs cursor-pointer hover:border-rose-300 transition flex flex-col justify-between"
          title="Filter critical alerts"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-medium text-rose-700 block">Critical Alerts</span>
              <span className="text-2xl font-bold tracking-tight text-rose-700 mt-0.5 block font-sans">
                {summary.critical_count.toLocaleString()}
              </span>
            </div>
            <div className="text-right flex flex-col items-end">
              <span className="text-xs font-semibold flex items-center gap-0.5 text-rose-600">
                <span>↑</span> +8.2%
              </span>
              <span className="text-[10px] text-rose-500 mt-0.5">immediate action</span>
            </div>
          </div>
          <div className="h-10 w-full mt-3 -mx-0.5">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={[{ val: 15 }, { val: 28 }, { val: 20 }, { val: 35 }, { val: 29 }, { val: 45 }, { val: 38 }]} margin={{ top: 2, right: 1, left: 1, bottom: 2 }}>
                <Line type="monotone" dataKey="val" stroke="#e11d48" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div
          onClick={() => setActionFilter('Blocked')}
          className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-xs cursor-pointer hover:border-emerald-300 transition flex flex-col justify-between"
          title="Filter blocked attacks"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-medium text-emerald-700 block">Blocked Attacks</span>
              <span className="text-2xl font-bold tracking-tight text-emerald-700 mt-0.5 block font-sans">
                {summary.blocked_count.toLocaleString()}
              </span>
            </div>
            <div className="text-right flex flex-col items-end">
              <span className="text-xs font-semibold flex items-center gap-0.5 text-emerald-600">
                <span>↑</span> +15.3%
              </span>
              <span className="text-[10px] text-emerald-600 mt-0.5">perimeter blocked</span>
            </div>
          </div>
          <div className="h-10 w-full mt-3 -mx-0.5">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={[{ val: 80 }, { val: 140 }, { val: 120 }, { val: 210 }, { val: 195 }, { val: 280 }, { val: 260 }]} margin={{ top: 2, right: 1, left: 1, bottom: 2 }}>
                <Line type="monotone" dataKey="val" stroke="#059669" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-medium text-slate-500 block">Active Signatures</span>
              <span className="text-2xl font-bold tracking-tight text-slate-900 mt-0.5 block font-sans">
                {summary.active_signatures}
              </span>
            </div>
            <div className="text-right flex flex-col items-end">
              <span className="text-xs font-semibold flex items-center gap-0.5 text-emerald-600">
                <span>↑</span> +4.0%
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">rule profiles</span>
            </div>
          </div>
          <div className="h-10 w-full mt-3 -mx-0.5">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={[{ val: 35 }, { val: 38 }, { val: 40 }, { val: 42 }, { val: 45 }, { val: 46 }, { val: 48 }]} margin={{ top: 2, right: 1, left: 1, bottom: 2 }}>
                <Line type="monotone" dataKey="val" stroke="#7c3aed" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Search form */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by IP, attack type, or signature..."
              className="pl-8 text-xs h-8 bg-white border-slate-200 shadow-2xs"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </form>

          {/* Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Severity Filter */}
            <div className="w-36">
              <Select value={severityFilter} onValueChange={(val) => setSeverityFilter(val)}>
                <SelectTrigger className="h-8 text-xs bg-white border-slate-200 text-slate-700 shadow-2xs">
                  <SelectValue placeholder="All Severities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Severities</SelectItem>
                  <SelectItem value="Critical">Critical</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Action Filter */}
            <div className="w-32">
              <Select value={actionFilter} onValueChange={(val) => setActionFilter(val)}>
                <SelectTrigger className="h-8 text-xs bg-white border-slate-200 text-slate-700 shadow-2xs">
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Actions</SelectItem>
                  <SelectItem value="Blocked">Blocked</SelectItem>
                  <SelectItem value="Logged">Logged</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Attack Type Filter */}
            <div className="w-36">
              <Select value={attackTypeFilter} onValueChange={(val) => setAttackTypeFilter(val)}>
                <SelectTrigger className="h-8 text-xs bg-white border-slate-200 text-slate-700 shadow-2xs">
                  <SelectValue placeholder="All Attack Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Attack Types</SelectItem>
                  <SelectItem value="DDoS Attack">DDoS Attack</SelectItem>
                  <SelectItem value="SQL Injection">SQL Injection</SelectItem>
                  <SelectItem value="Port Scan">Port Scan</SelectItem>
                  <SelectItem value="XSS Attack">XSS Attack</SelectItem>
                  <SelectItem value="Brute Force">Brute Force</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Active Filters Bar */}
        {(search || severityFilter !== 'ALL' || actionFilter !== 'ALL' || attackTypeFilter !== 'ALL') && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-500 font-medium flex items-center gap-1">
              <Filter className="w-3 h-3 text-slate-400" />
              Active Filters:
            </span>
            {search && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 font-medium">
                search: {search}
                <button onClick={() => setSearch('')} className="hover:text-blue-900"><X className="w-2.5 h-2.5" /></button>
              </span>
            )}
            {severityFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-700 font-medium">
                severity: {severityFilter}
                <button onClick={() => setSeverityFilter('ALL')} className="hover:text-rose-900"><X className="w-2.5 h-2.5" /></button>
              </span>
            )}
            {actionFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-medium">
                action: {actionFilter}
                <button onClick={() => setActionFilter('ALL')} className="hover:text-slate-900"><X className="w-2.5 h-2.5" /></button>
              </span>
            )}
            {attackTypeFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700 font-medium">
                type: {attackTypeFilter}
                <button onClick={() => setAttackTypeFilter('ALL')} className="hover:text-amber-900"><X className="w-2.5 h-2.5" /></button>
              </span>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="text-xs text-slate-500 hover:text-slate-800 h-6 px-1.5 ml-auto"
            >
              Clear All
            </Button>
          </div>
        )}
      </div>

      {/* Alerts Table */}
      <Card className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="pb-3 border-b border-slate-100 mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-900">
            Detected Threat Stream
          </h2>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-slate-200 text-[11px] text-slate-500">
                <TableHead>Alert ID</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Attack Type</TableHead>
                <TableHead>Source IP : Port</TableHead>
                <TableHead>Destination IP : Port</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Signature / Rule</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-xs text-slate-400">
                    No security alerts match the active filter criteria.
                  </TableCell>
                </TableRow>
              ) : (
                alerts.map((alt) => (
                  <TableRow
                    key={alt.id}
                    onClick={() => setSelectedAlert(alt)}
                    className="hover:bg-slate-50 cursor-pointer font-mono text-xs transition group"
                  >
                    <TableCell className="text-blue-600 font-bold group-hover:underline">
                      {alt.id}
                    </TableCell>
                    <TableCell className="text-slate-500 text-[11px]">
                      {alt.time}
                    </TableCell>
                    <TableCell className="font-sans font-medium text-slate-800 text-xs">
                      {alt.type}
                    </TableCell>
                    <TableCell className="text-slate-700">
                      {alt.src_ip}:{alt.src_port || 'N/A'}
                    </TableCell>
                    <TableCell className="text-slate-700">
                      {alt.dst_ip}:{alt.dst_port || 'N/A'}
                    </TableCell>
                    <TableCell className="font-sans">
                      {getSeverityBadge(alt.severity)}
                    </TableCell>
                    <TableCell className="font-sans">
                      {getActionBadge(alt.action)}
                    </TableCell>
                    <TableCell className="text-slate-500 text-[11px] font-mono truncate max-w-xs" title={alt.signature}>
                      {alt.signature}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Alert Details Modal */}
      {selectedAlert && (
        <Dialog open={Boolean(selectedAlert)} onOpenChange={() => setSelectedAlert(null)}>
          <DialogContent className="max-w-md bg-white border border-slate-200">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <span>Incident #{selectedAlert.id} - {selectedAlert.type}</span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs font-mono">
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px] font-sans">Timestamp</span>
                  <span className="text-slate-800 font-medium">{selectedAlert.time}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-sans">Severity</span>
                  <div>{getSeverityBadge(selectedAlert.severity)}</div>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-sans">Attacker Origin</span>
                  <span className="text-slate-800">{selectedAlert.src_ip}:{selectedAlert.src_port || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-sans">Target Asset</span>
                  <span className="text-slate-800">{selectedAlert.dst_ip}:{selectedAlert.dst_port || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-sans">Action Taken</span>
                  <div>{getActionBadge(selectedAlert.action)}</div>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-sans">Rule Signature</span>
                  <span className="text-slate-800 font-mono text-[10px]">{selectedAlert.signature}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-500 font-sans font-medium block mb-1">Details & Payload Analysis</span>
                <div className="p-3 bg-slate-100 text-slate-800 font-mono rounded-lg text-xs break-all border border-slate-200">
                  {selectedAlert.details}
                </div>
              </div>
            </div>

            <DialogFooter className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedAlert(null);
                  if (onNavigate) {
                    onNavigate('traffic', { src_ip: selectedAlert.src_ip });
                  }
                }}
              >
                Inspect in Network Monitoring
              </Button>
              <Button type="button" size="sm" onClick={() => setSelectedAlert(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
