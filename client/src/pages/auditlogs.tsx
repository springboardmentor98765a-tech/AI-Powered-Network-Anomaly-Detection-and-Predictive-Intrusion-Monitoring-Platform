// src/pages/auditlogs.tsx
import { useEffect, useState } from "react";
import api from "../api/axios";
import Sidebar from "../components/sidebar";
import { Search } from "lucide-react";

interface AuditLog {
  id: number;
  actor_user_id: number | null;
  action: string;
  target_type: string | null;
  status: string;
  timestamp: string;
  details?: any;
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    api.get<AuditLog[]>("/audit-logs/")
      .then((res) => setLogs(res.data))
      .catch((err) => console.error("Failed to load audit logs", err));
  }, []);

  const filteredLogs = logs.filter((log) =>
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.target_type && log.target_type.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-background text-text flex">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto space-y-8">
        <header className="pb-6 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-heading text-text-h">Security Audit Trail</h1>
            <p className="text-sm text-muted mt-1">Immutable log of system actions and security events</p>
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-3 text-muted" />
            <input
              type="text"
              placeholder="Search actions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-surface border border-border rounded-lg pl-9 pr-4 py-2 text-text-h text-sm outline-none focus:border-primary w-64"
            />
          </div>
        </header>

        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-background border-b border-border text-xs font-mono text-muted uppercase">
                <th className="p-4">Timestamp</th>
                <th className="p-4">Action</th>
                <th className="p-4">Target Type</th>
                <th className="p-4">Actor ID</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs font-mono">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-surface-hover transition-colors">
                  <td className="p-4 text-text">{new Date(log.timestamp).toLocaleString()}</td>
                  <td className="p-4 text-primary font-semibold">{log.action}</td>
                  <td className="p-4 text-text-h">{log.target_type || "-"}</td>
                  <td className="p-4 text-text">{log.actor_user_id ?? "System"}</td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded font-bold ${log.status === "SUCCESS" ? "text-success bg-success/10" : "text-danger bg-danger/10"}`}>
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}