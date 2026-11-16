
import { useEffect, useState } from "react";
import API from "../services/api";
import Sidebar from "../components/Sidebar";
import "./Users.css";

function Users() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const [roleUser, setRoleUser] = useState(null);
    const [selectedRole, setSelectedRole] = useState("");

    const [editingUser, setEditingUser] = useState(null);
    const [editForm, setEditForm] = useState({
    full_name: "",
    username: "",
    email: "",
    });

    const [form, setForm] = useState({
        full_name: "",
        username: "",
        email: "",
        password: "",
        role: "Security Analyst",
    });

    const fetchUsers = async () => {
        try {
            const response = await API.get("/users/");
            setUsers(response.data);
        } catch (err) {
            setError(
                err.response?.data?.detail || "Unable to fetch users."
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleChange = (e) => {
        setForm({
            ...form,
            [e.target.name]: e.target.value,
        });
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setError("");
        setMessage("");

        try {
            await API.post("/users/", {
                full_name: form.full_name,
                username: form.username,
                email: form.email,
                password: form.password,
                roles: [form.role],
            });

            setMessage("User created successfully!");

            setForm({
                full_name: "",
                username: "",
                email: "",
                password: "",
                role: "Security Analyst",
            });

            fetchUsers();

        } catch (err) {
            setError(
                err.response?.data?.detail || "Unable to create user."
            );
        }
    };

    const handleEditClick = (user) => {
    setEditingUser(user.id);

    setEditForm({
        full_name: user.full_name,
        username: user.username,
        email: user.email,
    });
};

const handleEditChange = (e) => {
    setEditForm({
        ...editForm,
        [e.target.name]: e.target.value,
    });
};

const handleUpdateUser = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    try {
        await API.put(`/users/${editingUser}`, editForm);

        setMessage("User updated successfully!");
        setEditingUser(null);

        fetchUsers();
    } catch (err) {
        setError(
            err.response?.data?.detail || "Unable to update user."
        );
    }
};

const handleUpdateRole = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    try {
        await API.put(`/users/${roleUser}/roles`, {
            roles: [selectedRole],
        });

        setMessage("User role updated successfully!");
        setRoleUser(null);
        setSelectedRole("");
    } catch (err) {
        setError(
            err.response?.data?.detail || "Unable to update user role."
        );
    }
};

const handleToggleStatus = async (user) => {
    const newStatus = !user.is_active;

    const action = newStatus ? "activate" : "deactivate";

    if (!window.confirm(`Are you sure you want to ${action} this user?`)) {
        return;
    }

    setError("");
    setMessage("");

    try {
        await API.patch(`/users/${user.id}/status`, {
            is_active: newStatus,
        });

        setMessage(`User ${action}d successfully!`);

        fetchUsers();
    } catch (err) {
        setError(
            err.response?.data?.detail ||
            `Unable to ${action} user.`
        );
    }
};


const handlePasswordReset = async (user) => {
    const newPassword = window.prompt(
        `Enter a new password for ${user.username}:`
    );

    if (!newPassword) return;

    if (newPassword.length < 12) {
        alert("Password must contain at least 12 characters.");
        return;
    }

    setError("");
    setMessage("");

    try {
        await API.post(`/users/${user.id}/reset-password`, {
            new_password: newPassword,
        });

        setMessage(
            `Password reset successfully for ${user.username}.`
        );
    } catch (err) {
        setError(
            err.response?.data?.detail ||
            "Unable to reset password."
        );
    }
};


    return (
        <div className="app-layout">
            <Sidebar />

            <main className="main-content">
                <header className="topbar">
                    <div>
                        <h2>User Management</h2>
                        <p>Manage registered platform users</p>
                    </div>
                </header>

                <section className="dashboard-content">
                    <h1>Users</h1>

                    <p className="dashboard-subtitle">
                        Create and manage platform accounts.
                    </p>

                    <div className="create-user-container">
                        <h2>Create New User</h2>

                        <form onSubmit={handleCreateUser}>
                            <label>Full Name</label>
                            <input
                                name="full_name"
                                value={form.full_name}
                                onChange={handleChange}
                                minLength={2}
                                maxLength={100}
                                required
                            />

                            <label>Username</label>
                            <input
                                name="username"
                                value={form.username}
                                onChange={handleChange}
                                minLength={3}
                                maxLength={50}
                                required
                            />

                            <label>Email</label>
                            <input
                                type="email"
                                name="email"
                                value={form.email}
                                onChange={handleChange}
                                required
                            />

                            <label>Password</label>
                            <input
                                type="password"
                                name="password"
                                value={form.password}
                                onChange={handleChange}
                                minLength={12}
                                maxLength={128}
                                required
                            />

                            <label>Role</label>
                            <select
                                name="role"
                                value={form.role}
                                onChange={handleChange}
                            >
                                <option value="Security Analyst">
                                    Security Analyst
                                </option>
                                <option value="Team Lead / Supervisor">
                                    Team Lead / Supervisor
                                </option>
                                <option value="Administrator">
                                    Administrator
                                </option>
                            </select>

                            <button type="submit">
                                Create User
                            </button>
                        </form>

                        {message && (
                            <p className="success-message">{message}</p>
                        )}

                        {error && (
                            <p className="error-message">{error}</p>
                        )}
                    </div>

                    {editingUser && (
    <div className="create-user-container">
        <h2>Edit User</h2>

        <form onSubmit={handleUpdateUser}>
            <label>Full Name</label>
            <input
                name="full_name"
                value={editForm.full_name}
                onChange={handleEditChange}
                minLength={2}
                maxLength={100}
                required
            />

            <label>Username</label>
            <input
                name="username"
                value={editForm.username}
                onChange={handleEditChange}
                minLength={3}
                maxLength={50}
                required
            />

            <label>Email</label>
            <input
                type="email"
                name="email"
                value={editForm.email}
                onChange={handleEditChange}
                required
            />

            <button type="submit">Save Changes</button>

            <button
                type="button"
                onClick={() => setEditingUser(null)}
            >
                Cancel
            </button>
        </form>
    </div>
)}

{roleUser && (
    <div className="create-user-container">
        <h2>Update User Role</h2>

        <form onSubmit={handleUpdateRole}>
            <label>Select Role</label>

            <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                required
            >
                <option value="Security Analyst">
                    Security Analyst
                </option>

                <option value="Team Lead / Supervisor">
                    Team Lead / Supervisor
                </option>

                <option value="Administrator">
                    Administrator
                </option>
            </select>

            <button type="submit">
                Save Role
            </button>

            <button
                type="button"
                onClick={() => setRoleUser(null)}
            >
                Cancel
            </button>
        </form>
    </div>
)}

                    <div className="user-table-container">
                        <h2>Registered Users</h2>

                        {loading ? (
                            <p>Loading users...</p>
                        ) : (
                            <table className="user-table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Full Name</th>
                                        <th>Username</th>
                                        <th>Email</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {users.map((user) => (
                                        <tr key={user.id}>
                                            <td>{user.id}</td>
                                            <td>{user.full_name}</td>
                                            <td>{user.username}</td>
                                            <td>{user.email}</td>
                                            <td>
                                                <span className={
                                                    user.is_active
                                                        ? "active-status"
                                                        : "inactive-status"
                                                }>
                                                    {user.is_active
                                                        ? "Active"
                                                        : "Inactive"}
                                                </span>
                                            </td>
                                            <td>
    <button onClick={() => handleEditClick(user)}>
        Edit
    </button>

    <button
        onClick={() => {
            setRoleUser(user.id);
            setSelectedRole("Security Analyst");
        }}
    >
        Manage Role
    </button>
    <button
    onClick={() => handleToggleStatus(user)}
>
    {user.is_active ? "Deactivate" : "Activate"}
</button>

<button onClick={() => handlePasswordReset(user)}>
    Reset Password
</button>

</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </section>
            </main>
        </div>
    );
}

export default Users;
