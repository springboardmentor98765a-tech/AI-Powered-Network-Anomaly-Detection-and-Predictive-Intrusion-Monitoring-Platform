
import { useEffect, useState } from "react";
import API from "../services/api";
import Sidebar from "../components/Sidebar";
import "./Roles.css";

function Roles() {
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const fetchRoles = async () => {
        try {
            const response = await API.get("/roles/");
            setRoles(response.data);
        } catch (err) {
            setError(
                err.response?.data?.detail || "Unable to fetch roles."
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRoles();
    }, []);

    return (
        <div className="app-layout">
            <Sidebar />

            <main className="main-content">
                <header className="topbar">
                    <div>
                        <h2>Role Management</h2>
                        <p>Manage platform roles and permissions</p>
                    </div>
                </header>

                <section className="dashboard-content">
                    <h1>Roles</h1>

                    <p className="dashboard-subtitle">
                        View available roles and their assigned users.
                    </p>

                    {loading ? (
                        <p>Loading roles...</p>
                    ) : error ? (
                        <p className="error-message">{error}</p>
                    ) : roles.length === 0 ? (
                        <p>No roles found.</p>
                    ) : (
                        <div className="roles-grid">
                            {roles.map((role) => (
                                <div className="role-card" key={role.id}>
                                    <div className="role-card-header">
                                        <h3>{role.role_name}</h3>
                                        <span>Role ID: {role.id}</span>
                                    </div>

                                    <p className="role-description">
                                        {role.description ||
                                            "No description available."}
                                    </p>

                                    <div className="role-users">
                                        <h4>
                                            Assigned Users (
                                            {role.users.length})
                                        </h4>

                                        {role.users.length > 0 ? (
                                            <ul>
                                                {role.users.map((user) => (
                                                    <li key={user.id}>
                                                        <strong>
                                                            {user.full_name}
                                                        </strong>
                                                        <span>
                                                            {" "}({user.username})
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p>No users assigned to this role.</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}

export default Roles;
