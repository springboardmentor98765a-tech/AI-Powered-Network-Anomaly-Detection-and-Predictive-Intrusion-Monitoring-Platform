
import { useEffect, useState } from "react";
import {
  UserRound,
  Mail,
  Shield,
  Clock,
  RefreshCw,
} from "lucide-react";
import api from "../services/api";
import "./AccountPages.css";

function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchProfile = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/auth/me");
      setProfile(response.data);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(
        typeof detail === "string"
          ? detail
          : "Unable to load your profile."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const formatDate = (value) => {
    if (!value) return "Not available";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "Not available"
      : date.toLocaleString();
  };

  if (loading) {
    return <div className="account-loading">Loading your profile...</div>;
  }

  if (error) {
    return (
      <div className="account-page">
        <div className="account-error">
          <p>{error}</p>
          <button onClick={fetchProfile}>Try Again</button>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="account-page">
      <div className="account-header">
        <div>
          <p className="account-eyebrow">ACCOUNT</p>
          <h1>My Profile</h1>
          <p>View your account information and assigned platform roles.</p>
        </div>

        <button
          className="account-refresh"
          onClick={fetchProfile}
          disabled={loading}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <section className="profile-card">
        <div className="profile-banner" />

        <div className="profile-main">
          <div className="profile-avatar">
            {profile.name?.charAt(0)?.toUpperCase() || "U"}
          </div>

          <div className="profile-identity">
            <h2>{profile.name}</h2>
            <span>@{profile.username}</span>
            <span className={`profile-status ${profile.status}`}>
              {profile.status}
            </span>
          </div>
        </div>

        <div className="profile-divider" />

        <div className="profile-details-grid">
          <div className="profile-detail">
            <div className="profile-detail-icon">
              <UserRound size={18} />
            </div>
            <div>
              <span>Full Name</span>
              <strong>{profile.name}</strong>
            </div>
          </div>

          <div className="profile-detail">
            <div className="profile-detail-icon">
              <UserRound size={18} />
            </div>
            <div>
              <span>Username</span>
              <strong>{profile.username}</strong>
            </div>
          </div>

          <div className="profile-detail">
            <div className="profile-detail-icon">
              <Mail size={18} />
            </div>
            <div>
              <span>Email Address</span>
              <strong>{profile.email}</strong>
            </div>
          </div>

          <div className="profile-detail">
            <div className="profile-detail-icon">
              <Clock size={18} />
            </div>
            <div>
              <span>Last Login</span>
              <strong>{formatDate(profile.last_login_at)}</strong>
            </div>
          </div>
        </div>

        <div className="profile-divider" />

        <div className="profile-roles">
          <div className="profile-roles-heading">
            <Shield size={18} />
            <h3>Assigned Roles</h3>
          </div>

          <div className="profile-role-list">
            {profile.roles?.length ? (
              profile.roles.map((role) => (
                <span className="profile-role-tag" key={role}>
                  <Shield size={13} />
                  {role}
                </span>
              ))
            ) : (
              <span className="profile-no-roles">No roles assigned</span>
            )}
          </div>
        </div>

        <p className="profile-note">
          Your account information and role assignments are managed by
          your platform administrator.
        </p>
      </section>
    </div>
  );
}

export default ProfilePage;
