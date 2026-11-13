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
  Users,
  ShieldAlert,
  ShieldCheck,
  FileText,
  ArrowRight,
} from 'lucide-react';

export default function DashboardPage({ onNavigate }) {
  const { user, isAdmin, isTeamLead } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);
  const [userCount, setUserCount] = useState(0);
  const [teamCount, setTeamCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [users, teams] = await Promise.all([
          api.getUsers().catch(() => []),
          api.getTeams().catch(() => []),
        ]);
        setUserCount(users.length);
        setTeamCount(teams.length);

        if (isAdmin || isTeamLead) {
          const [auditStats, logs] = await Promise.all([
            api.getAuditStats().catch(() => null),
            api.getAuditLogs({ limit: 8 }).catch(() => []),
          ]);
          setStats(auditStats);
          setRecentLogs(logs);
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, [isAdmin, isTeamLead]);

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
        <div>
          <h1 className="text-base font-semibold text-slate-900">
            Overview
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Signed in as <span className="font-medium text-slate-800">{user?.full_name}</span> ({user?.role})
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              type="button"
              size="sm"
              onClick={() => onNavigate('users')}
            >
              Manage Users
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onNavigate('teams')}
          >
            Manage Teams
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Users</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-slate-900">{userCount}</span>
            <span className="text-xs text-slate-500 font-medium">Total</span>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Teams</span>
            <ShieldCheck className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-slate-900">{teamCount}</span>
            <span className="text-xs text-slate-500 font-medium">Total</span>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Audit Events</span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-slate-900">
              {stats ? stats.total_logs : '—'}
            </span>
            <span className="text-xs text-slate-500 font-medium">Logged</span>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Failed Logins</span>
            <ShieldAlert className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-slate-900">
              {stats ? stats.failed_logins_24h : 0}
            </span>
            <span className="text-xs text-slate-500 font-medium">Past 24h</span>
          </div>
        </Card>
      </div>

      {/* Activity Table (Admin / Lead) */}
      {(isAdmin || isTeamLead) ? (
        <Card>
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider">
                Recent Audit Log Activity
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate('audit')}
                className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1"
              >
                <span>View full log</span>
                <ArrowRight className="w-3 h-3" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp (UTC)</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="font-mono">
                {recentLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center text-slate-400 font-sans">
                      No recent audit activity.
                    </TableCell>
                  </TableRow>
                ) : (
                  recentLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-slate-500">
                        {new Date(log.created_at).toISOString().replace('T', ' ').substring(0, 19)}
                      </TableCell>
                      <TableCell className="text-slate-800 font-sans font-medium">
                        {log.actor_username}
                      </TableCell>
                      <TableCell className="font-sans">
                        <Badge variant="secondary">
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-600 font-sans">{log.target_type}</TableCell>
                      <TableCell className="font-sans">
                        <Badge variant={log.status === 'SUCCESS' ? 'success' : 'destructive'}>
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-500">{log.ip_address || '—'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card className="p-5">
          <CardHeader className="pb-2 p-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider">
              Assigned Team
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 pt-2 text-xs text-slate-600">
            {user?.team_name ? (
              <p>You are actively assigned to <strong className="text-slate-900">{user.team_name}</strong>.</p>
            ) : (
              <p className="text-slate-400">You are not currently assigned to a team. Contact an administrator.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
