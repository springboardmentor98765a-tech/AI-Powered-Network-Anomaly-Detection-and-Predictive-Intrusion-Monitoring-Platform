import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  Search,
  Filter,
  RefreshCw,
  User,
} from 'lucide-react';

export default function AuditLogsPage() {
  const { user: currentUser, isAdmin, isTeamLead } = useAuth();
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [actorSearch, setActorSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [targetTypeFilter, setTargetTypeFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError('');
    try {
      const [logsData, statsData] = await Promise.all([
        api.getAuditLogs({
          actor_username: actorSearch,
          action: actionFilter,
          status: statusFilter,
          target_type: targetTypeFilter,
          limit: 150,
        }),
        api.getAuditStats().catch(() => null),
      ]);
      setLogs(logsData);
      setStats(statsData);
    } catch (err) {
      setError(err.message || 'Failed to retrieve audit log records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter, statusFilter, targetTypeFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchLogs();
  };

  const getActionVariant = (action, status) => {
    if (status === 'FAILED') return 'destructive';
    if (action.includes('LOGIN')) return 'success';
    if (action.includes('USER')) return 'info';
    if (action.includes('TEAM')) return 'warning';
    if (action.includes('PASSWORD')) return 'admin';
    return 'secondary';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
        <div>
          <h1 className="text-base font-semibold text-slate-900">Audit Logs</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Chronological record of authentication attempts, account updates, and team changes.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={fetchLogs}
          disabled={loading}
          className="self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* KPI Metric Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4">
            <span className="text-xs text-slate-500 font-medium">Total Log Entries</span>
            <span className="text-2xl font-semibold text-slate-900 mt-1 block">{stats.total_logs}</span>
            <span className="text-[11px] text-slate-400">System-wide</span>
          </Card>

          <Card className="p-4">
            <span className="text-xs text-slate-500 font-medium">Successful Logins (24h)</span>
            <span className="text-2xl font-semibold text-emerald-600 mt-1 block">
              {stats.successful_logins_24h}
            </span>
            <span className="text-[11px] text-slate-400">Authorized sessions</span>
          </Card>

          <Card className="p-4">
            <span className="text-xs text-slate-500 font-medium">Failed Logins (24h)</span>
            <span className="text-2xl font-semibold text-rose-600 mt-1 block">
              {stats.failed_logins_24h}
            </span>
            <span className="text-[11px] text-slate-400">Invalid attempts</span>
          </Card>

          <Card className="p-4">
            <span className="text-xs text-slate-500 font-medium">Actions Today</span>
            <span className="text-2xl font-semibold text-slate-900 mt-1 block">
              {stats.total_actions_today}
            </span>
            <span className="text-[11px] text-slate-400">Since 00:00 UTC</span>
          </Card>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-3 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shadow-xs">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Input
            type="text"
            value={actorSearch}
            onChange={(e) => setActorSearch(e.target.value)}
            placeholder="Filter by actor username..."
            className="pl-8"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-white border border-slate-300 rounded-md px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:border-slate-900 h-8"
          >
            <option value="">All Actions</option>
            <option value="LOGIN_SUCCESS">LOGIN_SUCCESS</option>
            <option value="LOGIN_FAILED">LOGIN_FAILED</option>
            <option value="LOGOUT">LOGOUT</option>
            <option value="USER_CREATE">USER_CREATE</option>
            <option value="USER_UPDATE">USER_UPDATE</option>
            <option value="USER_STATUS_CHANGE">USER_STATUS_CHANGE</option>
            <option value="USER_ROLE_CHANGE">USER_ROLE_CHANGE</option>
            <option value="TEAM_CREATE">TEAM_CREATE</option>
            <option value="TEAM_UPDATE">TEAM_UPDATE</option>
            <option value="TEAM_MEMBER_ADD">TEAM_MEMBER_ADD</option>
            <option value="TEAM_MEMBER_REMOVE">TEAM_MEMBER_REMOVE</option>
            <option value="PASSWORD_CHANGE">PASSWORD_CHANGE</option>
            <option value="PASSWORD_RESET">PASSWORD_RESET</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-slate-300 rounded-md px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:border-slate-900 h-8"
          >
            <option value="">All Statuses</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="FAILED">FAILED</option>
          </select>

          <select
            value={targetTypeFilter}
            onChange={(e) => setTargetTypeFilter(e.target.value)}
            className="bg-white border border-slate-300 rounded-md px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:border-slate-900 h-8"
          >
            <option value="">All Targets</option>
            <option value="AUTH">AUTH</option>
            <option value="USER">USER</option>
            <option value="TEAM">TEAM</option>
            <option value="SYSTEM">SYSTEM</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
          {error}
        </div>
      )}

      {/* Audit Log Table */}
      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp (UTC)</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>IP Address</TableHead>
              <TableHead>Summary</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="font-mono">
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-slate-400 font-sans">
                  Loading audit records...
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-slate-400 font-sans">
                  No audit records found matching your filters.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow
                  key={log.id}
                  onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}
                  className="cursor-pointer"
                >
                  <TableCell className="text-slate-500">
                    {new Date(log.created_at).toISOString().replace('T', ' ').substring(0, 19)}
                  </TableCell>
                  <TableCell className="text-slate-800 font-sans font-medium">
                    {log.actor_username}
                  </TableCell>
                  <TableCell className="font-sans">
                    <Badge variant={getActionVariant(log.action, log.status)}>
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-600 font-sans">
                    {log.target_type} {log.target_id ? `(#${log.target_id})` : ''}
                  </TableCell>
                  <TableCell className="font-sans">
                    <Badge variant={log.status === 'SUCCESS' ? 'success' : 'destructive'} className="gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${log.status === 'SUCCESS' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                      {log.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-500">{log.ip_address || '—'}</TableCell>
                  <TableCell className="text-slate-500 max-w-xs truncate font-mono text-[11px]">
                    {log.details || '—'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Log Details Inspector */}
      {selectedLog && (
        <Card className="p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
              Record #{selectedLog.id} — {selectedLog.action}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedLog(null)}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Close
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono mb-4 text-slate-600">
            <div>
              <span className="text-slate-400 block text-[11px]">Actor:</span>
              <strong className="text-slate-800">{selectedLog.actor_username} (ID: {selectedLog.actor_id || 'N/A'})</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Target:</span>
              <strong className="text-slate-800">{selectedLog.target_type} {selectedLog.target_id || ''}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Client IP:</span>
              <strong className="text-slate-800">{selectedLog.ip_address || 'Unknown'}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Result:</span>
              <strong className={selectedLog.status === 'SUCCESS' ? 'text-emerald-600' : 'text-rose-600'}>
                {selectedLog.status}
              </strong>
            </div>
          </div>

          <div>
            <span className="text-[11px] text-slate-500 block mb-1 font-medium">
              Event Details:
            </span>
            <pre className="p-3 bg-slate-50 border border-slate-200 rounded-md text-slate-700 font-mono text-xs overflow-x-auto whitespace-pre-wrap">
              {(() => {
                try {
                  return JSON.stringify(JSON.parse(selectedLog.details), null, 2);
                } catch {
                  return selectedLog.details || 'No payload details.';
                }
              })()}
            </pre>
          </div>
        </Card>
      )}
    </div>
  );
}
