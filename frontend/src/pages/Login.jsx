import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/api";

// Set in frontend/.env
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// ---------- Small icons (inline SVG) ----------

function BrandShield({ size = 52, gid = "g1" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#20C5F5" />
          <stop offset="1" stopColor="#6366F1" />
        </linearGradient>
      </defs>
      <path
        d="M32 4 56 12v18c0 16-10 26-24 30C18 56 8 46 8 30V12L32 4Z"
        fill="#0D2045"
        stroke={`url(#${gid})`}
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path d="M26 29v-5a6 6 0 0 1 12 0v5" stroke="#3B9BFF" strokeWidth="4" fill="none" strokeLinecap="round" />
      <rect x="22" y="29" width="20" height="16" rx="3" fill="#3B9BFF" />
      <circle cx="32" cy="37" r="2.5" fill="#0D2045" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="46" height="32" viewBox="0 0 64 44" fill="#1677E8" aria-hidden="true">
      <circle cx="32" cy="12" r="10" />
      <path d="M14 42c0-11 8-18 18-18s18 7 18 18H14Z" />
      <circle cx="12" cy="17" r="7" opacity="0.85" />
      <path d="M0 40c0-8 5-13 12-13 2 0 4 .4 5 1-4 3-6 7-6 12H0Z" opacity="0.85" />
      <circle cx="52" cy="17" r="7" opacity="0.85" />
      <path d="M64 40c0-8-5-13-12-13-2 0-4 .4-5 1 4 3 6 7 6 12h11Z" opacity="0.85" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#64748B" aria-hidden="true">
      <circle cx="12" cy="8" r="4.2" />
      <path d="M3.5 21c0-4.7 3.8-8 8.5-8s8.5 3.3 8.5 8H3.5Z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#64748B" aria-hidden="true">
      <path d="M7 10V7a5 5 0 0 1 10 0v3h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h1Zm2 0h6V7a3 3 0 0 0-6 0v3Z" />
    </svg>
  );
}

function EyeIcon({ off }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M3 3l18 18" />}
    </svg>
  );
}

function LoginArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2 20 5v6c0 5-3.4 9.3-8 11-4.6-1.7-8-6-8-11V5l8-3Z" fill="#1677E8" />
      <path d="m8 12 3 3 5-6" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Subtle network + shield illustration for the left panel
function HeroIllustration() {
  const nodes = [[40, 110], [120, 50], [200, 150], [90, 215], [340, 60], [430, 130], [480, 55], [390, 225], [310, 255]];
  const links = [[0, 1], [1, 2], [0, 3], [2, 3], [2, 4], [4, 5], [5, 6], [5, 7], [7, 8], [2, 8], [1, 4]];
  return (
    <svg viewBox="0 0 520 300" width="100%" style={{ maxWidth: 400, display: "block" }} aria-hidden="true">
      <defs>
        <linearGradient id="g2" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#7DD3FC" />
          <stop offset="1" stopColor="#3B82F6" />
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="50%" r="50%">
          <stop stopColor="#1677E8" stopOpacity="0.5" />
          <stop offset="1" stopColor="#1677E8" stopOpacity="0" />
        </radialGradient>
      </defs>

      {links.map(([a, b], i) => (
        <line key={i} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]}
          stroke="#3B82F6" strokeOpacity="0.3" strokeWidth="1" />
      ))}
      {nodes.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="9" fill="#3B82F6" opacity="0.15" />
          <circle cx={x} cy={y} r="4" fill="#60A5FA" />
        </g>
      ))}

      <ellipse cx="260" cy="262" rx="150" ry="30" fill="url(#glow)" />
      <ellipse cx="260" cy="262" rx="130" ry="24" fill="none" stroke="#20C5F5" strokeOpacity="0.5" strokeWidth="2" />
      <ellipse cx="260" cy="262" rx="95" ry="17" fill="none" stroke="#20C5F5" strokeOpacity="0.7" strokeWidth="2" />
      <ellipse cx="260" cy="262" rx="60" ry="10" fill="none" stroke="#7DD3FC" strokeWidth="2" />

      <g transform="translate(190 20) scale(2.2)">
        <path d="M32 4 56 12v18c0 16-10 26-24 30C18 56 8 46 8 30V12L32 4Z"
          fill="#0D2045" stroke="url(#g2)" strokeWidth="3.5" strokeLinejoin="round" />
        <path d="M26 29v-5a6 6 0 0 1 12 0v5" stroke="#93C5FD" strokeWidth="4" fill="none" strokeLinecap="round" />
        <rect x="22" y="29" width="20" height="16" rx="3" fill="#93C5FD" />
        <circle cx="32" cy="37" r="2.5" fill="#0D2045" />
      </g>
    </svg>
  );
}

