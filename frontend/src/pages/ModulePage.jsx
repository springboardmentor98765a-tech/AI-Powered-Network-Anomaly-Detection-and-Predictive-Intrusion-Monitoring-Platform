
import { useLocation } from "react-router-dom";

import {
  Users,
  ShieldCheck,
  UsersRound,
  FileSearch,
  UserCircle,
  LockKeyhole,
  Construction,
} from "lucide-react";

const pageDetails = {
  "/users": {
    title: "User Management",
    description: "Create, manage and deactivate platform user accounts.",
    icon: Users,
    category: "ADMINISTRATION",
  },
  "/roles": {
    title: "Role Management",
    description: "Review platform roles and their assigned permissions.",
    icon: ShieldCheck,
    category: "ACCESS CONTROL",
  },
  "/teams": {
    title: "Team Management",
    description: "Organize security analysts into teams and manage memberships.",
    icon: UsersRound,
    category: "TEAM OPERATIONS",
  },
  "/audit-logs": {
    title: "Audit Logs",
    description: "Review security-relevant activities performed on the platform.",
    icon: FileSearch,
    category: "SECURITY GOVERNANCE",
  },
  "/profile": {
    title: "My Profile",
    description: "Review your personal account information.",
    icon: UserCircle,
    category: "ACCOUNT",
  },
  "/change-password": {
    title: "Change Password",
    description: "Manage your account credentials securely.",
    icon: LockKeyhole,
    category: "ACCOUNT SECURITY",
  },
};

export default function ModulePage() {
  const location = useLocation();
  const page = pageDetails[location.pathname];

  if (!page) return null;

  const Icon = page.icon;

  return (
    <div className="module-page">
      <p className="page-eyebrow">{page.category}</p>

      <div className="module-heading">
        <div className="module-title-icon">
          <Icon size={25} />
        </div>

        <div>
          <h1>{page.title}</h1>
          <p className="page-description">{page.description}</p>
        </div>
      </div>

      <div className="module-empty-state">
        <div className="empty-state-icon">
          <Construction size={34} />
        </div>

        <h2>Workspace is being developed</h2>

        <p>
          The backend functionality for this module is available.
          Its frontend management interface will be connected in
          the upcoming implementation stage.
        </p>

        <span className="development-label">
          FRONTEND IMPLEMENTATION IN PROGRESS
        </span>
      </div>
    </div>
  );
}
