import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Plus,
  UserPlus,
  Trash2,
  Edit2,
  UserX,
  X,
  Crown,
} from 'lucide-react';

export default function TeamsPage() {
  const { user: currentUser, isAdmin, isTeamLead } = useAuth();
  const [teams, setTeams] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);

  // Forms
  const [newTeam, setNewTeam] = useState({ name: '', description: '', lead_id: '' });
  const [editTeam, setEditTeam] = useState({ name: '', description: '', lead_id: '' });
  const [selectedUserId, setSelectedUserId] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [teamsData, usersData] = await Promise.all([
        api.getTeams(),
        api.getUsers().catch(() => []),
      ]);
      setTeams(teamsData);
      setAvailableUsers(usersData);
    } catch (err) {
      setError(err.message || 'Failed to load teams.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    try {
      await api.createTeam({
        name: newTeam.name,
        description: newTeam.description || null,
        lead_id: newTeam.lead_id ? parseInt(newTeam.lead_id) : null,
      });
      setSuccessMsg(`Team '${newTeam.name}' created successfully.`);
      setShowCreateModal(false);
      setNewTeam({ name: '', description: '', lead_id: '' });
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to create team.');
    }
  };

  const handleEditOpen = (team) => {
    setSelectedTeam(team);
    setEditTeam({
      name: team.name,
      description: team.description || '',
      lead_id: team.lead_id || '',
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    try {
      await api.updateTeam(selectedTeam.id, {
        name: editTeam.name,
        description: editTeam.description || null,
        lead_id: editTeam.lead_id ? parseInt(editTeam.lead_id) : 0,
      });
      setSuccessMsg(`Team '${editTeam.name}' updated successfully.`);
      setShowEditModal(false);
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to update team.');
    }
  };

  const handleDeleteTeam = async (team) => {
    if (!window.confirm(`Are you sure you want to delete team '${team.name}'? Members will be safely unassigned.`)) {
      return;
    }
    setError('');
    setSuccessMsg('');
    try {
      await api.deleteTeam(team.id);
      setSuccessMsg(`Team '${team.name}' deleted successfully.`);
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to delete team.');
    }
  };

  const handleAddMemberOpen = (team) => {
    setSelectedTeam(team);
    setSelectedUserId('');
    setShowAddMemberModal(true);
  };

  const handleAddMemberSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUserId) return;
    setError('');
    setSuccessMsg('');
    try {
      await api.addTeamMember(selectedTeam.id, parseInt(selectedUserId));
      setSuccessMsg('Team member assigned successfully.');
      setShowAddMemberModal(false);
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to assign member.');
    }
  };

  const handleRemoveMember = async (team, member) => {
    if (!window.confirm(`Remove '${member.full_name}' from '${team.name}'?`)) return;
    setError('');
    setSuccessMsg('');
    try {
      await api.removeTeamMember(team.id, member.id);
      setSuccessMsg(`Removed '${member.full_name}' from '${team.name}'.`);
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to remove member.');
    }
  };

  const canManageTeam = (team) => {
    if (isAdmin) return true;
    if (isTeamLead && team.lead_id === currentUser?.id) return true;
    return false;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
        <div>
          <h1 className="text-base font-semibold text-slate-900">
            Team Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Organize security analysts into teams to manage incident monitoring and response.
          </p>
        </div>

        {isAdmin && (
          <Button
            type="button"
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Team</span>
          </Button>
        )}
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="p-1 hover:text-rose-900"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="p-1 hover:text-emerald-900"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Teams Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-2 text-center py-10 text-slate-400 text-xs">
            Loading teams...
          </div>
        ) : teams.length === 0 ? (
          <div className="col-span-2 bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 text-xs">
            No teams created yet.
          </div>
        ) : (
          teams.map((t) => {
            const hasManagePerms = canManageTeam(t);
            return (
              <Card key={t.id} className="flex flex-col justify-between">
                <div>
                  <CardHeader className="pb-3 border-b border-slate-100 mb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-sm">{t.name}</CardTitle>
                          <Badge variant="secondary">
                            {t.member_count} {t.member_count === 1 ? 'analyst' : 'analysts'}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 leading-normal">
                          {t.description || 'No description provided.'}
                        </p>
                      </div>

                      {hasManagePerms && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditOpen(t)}
                            title="Edit Team"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                          </Button>
                          {isAdmin && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteTeam(t)}
                              title="Delete Team"
                              className="hover:text-rose-600 hover:bg-rose-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3.5">
                    {/* Team Lead Indicator */}
                    <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Crown className="w-3.5 h-3.5 text-amber-500" />
                        <span>Lead:</span>
                        <strong className="text-slate-900 font-medium">
                          {t.lead_name || 'Unassigned'}
                        </strong>
                      </div>
                    </div>

                    {/* Members List */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                          Roster
                        </span>
                        {hasManagePerms && (
                          <button
                            type="button"
                            onClick={() => handleAddMemberOpen(t)}
                            className="text-xs text-slate-700 hover:text-slate-900 flex items-center gap-1 font-medium transition cursor-pointer"
                          >
                            <UserPlus className="w-3 h-3" />
                            <span>Assign</span>
                          </button>
                        )}
                      </div>

                      <div className="space-y-1 max-h-44 overflow-y-auto">
                        {t.members.length === 0 ? (
                          <p className="text-xs text-slate-400 italic py-1.5">
                            No analysts currently assigned.
                          </p>
                        ) : (
                          t.members.map((m) => (
                            <div
                              key={m.id}
                              className="flex items-center justify-between p-1.5 rounded-md hover:bg-slate-50 text-xs border border-transparent hover:border-slate-100"
                            >
                              <div>
                                <span className="font-medium text-slate-800 block">{m.full_name}</span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  @{m.username} • {m.role}
                                </span>
                              </div>

                              {hasManagePerms && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMember(t, m)}
                                  title="Remove"
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                                >
                                  <UserX className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </CardContent>
                </div>

                <CardFooter className="pt-2.5 border-t border-slate-100 text-[10px] text-slate-400 flex justify-between">
                  <span>Created {new Date(t.created_at).toLocaleDateString()}</span>
                  <span>ID: #{t.id}</span>
                </CardFooter>
              </Card>
            );
          })
        )}
      </div>

      {/* Create Team Dialog */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Team</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-3">
            <div className="space-y-1">
              <Label>Team Name *</Label>
              <Input
                type="text"
                required
                value={newTeam.name}
                onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                placeholder="Team name"
              />
            </div>

            <div className="space-y-1">
              <Label>Description</Label>
              <textarea
                rows={2}
                value={newTeam.description}
                onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
                placeholder="Team description (optional)"
                className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs shadow-xs focus:outline-none focus:border-slate-900"
              />
            </div>

            <div className="space-y-1">
              <Label>Assign Team Lead</Label>
              <select
                value={newTeam.lead_id}
                onChange={(e) => setNewTeam({ ...newTeam, lead_id: e.target.value })}
                className="bg-white border border-slate-300 rounded-md px-2 py-1 text-xs text-slate-900 w-full h-8"
              >
                <option value="">No lead assigned</option>
                {availableUsers
                  .filter((u) => u.is_active && (u.role === 'Team Lead / Supervisor' || u.role === 'Administrator'))
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} (@{u.username})
                    </option>
                  ))}
              </select>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
              >
                Create Team
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Team Dialog */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update {selectedTeam?.name}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-3">
            <div className="space-y-1">
              <Label>Team Name *</Label>
              <Input
                type="text"
                required
                value={editTeam.name}
                onChange={(e) => setEditTeam({ ...editTeam, name: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <Label>Description</Label>
              <textarea
                rows={2}
                value={editTeam.description}
                onChange={(e) => setEditTeam({ ...editTeam, description: e.target.value })}
                className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs shadow-xs focus:outline-none focus:border-slate-900"
              />
            </div>

            {isAdmin && (
              <div className="space-y-1">
                <Label>Lead</Label>
                <select
                  value={editTeam.lead_id}
                  onChange={(e) => setEditTeam({ ...editTeam, lead_id: e.target.value })}
                  className="bg-white border border-slate-300 rounded-md px-2 py-1 text-xs text-slate-900 w-full h-8"
                >
                  <option value="">No lead assigned</option>
                  {availableUsers
                    .filter((u) => u.is_active && (u.role === 'Team Lead / Supervisor' || u.role === 'Administrator'))
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} (@{u.username})
                      </option>
                    ))}
                </select>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowEditModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
              >
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={showAddMemberModal} onOpenChange={setShowAddMemberModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign User to {selectedTeam?.name}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddMemberSubmit} className="space-y-3">
            <div className="space-y-1">
              <Label>Select Active User</Label>
              <select
                required
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="bg-white border border-slate-300 rounded-md px-2 py-1 text-xs text-slate-900 w-full h-8"
              >
                <option value="">Choose an analyst or lead...</option>
                {availableUsers
                  .filter((u) => u.is_active && u.team_id !== selectedTeam?.id)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} (@{u.username}) {u.team_name ? `[Current: ${u.team_name}]` : '[Unassigned]'}
                    </option>
                  ))}
              </select>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAddMemberModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!selectedUserId}
              >
                Assign
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