// ---------- The page ----------

export default function Login() {
  const { user, loading, login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState("login"); // "login" or "forgot"
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [showCreateInfo, setShowCreateInfo] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const googleBtn = useRef(null);
  const rememberRef = useRef(false);
  rememberRef.current = remember; // lets the Google callback read the latest value

  const handleGoogle = async (response) => {
    setError("");
    setSubmitting(true);
    try {
      await loginWithGoogle(response.credential, rememberRef.current);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.detail || "Google sign-in failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Draw Google's official sign-in button
  useEffect(() => {
    if (mode !== "login" || !GOOGLE_CLIENT_ID) return;
    let timer;
    let tries = 0;

    const setup = () => {
      if (!window.google?.accounts?.id) {
        // Google's script is still loading - try again shortly
        if (tries++ < 40) timer = setTimeout(setup, 250);
        return;
      }
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogle,
      });
      if (googleBtn.current) {
        window.google.accounts.id.renderButton(googleBtn.current, {
          theme: "outline",
          size: "large",
          width: 340,
          text: "continue_with",
          shape: "rectangular",
        });
      }
    };

    setup();
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Already logged in? Skip the login page.
  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  const switchMode = (newMode) => {
    setMode(newMode);
    setError("");
    setNotice("");
    setShowCreateInfo(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); // stop the browser from reloading the page
    setError("");
    setSubmitting(true);

    try {
      await login(identifier, password, remember);
      // The backend decides the role; the dashboard and menu adapt to it
      navigate("/dashboard");
    } catch (err) {
      if (err.response?.status === 422) {
        setError("Invalid username/email or password.");
      } else if (err.response?.status === 401) {
        // Same message from the backend for every kind of failure
        setError(err.response.data.detail);
      } else {
        setError("Unable to reach the server. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setSubmitting(true);
    try {
      const res = await api.post("/auth/forgot-password", { identifier });
      setNotice(res.data.message);
    } catch (err) {
      setError(
        err.response?.status === 422
          ? "Please enter a valid email or username."
          : "Unable to reach the server. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="nf-page" style={styles.page}>
      <style>{css}</style>

      {/* ----- Left: branding (52%) ----- */}
      <section className="nf-left" style={styles.left}>
        <div style={styles.brandRow}>
          <BrandShield size={52} gid="g1" />
          <div>
            <div style={styles.brandName}>
              Net<span style={{ color: "#3B9BFF" }}>Shield</span>
            </div>
            <div style={styles.brandTag}>Secure &nbsp;·&nbsp; Monitor &nbsp;·&nbsp; Protect</div>
          </div>
        </div>

        <h1 className="nf-headline" style={styles.headline}>
          AI-Powered <span style={{ color: "#3B9BFF" }}>Network</span> Anomaly Detection and
          Predictive Intrusion Monitoring Platform
        </h1>
        <p style={styles.sub}>Detect threats. Prevent attacks. Stay secure.</p>
        <div style={styles.rule} />

        <div className="nf-hero" style={styles.hero}>
          <HeroIllustration />
        </div>
      </section>

      {/* ----- Right: login card (48%) ----- */}
      <section className="nf-right" style={styles.right}>
        <div style={styles.card}>
          <div style={{ textAlign: "center" }}>
            <UsersIcon />
            <h2 style={styles.title}>{mode === "login" ? "Welcome Back!" : "Forgot Password?"}</h2>
            <p style={styles.subtitle}>
              {mode === "login"
                ? "Sign in to access your security dashboard"
                : "Enter your email or username. An administrator will be notified to reset your password."}
            </p>
          </div>

          {error && <div style={styles.error}>{error}</div>}
          {notice && <div style={styles.success}>{notice}</div>}

          {/* ===== Sign-in form ===== */}
          {mode === "login" && (
            <form onSubmit={handleSubmit}>
              <div className="nf-field" style={styles.field}>
                <UserIcon />
                <input
                  style={styles.input}
                  type="text"
                  placeholder="Email address or Username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>

              <div className="nf-field" style={styles.field}>
                <LockIcon />
                <input
                  style={styles.input}
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  style={styles.eyeButton}
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <EyeIcon off={showPassword} />
                </button>
              </div>

              <div style={styles.optionsRow}>
                <label style={styles.checkLabel}>
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    style={styles.checkbox}
                  />
                  Remember Me
                </label>
                <button type="button" style={styles.linkButton} onClick={() => switchMode("forgot")}>
                  Forgot Password?
                </button>
              </div>

              <button className="nf-login-btn" style={styles.loginButton} type="submit" disabled={submitting}>
                <LoginArrowIcon />
                {submitting ? "Signing in..." : "Login"}
              </button>

              <div style={styles.orRow}>
                <span style={styles.orLine} />
                <span style={styles.orText}>OR</span>
                <span style={styles.orLine} />
              </div>

              {GOOGLE_CLIENT_ID ? (
                <div style={{ display: "flex", justifyContent: "center", minHeight: 40 }}>
                  <div ref={googleBtn} />
                </div>
              ) : (
                <p style={{ ...styles.hint, textAlign: "center" }}>
                  Google sign-in is not configured yet.
                </p>
              )}

              <p style={styles.createRow}>
                Don't have an account?{" "}
                <button type="button" style={styles.linkButton}
                  onClick={() => setShowCreateInfo(!showCreateInfo)}>
                  Create Account
                </button>
              </p>

              {showCreateInfo && (
                <div style={styles.info}>
                  Accounts are created by your administrator. Please contact them to request access.
                </div>
              )}
            </form>
          )}

          {/* ===== Forgot-password form ===== */}
          {mode === "forgot" && (
            <form onSubmit={handleForgot}>
              <div className="nf-field" style={styles.field}>
                <UserIcon />
                <input
                  style={styles.input}
                  type="text"
                  placeholder="Email address or Username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>

              <button className="nf-login-btn" style={styles.loginButton} type="submit" disabled={submitting}>
                {submitting ? "Sending..." : "Request password reset"}
              </button>

              <p style={styles.createRow}>
                <button type="button" style={styles.linkButton} onClick={() => switchMode("login")}>
                  Back to sign in
                </button>
              </p>
            </form>
          )}

          <div style={styles.banner}>
            <ShieldCheckIcon />
            <div>
              <div style={styles.bannerTitle}>Your security is our priority</div>
              <div style={styles.bannerSub}>Powered by NetShield Security Platform</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// Font, focus effects and responsive rules (inline styles can't do these)
const css = `
  @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap");

  html, body { overflow-x: hidden; }

  .nf-page, .nf-page input, .nf-page button {
    font-family: "Inter", "Segoe UI", Arial, sans-serif;
  }
  .nf-field:focus-within {
    border-color: #1677E8 !important;
    box-shadow: 0 0 0 3px rgba(22, 119, 232, 0.15);
  }
  .nf-field input:focus {
    box-shadow: none !important;
    border: none !important;
    outline: none;
  }
  .nf-login-btn {
    transition: transform 0.15s, filter 0.15s;
  }
  .nf-login-btn:hover:not(:disabled) {
    filter: brightness(1.08);
    transform: translateY(-1px);
  }

  /* Tablet */
  @media (max-width: 1100px) {
    .nf-left { padding: 36px 32px !important; }
    .nf-headline { font-size: 24px !important; }
    .nf-hero { max-width: 300px !important; }
  }

  /* Mobile: stack the sections and hide the illustration */
  @media (max-width: 900px) {
    .nf-page { flex-direction: column !important; }
    .nf-left, .nf-right { flex: 0 0 auto !important; width: 100% !important; }
    .nf-left { padding: 28px 20px 8px !important; }
    .nf-hero { display: none !important; }
    .nf-headline { font-size: 21px !important; }
    .nf-right { padding: 16px 16px 32px !important; }
  }
`;

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    background:
      "radial-gradient(circle at 12% 100%, rgba(22,119,232,0.28), transparent 45%), " +
      "linear-gradient(160deg, #07152F 0%, #0D2045 100%)",
  },
  left: {
    flex: "0 0 52%",
    padding: "44px 56px",
    display: "flex",
    flexDirection: "column",
    color: "#FFFFFF",
  },
  brandRow: { display: "flex", alignItems: "center", gap: 14, marginBottom: 36 },
  brandName: { fontSize: 34, fontWeight: 700, lineHeight: 1.05, color: "#FFFFFF" },
  brandTag: { fontSize: 13, marginTop: 4, color: "#AFC4E5" },
  headline: {
    fontSize: 28,
    lineHeight: 1.3,
    fontWeight: 600,
    margin: "0 0 14px 0",
    color: "#FFFFFF",
    maxWidth: 550,
  },
  sub: { fontSize: 16, color: "#AFC4E5", margin: "0 0 14px 0" },
  rule: {
    width: 120,
    height: 3,
    borderRadius: 2,
    background: "linear-gradient(90deg, #20C5F5, transparent)",
  },
  hero: { marginTop: "auto", paddingTop: 28, width: "100%", maxWidth: 400 },
  right: {
    flex: "0 0 48%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 430,
    background: "#F8FAFF",
    borderRadius: 14,
    padding: 32,
    boxShadow: "0 20px 50px rgba(0,0,0,0.4)",
  },
  title: { margin: "6px 0 4px 0", fontSize: 28, fontWeight: 650, color: "#0B1B4A" },
  subtitle: { margin: "0 0 22px 0", color: "#475569", fontSize: 14, lineHeight: 1.4 },
  field: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    height: 46,
    padding: "0 14px",
    marginBottom: 14,
    border: "1px solid #D5DFED",
    borderRadius: 8,
    background: "#FFFFFF",
  },
  input: {
    flex: 1,
    border: "none",
    outline: "none",
    background: "transparent",
    fontSize: 14,
    color: "#0F172A",
    minWidth: 0,
  },
  eyeButton: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    padding: 0,
    display: "flex",
  },
  optionsRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  checkLabel: { display: "flex", alignItems: "center", gap: 8, color: "#0F172A", fontSize: 13, cursor: "pointer" },
  checkbox: { width: 16, height: 16, accentColor: "#1677E8", cursor: "pointer", margin: 0 },
  linkButton: {
    border: "none",
    background: "transparent",
    color: "#1677E8",
    fontSize: 13,
    cursor: "pointer",
    padding: 0,
  },
  loginButton: {
    width: "100%",
    height: 46,
    border: "none",
    borderRadius: 8,
    background: "linear-gradient(90deg, #1677E8, #1455CC)",
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  orRow: { display: "flex", alignItems: "center", gap: 12, margin: "16px 0" },
  orLine: { flex: 1, height: 1, background: "#E2E8F0" },
  orText: { color: "#64748B", fontSize: 12 },
  createRow: { textAlign: "center", color: "#0F172A", fontSize: 13, margin: "14px 0 14px 0" },
  hint: { color: "#64748B", fontSize: 12, margin: 0 },
  info: {
    background: "#EFF6FF",
    color: "#1E3A8A",
    border: "1px solid #BFDBFE",
    padding: 10,
    borderRadius: 8,
    fontSize: 12,
    marginBottom: 14,
  },
  banner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    background: "#E6EFFD",
    borderRadius: 8,
    padding: "10px 14px",
  },
  bannerTitle: { color: "#1455CC", fontWeight: 600, fontSize: 13 },
  bannerSub: { color: "#475569", fontSize: 11 },
  error: {
    background: "#FEF2F2",
    color: "#B91C1C",
    border: "1px solid #FECACA",
    padding: "8px 10px",
    borderRadius: 8,
    marginBottom: 14,
    fontSize: 13,
    textAlign: "center",
  },
  success: {
    background: "#F0FDF4",
    color: "#166534",
    border: "1px solid #BBF7D0",
    padding: "8px 10px",
    borderRadius: 8,
    marginBottom: 14,
    fontSize: 13,
    textAlign: "center",
  },
};