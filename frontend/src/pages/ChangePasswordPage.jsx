
import { useState } from "react";
import { LockKeyhole, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import "./AccountPages.css";

function ChangePasswordPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  const [showPasswords, setShowPasswords] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const updateField = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const getErrorMessage = (err) => {
    const detail = err?.response?.data?.detail;

    if (typeof detail === "string") return detail;

    if (Array.isArray(detail)) {
      return detail.map((item) => item.msg).join(", ");
    }

    return "Unable to change password. Please try again.";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (form.new_password.length < 12) {
      setError("Your new password must contain at least 12 characters.");
      return;
    }

    if (form.new_password !== form.confirm_password) {
      setError("New password and confirmation do not match.");
      return;
    }

    if (form.current_password === form.new_password) {
      setError("Your new password must be different from your current password.");
      return;
    }

    setLoading(true);

    try {
      await api.post("/auth/change-password", {
        current_password: form.current_password,
        new_password: form.new_password,
      });

      window.alert(
        "Password changed successfully. Please log in again with your new password."
      );

      // The backend revokes all active sessions after changing the password.
      sessionStorage.clear();
      navigate("/login", { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="account-page">
      <div className="account-header">
        <div>
          <p className="account-eyebrow">ACCOUNT SECURITY</p>
          <h1>Change Password</h1>
          <p>Update your password to keep your NetShield account secure.</p>
        </div>
      </div>

      <section className="password-card">
        <div className="password-card-heading">
          <div className="password-icon">
            <LockKeyhole size={22} />
          </div>
          <div>
            <h2>Update Your Password</h2>
            <p>Enter your current password and choose a new one.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="password-form">
          <label>
            Current Password
            <div className="password-input-wrap">
              <input
                name="current_password"
                type={showPasswords ? "text" : "password"}
                value={form.current_password}
                onChange={updateField}
                placeholder="Enter current password"
                autoComplete="current-password"
                maxLength={128}
                required
              />
              <button
                type="button"
                onClick={() => setShowPasswords((value) => !value)}
                aria-label={showPasswords ? "Hide passwords" : "Show passwords"}
              >
                {showPasswords ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </label>

          <label>
            New Password
            <input
              name="new_password"
              type={showPasswords ? "text" : "password"}
              value={form.new_password}
              onChange={updateField}
              placeholder="Enter new password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          </label>

          <label>
            Confirm New Password
            <input
              name="confirm_password"
              type={showPasswords ? "text" : "password"}
              value={form.confirm_password}
              onChange={updateField}
              placeholder="Re-enter new password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          </label>

          <div className="password-requirements">
            <ShieldCheck size={17} />
            <div>
              <strong>Password requirements</strong>
              <p>At least 12 characters, with a maximum of 128 characters.</p>
              <p>Your new password must differ from your current password.</p>
            </div>
          </div>

          {error && <div className="account-error-message">{error}</div>}

          <button
            type="submit"
            className="password-submit"
            disabled={loading}
          >
            <LockKeyhole size={16} />
            {loading ? "Updating Password..." : "Change Password"}
          </button>
        </form>

        <p className="password-warning">
          For your security, changing your password will revoke all active
          sessions. You will need to log in again.
        </p>
      </section>
    </div>
  );
}

export default ChangePasswordPage;
