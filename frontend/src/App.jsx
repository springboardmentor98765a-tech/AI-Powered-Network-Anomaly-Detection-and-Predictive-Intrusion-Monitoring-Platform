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


// Summarize captured packet observations into network flows for behavior analysis.
// This is descriptive aggregation, not anomaly detection.
const buildBehaviorFlows = (packets) => {
  const flows = new Map();
  for (const packet of packets || []) {
    const key = [
      packet.source_ip, packet.destination_ip, packet.protocol,
      packet.source_port, packet.destination_port,
    ].join("|");
    const current = flows.get(key) || {
      source_ip: packet.source_ip, destination_ip: packet.destination_ip,
      protocol: packet.protocol, source_port: packet.source_port,
      destination_port: packet.destination_port, packets: 0, bytes: 0,
      first_seen: packet.timestamp, last_seen: packet.timestamp,
    };
    current.packets += 1;
    current.bytes += Number(packet.bytes || 0);
    current.first_seen = Math.min(current.first_seen, packet.timestamp);
    current.last_seen = Math.max(current.last_seen, packet.timestamp);
    flows.set(key, current);
  }
  return [...flows.values()]
    .map((flow) => ({
      ...flow,
      duration_seconds: Math.max(0, flow.last_seen - flow.first_seen),
      rate_per_minute: flow.last_seen > flow.first_seen
        ? (flow.packets / ((flow.last_seen - flow.first_seen) / 60))
        : flow.packets,
      observation: flow.packets > 1 ? "Repeated flow" : "Single observation",
    }))
    .sort((a, b) => b.packets - a.packets || b.bytes - a.bytes);
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
  const [suspiciousData, setSuspiciousData] = useState(null);
  const [suspiciousError, setSuspiciousError] = useState("");
  const [reportDescription, setReportDescription] = useState({});
  const [reportBusy, setReportBusy] = useState("");
  const [reviewNotes, setReviewNotes] = useState({});

  const [selectedTeam, setSelectedTeam] = useState("");
  const [activeSection, setActiveSection] = useState("overview");

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
      setActiveSection(getRoleIdFromToken(data.access_token) === 1 ? "overview" : "teams");
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


  const fetchSuspiciousData = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API}/anomaly/suspicious?minutes=${networkMinutes}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Unable to load suspicious activity.");
      setSuspiciousData(data);
      if (!isAdmin && data.analysis?.recent_packets) {
        setNetworkPackets(data.analysis.recent_packets);
        setNetworkStatus(data.capture_status || null);
        setNetworkError(data.capture_status?.running ? "" : (data.capture_status?.error || "Capture is not running."));
      }
      setSuspiciousError("");
    } catch (error) {
      setSuspiciousError(error.message || "Suspicious activity service unavailable.");
    }
  }, [token, networkMinutes, isAdmin]);

  const saveIpBaseline = async () => {
    try {
      const response = await fetch(`${API}/anomaly/baseline`, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ minutes: Number(networkMinutes) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Could not save baseline.");
      setMessage(`IP baseline saved: ${data.ip_count} addresses.`);
      await fetchSuspiciousData();
    } catch (error) { setMessage(error.message); }
  };

  const submitSuspiciousReport = async (ip) => {
    const description = (reportDescription[ip] || "New IP observed in live packet capture.").trim();
    setReportBusy(ip);
    try {
      const response = await fetch(`${API}/anomaly/reports`, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ip, description }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Report failed.");
      setMessage(`Suspicious activity reported for ${ip}.`);
      await fetchSuspiciousData();
    } catch (error) { setMessage(error.message); }
    finally { setReportBusy(""); }
  };

  const reviewSuspiciousReport = async (reportId, action) => {
    const note = (reviewNotes[reportId] || (action === "Dismissed" ? "Reviewed; no action required." : "Reviewed; action initiated.")).trim();
    setReportBusy(reportId);
    try {
      const response = await fetch(`${API}/anomaly/reports/${reportId}`, {
        method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Review action failed.");
      setMessage(`Report ${action.toLowerCase()}.`);
      await fetchSuspiciousData();
    } catch (error) { setMessage(error.message); }
    finally { setReportBusy(""); }
  };

  // Refresh live data for Admin on Network/Anomaly pages and Analyst on Anomaly page.
  useEffect(() => {
    if (!token || (!isAdmin && activeSection !== "anomaly") || !["network", "anomaly"].includes(activeSection)) return undefined;
    if (isAdmin) fetchNetworkData();
    if (activeSection === "anomaly") fetchSuspiciousData();
    const intervalId = window.setInterval(() => {
      if (isAdmin) fetchNetworkData();
      if (activeSection === "anomaly") fetchSuspiciousData();
    }, 5000);
    return () => window.clearInterval(intervalId);
  }, [token, isAdmin, activeSection, fetchNetworkData, fetchSuspiciousData]);


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


  const renderAnomalyDashboard = () => {
    return (
          <section className="network-page behavior-page">
            <div className="network-heading">
              <div>
                <h2>Network Behavior Analysis</h2>
                <p>Technical summary of observed packet flows from the live capture buffer.</p>
              </div>
              <div className="network-controls">
                <label htmlFor="behavior-window">Observation window</label>
                <select id="behavior-window" value={networkMinutes}
                  onChange={(e) => setNetworkMinutes(e.target.value)}>
                  <option value="15">Last 15 minutes</option>
                  <option value="30">Last 30 minutes</option>
                  <option value="60">Last 1 hour</option>
                  <option value="1440">Last 24 hours</option>
                </select>
                <button type="button" onClick={isAdmin ? fetchNetworkData : fetchSuspiciousData}>Refresh</button>
              </div>
            </div>

            <div className="capture-status">
              <span className={networkStatus?.running ? "live-dot" : "offline-dot"} />
              <strong>{networkStatus?.running ? "LIVE CAPTURE RUNNING" : "CAPTURE NOT RUNNING"}</strong>
              <span>{networkStatus?.interface ? `Interface: ${networkStatus.interface}` : "Waiting for capture interface"}</span>
              <span>{networkPackets.length.toLocaleString()} packet records in current view</span>
            </div>

            {networkError && <div className="network-error"><strong>Capture status:</strong> {networkError}</div>}

            <div className="network-stats-grid">
              <div className="network-stat-card"><span>Observed Flows</span><strong>{buildBehaviorFlows(networkPackets).length.toLocaleString()}</strong><small>Grouped by IP, protocol and ports</small></div>
              <div className="network-stat-card"><span>Packet Records</span><strong>{networkPackets.length.toLocaleString()}</strong><small>Records currently returned by capture API</small></div>
              <div className="network-stat-card"><span>Unique Endpoints</span><strong>{new Set(networkPackets.flatMap((p) => [p.source_ip, p.destination_ip]).filter((ip) => ip && ip !== "-")).size}</strong><small>Source and destination addresses</small></div>
              <div className="network-stat-card"><span>Protocols Observed</span><strong>{new Set(networkPackets.map((p) => p.protocol).filter(Boolean)).size}</strong><small>Protocols in current packet sample</small></div>
            </div>

            <div className="network-panel">
              <div className="network-heading behavior-table-heading">
                <div><h3>Observed Network Flow Table</h3><p className="network-muted">Flows are grouped from captured packet records. “Repeated flow” only describes repetition in this sample; it is not a threat verdict.</p></div>
                <div className="network-filters">
                  <input aria-label="Filter behavior table by IP" placeholder="Filter IP" value={networkIpFilter} onChange={(e) => setNetworkIpFilter(e.target.value)} />
                  <input aria-label="Filter behavior table by port" placeholder="Port" value={networkPortFilter} onChange={(e) => setNetworkPortFilter(e.target.value)} />
                  <select aria-label="Filter behavior table by protocol" value={networkProtocol} onChange={(e) => setNetworkProtocol(e.target.value)}>
                    <option value="">All protocols</option>
                    {[...new Set(networkPackets.map((p) => p.protocol).filter(Boolean))].sort().map((proto) => <option key={proto} value={proto}>{proto}</option>)}
                  </select>
                </div>
              </div>
              <div className="table-container">
                <table>
                  <thead><tr><th>Source IP</th><th>Destination IP</th><th>Protocol</th><th>Source Port</th><th>Destination Port</th><th>Packets</th><th>Total Bytes</th><th>Duration (s)</th><th>Rate (pkt/min)</th><th>Last Seen</th><th>Observed Pattern</th></tr></thead>
                  <tbody>
                    {buildBehaviorFlows(networkPackets).map((flow, index) => (
                      <tr key={`${flow.source_ip}-${flow.destination_ip}-${flow.protocol}-${flow.source_port}-${flow.destination_port}-${index}`}>
                        <td>{flow.source_ip}</td><td>{flow.destination_ip}</td><td>{flow.protocol}</td><td>{flow.source_port}</td><td>{flow.destination_port}</td>
                        <td>{flow.packets}</td><td>{flow.bytes.toLocaleString()}</td><td>{flow.duration_seconds.toFixed(2)}</td><td>{flow.rate_per_minute.toFixed(2)}</td>
                        <td>{new Date(flow.last_seen * 1000).toLocaleTimeString()}</td><td>{flow.observation}</td>
                      </tr>
                    ))}
                    {!networkPackets.length && <tr><td colSpan="11">No captured packet records in this window. Check capture status or change filters.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
            <section className="network-panel suspicious-panel">
              <div className="network-heading suspicious-heading">
                <div><h3>Suspicious Activity Detection — New IP Observations</h3><p className="network-muted">Newly observed endpoints are signals for review, not proof of malicious activity.</p></div>
                {isAdmin && <button type="button" onClick={saveIpBaseline}>Save Current IP Baseline</button>}
              </div>
              {suspiciousError && <div className="network-error">{suspiciousError}</div>}
              <div className="network-stats-grid suspicious-kpis">
                <div className="network-stat-card"><span>Baseline IPs</span><strong>{suspiciousData?.baseline_count ?? 0}</strong><small>Persisted baseline</small></div>
                <div className="network-stat-card"><span>Observed IPs</span><strong>{suspiciousData?.observed_count ?? 0}</strong><small>Current window</small></div>
                <div className="network-stat-card"><span>New IPs</span><strong>{suspiciousData?.new_ip_count ?? 0}</strong><small>Not in baseline</small></div>
                <div className="network-stat-card"><span>Reports</span><strong>{suspiciousData?.reports?.length ?? 0}</strong><small>Submitted for review</small></div>
              </div>
              <div className="table-container"><table><thead><tr><th>IP Address</th><th>Packets</th><th>Bytes</th><th>First Seen</th><th>Last Seen</th><th>Severity</th><th>Status</th><th>Report</th></tr></thead>
                <tbody>{(suspiciousData?.new_ips || []).map((item) => <tr key={item.ip}><td>{item.ip}</td><td>{item.packets}</td><td>{item.bytes.toLocaleString()}</td><td>{new Date(item.first_seen * 1000).toLocaleString()}</td><td>{new Date(item.last_seen * 1000).toLocaleString()}</td><td><span className={`risk-badge risk-${item.severity.toLowerCase()}`}>{item.severity}</span></td><td>{item.status}</td><td>{(roleId === 1 || roleId === 2) && item.status === "New" ? <div className="report-cell"><input aria-label={`Report reason for ${item.ip}`} placeholder="Reason (optional)" value={reportDescription[item.ip] || ""} onChange={(e) => setReportDescription((prev) => ({...prev, [item.ip]: e.target.value}))}/><button disabled={reportBusy === item.ip} onClick={() => submitSuspiciousReport(item.ip)}>Report</button></div> : "—"}</td></tr>)}
                {!suspiciousData?.new_ips?.length && <tr><td colSpan="8">No new IPs detected. Save a baseline to enable comparison.</td></tr>}</tbody>
              </table></div>
              <h3 className="review-title">Analyst Reports / Team Lead Review</h3>
              <p className="network-muted">Team Lead review is represented by Admin role in this version because the current RBAC model has no separate Team Lead role.</p>
              <div className="table-container"><table><thead><tr><th>IP</th><th>Reported By</th><th>Description</th><th>Created</th><th>Status</th><th>Review</th></tr></thead><tbody>
                {(suspiciousData?.reports || []).slice().reverse().map((report) => <tr key={report.id}><td>{report.ip}</td><td>{report.reporter_name}</td><td>{report.description}</td><td>{new Date(report.created_at).toLocaleString()}</td><td>{report.status}{report.reviewed_by ? ` by ${report.reviewed_by}` : ""}</td><td>{isAdmin && report.status === "Reported" ? <div className="review-actions"><textarea className="review-note-input" rows="2" placeholder="Admin review note / action taken" value={reviewNotes[report.id] || ""} onChange={(e) => setReviewNotes((prev) => ({...prev, [report.id]: e.target.value}))}/><button disabled={reportBusy === report.id} onClick={() => reviewSuspiciousReport(report.id, "Action Taken")}>Take Action</button><button className="secondary-button" disabled={reportBusy === report.id} onClick={() => reviewSuspiciousReport(report.id, "Dismissed")}>Dismiss</button></div> : report.review_note ? `Admin note: ${report.review_note}` : "Pending review by Admin"}</td></tr>)}
                {!suspiciousData?.reports?.length && <tr><td colSpan="6">No reports submitted yet.</td></tr>}
              </tbody></table></div>
            </section>
            <div className="module2-analytics-grid">
              <section className="network-panel analytics-panel">
                <div className="analytics-title"><div><h3>Pattern Recognition</h3><p className="network-muted">Frequent protocols, destination ports and active source endpoints in the selected capture window.</p></div><span className="chart-tag">LIVE SAMPLE</span></div>
                <div className="pattern-columns">
                  <div className="pattern-chart"><h4>Protocol distribution</h4>{(suspiciousData?.analysis?.protocols || []).map((item, i) => { const max = Math.max(1, ...(suspiciousData?.analysis?.protocols || []).map(x => x.count)); return <div className="chart-row" key={item.name}><span>{item.name}</span><div className="chart-track"><div className={`chart-fill color-${i % 5}`} style={{width:`${Math.max(3,item.count/max*100)}%`}}/></div><b>{item.count}</b></div>; })}{!suspiciousData?.analysis?.protocols?.length && <p className="network-muted">Waiting for packets.</p>}</div>
                  <div className="pattern-chart"><h4>Top destination ports</h4>{(suspiciousData?.analysis?.destination_ports || []).map((item, i) => { const max = Math.max(1, ...(suspiciousData?.analysis?.destination_ports || []).map(x => x.count)); return <div className="chart-row" key={item.port}><span>{item.port}</span><div className="chart-track"><div className={`chart-fill color-${(i+2) % 5}`} style={{width:`${Math.max(3,item.count/max*100)}%`}}/></div><b>{item.count}</b></div>; })}{!suspiciousData?.analysis?.destination_ports?.length && <p className="network-muted">Waiting for packets.</p>}</div>
                </div>
                <div className="top-source-strip"><h4>Top talkers</h4>{(suspiciousData?.analysis?.top_sources || []).slice(0,5).map((item,i)=><div className="talker-chip" key={item.ip}><span className={`talker-dot color-${i%5}`}/><span>{item.ip}</span><strong>{item.count} pkts</strong></div>)}</div>
              </section>
              <section className="network-panel classification-panel">
                <div className="analytics-title"><div><h3>Anomaly Classification</h3><p className="network-muted">Transparent heuristic scoring; findings are signals for human review, not confirmed attacks.</p></div><span className="chart-tag purple">RULE ENGINE</span></div>
                <div className="classification-kpis">{[ ["Low","risk-low"], ["Medium","risk-medium"], ["High","risk-high"], ["Critical","risk-critical"] ].map(([level, cls])=><div className="classification-card" key={level}><span className={`risk-badge ${cls}`}>{level}</span><strong>{suspiciousData?.analysis?.severity_counts?.[level] ?? 0}</strong></div>)}</div>
                <div className="classification-meter"><div className="meter-segment low" style={{flex:suspiciousData?.analysis?.severity_counts?.Low || 0}}/><div className="meter-segment medium" style={{flex:suspiciousData?.analysis?.severity_counts?.Medium || 0}}/><div className="meter-segment high" style={{flex:suspiciousData?.analysis?.severity_counts?.High || 0}}/><div className="meter-segment critical" style={{flex:suspiciousData?.analysis?.severity_counts?.Critical || 0}}/></div>
                <div className="classification-note">Analyzed <strong>{suspiciousData?.analysis?.packets_analyzed ?? 0}</strong> packets · Score bands: Low 0–19, Medium 20–39, High 40–69, Critical 70–100.</div>
              </section>
            </div>
            <section className="network-panel findings-panel">
              <div className="analytics-title"><div><h3>Suspicious Pattern Findings</h3><p className="network-muted">Evidence-based rules: port breadth, repeated flow volume and high packet-volume sources.</p></div><span className="chart-tag amber">REVIEW REQUIRED</span></div>
              <div className="table-container"><table><thead><tr><th>Source IP</th><th>Pattern</th><th>Score</th><th>Severity</th><th>Evidence</th><th>Classification</th></tr></thead><tbody>
                {(suspiciousData?.analysis?.findings || []).map(f=><tr key={f.source_ip}><td>{f.source_ip}</td><td>{f.categories.join(" · ")}</td><td><div className="score-pill"><span style={{width:`${f.score}%`}}/>{f.score}/100</div></td><td><span className={`risk-badge risk-${f.severity.toLowerCase()}`}>{f.severity}</span></td><td>{f.evidence.join("; ")}</td><td>{f.classification}</td></tr>)}
                {!suspiciousData?.analysis?.findings?.length && <tr><td colSpan="6">No rule-based findings in the current capture window. This is not a guarantee that traffic is benign.</td></tr>}
              </tbody></table></div>
            </section>
            <p className="network-footnote">Task 2–4: new IP observations and reports; pattern recognition summarizes communication behavior; anomaly classification uses transparent heuristic rules. These rules are not a trained ML model and should be tuned against your network baseline.</p>
          </section>
    );
  };

  // ROLE-SPECIFIC DASHBOARDS FOR ANALYST AND VIEWER
  if (!isAdmin) {
    const hasValidRole = roleId === 2 || roleId === 3;
    const refreshReadOnlyData = async () => { setRefreshing(true); await fetchTeams(); if (selectedTeam) await fetchMembers(selectedTeam); setRefreshing(false); setMessage("Team information refreshed."); };
    const analystCanAccessAnomaly = roleId === 2;
    return (
      <div className="dashboard sidebar-dashboard">
        <header className="dashboard-header">
          <div className="brand-lockup"><span className="brand-shield">◆</span><div><h1>NetShield AI</h1><small>Network Security Operations</small></div></div>
          <div className="header-actions"><span className="user-role-pill">{roleName}</span>{hasValidRole && <button className="header-secondary" onClick={refreshReadOnlyData} disabled={refreshing}>{refreshing ? "Refreshing..." : "Refresh"}</button>}<button onClick={handleLogout}>Logout</button></div>
        </header>
        <div className="dashboard-shell">
          <aside className="app-sidebar">
            <div className="sidebar-label">WORKSPACE</div>
            <button className={`sidebar-link ${activeSection === "teams" ? "sidebar-active" : ""}`} onClick={() => setActiveSection("teams")}><span className="nav-icon">▦</span><span>Team Directory</span></button>
            {analystCanAccessAnomaly && <button className={`sidebar-link ${activeSection === "anomaly" ? "sidebar-active" : ""}`} onClick={() => setActiveSection("anomaly")}><span className="nav-icon">◈</span><span>Anomaly Detection</span><span className="sidebar-badge">Live</span></button>}
            <div className="sidebar-footer"><div className="sidebar-user-dot">{(roleName || "U").slice(0,1).toUpperCase()}</div><div><strong>{roleName}</strong><small>{roleName} access</small></div></div>
          </aside>
          <main className="dashboard-content sidebar-content">
            {!hasValidRole ? <section className="users-section"><h2>Session Update Required</h2><p>Your saved login session does not contain role information. Please log out and sign in again.</p><button onClick={handleLogout}>Log Out and Sign In Again</button></section> : (
              <>
                <div className="page-title-row"><div><span className="eyebrow">SECURITY WORKSPACE</span><h2>{activeSection === "anomaly" ? "Anomaly Detection" : "Team Directory"}</h2><p>{activeSection === "anomaly" ? "Shared monitoring, suspicious observations, analyst reports and review status." : "Access your team membership and directory information."}</p></div><span className="role-tag role-analyst">{roleName}</span></div>
                {message && <p className="dashboard-message">{message}</p>}
                {activeSection === "teams" && <section className="users-section"><h2>{roleId === 2 ? "My Assigned Teams" : "Team Directory"}</h2><p>{roleId === 2 ? "You can view only teams to which your account has been assigned." : "You have read-only access to team and membership information."}</p><label>Select Team</label><select className="team-selector" value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)}><option value="">Choose a team</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select>{selectedTeam && <div className="table-container"><table><thead><tr><th>User ID</th><th>Full Name</th><th>Email Address</th><th>Joined At</th></tr></thead><tbody>{members.map((member) => <tr key={member.id}><td>{member.user_id}</td><td>{member.user_full_name || `User #${member.user_id}`}</td><td>{member.user_email || "-"}</td><td>{member.joined_at ? new Date(member.joined_at).toLocaleString() : "-"}</td></tr>)}{members.length === 0 && <tr><td colSpan="4">No members found in this team.</td></tr>}</tbody></table></div>}{teams.length === 0 && <p>No teams are currently available to your account.</p>}</section>}
                {activeSection === "anomaly" && analystCanAccessAnomaly && renderAnomalyDashboard()}
              </>
            )}
          </main>
        </div>
      </div>
    );
  }

  // ADMIN DASHBOARD
  return (
    <div className="dashboard sidebar-dashboard">
      <header className="dashboard-header">
        <div className="brand-lockup"><span className="brand-shield">◆</span><div><h1>NetShield AI</h1><small>Network Security Operations</small></div></div>

        <div className="header-actions">
          <span className="user-role-pill">Administrator</span>
          <button className="header-secondary"
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

      <div className="dashboard-shell">
        <aside className="app-sidebar">
          <div className="sidebar-label">ADMIN WORKSPACE</div>
          <button className={`sidebar-link ${activeSection === "overview" ? "sidebar-active" : ""}`} onClick={() => setActiveSection("overview")}><span className="nav-icon">⌂</span><span>Overview</span></button>
          <div className="sidebar-label">MANAGEMENT</div>
          <button className={`sidebar-link ${activeSection === "users" ? "sidebar-active" : ""}`} onClick={() => setActiveSection("users")}><span className="nav-icon">♙</span><span>User Management</span></button>
          <button className={`sidebar-link ${activeSection === "teams" ? "sidebar-active" : ""}`} onClick={() => setActiveSection("teams")}><span className="nav-icon">▦</span><span>Team Management</span></button>
          <button className={`sidebar-link ${activeSection === "audit" ? "sidebar-active" : ""}`} onClick={() => setActiveSection("audit")}><span className="nav-icon">≡</span><span>Audit Logs</span></button>
          <div className="sidebar-label">MONITORING</div>
          <button className={`sidebar-link ${activeSection === "network" ? "sidebar-active" : ""}`} onClick={() => setActiveSection("network")}><span className="nav-icon">⌁</span><span>Network Monitoring</span></button>
          <button className={`sidebar-link ${activeSection === "anomaly" ? "sidebar-active" : ""}`} onClick={() => setActiveSection("anomaly")}><span className="nav-icon">◈</span><span>Anomaly Detection</span><span className="sidebar-badge">Live</span></button>
          <div className="sidebar-footer"><div className="sidebar-user-dot">A</div><div><strong>Administrator</strong><small>Admin · Review authority</small></div></div>
        </aside>
        <main className="dashboard-content sidebar-content">
          <div className="page-title-row"><div><span className="eyebrow">SECURITY WORKSPACE</span><h2>{({overview:"Overview",users:"User Management",teams:"Team Management",audit:"Audit Logs",network:"Network Monitoring",anomaly:"Anomaly Detection"})[activeSection] || "Dashboard"}</h2><p>Network Security Management Platform</p></div><span className="role-tag role-admin">ADMIN</span></div>

        {message && (
          <p className="dashboard-message">{message}</p>
        )}


        {activeSection === "overview" && (<>
          <section className="overview-welcome"><div><h3>Security operations at a glance</h3><p>Manage users, review alerts and monitor live network activity from one workspace.</p></div><div className="welcome-mark">◈</div></section>
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


        </>)}


        {/* USER MANAGEMENT */}
        {activeSection === "overview" && <div className="overview-shortcuts"><button onClick={() => setActiveSection("network")}>Open Live Monitoring →</button><button onClick={() => setActiveSection("anomaly")}>Review Anomalies →</button><button onClick={() => setActiveSection("users")}>Manage Users →</button></div>}

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

        {activeSection === "anomaly" && renderAnomalyDashboard()}
        </main>
      </div>
    </div>
  );
}

export default App;