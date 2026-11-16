
import { useEffect, useState } from "react";
import API from "../services/api";
import Sidebar from "../components/Sidebar";
import "./Teams.css";

function Teams() {
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [users, setUsers] = useState([]);
    const [selectedUsers, setSelectedUsers] = useState({});

    const [form, setForm] = useState({
        team_name: "",
        description: "",
    });

    const [editingTeam, setEditingTeam] = useState(null);

    const [editForm, setEditForm] = useState({
        team_name: "",
        description: "",
    });

    // Fetch all teams
    const fetchTeams = async () => {
        try {
            const response = await API.get("/teams/");
            setTeams(response.data);
        } catch (err) {
            setError(
                err.response?.data?.detail || "Unable to fetch teams."
            );
        } finally {
            setLoading(false);
        }
    };

    // Fetch users
    const fetchUsers = async () => {
        try {
            const response = await API.get("/users/");
            setUsers(response.data);
        } catch (err) {
            setError(
                err.response?.data?.detail || "Unable to fetch users."
            );
        }
    };

    useEffect(() => {
        fetchTeams();
        fetchUsers();
    }, []);

    // Handle create form changes
    const handleChange = (e) => {
        setForm({
            ...form,
            [e.target.name]: e.target.value,
        });
    };

    // Create team
    const handleCreateTeam = async (e) => {
        e.preventDefault();
        setError("");
        setMessage("");

        try {
            await API.post("/teams/", form);

            setMessage("Team created successfully!");

            setForm({
                team_name: "",
                description: "",
            });

            await fetchTeams();
        } catch (err) {
            setError(
                err.response?.data?.detail || "Unable to create team."
            );
        }
    };

    // Edit team
    const handleEditClick = (team) => {
        setEditingTeam(team.id);

        setEditForm({
            team_name: team.team_name,
            description: team.description || "",
        });
    };

    const handleEditChange = (e) => {
        setEditForm({
            ...editForm,
            [e.target.name]: e.target.value,
        });
    };

    const handleUpdateTeam = async (e) => {
        e.preventDefault();

        setError("");
        setMessage("");

        try {
            await API.put(`/teams/${editingTeam}`, editForm);

            setMessage("Team updated successfully!");
            setEditingTeam(null);

            await fetchTeams();
        } catch (err) {
            setError(
                err.response?.data?.detail || "Unable to update team."
            );
        }
    };

    // Assign team member
    const handleAssignMember = async (teamId) => {
        const userId = selectedUsers[teamId];

        if (!userId) {
            setError("Please select a user first.");
            return;
        }

        setError("");
        setMessage("");

        try {
            await API.post(`/teams/${teamId}/members`, {
                user_id: Number(userId),
            });

            setMessage("Team member assigned successfully!");

            setSelectedUsers({
                ...selectedUsers,
                [teamId]: "",
            });

            await fetchTeams();
        } catch (err) {
            setError(
                err.response?.data?.detail ||
                "Unable to assign team member."
            );
        }
    };

    // Remove team member
    const handleRemoveMember = async (teamId, userId) => {
        const confirmRemove = window.confirm(
            "Are you sure you want to remove this member from the team?"
        );

        if (!confirmRemove) return;

        setError("");
        setMessage("");

        try {
            await API.delete(
                `/teams/${teamId}/members/${userId}`
            );

            setMessage("Team member removed successfully!");

            await fetchTeams();
        } catch (err) {
            setError(
                err.response?.data?.detail ||
                "Unable to remove team member."
            );
        }
    };

    return (
        <div className="app-layout">
            <Sidebar />

            <main className="main-content">
                <header className="topbar">
                    <div>
                        <h2>Team Management</h2>
                        <p>Organize and manage security teams</p>
                    </div>
                </header>

                <section className="dashboard-content">
                    <h1>Teams</h1>

                    <p className="dashboard-subtitle">
                        Create and manage platform teams.
                    </p>

                    <div className="team-form-container">
                        <h2>Create New Team</h2>

                        <form onSubmit={handleCreateTeam}>
                            <label>Team Name</label>

                            <input
                                name="team_name"
                                value={form.team_name}
                                onChange={handleChange}
                                minLength={2}
                                maxLength={100}
                                required
                            />

                            <label>Description</label>

                            <textarea
                                name="description"
                                value={form.description}
                                onChange={handleChange}
                                maxLength={255}
                                rows={3}
                            />

                            <button type="submit">
                                Create Team
                            </button>
                        </form>

                        {message && (
                            <p className="success-message">{message}</p>
                        )}

                        {error && (
                            <p className="error-message">{error}</p>
                        )}
                    </div>

                    {/* Edit Team Form */}
                    {editingTeam && (
                        <div className="team-form-container">
                            <h2>Edit Team</h2>

                            <form onSubmit={handleUpdateTeam}>
                                <label>Team Name</label>

                                <input
                                    name="team_name"
                                    value={editForm.team_name}
                                    onChange={handleEditChange}
                                    minLength={2}
                                    maxLength={100}
                                    required
                                />

                                <label>Description</label>

                                <textarea
                                    name="description"
                                    value={editForm.description}
                                    onChange={handleEditChange}
                                    maxLength={255}
                                    rows={3}
                                />

                                <button type="submit">
                                    Save Changes
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setEditingTeam(null)}
                                >
                                    Cancel
                                </button>
                            </form>
                        </div>
                    )}

                    {/* Registered Teams */}
                    <div className="team-list-container">
                        <h2>Registered Teams</h2>

                        {loading ? (
                            <p>Loading teams...</p>
                        ) : error ? (
                            <p className="error-message">{error}</p>
                        ) : teams.length === 0 ? (
                            <p>No teams found.</p>
                        ) : (
                            <div className="team-grid">
                                {teams.map((team) => (
                                    <div
                                        className="team-card"
                                        key={team.id}
                                    >
                                        <h3>{team.team_name}</h3>

                                        <p>
                                            {team.description ||
                                                "No description provided."}
                                        </p>

                                        {/* Team Members */}
                                        <div className="team-members">
                                            <h4>Team Members</h4>

                                            {team.members &&
                                            team.members.length > 0 ? (
                                                <ul>
                                                    {team.members.map(
                                                        (member) => (
                                                            <li key={member.id}>
                                                                <div className="member-info">
                                                                    <div>
                                                                        <strong>
                                                                            {member.full_name}
                                                                        </strong>

                                                                        <span>
                                                                            {" "}({member.username})
                                                                        </span>
                                                                    </div>

                                                                    <button
                                                                        type="button"
                                                                        className="remove-member-btn"
                                                                        onClick={() =>
                                                                            handleRemoveMember(
                                                                                team.id,
                                                                                member.id
                                                                            )
                                                                        }
                                                                    >
                                                                        Remove
                                                                    </button>
                                                                </div>
                                                            </li>
                                                        )
                                                    )}
                                                </ul>
                                            ) : (
                                                <p>
                                                    No members assigned yet.
                                                </p>
                                            )}
                                        </div>

                                        <span>Team ID: {team.id}</span>

                                        <button
                                            onClick={() =>
                                                handleEditClick(team)
                                            }
                                        >
                                            Edit Team
                                        </button>

                                        {/* Assign Team Member */}
                                        <h4>Assign Team Member</h4>

                                        <select
                                            value={
                                                selectedUsers[team.id] || ""
                                            }
                                            onChange={(e) =>
                                                setSelectedUsers({
                                                    ...selectedUsers,
                                                    [team.id]: e.target.value,
                                                })
                                            }
                                        >
                                            <option value="">
                                                Select a user
                                            </option>

                                            {users
                                                .filter(
                                                    (user) => user.is_active
                                                )
                                                .map((user) => (
                                                    <option
                                                        key={user.id}
                                                        value={user.id}
                                                    >
                                                        {user.full_name} (
                                                        {user.username})
                                                    </option>
                                                ))}
                                        </select>

                                        <button
                                            onClick={() =>
                                                handleAssignMember(team.id)
                                            }
                                        >
                                            Assign Member
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>
            </main>
        </div>
    );
}

export default Teams;
