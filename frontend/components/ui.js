// NetShield AI — Small reusable UI pieces
// Developed by Krish | SKK Projects
"use client";

export function Panel({ title, subtitle, actions, children, className = "" }) {
  return (
    <section className={`panel ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-2 px-4 pt-4">
          <div>
            {title && <h2 className="font-semibold">{title}</h2>}
            {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

const TONE = { low: "text-sev-low", medium: "text-sev-medium", high: "text-sev-high", critical: "text-sev-critical", signal: "text-signal" };

export function Stat({ label, value, hint, tone }) {
  const color = TONE[tone] || "text-fog";
  return (
    <div className="panel px-4 py-3">
      <p className="text-sm text-muted">{label}</p>
      <p className={`text-3xl font-semibold mt-1 tabular-nums ${color}`}>{value}</p>
      {hint && <p className="text-xs text-muted mt-1">{hint}</p>}
    </div>
  );
}

const SEV = {
  Low: "bg-sev-low/15 text-sev-low", Medium: "bg-sev-medium/15 text-sev-medium",
  High: "bg-sev-high/15 text-sev-high", Critical: "bg-sev-critical/20 text-sev-critical",
};

export function Severity({ level }) {
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${SEV[level] || "bg-rule text-muted"}`}>{level}</span>;
}

const STATUS = {
  open: "text-sev-critical", acknowledged: "text-sev-medium", resolved: "text-sev-low",
  investigating: "text-sev-medium", contained: "text-signal", closed: "text-sev-low",
};

export function Status({ value }) {
  return <span className={`text-sm capitalize ${STATUS[value] || "text-muted"}`}>{value}</span>;
}

export function RiskBar({ score }) {
  const color = score >= 75 ? "bg-sev-critical" : score >= 50 ? "bg-sev-high" : score >= 25 ? "bg-sev-medium" : "bg-sev-low";
  return (
    <div className="flex items-center gap-2" title={`Risk ${score}/100`}>
      <div className="h-1.5 w-16 rounded bg-rule overflow-hidden"><div className={`h-full ${color}`} style={{ width: `${score}%` }} /></div>
      <span className="tabular-nums text-xs">{score}</span>
    </div>
  );
}

export function ErrorNote({ message }) {
  if (!message) return null;
  return <p role="alert" className="rounded-md border border-sev-critical/50 bg-sev-critical/10 px-3 py-2 text-sm text-sev-critical">{message}</p>;
}

export function Empty({ children }) {
  return <p className="text-sm text-muted py-6 text-center">{children}</p>;
}
