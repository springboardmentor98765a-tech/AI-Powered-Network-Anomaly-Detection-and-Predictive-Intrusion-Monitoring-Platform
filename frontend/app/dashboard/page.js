
"use client";

// NetShield AI — SOC Command Center Dashboard
// UI refresh only: existing API calls and threat calculations preserved.

import Link from "next/link";

import AppShell from "@/components/AppShell";

import {
  BarChart,
  COLORS,
  DoughnutChart,
  LineChart,
} from "@/components/Charts";

import {
  Empty,
  ErrorNote,
  LiveIndicator,
  Panel,
  RiskBar,
  Severity,
  Stat,
} from "@/components/ui";

import { api, fmtTime } from "@/lib/api";
import { usePolling } from "@/lib/usePolling";

/* =========================================================
   EXISTING DATA FETCHING — UNCHANGED
   ========================================================= */

async function loadDashboard() {
  const [
    overview,
    timeline,
    types,
    severity,
    forecast,
    alerts,
  ] = await Promise.all([
    api("/api/analytics/overview?minutes=60"),
    api("/api/analytics/timeline?minutes=120&bucket=5"),
    api("/api/analytics/attack-types?minutes=120"),
    api("/api/analytics/severity?minutes=120"),
    api("/api/detection/forecast?bucket_minutes=10&history=12&horizon=6"),
    api("/api/alerts?status=open&limit=6"),
  ]);

  return {
    overview,
    timeline,
    types,
    severity,
    forecast,
    alerts,
  };
}

/* =========================================================
   EXISTING THREAT CALCULATION — UNCHANGED
   ========================================================= */

function threatLevel(ov, fc) {
  if (
    ov.critical_open_alerts > 10 ||
    ov.attack_share > 0.3
  ) {
    return "Critical";
  }

  if (
    ov.critical_open_alerts > 0 ||
    ov.attack_share > 0.15
  ) {
    return "High";
  }

  if (
    ov.attack_share > 0.05 ||
    fc.trend === "rising"
  ) {
    return "Medium";
  }

  return "Low";
}

/* =========================================================
   PRESENTATION HELPERS
   These only summarize data already fetched.
   ========================================================= */

function sumMetric(rows, key) {
  return rows.reduce(
    (total, row) => total + (Number(row[key]) || 0),
    0
  );
}

function calculateTrend(current, previous, positive = false) {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) {
    return undefined;
  }

  if (previous <= 0) {
    return undefined;
  }

  const change = ((current - previous) / previous) * 100;

  return {
    value: Math.abs(change),
    direction: change > 0 ? "up" : change < 0 ? "down" : "neutral",
    positive,
    label: "Compared with the previous 60 minutes",
  };
}

const LEVEL_CLASS = {
  Low: "threat-level-low",
  Medium: "threat-level-medium",
  High: "threat-level-high",
  Critical: "threat-level-critical",
};

/* =========================================================
   DASHBOARD PAGE
   ========================================================= */

export default function Dashboard() {
  const { data, error } = usePolling(loadDashboard, 5000);

  return (
    <AppShell
      title="Security overview"
      actions={<LiveIndicator label="Live · Refreshes every 5 seconds" />}
    >
      <div className="space-y-5">

        <ErrorNote message={error} />

        {!data ? (
          <div className="space-y-4">
            <div className="skeleton-grid">
              {Array.from({ length: 4 }).map((_, index) => (
                <div className="skeleton-card" key={index}>
                  <div className="skeleton-line short" />
                  <div className="skeleton-line" style={{ marginTop: 22 }} />
                  <div className="skeleton-line short" style={{ marginTop: 14 }} />
                </div>
              ))}
            </div>

            <Empty>Loading live security data...</Empty>
          </div>
        ) : (
          <DashboardContent d={data} />
        )}

      </div>
    </AppShell>
  );
}

/* =========================================================
   DASHBOARD CONTENT
   ========================================================= */

