// src/components/sidebar.tsx
import { NavLink } from "react-router-dom";
import { 
  LayoutDashboard, 
  ShieldAlert, 
  Radio, 
  Users, 
  FolderKanban, 
  FileText, 
  Settings, 
  LogOut 
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
  const userRoles = user?.roles?.map((r: any) => r.role_name) || ["Analyst"];

  const tabs: NavItem[] = [
    { link: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={20} /> },
    { link: "/threats", label: "Threat Analytics", icon: <ShieldAlert size={20} /> },
    { link: "/monitoring", label: "Network Stream", icon: <Radio size={20} /> },
    { link: "/teams", label: "Team Management", icon: <FolderKanban size={20} /> },
    { 
      link: "/users", 
      label: "User Administration", 
      icon: <Users size={20} />, 
      roles: ["Administrator"] 
    },
    { 
      link: "/audit-logs", 
      label: "Audit Logs", 
      icon: <FileText size={20} />, 
      roles: ["Administrator", "Team Lead"] 
    },
    { link: "/settings", label: "Settings", icon: <Settings size={20} /> },
  ];

  const filteredTabs = tabs.filter(tab => {
    if (!tab.roles) return true;
    return tab.roles.some(role => userRoles.includes(role));
  });

  return (
    <aside className="flex flex-col justify-between w-64 min-h-screen bg-surface border-r border-border p-4 gap-4">
      <div className="flex flex-col gap-2">
        <div className="px-3 py-2 mb-4">
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-muted">
            NetShield SOC
          </h2>
        </div>

        {filteredTabs.map((tab) => (
          <NavLink
            key={tab.label}
            to={tab.link}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "text-primary bg-background border border-primary/20 shadow-inner shadow-primary/5"
                  : "text-text hover:bg-background hover:text-primary"
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
          className="w-full flex items-center gap-3 px-3.5 py-3 rounded-lg text-sm font-medium text-danger hover:bg-danger/10 transition-colors cursor-pointer"
        >
          <LogOut size={20} className="shrink-0" />
          <span>Terminate Session</span>
        </button>
      </div>
    </aside>
  );
}