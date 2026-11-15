// src/pages/userManagement.tsx
import React, { useEffect, useState } from "react";
import api from "../api/axios";
import { type User } from "../context/authContext";
import Sidebar from "../components/sidebar";
import { Users, UserCheck, UserX, PlusCircle, UserPlus, Trash2, ShieldMinus } from "lucide-react";

export default function UserManagement() {
  const [usersList, setUsersList] = useState<User[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleName, setRoleName] = useState("Analyst");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      const res = await api.get<User[]>("/users/");
      setUsersList(res.data);
    } catch (err) {
      console.error("Failed to load users", err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await api.post("/users/", {
        name,
        email,
        password,
        role_names: [roleName],
      });
      setName("");
      setEmail("");
      setPassword("");
      setSuccess("Operator account created successfully.");
      fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to create user.");
    }
  };

  const handleToggleStatus = async (targetUser: User) => {
    setError(null);
    setSuccess(null);
    const newStatus = targetUser.status === "active" ? "inactive" : "active";
    try {
      const res = await api.patch<User>(`/users/${targetUser.id}/status`, { status: newStatus });
      setUsersList((prev) => prev.map((u) => (u.id === targetUser.id ? res.data : u)));
      setSuccess(`Updated status for ${targetUser.name} to ${newStatus}.`);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to update status.");
    }
  };

  const handleAssignRole = async (userId: number, rName: string) => {
    if (!rName) return;
    setError(null);
    setSuccess(null);
    try {
      await api.post(`/users/${userId}/roles`, { role_name: rName });
      setSuccess(`Role '${rName}' assigned successfully.`);
      fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to assign role.");
    }
  };

  const handleRemoveRole = async (userId: number, rName: string) => {
    setError(null);
    setSuccess(null);
    try {
      await api.delete(`/users/${userId}/roles`, { data: { role_name: rName } });
      setSuccess(`Role '${rName}' removed successfully.`);
      fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to remove role.");
    }
  };

  const handleDeleteUser = async (userId: number, userName: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete operator ${userName}?`)) return;
    setError(null);
    setSuccess(null);
    try {
      await api.delete(`/users/${userId}`);
      setSuccess(`Operator ${userName} deleted successfully.`);
      fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to delete user.");
    }
  };

  return (
    <div className="min-h-screen bg-background text-text flex">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto space-y-8">
        <header className="pb-6 border-b border-border">
          <h1 className="text-2xl font-bold font-heading text-text-h">User Administration & RBAC</h1>
          <p className="text-sm text-muted mt-1">Manage operator accounts, permissions, and security roles</p>
        </header>

        {error && <div className="p-3 bg-danger/10 border border-danger/30 text-danger text-sm rounded-lg">{error}</div>}
        {success && <div className="p-3 bg-success/10 border border-success/30 text-success text-sm rounded-lg">{success}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="bg-surface border border-border p-6 rounded-xl space-y-4 h-fit">
            <h2 className="text-lg font-heading font-semibold text-text-h flex items-center gap-2">
              <UserPlus size={18} className="text-primary" /> Provision Operator
            </h2>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-muted mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Smith"
                  className="w-full bg-background border border-border rounded-lg px-4 py-2 text-text-h text-sm outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-muted mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="analyst@netshield.ai"
                  className="w-full bg-background border border-border rounded-lg px-4 py-2 text-text-h text-sm outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-muted mb-1">Initial Role</label>
                <select
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-4 py-2 text-text-h text-sm outline-none focus:border-primary cursor-pointer"
                >
                  <option value="Analyst">SOC Analyst</option>
                  <option value="Team Lead">Team Lead</option>
                  <option value="Administrator">Administrator</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-muted mb-1">Temporary Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-background border border-border rounded-lg px-4 py-2 text-text-h text-sm outline-none focus:border-primary"
                />
              </div>
              <button type="submit" className="w-full bg-primary text-background font-semibold py-2.5 rounded-lg hover:bg-primary/90 transition-all cursor-pointer">
                Create Account
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-heading font-semibold text-text-h flex items-center gap-2">
              <Users size={20} className="text-primary" /> Operator Directory
            </h2>
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-background border-b border-border text-xs font-mono text-muted uppercase">
                    <th className="p-4">Name & Email</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Roles & Permissions</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-sm">
                  {usersList.map((u) => (
                    <tr key={u.id} className="hover:bg-surface-hover transition-colors">
                      <td className="p-4">
                        <p className="font-medium text-text-h">{u.name}</p>
                        <p className="text-xs text-muted font-mono">{u.email}</p>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${u.status === "active" ? "bg-success/10 text-success border border-success/20" : "bg-danger/10 text-danger border border-danger/20"}`}>
                          {u.status}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {u.roles.map((r) => (
                            <span key={r.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-background border border-border text-xs text-text-h">
                              {r.role_name}
                              <button
                                onClick={() => handleRemoveRole(u.id, r.role_name)}
                                title={`Remove role ${r.role_name}`}
                                className="text-muted hover:text-danger transition-colors cursor-pointer"
                              >
                                <ShieldMinus size={12} />
                              </button>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          <div className="relative inline-flex items-center">
                            <PlusCircle size={14} className="text-primary mr-1" />
                            <select
                              defaultValue=""
                              onChange={(e) => {
                                handleAssignRole(u.id, e.target.value);
                                e.target.value = "";
                              }}
                              className="bg-background border border-border text-xs text-text-h rounded px-2 py-1 outline-none focus:border-primary cursor-pointer"
                            >
                              <option value="" disabled>+ Role</option>
                              <option value="Analyst">Analyst</option>
                              <option value="Team Lead">Team Lead</option>
                              <option value="Administrator">Administrator</option>
                            </select>
                          </div>
                          <button
                            onClick={() => handleToggleStatus(u)}
                            className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer ${u.status === "active" ? "bg-warning/10 text-warning hover:bg-warning/20 border border-warning/20" : "bg-success/10 text-success hover:bg-success/20 border border-success/20"}`}
                          >
                            {u.status === "active" ? <><UserX size={14} /> Disable</> : <><UserCheck size={14} /> Enable</>}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.id, u.name)}
                            title="Delete User Account"
                            className="p-1.5 rounded bg-danger/10 text-danger hover:bg-danger/20 border border-danger/20 transition-colors cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}