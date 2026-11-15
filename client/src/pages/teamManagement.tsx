// src/pages/teamManagement.tsx
import React, { useEffect, useState } from "react";
import api from "../api/axios";
import { useAuth, type User } from "../context/authContext";
import Sidebar from "../components/sidebar";
import { Users, Plus, UserPlus, UserMinus, Trash2 } from "lucide-react";

interface Team {
  id: number;
  team_name: string;
  description?: string;
  members?: User[];
}

export default function TeamManagement() {
  const { user } = useAuth();
  const roleNames = user?.roles?.map((r) => r.role_name) || [];
  const isAdmin = roleNames.includes("Administrator");
  const isTeamLead = roleNames.includes("Team Lead");
  const canManageTeams = isAdmin || isTeamLead;

  const [teams, setTeams] = useState<Team[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [teamName, setTeamName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const teamsRes = await api.get<Team[]>("/teams/");
      setTeams(teamsRes.data);
      if (canManageTeams) {
        const usersRes = await api.get<User[]>("/users/");
        setAllUsers(usersRes.data);
      }
    } catch (err) {
      console.error("Failed to load teams data", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [canManageTeams]);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await api.post("/teams/", { team_name: teamName, description });
      setTeamName("");
      setDescription("");
      setSuccess("Team created successfully.");
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to create team.");
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeamId || !selectedUserId) return;
    setError(null);
    setSuccess(null);
    try {
      await api.post(`/teams/${selectedTeamId}/members`, { user_id: selectedUserId });
      setSuccess("User assigned to team successfully.");
      setSelectedUserId(null);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to assign user.");
    }
  };

  const handleRemoveMember = async (teamId: number, userId: number, userName: string, teamName: string) => {
    if (!window.confirm(`Remove ${userName} from ${teamName}?`)) return;
    setError(null);
    setSuccess(null);
    try {
      await api.delete(`/teams/${teamId}/members/${userId}`);
      setSuccess(`Removed ${userName} from ${teamName}.`);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to remove member.");
    }
  };

  const handleDeleteTeam = async (teamId: number, teamName: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete team '${teamName}'?`)) return;
    setError(null);
    setSuccess(null);
    try {
      await api.delete(`/teams/${teamId}`);
      setSuccess(`Team '${teamName}' deleted successfully.`);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to delete team.");
    }
  };

  return (
    <div className="min-h-screen bg-background text-text flex">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto space-y-8">
        <header className="pb-6 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-heading text-text-h">Team Operations</h1>
            <p className="text-sm text-muted mt-1">Organize security operators and analyst units</p>
          </div>
          <span className="text-xs font-mono px-3 py-1 rounded bg-primary/10 text-primary border border-primary/20">
            {isAdmin ? "Administrator Control" : isTeamLead ? "Team Lead Oversight" : "Analyst View"}
          </span>
        </header>

        {error && <div className="p-3.5 bg-danger/10 border border-danger/30 text-danger text-sm rounded-lg">{error}</div>}
        {success && <div className="p-3.5 bg-success/10 border border-success/30 text-success text-sm rounded-lg">{success}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Admin & Team Lead Management Sidebar Cards */}
          {canManageTeams && (
            <div className="space-y-6 h-fit">
              {/* Create Team Card - Admin Only */}
              {isAdmin && (
                <div className="bg-surface border border-border p-6 rounded-xl space-y-4">
                  <h2 className="text-lg font-heading font-semibold text-text-h flex items-center gap-2">
                    <Plus size={18} className="text-primary" /> Create New Team
                  </h2>
                  <form onSubmit={handleCreateTeam} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase text-muted mb-1">Team Name</label>
                      <input
                        type="text"
                        required
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        placeholder="e.g. Incident Response Unit"
                        className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-text-h text-sm outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase text-muted mb-1">Description</label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Brief scope of team duties..."
                        className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-text-h text-sm outline-none focus:border-primary"
                      />
                    </div>
                    <button type="submit" className="w-full bg-primary text-background font-semibold py-2.5 rounded-lg hover:bg-primary/90 transition-all cursor-pointer">
                      Initialize Team
                    </button>
                  </form>
                </div>
              )}

              {/* Assign Member Card - Admin & Team Lead */}
              <div className="bg-surface border border-border p-6 rounded-xl space-y-4">
                <h2 className="text-lg font-heading font-semibold text-text-h flex items-center gap-2">
                  <UserPlus size={18} className="text-primary" /> Assign Member
                </h2>
                <form onSubmit={handleAddMember} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-muted mb-1">Select Team</label>
                    <select
                      value={selectedTeamId || ""}
                      onChange={(e) => setSelectedTeamId(Number(e.target.value))}
                      className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-text-h text-sm outline-none focus:border-primary cursor-pointer"
                    >
                      <option value="" disabled>Select Team...</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>{t.team_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-muted mb-1">Select Operator</label>
                    <select
                      value={selectedUserId || ""}
                      onChange={(e) => setSelectedUserId(Number(e.target.value))}
                      className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-text-h text-sm outline-none focus:border-primary cursor-pointer"
                    >
                      <option value="" disabled>Select User...</option>
                      {allUsers.map((u) => (
                        <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" className="w-full bg-primary text-background font-semibold py-2.5 rounded-lg hover:bg-primary/90 transition-all cursor-pointer">
                    Assign to Team
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Teams Roster Display Area */}
          <div className={`${canManageTeams ? "lg:col-span-2" : "lg:col-span-3"} space-y-4`}>
            <h2 className="text-lg font-heading font-semibold text-text-h flex items-center gap-2">
              <Users size={20} className="text-primary" /> Active Teams Roster
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {teams.map((team) => (
                <div key={team.id} className="bg-surface border border-border p-5 rounded-xl space-y-4 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-text-h text-base">{team.team_name}</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">ID: {team.id}</span>
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteTeam(team.id, team.team_name)}
                            title="Delete Team"
                            className="p-1 rounded bg-danger/10 text-danger hover:bg-danger/20 border border-danger/20 transition-colors cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted">{team.description || "No description provided."}</p>
                  </div>

                  <div className="pt-3 border-t border-border">
                    <p className="text-xs font-semibold uppercase text-muted mb-2">Assigned Members:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {team.members && team.members.length > 0 ? (
                        team.members.map((m) => (
                          <span key={m.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-background border border-border text-xs text-text-h">
                            {m.name}
                            {canManageTeams && (
                              <button
                                onClick={() => handleRemoveMember(team.id, m.id, m.name, team.team_name)}
                                title={`Remove ${m.name} from team`}
                                className="text-muted hover:text-danger transition-colors cursor-pointer"
                              >
                                <UserMinus size={12} />
                              </button>
                            )}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-muted italic">No members assigned</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}