// NetShield AI — Page frame: login guard, sidebar navigation and credit footer
// Developed by Krish | SKK Projects
"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { can, clearSession, getToken, getUser } from "@/lib/api";

const NAV = [
  { href: "/dashboard", label: "Overview", role: "viewer" },
  { href: "/traffic", label: "Network traffic", role: "viewer" },
  { href: "/alerts", label: "Alerts", role: "viewer" },
  { href: "/incidents", label: "Incidents", role: "viewer" },
  { href: "/intelligence", label: "Threat intelligence", role: "viewer" },
  { href: "/users", label: "Users and audit", role: "admin" },
];

export default function AppShell({ title, actions, children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!getToken()) router.replace("/");
    else setUser(getUser());
  }, [router]);

  if (!user) return null;

  const logout = () => { clearSession(); router.replace("/"); };

  return (
    <div className="min-h-screen md:flex">
      <aside className={`${menuOpen ? "block" : "hidden"} md:block md:w-60 shrink-0 border-r border-rule bg-panel/60`}>
        <div className="px-5 py-5 border-b border-rule">
          <Shield />
          <p className="mt-1 text-xs text-muted">Threat monitoring</p>
        </div>
        <nav className="p-3 space-y-1">
          {NAV.filter((n) => can(user, n.role)).map((n) => {
            const active = pathname.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} onClick={() => setMenuOpen(false)}
                className={`block rounded-md px-3 py-2 text-sm ${active ? "bg-signal/15 text-signal font-medium" : "text-fog/85 hover:bg-rule/50"}`}>
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 mt-4 border-t border-rule text-sm">
          <p className="font-medium">{user.full_name || user.username}</p>
          <p className="text-muted capitalize">{user.role}</p>
          <button onClick={logout} className="btn-ghost mt-3 w-full justify-center">Log out</button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 px-5 md:px-8 py-4 border-b border-rule">
          <div className="flex items-center gap-3">
            <button className="md:hidden btn-ghost" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">Menu</button>
            <h1 className="text-xl font-semibold">{title}</h1>
          </div>
          <div className="flex items-center gap-2">{actions}</div>
        </header>
        <main className="flex-1 px-5 md:px-8 py-6 space-y-6">{children}</main>
        <Footer />
      </div>
    </div>
  );
}

export function Shield() {
  return (
    <div className="flex items-center gap-2">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z" stroke="#4FB3C9" strokeWidth="1.8" />
        <path d="M8 12.5h2.2l1.3-3 2 6 1.3-3H16" stroke="#4FB3C9" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-lg font-semibold tracking-tight">NetShield AI</span>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="px-5 md:px-8 py-4 border-t border-rule text-xs text-muted">
      NetShield AI. Developed by Krish, SKK Projects.
    </footer>
  );
}
