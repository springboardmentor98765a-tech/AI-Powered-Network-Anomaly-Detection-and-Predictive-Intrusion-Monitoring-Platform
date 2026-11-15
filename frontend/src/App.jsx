import React, { useState } from "react";
import {
  Activity, ShieldCheck, Eye, EyeOff, Mail, LockKeyhole, UserRound,
  Building2, ArrowRight, Github, Globe2, CheckCircle2, AlertCircle
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function App() {
  const [mode, setMode] = useState("login");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({ type: "", text: "" });
  const [form, setForm] = useState({
    full_name: "", email: "", password: "", confirm_password: "",
    role: "SECURITY_ANALYST", organization_name: ""
  });

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const switchMode = (next) => {
    setMode(next);
    setNotice({ type: "", text: "" });
    setShowPassword(false);
  };

  async function submit(e) {
    e.preventDefault();
    setNotice({ type: "", text: "" });

    if (mode === "signup" && form.password !== form.confirm_password) {
      setNotice({ type: "error", text: "The passwords do not match." });
      return;
    }
    setBusy(true);
    try {
      const endpoint = mode === "login" ? "/auth/login" : "/auth/register";
      const payload = mode === "login"
        ? { email: form.email, password: form.password }
        : {
            full_name: form.full_name,
            email: form.email,
            password: form.password,
            role: form.role,
            organization_name: form.organization_name || null
          };

      const response = await fetch(`${API}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Unable to complete your request.");
      setNotice({
        type: "success",
        text: mode === "login"
          ? "Login successful. Your secure session is active."
          : "Account created. Sign in when your account is ready."
      });
      if (mode === "login") {
        // Demo: verify the session with GET /auth/me. The backend stores the JWT in an HttpOnly cookie.
        const me = await fetch(`${API}/auth/me`, { credentials: "include" });
        if (me.ok) {
          const user = await me.json();
          setNotice({ type: "success", text: `Welcome, ${user.full_name}. Role: ${user.role}.` });
        }
      } else {
        switchMode("login");
      }
    } catch (err) {
      setNotice({ type: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  }

  function googleAuth() {
    window.location.href = `${API}/auth/google`;
  }

  return (
    <main className="page-shell">
      <section className="visual-panel">
        <div className="brand">
          <div className="brand-mark"><ShieldCheck size={25} /></div>
          <span>NETSHIELD<span className="brand-ai"> AI</span></span>
        </div>

        <div className="visual-copy">
          <div className="eyebrow"><span className="live-dot" /> INTELLIGENT THREAT MONITORING</div>
          <h1>See threats<br />before they <span>strike.</span></h1>
          <p className="visual-description">
            A unified security intelligence platform for monitoring network activity,
            detecting anomalies and responding to threats.
          </p>
          <div className="network-card">
            <div className="network-card-top">
              <span><Activity size={15} /> NETWORK ACTIVITY</span>
              <span className="live-label">LIVE PREVIEW</span>
            </div>
            <div className="activity-graph">
              {[28, 42, 35, 58, 44, 72, 50, 64, 40, 82, 55, 70, 46, 90, 62, 76, 48, 68, 38, 58, 45, 74, 52, 86].map((h, i) =>
                <i key={i} style={{ height: `${h}%` }} />
              )}
            </div>
            <div className="network-card-bottom">
              <span><b className="green-dot" /> Monitoring interface preview</span>
              <span>NETSHIELD / 01</span>
            </div>
          </div>
        </div>

        <div className="visual-footer">
          <div><CheckCircle2 size={15} /> Secure access</div>
          <div><CheckCircle2 size={15} /> Role-based permissions</div>
          <div><CheckCircle2 size={15} /> Activity auditing</div>
        </div>
        <div className="decor decor-one" /><div className="decor decor-two" />
      </section>

      <section className="form-panel">
        <div className="form-wrap">
          <div className="mobile-brand"><div className="brand-mark"><ShieldCheck size={22} /></div> NETSHIELD AI</div>
          <div className="form-heading">
            <div className="small-kicker">SECURE PORTAL <span>•</span> AUTHENTICATION</div>
            <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
            <p>{mode === "login" ? "Enter your credentials to access your workspace." : "Join your organization's security workspace."}</p>
          </div>

          <div className="mode-switch" role="tablist" aria-label="Authentication mode">
            <button className={mode === "login" ? "selected" : ""} onClick={() => switchMode("login")} role="tab">Log in</button>
            <button className={mode === "signup" ? "selected" : ""} onClick={() => switchMode("signup")} role="tab">Sign up</button>
          </div>

          <button className="google-button" onClick={googleAuth} type="button">
            <GoogleMark /> {mode === "login" ? "Continue with Google" : "Sign up with Google"}
          </button>
          <div className="divider"><span>OR CONTINUE WITH EMAIL</span></div>

          <form onSubmit={submit}>
            {mode === "signup" && <>
              <label>Full name</label>
              <div className="input-wrap"><UserRound size={17} /><input name="full_name" value={form.full_name} onChange={update} placeholder="Your full name" autoComplete="name" required /></div>
            </>}

            <label>Email address</label>
            <div className="input-wrap"><Mail size={17} /><input name="email" type="email" value={form.email} onChange={update} placeholder="name@company.com" autoComplete="email" required /></div>

            {mode === "signup" && <>
              <label>Account type</label>
              <div className="input-wrap select-wrap">
                <ShieldCheck size={17} />
                <select name="role" value={form.role} onChange={update}>
                  <option value="SECURITY_ANALYST">Security Analyst</option>
                  <option value="SOC_TEAM">SOC Team</option>
                  <option value="ENTERPRISE">Enterprise</option>
                </select>
              </div>
              {form.role === "ENTERPRISE" && <>
                <label>Organization name</label>
                <div className="input-wrap"><Building2 size={17} /><input name="organization_name" value={form.organization_name} onChange={update} placeholder="Your organization" required /></div>
              </>}
            </>}

            <div className="password-label">
              <label>Password</label>
              {mode === "login" && <button className="text-link" type="button" onClick={() => setNotice({ type: "info", text: "Password reset will be enabled in the next backend milestone." })}>Forgot password?</button>}
            </div>
            <div className="input-wrap">
              <LockKeyhole size={17} />
              <input name="password" type={showPassword ? "text" : "password"} value={form.password} onChange={update} placeholder="Enter your password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength="8" required />
              <button className="eye-button" type="button" onClick={() => setShowPassword(!showPassword)} aria-label="Toggle password visibility">
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>

            {mode === "signup" && <>
              <label>Confirm password</label>
              <div className="input-wrap"><LockKeyhole size={17} /><input name="confirm_password" type={showPassword ? "text" : "password"} value={form.confirm_password} onChange={update} placeholder="Re-enter your password" autoComplete="new-password" required /></div>
              <p className="helper-text">Use at least 8 characters. Never reuse your account password.</p>
            </>}

            {mode === "login" && <label className="remember-row"><input type="checkbox" /> <span>Remember this device</span></label>}

            {notice.text && <div className={`notice ${notice.type}`}><AlertCircle size={16} />{notice.text}</div>}

            <button className="submit-button" type="submit" disabled={busy}>
              {busy ? "Please wait..." : mode === "login" ? "Log in to NetShield" : "Create account"}
              {!busy && <ArrowRight size={17} />}
            </button>
          </form>

          <p className="switch-copy">
            {mode === "login" ? "New to NetShield AI?" : "Already have an account?"}
            <button onClick={() => switchMode(mode === "login" ? "signup" : "login")}>{mode === "login" ? "Create an account" : "Log in"}</button>
          </p>
          <div className="form-legal">By continuing, you agree to our <a href="#terms">Terms of Service</a> and <a href="#privacy">Privacy Policy</a>.</div>
          <div className="secure-note"><LockKeyhole size={13} /> Protected authentication environment</div>
        </div>
      </section>
    </main>
  );
}

function GoogleMark() {
  return <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.72 7.18l7.62 5.91c4.45-4.11 7.14-10.16 7.14-17.56z"/>
    <path fill="#FBBC05" d="M10.53 28.59a14.4 14.4 0 0 1 0-9.18l-7.98-6.19a24 24 0 0 0 0 21.56l7.98-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.89l-7.62-5.91c-2.12 1.42-4.84 2.26-8.29 2.26-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>;
}
