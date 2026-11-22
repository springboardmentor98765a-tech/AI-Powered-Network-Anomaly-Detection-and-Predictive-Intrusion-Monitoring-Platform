
"use client";

import { useState } from "react";

import AppShell from "@/components/AppShell";

import {
  Empty,
  ErrorNote,
  Panel,
  RiskBar,
  Severity,
  Status,
} from "@/components/ui";

import {
  api,
  can,
  fmtDateTime,
  getUser,
} from "@/lib/api";

import { usePolling } from "@/lib/usePolling";

/* =========================================================
   NETSHIELD AI — ALERT TRIAGE
   Existing API calls, permissions, polling and state preserved.
   ========================================================= */

export default function AlertsPage() {
  const user = getUser();
  const canAct = can(user, "analyst");

  const [status, setStatus] = useState("open");
  const [severity, setSeverity] = useState("");
  const [selected, setSelected] = useState([]);
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");

  /* Existing filter and API request logic */
  const qs = new URLSearchParams({ limit: "150" });

  if (status) qs.set("status", status);
  if (severity) qs.set("severity", severity);

  const alerts = usePolling(
    () => api(`/api/alerts?${qs}`),
    6000
  );

  const groups = usePolling(
    () => api("/api/alerts/correlate?min_alerts=3"),
    15000
  );

  /* Existing selection logic */
  const toggle = (id) =>
    setSelected((s) =>
      s.includes(id)
        ? s.filter((x) => x !== id)
        : [...s, id]
    );

  const allIds = (alerts.data || []).map((a) => a.id);

  /* Existing action handling */
  async function run(fn, success) {
    setActionError("");
    setMessage("");

    try {
      await fn();

      setMessage(success);
      setSelected([]);

      alerts.refresh();
      groups.refresh();
    } catch (e) {
      setActionError(e.message);
    }
  }

  /* Existing bulk status action */
  const bulk = (newStatus) =>
    run(
      () =>
        api("/api/alerts/bulk", {
          method: "POST",
          body: {
            ids: selected,
            status: newStatus,
          },
        }),
      `${selected.length} alert(s) marked ${newStatus}.`
    );

  /* Single-row triage using the existing bulk endpoint */
  const triageOne = (id, newStatus) =>
    run(
      () =>
        api("/api/alerts/bulk", {
          method: "POST",
          body: {
            ids: [id],
            status: newStatus,
          },
        }),
      `Alert #${id} marked ${newStatus}.`
    );

  /* Existing incident creation */
  const makeIncident = (ids, title, sev) =>
    run(
      () =>
        api("/api/incidents", {
          method: "POST",
          body: {
            title,
            severity: sev,
            alert_ids: ids,
            description: `Created from ${ids.length} alert(s).`,
          },
        }),
      "Incident created. You can track it on the Incidents page."
    );

  return (
    <AppShell title="Alert triage">

      <div className="space-y-6">

        {/* =================================================
            ACTION FEEDBACK
            ================================================= */}

        <ErrorNote message={alerts.error || actionError} />

        {message && (
          <div
            className="rounded-xl border border-emerald-500/25 bg-emerald-500/[.08] px-4 py-3 text-sm text-emerald-200"
            role="status"
            aria-live="polite"
          >
            <span aria-hidden="true" className="mr-2">
              ✓
            </span>
            {message}
          </div>
        )}


        {/* =================================================
            CORRELATED ATTACKERS
            ================================================= */}

        {canAct && groups.data?.length > 0 && (
          <section className="space-y-3">

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-100">
                  Correlated attack activity
                </h2>

                <p className="mt-1 text-xs text-muted">
                  Multiple alerts from one source may belong to
                  the same investigation.
                </p>
              </div>

              <span className="severity-badge sev-high">
                {groups.data.length} attack groups
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">

              {groups.data.slice(0, 6).map((g) => (
                <article
                  key={g.src_ip}
                  className="rounded-xl border border-rule bg-panel/65 p-4 transition duration-200 hover:-translate-y-0.5 hover:border-signal/50 hover:bg-panel"
                >

                  <div className="flex items-center justify-between gap-2">
                    <span className="ip">
                      {g.src_ip}
                    </span>

                    <Severity level={g.max_severity} />
                  </div>

                  <div className="mt-4">
                    <p className="text-2xl font-bold tracking-tight text-fog">
                      {g.alert_count}
                    </p>

                    <p className="text-xs text-muted">
                      Linked open alerts
                    </p>
                  </div>

                  <div className="mt-4 space-y-2 border-t border-rule pt-3">

                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                        Detected attack types
                      </p>

                      <p className="mt-1 text-xs text-slate-200">
                        {g.attack_types.join(", ")}
                      </p>
                    </div>

                    <div className="flex justify-between text-xs">
                      <span className="text-muted">
                        Target servers
                      </span>

                      <span className="font-semibold text-slate-200">
                        {g.targets.length}
                      </span>
                    </div>

                  </div>

                  <button
                    className="btn btn-primary mt-4 w-full"
                    onClick={() =>
                      makeIncident(
                        g.alert_ids,
                        `Attack campaign from ${g.src_ip}`,
                        g.max_severity
                      )
                    }
                    aria-label={`Create incident for correlated attacks from ${g.src_ip}`}
                  >
                    Escalate as incident
                    <span aria-hidden="true">→</span>
                  </button>

                </article>
              ))}

            </div>
          </section>
        )}


        {/* =================================================
            ALERT QUEUE
            ================================================= */}

        <Panel
          title="Alert queue"
          subtitle="Prioritised by status, severity and risk score. Take action directly from individual rows."
          actions={
            <div className="flex flex-wrap gap-2">

              <select
                className="input w-auto py-1.5"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                aria-label="Filter alerts by status"
              >
                <option value="">All statuses</option>
                <option value="open">Open</option>
                <option value="acknowledged">Acknowledged</option>
                <option value="resolved">Resolved</option>
              </select>

              <select
                className="input w-auto py-1.5"
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                aria-label="Filter alerts by severity"
              >
                <option value="">All severities</option>

                {["Critical", "High", "Medium", "Low"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}

              </select>

            </div>
          }
        >

          {/* =================================================
              BULK TRIAGE BAR
              ================================================= */}

          {canAct && selected.length > 0 && (
            <div
              className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-signal/30 bg-signal/[.06] p-3"
              aria-live="polite"
            >

              <span className="mr-2 text-sm font-semibold text-fog">
                {selected.length} selected
              </span>

              <button
                className="btn btn-ghost"
                onClick={() => bulk("acknowledged")}
              >
                Acknowledge
              </button>

              <button
                className="btn btn-ghost"
                onClick={() => bulk("resolved")}
              >
                Resolve
              </button>

              <button
                className="btn btn-primary"
                onClick={() =>
                  makeIncident(
                    selected,
                    `Investigation of ${selected.length} alerts`,
                    "High"
                  )
                }
              >
                Escalate to incident
              </button>

              <button
                className="btn btn-ghost"
                onClick={() => setSelected([])}
              >
                Clear selection
              </button>

            </div>
          )}


          {/* =================================================
              LOADING AND EMPTY STATES
              ================================================= */}

          {!alerts.data ? (
            <Empty>
              Loading alert queue...
            </Empty>
          ) : alerts.data.length === 0 ? (
            <Empty>
              No alerts match these filters.
            </Empty>
          ) : (

            /* =================================================
               ALERT TABLE
               ================================================= */

            <div className="overflow-x-auto">

              <table className="table">

                <thead>
                  <tr>

                    {canAct && (
                      <th>
                        <input
                          type="checkbox"
                          aria-label="Select all visible alerts"
                          checked={
                            selected.length > 0 &&
                            selected.length === allIds.length
                          }
                          onChange={(e) =>
                            setSelected(
                              e.target.checked ? allIds : []
                            )
                          }
                        />
                      </th>
                    )}

                    <th>#</th>
                    <th>Raised</th>
                    <th>Security event</th>
                    <th>Severity</th>
                    <th>Source IP</th>
                    <th>Destination</th>
                    <th>Risk</th>
                    <th>Status</th>
                    <th>Incident</th>

                    {canAct && <th>Quick actions</th>}

                  </tr>
                </thead>

                <tbody>

                  {alerts.data.map((a) => (
                    <tr key={a.id}>

                      {canAct && (
                        <td>
                          <input
                            type="checkbox"
                            checked={selected.includes(a.id)}
                            onChange={() => toggle(a.id)}
                            aria-label={`Select alert ${a.id}`}
                          />
                        </td>
                      )}

                      <td className="text-muted">
                        {a.id}
                      </td>

                      <td className="text-muted">
                        {fmtDateTime(a.created_at)}
                      </td>

                      <td>
                        <div className="max-w-[220px]">
                          <p className="font-semibold text-fog">
                            {a.title}
                          </p>

                          <p className="mt-1 text-xs text-muted">
                            {a.attack_type}
                          </p>
                        </div>
                      </td>

                      <td>
                        <Severity level={a.severity} />
                      </td>

                      <td className="ip">
                        {a.src_ip}
                      </td>

                      <td className="ip">
                        {a.dst_ip}:{a.dst_port}
                      </td>

                      <td>
                        <RiskBar score={a.risk_score} />
                      </td>

                      <td>
                        <Status value={a.status} />
                      </td>

                      <td className="text-muted">
                        {a.incident_id
                          ? `#${a.incident_id}`
                          : "—"}
                      </td>


                      {/* =================================================
                          ONE-CLICK TRIAGE
                          ================================================= */}

                      {canAct && (
                        <td className="alert-actions-cell">

                          <div className="quick-actions">

                            {a.status === "open" && (
                              <button
                                className="alert-action-link"
                                onClick={() =>
                                  triageOne(a.id, "acknowledged")
                                }
                                aria-label={`Acknowledge alert ${a.id}`}
                              >
                                Acknowledge
                              </button>
                            )}

                            {!a.incident_id && (
                              <button
                                className="alert-action-link escalate"
                                onClick={() =>
                                  makeIncident(
                                    [a.id],
                                    `Investigation of alert #${a.id}: ${a.title}`,
                                    a.severity
                                  )
                                }
                                aria-label={`Escalate alert ${a.id} to an incident`}
                              >
                                Escalate
                              </button>
                            )}

                            {a.status !== "resolved" && (
                              <button
                                className="alert-action-link"
                                onClick={() =>
                                  triageOne(a.id, "resolved")
                                }
                                aria-label={`Resolve alert ${a.id}`}
                              >
                                Resolve
                              </button>
                            )}

                          </div>

                        </td>
                      )}

                    </tr>
                  ))}

                </tbody>

              </table>

            </div>

          )}

        </Panel>

      </div>

    </AppShell>
  );
}
