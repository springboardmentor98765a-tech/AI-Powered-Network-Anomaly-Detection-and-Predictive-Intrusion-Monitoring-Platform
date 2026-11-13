
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Activity,
  ShieldCheck,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ArrowRight,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { getApiError } from "../services/api";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      await login(identifier.trim(), password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-decoration decoration-one" />
      <div className="login-decoration decoration-two" />

      <div className="login-container">
        <div className="login-brand">
          <div className="login-brand-icon">
            <Activity size={29} />
          </div>

          <div>
            <h1>NETSHIELD <span>AI</span></h1>
            <p>INTELLIGENT NETWORK SECURITY</p>
          </div>
        </div>

        <div className="login-card">
          <div className="login-icon">
            <ShieldCheck size={27} />
          </div>

          <p className="login-eyebrow">SECURE ACCESS PORTAL</p>
          <h2>Welcome back</h2>
          <p className="login-description">
            Sign in to access your security monitoring workspace.
          </p>

          <form onSubmit={handleSubmit}>
            <label htmlFor="identifier">Email or username</label>

            <div className="input-wrapper">
              <Mail size={18} />
              <input
                id="identifier"
                type="text"
                placeholder="Enter your email or username"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                required
                autoComplete="username"
              />
            </div>

            <label htmlFor="password">Password</label>

            <div className="input-wrapper">
              <LockKeyhole size={18} />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete="current-password"
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={
                  showPassword ? "Hide password" : "Show password"
                }
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {error && (
              <div className="login-error" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="login-submit"
              disabled={loading}
            >
              {loading ? "Authenticating..." : "Sign in to NetShield"}
              {!loading && <ArrowRight size={19} />}
            </button>
          </form>

          <div className="login-security">
            <ShieldCheck size={16} />
            <span>Protected authentication</span>
          </div>
        </div>

        <div className="login-footer">
          <span>NETSHIELD AI © 2026</span>
          <span>NETWORK THREAT MONITORING PLATFORM</span>
        </div>
      </div>
    </div>
  );
}
