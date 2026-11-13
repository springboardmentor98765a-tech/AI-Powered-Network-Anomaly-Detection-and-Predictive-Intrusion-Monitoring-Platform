import { useEffect, useState } from "react";
import {
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  Clock,
  FileText,
  Eye,
  X,
} from "lucide-react";
import api from "../services/api";
import "./AuditLogsPage.css";

const PAGE_SIZE = 50;

const getErrorMessage = (error) => {
  const detail = error?.response?.data?.detail;

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg).join(", ");
  }

  return error?.message || "Unable to load audit logs.";
};

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString();
};

const formatAction = (action) => {
  if (!action) return "Unknown action";

  return action
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filters, setFilters] = useState({
    actor_user_id: "",
    action: "",
    status: "",
    target_type: "",
    target_id: "",
    start_date: "",
    end_date: "",
  });

  const [appliedFilters, setAppliedFilters] = useState({});
  const [offset, setOffset] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const fetchLogs = async () => {
      setLoading(true);
      setError("");

      try {
        const params = {
          limit: PAGE_SIZE,
          offset,
        };

        Object.entries(appliedFilters).forEach(([key, value]) => {
          if (value !== "" && value !== null && value !== undefined) {
            params[key] = value;
          }
        });

        const response = await api.get("/audit-logs", { params });

        if (!cancelled) {
          setLogs(Array.isArray(response.data) ? response.data : []);
        }
      } catch (err) {
        if (!cancelled) {
          setLogs([]);
          setError(getErrorMessage(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchLogs();

    return () => {
      cancelled = true;
    };
  }, [appliedFilters, offset, refreshKey]);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;

    setFilters((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleApplyFilters = (event) => {
    event.preventDefault();

    if (
      filters.actor_user_id &&
      (!Number.isInteger(Number(filters.actor_user_id)) ||
        Number(filters.actor_user_id) <= 0)
    ) {
      setError("Actor User ID must be a positive number.");
      return;
    }

    if (
      filters.start_date &&
      filters.end_date &&
      new Date(filters.start_date) > new Date(filters.end_date)
    ) {
      setError("Start date cannot be later than end date.");
      return;
    }

    const nextFilters = {
      ...filters,
    };

    // Convert local date-time inputs to timezone-aware UTC timestamps.
    if (nextFilters.start_date) {
      nextFilters.start_date = new Date(
        nextFilters.start_date
      ).toISOString();
    }

    if (nextFilters.end_date) {
      nextFilters.end_date = new Date(
        nextFilters.end_date
      ).toISOString();
    }

    setError("");
    setOffset(0);
    setSelectedLog(null);
    setAppliedFilters(nextFilters);
  };

  const handleClearFilters = () => {
    const emptyFilters = {
      actor_user_id: "",
      action: "",
      status: "",
      target_type: "",
      target_id: "",
      start_date: "",
      end_date: "",
    };

    setFilters(emptyFilters);
    setAppliedFilters({});
    setOffset(0);
    setSelectedLog(null);
    setError("");
  };

  const refreshLogs = () => {
    setRefreshKey((current) => current + 1);
  };

  const successCount = logs.filter(
    (log) => log.status === "SUCCESS"
  ).length;

  const failedCount = logs.filter(
    (log) => log.status === "FAILED"
  ).length;

  return (
    <div className="audit-page">
      <div className="audit-header">
        <div>
          <p className="audit-eyebrow">SECURITY MONITORING</p>
          <h1>Audit Logs</h1>
          <p className="audit-subtitle">
            Review account activity and track important platform events.
          </p>
        </div>

        <button
          className="audit-refresh-btn"
          onClick={refreshLogs}
          disabled={loading}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <div className="audit-stat-grid">
        <div className="audit-stat-card">
          <div className="audit-stat-icon">
            <FileText size={20} />
          </div>
          <div>
            <span>Events on this page</span>
            <strong>{logs.length}</strong>
          </div>
        </div>

        <div className="audit-stat-card">
          <div className="audit-stat-icon success">
            <ShieldCheck size={20} />
          </div>
          <div>
            <span>Successful events</span>
            <strong>{successCount}</strong>
          </div>
        </div>

        <div className="audit-stat-card">
          <div className="audit-stat-icon failed">
            <ShieldAlert size={20} />
          </div>
          <div>
            <span>Failed events</span>
            <strong>{failedCount}</strong>
          </div>
        </div>
      </div>

      <section className="audit-panel">
        <div className="audit-panel-heading">
          <div>
            <h2>Activity History</h2>
            <p>Filter and inspect recorded platform events.</p>
          </div>
        </div>

        <form className="audit-filters" onSubmit={handleApplyFilters}>
          <div className="audit-filter-grid">
            <label>
              Actor User ID
              <input
                name="actor_user_id"
                type="number"
                min="1"
                value={filters.actor_user_id}
                onChange={handleFilterChange}
                placeholder="e.g. 1"
              />
            </label>

            <label>
              Action
              <input
                name="action"
                value={filters.action}
                onChange={handleFilterChange}
                placeholder="e.g. USER_CREATED"
              />
            </label>

            <label>
              Status
              <select
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
              >
                <option value="">All statuses</option>
                <option value="SUCCESS">Success</option>
                <option value="FAILED">Failed</option>
              </select>
            </label>

            <label>
              Target Type
              <input
                name="target_type"
                value={filters.target_type}
                onChange={handleFilterChange}
                placeholder="e.g. User"
              />
            </label>

            <label>
              Target ID
              <input
                name="target_id"
                value={filters.target_id}
                onChange={handleFilterChange}
                placeholder="Record ID"
              />
            </label>

            <label>
              Start Date & Time
              <input
                name="start_date"
                type="datetime-local"
                value={filters.start_date}
                onChange={handleFilterChange}
              />
            </label>

            <label>
              End Date & Time
              <input
                name="end_date"
                type="datetime-local"
                value={filters.end_date}
                onChange={handleFilterChange}
              />
            </label>
          </div>

          <div className="audit-filter-actions">
            <button type="button" onClick={handleClearFilters}>
              Clear Filters
            </button>

            <button type="submit" className="audit-apply-btn">
              <Search size={15} />
              Apply Filters
            </button>
          </div>
        </form>

        {error && (
          <div className="audit-error">
            <span>{error}</span>
            <button onClick={refreshLogs}>Retry</button>
          </div>
        )}

        <div className="audit-table-wrap">
          <table className="audit-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Actor</th>
                <th>Target</th>
                <th>Status</th>
                <th>Timestamp</th>
                <th>Details</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="audit-empty">
                    Loading audit events...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="audit-empty">
                    No audit events found for these filters.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <div className="audit-event-cell">
                        <strong>{formatAction(log.action)}</strong>
                        <span>Event #{log.id}</span>
                      </div>
                    </td>

                    <td>
                      <div className="audit-actor-cell">
                        <strong>{log.actor_name || "Unavailable"}</strong>
                        <span>
                          {log.actor_username
                            ? `@${log.actor_username}`
                            : log.actor_user_id
                              ? `User ID: ${log.actor_user_id}`
                              : "System / deleted user"}
                        </span>
                      </div>
                    </td>

                    <td>
                      <div className="audit-target-cell">
                        <strong>{log.target_type || "—"}</strong>
                        <span>{log.target_id || "—"}</span>
                      </div>
                    </td>

                    <td>
                      <span
                        className={`audit-status ${
                          log.status === "SUCCESS"
                            ? "audit-success"
                            : "audit-failed"
                        }`}
                      >
                        {log.status === "SUCCESS" ? (
                          <ShieldCheck size={13} />
                        ) : (
                          <ShieldAlert size={13} />
                        )}
                        {log.status}
                      </span>
                    </td>

                    <td>
                      <span className="audit-time">
                        <Clock size={13} />
                        {formatDate(log.timestamp)}
                      </span>
                    </td>

                    <td>
                      <button
                        className="audit-details-btn"
                        onClick={() => setSelectedLog(log)}
                        title="View event details"
                      >
                        <Eye size={15} />
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="audit-pagination">
          <span>
            Showing {logs.length} event{logs.length === 1 ? "" : "s"} on this
            page
          </span>

          <div>
            <button
              onClick={() =>
                setOffset((current) => Math.max(0, current - PAGE_SIZE))
              }
              disabled={offset === 0 || loading}
            >
              <ChevronLeft size={16} />
              Previous
            </button>

            <button
              onClick={() => setOffset((current) => current + PAGE_SIZE)}
              disabled={loading || logs.length < PAGE_SIZE}
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {selectedLog && (
        <div
          className="audit-modal-backdrop"
          onClick={() => setSelectedLog(null)}
        >
          <section
            className="audit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="audit-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="audit-modal-heading">
              <div>
                <p className="audit-eyebrow">EVENT DETAILS</p>
                <h2 id="audit-modal-title">
                  {formatAction(selectedLog.action)}
                </h2>
              </div>

              <button
                className="audit-close-btn"
                onClick={() => setSelectedLog(null)}
                aria-label="Close details"
              >
                <X size={18} />
              </button>
            </div>

            <div className="audit-detail-grid">
              <div>
                <span>Event ID</span>
                <strong>{selectedLog.id}</strong>
              </div>

              <div>
                <span>Actor</span>
                <strong>
                  {selectedLog.actor_name || "Unavailable"}
                </strong>
              </div>

              <div>
                <span>Actor User ID</span>
                <strong>{selectedLog.actor_user_id ?? "—"}</strong>
              </div>

              <div>
                <span>Target</span>
                <strong>
                  {selectedLog.target_type || "—"}{" "}
                  {selectedLog.target_id
                    ? `#${selectedLog.target_id}`
                    : ""}
                </strong>
              </div>

              <div>
                <span>Status</span>
                <strong>{selectedLog.status}</strong>
              </div>

              <div>
                <span>Timestamp</span>
                <strong>{formatDate(selectedLog.timestamp)}</strong>
              </div>
            </div>

            <div className="audit-json-section">
              <h3>Event Data</h3>
              <pre>
                {JSON.stringify(selectedLog.details ?? {}, null, 2)}
              </pre>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default AuditLogsPage;