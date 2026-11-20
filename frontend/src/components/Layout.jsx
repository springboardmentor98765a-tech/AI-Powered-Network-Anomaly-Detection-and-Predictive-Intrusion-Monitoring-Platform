import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Each menu item lists which roles may see it.
const MENU = [
  { label: "Dashboard", path: "/dashboard", roles: null }, // null = everyone
  { label: "My Profile", path: "/profile", roles: null },
  { label: "User Management", path: "/users", roles: ["administrator"] },
  { label: "Roles & Permissions", path: "/roles", roles: ["administrator"] },
  {
    label: "Teams",
    path: "/teams",
    roles: ["administrator", "team_lead", "security_analyst"],
  },
  {
    label: "Audit Logs",
    path: "/audit-logs",
    roles: ["administrator", "team_lead"],
  },
];

export default function Layout() {
  const { user, roles, hasRole, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  // Keep only the menu items this user is allowed to see
  const visibleMenu = MENU.filter((item) => !item.roles || hasRole(...item.roles));

  return (
    <div style={styles.wrapper}>
      <aside style={styles.sidebar}>
        <h3 style={styles.brand}>
          Net<span style={{ color: "#3B9BFF" }}>Shield</span>
        </h3>

        <nav style={styles.nav}>
          {visibleMenu.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              style={({ isActive }) => ({
                ...styles.link,
                background: isActive ? "#1677E8" : "transparent",
                color: isActive ? "#FFFFFF" : "#AFC4E5",
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div style={styles.footer}>
          <div style={styles.userName}>{user.name}</div>
          <div style={styles.userRole}>
            {roles.map((r) => r.replace("_", " ")).join(", ")}
          </div>
          <button style={styles.logout} onClick={handleLogout}>
            Logout
          </button>
        </div>
      </aside>

      {/* The current page is shown here */}
      <main style={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}

const styles = {
  wrapper: { display: "flex", minHeight: "100vh", background: "#07152F" },
  sidebar: {
    width: 240,
    background: "#050F26",
    borderRight: "1px solid #1B3566",
    padding: 20,
    display: "flex",
    flexDirection: "column",
  },
  brand: { margin: "0 0 24px 0", fontSize: 22, fontWeight: 700, color: "#FFFFFF" },
  nav: { display: "flex", flexDirection: "column", gap: 6, flex: 1 },
  link: {
    padding: "10px 12px",
    borderRadius: 6,
    textDecoration: "none",
    fontSize: 15,
  },
  footer: { borderTop: "1px solid #1B3566", paddingTop: 16 },
  userName: { fontWeight: 600, color: "#FFFFFF" },
  userRole: {
    fontSize: 13,
    color: "#AFC4E5",
    marginBottom: 12,
    textTransform: "capitalize",
  },
  logout: {
    width: "100%",
    padding: 10,
    border: "1px solid #24437F",
    borderRadius: 6,
    background: "#0D2045",
    color: "#FFFFFF",
    cursor: "pointer",
  },
  main: { flex: 1, padding: 30, background: "#07152F", minWidth: 0 },
};