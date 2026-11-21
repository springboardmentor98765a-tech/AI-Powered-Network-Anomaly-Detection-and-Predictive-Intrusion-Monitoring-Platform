import React, { useState, useEffect } from "react";

import {
  ShieldCheck,
  LayoutDashboard,
  Activity,
  Bell,
  FileText,
  Settings,
  UserRound,
  LogOut,
  Radio,
  AlertTriangle,
  ShieldAlert,
  Network,
  CheckCircle2,
  Download,
  CalendarDays
  } from "lucide-react";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from "recharts";



const roleLevels = {
  SECURITY_ANALYST: 1,
  SOC_TEAM: 2,
  ENTERPRISE: 3,
  ADMINISTRATOR: 4
};

const menuItems = [
  { name: "Dashboard", icon: LayoutDashboard, minLevel: 1 },
  { name: "Traffic Monitor", icon: Activity, minLevel: 1 },
  { name: "Alerts", icon: Bell, minLevel: 1 },
  { name: "Analysis", icon: Network, minLevel: 1 },
  { name: "Reports", icon: FileText, minLevel: 1 },
  { name: "Settings", icon: Settings, minLevel: 1 },

  { name: "Incident Management", icon: ShieldAlert, minLevel: 2 },
  { name: "Team Overview", icon: Network, minLevel: 2 },

  { name: "Organization Reports", icon: FileText, minLevel: 3 },
  { name: "Account Approvals", icon: CheckCircle2, minLevel: 3 },

  { name: "User Management", icon: UserRound, minLevel: 4 },
  { name: "System Configuration", icon: Settings, minLevel: 4 }
];

