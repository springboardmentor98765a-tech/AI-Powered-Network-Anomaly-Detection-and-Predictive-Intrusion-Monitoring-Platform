import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import {
  Activity,
  LayoutDashboard,
  Users,
  FileSearch,
  UserCircle,
  LockKeyhole,
  LogOut,
  Network,
  ShieldAlert,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";

const accountNavigation = [
  {
    label: "My Profile",
    path: "/profile",
    icon: UserCircle,
  },
  {
    label: "Change Password",
    path: "/change-password",
    icon: LockKeyhole,
  },
];

const managementPaths = ["/users", "/roles", "/teams"];
const networkRoles = [
  "Administrator",
  "Security Analyst",
  "Team Lead / Supervisor",
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const userRoles = user?.roles || [];
  const isAdministrator = userRoles.includes("Administrator");
  const managementPath = isAdministrator ? "/users" : "/teams";
  const isManagementRoute = managementPaths.includes(location.pathname);

  // User, Role and Team pages are grouped under one sidebar destination.
  // Audit Logs deliberately remains a separate workspace destination.
  const navigation = [
    {
      label: "Security Overview",
      path: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      label: "Network Monitoring",
      path: "/network-monitoring",
      icon: Network,
      roles: networkRoles,
    },
    {
      label: "Anomaly Detection",
      path: "/anomaly-detection",
      icon: ShieldAlert,
      roles: networkRoles,
    },
    {
      label: "User Management",
      path: managementPath,
      icon: Users,
      roles: [
        "Administrator",
        "Security Analyst",
        "Team Lead / Supervisor",
      ],
      management: true,
    },
    {
      label: "Audit Logs",
      path: "/audit-logs",
      icon: FileSearch,
      roles: ["Administrator"],
    },
  ];

  const visibleNavigation = navigation.filter((item) => {
    if (!item.roles) return true;
    return item.roles.some((role) => userRoles.includes(role));
  });

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const initials = user?.name
    ?.split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <Activity size={23} />
          </div>

          <div>
            <h2>NETSHIELD</h2>
            <span>AI SECURITY PLATFORM</span>
          </div>
        </div>

        <div className="sidebar-section">
          <p className="section-label">WORKSPACE</p>

          <nav className="navigation">
            {visibleNavigation.map((item) => {
              const Icon = item.icon;
              const active = item.management
                ? isManagementRoute
                : undefined;

              return (
                <NavLink
                  key={item.management ? "management" : item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `nav-link ${(item.management ? active : isActive) ? "active" : ""}`
                  }
                >
                  <Icon size={19} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="sidebar-section account-section">
          <p className="section-label">ACCOUNT</p>

          <nav className="navigation">
            {accountNavigation.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `nav-link ${isActive ? "active" : ""}`
                  }
                >
                  <Icon size={19} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="sidebar-bottom">
          <div className="system-status">
            <span className="status-dot" />
            <span>System Operational</span>
          </div>

          <button className="logout-button" onClick={handleLogout}>
            <LogOut size={18} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <div className="topbar-label">
              NETSHIELD AI / SECURITY CENTER
            </div>
            <div className="topbar-status">
              <span className="status-dot" />
              Secure workspace
            </div>
          </div>

          <div className="topbar-user">
            <div className="user-avatar">{initials || "U"}</div>

            <div className="user-details">
              <strong>{user?.name}</strong>
              <span>{userRoles.join(", ")}</span>
            </div>
          </div>
        </header>

        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
