import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
  UserPlus,
  Search,
  Filter,
  Edit2,
  KeyRound,
  CheckCircle,
  XCircle,
  X,
} from 'lucide-react';

export default function UsersPage() {
  const { user: currentUser, isAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Forms
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    full_name: '',
    password: '',
    role: 'Security Analyst',
    team_id: '',
  });

  const [editFormData, setEditFormData] = useState({
    full_name: '',
    email: '',
    role: '',
    team_id: '',
  });

  const [newPassword, setNewPassword] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersData, teamsData] = await Promise.all([
        api.getUsers({ search, role: roleFilter }),
        api.getTeams().catch(() => []),
      ]);
      setUsers(usersData);
      setTeams(teamsData);
    } catch (err) {
      setError(err.message || 'Failed to load user list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [roleFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadData();
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    try {
      await api.createUser({
        ...newUser,
        team_id: newUser.team_id ? parseInt(newUser.team_id) : null,
      });
      setSuccessMsg(`User '${newUser.username}' created successfully.`);
      setShowCreateModal(false);
      setNewUser({
        username: '',
        email: '',
        full_name: '',
        password: '',
        role: 'Security Analyst',
        team_id: '',
      });
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to create user.');
    }
  };

  const handleEditOpen = (user) => {
    setSelectedUser(user);
    setEditFormData({
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      team_id: user.team_id || '',
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    try {
      await api.updateUser(selectedUser.id, {
        ...editFormData,
        team_id: editFormData.team_id ? parseInt(editFormData.team_id) : 0,
      });
      setSuccessMsg(`User '${selectedUser.username}' updated successfully.`);
      setShowEditModal(false);
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to update user.');
    }
  };

  const handleToggleStatus = async (user) => {
    setError('');
    setSuccessMsg('');
    try {
      await api.toggleUserStatus(user.id, !user.is_active);
      setSuccessMsg(`User '${user.username}' is now ${!user.is_active ? 'Active' : 'Deactivated'}.`);
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to update user status.');
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    try {
      await api.resetUserPassword(selectedUser.id, newPassword);
      setSuccessMsg(`Password for '${selectedUser.username}' reset successfully.`);
      setShowResetModal(false);
      setNewPassword('');
    } catch (err) {
      setError(err.message || 'Failed to reset password.');
    }
  };

  const getRoleVariant = (role) => {
    switch (role) {
      case 'Administrator':
        return 'admin';
      case 'Team Lead / Supervisor':
        return 'warning';
      case 'Security Analyst':
        return 'info';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
        <div>
          <h1 className="text-base font-semibold text-slate-900">
            Users
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage platform accounts, role permissions, and team assignments.
          </p>
        </div>

        {isAdmin && (
          <Button
            type="button"
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="self-start sm:self-auto"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add User</span>
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

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-3 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shadow-xs">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by username, full name, or email..."
            className="pl-8"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
        </form>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-white border border-slate-300 rounded-md px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:border-slate-900 h-8"
          >
            <option value="">All Roles</option>
            <option value="Administrator">Administrator</option>
            <option value="Team Lead / Supervisor">Team Lead / Supervisor</option>
            <option value="Security Analyst">Security Analyst</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>RBAC Role</TableHead>
              <TableHead>Assigned Team</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Registered</TableHead>
              {isAdmin && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-slate-400">
                  Loading users...
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-slate-400">
                  No users match your criteria.
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div>
                      <span className="font-medium text-slate-900 block">{u.full_name}</span>
                      <span className="text-[11px] text-slate-500 font-mono">@{u.username}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-600 font-mono text-[11px]">{u.email}</TableCell>
                  <TableCell>
                    <Badge variant={getRoleVariant(u.role)}>
                      {u.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {u.team_name ? (
                      <span className="text-slate-700 font-medium">{u.team_name}</span>
                    ) : (
                      <span className="text-slate-400 italic">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.is_active ? 'success' : 'destructive'} className="gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                      {u.is_active ? 'Active' : 'Deactivated'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-500 font-mono text-[11px]">
                    {new Date(u.created_at).toLocaleDateString()}
                  </TableCell>

                  {isAdmin && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditOpen(u)}
                          title="Edit Role & Team"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-slate-600" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedUser(u);
                            setShowResetModal(true);
                          }}
                          title="Reset Password"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-slate-600" />
                        </Button>
                        {u.id !== currentUser.id && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleStatus(u)}
                            title={u.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {u.is_active ? (
                              <XCircle className="w-3.5 h-3.5 text-slate-400 hover:text-rose-600" />
                            ) : (
                              <CheckCircle className="w-3.5 h-3.5 text-slate-400 hover:text-emerald-600" />
                            )}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-3">
            <div className="space-y-1">
              <Label>Username *</Label>
              <Input
                type="text"
                required
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                placeholder="username"
              />
            </div>

            <div className="space-y-1">
              <Label>Full Name *</Label>
              <Input
                type="text"
                required
                value={newUser.full_name}
                onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                placeholder="Full name"
              />
            </div>

            <div className="space-y-1">
              <Label>Email *</Label>
              <Input
                type="email"
                required
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                placeholder="name@netshield.ai"
              />
            </div>

            <div className="space-y-1">
              <Label>Initial Password * (min 8 chars)</Label>
              <Input
                type="password"
                required
                minLength={8}
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                placeholder="••••••••••••"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>RBAC Role *</Label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="bg-white border border-slate-300 rounded-md px-2 py-1 text-xs text-slate-900 w-full h-8"
                >
                  <option value="Security Analyst">Security Analyst</option>
                  <option value="Team Lead / Supervisor">Team Lead / Supervisor</option>
                  <option value="Administrator">Administrator</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label>Team</Label>
                <select
                  value={newUser.team_id}
                  onChange={(e) => setNewUser({ ...newUser, team_id: e.target.value })}
                  className="bg-white border border-slate-300 rounded-md px-2 py-1 text-xs text-slate-900 w-full h-8"
                >
                  <option value="">No Team</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
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
                Create Account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User: {selectedUser?.username}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-3">
            <div className="space-y-1">
              <Label>Full Name</Label>
              <Input
                type="text"
                required
                value={editFormData.full_name}
                onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <Label>Email</Label>
              <Input
                type="email"
                required
                value={editFormData.email}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Role</Label>
                <select
                  value={editFormData.role}
                  onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                  className="bg-white border border-slate-300 rounded-md px-2 py-1 text-xs text-slate-900 w-full h-8"
                >
                  <option value="Security Analyst">Security Analyst</option>
                  <option value="Team Lead / Supervisor">Team Lead / Supervisor</option>
                  <option value="Administrator">Administrator</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label>Team</Label>
                <select
                  value={editFormData.team_id}
                  onChange={(e) => setEditFormData({ ...editFormData, team_id: e.target.value })}
                  className="bg-white border border-slate-300 rounded-md px-2 py-1 text-xs text-slate-900 w-full h-8"
                >
                  <option value="">No Team</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

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

      {/* Reset Password Dialog */}
      <Dialog open={showResetModal} onOpenChange={setShowResetModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
          </DialogHeader>

          <p className="text-xs text-slate-500 mb-2">
            Assign new temporary password for user <strong className="text-slate-900">@{selectedUser?.username}</strong>:
          </p>

          <form onSubmit={handleResetSubmit} className="space-y-3">
            <div className="space-y-1">
              <Label>New Password (min 8 chars)</Label>
              <Input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••••••"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowResetModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
              >
                Confirm Reset
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