export default function Dashboard({ user, onLogout })
{
    const userRole = user?.role || "SECURITY_ANALYST";

const userLevel = roleLevels[userRole] || 1;

const visibleMenuItems = menuItems.filter(
  (item) => userLevel >= item.minLevel
);
    const [activeMenu, setActiveMenu] = useState("Dashboard");
    const [monitoringData, setMonitoringData] = useState(null);
    const [timelineData, setTimelineData] = useState([]);
    const [timelineInterval, setTimelineInterval] = useState("hour");
    const [timelineLoading, setTimelineLoading] = useState(false);
    const [timelineError, setTimelineError] = useState("");
    const [recentTraffic, setRecentTraffic] = useState([]);
    const [loading, setLoading] = useState(true);
    const [apiError, setApiError] = useState("");
    const [timeFilter, setTimeFilter] = useState("all");
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [flowData, setFlowData] = useState(null);
    const [flowLoading, setFlowLoading] = useState(false);
    const [flowError, setFlowError] = useState("");
    const [flowPage, setFlowPage] = useState(1);
    const [flowPageSize, setFlowPageSize] = useState(25);
    const [flowProtocol, setFlowProtocol] = useState("");
    const [flowTrafficType, setFlowTrafficType] = useState("");
    const [flowLabel, setFlowLabel] = useState("");

    function exportReport(format) {
    alert(
        `${format.toUpperCase()} export will be available after dataset integration.`
    );
}
useEffect(() => {
  async function loadMonitoringData() {
    try {
      setLoading(true);
      setApiError("");

      const response = await fetch(
        "http://localhost:8000/monitoring/summary",
        { credentials: "include" }
      );

      if (!response.ok) {
        throw new Error("Failed to load monitoring statistics");
      }

      const result = await response.json();
      setMonitoringData(result);

    } catch (error) {
      setApiError(error.message);
    } finally {
      setLoading(false);
    }
  }

  loadMonitoringData();
}, []);
    useEffect(() => {
  if (activeMenu !== "Traffic Monitor") return;

  const controller = new AbortController();

  async function loadFlows() {
    setFlowLoading(true);
    setFlowError("");

    try {
      const params = new URLSearchParams({
        page: String(flowPage),
        page_size: String(flowPageSize)
      });

      if (flowProtocol) {
        params.set("protocol", flowProtocol);
      }

      if (flowTrafficType) {
        params.set("traffic_type", flowTrafficType);
      }

      if (flowLabel.trim()) {
        params.set("label", flowLabel.trim());
      }

      const response = await fetch(
        `http://localhost:8000/monitoring/flows?${params.toString()}`,
        {
          credentials: "include",
          signal: controller.signal
        }
      );

      if (!response.ok) {
        throw new Error(
          `Unable to load traffic records (HTTP ${response.status})`
        );
      }

      const result = await response.json();

      setFlowData(result);
    } catch (error) {
      if (error.name !== "AbortError") {
        setFlowError(error.message);
        setFlowData(null);
      }
    } finally {
      if (!controller.signal.aborted) {
        setFlowLoading(false);
      }
    }
  }

  loadFlows();

  return () => controller.abort();
}, [
  activeMenu,
  flowPage,
  flowPageSize,
  flowProtocol,
  flowTrafficType,
  flowLabel
]);

    useEffect(() => {
  async function loadRecentTraffic() {
    try {
      const response = await fetch(
        "http://localhost:8000/monitoring/flows?page=1&page_size=10",
        { credentials: "include" }
      );

      if (!response.ok) {
        throw new Error("Unable to load network traffic");
      }

      const result = await response.json();
      setRecentTraffic(result.records || []);
    } catch (error) {
      console.error("Network traffic loading failed:", error);
    }
  }

  loadRecentTraffic();
}, []);

useEffect(() => {
  const controller = new AbortController();

  async function loadTimeline() {
    setTimelineLoading(true);
    setTimelineError("");

    try {
      const response = await fetch(
        `http://localhost:8000/monitoring/timeline?interval=${timelineInterval}`,
        {
          credentials: "include",
          signal: controller.signal
        }
      );

      if (!response.ok) {
        throw new Error(
          `Timeline API failed (HTTP ${response.status})`
        );
      }

      const result = await response.json();
      setTimelineData(result.data || []);
    } catch (error) {
      if (error.name !== "AbortError") {
        setTimelineError(error.message);
      }
    } finally {
      if (!controller.signal.aborted) {
        setTimelineLoading(false);
      }
    }
  }

  loadTimeline();

  return () => controller.abort();
}, [timelineInterval]);

    const attackColors = [
        "#2563eb",
        "#ef4444",
        "#f59e0b",
        "#22c55e",
        "#a855f7"
    ];

    const attackData = (
        monitoringData?.attack_distribution || []
        ).map((attack, index) => ({
        name: attack.name,
        value: attack.value,
        color: attackColors[index % attackColors.length]
    }));

  const cardStyle = {
    background: "#111a2e",
    border: "1px solid #24314d",
    borderRadius: "14px",
    padding: "20px"
  };

  const stats = [
  {
    title: "Total Network Flows",
    value: monitoringData?.total_flows?.toLocaleString() ?? "—",
    icon: Network,
    color: "#38bdf8"
  },
  {
    title: "Normal Traffic",
    value: monitoringData?.normal_flows?.toLocaleString() ?? "—",
    icon: CheckCircle2,
    color: "#22c55e"
  },
  {
    title: "Attack-Labeled Traffic",
    value: monitoringData?.attack_flows?.toLocaleString() ?? "—",
    icon: ShieldAlert,
    color: "#ef4444"
  },
  {
    title: "Attack Categories",
    value: monitoringData?.attack_distribution?.length ?? "—",
    icon: AlertTriangle,
    color: "#f59e0b"
  },
  {
    title: "Protocols Detected",
    value: monitoringData?.protocol_distribution?.length ?? "—",
    icon: Radio,
    color: "#a855f7"
  }
];
const extraPages = {
  "Traffic Monitor": {
    title: "Traffic Monitor",
    description: "Network traffic statistics from CIC-IDS2018",
    details: [
      ["Total Network Flows", monitoringData?.total_flows],
      ["Normal Traffic", monitoringData?.normal_flows],
      ["Attack-Labeled Traffic", monitoringData?.attack_flows],
    ],
  },

  Alerts: {
    title: "Security Alerts",
    description: "Detected attack categories in the dataset",
    details: (monitoringData?.attack_distribution || []).map(
      (attack) => [attack.name, attack.value]
    ),
  },

  Analysis: {
    title: "Network Traffic Analysis",
    description: "Analysis of CIC-IDS2018 network traffic",
    details: [
      ["Total Flows", monitoringData?.total_flows],
      [
        "Attack Categories",
        monitoringData?.attack_distribution?.length,
      ],
      [
        "Protocols Detected",
        monitoringData?.protocol_distribution?.length,
      ],
    ],
  },

  Reports: {
    title: "Security Reports",
    description: "Network traffic analysis summary",
    details: [
      ["Total Network Flows", monitoringData?.total_flows],
      ["Normal Traffic", monitoringData?.normal_flows],
      ["Attack-Labeled Traffic", monitoringData?.attack_flows],
    ],
  },

  Settings: {
    title: "Dashboard Settings",
    description: "NetShield AI monitoring configuration",
    details: [
      ["Monitoring Source", "CIC-IDS2018 Dataset"],
      ["Monitoring Mode", "Historical Analysis"],
      ["Live Capture", "Planned"],
    ],
  },
};

  return (
    
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "#080d1b",
        color: "white",
        fontFamily: "Arial, sans-serif"
      }}
    >
      {/* SIDEBAR */}

      <aside
        style={{
          width: "240px",
          background: "#0c1426",
          borderRight: "1px solid #24314d",
          padding: "24px 15px",
          flexShrink: 0
        }}
      >
        <h2
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            color: "#38bdf8",
            fontSize: "21px",
            marginBottom: "35px"
          }}
        >
          <ShieldCheck />
          NetShield AI
        </h2>

        {visibleMenuItems.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.name}
              onClick={() => setActiveMenu(item.name)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "13px",
                marginBottom: "8px",
                border: "none",
                borderRadius: "8px",
                background:
                  activeMenu === item.name
                    ? "#1d4ed8"
                    : "transparent",
                color: "white",
                cursor: "pointer",
                textAlign: "left"
              }}
            >
              <Icon size={18} />
              {item.name}
            </button>
          );
        })}

        <div
          style={{
            marginTop: "45px",
            padding: "15px",
            background: "#111a2e",
            borderRadius: "10px"
          }}
        >
          <p style={{ color: "#22c55e" }}>
            ● System Operational
          </p>

          <small style={{ color: "#94a3b8" }}>
            NetShield AI Monitoring
          </small>
        </div>
      </aside>

      {/* MAIN CONTENT */}

      <main
        style={{
          flex: 1,
          padding: "28px",
          minWidth: 0,
          overflowX: "auto"
        }}
      >
        {/* HEADER */}

        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "25px",
            flexWrap: "wrap",
            gap: "15px"
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: "27px" }}>
              Network Monitoring Dashboard
            </h1>

            <p style={{ color: "#94a3b8" }}>
              Network security overview and traffic analytics
            </p>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "15px"
            }}
            >
            {/* TIME FILTER */}

            <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: "8px"
            }}
            >
            <CalendarDays size={18} color="#38bdf8" />

            <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
                style={{
                background: "#111a2e",
                color: "white",
                border: "1px solid #334155",
                borderRadius: "8px",
                padding: "10px",
                cursor: "pointer"
                }}
            >
                <option value="all">All Dataset Records</option>
                <option value="hour">Last 1 Hour</option>
                <option value="day">Last 24 Hours</option>
                <option value="week">Last 7 Days</option>
                <option value="custom">Custom Range</option>
                <option value="live" disabled>Live — Coming Soon</option>
            </select>
            </div>

            {/* CUSTOM DATE RANGE */}

            {timeFilter === "custom" && (
            <div
                style={{
                display: "flex",
                gap: "8px",
                flexWrap: "wrap"
                }}
            >
                <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                aria-label="Start date and time"
                style={{
                    background: "#111a2e",
                    color: "white",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    padding: "8px"
                }}
                />

                <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                min={startTime || undefined}
                aria-label="End date and time"
                style={{
                    background: "#111a2e",
                    color: "white",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    padding: "8px"
                }}
                />
            </div>
            )}

            {/* EXPORT REPORT */}

            <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: "8px"
            }}
            >
            <Download size={18} color="#38bdf8" />

            <select
                defaultValue=""
                onChange={(e) => {
                if (e.target.value) {
                    exportReport(e.target.value);
                    e.target.value = "";
                }
                }}
                style={{
                background: "#2563eb",
                color: "white",
                border: "none",
                borderRadius: "8px",
                padding: "10px",
                cursor: "pointer"
                }}
            >
                <option value="" disabled>
                Export Report
                </option>

                <option value="csv">Download CSV</option>
                <option value="xlsx">Download Excel</option>
            </select>
            </div>
                     
            <span style={{ color: "#38bdf8" }}>
              <UserRound size={16} />{" "}
              {user?.full_name || "Security Analyst"}
            </span>

            <button
              onClick={onLogout}
              style={{
                background: "#1e293b",
                color: "white",
                border: "1px solid #334155",
                borderRadius: "8px",
                padding: "10px",
                cursor: "pointer"
              }}
            >
              <LogOut size={15} /> Logout
            </button>
          </div>
        </header>

        {activeMenu !== "Dashboard" ? (
  <div>
    <h1>{extraPages[activeMenu]?.title}</h1>

    <p style={{ color: "#93c5fd", marginBottom: 25 }}>
      {extraPages[activeMenu]?.description}
    </p>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 16,
      }}
    >
      {extraPages[activeMenu]?.details.map(([label, value], index) => (
        <div key={index} style={cardStyle}>
          <p style={{ color: "#93c5fd" }}>{label}</p>
          <h2>
            {typeof value === "number"
              ? value.toLocaleString()
              : value ?? "Loading..."}
          </h2>
        </div>
      ))}
    </div>

    {activeMenu === "Traffic Monitor" && (
      <TrafficTable
        flowData={flowData}
        flowLoading={flowLoading}
        flowError={flowError}
        flowPage={flowPage}
        setFlowPage={setFlowPage}
        flowPageSize={flowPageSize}
        setFlowPageSize={setFlowPageSize}
        flowProtocol={flowProtocol}
        setFlowProtocol={setFlowProtocol}
        flowTrafficType={flowTrafficType}
        setFlowTrafficType={setFlowTrafficType}
        flowLabel={flowLabel}
        setFlowLabel={setFlowLabel}
      />
    )}

  </div>
) : (  <>

        {loading && (
        <p style={{ color: "#38bdf8" }}>
            Loading CIC-IDS2018 dataset statistics...
        </p>
        )}

        {apiError && (
        <p style={{ color: "#ef4444" }}>
            Monitoring API error: {apiError}
        </p>
        )}

        {monitoringData && (
        <p
            style={{
            color: "#22c55e",
            background: "#052e22",
            padding: "10px 15px",
            borderRadius: "8px",
            marginBottom: "25px"
            }}
        >
            CIC-IDS2018 Dataset Connected — Historical Network Traffic Analysis.
            Historical activity records are dataset-backed. Dashboard statistics, attack distribution, historical traffic analysis, and activity records are dataset-backed.
        </p>
        )}

        {/* STATISTICS */}

        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "15px",
            marginBottom: "25px"
          }}
        >
          {stats.map((stat) => {
            const Icon = stat.icon;

            return (
              <div key={stat.title} style={cardStyle}>
                <Icon color={stat.color} size={24} />

                <p
                  style={{
                    color: "#94a3b8",
                    fontSize: "13px"
                  }}
                >
                  {stat.title}
                </p>

                <h2 style={{ marginBottom: 0 }}>
                  {stat.value}
                </h2>
              </div>
            );
          })}
        </section>

        {/* CHARTS */}

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 2fr) minmax(300px, 1fr)",
            gap: "20px",
            marginBottom: "25px"
          }}
        >
          <div style={cardStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "10px"
              }}
            >
              <div>
                <h3>Historical Network Traffic Analysis</h3>
                <p style={{ color: "#94a3b8", fontSize: "12px" }}>
                  CIC-IDS2018 | Normal vs Attack Traffic Over Time
                </p>
              </div>

              <select
                value={timelineInterval}
                onChange={(e) => setTimelineInterval(e.target.value)}
                style={{
                  background: "#111a2e",
                  color: "white",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  padding: "8px"
                }}
              >
                <option value="hour">Hourly</option>
                <option value="day">Daily</option>
              </select>
            </div>

            {timelineLoading && (
              <p style={{ color: "#38bdf8" }}>
                Loading historical traffic timeline...
              </p>
            )}

            {timelineError && (
              <p style={{ color: "#ef4444" }}>
                {timelineError}
              </p>
            )}

            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timelineData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#24314d"
                />

                <XAxis
                  dataKey="time"
                  stroke="#94a3b8"
                  tick={{ fontSize: 10 }}
                  minTickGap={30}
                />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Legend />

                <Line
                  type="monotone"
                  dataKey="normal"
                  name="Normal Traffic"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  dot={false}
                />

                <Line
                  type="monotone"
                  dataKey="attack"
                  name="Attack Traffic"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={false}
                />             
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={cardStyle}>
            <h3>Attack Distribution</h3>

            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={attackData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={100}
                  label
                >
                  {attackData.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={entry.color}
                    />
                  ))}
                </Pie>

                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* HISTORICAL NETWORK ACTIVITY */}

