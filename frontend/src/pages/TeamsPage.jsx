
import { useCallback, useEffect, useState } from "react";

import {
  UsersRound,
  Users,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
  UserMinus,
  ShieldCheck,
  X,
  Network,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";

import api, { getApiError } from "../services/api";
import { useAuth } from "../context/AuthContext";

import "./TeamsPage.css";

const ADMIN = "Administrator";
const LEAD = "Team Lead / Supervisor";

export default function TeamsPage() {
  const { user } = useAuth();

  const roles = user?.roles || [];
  const isAdmin = roles.includes(ADMIN);
  const isLead = roles.includes(LEAD);

  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const [createForm, setCreateForm] = useState({
    team_name: "",
    description: "",
    team_lead_id: "",
  });

  const [editForm, setEditForm] = useState({
    team_name: "",
    description: "",
    team_lead_id: "",
  });

  const [memberId, setMemberId] = useState("");

  const canManage = (team) =>
    isAdmin || (isLead && team?.team_lead?.id === user?.id);

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  const loadTeams = useCallback(async (preserveSelection = true) => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/teams");
      const data = response.data;

      setTeams(data);

      if (preserveSelection && selectedTeam) {
        const updated = data.find(
          (team) => team.id === selectedTeam.id
        );

        setSelectedTeam(updated || null);
      } else if (data.length > 0) {
        setSelectedTeam(data[0]);
      } else {
        setSelectedTeam(null);
      }
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [selectedTeam]);

  useEffect(() => {
    loadTeams(false);
  }, []);

  const filteredTeams = teams.filter((team) =>
    team.team_name.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreateTeam = async (event) => {
    event.preventDefault();
    clearMessages();
    setActionLoading(true);

    try {
      const payload = {
        team_name: createForm.team_name.trim(),
        description: createForm.description.trim() || null,
        team_lead_id: createForm.team_lead_id
          ? Number(createForm.team_lead_id)
          : null,
      };

      await api.post("/teams", payload);

      setShowCreate(false);
      setCreateForm({
        team_name: "",
        description: "",
        team_lead_id: "",
      });

      setSuccess("Team created successfully.");
      await loadTeams(false);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const openEdit = () => {
    setEditForm({
      team_name: selectedTeam.team_name,
      description: selectedTeam.description || "",
      team_lead_id: selectedTeam.team_lead?.id || "",
    });

    setShowEdit(true);
    clearMessages();
  };

  const handleUpdateTeam = async (event) => {
    event.preventDefault();

    if (!selectedTeam) return;

    clearMessages();
    setActionLoading(true);

    try {
      const payload = {
        team_name: editForm.team_name.trim(),
        description: editForm.description.trim() || null,
      };

      // Only administrators can change the assigned team lead.
      if (isAdmin) {
        payload.team_lead_id = editForm.team_lead_id
          ? Number(editForm.team_lead_id)
          : null;
      }

      await api.patch(`/teams/${selectedTeam.id}`, payload);

      setShowEdit(false);
      setSuccess("Team updated successfully.");

      await loadTeams(true);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddMember = async (event) => {
    event.preventDefault();

    if (!selectedTeam || !memberId) return;

    clearMessages();
    setActionLoading(true);

    try {
      await api.post(
        `/teams/${selectedTeam.id}/members`,
        { user_id: Number(memberId) }
      );

      setMemberId("");
      setShowAddMember(false);

      setSuccess("Team member added successfully.");

      await loadTeams(true);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!selectedTeam) return;

    const confirmed = window.confirm(
      "Are you sure you want to remove this analyst from the team?"
    );

    if (!confirmed) return;

    clearMessages();
    setActionLoading(true);

    try {
      await api.delete(
        `/teams/${selectedTeam.id}/members/${userId}`
      );

      setSuccess("Team member removed successfully.");

      await loadTeams(true);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteTeam = async () => {
    if (!selectedTeam || !isAdmin) return;

    const confirmed = window.confirm(
      `Delete "${selectedTeam.team_name}"? This will also remove its team memberships.`
    );

    if (!confirmed) return;

    clearMessages();
    setActionLoading(true);

    try {
      await api.delete(`/teams/${selectedTeam.id}`);

      setSuccess("Team deleted successfully.");
      setSelectedTeam(null);

      await loadTeams(false);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="teams-page">

      {/* PAGE HEADER */}

      <div className="teams-heading">
        <div>
          <p className="page-eyebrow">WORKSPACE / TEAM OPERATIONS</p>

          <h1>Team Management</h1>

          <p className="page-description">
            Organize security analysts and oversee team assignments.
          </p>
        </div>

        <div className="teams-header-actions">
          <button
            className="teams-secondary-button"
            onClick={() => loadTeams(true)}
            disabled={loading}
          >
            <RefreshCw size={16} />
            Refresh
          </button>

          {isAdmin && (
            <button
              className="teams-primary-button"
              onClick={() => {
                clearMessages();
                setShowCreate(true);
              }}
            >
              <Plus size={17} />
              Create Team
            </button>
          )}
        </div>
      </div>

      {/* NOTIFICATIONS */}

      {error && (
        <div className="teams-alert error-alert">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button onClick={() => setError("")}>
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div className="teams-alert success-alert">
          <CheckCircle2 size={18} />
          <span>{success}</span>
          <button onClick={() => setSuccess("")}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* STATISTICS */}

      <div className="teams-stats">

        <div className="teams-stat-card">
          <div className="teams-stat-icon cyan-stat">
            <UsersRound size={21} />
          </div>

          <div>
            <span>Total Teams</span>
            <strong>{teams.length}</strong>
          </div>
        </div>

        <div className="teams-stat-card">
          <div className="teams-stat-icon blue-stat">
            <Users size={21} />
          </div>

          <div>
            <span>Total Memberships</span>
            <strong>
              {teams.reduce(
                (total, team) => total + team.members.length,
                0
              )}
            </strong>
          </div>
        </div>

        <div className="teams-stat-card">
          <div className="teams-stat-icon purple-stat">
            <ShieldCheck size={21} />
          </div>

          <div>
            <span>Assigned Team Leads</span>
            <strong>
              {teams.filter((team) => team.team_lead).length}
            </strong>
          </div>
        </div>

      </div>

      {/* MAIN CONTENT */}

      <div className="teams-workspace">

        {/* TEAM LIST */}

        <section className="teams-list-panel">

          <div className="teams-panel-heading">
            <div>
              <h2>All Teams</h2>
              <p>Select a team to view its details.</p>
            </div>

            <span className="teams-count">{filteredTeams.length}</span>
          </div>

          <div className="teams-search">
            <Search size={17} />

            <input
              placeholder="Search teams..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          {loading ? (
            <div className="teams-loading">
              <div className="loader" />
              <p>Loading teams...</p>
            </div>
          ) : filteredTeams.length === 0 ? (
            <div className="teams-empty">
              <UsersRound size={35} />
              <h3>No teams found</h3>
              <p>
                {search
                  ? "Try another search term."
                  : "No teams have been assigned to your account yet."}
              </p>
            </div>
          ) : (
            <div className="teams-list">

              {filteredTeams.map((team) => (
                <button
                  key={team.id}
                  className={`team-list-item ${
                    selectedTeam?.id === team.id ? "selected" : ""
                  }`}
                  onClick={() => {
                    setSelectedTeam(team);
                    clearMessages();
                  }}
                >
                  <div className="team-list-icon">
                    <Network size={20} />
                  </div>

                  <div className="team-list-info">
                    <strong>{team.team_name}</strong>

                    <span>
                      {team.members.length} members
                    </span>
                  </div>

                  <ChevronRight size={18} />
                </button>
              ))}

            </div>
          )}
        </section>

        {/* TEAM DETAILS */}

        <section className="team-details-panel">

          {!selectedTeam ? (
            <div className="teams-empty details-empty">
              <UsersRound size={40} />
              <h3>Select a team</h3>
              <p>
                Choose a team from the left panel to view its
                details and members.
              </p>
            </div>
          ) : (
            <>
              <div className="team-details-heading">

                <div className="team-details-title">
                  <div className="team-large-icon">
                    <Network size={25} />
                  </div>

                  <div>
                    <p className="page-eyebrow">
                      TEAM #{selectedTeam.id}
                    </p>

                    <h2>{selectedTeam.team_name}</h2>

                    <p>
                      {selectedTeam.description ||
                        "No team description provided."}
                    </p>
                  </div>
                </div>

                <div className="team-actions">

                  {canManage(selectedTeam) && (
                    <>
                      <button
                        className="teams-secondary-button"
                        onClick={openEdit}
                        disabled={actionLoading}
                      >
                        Edit
                      </button>

                      <button
                        className="teams-primary-button"
                        onClick={() => {
                          clearMessages();
                          setShowAddMember(true);
                        }}
                        disabled={actionLoading}
                      >
                        <UserPlus size={16} />
                        Add Member
                      </button>
                    </>
                  )}

                  {isAdmin && (
                    <button
                      className="teams-icon-danger"
                      title="Delete team"
                      onClick={handleDeleteTeam}
                      disabled={actionLoading}
                    >
                      <Trash2 size={17} />
                    </button>
                  )}

                </div>
              </div>

              <div className="team-lead-card">
                <div className="team-lead-icon">
                  <ShieldCheck size={20} />
                </div>

                <div>
                  <span>ASSIGNED TEAM LEAD</span>

                  <strong>
                    {selectedTeam.team_lead?.name || "Not assigned"}
                  </strong>

                  <small>
                    {selectedTeam.team_lead?.username || "—"}
                  </small>
                </div>
              </div>

              <div className="team-members-heading">
                <div>
                  <h3>Team Members</h3>
                  <p>
                    Analysts assigned to this team.
                  </p>
                </div>

                <span>
                  {selectedTeam.members.length} MEMBERS
                </span>
              </div>

              {selectedTeam.members.length === 0 ? (
                <div className="teams-empty members-empty">
                  <Users size={32} />
                  <h3>No members assigned</h3>
                  <p>
                    Add Security Analysts to this team to get started.
                  </p>
                </div>
              ) : (
                <div className="team-members-list">

                  {selectedTeam.members.map((member) => (
                    <div
                      className="team-member-row"
                      key={member.user_id}
                    >
                      <div className="member-avatar">
                        {member.name
                          ?.split(" ")
                          .map((part) => part[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </div>

                      <div className="member-information">
                        <strong>{member.name}</strong>
                        <span>{member.email}</span>
                      </div>

                      <div className="member-role">
                        {member.roles?.join(", ")}
                      </div>

                      {canManage(selectedTeam) && (
                        <button
                          className="member-remove-button"
                          title="Remove member"
                          disabled={actionLoading}
                          onClick={() =>
                            handleRemoveMember(member.user_id)
                          }
                        >
                          <UserMinus size={17} />
                        </button>
                      )}
                    </div>
                  ))}

                </div>
              )}
            </>
          )}
        </section>

      </div>

      {/* CREATE TEAM MODAL */}

      {showCreate && (
        <div
          className="teams-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowCreate(false);
            }
          }}
        >
          <div className="teams-modal">

            <div className="teams-modal-heading">
              <div>
                <h2>Create New Team</h2>
                <p>Set up a new security operations team.</p>
              </div>

              <button onClick={() => setShowCreate(false)}>
                <X size={19} />
              </button>
            </div>

            <form onSubmit={handleCreateTeam}>

              <label>Team Name</label>
              <input
                value={createForm.team_name}
                onChange={(event) =>
                  setCreateForm({
                    ...createForm,
                    team_name: event.target.value,
                  })
                }
                placeholder="e.g. Network Monitoring Team"
                minLength={2}
                maxLength={120}
                required
              />

              <label>Description</label>
              <textarea
                value={createForm.description}
                onChange={(event) =>
                  setCreateForm({
                    ...createForm,
                    description: event.target.value,
                  })
                }
                placeholder="Describe the team's responsibilities..."
                maxLength={500}
                rows={3}
              />

              <label>Team Lead User ID</label>
              <input
                type="number"
                min="1"
                value={createForm.team_lead_id}
                onChange={(event) =>
                  setCreateForm({
                    ...createForm,
                    team_lead_id: event.target.value,
                  })
                }
                placeholder="Enter an existing Team Lead user ID"
              />

              <p className="teams-form-hint">
                Leave empty if you want to assign a team lead later.
                The selected user must have the Team Lead role.
              </p>

              <div className="teams-modal-actions">
                <button
                  type="button"
                  className="teams-secondary-button"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="teams-primary-button"
                  disabled={actionLoading}
                >
                  {actionLoading ? "Creating..." : "Create Team"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* EDIT TEAM MODAL */}

      {showEdit && selectedTeam && (
        <div className="teams-modal-overlay">
          <div className="teams-modal">

            <div className="teams-modal-heading">
              <div>
                <h2>Edit Team</h2>
                <p>Update the team's information.</p>
              </div>

              <button onClick={() => setShowEdit(false)}>
                <X size={19} />
              </button>
            </div>

            <form onSubmit={handleUpdateTeam}>

              <label>Team Name</label>
              <input
                value={editForm.team_name}
                onChange={(event) =>
                  setEditForm({
                    ...editForm,
                    team_name: event.target.value,
                  })
                }
                minLength={2}
                maxLength={120}
                required
              />

              <label>Description</label>
              <textarea
                value={editForm.description}
                onChange={(event) =>
                  setEditForm({
                    ...editForm,
                    description: event.target.value,
                  })
                }
                maxLength={500}
                rows={3}
              />

              {isAdmin && (
                <>
                  <label>Team Lead User ID</label>
                  <input
                    type="number"
                    min="1"
                    value={editForm.team_lead_id}
                    onChange={(event) =>
                      setEditForm({
                        ...editForm,
                        team_lead_id: event.target.value,
                      })
                    }
                    placeholder="Leave empty to unassign"
                  />
                </>
              )}

              <div className="teams-modal-actions">
                <button
                  type="button"
                  className="teams-secondary-button"
                  onClick={() => setShowEdit(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="teams-primary-button"
                  disabled={actionLoading}
                >
                  {actionLoading ? "Saving..." : "Save Changes"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ADD MEMBER MODAL */}

      {showAddMember && selectedTeam && (
        <div className="teams-modal-overlay">
          <div className="teams-modal">

            <div className="teams-modal-heading">
              <div>
                <h2>Add Team Member</h2>
                <p>
                  Add an existing Security Analyst to{" "}
                  {selectedTeam.team_name}.
                </p>
              </div>

              <button onClick={() => setShowAddMember(false)}>
                <X size={19} />
              </button>
            </div>

            <form onSubmit={handleAddMember}>

              <label>Analyst User ID</label>

              <input
                type="number"
                min="1"
                value={memberId}
                onChange={(event) =>
                  setMemberId(event.target.value)
                }
                placeholder="Enter Security Analyst user ID"
                required
              />

              <p className="teams-form-hint">
                Only existing, active users with the Security Analyst
                role can be added. You can find their IDs in User
                Management.
              </p>

              <div className="teams-modal-actions">
                <button
                  type="button"
                  className="teams-secondary-button"
                  onClick={() => setShowAddMember(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="teams-primary-button"
                  disabled={actionLoading}
                >
                  {actionLoading ? "Adding..." : "Add Member"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
