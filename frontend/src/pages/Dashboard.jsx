
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../services/api";
import Sidebar from "../components/Sidebar";
import "./Dashboard.css";

function Dashboard() {
    const { user, logout } = useAuth();

    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const handleLogout = async () => {
        await logout();
        window.location.href = "/login";
    };

    // Fetch dashboard statistics
    const fetchStats = async () => {
        try {
            const response = await API.get("/dashboard/stats");
            setStats(response.data);
            setError("");
        } catch (err) {
            setError(
                err.response?.data?.detail ||
                "Unable to fetch dashboard statistics."
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    // Format timestamp
    const formatDate = (timestamp) => {
        if (!timestamp) return "N/A";

        return new Date(timestamp).toLocaleString();
    };

    return (
        <div className="app-layout">

            <Sidebar />

            <main className="main-content">

                <header className="topbar">
                    <div>
                        <h2>Dashboard</h2>
                        <p>Network Security Overview</p>
                    </div>

                    <div className="user-section">
                        <span>{user?.full_name}</span>

                        <button onClick={handleLogout}>
                            Logout
                        </button>
                    </div>
                </header>

                <section className="dashboard-content">

                    <h1>Welcome, {user?.full_name}!</h1>

                    <p className="dashboard-subtitle">
                        Here's your platform overview.
                    </p>

                    {error && (
                        <p className="error-message">{error}</p>
                    )}

                    {/* Statistics */}
                    <div className="stats-grid">

                        <div className="stat-card">
                            <p>Total Users</p>

                            <h2>
                                {loading ? "--" : stats?.total_users ?? 0}
                            </h2>

                            <span>Registered users</span>
                        </div>

                        <div className="stat-card">
                            <p>Active Users</p>

                            <h2>
                                {loading ? "--" : stats?.active_users ?? 0}
                            </h2>

                            <span>Currently active accounts</span>
                        </div>

                        <div className="stat-card">
                            <p>Active Teams</p>

                            <h2>
                                {loading ? "--" : stats?.total_teams ?? 0}
                            </h2>

                            <span>Configured security teams</span>
                        </div>

                        <div className="stat-card">
                            <p>Security Events</p>

                            <h2>
                                {loading ? "--" : stats?.total_audit_events ?? 0}
                            </h2>

                            <span>Total audit log records</span>
                        </div>

                    </div>

                    {/* Recent Activity */}
                    <div className="recent-activity">
                        <div className="activity-header">
                            <h2>Recent Activity</h2>

                            <button onClick={fetchStats}>
                                Refresh
                            </button>
                        </div>

                        {loading ? (
                            <p>Loading recent activity...</p>
                        ) : stats?.recent_activity?.length > 0 ? (
                            <div className="activity-list">

                                {stats.recent_activity.map((activity) => (
                                    <div
                                        className="activity-item"
                                        key={activity.id}
                                    >
                                        <div>
                                            <strong>
                                                {activity.action}
                                            </strong>

                                            <p>
                                                Actor ID:{" "}
                                                {activity.actor_user_id ?? "N/A"}
                                            </p>
                                        </div>

                                        <div className="activity-meta">
                                            <span
                                                className={
                                                    activity.status === "SUCCESS"
                                                        ? "activity-success"
                                                        : "activity-failed"
                                                }
                                            >
                                                {activity.status}
                                            </span>

                                            <small>
                                                {formatDate(activity.timestamp)}
                                            </small>
                                        </div>
                                    </div>
                                ))}

                            </div>
                        ) : (
                            <p>No recent activity found.</p>
                        )}
                    </div>

                    <div className="welcome-panel">
                        <h2>Network Anomaly Detection Platform</h2>

                        <p>
                            Monitor users, manage roles, organize security
                            teams and review platform activity.
                        </p>
                    </div>

                </section>

            </main>
        </div>
    );
}

export default Dashboard;
