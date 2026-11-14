# NetShield AI — Analytics dashboard data and threat intelligence reports
# Developed by Krish | SKK Projects
from collections import Counter
from datetime import timedelta

from fastapi import APIRouter, Depends
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app import models
from app.auth import get_current_user
from app.database import get_db, utcnow
from app.services.threat_intel import lookup

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


def _flows_since(db: Session, minutes: int):
    since = utcnow() - timedelta(minutes=minutes)
    return db.query(models.TrafficFlow).filter(models.TrafficFlow.timestamp >= since).all()


@router.get("/overview")
def overview(minutes: int = 60, db: Session = Depends(get_db), _=Depends(get_current_user)):
    flows = _flows_since(db, minutes)
    attacks = [f for f in flows if f.predicted_attack != "BENIGN"]
    open_alerts = db.query(models.Alert).filter(models.Alert.status == "open")
    return {
        "minutes": minutes,
        "total_flows": len(flows),
        "attack_flows": len(attacks),
        "anomalies": sum(1 for f in flows if f.is_anomaly),
        "threat_intel_hits": sum(1 for f in flows if f.threat_intel_hit),
        "avg_risk": round(sum(f.risk_score for f in flows) / len(flows), 1) if flows else 0,
        "open_alerts": open_alerts.count(),
        "critical_open_alerts": open_alerts.filter(models.Alert.severity == "Critical").count(),
        "open_incidents": db.query(models.Incident).filter(models.Incident.status != "closed").count(),
        "attack_share": round(len(attacks) / len(flows), 3) if flows else 0,
    }


@router.get("/timeline")
def timeline(minutes: int = 120, bucket: int = 5, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Traffic vs attacks over time, in buckets of `bucket` minutes."""
    now = utcnow()
    start = now - timedelta(minutes=minutes)
    n = max(1, minutes // bucket)
    data = [{"time": (start + timedelta(minutes=bucket * i)).isoformat(), "total": 0, "attacks": 0,
             "anomalies": 0} for i in range(n)]
    for f in _flows_since(db, minutes):
        i = min(int((f.timestamp - start).total_seconds() // (bucket * 60)), n - 1)
        data[i]["total"] += 1
        data[i]["attacks"] += int(f.predicted_attack != "BENIGN")
        data[i]["anomalies"] += int(f.is_anomaly)
    return data


@router.get("/attack-types")
def attack_types(minutes: int = 120, db: Session = Depends(get_db), _=Depends(get_current_user)):
    return dict(Counter(f.predicted_attack for f in _flows_since(db, minutes)
                        if f.predicted_attack != "BENIGN"))


@router.get("/severity")
def severity(minutes: int = 120, db: Session = Depends(get_db), _=Depends(get_current_user)):
    since = utcnow() - timedelta(minutes=minutes)
    alerts = db.query(models.Alert.severity).filter(models.Alert.created_at >= since).all()
    counts = Counter(s for (s,) in alerts)
    return {k: counts.get(k, 0) for k in ("Low", "Medium", "High", "Critical")}


@router.get("/threat-intel")
def threat_intel(minutes: int = 1440, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Top attackers (with reputation), top targets and attack trend data."""
    attacks = [f for f in _flows_since(db, minutes) if f.predicted_attack != "BENIGN"]
    by_src, src_types, src_risk = Counter(), {}, {}
    targets = Counter()
    for f in attacks:
        by_src[f.src_ip] += 1
        src_types.setdefault(f.src_ip, Counter())[f.predicted_attack] += 1
        src_risk[f.src_ip] = max(src_risk.get(f.src_ip, 0), f.risk_score)
        targets[f"{f.dst_ip}:{f.dst_port}"] += 1
    top_attackers = []
    for ip, n in by_src.most_common(10):
        rep = lookup(ip)
        top_attackers.append({
            "ip": ip, "attacks": n, "max_risk": src_risk[ip],
            "main_attack": src_types[ip].most_common(1)[0][0],
            "reputation": rep["tag"] if rep else "Unknown", "country": rep["country"] if rep else "-",
        })
    return {
        "minutes": minutes, "total_attacks": len(attacks),
        "top_attackers": top_attackers,
        "top_targets": [{"target": t, "attacks": n} for t, n in targets.most_common(10)],
        "known_bad_hits": sum(1 for f in attacks if f.threat_intel_hit),
    }


@router.get("/report", response_class=PlainTextResponse)
def threat_report(minutes: int = 1440, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Downloadable threat intelligence report (Markdown text)."""
    ov = overview(minutes, db, user)
    ti = threat_intel(minutes, db, user)
    types = attack_types(minutes, db, user)
    sev = severity(minutes, db, user)
    lines = [
        "# NetShield AI — Threat Intelligence Report",
        f"Generated: {utcnow().isoformat(timespec='seconds')} UTC | Window: last {minutes} minutes",
        f"Prepared for: {user.full_name or user.username}", "",
        "## Summary",
        f"- Flows analysed: {ov['total_flows']}",
        f"- Attack flows: {ov['attack_flows']} ({ov['attack_share'] * 100:.1f}%)",
        f"- Anomalies: {ov['anomalies']}",
        f"- Known-bad IP hits: {ov['threat_intel_hits']}",
        f"- Open alerts: {ov['open_alerts']} (critical: {ov['critical_open_alerts']})", "",
        "## Alerts by severity", *[f"- {k}: {v}" for k, v in sev.items()], "",
        "## Attack types", *[f"- {k}: {v}" for k, v in sorted(types.items(), key=lambda x: -x[1])], "",
        "## Top attackers", "| IP | Attacks | Main attack | Reputation | Max risk |", "|---|---|---|---|---|",
        *[f"| {a['ip']} | {a['attacks']} | {a['main_attack']} | {a['reputation']} | {a['max_risk']} |"
          for a in ti["top_attackers"]], "",
        "## Most targeted services", *[f"- {t['target']}: {t['attacks']} attacks" for t in ti["top_targets"]],
        "", "---", "NetShield AI | Developed by Krish | SKK Projects",
    ]
    return "\n".join(lines) + "\n"
