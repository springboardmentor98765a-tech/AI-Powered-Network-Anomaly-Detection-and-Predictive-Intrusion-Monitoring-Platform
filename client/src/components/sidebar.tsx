import { NavLink } from "react-router-dom";
import {
  FileText,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Radio,
  Shield,
  ShieldAlert,
  Users,
} from "lucide-react";
import { useAuth } from "../context/authContext";

interface NavItem {
  link: string;
  label: string;
  icon: React.ReactNode;
  roles?: string[];
}

export default function Sidebar() {
  const { user, logout } = useAuth();
  const userRoles: string[] =
    user?.roles?.map((r: { role_name: string }) => r.role_name) || ["Security Analyst"];
  const primaryRole = userRoles[0] || "Security Analyst";

  const tabs: NavItem[] = [
    { link: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={19} /> },
    { link: "/monitoring", label: "Network Stream", icon: <Radio size={19} /> },
    { link: "/threats", label: "Threat Analytics", icon: <ShieldAlert size={19} /> },
    { link: "/teams", label: "Team Management", icon: <FolderKanban size={19} /> },
    {
      link: "/users",
      label: "User Administration",
      icon: <Users size={19} />,
      roles: ["Administrator"],
    },
    {
      link: "/audit-logs",
      label: "Audit Logs",
      icon: <FileText size={19} />,
      roles: ["Administrator", "Team Lead", "Security Analyst"],
    },
  ];

  const filteredTabs = tabs.filter((tab) => {
    if (!tab.roles) return true;
    return tab.roles.some((role) => userRoles.includes(role));
  });

  return (
    <aside className="flex flex-col justify-between w-64 shrink-0 min-h-screen bg-surface border-r border-border p-4 gap-4">
      <div className="flex flex-col gap-1.5">
        {/* Brand & Active Operator Badge */}
        <div className="px-3 py-2.5 mb-3 rounded-lg bg-background/60 border border-border/70">
          <div className="flex items-center gap-2 text-primary font-heading font-bold text-sm tracking-wide">
            <Shield size={17} />
            <span>NetShield AI</span>
          </div>
          <p className="text-[11px] font-mono text-muted mt-1 truncate">
            {user?.email || "SOC Operator"}
          </p>
          <span className="inline-block mt-1.5 px-2 py-0.5 rounded text-[10px] font-mono bg-primary/10 text-primary border border-primary/20">
            {primaryRole}
          </span>
        </div>

        {filteredTabs.map((tab) => (
          <NavLink
            key={tab.link}
            to={tab.link}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? "text-primary bg-background border border-primary/25 shadow-sm"
                  : "text-text hover:bg-background/70 hover:text-text-h"
              }`
            }
          >
            <span className="shrink-0">{tab.icon}</span>
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </div>

      <div className="pt-4 border-t border-border">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium text-danger hover:bg-danger/10 transition-colors cursor-pointer"
        >
          <LogOut size={19} className="shrink-0" />
          <span>Terminate Session</span>
        </button>
      </div>
    </aside>
  );
}