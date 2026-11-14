// NetShield AI — Login page
// Developed by Krish | SKK Projects
"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Footer, Shield } from "@/components/AppShell";
import { ErrorNote } from "@/components/ui";
import { api, getToken, saveSession } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (getToken()) router.replace("/dashboard"); }, [router]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api("/api/auth/login", { method: "POST", body: { username, password } });
      saveSession(res.access_token, res.user);
      router.replace("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 grid md:grid-cols-2">
        <div className="hidden md:flex flex-col justify-center px-14 border-r border-rule bg-panel/40">
          <Shield />
          <h1 className="mt-8 text-4xl font-semibold leading-tight max-w-md">
            See unusual network activity before it becomes an incident.
          </h1>
          <p className="mt-4 text-muted max-w-md leading-relaxed">
            NetShield AI watches every network flow, scores its risk with machine learning,
            and raises prioritised alerts for your security team.
          </p>
        </div>
        <div className="flex items-center justify-center px-6 py-12">
          <form onSubmit={submit} className="w-full max-w-sm space-y-4">
            <div className="md:hidden mb-6"><Shield /></div>
            <h2 className="text-2xl font-semibold">Sign in</h2>
            <ErrorNote message={error} />
            <div>
              <label className="label" htmlFor="u">Username</label>
              <input id="u" className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
            </div>
            <div>
              <label className="label" htmlFor="p">Password</label>
              <input id="p" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
            </div>
            <button className="btn-primary w-full justify-center py-2" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</button>
            <p className="text-xs text-muted leading-relaxed">
              Demo accounts: admin / admin123, analyst / analyst123, viewer / viewer123
            </p>
          </form>
        </div>
      </div>
      <Footer />
    </div>
  );
}
