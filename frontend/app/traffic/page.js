
"use client";

import { useState } from "react";

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
  Panel,
  RiskBar,
  Severity,
  Stat,
} from "@/components/ui";

import {
  api,
  can,
  fmtBytes,
  fmtTime,
  getUser,
} from "@/lib/api";

import { usePolling } from "@/lib/usePolling";


const ATTACKS = [
  "",
  "BENIGN",
  "DDoS",
  "PortScan",
  "BruteForce",
  "WebAttack",
  "Botnet",
];


function buildParams(filters, extra = {}) {

  const params = new URLSearchParams(extra);

  if (filters.src_ip)
    params.set("src_ip", filters.src_ip.trim());

  if (filters.dst_ip)
    params.set("dst_ip", filters.dst_ip.trim());

  if (filters.protocol)
    params.set("protocol", filters.protocol);

  if (filters.port)
    params.set("port", String(filters.port));

  if (filters.attack)
    params.set("attack", filters.attack);

  if (filters.min_risk)
    params.set("min_risk", String(filters.min_risk));

  if (filters.threats_only)
    params.set("threats_only", "true");

  return params;
}


export default function TrafficPage() {

  const user = getUser();

  const [live, setLive] = useState(true);

  const [draftFilters, setDraftFilters] = useState({
    src_ip: "",
    dst_ip: "",
    protocol: "",
    port: "",
    attack: "",
    min_risk: "",
    threats_only: false,
  });

  const [filters, setFilters] = useState({
    src_ip: "",
    dst_ip: "",
    protocol: "",
    port: "",
    attack: "",
    min_risk: "",
    threats_only: false,
  });


  const flowParams = buildParams(
    filters,
    { limit: "60" }
  );

  const statsParams = buildParams(
    filters,
    {
      minutes: "60",
      bucket_minutes: "5",
    }
  );


  const flows = usePolling(
    () => api(`/api/traffic/flows?${flowParams.toString()}`),
    4000,
    live
  );

  const stats = usePolling(
    () => api(`/api/traffic/stats?${statsParams.toString()}`),
    8000,
    live
  );

  const sensor = usePolling(
    () => api("/api/traffic/sensor/status"),
    5000,
    true
  );


  const s = stats.data;

  const rows = flows.data || [];

  const protocolStats = s?.protocol_stats || [];

  const unknown = s?.unknown_protocols || [];

  const direction = s?.direction;

  const timeline = s?.timeline || [];


  function updateDraft(key, value) {

    setDraftFilters((current) => ({
      ...current,
      [key]: value,
    }));

  }


  function applyFilters(event) {

    event.preventDefault();

    setFilters({ ...draftFilters });

  }


  function clearFilters() {

    const empty = {
      src_ip: "",
      dst_ip: "",
      protocol: "",
      port: "",
      attack: "",
      min_risk: "",
      threats_only: false,
    };

    setDraftFilters(empty);
    setFilters(empty);

  }


  return (

    <AppShell
      title="Network traffic"
      actions={
        <div className="flex items-center gap-3">

          <span className="live-indicator">
            <span
              className={`live-dot ${live ? "" : "opacity-30"}`}
              aria-hidden="true"
            />
            {live ? "Live monitoring" : "Monitoring paused"}
          </span>

          <button
            className="btn-ghost"
            onClick={() => setLive((value) => !value)}
            aria-pressed={live}
          >
            {live ? "Pause" : "Resume"}
          </button>

        </div>
      }
    >

      <div className="space-y-6">

        <ErrorNote message={flows.error || stats.error} />


        {/* =================================================
            1. TRAFFIC KPI OVERVIEW
            ================================================= */}

        <section>

          <div className="soc-section-label">
            Network activity overview · Last 60 minutes
          </div>

          {!s ? (

            <div className="skeleton-grid">

              {Array.from({ length: 4 }).map((_, index) => (

                <div className="skeleton-card" key={index}>

                  <span className="skeleton-line short" />

                  <span
                    className="skeleton-line"
                    style={{ marginTop: 22 }}
                  />

                </div>

              ))}

            </div>

          ) : (

            <div className="soc-kpi-grid">

              <Stat
                label="Network flows"
                value={Number(s.flows || 0).toLocaleString()}
                hint="Filtered flow records"
                tone="signal"
              />

              <Stat
                label="Total packets"
                value={Number(s.total_packets || 0).toLocaleString()}
                hint="Forward + backward packets"
                tone="low"
              />

              <Stat
                label="Data transferred"
                value={fmtBytes(s.total_bytes || 0)}
                hint="Forward + backward bytes"
                tone="high"
              />

              <Stat
                label="Protocols observed"
                value={
                  protocolStats.length ||
                  Object.keys(s.protocols || {}).length
                }
                hint={`${s.unknown_protocol_flows || 0} unclassified flows`}
                tone={
                  (s.unknown_protocol_flows || 0) > 0
                    ? "medium"
                    : "signal"
                }
              />

            </div>

          )}

        </section>


        {/* =================================================
            2. PROTOCOL ANALYSIS
            ================================================= */}

        <section>

          <div className="soc-section-label">
            Protocol analysis
          </div>

          <div className="soc-bento">

            <Panel
              title="Protocol distribution"
              subtitle="Share of observed flows by protocol"
              className="soc-span-4"
            >

              {protocolStats.length ? (

                <DoughnutChart
                  labels={protocolStats.map((item) => item.protocol)}
                  data={protocolStats.map((item) => item.flows)}
                  colors={protocolStats.map(
                    (item, index) =>
                      item.protocol === "OTHER"
                        ? "#FF6378"
                        : COLORS.attack[index % COLORS.attack.length]
                  )}
                  height={230}
                />

              ) : (

                <Empty>
                  No protocol statistics available for this time window.
                </Empty>

              )}

            </Panel>


            <Panel
              title="Protocol-wise statistics"
              subtitle="Flow, packet and byte totals per protocol"
              className="soc-span-8"
            >

              {protocolStats.length ? (

                <div className="overflow-x-auto">

                  <table className="table">

                    <thead>
                      <tr>
                        <th>Protocol</th>
                        <th>Classification</th>
                        <th>Flows</th>
                        <th>Packets</th>
                        <th>Data</th>
                        <th>Flow share</th>
                        <th>Byte share</th>
                      </tr>
                    </thead>

                    <tbody>

                      {protocolStats.map((item) => (

                        <tr key={item.protocol}>

                          <td className="font-semibold text-fog">
                            {item.protocol}
                          </td>

                          <td>
                            {item.classification === "unclassified" ? (
                              <Severity level="Medium" />
                            ) : (
                              <span className="text-xs text-muted">
                                Classified
                              </span>
                            )}
                          </td>

                          <td className="tabular-nums">
                            {Number(item.flows).toLocaleString()}
                          </td>

                          <td className="tabular-nums">
                            {Number(item.packets).toLocaleString()}
                          </td>

                          <td className="tabular-nums">
                            {fmtBytes(item.bytes)}
                          </td>

                          <td className="tabular-nums">
                            {item.flow_percent}%
                          </td>

                          <td className="tabular-nums">
                            {item.byte_percent}%
                          </td>

                        </tr>

                      ))}

                    </tbody>

                  </table>

                </div>

              ) : (

                <Empty>No protocol records found.</Empty>

              )}

            </Panel>

          </div>


          {/* Unknown protocol warning */}

          {unknown.length > 0 && (

            <div
              className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/[.07] p-4"
              role="status"
            >

              <div className="flex flex-wrap items-center justify-between gap-2">

                <div>

                  <p className="text-sm font-semibold text-amber-200">
                    Unclassified protocols detected
                  </p>

                  <p className="mt-1 text-xs text-muted">
                    These protocol labels are not mapped by the
                    current protocol classifier. Review the source
                    dataset or extend the mapping where appropriate.
                  </p>

                </div>

                <span className="rounded-lg border border-amber-500/30 px-3 py-2 text-xs font-semibold text-amber-200">
                  {s.unknown_protocol_flows} flows · {s.unknown_protocol_types} labels
                </span>

              </div>

              <div className="mt-3 flex flex-wrap gap-2">

                {unknown.map((item) => (

                  <span
                    key={item.protocol}
                    className="rounded-md bg-black/20 px-2 py-1 text-xs text-amber-100"
                  >
                    {item.protocol}: {item.flows}
                  </span>

                ))}

              </div>

            </div>

          )}

        </section>


        {/* =================================================
            3. TRAFFIC DIRECTION
            ================================================= */}

        <section>

          <div className="soc-section-label">
            Traffic direction
          </div>

          <Panel
            title="Inbound and outbound traffic"
            subtitle="Direction is inferred from configured internal CIDR ranges and forward/backward flow counters."
          >

            {direction ? (

              <>

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">

                  <DirectionCard
                    label="Inbound data"
                    value={fmtBytes(direction.inbound?.bytes || 0)}
                    packets={direction.inbound?.packets || 0}
                    tone="text-sev-low"
                  />

                  <DirectionCard
                    label="Outbound data"
                    value={fmtBytes(direction.outbound?.bytes || 0)}
                    packets={direction.outbound?.packets || 0}
                    tone="text-signal"
                  />

                  <DirectionCard
                    label="Internal / east-west"
                    value={fmtBytes(direction.east_west?.bytes || 0)}
                    packets={direction.east_west?.packets || 0}
                    tone="text-sev-medium"
                  />

                  <DirectionCard
                    label="External / unclassified"
                    value={fmtBytes(
                      (direction.external?.bytes || 0) +
                      (direction.undetermined?.bytes || 0)
                    )}
                    packets={
                      (direction.external?.packets || 0) +
                      (direction.undetermined?.packets || 0)
                    }
                    tone="text-muted"
                  />

                </div>

                <p className="mt-4 text-xs text-muted">

                  Internal networks:{" "}
                  {direction.internal_cidrs?.join(", ") || "none configured"}.

                  Configure NETSHIELD_INTERNAL_CIDRS in the backend
                  environment for your actual network.

                  Direction is an estimate based on IP ranges,
                  not packet-capture interface metadata.

                </p>

              </>

            ) : (

              <Empty>Direction statistics unavailable.</Empty>

            )}

          </Panel>

        </section>


        {/* =================================================
            4. TRAFFIC ANALYTICS
            ================================================= */}

        <section>

          <div className="soc-section-label">
            Traffic analytics and top talkers
          </div>

          <div className="soc-bento">

            <Panel
              title="Traffic activity over time"
              subtitle={`Flows, attacks and anomalies · ${s?.bucket_minutes || 5}-minute buckets`}
              className="soc-span-8"
            >

              {timeline.length ? (

                <LineChart
                  height={270}
                  labels={timeline.map(
                    (point) => fmtTime(point.time)
                  )}
                  datasets={[
                    {
                      label: "Flows",
                      data: timeline.map((point) => point.flows),
                      borderColor: COLORS.signal,
                      backgroundColor: "rgba(255,150,94,.12)",
                      fill: true,
                      tension: 0.3,
                      pointRadius: 0,
                    },
                    {
                      label: "Attack flows",
                      data: timeline.map((point) => point.attacks),
                      borderColor: "#FF6378",
                      tension: 0.3,
                      pointRadius: 0,
                    },
                    {
                      label: "Anomalies",
                      data: timeline.map((point) => point.anomalies),
                      borderColor: "#F2C96B",
                      borderDash: [5, 4],
                      tension: 0.3,
                      pointRadius: 0,
                    },
                  ]}
                />

              ) : (

                <Empty>No timeline data available.</Empty>

              )}

            </Panel>


            <Panel
              title="Top source IPs"
              subtitle="Sources with the most observed flows"
              className="soc-span-4"
            >

              {s?.top_sources?.length ? (

                <BarChart
                  horizontal
                  labels={s.top_sources.map((item) => item.ip)}
                  data={s.top_sources.map((item) => item.flows)}
                  height={270}
                  label="Flows"
                />

              ) : (

                <Empty>No source IP data.</Empty>

              )}

            </Panel>


            <Panel
              title="Top destination IPs"
              subtitle="Destinations receiving the most observed flows"
              className="soc-span-6"
            >

              {s?.top_destinations?.length ? (

                <BarChart
                  horizontal
                  labels={s.top_destinations.map((item) => item.ip)}
                  data={s.top_destinations.map((item) => item.flows)}
                  height={240}
                  label="Flows"
                />

              ) : (

                <Empty>No destination IP data.</Empty>

              )}

            </Panel>


            <Panel
              title="Most used destination ports"
              subtitle="Top destination ports by flow count"
              className="soc-span-6"
            >

              {s?.top_ports?.length ? (

                <BarChart
                  labels={s.top_ports.map(
                    (item) => String(item.port ?? "Unknown")
                  )}
                  data={s.top_ports.map((item) => item.flows)}
                  height={240}
                  label="Flows"
                />

              ) : (

                <Empty>No port statistics.</Empty>

              )}

            </Panel>

          </div>

        </section>


        {/* =================================================
            5. CSV INGESTION
            ================================================= */}

        {can(user, "analyst") && (
          <UploadPanel onDone={() => {
            flows.refresh();
            stats.refresh();
          }} />
        )}

        <LiveSensorPanel
          user={user}
          status={sensor.data}
          error={sensor.error}
          onRefresh={sensor.refresh}
        />


        {/* =================================================
            6. ADVANCED FILTERS
            ================================================= */}

        <Panel
          title="Traffic filters"
          subtitle="Filter both the flow table and the analytics above."
        >

          <form
            onSubmit={applyFilters}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6"
          >

            <label className="text-xs text-muted">
              Source IP

              <input
                className="input mt-1"
                value={draftFilters.src_ip}
                onChange={(event) =>
                  updateDraft("src_ip", event.target.value)
                }
                placeholder="e.g. 192.168.1.10"
              />
            </label>


            <label className="text-xs text-muted">
              Destination IP

              <input
                className="input mt-1"
                value={draftFilters.dst_ip}
                onChange={(event) =>
                  updateDraft("dst_ip", event.target.value)
                }
                placeholder="e.g. 10.0.0.5"
              />
            </label>


            <label className="text-xs text-muted">
              Protocol

              <select
                className="input mt-1"
                value={draftFilters.protocol}
                onChange={(event) =>
                  updateDraft("protocol", event.target.value)
                }
              >

                <option value="">All protocols</option>

                {(
                  protocolStats.length
                    ? protocolStats.map((item) => item.protocol)
                    : ["TCP", "UDP", "ICMP", "OTHER"]
                ).map((value) => (

                  <option key={value} value={value}>
                    {value}
                  </option>

                ))}

              </select>
            </label>


            <label className="text-xs text-muted">
              Port

              <input
                className="input mt-1"
                type="number"
                min="1"
                max="65535"
                value={draftFilters.port}
                onChange={(event) =>
                  updateDraft("port", event.target.value)
                }
                placeholder="Any port"
              />
            </label>


            <label className="text-xs text-muted">
              AI prediction

              <select
                className="input mt-1"
                value={draftFilters.attack}
                onChange={(event) =>
                  updateDraft("attack", event.target.value)
                }
              >

                {ATTACKS.map((value) => (

                  <option key={value} value={value}>
                    {value || "All predictions"}
                  </option>

                ))}

              </select>
            </label>

            <label className="text-xs text-muted">
              Minimum risk score

              <input
                className="input mt-1"
                type="number"
                min="0"
                max="100"
                value={draftFilters.min_risk}
                onChange={(event) =>
                  updateDraft("min_risk", event.target.value)
                }
                placeholder="0 - 100"
              />
            </label>


            <div className="flex flex-col justify-end gap-2">

              <label className="flex items-center gap-2 text-xs text-muted">

                <input
                  type="checkbox"
                  checked={draftFilters.threats_only}
                  onChange={(event) =>
                    updateDraft("threats_only", event.target.checked)
                  }
                />

                Threats only

              </label>

              <div className="flex gap-2">

                <button
                  type="submit"
                  className="btn-primary flex-1"
                >
                  Apply
                </button>

                <button
                  type="button"
                  className="btn-ghost"
                  onClick={clearFilters}
                >
                  Reset
                </button>

              </div>

            </div>

          </form>

          <p className="mt-3 text-xs text-muted">
            Applied filters:{" "}
            {Object.entries(filters)
              .filter(([, value]) => value !== "" && value !== false)
              .map(([key, value]) => `${key}=${value}`)
              .join(" · ") || "None"}
          </p>

        </Panel>


        {/* =================================================
            7. LIVE NETWORK FLOW TABLE
            ================================================= */}

        <Panel
          title="Network flow records"
          subtitle="Latest analysed flows returned by the backend. Refreshes every four seconds while live monitoring is enabled."
          actions={
            <span className="text-xs text-muted">
              {rows.length} rows
            </span>
          }
        >

          {!flows.data ? (

            <Empty>Loading network flows...</Empty>

          ) : rows.length === 0 ? (

            <Empty>No flows match the applied filters.</Empty>

          ) : (

            <div className="overflow-x-auto">

              <table className="table">

                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Source IP</th>
                    <th>Destination IP</th>
                    <th>Protocol</th>
                    <th>Packets</th>
                    <th>Bytes</th>
                    <th>AI prediction</th>
                    <th>Anomaly</th>
                    <th>Risk</th>
                  </tr>
                </thead>

                <tbody>

                  {rows.map((flow) => (

                    <tr key={flow.id}>

                      <td className="text-muted">
                        {fmtTime(flow.timestamp)}
                      </td>

                      <td className="ip">

                        {flow.src_ip}

                        {flow.threat_intel_hit && (
                          <span
                            className="ml-1 text-sev-critical"
                            title="Known-bad IP"
                            aria-label="Known-bad IP"
                          >
                            ●
                          </span>
                        )}

                        <span className="text-muted">
                          :{flow.src_port}
                        </span>

                      </td>

                      <td className="ip">
                        {flow.dst_ip}:{flow.dst_port}
                      </td>

                      <td>
                        <span className="rounded-md border border-rule px-2 py-1 text-xs">
                          {flow.protocol || "OTHER"}
                        </span>
                      </td>

                      <td className="tabular-nums">
                        {(Number(flow.fwd_packets) || 0) +
                          (Number(flow.bwd_packets) || 0)}
                      </td>

                      <td className="tabular-nums">
                        {fmtBytes(
                          (Number(flow.fwd_bytes) || 0) +
                          (Number(flow.bwd_bytes) || 0)
                        )}
                      </td>

                      <td>

                        {flow.predicted_attack === "BENIGN" ? (

                          <span className="text-muted">
                            Normal
                          </span>

                        ) : (

                          <span className="font-semibold text-sev-high">

                            {flow.predicted_attack}

                            <span className="font-normal text-muted">
                              {" "}
                              {Math.round(
                                (Number(flow.attack_probability) || 0) * 100
                              )}%
                            </span>

                          </span>

                        )}

                      </td>

                      <td>
                        {flow.is_anomaly ? (
                          <Severity level="Medium" />
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>

                      <td>
                        <RiskBar score={flow.risk_score} />
                      </td>

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


/* =========================================================
   DIRECTION CARD
   ========================================================= */

function DirectionCard({ label, value, packets, tone }) {

  return (

    <div className="rounded-xl border border-rule bg-panel p-4">

      <p className="text-xs text-muted">
        {label}
      </p>

      <p className={`mt-2 text-xl font-semibold tabular-nums ${tone}`}>
        {value}
      </p>

      <p className="mt-1 text-xs text-muted">
        {Number(packets).toLocaleString()} packets
      </p>

    </div>

  );

}


/* =========================================================
   CSV UPLOAD PANEL
   ========================================================= */

function UploadPanel({ onDone }) {

  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);


  async function upload() {

    if (!file) return;

    setBusy(true);
    setError("");
    setResult(null);

    const form = new FormData();
    form.append("file", file);

    try {

      const response = await api(
        "/api/traffic/upload",
        {
          method: "POST",
          form,
        }
      );

      setResult(response);
      onDone();

    } catch (exception) {

      setError(
        exception.message || "Traffic upload failed."
      );

    } finally {

      setBusy(false);

    }

  }


  return (

    <Panel
      title="Import traffic dataset"
      subtitle="Upload a compatible CICFlowMeter/CICIDS CSV, project flow CSV, or Wireshark packet-list CSV export."
    >

      <div className="flex flex-wrap items-end gap-3">

        <label className="min-w-[240px] flex-1 text-xs text-muted">

          CSV file

          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) =>
              setFile(event.target.files?.[0] || null)
            }
            className="input mt-1"
            aria-label="Select traffic CSV file"
          />

        </label>

        <button
          className="btn-primary"
          onClick={upload}
          disabled={!file || busy}
        >
          {busy ? "Analysing…" : "Analyse dataset"}
        </button>

      </div>

      <p className="mt-2 text-xs text-muted">
        Export packet captures in Wireshark as CSV first. Native .pcap/.pcapng files are not accepted. Backend limit: 10 MiB and 5,000 rows per file.
      </p>

      <div className="mt-3">
        <ErrorNote message={error} />
      </div>

      {result && (

        <div
          className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/[.06] p-4"
          role="status"
        >

          <p className="text-sm font-semibold text-emerald-200">
            Dataset analysed successfully
          </p>

          <p className="mt-1 text-sm text-fog">
            {Number(result.rows_processed).toLocaleString()} flows processed.
          </p>

          {result.capture_packets ? (
            <p className="mt-1 text-xs text-muted">
              {Number(result.capture_packets).toLocaleString()} Wireshark packets were aggregated into directional flows.
            </p>
          ) : null}

          {(result.rows_rejected || result.failed_records) ? (
            <p className="mt-1 text-xs text-amber-200">
              {Number(result.rows_rejected || 0).toLocaleString()} malformed rows rejected; {Number(result.failed_records || 0).toLocaleString()} records could not be analysed.
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">

            {Object.entries(result.predictions || {}).map(
              ([name, count]) => (

                <span
                  key={name}
                  className="rounded-md border border-rule bg-panel px-2 py-1 text-xs text-muted"
                >
                  {name}: {count}
                </span>

              )
            )}

          </div>

        </div>

      )}

    </Panel>

  );

}


function LiveSensorPanel({ user, status, error, onRefresh }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function control(action) {
    setBusy(true);
    setMessage("");
    try {
      const result = await api(`/api/traffic/sensor/${action}`, { method: "POST" });
      setMessage(result.running ? "Live metadata sensor is running." : "Live metadata sensor stopped.");
      onRefresh();
    } catch (exception) {
      setMessage(exception.message || "Unable to update the live sensor.");
    } finally {
      setBusy(false);
    }
  }

  const available = status?.available;
  return (
    <Panel
      title="Optional live sensor"
      subtitle="Admin-controlled tshark metadata collection. Packet payloads are not captured by NetShield."
    >
      {error && <ErrorNote message={error} />}
      {!status ? <Empty>Checking live sensor availability...</Empty> : (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className={status.running ? "text-sev-low" : "text-muted"}>
            {status.running ? "Running" : available ? "Ready" : "tshark is not installed"}
          </span>
          <span className="text-muted">Interface: {status.interface}</span>
          <span className="text-muted">Packets observed: {Number(status.packets_seen || 0).toLocaleString()}</span>
          <span className="text-muted">Flows saved: {Number(status.flows_processed || 0).toLocaleString()}</span>
          {can(user, "admin") && (
            <button
              className="btn-primary"
              disabled={busy || (!available && !status.running)}
              onClick={() => control(status.running ? "stop" : "start")}
            >
              {busy ? "Updating..." : status.running ? "Stop sensor" : "Start sensor"}
            </button>
          )}
          {status.last_error && <span className="text-sev-critical">{status.last_error}</span>}
          {!available && <span className="text-xs text-muted">Install Wireshark/tshark, then reload this page.</span>}
          {!can(user, "admin") && <span className="text-xs text-muted">Only administrators can start or stop capture.</span>}
        </div>
      )}
      {message && <p className="mt-3 text-sm text-muted" role="status">{message}</p>}
    </Panel>
  );
}
