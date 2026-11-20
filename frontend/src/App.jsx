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
  const [authMode, setAuthMode] = useState("login");
  const [registration, setRegistration] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "Analyst",
  });

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

  // Live network monitoring (Admin-only).
  const [networkStatus, setNetworkStatus] = useState(null);
  const [networkSummary, setNetworkSummary] = useState(null);
  const [networkPackets, setNetworkPackets] = useState([]);
  const [networkError, setNetworkError] = useState("");
  const [networkMinutes, setNetworkMinutes] = useState("15");
  const [networkProtocol, setNetworkProtocol] = useState("");
  const [networkIpFilter, setNetworkIpFilter] = useState("");
  const [networkPortFilter, setNetworkPortFilter] = useState("");

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


  // PUBLIC REGISTRATION - ANALYST OR VIEWER ONLY
  const handleRegister = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registration),
      });

      const data = await response.json();
      if (!response.ok) {
        setMessage(data.detail || "Registration failed.");
        return;
      }

      setEmail(registration.email);
      setPassword("");
      setRegistration({ full_name: "", email: "", password: "", role: "Analyst" });
      setAuthMode("login");
      setMessage("Account created successfully. Please sign in.");
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


  // FETCH LIVE NETWORK DATA - ADMIN ONLY
  const fetchNetworkData = useCallback(async () => {
    if (!token || !isAdmin) return;

    try {
      const params = new URLSearchParams({ minutes: networkMinutes });
      if (networkProtocol) params.set("protocol", networkProtocol);
      if (networkIpFilter.trim()) params.set("ip", networkIpFilter.trim());
      if (networkPortFilter.trim()) params.set("port", networkPortFilter.trim());

      const headers = { Authorization: `Bearer ${token}` };
      const [statusResponse, summaryResponse, packetsResponse] = await Promise.all([
        fetch(`${API}/network/status`, { headers }),
        fetch(`${API}/network/summary?minutes=${networkMinutes}`, { headers }),
        fetch(`${API}/network/packets?${params.toString()}`, { headers }),
      ]);

      const statusData = await statusResponse.json();
      const summaryData = await summaryResponse.json();
      const packetsData = await packetsResponse.json();

      if (!statusResponse.ok) {
        throw new Error(statusData.detail || "Unable to start network capture.");
      }
      if (!summaryResponse.ok) {
        throw new Error(summaryData.detail || "Unable to load network summary.");
      }
      if (!packetsResponse.ok) {
        throw new Error(packetsData.detail || "Unable to load captured packets.");
      }

      setNetworkStatus(statusData);
      setNetworkSummary(summaryData);
      setNetworkPackets(packetsData);
      setNetworkError(statusData.running ? "" : (statusData.error || "Capture is not running."));
    } catch (error) {
      setNetworkError(error.message || "Network monitoring service is unavailable.");
    }
  }, [token, isAdmin, networkMinutes, networkProtocol, networkIpFilter, networkPortFilter]);


  // Refresh network statistics while the Admin is viewing Network Monitoring.
  useEffect(() => {
    if (!token || !isAdmin || activeSection !== "network") return undefined;

    fetchNetworkData();
    const intervalId = window.setInterval(fetchNetworkData, 5000);
    return () => window.clearInterval(intervalId);
  }, [token, isAdmin, activeSection, fetchNetworkData]);


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


  // LOGIN AND PUBLIC REGISTRATION PAGE
  if (!token) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="brand-icon">🛡️</div>
          <h1>NetShield AI</h1>
          <p className="subtitle">Network Security Management</p>

          <div className="auth-tabs">
            <button
              type="button"
              className={authMode === "login" ? "auth-tab active" : "auth-tab"}
              onClick={() => { setAuthMode("login"); setMessage(""); }}
            >Sign In</button>
            <button
              type="button"
              className={authMode === "register" ? "auth-tab active" : "auth-tab"}
              onClick={() => { setAuthMode("register"); setMessage(""); }}
            >Register</button>
          </div>

          {authMode === "login" ? (
            <>
              <h2>Sign In</h2>
              <p className="description">Sign in to access your dashboard</p>
              <form onSubmit={handleLogin}>
                <label>Email Address</label>
                <input type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email" required />
                <label>Password</label>
                <input type="password" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password" required />
                <button type="submit" disabled={loading}>
                  {loading ? "Signing in..." : "Login"}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2>Create Account</h2>
              <p className="description">Register as an Analyst or Viewer</p>
              <form onSubmit={handleRegister}>
                <label>Full Name</label>
                <input type="text" minLength={2} maxLength={100}
                  value={registration.full_name}
                  onChange={(e) => setRegistration({ ...registration, full_name: e.target.value })}
                  placeholder="Enter your full name" required />
                <label>Email Address</label>
                <input type="email" value={registration.email}
                  onChange={(e) => setRegistration({ ...registration, email: e.target.value })}
                  placeholder="Enter your email" required />
                <label>Password</label>
                <input type="password" minLength={8} maxLength={128}
                  value={registration.password}
                  onChange={(e) => setRegistration({ ...registration, password: e.target.value })}
                  placeholder="Create a password (minimum 8 characters)" required />
                <label>Choose Role</label>
                <select value={registration.role}
                  onChange={(e) => setRegistration({ ...registration, role: e.target.value })}
                  required>
                  <option value="Analyst">Analyst</option>
                  <option value="Viewer">Viewer</option>
                </select>
                <button type="submit" disabled={loading}>
                  {loading ? "Creating account..." : "Create Account"}
                </button>
              </form>
            </>
          )}

          {message && <p className="login-message">{message}</p>}
          <p className="footer-text">NetShield AI - Network Security Management</p>
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

          <button
            className={activeSection === "network" ? "nav-active" : ""}
            onClick={() => setActiveSection("network")}
          >
            Network Monitoring
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

        {/* LIVE NETWORK MONITORING */}
        {activeSection === "network" && (
          <section className="network-page">
            <div className="network-heading">
              <div>
                <h2>Live Network Monitoring</h2>
                <p>Real Wi-Fi traffic captured through the Wireshark TShark engine.</p>
              </div>
              <div className="network-controls">
                <label htmlFor="network-window">Time window</label>
                <select id="network-window" value={networkMinutes}
                  onChange={(e) => setNetworkMinutes(e.target.value)}>
                  <option value="15">Last 15 minutes</option>
                  <option value="30">Last 30 minutes</option>
                  <option value="60">Last 1 hour</option>
                  <option value="1440">Last 24 hours</option>
                </select>
                <button type="button" onClick={fetchNetworkData}>Refresh</button>
              </div>
            </div>

            <div className="capture-status">
              <span className={networkStatus?.running ? "live-dot" : "offline-dot"} />
              <strong>{networkStatus?.running ? "LIVE CAPTURE RUNNING" : "CAPTURE NOT RUNNING"}</strong>
              <span>{networkStatus?.interface ? `Interface: ${networkStatus.interface}` : "Waiting for capture interface"}</span>
              {networkStatus?.packets_buffered !== undefined && (
                <span>{networkStatus.packets_buffered.toLocaleString()} packets buffered</span>
              )}
            </div>

            {networkError && (
              <div className="network-error">
                <strong>Capture status:</strong> {networkError}
                <p>Check that Wireshark/Npcap is installed and that the backend has permission to capture packets.</p>
              </div>
            )}

            <div className="network-stats-grid">
              <div className="network-stat-card"><span>Total Packets</span>
                <strong>{networkSummary?.total_packets?.toLocaleString() ?? "—"}</strong>
                <small>In selected time window</small></div>
              <div className="network-stat-card"><span>Total Traffic</span>
                <strong>{networkSummary ? `${(networkSummary.total_bytes / 1024).toFixed(1)} KB` : "—"}</strong>
                <small>Captured packet bytes</small></div>
              <div className="network-stat-card"><span>Active IP Addresses</span>
                <strong>{networkSummary?.active_ips ?? "—"}</strong>
                <small>Unique source and destination IPs</small></div>
              <div className="network-stat-card"><span>Protocols Observed</span>
                <strong>{networkSummary?.protocols?.length ?? "—"}</strong>
                <small>Classified packet protocols</small></div>
            </div>

            <div className="network-two-column">
              <div className="network-panel">
                <h3>Traffic Activity</h3>
                <p className="network-muted">Packet count per time interval</p>
                <div className="traffic-chart">
                  {(networkSummary?.traffic_timeline || []).map((bucket, index) => {
                    const peak = Math.max(1, ...(networkSummary?.traffic_timeline || []).map((item) => item.packets));
                    return (
                      <div className="traffic-bar-column" key={`${bucket.time}-${index}`}>
                        <div className="traffic-bar-value">{bucket.packets}</div>
                        <div className="traffic-bar-track">
                          <div className="traffic-bar" style={{ height: `${Math.max(3, (bucket.packets / peak) * 100)}%` }} />
                        </div>
                        <small>{bucket.time}</small>
                      </div>
                    );
                  })}
                  {!networkSummary?.traffic_timeline?.length && <p className="network-empty">Waiting for packet activity…</p>}
                </div>
              </div>

              <div className="network-panel">
                <h3>Protocol Distribution</h3>
                <div className="table-container"><table>
                  <thead><tr><th>Protocol</th><th>Packets</th></tr></thead>
                  <tbody>
                    {(networkSummary?.protocols || []).map((item) => (
                      <tr key={item.protocol}><td>{item.protocol}</td><td>{item.packets}</td></tr>
                    ))}
                    {!networkSummary?.protocols?.length && <tr><td colSpan="2">No packets captured yet.</td></tr>}
                  </tbody>
                </table></div>
              </div>
            </div>

            <div className="network-two-column">
              <div className="network-panel"><h3>Top Source IP Addresses</h3><div className="table-container"><table>
                <thead><tr><th>Source IP</th><th>Packets</th></tr></thead>
                <tbody>
                  {(networkSummary?.top_sources || []).map((item) => <tr key={item.ip}><td>{item.ip}</td><td>{item.packets}</td></tr>)}
                  {!networkSummary?.top_sources?.length && <tr><td colSpan="2">No source data yet.</td></tr>}
                </tbody>
              </table></div></div>
              <div className="network-panel"><h3>Top Destination IP Addresses</h3><div className="table-container"><table>
                <thead><tr><th>Destination IP</th><th>Packets</th></tr></thead>
                <tbody>
                  {(networkSummary?.top_destinations || []).map((item) => <tr key={item.ip}><td>{item.ip}</td><td>{item.packets}</td></tr>)}
                  {!networkSummary?.top_destinations?.length && <tr><td colSpan="2">No destination data yet.</td></tr>}
                </tbody>
              </table></div></div>
            </div>

            <div className="network-panel">
              <div className="network-heading">
                <div><h3>Recent Captured Packets</h3><p className="network-muted">Live packet details from your network interface</p></div>
                <div className="network-filters">
                  <input aria-label="Filter by IP address" placeholder="Filter IP" value={networkIpFilter}
                    onChange={(e) => setNetworkIpFilter(e.target.value)} />
                  <input aria-label="Filter by port" placeholder="Port" value={networkPortFilter}
                    onChange={(e) => setNetworkPortFilter(e.target.value)} />
                  <select aria-label="Filter by protocol" value={networkProtocol}
                    onChange={(e) => setNetworkProtocol(e.target.value)}>
                    <option value="">All protocols</option>
                    {["TCP", "UDP", "TLS", "DNS", "HTTP", "ICMP", "ICMPV6", "ARP"].map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </div>
              </div>
              <div className="table-container"><table>
                <thead><tr><th>Time</th><th>Source IP</th><th>Destination IP</th><th>Source Port</th><th>Destination Port</th><th>Protocol</th><th>Size</th><th>Direction</th></tr></thead>
                <tbody>
                  {networkPackets.map((packet, index) => (
                    <tr key={`${packet.timestamp}-${index}`}>
                      <td>{new Date(packet.timestamp * 1000).toLocaleTimeString()}</td>
                      <td>{packet.source_ip}</td><td>{packet.destination_ip}</td>
                      <td>{packet.source_port}</td><td>{packet.destination_port}</td>
                      <td>{packet.protocol}</td><td>{packet.bytes} B</td><td>{packet.direction}</td>
                    </tr>
                  ))}
                  {!networkPackets.length && <tr><td colSpan="8">No packets match the selected filters yet.</td></tr>}
                </tbody>
              </table></div>
            </div>

            <div className="network-alert-panel">
              <div><strong>SIMULATED DEMO ALERT</strong><span>Example suspicious-traffic alert for interface demonstration only.</span></div>
              <span className="simulated-label">SIMULATED — NOT DETECTED</span>
            </div>
            <p className="network-footnote">
              Capture is a live packet feed. Up to 10,000 recent packets are retained in memory.
              The 24-hour filter covers the current capture session only, not traffic from before capture started.
              The simulated alert is excluded from all traffic metrics.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;