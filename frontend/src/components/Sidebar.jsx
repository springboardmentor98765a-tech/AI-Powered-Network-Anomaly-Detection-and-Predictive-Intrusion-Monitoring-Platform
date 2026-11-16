
import { NavLink } from "react-router-dom";
import "./Sidebar.css";

function Sidebar() {
    const links = [
        { name: "Dashboard", path: "/dashboard", icon: "▦" },
        { name: "User Management", path: "/users", icon: "♙" },
        { name: "Role Management", path: "/roles", icon: "♜" },
        { name: "Team Management", path: "/teams", icon: "♧" },
        { name: "Audit Logs", path: "/audit", icon: "◷" },
    ];

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <h2>NETGUARD</h2>
                <p>Security Platform</p>
            </div>

            <p className="menu-heading">MAIN MENU</p>

            <nav className="sidebar-nav">
                {links.map((link) => (
                    <NavLink
                        key={link.path}
                        to={link.path}
                        className={({ isActive }) =>
                            isActive ? "nav-link active" : "nav-link"
                        }
                    >
                        <span className="nav-icon">{link.icon}</span>
                        {link.name}
                    </NavLink>
                ))}
            </nav>

            <div className="sidebar-footer">
                Network Anomaly Detection
            </div>
        </aside>
    );
}

export default Sidebar;
