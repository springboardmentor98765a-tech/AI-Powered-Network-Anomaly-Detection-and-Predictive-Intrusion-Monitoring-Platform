import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/api";

export default function Profile() {
  const { user, roles } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Check on the frontend first (quick feedback)
    if (newPassword !== confirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await api.put("/users/me/password", {
        current_password: currentPassword,
        new_password: newPassword,
      });

      // The backend revoked our token, so clear it and go to login
      setSuccess("Password changed. Redirecting to login...");
      localStorage.removeItem("token");
      sessionStorage.removeItem("token");
      setTimeout(() => {
        window.location.href = "/login";
      }, 1500);
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (err.response?.status === 422 && Array.isArray(detail)) {
        // Validation errors from Pydantic (e.g. password too weak)
        setError(detail[0].msg.replace("Value error, ", ""));
      } else if (typeof detail === "string") {
        setError(detail);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>My Profile</h2>

      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Account details</h3>
        <p>Name: {user.name}</p>
        <p>Username: {user.username}</p>
        <p>Email: {user.email}</p>
        <p>Status: {user.status}</p>
        <p style={{ textTransform: "capitalize" }}>
          Roles: {roles.map((r) => r.replace("_", " ")).join(", ")}
        </p>
        <p>Member since: {new Date(user.created_at).toLocaleDateString()}</p>
      </div>

      <form style={styles.card} onSubmit={handleSubmit}>
        <h3 style={styles.cardTitle}>Change password</h3>

        {error && <div style={styles.error}>{error}</div>}
        {success && <div style={styles.success}>{success}</div>}

        <label style={styles.label}>Current password</label>
        <input
          style={styles.input}
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          required
        />

        <label style={styles.label}>New password</label>
        <input
          style={styles.input}
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
        <small style={styles.hint}>
          At least 8 characters, with an uppercase letter, a lowercase letter and a number.
        </small>

        <label style={{ ...styles.label, marginTop: 16 }}>Confirm new password</label>
        <input
          style={styles.input}
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          required
        />

        <button style={styles.button} type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Change password"}
        </button>
      </form>
    </div>
  );
}

const styles = {
  card: {
    background: "#0D2045",
    border: "1px solid #1B3566",
    color: "#E5ECF8",
    padding: 20,
    borderRadius: 10,
    marginBottom: 16,
    maxWidth: 480,
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
  },
  cardTitle: { marginTop: 0, color: "#20C5F5" },
  label: { fontSize: 14, marginBottom: 6, color: "#AFC4E5" },
  input: {
    padding: 10,
    marginBottom: 8,
    borderRadius: 6,
    border: "1px solid #1F3A70",
    background: "#07152F",
    color: "#FFFFFF",
    fontSize: 15,
  },
  hint: { color: "#AFC4E5", marginBottom: 8 },
  button: {
    marginTop: 12,
    padding: 12,
    border: "none",
    borderRadius: 6,
    background: "#1677E8",
    color: "#FFFFFF",
    fontSize: 16,
    cursor: "pointer",
  },
  error: {
    background: "#3B1219",
    color: "#FCA5A5",
    border: "1px solid #7F1D1D",
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
    fontSize: 14,
  },
  success: {
    background: "#0F2E1D",
    color: "#86EFAC",
    border: "1px solid #166534",
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
    fontSize: 14,
  },
};