<section style={cardStyle}>
  <h3>Historical Network Activity</h3>

  <p style={{ color: "#94a3b8" }}>
    Sample records from the CIC-IDS2018 dataset.
  </p>

  <div style={{ overflowX: "auto" }}>
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        textAlign: "left"
      }}
    >
      <thead>
        <tr>
          {[
            "Timestamp",
            "Protocol",
            "Flow Duration (µs)",
            "Label",
            "Traffic Type"
          ].map((heading) => (
            <th
              key={heading}
              style={{
                padding: "12px",
                borderBottom: "1px solid #334155",
                color: "#94a3b8"
              }}
            >
              {heading}
            </th>
          ))}
        </tr>
      </thead>

      <tbody>
        {recentTraffic.map((row, index) => (
          <tr key={index}>
            <td style={{ padding: 12 }}>{row.timestamp}</td>
            <td style={{ padding: 12 }}>{row.protocol}</td>
            <td style={{ padding: 12 }}>{row.flow_duration}</td>
            <td style={{ padding: 12 }}>{row.label}</td>
            <td
              style={{
                padding: 12,
                color:
                  row.traffic_type === "Attack"
                    ? "#ef4444"
                    : "#22c55e"
              }}
            >
              {row.traffic_type}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</section>

        <p
          style={{
            marginTop: "25px",
            color: "#64748b",
            textAlign: "center"
          }}
        >
          NetShield AI © 2026 — Network Monitoring Module
              </p>
      </>
      )}
    </main>
  </div>
);
}

