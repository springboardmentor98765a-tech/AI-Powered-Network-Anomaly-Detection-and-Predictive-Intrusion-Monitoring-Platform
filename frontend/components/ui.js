
"use client";

import { useEffect } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";

/* =========================================================
   PANEL — REUSABLE DASHBOARD CONTAINER
   ========================================================= */

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className = "",
}) {
  return (
    <motion.section
      className={`panel ${className}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
    >
      {(title || actions) && (
        <div className="panel-heading">
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <p>{subtitle}</p>}
          </div>

          {actions && <div>{actions}</div>}
        </div>
      )}

      <div className="panel-body">
        {children}
      </div>
    </motion.section>
  );
}

/* =========================================================
   KPI CARD — ANIMATED NUMBERS
   ========================================================= */

const TONE = {
  low: "var(--sev-low)",
  medium: "var(--sev-medium)",
  high: "var(--sev-high)",
  critical: "var(--sev-critical)",
  signal: "var(--accent)",
};

function AnimatedValue({ value }) {
  const text = String(value ?? "—");

  const match = text
    .replace(/,/g, "")
    .match(/^(-?\d+(?:\.\d+)?)(.*)$/);

  const target = match ? Number(match[1]) : 0;
  const suffix = match ? match[2] : "";

  const decimals = match?.[1]?.split(".")[1]?.length || 0;

  const count = useMotionValue(0);

  const spring = useSpring(count, {
    stiffness: 95,
    damping: 22,
    mass: 0.6,
  });

  const output = useTransform(spring, (latest) => {
    const formatted = new Intl.NumberFormat(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(latest);

    return `${formatted}${suffix}`;
  });

  useEffect(() => {
    if (match && Number.isFinite(target)) {
      count.set(target);
    }
  }, [count, target, decimals, suffix, Boolean(match)]);

  if (!match) {
    return <>{value}</>;
  }

  return <motion.span>{output}</motion.span>;
}

/* =========================================================
   SPARKLINE — SMALL KPI TREND CHART
   ========================================================= */

function Sparkline({
  values,
  color = "var(--accent)",
}) {
  if (!Array.isArray(values)) return null;

  const pointsData = values
    .map(Number)
    .filter(Number.isFinite);

  if (pointsData.length < 2) return null;

  const width = 100;
  const height = 28;

  const min = Math.min(...pointsData);
  const max = Math.max(...pointsData);

  const range = Math.max(1, max - min);

  const points = pointsData
    .map((value, index) => {
      const x =
        (index / (pointsData.length - 1)) * width;

      const y =
        height -
        3 -
        ((value - min) / range) * (height - 7);

      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      className="stat-sparkline"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Recent metric trend"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* =========================================================
   STAT — KPI CARD
   Existing props retained:
   label, value, hint, tone
   Additional optional props:
   sparkline, trend
   ========================================================= */

export function Stat({
  label,
  value,
  hint,
  tone,
  sparkline,
  trend,
}) {
  const color = TONE[tone] || "var(--text)";

  const trendUp = trend?.direction === "up";
  const trendDown = trend?.direction === "down";

  const visuallyNegative =
    trend?.positive === false
      ? trendUp
      : trendDown;

  const trendText =
    typeof trend?.value === "number"
      ? `${trend.value > 0 ? "+" : ""}${trend.value.toFixed(1)}%`
      : trend?.value;

  return (
    <motion.div
      className="panel stat-card"
      whileHover={{
        y: -3,
        transition: { duration: 0.16 },
      }}
      initial={{ opacity: 0, y: 9 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.25,
        ease: "easeOut",
      }}
    >
      <div className="stat-topline">
        <p className="stat-label">{label}</p>

        {tone && (
          <span
            aria-hidden="true"
            style={{
              width: 7,
              height: 7,
              borderRadius: 99,
              background: color,
              boxShadow: `0 0 12px ${color}`,
            }}
          />
        )}
      </div>

      <p
        className="stat-value"
        style={{ color }}
      >
        <AnimatedValue value={value} />
      </p>

      <div className="stat-bottom">
        <p className="stat-hint">
          {hint || "Live telemetry"}
        </p>

        <Sparkline
          values={sparkline}
          color={color}
        />

        {trend && (
          <span
            className={`stat-trend ${
              visuallyNegative ? "down" : ""
            }`}
            title={
              trend.label ||
              "Change versus previous period"
            }
          >
            <span aria-hidden="true">
              {trendUp ? "↗" : trendDown ? "↘" : "•"}
            </span>

            {trendText}
          </span>
        )}
      </div>
    </motion.div>
  );
}

/* =========================================================
   SEVERITY BADGE
   ========================================================= */

const SEV = {
  Low: "sev-low",
  low: "sev-low",

  Medium: "sev-medium",
  medium: "sev-medium",

  High: "sev-high",
  high: "sev-high",

  Critical: "sev-critical",
  critical: "sev-critical",
};

export function Severity({ level }) {
  const severityClass =
    SEV[level] || "sev-unknown";

  const label = level || "Unknown";

  return (
    <span
      className={`severity-badge ${severityClass}`}
      aria-label={`Severity: ${label}`}
    >
      {label}
    </span>
  );
}

/* =========================================================
   STATUS INDICATOR
   ========================================================= */

const STATUS = {
  open: "status-open",
  acknowledged: "status-acknowledged",
  resolved: "status-resolved",
  investigating: "status-investigating",
  contained: "status-contained",
  closed: "status-closed",
};

export function Status({ value }) {
  const normalized =
    String(value || "").toLowerCase();

  const statusClass =
    STATUS[normalized] || "";

  return (
    <span
      className={`status-pill ${statusClass}`}
    >
      {value || "Unknown"}
    </span>
  );
}

/* =========================================================
   RISK BAR
   ========================================================= */

export function RiskBar({ score }) {
  const safeScore = Math.max(
    0,
    Math.min(100, Number(score) || 0)
  );

  const level =
    safeScore >= 75
      ? "critical"
      : safeScore >= 50
      ? "high"
      : safeScore >= 25
      ? "medium"
      : "low";

  return (
    <div
      className="flex items-center gap-2"
      title={`Risk ${safeScore}/100`}
      role="meter"
      aria-label="Risk score"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safeScore}
    >
      <div className="risk-track">
        <div
          className={`risk-fill risk-${level}`}
          style={{ width: `${safeScore}%` }}
        />
      </div>

      <span className="tabular-nums text-xs">
        {safeScore}
      </span>
    </div>
  );
}

/* =========================================================
   ERROR STATE
   ========================================================= */

export function ErrorNote({ message }) {
  if (!message) return null;

  return (
    <motion.div
      className="error-note"
      role="alert"
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <span aria-hidden="true">!</span>
      <span>{message}</span>
    </motion.div>
  );
}

/* =========================================================
   EMPTY STATE AND LOADING STATE
   ========================================================= */

export function Empty({ children }) {
  const message =
    typeof children === "string"
      ? children
      : "No data available.";

  const loading =
    /^\s*(loading|fetching|connecting)/i.test(message);

  if (loading) {
    return (
      <div
        className="empty-state loading"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span className="skeleton-line" />
        <span className="skeleton-line short" />
        <span>{children}</span>
      </div>
    );
  }

  return (
    <div className="empty-state">
      <span aria-hidden="true">◇</span>
      <span>{children}</span>
    </div>
  );
}

/* =========================================================
   SKELETON LOADER
   ========================================================= */

export function Skeleton({ rows = 3 }) {
  const safeRows = Math.max(
    1,
    Math.min(10, Number(rows) || 3)
  );

  return (
    <div
      className="empty-state loading"
      role="status"
      aria-busy="true"
      aria-label="Loading content"
    >
      {Array.from({ length: safeRows }).map(
        (_, index) => (
          <span
            key={index}
            className={`skeleton-line ${
              index % 2 ? "short" : ""
            }`}
          />
        )
      )}
    </div>
  );
}

/* =========================================================
   LIVE STATUS INDICATOR
   ========================================================= */

export function LiveIndicator({
  label = "Live polling active",
}) {
  return (
    <span className="live-indicator">
      <span
        className="live-dot"
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
