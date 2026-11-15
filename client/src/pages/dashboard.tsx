// src/pages/dashboard.tsx
import { useEffect, useState } from "react";
import api from "../api/axios";
import { useAuth, type User } from "../context/authContext";
import Sidebar from "../components/sidebar";
import {
  ShieldCheck,
  Users,
  FileText,
  Activity,
  UserCheck,
  UserX,
  PlusCircle,
  Radio,
  AlertTriangle,
  ShieldMinus,
  Trash2,
} from "lucide-react";

interface AuditLog {
  id: number;
  actor_user_id: number | null;
  action: string;
  target_type: string | null;
  status: string;
  timestamp: string;
}

interface Team {
  id: number;
  team_name: string;
  description?: string;
}

export default function Dashboard() {
  const { user, loading } = useAuth();

  const [usersList, setUsersList] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Role helpers
  const roleNames = user?.roles?.map((r) => r.role_name) || [];
  const isAdmin = roleNames.includes("Administrator");
  const isTeamLead = roleNames.includes("Team Lead");
  const canViewManagement = isAdmin || isTeamLead;

  // Fetch data permitted for the logged-in user's role
  const fetchDashboardData = async () => {
    try {
      api
        .get<Team[]>("/teams/")
        .then((res) => setTeams(res.data))
        .catch(() => setTeams([]));

      if (canViewManagement) {
        const [usersRes, logsRes] = await Promise.all([
          api.get<User[]>("/users/"),
          api.get<AuditLog[]>("/audit-logs/"),
        ]);
        setUsersList(usersRes.data);
        setAuditLogs(logsRes.data.slice(0, 10)); // Latest 10 events
      }
    } catch (err) {
      console.error("Error loading role-based dashboard data:", err);
    }
  };

  useEffect(() => {
    if (!loading && user) {
      fetchDashboardData();
    }
  }, [loading, user]);

  // Admin-only: Toggle User Active/Inactive Status
  const handleToggleUserStatus = async (targetUser: User) => {
    setActionError(null);
    setActionSuccess(null);
    const newStatus = targetUser.status === "active" ? "inactive" : "active";

    try {
      const res = await api.patch<User>(`/users/${targetUser.id}/status`, {
        status: newStatus,
      });
      setUsersList((prev) =>
        prev.map((u) => (u.id === targetUser.id ? res.data : u))
      );
      setActionSuccess(`Updated ${targetUser.name} status to ${newStatus}.`);
    } catch (err: any) {
      setActionError(err.response?.data?.detail || "Failed to update user status.");
    }
  };

  // Admin-only: Assign Role to User
  const handleAssignRole = async (userId: number, roleName: string) => {
    if (!roleName) return;
    setActionError(null);
    setActionSuccess(null);

    try {
      await api.post(`/users/${userId}/roles`, { role_name: roleName });
      setActionSuccess(`Assigned role '${roleName}' successfully.`);
      fetchDashboardData();
    } catch (err: any) {
      setActionError(err.response?.data?.detail || "Failed to assign role.");
    }
  };

  // Admin-only: Remove Role from User
  const handleRemoveRole = async (userId: number, roleName: string) => {
    setActionError(null);
    setActionSuccess(null);

    try {
      await api.delete(`/users/${userId}/roles`, { data: { role_name: roleName } });
      setActionSuccess(`Removed role '${roleName}' successfully.`);
      fetchDashboardData();
    } catch (err: any) {
      setActionError(err.response?.data?.detail || "Failed to remove role.");
    }
  };

  // Admin-only: Delete User Account
  const handleDeleteUser = async (userId: number, userName: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete operator ${userName}?`)) return;
    setActionError(null);
    setActionSuccess(null);

    try {
      await api.delete(`/users/${userId}`);
      setActionSuccess(`Operator ${userName} deleted successfully.`);
      fetchDashboardData();
    } catch (err: any) {
      setActionError(err.response?.data?.detail || "Failed to delete user.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-primary font-mono">
        Initializing SOC Session...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-text flex">
      {/* Persistent Role-Aware Sidebar */}
      <Sidebar />

      {/* Main Content Workspace */}
      <main className="flex-1 p-8 overflow-y-auto space-y-8">
        {/* Top Operator Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
          <div>
            <h1 className="text-2xl font-bold font-heading text-text-h tracking-wide">
              Command Center Overview
            </h1>
            <p className="text-sm text-muted mt-1">
              Welcome back, <span className="text-text-h font-medium">{user?.name}</span> ({user?.email})
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {roleNames.map((role) => (
              <span
                key={role}
                className="px-3 py-1 rounded-full text-xs font-mono font-semibold bg-primary/10 text-primary border border-primary/30 flex items-center gap-1.5"
              >
                <ShieldCheck size={14} />
                {role}
              </span>
            ))}
          </div>
        </header>

        {/* Feedback Banners */}
        {actionError && (
          <div className="p-3.5 bg-danger/10 border border-danger/30 text-danger text-sm rounded-lg">
            {actionError}
          </div>
        )}
        {actionSuccess && (
          <div className="p-3.5 bg-success/10 border border-success/30 text-success text-sm rounded-lg">
            {actionSuccess}
          </div>
        )}

        {/* Common Section: SOC Telemetry & Status Cards (Visible to ALL Roles) */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-surface border border-border rounded-xl p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-mono uppercase text-muted">Network Sensor Status</p>
              <p className="text-xl font-bold text-success mt-1 flex items-center gap-2">
                <Radio size={18} className="animate-pulse" /> Online & Monitoring
              </p>
              <p className="text-xs text-text mt-1">Module 2 telemetry pipeline ready</p>
            </div>
            <div className="p-3 rounded-lg bg-success/10 text-success">
              <Activity size={24} />
            </div>
          </div>

          <div className="bg-surface border border-border rounded-xl p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-mono uppercase text-muted">Active Alerts</p>
              <p className="text-xl font-bold text-text-h mt-1">0 Critical</p>
              <p className="text-xs text-text mt-1">Baseline traffic nominal</p>
            </div>
            <div className="p-3 rounded-lg bg-warning/10 text-warning">
              <AlertTriangle size={24} />
            </div>
          </div>

          <div className="bg-surface border border-border rounded-xl p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-mono uppercase text-muted">
                {canViewManagement ? "Registered Operators" : "Active SOC Teams"}
              </p>
              <p className="text-xl font-bold text-text-h mt-1">
                {canViewManagement ? usersList.length : teams.length}
              </p>
              <p className="text-xs text-text mt-1">
                {canViewManagement ? "Role-based access enforced" : "Assigned operational units"}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-primary/10 text-primary">
              <Users size={24} />
            </div>
          </div>
        </section>

        {/* Analyst-Specific Operational Notice */}
        {!canViewManagement && (
          <section className="bg-surface border border-border rounded-xl p-6">
            <h2 className="text-lg font-heading font-semibold text-text-h mb-2">
              SOC Analyst Workspace
            </h2>
            <p className="text-sm text-text leading-relaxed">
              Your session is scoped to <span className="text-primary font-medium">Analyst</span> privileges. 
              Use the <span className="text-text-h font-medium">Threat Analytics</span> and{" "}
              <span className="text-text-h font-medium">Network Stream</span> views in the sidebar to inspect 
              real-time packet anomalies and intrusion alerts.
            </p>
          </section>
        )}

        {/* Team Lead & Administrator Section: Operator Management */}
        {canViewManagement && (
          <section className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Users size={20} className="text-primary" />
                <h2 className="text-lg font-heading font-semibold text-text-h">
                  {isAdmin ? "User Administration & RBAC" : "Team Roster Overview"}
                </h2>
              </div>
              <span className="text-xs font-mono text-muted">
                {isAdmin ? "Full Write Access" : "Read-Only View"}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-background border-b border-border text-xs font-mono text-muted uppercase">
                    <th className="p-4">Operator</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Assigned Roles</th>
                    {isAdmin && <th className="p-4 text-right">Admin Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-sm">
                  {usersList.map((u) => (
                    <tr key={u.id} className="hover:bg-surface-hover transition-colors">
                      <td className="p-4 font-medium text-text-h">{u.name}</td>
                      <td className="p-4 text-text font-mono text-xs">{u.email}</td>
                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            u.status === "active"
                              ? "bg-success/10 text-success border border-success/20"
                              : "bg-danger/10 text-danger border border-danger/20"
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {u.roles.map((r) => (
                            <span
                              key={r.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-background border border-border text-xs text-text-h"
                            >
                              {r.role_name}
                              {isAdmin && u.id !== user?.id && (
                                <button
                                  onClick={() => handleRemoveRole(u.id, r.role_name)}
                                  title={`Remove role ${r.role_name}`}
                                  className="text-muted hover:text-danger transition-colors cursor-pointer"
                                >
                                  <ShieldMinus size={12} />
                                </button>
                              )}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Administrator-Only Controls */}
                      {isAdmin && (
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2 flex-wrap">
                            {/* Quick Role Assign Dropdown */}
                            <div className="relative inline-flex items-center">
                              <PlusCircle size={14} className="text-primary mr-1" />
                              <select
                                defaultValue=""
                                onChange={(e) => {
                                  handleAssignRole(u.id, e.target.value);
                                  e.target.value = "";
                                }}
                                disabled={u.id === user?.id}
                                className="bg-background border border-border text-xs text-text-h rounded px-2 py-1 outline-none focus:border-primary cursor-pointer disabled:opacity-40"
                              >
                                <option value="" disabled>
                                  + Role
                                </option>
                                <option value="Analyst">Analyst</option>
                                <option value="Team Lead">Team Lead</option>
                                <option value="Administrator">Administrator</option>
                              </select>
                            </div>

                            {/* Activate / Deactivate Button */}
                            <button
                              onClick={() => handleToggleUserStatus(u)}
                              disabled={u.id === user?.id}
                              title={
                                u.id === user?.id
                                  ? "Cannot deactivate your own account"
                                  : u.status === "active"
                                  ? "Deactivate User"
                                  : "Activate User"
                              }
                              className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                                u.status === "active"
                                  ? "bg-danger/10 text-danger hover:bg-danger/20 border border-danger/20"
                                  : "bg-success/10 text-success hover:bg-success/20 border border-success/20"
                              }`}
                            >
                              {u.status === "active" ? (
                                <>
                                  <UserX size={14} /> Disable
                                </>
                              ) : (
                                <>
                                  <UserCheck size={14} /> Enable
                                </>
                              )}
                            </button>

                            {/* Delete User Button */}
                            <button
                              onClick={() => handleDeleteUser(u.id, u.name)}
                              disabled={u.id === user?.id}
                              title={u.id === user?.id ? "Cannot delete your own active account" : "Permanently Delete User"}
                              className="p-1.5 rounded bg-danger/10 text-danger hover:bg-danger/20 border border-danger/20 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Team Lead & Administrator Section: Recent Security Audit Logs */}
        {canViewManagement && (
          <section className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileText size={20} className="text-primary" />
                <h2 className="text-lg font-heading font-semibold text-text-h">
                  Recent Security Audit Trail
                </h2>
              </div>
              <span className="text-xs font-mono text-muted">Latest 10 Events</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-background border-b border-border text-xs font-mono text-muted uppercase">
                    <th className="p-4">Timestamp</th>
                    <th className="p-4">Action</th>
                    <th className="p-4">Target</th>
                    <th className="p-4">Actor ID</th>
                    <th className="p-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs font-mono">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-surface-hover transition-colors">
                      <td className="p-4 text-text">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="p-4 text-primary font-semibold">{log.action}</td>
                      <td className="p-4 text-text-h">{log.target_type || "-"}</td>
                      <td className="p-4 text-text">{log.actor_user_id ?? "System"}</td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-0.5 rounded font-bold ${
                            log.status === "SUCCESS"
                              ? "text-success bg-success/10"
                              : "text-danger bg-danger/10"
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}