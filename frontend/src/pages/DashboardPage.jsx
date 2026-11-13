
import { Link } from "react-router-dom";

import {
  Users,
  ShieldCheck,
  UsersRound,
  FileSearch,
  ArrowUpRight,
  Activity,
  LockKeyhole,
  Network,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";

const roleCards = {
  Administrator: [
    {
      title: "User Management",
      description: "Create accounts, update users and manage access.",
      path: "/users",
      icon: Users,
      accent: "blue",
    },
    {
      title: "Role Management",
      description: "Review roles and access permissions.",
      path: "/roles",
      icon: ShieldCheck,
      accent: "purple",
    },
    {
      title: "Team Management",
      description: "Organize analysts into security teams.",
      path: "/teams",
      icon: UsersRound,
      accent: "cyan",
    },
    {
      title: "Audit Logs",
      description: "Review recorded platform activities.",
      path: "/audit-logs",
      icon: FileSearch,
      accent: "orange",
    },
  ],

  "Security Analyst": [
    {
      title: "My Teams",
      description: "View your assigned security teams.",
      path: "/teams",
      icon: UsersRound,
      accent: "cyan",
    },
    {
      title: "My Profile",
      description: "View your account information.",
      path: "/profile",
      icon: Users,
      accent: "blue",
    },
    {
      title: "Change Password",
      description: "Update your account credentials.",
      path: "/change-password",
      icon: LockKeyhole,
      accent: "purple",
    },
  ],

  "Team Lead / Supervisor": [
    {
      title: "Team Management",
      description: "Oversee your assigned team and its members.",
      path: "/teams",
      icon: UsersRound,
      accent: "cyan",
    },
    {
      title: "My Profile",
      description: "View your account information.",
      path: "/profile",
      icon: Users,
      accent: "blue",
    },
    {
      title: "Change Password",
      description: "Update your account credentials.",
      path: "/change-password",
      icon: LockKeyhole,
      accent: "purple",
    },
  ],
};

export default function DashboardPage() {
  const { user } = useAuth();

  const role = user?.roles?.[0] || "Security Analyst";

  const cards = user?.roles?.flatMap(
    (userRole) => roleCards[userRole] || []
  ) || [];

  const uniqueCards = [
    ...new Map(cards.map((card) => [card.path, card])).values(),
  ];

  return (
    <div className="dashboard-page">
      <div className="dashboard-heading">
        <div>
          <p className="page-eyebrow">OVERVIEW / DASHBOARD</p>
          <h1>Good to see you, {user?.name?.split(" ")[0]}.</h1>
          <p className="page-description">
            Welcome to your NetShield AI security workspace.
          </p>
        </div>

        <div className="workspace-badge">
          <Activity size={17} />
          <span>Workspace active</span>
        </div>
      </div>

      <div className="welcome-panel">
        <div className="welcome-content">
          <p className="welcome-label">NETSHIELD SECURITY CENTER</p>
          <h2>Your network security workspace.</h2>
          <p>
            Access your assigned tools, manage platform activities
            and keep your security operations organized.
          </p>

          <div className="welcome-role">
            <ShieldCheck size={17} />
            {user?.roles?.join(" · ")}
          </div>
        </div>

        <div className="welcome-graphic">
          <div className="graphic-ring ring-one" />
          <div className="graphic-ring ring-two" />
          <div className="graphic-center">
            <Network size={49} />
          </div>
        </div>
      </div>

      <div className="section-heading">
        <div>
          <h2>Your workspace</h2>
          <p>Tools and features available to your account.</p>
        </div>
        <span className="section-count">
          {uniqueCards.length} MODULES
        </span>
      </div>

      <div className="feature-grid">
        {uniqueCards.map((card) => {
          const Icon = card.icon;

          return (
            <Link
              to={card.path}
              key={card.path}
              className="feature-card"
            >
              <div className={`feature-icon ${card.accent}`}>
                <Icon size={23} />
              </div>

              <ArrowUpRight className="feature-arrow" size={19} />

              <h3>{card.title}</h3>
              <p>{card.description}</p>

              <span className="feature-link">
                Open module <ArrowUpRight size={15} />
              </span>
            </Link>
          );
        })}
      </div>

      <div className="dashboard-bottom-note">
        <ShieldCheck size={18} />
        <p>
          Your access is controlled by your assigned platform role.
          Protected operations are also validated by the backend.
        </p>
      </div>
    </div>
  );
}