function DashboardContent({ d }) {
  const {
    overview: ov,
    timeline,
    types,
    severity,
    forecast: fc,
    alerts,
  } = d;

  const level = threatLevel(ov, fc);

  const typeLabels = Object.keys(types);

  const fcLabels = [
    ...fc.history.map((h) => fmtTime(h.time)),
    ...fc.forecast.map((f) => fmtTime(f.time)),
  ];

  const histLen = fc.history.length;

  const lastHistory =
    histLen > 0 ? fc.history[histLen - 1] : null;

  /* Existing 120-minute timeline, split into 60-minute windows. */
  const recentHour = timeline.slice(-12);

  const previousHour = timeline.slice(-24, -12);

  /* Timeline-based sparkline data. */
  const flowSparkline = recentHour.map((item) => item.total);

  const attackSparkline = recentHour.map((item) => item.attacks);

  const anomalySparkline = recentHour.map((item) => item.anomalies);

  /* Compare the two already-fetched hourly periods. */
  const previousAttackCount = sumMetric(
    previousHour,
    "attacks"
  );

  const currentAttackCount = sumMetric(
    recentHour,
    "attacks"
  );

  const attackTrend = calculateTrend(
    currentAttackCount,
    previousAttackCount,
    false
  );

  const trendLabel =
    fc.trend === "rising"
      ? "Attack activity is increasing"
      : fc.trend === "falling"
      ? "Attack activity is decreasing"
      : "Attack trend is stable";

  return (
    <div className="space-y-6">

      {/* =================================================
          1. CURRENT THREAT LEVEL
          ================================================= */}

      <section
        className={`threat-level-banner ${LEVEL_CLASS[level]}`}
        aria-label={`Current threat level: ${level}`}
      >
        <div className="threat-level-main">

          <div className="flex items-center gap-2">
            <span className="threat-eyebrow">
              Current security posture
            </span>

            <span className="live-dot" aria-hidden="true" />
          </div>

          <div className="threat-level-row">
            <h2 className="threat-level-value">
              {level}
            </h2>

            <Severity level={level} />
          </div>

          <p>
            {(ov.attack_share * 100).toFixed(1)}% of traffic
            during the last hour was malicious. {trendLabel}.
            The forecast indicates a{" "}
            {(fc.next_bucket_attack_probability * 100).toFixed(0)}%
            {" "}chance of at least one attack in the next{" "}
            {fc.bucket_minutes} minutes.
          </p>

        </div>

        <div className="threat-level-side">

          <span>FORECAST STATUS</span>

          <strong>{fc.trend || "Unknown"}</strong>

          <small>
            Next {fc.bucket_minutes} minute window
          </small>

        </div>
      </section>


      {/* =================================================
          2. KEY SECURITY METRICS
          ================================================= */}

      <div>
        <div className="soc-section-label">
          Security performance indicators
        </div>

        <section className="soc-kpi-grid">

          <Stat
            label="Flows analysed"
            value={ov.total_flows.toLocaleString()}
            hint="Last 60 minutes"
            tone="signal"
            sparkline={flowSparkline}
          />

          <Stat
            label="Attack flows"
            value={ov.attack_flows.toLocaleString()}
            hint={`${ov.threat_intel_hits} known-bad IP matches`}
            tone="high"
            sparkline={attackSparkline}
            trend={attackTrend}
          />

          <Stat
            label="Open alerts"
            value={ov.open_alerts.toLocaleString()}
            hint={`${ov.critical_open_alerts} critical alerts`}
            tone="critical"
          />

          <Stat
            label="Open incidents"
            value={ov.open_incidents.toLocaleString()}
            hint={`Average risk ${ov.avg_risk}/100`}
            tone="signal"
          />

        </section>
      </div>


      {/* =================================================
          3. TRAFFIC AND ATTACK ANALYTICS
          ================================================= */}

      <div>
        <div className="soc-section-label">
          Network activity and attack analytics
        </div>

        <section className="soc-bento">

          <Panel
            title="Network traffic intelligence"
            subtitle="Traffic, attacks and anomalies · Last 2 hours"
            className="soc-span-8"
          >
            <LineChart
              height={285}
              labels={timeline.map((t) => fmtTime(t.time))}
              datasets={[
                {
                  label: "All flows",
                  data: timeline.map((t) => t.total),
                  borderColor: COLORS.signal,
                  backgroundColor: "rgba(84,197,220,.12)",
                  fill: true,
                  tension: 0.3,
                  pointRadius: 0,
                },
                {
                  label: "Attack flows",
                  data: timeline.map((t) => t.attacks),
                  borderColor: COLORS.critical,
                  tension: 0.3,
                  pointRadius: 0,
                },
                {
                  label: "Anomalies",
                  data: timeline.map((t) => t.anomalies),
                  borderColor: COLORS.medium,
                  borderDash: [4, 4],
                  tension: 0.3,
                  pointRadius: 0,
                },
              ]}
            />
          </Panel>


          <Panel
            title="Attack classification"
            subtitle="Distribution by detected attack type"
            className="soc-span-4"
          >
            {typeLabels.length ? (
              <>
                <DoughnutChart
                  height={285}
                  labels={typeLabels}
                  data={Object.values(types)}
                />
              </>
            ) : (
              <Empty>No attacks detected in this period.</Empty>
            )}
          </Panel>

        </section>
      </div>


      {/* =================================================
          4. FORECAST AND SEVERITY
          ================================================= */}

      <div>
        <div className="soc-section-label">
          Predictive threat intelligence
        </div>

        <section className="soc-bento">

          <Panel
            title="Intrusion forecast"
            subtitle="Actual attacks and predicted attack volume"
            className="soc-span-8"
          >

            {fcLabels.length > 0 ? (
              <LineChart
                height={285}
                labels={fcLabels}
                datasets={[
                  {
                    label: "Actual attacks",
                    data: [
                      ...fc.history.map((h) => h.attacks),
                      ...fc.forecast.map(() => null),
                    ],
                    borderColor: COLORS.critical,
                    tension: 0.3,
                    pointRadius: 2,
                    fill: true,
                  },
                  {
                    label: "Forecast",
                    data: [
                      ...(lastHistory
                        ? [
                            ...Array(
                              Math.max(0, histLen - 1)
                            ).fill(null),
                            lastHistory.attacks,
                          ]
                        : []),
                      ...fc.forecast.map(
                        (f) => f.expected_attacks
                      ),
                    ],
                    borderColor: COLORS.medium,
                    borderDash: [6, 4],
                    tension: 0.3,
                    pointRadius: 2,
                  },
                ]}
              />
            ) : (
              <Empty>Forecast information is unavailable.</Empty>
            )}

          </Panel>


          <Panel
            title="Alert severity distribution"
            subtitle="Alerts classified by severity · Last 2 hours"
            className="soc-span-4"
          >

            <BarChart
              height={285}
              labels={Object.keys(severity)}
              data={Object.values(severity)}
              colors={[
                COLORS.low,
                COLORS.medium,
                COLORS.high,
                COLORS.critical,
              ]}
              label="Alerts"
            />

          </Panel>

        </section>
      </div>


      {/* =================================================
          5. HIGH PRIORITY ALERTS
          ================================================= */}

      <div>
        <div className="soc-section-label">
          Security event triage
        </div>

        <Panel
          title="Highest-priority open alerts"
          subtitle="Review the latest alerts requiring analyst attention"
          className="soc-span-12"
          actions={
            <Link
              href="/alerts"
              className="btn btn-primary btn-small"
            >
              View all alerts →
            </Link>
          }
        >

          {alerts.length === 0 ? (
            <Empty>
              No open alerts. No active open alerts were returned by the API.
            </Empty>
          ) : (
            <div className="overflow-x-auto">

              <table className="table">
                <thead>
                  <tr>
                    <th>Detected</th>
                    <th>Security event</th>
                    <th>Severity</th>
                    <th>Source IP</th>
                    <th>Destination</th>
                    <th>Risk score</th>
                  </tr>
                </thead>

                <tbody>
                  {alerts.map((a) => (
                    <tr key={a.id}>

                      <td className="text-muted">
                        {fmtTime(a.created_at)}
                      </td>

                      <td>
                        <span className="font-semibold text-slate-100">
                          {a.title}
                        </span>
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

                    </tr>
                  ))}
                </tbody>
              </table>

            </div>
          )}

        </Panel>
      </div>

    </div>
  );
}
