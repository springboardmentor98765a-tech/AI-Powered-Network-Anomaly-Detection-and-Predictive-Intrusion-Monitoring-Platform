import { useState, useEffect, useCallback } from "react";
import "./App.css";

const API = "http://127.0.0.1:8000";

const getRoleName = (id) =>
  ({ 1: "Admin", 2: "Analyst", 3: "Viewer" }[id] || "Unknown");

// Read the role claim for frontend display only.
// Backend permissions remain the actual security boundary.
const getRoleIdFromToken = (accessToken) => {
  try {
    if (!accessToken) return null;

    const payload = accessToken.split(".")[1];
    if (!payload) return null;

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const base64 = normalized.padEnd(
      Math.ceil(normalized.length / 4) * 4,
      "="
    );

    const decoded = JSON.parse(atob(base64));
    const roleId = Number(decoded.role_id);

    return [1, 2, 3].includes(roleId) ? roleId : null;
  } catch {
    return null;
  }
};


function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [token, setToken] = useState(
    () => localStorage.getItem("access_token") || ""
  );

  const roleId = getRoleIdFromToken(token);
  const roleName = getRoleName(roleId);
  const isAdmin = roleId === 1;

  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [members, setMembers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  const [selectedTeam, setSelectedTeam] = useState("");
  const [activeSection, setActiveSection] = useState("users");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [newUser, setNewUser] = useState({
    full_name: "",
    email: "",
    password: "",
    role_id: "2",
  });

  const [newTeam, setNewTeam] = useState({
    name: "",
    description: "",
  });

  const [assignment, setAssignment] = useState({
    user_id: "",
    team_id: "",
  });

  const authHeaders = {
    Authorization: `Bearer ${token}`,
  };


  // LOGIN
  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Login failed.");
        return;
      }

      localStorage.setItem("access_token", data.access_token);
      setToken(data.access_token);
      setActiveSection("users");
      setPassword("");
    } catch {
      setMessage("Cannot connect to backend.");
    } finally {
      setLoading(false);
    }
  };


  // FETCH USERS - ADMIN ONLY
  const fetchUsers = useCallback(async () => {
    if (!token || !isAdmin) return;

    try {
      const response = await fetch(`${API}/users/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Unable to load users.");
        return;
      }

      setUsers(data);
    } catch {
      setMessage("Could not load users.");
    }
  }, [token, isAdmin]);


  // FETCH TEAMS
  const fetchTeams = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch(`${API}/teams/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Unable to load teams.");
        return;
      }

      setTeams(data);

      setSelectedTeam((current) => {
        if (
          current &&
          data.some((team) => String(team.id) === String(current))
        ) {
          return current;
        }

        return data.length > 0 ? String(data[0].id) : "";
      });
    } catch {
      setMessage("Could not load teams.");
    }
  }, [token]);


  // FETCH AUDIT LOGS - ADMIN ONLY
  const fetchAuditLogs = useCallback(async () => {
    if (!token || !isAdmin) return;

    try {
      const response = await fetch(`${API}/audit-logs/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Unable to load audit logs.");
        return;
      }

      setAuditLogs(data);
    } catch {
      setMessage("Could not load audit logs.");
    }
  }, [token, isAdmin]);


  // FETCH TEAM MEMBERS
  const fetchMembers = useCallback(async (teamId) => {
    if (!token || !teamId) {
      setMembers([]);
      return;
    }

    try {
      const response = await fetch(
        `${API}/team-members/${teamId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMembers([]);
        setMessage(data.detail || "Unable to load team members.");
        return;
      }

      setMembers(data);
    } catch {
      setMessage("Could not load team members.");
    }
  }, [token]);


  // LOAD DATA FOR AUTHENTICATED USERS
  // Teams are available to all roles according to backend permissions.
  // Users and audit logs are Admin-only.
  useEffect(() => {
    if (!token) return;

    fetchTeams();

    if (isAdmin) {
      fetchUsers();
      fetchAuditLogs();
    } else {
      setUsers([]);
      setAuditLogs([]);
    }
  }, [
    token,
    isAdmin,
    fetchUsers,
    fetchTeams,
    fetchAuditLogs,
  ]);


  // LOAD MEMBERS WHEN TEAM CHANGES
  useEffect(() => {
    if (selectedTeam && token) {
      fetchMembers(selectedTeam);
    } else {
      setMembers([]);
    }
  }, [selectedTeam, token, fetchMembers]);


  // CREATE USER
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      const response = await fetch(`${API}/users/`, {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...newUser,
          role_id: Number(newUser.role_id),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Failed to create user.");
        return;
      }

      setNewUser({
        full_name: "",
        email: "",
        password: "",
        role_id: "2",
      });

      await fetchUsers();
      setMessage("User created successfully!");
    } catch {
      setMessage("Could not connect to backend.");
    }
  };


  // EDIT USER
  const handleEditUser = async (user) => {
    const full_name = window.prompt(
      "Enter new full name:",
      user.full_name
    );

    if (full_name === null) return;

    if (full_name.trim().length < 2) {
      setMessage("Name must contain at least 2 characters.");
      return;
    }

    const roleInput = window.prompt(
      "Role ID: 1 = Admin, 2 = Analyst, 3 = Viewer",
      String(user.role_id)
    );

    if (roleInput === null) return;

    const role_id = Number(roleInput);

    if (![1, 2, 3].includes(role_id)) {
      setMessage("Invalid role ID.");
      return;
    }

    const is_active = window.confirm(
      "Click OK to keep active. Click Cancel to deactivate."
    );

    try {
      const response = await fetch(`${API}/users/${user.id}`, {
        method: "PUT",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          full_name: full_name.trim(),
          role_id,
          is_active,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Failed to update user.");
        return;
      }

      await fetchUsers();
      await fetchAuditLogs();

      setMessage("User updated successfully!");
    } catch {
      setMessage("Could not update user.");
    }
  };


  // DELETE USER
  const handleDeleteUser = async (user) => {
    if (!window.confirm(`Delete user ${user.full_name}?`)) return;

    try {
      const response = await fetch(`${API}/users/${user.id}`, {
        method: "DELETE",
        headers: authHeaders,
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Failed to delete user.");
        return;
      }

      await fetchUsers();
      await fetchTeams();
      await fetchAuditLogs();

      setMessage("User deleted successfully!");
    } catch {
      setMessage("Could not delete user.");
    }
  };


  // CREATE TEAM
  const handleCreateTeam = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      const response = await fetch(`${API}/teams/`, {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newTeam),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Failed to create team.");
        return;
      }

      setNewTeam({
        name: "",
        description: "",
      });

      await fetchTeams();
      await fetchAuditLogs();

      setMessage("Team created successfully!");
    } catch {
      setMessage("Could not create team.");
    }
  };


  // EDIT TEAM
  const handleEditTeam = async (team) => {
    const name = window.prompt(
      "Enter team name:",
      team.name
    );

    if (name === null) return;

    if (name.trim().length < 2) {
      setMessage("Team name must contain at least 2 characters.");
      return;
    }

    const description = window.prompt(
      "Enter team description:",
      team.description || ""
    );

    if (description === null) return;

    const is_active = window.confirm(
      "Click OK to keep this team active. Click Cancel to deactivate."
    );

    try {
      const response = await fetch(`${API}/teams/${team.id}`, {
        method: "PUT",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          description,
          is_active,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Failed to update team.");
        return;
      }

      await fetchTeams();
      await fetchAuditLogs();

      setMessage("Team updated successfully!");
    } catch {
      setMessage("Could not update team.");
    }
  };


  // DELETE TEAM
  const handleDeleteTeam = async (team) => {
    if (!window.confirm(`Delete team ${team.name}?`)) return;

    try {
      const response = await fetch(`${API}/teams/${team.id}`, {
        method: "DELETE",
        headers: authHeaders,
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Failed to delete team.");
        return;
      }

      if (String(selectedTeam) === String(team.id)) {
        setSelectedTeam("");
        setMembers([]);
      }

      await fetchTeams();
      await fetchAuditLogs();

      setMessage("Team deleted successfully!");
    } catch {
      setMessage("Could not delete team.");
    }
  };


  // ASSIGN USER TO TEAM
  const handleAssignMember = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      const response = await fetch(`${API}/team-members/`, {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: Number(assignment.user_id),
          team_id: Number(assignment.team_id),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Failed to assign team member.");
        return;
      }

      setSelectedTeam(assignment.team_id);

      await fetchMembers(assignment.team_id);
      await fetchAuditLogs();

      setAssignment({
        user_id: "",
        team_id: assignment.team_id,
      });

      setMessage("User assigned to team successfully!");
    } catch {
      setMessage("Could not assign team member.");
    }
  };


  // REMOVE TEAM MEMBER
  const handleRemoveMember = async (member) => {
    if (!window.confirm("Remove this user from the team?")) return;

    try {
      const response = await fetch(
        `${API}/team-members/${member.team_id}/${member.user_id}`,
        {
          method: "DELETE",
          headers: authHeaders,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Failed to remove team member.");
        return;
      }

      await fetchMembers(member.team_id);
      await fetchAuditLogs();

      setMessage("Team member removed successfully!");
    } catch {
      setMessage("Could not remove team member.");
    }
  };


  // REFRESH ADMIN DATA
  const handleRefresh = async () => {
    setRefreshing(true);

    const tasks = [
      fetchTeams(),
      selectedTeam
        ? fetchMembers(selectedTeam)
        : Promise.resolve(),
    ];

    if (isAdmin) {
      tasks.push(fetchUsers());
      tasks.push(fetchAuditLogs());
    }

    await Promise.all(tasks);

    setRefreshing(false);
    setMessage("Dashboard data refreshed!");
  };


  // LOGOUT
  const handleLogout = () => {
    localStorage.removeItem("access_token");

    setToken("");
    setUsers([]);
    setTeams([]);
    setMembers([]);
    setAuditLogs([]);

    setEmail("");
    setPassword("");
    setMessage("");

    setActiveSection("users");
    setSelectedTeam("");
  };


  // USER SEARCH AND FILTER
  const filteredUsers = users.filter((user) => {
    const search = searchTerm.toLowerCase();

    const matchesSearch =
      user.full_name.toLowerCase().includes(search) ||
      user.email.toLowerCase().includes(search);

    const matchesRole =
      roleFilter === "all" ||
      String(user.role_id) === roleFilter;

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && user.is_active) ||
      (statusFilter === "inactive" && !user.is_active);

    return matchesSearch && matchesRole && matchesStatus;
  });

  const activeUsers = users.filter(
    (user) => user.is_active
  ).length;


  // LOGIN PAGE
  if (!token) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="brand-icon">🛡️</div>

          <h1>NetShield AI</h1>

          <p className="subtitle">
            Network Security Management
          </p>

          <h2>Sign In</h2>

          <p className="description">
            Sign in to access your dashboard
          </p>

          <form onSubmit={handleLogin}>
            <label>Email Address</label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />

            <label>Password</label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />

            <button type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Login"}
            </button>
          </form>

          {message && (
            <p className="login-message">{message}</p>
          )}

          <p className="footer-text">
            NetShield AI - User Management Module
          </p>
        </div>
      </div>
    );
  }


  // ROLE-SPECIFIC DASHBOARDS FOR ANALYST AND VIEWER
  if (!isAdmin) {
    const hasValidRole = roleId === 2 || roleId === 3;

    const refreshReadOnlyData = async () => {
      setRefreshing(true);

      await fetchTeams();

      if (selectedTeam) {
        await fetchMembers(selectedTeam);
      }

      setRefreshing(false);
      setMessage("Team information refreshed.");
    };

    return (
      <div className="dashboard">
        <header className="dashboard-header">
          <h1>🛡️ NetShield AI</h1>

          <div className="header-actions">
            {hasValidRole && (
              <button
                onClick={refreshReadOnlyData}
                disabled={refreshing}
              >
                {refreshing ? "Refreshing..." : "↻ Refresh"}
              </button>
            )}

            <button onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>

        <main className="dashboard-content">
          {!hasValidRole ? (
            <section className="users-section">
              <h2>Session Update Required</h2>

              <p>
                Your saved login session does not contain role information.
                Please log out and sign in again.
              </p>

              <button onClick={handleLogout}>
                Log Out and Sign In Again
              </button>
            </section>
          ) : (
            <>
              <h2>{roleName} Dashboard</h2>

              <p>
                Network Security Management Platform
              </p>

              {message && (
                <p className="dashboard-message">{message}</p>
              )}

              <div className="dashboard-stats">
                <div className="stat-card">
                  <h3>Signed-in Role</h3>
                  <p>{roleName}</p>
                </div>

                <div className="stat-card">
                  <h3>Teams Available</h3>
                  <p>{teams.length}</p>
                </div>

                <div className="stat-card">
                  <h3>Selected Team Members</h3>
                  <p>{members.length}</p>
                </div>
              </div>

              <section className="users-section">
                <h2>
                  {roleId === 2
                    ? "My Assigned Teams"
                    : "Team Directory"}
                </h2>

                <p>
                  {roleId === 2
                    ? "You can view only teams to which your account has been assigned."
                    : "You have read-only access to team and membership information."}
                </p>

                <label>Select Team</label>

                <select
                  className="team-selector"
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                >
                  <option value="">Choose a team</option>

                  {teams.map((team) => (
                    <option
                      key={team.id}
                      value={team.id}
                    >
                      {team.name}
                    </option>
                  ))}
                </select>

                {selectedTeam && (
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>User ID</th>
                          <th>Full Name</th>
                          <th>Email Address</th>
                          <th>Joined At</th>
                        </tr>
                      </thead>

                      <tbody>
                        {members.map((member) => (
                          <tr key={member.id}>
                            <td>{member.user_id}</td>
                            <td>{member.user_full_name || `User #${member.user_id}`}</td>
                            <td>{member.user_email || "-"}</td>
                            <td>
                              {member.joined_at
                                ? new Date(
                                    member.joined_at
                                  ).toLocaleString()
                                : "-"}
                            </td>
                          </tr>
                        ))}

                        {members.length === 0 && (
                          <tr>
                            <td colSpan="4">
                              No members found in this team.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {teams.length === 0 && (
                  <p>
                    No teams are currently available to your account.
                  </p>
                )}
              </section>
            </>
          )}
        </main>
      </div>
    );
  }


  // ADMIN DASHBOARD
  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>🛡️ NetShield AI</h1>

        <div className="header-actions">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "↻ Refresh"}
          </button>

          <button onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-content">
        <h2>Admin Dashboard</h2>

        <p>
          Network Security Management Platform
        </p>

        {message && (
          <p className="dashboard-message">{message}</p>
        )}


        {/* DASHBOARD STATISTICS */}
        <div className="dashboard-stats">
          <div className="stat-card">
            <h3>Total Users</h3>
            <p>{users.length}</p>
          </div>

          <div className="stat-card">
            <h3>Active Users</h3>
            <p>{activeUsers}</p>
          </div>

          <div className="stat-card">
            <h3>Total Teams</h3>
            <p>{teams.length}</p>
          </div>

          <div className="stat-card">
            <h3>Audit Records</h3>
            <p>{auditLogs.length}</p>
          </div>
        </div>


        {/* DASHBOARD NAVIGATION */}
        <div className="dashboard-nav">
          <button
            className={
              activeSection === "users" ? "nav-active" : ""
            }
            onClick={() => setActiveSection("users")}
          >
            User Management
          </button>

          <button
            className={
              activeSection === "teams" ? "nav-active" : ""
            }
            onClick={() => setActiveSection("teams")}
          >
            Team Management
          </button>

          <button
            className={
              activeSection === "audit" ? "nav-active" : ""
            }
            onClick={() => setActiveSection("audit")}
          >
            Audit Logs
          </button>
        </div>


        {/* USER MANAGEMENT */}
        {activeSection === "users" && (
          <>
            <section className="users-section">
              <h2>Create New User</h2>

              <form
                className="create-user-form"
                onSubmit={handleCreateUser}
              >
                <label>Full Name</label>

                <input
                  value={newUser.full_name}
                  onChange={(e) =>
                    setNewUser({
                      ...newUser,
                      full_name: e.target.value,
                    })
                  }
                  placeholder="Enter full name"
                  required
                />

                <label>Email Address</label>

                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) =>
                    setNewUser({
                      ...newUser,
                      email: e.target.value,
                    })
                  }
                  placeholder="Enter email"
                  required
                />

                <label>Password</label>

                <input
                  type="password"
                  minLength={8}
                  value={newUser.password}
                  onChange={(e) =>
                    setNewUser({
                      ...newUser,
                      password: e.target.value,
                    })
                  }
                  placeholder="Create password"
                  required
                />

                <label>Role</label>

                <select
                  value={newUser.role_id}
                  onChange={(e) =>
                    setNewUser({
                      ...newUser,
                      role_id: e.target.value,
                    })
                  }
                >
                  <option value="1">Admin</option>
                  <option value="2">Analyst</option>
                  <option value="3">Viewer</option>
                </select>

                <button type="submit">
                  Create User
                </button>
              </form>
            </section>


            <section className="users-section">
              <h2>User Management</h2>

              <div className="user-filters">
                <input
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />

                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                >
                  <option value="all">All Roles</option>
                  <option value="1">Admin</option>
                  <option value="2">Analyst</option>
                  <option value="3">Viewer</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <p className="results-count">
                Showing {filteredUsers.length} of {users.length} users
              </p>

              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Full Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.id}>
                        <td>{user.id}</td>
                        <td>{user.full_name}</td>
                        <td>{user.email}</td>
                        <td>{getRoleName(user.role_id)}</td>

                        <td>
                          {user.is_active
                            ? "Active"
                            : "Inactive"}
                        </td>

                        <td>
                          <button
                            onClick={() => handleEditUser(user)}
                          >
                            Edit
                          </button>

                          <button
                            className="delete-button"
                            onClick={() => handleDeleteUser(user)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}

                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan="6">
                          No matching users found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}


        {/* TEAM MANAGEMENT */}
        {activeSection === "teams" && (
          <>
            <section className="users-section">
              <h2>Create New Team</h2>

              <form
                className="create-user-form"
                onSubmit={handleCreateTeam}
              >
                <label>Team Name</label>

                <input
                  value={newTeam.name}
                  onChange={(e) =>
                    setNewTeam({
                      ...newTeam,
                      name: e.target.value,
                    })
                  }
                  placeholder="Enter team name"
                  minLength={2}
                  required
                />

                <label>Description</label>

                <textarea
                  value={newTeam.description}
                  onChange={(e) =>
                    setNewTeam({
                      ...newTeam,
                      description: e.target.value,
                    })
                  }
                  placeholder="Enter team description"
                  rows={3}
                />

                <button type="submit">
                  Create Team
                </button>
              </form>
            </section>


            <section className="users-section">
              <h2>Existing Teams</h2>

              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Team Name</th>
                      <th>Description</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {teams.map((team) => (
                      <tr key={team.id}>
                        <td>{team.id}</td>
                        <td>{team.name}</td>
                        <td>{team.description || "-"}</td>

                        <td>
                          {team.is_active ? "Active" : "Inactive"}
                        </td>

                        <td>
                          <button
                            onClick={() => handleEditTeam(team)}
                          >
                            Edit
                          </button>

                          <button
                            className="delete-button"
                            onClick={() => handleDeleteTeam(team)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}

                    {teams.length === 0 && (
                      <tr>
                        <td colSpan="5">
                          No teams found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>


            {/* TEAM MEMBER ASSIGNMENT */}
            <section className="users-section">
              <h2>Assign User to Team</h2>

              <form
                className="create-user-form"
                onSubmit={handleAssignMember}
              >
                <label>Select User</label>

                <select
                  value={assignment.user_id}
                  onChange={(e) =>
                    setAssignment({
                      ...assignment,
                      user_id: e.target.value,
                    })
                  }
                  required
                >
                  <option value="">Choose a user</option>

                  {users
                    .filter((user) => user.is_active)
                    .map((user) => (
                      <option
                        key={user.id}
                        value={user.id}
                      >
                        {user.full_name} ({user.email})
                      </option>
                    ))}
                </select>

                <label>Select Team</label>

                <select
                  value={assignment.team_id}
                  onChange={(e) => {
                    setAssignment({
                      ...assignment,
                      team_id: e.target.value,
                    });

                    setSelectedTeam(e.target.value);
                  }}
                  required
                >
                  <option value="">Choose a team</option>

                  {teams
                    .filter((team) => team.is_active)
                    .map((team) => (
                      <option
                        key={team.id}
                        value={team.id}
                      >
                        {team.name}
                      </option>
                    ))}
                </select>

                <button type="submit">
                  Assign Member
                </button>
              </form>
            </section>


            {/* VIEW TEAM MEMBERS */}
            <section className="users-section">
              <h2>Team Members</h2>

              <label>Select Team to View Members</label>

              <select
                className="team-selector"
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
              >
                <option value="">Choose a team</option>

                {teams.map((team) => (
                  <option
                    key={team.id}
                    value={team.id}
                  >
                    {team.name}
                  </option>
                ))}
              </select>

              {selectedTeam && (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>User ID</th>
                        <th>User Name</th>
                        <th>Email</th>
                        <th>Action</th>
                      </tr>
                    </thead>

                    <tbody>
                      {members.map((member) => {
                        const memberUser = users.find(
                          (user) => user.id === member.user_id
                        );

                        return (
                          <tr key={member.id}>
                            <td>{member.user_id}</td>

                            <td>
                              {member.user_full_name ||
                                memberUser?.full_name ||
                                "User not found"}
                            </td>

                            <td>
                              {member.user_email ||
                                memberUser?.email ||
                                "-"}
                            </td>

                            <td>
                              <button
                                className="delete-button"
                                onClick={() => handleRemoveMember(member)}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        );
                      })}

                      {members.length === 0 && (
                        <tr>
                          <td colSpan="4">
                            No members in this team.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}


        {/* AUDIT LOGS */}
        {activeSection === "audit" && (
          <section className="users-section">
            <div className="user-management-heading">
              <h2>System Audit Logs</h2>

              <button onClick={fetchAuditLogs}>
                ↻ Refresh Logs
              </button>
            </div>

            <p className="results-count">
              Total audit records: {auditLogs.length}
            </p>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>User ID</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Description</th>
                    <th>IP Address</th>
                    <th>Date & Time</th>
                  </tr>
                </thead>

                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{log.id}</td>
                      <td>{log.user_id ?? "System"}</td>
                      <td>{log.action}</td>

                      <td>
                        {log.entity_type}
                        {log.entity_id
                          ? ` #${log.entity_id}`
                          : ""}
                      </td>

                      <td>{log.description || "-"}</td>
                      <td>{log.ip_address || "-"}</td>

                      <td>
                        {log.created_at
                          ? new Date(log.created_at).toLocaleString()
                          : "-"}
                      </td>
                    </tr>
                  ))}

                  {auditLogs.length === 0 && (
                    <tr>
                      <td colSpan="7">
                        No audit records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;