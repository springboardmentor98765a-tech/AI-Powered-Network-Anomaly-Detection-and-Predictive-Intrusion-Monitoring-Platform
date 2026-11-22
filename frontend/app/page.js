
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Footer, Shield } from "@/components/AppShell";
import { ErrorNote } from "@/components/ui";
import { api, getToken, saveSession } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [requestedRole, setRequestedRole] = useState("analyst");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (getToken()) router.replace("/dashboard");
  }, [router]);

  function switchMode(nextMode) {
    setMode(nextMode);
    setError("");
    setNotice("");
  }

  async function signIn(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const res = await api("/api/auth/login", {
        method: "POST",
        body: {
          username: identifier.trim(),
          password,
        },
      });

      saveSession(res.access_token, res.user);
      router.replace("/dashboard");
    } catch (err) {
      setError(err.message || "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  async function register(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setBusy(false);
      return;
    }

    try {
      const res = await api("/api/auth/register", {
        method: "POST",
        body: {
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          password,
          requested_role: requestedRole,
        },
      });

      setNotice(
        res.message ||
        "Account request submitted. Please wait for administrator approval."
      );

      setMode("login");
      setIdentifier(email.trim().toLowerCase());
      setPassword("");
      setFullName("");
      setEmail("");
      setConfirmPassword("");
      setRequestedRole("analyst");

    } catch (err) {
      setError(err.message || "Account registration failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 grid md:grid-cols-2">

        {/* Left information panel */}
        <div className="hidden md:flex flex-col justify-center px-14 border-r border-rule bg-panel/40">
          <Shield />

          <h1 className="mt-8 text-4xl font-semibold leading-tight max-w-md">
            See unusual network activity before it becomes an incident.
          </h1>

          <p className="mt-4 text-muted max-w-md leading-relaxed">
            NetShield AI watches network flows, analyses suspicious
            behaviour and helps security teams investigate threats.
          </p>
        </div>

        {/* Login and registration panel */}
        <div className="flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-md space-y-5">

            <div className="md:hidden mb-6">
              <Shield />
            </div>

            <div>
              <p className="text-xs text-muted uppercase tracking-widest">
                NETSHIELD AI
              </p>

              <h2 className="text-2xl font-semibold mt-2">
                {mode === "login"
                  ? "Sign in to your workspace"
                  : "Create your account"}
              </h2>

              <p className="text-sm text-muted mt-2">
                {mode === "login"
                  ? "Access your security monitoring workspace."
                  : "Register your details for administrator approval."}
              </p>
            </div>

            {/* Login / Create account tabs */}
            <div className="grid grid-cols-2 gap-2 border-b border-rule pb-2">
              <button
                type="button"
                onClick={() => switchMode("login")}
                className={`py-2 text-sm font-medium ${
                  mode === "login"
                    ? "text-signal border-b-2 border-signal"
                    : "text-muted"
                }`}
              >
                Sign in
              </button>

              <button
                type="button"
                onClick={() => switchMode("register")}
                className={`py-2 text-sm font-medium ${
                  mode === "register"
                    ? "text-signal border-b-2 border-signal"
                    : "text-muted"
                }`}
              >
                Create account
              </button>
            </div>

            {error && <ErrorNote message={error} />}

            {notice && (
              <div
                className="rounded-md border border-sev-low/40 bg-sev-low/10 p-3 text-sm text-sev-low"
                role="status"
              >
                {notice}
              </div>
            )}

            {/* SIGN IN FORM */}
            {mode === "login" && (
              <form onSubmit={signIn} className="space-y-4">

                <div>
                  <label className="label" htmlFor="identifier">
                    Email or username
                  </label>

                  <input
                    id="identifier"
                    className="input"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    autoComplete="username"
                    placeholder="Enter email or username"
                    required
                  />
                </div>

                <div>
                  <label className="label" htmlFor="login-password">
                    Password
                  </label>

                  <input
                    id="login-password"
                    type="password"
                    className="input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="Enter password"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="btn-primary w-full justify-center py-3"
                  disabled={busy}
                >
                  {busy ? "Signing in..." : "Sign in"}
                </button>

                <p className="text-xs text-muted text-center">
                  New to NetShield AI? Select Create account to register.
                </p>
              </form>
            )}

            {/* CREATE ACCOUNT FORM */}
            {mode === "register" && (
              <form onSubmit={register} className="space-y-3">

                <div>
                  <label className="label" htmlFor="full-name">
                    Full name
                  </label>

                  <input
                    id="full-name"
                    className="input"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    autoComplete="name"
                    placeholder="Enter your full name"
                    minLength={2}
                    maxLength={120}
                    required
                  />
                </div>

                <div>
                  <label className="label" htmlFor="register-email">
                    Email address
                  </label>

                  <input
                    id="register-email"
                    type="email"
                    className="input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    placeholder="name@example.com"
                    maxLength={120}
                    required
                  />
                </div>

                <div>
                  <label className="label" htmlFor="requested-role">
                    Select requested role
                  </label>

                  <select
                    id="requested-role"
                    className="input"
                    value={requestedRole}
                    onChange={(e) => setRequestedRole(e.target.value)}
                  >
                    <option value="analyst">Security Analyst</option>
                    <option value="team_lead">Team Lead / Supervisor</option>
                  </select>

                  <p className="text-xs text-muted mt-2">
                    Your requested role will be reviewed by an administrator.
                  </p>
                </div>

                <div>
                  <label className="label" htmlFor="register-password">
                    Password
                  </label>

                  <input
                    id="register-password"
                    type="password"
                    className="input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={72}
                    placeholder="Minimum 8 characters"
                    required
                  />
                </div>

                <div>
                  <label className="label" htmlFor="confirm-password">
                    Confirm password
                  </label>

                  <input
                    id="confirm-password"
                    type="password"
                    className="input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={72}
                    placeholder="Re-enter your password"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="btn-primary w-full justify-center py-3"
                  disabled={busy}
                >
                  {busy ? "Creating account..." : "Create new account"}
                </button>

                <p className="text-xs text-muted text-center">
                  Your account remains inactive until the administrator approves it.
                </p>

              </form>
            )}

          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
