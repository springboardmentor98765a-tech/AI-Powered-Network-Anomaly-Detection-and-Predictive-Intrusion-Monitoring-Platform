import { useEffect, useState } from "react";
import {
  Search,
  Plus,
  RefreshCw,
  Pencil,
  UserCheck,
  UserX,
  X,
  ChevronLeft,
  ChevronRight,
  Users,
  Shield,
  Mail,
  CalendarClock,
} from "lucide-react";
import api from "../services/api";
import "./UsersPage.css";

// These IDs match the three roles seeded in your database.
const ROLE_OPTIONS = [
  { id: 1, name: "Administrator" },
  { id: 2, name: "Security Analyst" },
  { id: 3, name: "Team Lead / Supervisor" },
];

const PAGE_SIZE = 50;

const getErrorMessage = (error) => {
  const detail = error?.response?.data?.detail;

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg).join(", ");
  }

  return error?.message || "Something went wrong. Please try again.";
};

const formatDate = (date) => {
  if (!date) return "Never";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) return "—";

  return parsedDate.toLocaleString();
};

function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [offset, setOffset] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [selectedUser, setSelectedUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
  });

  const [selectedRoles, setSelectedRoles] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const fetchUsers = async () => {
      setLoading(true);
      setPageError("");

      try {
        const params = {
          limit: PAGE_SIZE,
          offset,
        };

        if (searchTerm.trim()) {
          params.search = searchTerm.trim();
        }

        if (statusFilter !== "all") {
          params.account_status = statusFilter;
        }

        const response = await api.get("/users", { params });

        if (!cancelled) {
          setUsers(Array.isArray(response.data) ? response.data : []);
        }
      } catch (error) {
        if (!cancelled) {
          setPageError(getErrorMessage(error));
          setUsers([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchUsers();

    return () => {
      cancelled = true;
    };
  }, [searchTerm, statusFilter, offset, refreshKey]);

  const refreshUsers = () => {
    setRefreshKey((value) => value + 1);
  };

  const handleSearch = (event) => {
    event.preventDefault();
    setOffset(0);
    setSearchTerm(searchInput);
  };

  const openCreateModal = () => {
    setModalMode("create");
    setSelectedUser(null);
    setForm({
      name: "",
      username: "",
      email: "",
      password: "",
    });
    setSelectedRoles([2]);
    setFormError("");
    setModalOpen(true);
  };

  const openEditModal = (user) => {
    setModalMode("edit");
    setSelectedUser(user);
    setForm({
      name: user.name || "",
      username: user.username || "",
      email: user.email || "",
      password: "",
    });

    const existingRoleIds = ROLE_OPTIONS
      .filter((role) => user.roles?.includes(role.name))
      .map((role) => role.id);

    setSelectedRoles(existingRoleIds);
    setFormError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;

    setModalOpen(false);
    setSelectedUser(null);
    setFormError("");
  };

  const updateFormField = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const toggleRole = (roleId) => {
    setSelectedRoles((current) =>
      current.includes(roleId)
        ? current.filter((id) => id !== roleId)
        : [...current, roleId]
    );
  };

  const handleSaveUser = async (event) => {
    event.preventDefault();
    setFormError("");

    if (selectedRoles.length === 0) {
      setFormError("Select at least one role for this user.");
      return;
    }

    if (modalMode === "create" && form.password.length < 12) {
      setFormError("Password must contain at least 12 characters.");
      return;
    }

    setSaving(true);

    try {
      if (modalMode === "create") {
        await api.post("/users", {
          name: form.name.trim(),
          username: form.username.trim(),
          email: form.email.trim(),
          password: form.password,
          role_ids: selectedRoles,
        });
      } else {
        await api.patch(`/users/${selectedUser.id}`, {
          name: form.name.trim(),
          username: form.username.trim(),
          email: form.email.trim(),
        });

        const oldRoleIds = ROLE_OPTIONS
          .filter((role) => selectedUser.roles?.includes(role.name))
          .map((role) => role.id)
          .sort();

        const newRoleIds = [...selectedRoles].sort();

        const rolesChanged =
          JSON.stringify(oldRoleIds) !== JSON.stringify(newRoleIds);

        if (rolesChanged) {
          await api.put(`/users/${selectedUser.id}/roles`, {
            role_ids: selectedRoles,
          });
        }
      }

      setModalOpen(false);
      setSelectedUser(null);
      refreshUsers();
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (user) => {
    const nextStatus = user.status === "active" ? "inactive" : "active";

    const confirmed = window.confirm(
      `Are you sure you want to ${nextStatus === "inactive" ? "deactivate" : "activate"} ${user.name}'s account?`
    );

    if (!confirmed) return;

    try {
      await api.patch(`/users/${user.id}/status`, {
        status: nextStatus,
      });

      refreshUsers();
    } catch (error) {
      window.alert(getErrorMessage(error));
    }
  };

  const activeCount = users.filter((user) => user.status === "active").length;
  const inactiveCount = users.filter(
    (user) => user.status === "inactive"
  ).length;

  return (
    <div className="users-page">
      <div className="users-header">
        <div>
          <p className="users-eyebrow">ADMINISTRATION</p>
          <h1>User Management</h1>
          <p className="users-subtitle">
            Create accounts, manage access, and control user status.
          </p>
        </div>

        <button className="users-primary-btn" onClick={openCreateModal}>
          <Plus size={18} />
          Create User
        </button>
      </div>

      <div className="users-stat-grid">
        <div className="users-stat-card">
          <div className="users-stat-icon">
            <Users size={20} />
          </div>
          <div>
            <span className="users-stat-label">Users on this page</span>
            <strong>{users.length}</strong>
          </div>
        </div>

        <div className="users-stat-card">
          <div className="users-stat-icon active-icon">
            <UserCheck size={20} />
          </div>
          <div>
            <span className="users-stat-label">Active</span>
            <strong>{activeCount}</strong>
          </div>
        </div>

        <div className="users-stat-card">
          <div className="users-stat-icon inactive-icon">
            <UserX size={20} />
          </div>
          <div>
            <span className="users-stat-label">Inactive</span>
            <strong>{inactiveCount}</strong>
          </div>
        </div>
      </div>

      <section className="users-panel">
        <div className="users-panel-heading">
          <div>
            <h2>All Users</h2>
            <p>Search and manage registered platform accounts.</p>
          </div>

          <button
            className="users-icon-btn"
            onClick={refreshUsers}
            title="Refresh users"
            aria-label="Refresh users"
          >
            <RefreshCw size={17} />
          </button>
        </div>

        <div className="users-toolbar">
          <form className="users-search" onSubmit={handleSearch}>
            <Search size={18} />
            <input
              type="text"
              placeholder="Search name, username, or email..."
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
            <button type="submit">Search</button>
          </form>

          <select
            className="users-filter"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setOffset(0);
            }}
            aria-label="Filter by account status"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {pageError && (
          <div className="users-error">
            <span>{pageError}</span>
            <button onClick={refreshUsers}>Try again</button>
          </div>
        )}

        <div className="users-table-wrap">
          <table className="users-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
                <th className="users-actions-heading">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="users-empty">
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="5" className="users-empty">
                    No users found. Try changing your search or filters.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="users-user-cell">
                        <div className="users-avatar">
                          {user.name?.charAt(0)?.toUpperCase() || "U"}
                        </div>
                        <div className="users-user-info">
                          <strong>{user.name}</strong>
                          <span>@{user.username}</span>
                          <small>
                            <Mail size={12} />
                            {user.email}
                          </small>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div className="users-role-list">
                        {user.roles?.length ? (
                          user.roles.map((role) => (
                            <span className="users-role-tag" key={role}>
                              <Shield size={12} />
                              {role}
                            </span>
                          ))
                        ) : (
                          <span className="users-muted">No roles</span>
                        )}
                      </div>
                    </td>

                    <td>
                      <span
                        className={`users-status ${user.status === "active" ? "status-active" : "status-inactive"}`}
                      >
                        <span className="users-status-dot" />
                        {user.status}
                      </span>
                    </td>

                    <td>
                      <span className="users-last-login">
                        <CalendarClock size={14} />
                        {formatDate(user.last_login_at)}
                      </span>
                    </td>

                    <td>
                      <div className="users-row-actions">
                        <button
                          className="users-action-btn"
                          onClick={() => openEditModal(user)}
                          title="Edit user"
                          aria-label={`Edit ${user.name}`}
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          className={`users-action-btn ${user.status === "active" ? "deactivate-action" : "activate-action"}`}
                          onClick={() => handleStatusChange(user)}
                          title={
                            user.status === "active"
                              ? "Deactivate user"
                              : "Activate user"
                          }
                          aria-label={`Change status for ${user.name}`}
                        >
                          {user.status === "active" ? (
                            <UserX size={16} />
                          ) : (
                            <UserCheck size={16} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="users-pagination">
          <span>
            Showing {users.length} result{users.length === 1 ? "" : "s"} on
            this page
          </span>

          <div>
            <button
              className="users-page-btn"
              onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))}
              disabled={offset === 0 || loading}
            >
              <ChevronLeft size={16} />
              Previous
            </button>

            <button
              className="users-page-btn"
              onClick={() => setOffset((value) => value + PAGE_SIZE)}
              disabled={loading || users.length < PAGE_SIZE}
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {modalOpen && (
        <div className="users-modal-backdrop">
          <div
            className="users-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="users-modal-title"
          >
            <div className="users-modal-header">
              <div>
                <p className="users-eyebrow">
                  {modalMode === "create" ? "NEW ACCOUNT" : "ACCOUNT SETTINGS"}
                </p>
                <h2 id="users-modal-title">
                  {modalMode === "create" ? "Create User" : "Edit User"}
                </h2>
              </div>

              <button
                className="users-icon-btn"
                onClick={closeModal}
                disabled={saving}
                aria-label="Close dialog"
              >
                <X size={19} />
              </button>
            </div>

            <form onSubmit={handleSaveUser}>
              <div className="users-form-grid">
                <label>
                  Full Name
                  <input
                    name="name"
                    value={form.name}
                    onChange={updateFormField}
                    placeholder="Enter full name"
                    maxLength={120}
                    required
                  />
                </label>

                <label>
                  Username
                  <input
                    name="username"
                    value={form.username}
                    onChange={updateFormField}
                    placeholder="Enter username"
                    minLength={3}
                    maxLength={50}
                    pattern="[a-zA-Z0-9_.-]+"
                    title="Use letters, numbers, dots, underscores, or hyphens."
                    required
                  />
                </label>

                <label className="users-full-width">
                  Email Address
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={updateFormField}
                    placeholder="name@example.com"
                    required
                  />
                </label>

                {modalMode === "create" && (
                  <label className="users-full-width">
                    Temporary Password
                    <input
                      name="password"
                      type="password"
                      value={form.password}
                      onChange={updateFormField}
                      placeholder="At least 12 characters"
                      minLength={12}
                      maxLength={128}
                      required
                    />
                    <small>
                      The backend requires a password of at least 12
                      characters.
                    </small>
                  </label>
                )}
              </div>

              <div className="users-role-selector">
                <div>
                  <h3>Assign Roles</h3>
                  <p>Select one or more access roles for this account.</p>
                </div>

                {ROLE_OPTIONS.map((role) => (
                  <label className="users-role-option" key={role.id}>
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(role.id)}
                      onChange={() => toggleRole(role.id)}
                    />
                    <span>{role.name}</span>
                  </label>
                ))}
              </div>

              {formError && <div className="users-form-error">{formError}</div>}

              <div className="users-modal-actions">
                <button
                  type="button"
                  className="users-secondary-btn"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="users-primary-btn"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : modalMode === "create"
                      ? "Create Account"
                      : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default UsersPage;