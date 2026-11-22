"use client";

import { useState } from "react";
import AppShell from "@/components/AppShell";
import { Empty, ErrorNote, Panel } from "@/components/ui";
import { api, can, getUser } from "@/lib/api";
import { usePolling } from "@/lib/usePolling";

export default function TeamsPage() {
  const user = getUser();
  const teams = usePolling(() => api("/api/teams"), 30000);
  const [form, setForm] = useState({ name: "", description: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function createTeam(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await api("/api/teams", { method: "POST", body: form });
      setForm({ name: "", description: "" });
      setMessage("Team created.");
      teams.refresh();
    } catch (exception) {
      setError(exception.message || "Unable to create the team.");
    }
  }

  return (
    <AppShell title="Teams">
      <ErrorNote message={error || teams.error} />
      {message && <p className="mb-4 text-sm text-sev-low" role="status">{message}</p>}

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Security teams" subtitle="Teams organize analysts and administrators.">
          {!teams.data ? <Empty>Loading teams...</Empty> : teams.data.length === 0 ? <Empty>No teams have been created.</Empty> : (
            <div className="space-y-3">
              {teams.data.map((team) => (
                <article key={team.id} className="rounded-xl border border-rule bg-panel/60 p-4">
                  <h2 className="font-semibold">{team.name}</h2>
                  <p className="mt-1 text-sm text-muted">{team.description || "No description provided."}</p>
                </article>
              ))}
            </div>
          )}
        </Panel>

        {can(user, "admin") && (
          <Panel title="Create a team" subtitle="Administrator access required.">
            <form className="space-y-3" onSubmit={createTeam}>
              <label className="label" htmlFor="team-name">Team name</label>
              <input id="team-name" className="input" value={form.name} minLength={2} maxLength={100} required
                onChange={(event) => setForm({ ...form, name: event.target.value })} />
              <label className="label" htmlFor="team-description">Description</label>
              <textarea id="team-description" className="input min-h-24" value={form.description} maxLength={255}
                onChange={(event) => setForm({ ...form, description: event.target.value })} />
              <button className="btn-primary" type="submit">Create team</button>
            </form>
          </Panel>
        )}
      </div>
    </AppShell>
  );
}
