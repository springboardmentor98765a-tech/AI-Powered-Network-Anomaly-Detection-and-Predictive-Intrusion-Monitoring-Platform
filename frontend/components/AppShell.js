
// NetShield AI — SOC command-center frame.
// Keeps the existing AppShell props, routes, session guard, and logout API behavior.
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, MotionConfig } from "motion/react";
import {
  api,
  can,
  clearSession,
  getToken,
  getUser,
} from "@/lib/api";

const NAV = [
  { href: "/dashboard", label: "Overview", role: "viewer", icon: "grid" },
  { href: "/traffic", label: "Network traffic", role: "viewer", icon: "activity" },
  { href: "/alerts", label: "Alerts", role: "viewer", icon: "bell" },
  { href: "/incidents", label: "Incidents", role: "viewer", icon: "shield" },
  { href: "/intelligence", label: "Threat intelligence", role: "viewer", icon: "brain" },
  { href: "/teams", label: "Teams", role: "viewer", icon: "users" },
  { href: "/users", label: "User administration", role: "admin", icon: "settings" },
];
function formatRole(role) {
  const value = String(role || "viewer");
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function NavIcon({ name }) {
  const paths = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    activity: (
      <path d="M3 12h4l3-7 4 14 3-7h4" />
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    brain: (
      <>
        <path d="M12 18V5a3 3 0 0 0-5.8-1A4 4 0 0 0 4 11a4 4 0 0 0 3 7h5Z" />
        <path d="M12 18V5a3 3 0 0 1 5.8-1A4 4 0 0 1 20 11a4 4 0 0 1-3 7h-5Z" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="10" cy="7" r="4" />
        <path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.6-1.4-2.4 1.4-1.1a7 7 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.6 1.4 2.4-1.4 1.1a7 7 0 0 1 0 2Z" />
      </>
    ),
    logout: (
      <>
        <path d="M10 17l5-5-5-5" />
        <path d="M15 12H3" />
        <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
      </>
    ),
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    collapse: (
      <>
        <path d="m15 18-6-6 6-6" />
        <path d="M4 4v16" />
      </>
    ),
    expand: (
      <>
        <path d="m9 18 6-6-6-6" />
        <path d="M20 4v16" />
      </>
    ),
    density: (
      <>
        <path d="M4 6h16M4 12h16M4 18h16" />
        <path d="M8 4v4M16 10v4M10 16v4" />
      </>
    ),
  };

  return (
    <svg
      className="soc-nav-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.grid}
    </svg>
  );
}

export default function AppShell({ title, actions, children }) {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [density, setDensity] = useState("comfortable");
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/");
    } else {
      setUser(getUser());
    }
  }, [router]);

  if (!user) return null;

  function logout() {
    // The API uses stateless bearer tokens and has no logout endpoint. Signing
    // out locally removes the only browser-held session material.
    if (signingOut) return;
    setSigningOut(true);
    clearSession();
    router.replace("/");
  }

  const initials = (user.full_name || user.username || "NS")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <MotionConfig reducedMotion="user">
      <div className="soc-app" data-density={density}>
        <a className="soc-skip-link" href="#main-content">
          Skip to main content
        </a>

        {menuOpen && (
          <button
            className="soc-mobile-backdrop"
            type="button"
            onClick={() => setMenuOpen(false)}
            aria-label="Close navigation menu"
          />
        )}

        <motion.aside
          className={`soc-sidebar ${
            collapsed ? "is-collapsed" : ""
          } ${menuOpen ? "is-open" : ""}`}
          initial={false}
          animate={{ width: collapsed ? 76 : 256 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <Link
            href="/dashboard"
            className="soc-brand"
            onClick={() => setMenuOpen(false)}
            aria-label="NetShield AI overview"
          >
            <span className="soc-brand-mark">
              <ShieldMark />
            </span>

            <span className="soc-brand-copy">
              <strong>NetShield AI</strong>
              <small>SOC COMMAND CENTER</small>
            </span>
          </Link>

          <nav className="soc-nav" aria-label="Main navigation">
            <span className="soc-nav-label">Workspace</span>

            {NAV.filter((item) => can(user, item.role)).map((item) => {
              const active =
                pathname === item.href ||
                pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={`soc-nav-link ${active ? "active" : ""}`}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                >
                  <NavIcon name={item.icon} />
                  <span className="soc-nav-text">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="soc-sidebar-footer">
            <div
              className="soc-user-card"
              title={
                collapsed
                  ? `${user.full_name || user.username} · ${formatRole(user.role)}`
                  : undefined
              }
            >
              <span className="soc-avatar" aria-hidden="true">
                {initials}
              </span>

              <span className="soc-user-copy">
                <strong>{user.full_name || user.username}</strong>
                <small>{formatRole(user.role)}</small>
              </span>
            </div>

            <button
              onClick={logout}
              disabled={signingOut}
              className="btn btn-ghost soc-logout"
              title="Sign out"
            >
              <NavIcon name="logout" />
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </motion.aside>

        <div className="soc-main">
          <header className="soc-topbar">
            <div className="soc-topbar-left">
              <button
                className="soc-icon-button soc-mobile-toggle"
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-label="Toggle navigation"
                aria-expanded={menuOpen}
              >
                <NavIcon name="menu" />
              </button>

              <button
                className="soc-icon-button soc-desktop-collapse"
                type="button"
                onClick={() => setCollapsed((value) => !value)}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                aria-pressed={collapsed}
              >
                <NavIcon name={collapsed ? "expand" : "collapse"} />
              </button>

              <div className="soc-page-heading">
                <span className="soc-breadcrumb">
                  Security operations / Workspace
                </span>
                <h1>{title}</h1>
              </div>
            </div>

            <div className="soc-topbar-right">
              <div className="soc-topbar-actions">{actions}</div>

              <button
                className="btn btn-ghost soc-density-button"
                type="button"
                onClick={() =>
                  setDensity((value) =>
                    value === "comfortable" ? "compact" : "comfortable"
                  )
                }
                aria-pressed={density === "compact"}
                aria-label={`Switch to ${
                  density === "compact" ? "comfortable" : "compact"
                } table density`}
                title={`Table density: ${density}`}
              >
                <NavIcon name="density" />
                <span className="density-short">D</span>
                <span className="density-long">
                  {density === "compact" ? "Compact" : "Comfortable"}
                </span>
              </button>
            </div>
          </header>

          <main id="main-content" className="soc-main-content">
            {children}
          </main>

          <Footer />
        </div>
      </div>
    </MotionConfig>
  );
}

function ShieldMark() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="m8.5 12.5 2.2 2.2 4.8-5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Shield() {
  return (
    <span className="soc-brand-mark">
      <ShieldMark />
    </span>
  );
}

export function Footer() {
  return (
    <footer className="soc-footer">
      NetShield AI <span aria-hidden="true">·</span> Network security monitoring
    </footer>
  );
}
