import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Activity,
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  Radio,
  RefreshCw,
  Send,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  FileText,
  Lock,
  UserX,
  Cpu,
  Server,
  Filter,
  X,
  Radar,
  HelpCircle,
} from 'lucide-react';

export default function AnomalyDetectionPage({ onNavigate }) {
  const { user, isAdmin, isTeamLead } = useAuth();

  // Sub-tabs: 'behavior' | 'suspicious' | 'patterns' | 'classification'
  const [activeTab, setActiveTab] = useState('behavior');

  // Data states
  const [overview, setOverview] = useState(null);
  const [behaviorMetrics, setBehaviorMetrics] = useState([]);
  const [suspiciousList, setSuspiciousList] = useState([]);
  const [patternsList, setPatternsList] = useState([]);
  const [classificationsList, setClassificationsList] = useState([]);

  // UI / Filter states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [suspiciousFilter, setSuspiciousFilter] = useState('ALL');
  const [classificationFilter, setClassificationFilter] = useState('ALL');

  // Modals
  const [reportModalItem, setReportModalItem] = useState(null);
  const [analystNotes, setAnalystNotes] = useState('');
  const [reporting, setReporting] = useState(false);

  const [resolveModalItem, setResolveModalItem] = useState(null);
  const [resolveAction, setResolveAction] = useState('BLOCKED_IP');
  const [resolveNotes, setResolveNotes] = useState('');
  const [resolving, setResolving] = useState(false);

  const loadData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    else setRefreshing(true);
    setError('');

    try {
      const [overviewData, behaviorData, suspiciousData, patternData, classificationData] =
        await Promise.all([
          api.getAnomalyOverview(),
          api.getNetworkBehavior(),
          api.getSuspiciousActivities(),
          api.getRecognizedPatterns(),
          api.getAnomalyClassifications(),
        ]);

      setOverview(overviewData);
      setBehaviorMetrics(behaviorData || []);
      setSuspiciousList(suspiciousData || []);
      setPatternsList(patternData || []);
      setClassificationsList(classificationData || []);
    } catch (err) {
      setError(err.message || 'Failed to load anomaly detection telemetry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Analyst Submit Report Handler
  const handleReportSubmit = async (e) => {
    e.preventDefault();
    if (!reportModalItem) return;
    setReporting(true);
    setError('');
    setSuccessMsg('');

    try {
      await api.reportSuspiciousActivity(reportModalItem.id, analystNotes);
      setSuccessMsg(`Reported activity #${reportModalItem.id} to Team Lead.`);
      setReportModalItem(null);
      setAnalystNotes('');
      loadData(true);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to submit report to team lead.');
    } finally {
      setReporting(false);
    }
  };

  // Team Lead Submit Resolution Handler
  const handleResolveSubmit = async (e) => {
    e.preventDefault();
    if (!resolveModalItem) return;
    setResolving(true);
    setError('');
    setSuccessMsg('');

    try {
      await api.resolveSuspiciousActivity(resolveModalItem.id, resolveAction, resolveNotes);
      setSuccessMsg(`Action '${resolveAction}' recorded for activity #${resolveModalItem.id}.`);
      setResolveModalItem(null);
      setResolveNotes('');
      loadData(true);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to resolve activity alert.');
    } finally {
      setResolving(false);
    }
  };

  // Filtered views
  const filteredSuspicious = suspiciousList.filter((item) => {
    if (suspiciousFilter === 'ALL') return true;
    return item.status === suspiciousFilter;
  });

  const filteredClassifications = classificationsList.filter((item) => {
    if (classificationFilter === 'ALL') return true;
    if (classificationFilter === 'DANGEROUS') return !item.is_mistake;
    if (classificationFilter === 'MISTAKE') return item.is_mistake;
    return true;
  });

  const regularIps = patternsList.filter((p) => p.pattern_type === 'REGULAR_IP');
  const regularTransfers = patternsList.filter((p) => p.pattern_type === 'SCHEDULED_TRANSFER');

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
            Anomaly Detection
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Module 3: Network behavior analysis, suspicious activity detection, pattern recognition, and anomaly classification
          </p>
        </div>

        <div className="flex items-center gap-2">
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
        </div>
      </div>

      {/* Module 3 Four Navigation Sub-Tabs */}
      <div className="flex items-center gap-6 border-b border-slate-200 text-xs font-semibold overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('behavior')}
          className={`pb-2.5 pt-1 border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'behavior'
              ? 'border-blue-600 text-blue-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Network Behavior Analysis</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('suspicious')}
          className={`pb-2.5 pt-1 border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'suspicious'
              ? 'border-blue-600 text-blue-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Suspicious Activity Detection</span>
          {overview?.suspicious_pending_review > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-700 text-[10px]">
              {overview.suspicious_pending_review} pending
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('patterns')}
          className={`pb-2.5 pt-1 border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'patterns'
              ? 'border-blue-600 text-blue-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Pattern Recognition</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('classification')}
          className={`pb-2.5 pt-1 border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'classification'
              ? 'border-blue-600 text-blue-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Radar className="w-3.5 h-3.5" />
          <span>Anomaly Classification</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* SUB-SECTION 1: NETWORK BEHAVIOR ANALYSIS (TABULAR FORMAT) */}
      {/* ======================================================== */}
      {activeTab === 'behavior' && (
        <div className="space-y-4">
          <Card className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="pb-3 border-b border-slate-100 mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-600" />
                  <span>Network Behavioral Telemetry & Statistical Deviations</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Real-time tabular baseline profiling measuring inter-arrival times, protocol entropy, jitter, and Gaussian Z-scores
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400 font-mono text-[11px]">
                  Model: Gaussian μ ± 2σ Baseline Profile
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-slate-200 text-xs text-slate-500">
                    <TableHead>Telemetry Vector (Feature)</TableHead>
                    <TableHead>Protocol Layer</TableHead>
                    <TableHead className="text-right">Baseline Expected (μ ± σ)</TableHead>
                    <TableHead className="text-right">Observed Value</TableHead>
                    <TableHead className="text-right">Z-Score Index</TableHead>
                    <TableHead>Volatility</TableHead>
                    <TableHead>Behavioral Status</TableHead>
                    <TableHead className="min-w-[240px]">Technical Diagnosis & Anomaly Rationale</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {behaviorMetrics.map((m) => {
                    const isExceeded = m.status === 'THRESHOLD_EXCEEDED';
                    const isWarning = m.status === 'DEVIATION_WARNING';
                    const isDrift = m.status === 'VARIANCE_DRIFT';

                    return (
                      <TableRow key={m.id} className="hover:bg-slate-50 transition text-xs">
                        <TableCell className="font-semibold text-slate-900 font-sans">
                          {m.metric_name}
                        </TableCell>
                        <TableCell className="text-slate-600 font-mono text-[11px]">
                          {m.protocol_layer}
                        </TableCell>
                        <TableCell className="text-right font-mono text-slate-500 text-[11px]">
                          {m.baseline_mean.toFixed(2)} ± {m.baseline_stddev.toFixed(2)} {m.unit}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-slate-900 text-xs">
                          {m.observed_value.toFixed(2)} {m.unit}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          <span
                            className={`font-semibold ${
                              Math.abs(m.z_score) > 10
                                ? 'text-rose-600'
                                : Math.abs(m.z_score) > 2
                                ? 'text-amber-600'
                                : 'text-slate-600'
                            }`}
                          >
                            {m.z_score > 0 ? `+${m.z_score.toFixed(2)}σ` : `${m.z_score.toFixed(2)}σ`}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${
                              m.volatility === 'High Spike'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : m.volatility === 'Moderate'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {m.volatility}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-tight ${
                              isExceeded
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : isWarning
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : isDrift
                                ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {m.status.replace('_', ' ')}
                          </span>
                        </TableCell>
                        <TableCell className="text-slate-600 text-[11px] leading-relaxed">
                          {m.technical_diagnosis}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      )}

      {/* ======================================================== */}
      {/* SUB-SECTION 2: SUSPICIOUS ACTIVITY DETECTION */}
      {/* ======================================================== */}
      {activeTab === 'suspicious' && (
        <div className="space-y-4">
          {/* Controls & Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Suspicious Activity Monitoring</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                New unrecognized IPs and unauthorized access attempts above security clearance
              </p>
            </div>

            {/* Status Filter Buttons */}
            <div className="flex items-center gap-1.5 text-xs">
              <Button
                type="button"
                variant={suspiciousFilter === 'ALL' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSuspiciousFilter('ALL')}
                className={`h-7 text-xs ${suspiciousFilter === 'ALL' ? 'bg-slate-900 text-white' : 'bg-white border-slate-200 text-slate-700'}`}
              >
                All
              </Button>
              <Button
                type="button"
                variant={suspiciousFilter === 'DETECTED' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSuspiciousFilter('DETECTED')}
                className={`h-7 text-xs ${suspiciousFilter === 'DETECTED' ? 'bg-slate-900 text-white' : 'bg-white border-slate-200 text-slate-700'}`}
              >
                Detected
              </Button>
              <Button
                type="button"
                variant={suspiciousFilter === 'REPORTED_TO_LEAD' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSuspiciousFilter('REPORTED_TO_LEAD')}
                className={`h-7 text-xs ${suspiciousFilter === 'REPORTED_TO_LEAD' ? 'bg-slate-900 text-white' : 'bg-white border-slate-200 text-slate-700'}`}
              >
                Escalated to Lead
              </Button>
              <Button
                type="button"
                variant={suspiciousFilter === 'ACTION_TAKEN' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSuspiciousFilter('ACTION_TAKEN')}
                className={`h-7 text-xs ${suspiciousFilter === 'ACTION_TAKEN' ? 'bg-slate-900 text-white' : 'bg-white border-slate-200 text-slate-700'}`}
              >
                Action Taken
              </Button>
              <Button
                type="button"
                variant={suspiciousFilter === 'DISMISSED' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSuspiciousFilter('DISMISSED')}
                className={`h-7 text-xs ${suspiciousFilter === 'DISMISSED' ? 'bg-slate-900 text-white' : 'bg-white border-slate-200 text-slate-700'}`}
              >
                Dismissed
              </Button>
            </div>
          </div>

          {/* Activity Cards Stream */}
          <div className="space-y-3">
            {filteredSuspicious.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-white border border-slate-200 rounded-xl">
                No suspicious activities match the selected filter.
              </div>
            ) : (
              filteredSuspicious.map((item) => {
                const isNewIp = item.activity_type === 'NEW_UNRECOGNIZED_IP';
                const isClearance = item.activity_type === 'UNAUTHORIZED_CLEARANCE_ACCESS';
                const isReported = item.status === 'REPORTED_TO_LEAD';
                const isActionTaken = item.status === 'ACTION_TAKEN';
                const isDismissed = item.status === 'DISMISSED';

                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        {isNewIp ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <Radio className="w-3 h-3 text-amber-600" />
                            New Unrecognized IP
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                            <Lock className="w-3 h-3 text-rose-600" />
                            Security Clearance Violation
                          </span>
                        )}

                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                            item.severity === 'Critical'
                              ? 'bg-rose-600 text-white'
                              : item.severity === 'High'
                              ? 'bg-rose-100 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {item.severity}
                        </span>

                        <span className="text-[11px] text-slate-400 font-mono">
                          #{item.id} • {new Date(item.created_at).toLocaleTimeString()}
                        </span>
                      </div>

                      {/* Status badge */}
                      <div>
                        {isActionTaken && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            {item.resolution_action || 'Action Taken'}
                          </span>
                        )}
                        {isDismissed && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">
                            <XCircle className="w-3 h-3 text-slate-400" />
                            {item.resolution_action || 'Dismissed Alert'}
                          </span>
                        )}
                        {isReported && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                            <Clock className="w-3 h-3 text-amber-600" />
                            Escalated to Team Lead
                          </span>
                        )}
                        {item.status === 'DETECTED' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">
                            Detected Active
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Incident Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div className="space-y-1">
                        <span className="text-slate-400 block text-[11px]">Network Endpoints</span>
                        <div className="font-mono text-slate-800">
                          <span className="font-semibold text-blue-600">{item.source_ip}</span>
                          <span className="text-slate-400 mx-1.5">→</span>
                          <span className="font-semibold text-slate-700">{item.destination_ip}</span>
                        </div>
                        <span className="text-slate-500 text-[11px] block">
                          Identity: <strong className="text-slate-800">{item.user_identity}</strong>
                        </span>
                      </div>

                      <div className="space-y-1">
                        <span className="text-slate-400 block text-[11px]">Clearance Assessment</span>
                        <div className="text-[11px] leading-tight">
                          <span className="text-slate-500">Required: </span>
                          <span className="font-semibold text-rose-700">{item.required_clearance}</span>
                        </div>
                        <div className="text-[11px] leading-tight">
                          <span className="text-slate-500">Actual Held: </span>
                          <span className="font-semibold text-slate-700">{item.actual_clearance}</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-slate-400 block text-[11px]">Target Resource</span>
                        <span className="font-mono text-slate-900 font-semibold text-[11px] block truncate" title={item.attempted_resource}>
                          {item.attempted_resource}
                        </span>
                        <p className="text-slate-500 text-[11px] line-clamp-1">{item.description}</p>
                      </div>
                    </div>

                    {/* Technical details payload */}
                    {item.technical_details && (
                      <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 font-mono text-[11px] text-slate-700 break-all">
                        {item.technical_details}
                      </div>
                    )}

                    {/* Workflow Resolution / Report banners */}
                    {item.analyst_notes && (
                      <div className="p-2.5 bg-amber-50/60 rounded-lg border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                        <Send className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                        <div>
                          <span className="font-semibold">
                            Analyst Escalation ({item.reported_by_name || 'Security Analyst'}):
                          </span>
                          <p className="mt-0.5 text-amber-800 font-sans">{item.analyst_notes}</p>
                        </div>
                      </div>
                    )}

                    {(isActionTaken || isDismissed) && (
                      <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700 flex items-start gap-2">
                        <ShieldAlert className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
                        <div>
                          <span className="font-semibold">
                            Team Lead Resolution ({item.resolved_by_name || 'Supervisor'}):
                          </span>
                          <p className="mt-0.5 text-slate-600 font-sans">{item.resolution_notes}</p>
                        </div>
                      </div>
                    )}

                    {/* Workflow Actions */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                      {/* Analyst Report Button (if detected) */}
                      {item.status === 'DETECTED' && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setReportModalItem(item);
                            setAnalystNotes('');
                          }}
                          className="h-8 text-xs bg-white border-slate-200 shadow-2xs hover:border-blue-400 text-slate-700"
                        >
                          <Send className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                          <span>Report to Team Lead</span>
                        </Button>
                      )}

                      {/* Team Lead Actions (Take Action or Dismiss) */}
                      {(isTeamLead || isAdmin) && (item.status === 'DETECTED' || isReported) && (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              setResolveModalItem(item);
                              setResolveAction('BLOCKED_IP');
                              setResolveNotes('');
                            }}
                            className="h-8 text-xs bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
                          >
                            <ShieldAlert className="w-3.5 h-3.5 mr-1.5" />
                            <span>Take Action</span>
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setResolveModalItem(item);
                              setResolveAction('DISMISSED_FALSE_POSITIVE');
                              setResolveNotes('');
                            }}
                            className="h-8 text-xs bg-white border-slate-200 shadow-2xs text-slate-600 hover:text-slate-900"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                            <span>Dismiss Alert</span>
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SUB-SECTION 3: PATTERN RECOGNITION */}
      {/* ======================================================== */}
      {activeTab === 'patterns' && (
        <div className="space-y-5">
          {/* Part A: Regularly Used IP Addresses (Whitelist & Catalog) */}
          <Card className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="pb-3 border-b border-slate-100 mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Server className="w-4 h-4 text-blue-600" />
                  <span>Regularly Used IP Addresses (Baseline Whitelist)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Known internal gateways, authoritative resolvers, and corporate workstation clusters
                </p>
              </div>
              <Badge variant="outline" className="font-mono text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                {regularIps.length} Whitelisted Nodes
              </Badge>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-slate-200 text-xs text-slate-500">
                    <TableHead>Node Name / Service</TableHead>
                    <TableHead>IP Address / Range</TableHead>
                    <TableHead>Protocol & Port</TableHead>
                    <TableHead>Access Frequency</TableHead>
                    <TableHead>Expected Packet Bounds</TableHead>
                    <TableHead className="text-right">Baselined Volume</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Whitelist Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {regularIps.map((p) => (
                    <TableRow key={p.id} className="hover:bg-slate-50 transition text-xs">
                      <TableCell className="font-semibold text-slate-900 font-sans">
                        {p.name}
                      </TableCell>
                      <TableCell className="font-mono text-blue-600 font-semibold text-xs">
                        {p.source_ip}
                      </TableCell>
                      <TableCell className="font-mono text-slate-600 text-[11px]">
                        {p.protocol} {p.port ? `:${p.port}` : ''}
                      </TableCell>
                      <TableCell className="text-slate-600 text-[11px]">
                        {p.frequency}
                      </TableCell>
                      <TableCell className="font-mono text-slate-500 text-[11px]">
                        {p.expected_packet_range}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-slate-800 text-xs">
                        {p.formatted_bytes}
                      </TableCell>
                      <TableCell className="font-mono font-bold text-emerald-600 text-xs">
                        {p.confidence_score.toFixed(1)}%
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          <CheckCircle className="w-2.5 h-2.5 text-emerald-600" />
                          Whitelisted
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* Part B: Regular Packet Transfers (Scheduled Workloads) */}
          <Card className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="pb-3 border-b border-slate-100 mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-purple-600" />
                  <span>Regular Packet Transfers & Scheduled Workloads</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Periodic network synchronization streams, database heartbeats, and scheduled data backups
                </p>
              </div>
              <Badge variant="outline" className="font-mono text-xs bg-blue-50 text-blue-700 border-blue-200">
                {regularTransfers.length} Workload Flows
              </Badge>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-slate-200 text-xs text-slate-500">
                    <TableHead>Transfer Routine</TableHead>
                    <TableHead>Source → Destination</TableHead>
                    <TableHead>Protocol & Port</TableHead>
                    <TableHead>Cadence / Frequency</TableHead>
                    <TableHead>Packet Range</TableHead>
                    <TableHead className="text-right">Volume Profile</TableHead>
                    <TableHead>Confidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {regularTransfers.map((p) => (
                    <TableRow key={p.id} className="hover:bg-slate-50 transition text-xs">
                      <TableCell className="font-semibold text-slate-900 font-sans">
                        {p.name}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        <span className="text-slate-800">{p.source_ip}</span>
                        <span className="text-slate-400 mx-1">→</span>
                        <span className="text-slate-600">{p.destination_ip}</span>
                      </TableCell>
                      <TableCell className="font-mono text-slate-600 text-[11px]">
                        {p.protocol} {p.port ? `:${p.port}` : ''}
                      </TableCell>
                      <TableCell className="text-slate-600 text-[11px]">
                        {p.frequency}
                      </TableCell>
                      <TableCell className="font-mono text-slate-500 text-[11px]">
                        {p.expected_packet_range}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-slate-800 text-xs">
                        {p.formatted_bytes}
                      </TableCell>
                      <TableCell className="font-mono font-bold text-emerald-600 text-xs">
                        {p.confidence_score.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      )}

      {/* ======================================================== */}
      {/* SUB-SECTION 4: ANOMALY CLASSIFICATION */}
      {/* ======================================================== */}
      {activeTab === 'classification' && (
        <div className="space-y-4">
          {/* Header & Filter Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Radar className="w-4 h-4 text-blue-600" />
                <span>Anomaly Risk Assessment & Classification Engine</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Evaluates whether an event is a dangerous attack or simply an operational mistake
              </p>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <Button
                type="button"
                variant={classificationFilter === 'ALL' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setClassificationFilter('ALL')}
                className={`h-7 text-xs ${classificationFilter === 'ALL' ? 'bg-slate-900 text-white' : 'bg-white border-slate-200 text-slate-700'}`}
              >
                All Anomalies
              </Button>
              <Button
                type="button"
                variant={classificationFilter === 'DANGEROUS' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setClassificationFilter('DANGEROUS')}
                className={`h-7 text-xs ${classificationFilter === 'DANGEROUS' ? 'bg-rose-600 text-white' : 'bg-white border-slate-200 text-rose-700'}`}
              >
                Dangerous Attacks
              </Button>
              <Button
                type="button"
                variant={classificationFilter === 'MISTAKE' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setClassificationFilter('MISTAKE')}
                className={`h-7 text-xs ${classificationFilter === 'MISTAKE' ? 'bg-sky-600 text-white' : 'bg-white border-slate-200 text-sky-700'}`}
              >
                Operational Mistakes
              </Button>
            </div>
          </div>

          {/* Classification Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredClassifications.map((c) => {
              const isMistake = c.is_mistake;

              return (
                <div
                  key={c.id}
                  className={`p-4 rounded-xl border bg-white shadow-xs space-y-3 transition flex flex-col justify-between ${
                    isMistake ? 'border-sky-200 bg-sky-50/10' : 'border-rose-200 bg-rose-50/10'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100">
                      <div>
                        {isMistake ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                            <HelpCircle className="w-3 h-3 text-sky-600" />
                            Operational Mistake / Misconfiguration
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                            <ShieldAlert className="w-3 h-3 text-rose-600" />
                            Dangerous Attack Vector
                          </span>
                        )}

                        <h3 className="text-sm font-semibold text-slate-900 mt-1.5 font-sans">
                          {c.threat_signature}
                        </h3>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            c.risk_level === 'CRITICAL'
                              ? 'bg-rose-600 text-white'
                              : c.risk_level === 'HIGH'
                              ? 'bg-orange-600 text-white'
                              : c.risk_level === 'MEDIUM'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {c.risk_level}
                        </span>
                        <span className="block text-[10px] text-slate-400 font-mono mt-0.5">
                          {c.confidence_pct.toFixed(1)}% Confidence
                        </span>
                      </div>
                    </div>

                    {/* Target & Vector */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 font-sans block">Target Asset</span>
                        <span className="font-mono text-slate-800 font-medium text-[11px] truncate block">
                          {c.target_asset}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-sans block">Framework Vector</span>
                        <span className="font-mono text-slate-700 font-medium text-[11px] truncate block">
                          {c.vector_identifier}
                        </span>
                      </div>
                    </div>

                    {/* Root Cause Assessment */}
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                      <span className="font-semibold text-slate-800 block text-[11px] mb-1">
                        Root Cause Assessment:
                      </span>
                      <p className="text-slate-600 text-[11px] leading-relaxed">
                        {c.root_cause_explanation}
                      </p>
                    </div>
                  </div>

                  {/* Remediation */}
                  <div className="pt-2 border-t border-slate-100 text-xs">
                    <span className="font-semibold text-slate-800 block text-[11px] mb-0.5">
                      Recommended Remediation:
                    </span>
                    <p className="text-slate-500 text-[11px] leading-normal font-sans">
                      {c.recommended_remediation}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: ANALYST REPORT TO TEAM LEAD */}
      {/* ======================================================== */}
      {reportModalItem && (
        <Dialog open={Boolean(reportModalItem)} onOpenChange={() => setReportModalItem(null)}>
          <DialogContent className="max-w-md bg-white border border-slate-200">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Send className="w-4 h-4 text-blue-600" />
                <span>Report to Team Lead</span>
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleReportSubmit} className="space-y-4 py-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5 font-mono">
                <div>
                  <span className="text-slate-400 text-[10px] font-sans block">Activity Type</span>
                  <span className="font-bold text-slate-800">{reportModalItem.activity_type}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] font-sans block">Endpoints</span>
                  <span className="text-blue-600">{reportModalItem.source_ip}</span> → <span className="text-slate-700">{reportModalItem.destination_ip}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] font-sans block">Attempted Resource</span>
                  <span className="text-slate-900 truncate block">{reportModalItem.attempted_resource}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Analyst Observations & Justification:
                </label>
                <textarea
                  required
                  rows={3}
                  value={analystNotes}
                  onChange={(e) => setAnalystNotes(e.target.value)}
                  placeholder="Explain why this activity is suspicious and recommend defensive action..."
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 font-sans text-slate-800"
                />
              </div>

              <DialogFooter className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setReportModalItem(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={reporting || !analystNotes.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {reporting ? 'Submitting...' : 'Send Escalation Report'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: TEAM LEAD RESOLUTION (TAKE ACTION OR DISMISS) */}
      {/* ======================================================== */}
      {resolveModalItem && (
        <Dialog open={Boolean(resolveModalItem)} onOpenChange={() => setResolveModalItem(null)}>
          <DialogContent className="max-w-md bg-white border border-slate-200">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <span>Team Lead Alert Resolution</span>
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleResolveSubmit} className="space-y-4 py-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1 font-mono">
                <div>
                  <span className="text-slate-400 text-[10px] font-sans block">Activity Target</span>
                  <span className="font-bold text-slate-800">{resolveModalItem.source_ip}</span> ({resolveModalItem.activity_type})
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] font-sans block">Severity / Clearance</span>
                  <span className="text-rose-600 font-semibold">{resolveModalItem.severity}</span> • Req: {resolveModalItem.required_clearance}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Resolution Decision / Action:
                </label>
                <Select value={resolveAction} onValueChange={(val) => setResolveAction(val)}>
                  <SelectTrigger className="w-full h-8 bg-white border-slate-200 text-xs font-medium text-slate-700 shadow-2xs">
                    <SelectValue placeholder="Select decision / action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Take Mitigation Action</SelectLabel>
                      <SelectItem value="BLOCKED_IP">Block IP Address at Border Router</SelectItem>
                      <SelectItem value="QUARANTINED_HOST">Quarantine Host Machine (EDR Isolation)</SelectItem>
                      <SelectItem value="REVOKED_TOKEN">Revoke Active Authentication Token</SelectItem>
                    </SelectGroup>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel>Dismiss Alert</SelectLabel>
                      <SelectItem value="DISMISSED_FALSE_POSITIVE">Dismiss as False Positive</SelectItem>
                      <SelectItem value="DISMISSED_AUTHORIZED">Dismiss as Authorized Maintenance</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Team Lead Resolution Notes:
                </label>
                <textarea
                  rows={2}
                  value={resolveNotes}
                  onChange={(e) => setResolveNotes(e.target.value)}
                  placeholder="Record rationale for security audit trail..."
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 font-sans text-slate-800"
                />
              </div>

              <DialogFooter className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setResolveModalItem(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={resolving}
                  className={resolveAction.includes('DISMISS') ? 'bg-slate-800 text-white' : 'bg-rose-600 hover:bg-rose-700 text-white'}
                >
                  {resolving ? 'Executing...' : 'Commit Resolution'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