function TrafficTable({
  flowData,
  flowLoading,
  flowError,
  flowPage,
  setFlowPage,
  flowPageSize,
  setFlowPageSize,
  flowProtocol,
  setFlowProtocol,
  flowTrafficType,
  setFlowTrafficType,
  flowLabel,
  setFlowLabel
}) {
  const inputStyle = {
    background: "#111a2e",
    color: "white",
    border: "1px solid #334155",
    borderRadius: "8px",
    padding: "10px",
    minWidth: "150px"
  };

  const cellStyle = {
    padding: "12px",
    borderBottom: "1px solid #24314d",
    textAlign: "left"
  };

  const resetFilters = () => {
    setFlowProtocol("");
    setFlowTrafficType("");
    setFlowLabel("");
    setFlowPage(1);
  };

  return (
    <section
      style={{
        marginTop: "25px",
        background: "#111a2e",
        border: "1px solid #24314d",
        borderRadius: "14px",
        padding: "20px"
      }}
    >
      <h2>Network Traffic Details</h2>

      <p style={{ color: "#94a3b8" }}>
        Actual historical network flow records from CIC-IDS2018.
      </p>

      {/* FILTERS */}

      <div
        style={{
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
          marginBottom: "20px"
        }}
      >
        <select
          value={flowProtocol}
          onChange={(e) => {
            setFlowProtocol(e.target.value);
            setFlowPage(1);
          }}
          style={inputStyle}
        >
          <option value="">All Protocols</option>
          <option value="0">Protocol 0</option>
          <option value="6">TCP (6)</option>
          <option value="17">UDP (17)</option>
        </select>

        <select
          value={flowTrafficType}
          onChange={(e) => {
            setFlowTrafficType(e.target.value);
            setFlowPage(1);
          }}
          style={inputStyle}
        >
          <option value="">All Traffic</option>
          <option value="normal">Normal</option>
          <option value="attack">Attack</option>
        </select>

        <input
          value={flowLabel}
          onChange={(e) => {
            setFlowLabel(e.target.value);
            setFlowPage(1);
          }}
          placeholder="Exact attack label"
          aria-label="Filter by attack label"
          style={inputStyle}
        />

        <button onClick={resetFilters} style={inputStyle}>
          Reset Filters
        </button>
      </div>

      {/* STATUS */}

      {flowLoading && (
        <p style={{ color: "#38bdf8" }}>
          Loading network traffic records...
        </p>
      )}

      {flowError && (
        <p style={{ color: "#ef4444" }}>
          {flowError}
        </p>
      )}

      {flowData && !flowLoading && (
        <p style={{ color: "#93c5fd" }}>
          Matching records:{" "}
          <strong>{flowData.total_records.toLocaleString()}</strong>
        </p>
      )}

      {/* TABLE */}

      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse"
          }}
        >
          <thead>
            <tr>
              {[
                "Timestamp",
                "Protocol",
                "Flow Duration (µs)",
                "Label",
                "Traffic Type"
              ].map((heading) => (
                <th key={heading} style={cellStyle}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {!flowLoading &&
              (flowData?.records || []).map((row, index) => (
                <tr key={index}>
                  <td style={cellStyle}>{row.timestamp || "—"}</td>
                  <td style={cellStyle}>{row.protocol || "—"}</td>
                  <td style={cellStyle}>{row.flow_duration || "—"}</td>
                  <td style={cellStyle}>{row.label || "—"}</td>
                  <td
                    style={{
                      ...cellStyle,
                      color:
                        row.traffic_type === "Attack"
                          ? "#ef4444"
                          : "#22c55e"
                    }}
                  >
                    {row.traffic_type}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {!flowLoading &&
        flowData &&
        flowData.records.length === 0 && (
          <p style={{ color: "#94a3b8" }}>
            No matching records found.
          </p>
        )}

      {/* PAGINATION */}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "15px",
          marginTop: "20px"
        }}
      >
        <select
          value={flowPageSize}
          onChange={(e) => {
            setFlowPageSize(Number(e.target.value));
            setFlowPage(1);
          }}
          style={inputStyle}
        >
          <option value={25}>25 rows</option>
          <option value={50}>50 rows</option>
          <option value={100}>100 rows</option>
        </select>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            style={inputStyle}
            disabled={flowLoading || flowPage <= 1}
            onClick={() => setFlowPage((page) => page - 1)}
          >
            Previous
          </button>

          <span>
            Page {flowPage} of {flowData?.total_pages || 1}
          </span>

          <button
            style={inputStyle}
            disabled={
              flowLoading ||
              !flowData ||
              flowPage >= flowData.total_pages
            }
            onClick={() => setFlowPage((page) => page + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}