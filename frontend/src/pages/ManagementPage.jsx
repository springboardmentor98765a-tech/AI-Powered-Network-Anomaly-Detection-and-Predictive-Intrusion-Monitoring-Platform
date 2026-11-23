import { NavLink, Outlet } from "react-router-dom";
import { ShieldCheck, Users, UsersRound } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import "./ManagementPage.css";

const managementTabs = [
  {
    label: "Users",
    path: "/users",
    icon: Users,
    roles: ["Administrator"],
  },
  {
    label: "Roles",
    path: "/roles",
    icon: ShieldCheck,
    roles: ["Administrator"],
  },
  {
    label: "Teams",
    path: "/teams",
    icon: UsersRound,
    roles: [
      "Administrator",
      "Team Lead / Supervisor",
      "Security Analyst",
    ],
  },
];

export default function ManagementPage() {
  const { user } = useAuth();
  const userRoles = user?.roles || [];

  const visibleTabs = managementTabs.filter((tab) =>
    tab.roles.some((role) => userRoles.includes(role))
  );

  return (
    <div className="management-shell">
      {visibleTabs.length > 1 && (
        <nav className="management-tabs" aria-label="User management tabs">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;

            return (
              <NavLink
                key={tab.path}
                to={tab.path}
                end
                className={({ isActive }) =>
                  `management-tab ${isActive ? "active" : ""}`
                }
              >
                <Icon size={17} />
                <span>{tab.label}</span>
              </NavLink>
            );
          })}
        </nav>
      )}

      <div className="management-content">
        <Outlet />
      </div>
    </div>
  );
}
