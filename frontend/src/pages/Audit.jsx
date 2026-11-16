
import { useEffect, useState } from "react";
import API from "../services/api";
import Sidebar from "../components/Sidebar";
import "./Audit.css";

function Audit() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [filters, setFilters] = useState({
        action: "",
        status: "",
        actor_user_id: "",
        target_type: "",
    });

    const [selectedLog, setSelectedLog] = useState(null);

    // Fetch audit logs
    const fetchLogs = async () => {
        setLoading(true);
        setError("");

        try {
            const response = await API.get("/audit/");
            setLogs(response.data);
        } catch (err) {
            setError(
                err.response?.data?.detail ||
                "Unable to fetch audit logs."
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    // Handle filter input changes
    const handleFilterChange = (e) => {
        setFilters({
            ...filters,
            [e.target.name]: e.target.value,
        });
    };

    // Apply filters
    const handleFilter = async (e) => {
        e.preventDefault();

        setLoading(true);
        setError("");
        setSelectedLog(null);

        try {
            const params = {};

            Object.keys(filters).forEach((key) => {
                if (filters[key].trim() !== "") {
                    params[key] = filters[key].trim();
                }
            });

            const response = await API.get("/audit/search/filter", {
                params,
            });

            setLogs(response.data);
        } catch (err) {
            setError(
                err.response?.data?.detail ||
                "Unable to filter audit logs."
            );
        } finally {
            setLoading(false);
        }
    };

    // Clear filters
    const handleClearFilters = () => {
        setFilters({
            action: "",
            status: "",
            actor_user_id: "",
            target_type: "",
        });

        setSelectedLog(null);
        fetchLogs();
    };

    // View individual log details
    const handleViewDetails = async (logId) => {
        try {
            const response = await API.get(`/audit/${logId}`);
            setSelectedLog(response.data);
        } catch (err) {
            setError(
                err.response?.data?.detail ||
                "Unable to fetch audit log details."
            );
        }
    };

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
                        <h2>Audit Logs</h2>
                        <p>Monitor and track platform activities</p>
                    </div>
                </header>

                <section className="dashboard-content">
                    <h1>Audit Logs</h1>

                    <p className="dashboard-subtitle">
                        View login attempts, user changes, role updates,
                        and team activities.
                    </p>

                    {/* Filters */}
                    <div className="audit-filter-container">
                        <h3>Filter Audit Logs</h3>

                        <form onSubmit={handleFilter}>
                            <div className="audit-filter-grid">
                                <div>
                                    <label>Action</label>
                                    <input
                                        name="action"
                                        value={filters.action}
                                        onChange={handleFilterChange}
                                        placeholder="e.g. USER_CREATED"
                                    />
                                </div>

                                <div>
                                    <label>Status</label>
                                    <select
                                        name="status"
                                        value={filters.status}
                                        onChange={handleFilterChange}
                                    >
                                        <option value="">All Statuses</option>
                                        <option value="SUCCESS">
                                            SUCCESS
                                        </option>
                                        <option value="FAILED">
                                            FAILED
                                        </option>
                                    </select>
                                </div>

                                <div>
                                    <label>Actor User ID</label>
                                    <input
                                        type="number"
                                        name="actor_user_id"
                                        min="1"
                                        value={filters.actor_user_id}
                                        onChange={handleFilterChange}
                                        placeholder="Enter user ID"
                                    />
                                </div>

                                <div>
                                    <label>Target Type</label>
                                    <input
                                        name="target_type"
                                        value={filters.target_type}
                                        onChange={handleFilterChange}
                                        placeholder="e.g. USER or TEAM"
                                    />
                                </div>
                            </div>

                            <div className="audit-filter-buttons">
                                <button type="submit">
                                    Apply Filters
                                </button>

                                <button
                                    type="button"
                                    onClick={handleClearFilters}
                                >
                                    Clear Filters
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Error */}
                    {error && (
                        <p className="error-message">{error}</p>
                    )}

                    {/* Audit Logs Table */}
                    <div className="audit-table-container">
                        <div className="audit-table-header">
                            <h3>Activity History</h3>

                            <button onClick={fetchLogs}>
                                Refresh
                            </button>
                        </div>

                        {loading ? (
                            <p>Loading audit logs...</p>
                        ) : logs.length === 0 ? (
                            <p>No audit logs found.</p>
                        ) : (
                            <div className="audit-table-scroll">
                                <table className="audit-table">
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Actor ID</th>
                                            <th>Action</th>
                                            <th>Target Type</th>
                                            <th>Target ID</th>
                                            <th>Status</th>
                                            <th>Timestamp</th>
                                            <th>Details</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {logs.map((log) => (
                                            <tr key={log.id}>
                                                <td>{log.id}</td>
                                                <td>
                                                    {log.actor_user_id ?? "N/A"}
                                                </td>
                                                <td>{log.action}</td>
                                                <td>
                                                    {log.target_type || "N/A"}
                                                </td>
                                                <td>
                                                    {log.target_id ?? "N/A"}
                                                </td>
                                                <td>
                                                    <span
                                                        className={
                                                            log.status === "SUCCESS"
                                                                ? "audit-status success"
                                                                : "audit-status failed"
                                                        }
                                                    >
                                                        {log.status}
                                                    </span>
                                                </td>
                                                <td>
                                                    {formatDate(log.timestamp)}
                                                </td>
                                                <td>
                                                    <button
                                                        className="view-log-btn"
                                                        onClick={() =>
                                                            handleViewDetails(log.id)
                                                        }
                                                    >
                                                        View
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Selected Log Details */}
                    {selectedLog && (
                        <div className="audit-details-container">
                            <div className="audit-details-header">
                                <h3>
                                    Audit Log Details #{selectedLog.id}
                                </h3>

                                <button
                                    onClick={() => setSelectedLog(null)}
                                >
                                    Close
                                </button>
                            </div>

                            <p>
                                <strong>Action:</strong>{" "}
                                {selectedLog.action}
                            </p>

                            <p>
                                <strong>Actor ID:</strong>{" "}
                                {selectedLog.actor_user_id ?? "N/A"}
                            </p>

                            <p>
                                <strong>Target Type:</strong>{" "}
                                {selectedLog.target_type || "N/A"}
                            </p>

                            <p>
                                <strong>Target ID:</strong>{" "}
                                {selectedLog.target_id ?? "N/A"}
                            </p>

                            <p>
                                <strong>Status:</strong>{" "}
                                {selectedLog.status}
                            </p>

                            <p>
                                <strong>Timestamp:</strong>{" "}
                                {formatDate(selectedLog.timestamp)}
                            </p>

                            <h4>Additional Details</h4>

                            <pre>
                                {JSON.stringify(
                                    selectedLog.details || {},
                                    null,
                                    2
                                )}
                            </pre>
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}

export default Audit;
