"""Persistent suspicious-IP observation and analyst reporting workflow."""
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from uuid import uuid4
import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from app.core.dependencies import get_current_user
from app.models.user import User
from app.services.network_monitor import monitor

router = APIRouter(prefix="/anomaly", tags=["Anomaly Detection"])
STATE_PATH = Path(__file__).resolve().parents[3] / "data" / "anomaly_state.json"
STATE_LOCK = Lock()


def _load_state():
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not STATE_PATH.exists():
        return {"baseline_ips": [], "reports": []}
    try:
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {"baseline_ips": [], "reports": []}


def _save_state(state):
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    temp = STATE_PATH.with_suffix(".tmp")
    temp.write_text(json.dumps(state, indent=2), encoding="utf-8")
    temp.replace(STATE_PATH)


def _observed(minutes=15):
    rows = monitor.packets(minutes=minutes, limit=10000)
    ips = {}
    for packet in rows:
        ts = float(packet.get("timestamp", 0))
        for ip in (packet.get("source_ip"), packet.get("destination_ip")):
            if not ip or ip == "-":
                continue
            entry = ips.setdefault(ip, {"ip": ip, "packets": 0, "bytes": 0, "first_seen": ts, "last_seen": ts})
            entry["packets"] += 1
            entry["bytes"] += int(packet.get("bytes", 0) or 0)
            entry["first_seen"] = min(entry["first_seen"], ts)
            entry["last_seen"] = max(entry["last_seen"], ts)
    return list(ips.values())


def _analyze_packets(minutes=15):
    packets = monitor.packets(minutes=minutes, limit=10000)
    protocols = {}
    ports = {}
    source_counts = {}
    source_ports = {}
    flows = {}
    for p in packets:
        proto = p.get("protocol") or "OTHER"
        protocols[proto] = protocols.get(proto, 0) + 1
        src, dst = p.get("source_ip"), p.get("destination_ip")
        dport, sport = p.get("destination_port", "-"), p.get("source_port", "-")
        if dport not in (None, "-", ""):
            ports[str(dport)] = ports.get(str(dport), 0) + 1
        if src and src != "-":
            source_counts[src] = source_counts.get(src, 0) + 1
            source_ports.setdefault(src, set()).add(str(dport))
        key = (src, dst, proto, str(sport), str(dport))
        flows[key] = flows.get(key, 0) + 1

    findings = []
    for src, seen_ports in source_ports.items():
        valid_ports = [x for x in seen_ports if x not in ("-", "", "None")]
        if len(valid_ports) >= 8:
            findings.append({"category":"Port-scan pattern", "source_ip":src, "evidence":f"Observed {len(valid_ports)} distinct destination ports in the capture window", "score":55, "severity":"High", "confidence":"Rule-based indicator"})
    for (src, dst, proto, sport, dport), count in flows.items():
        if count >= 20:
            findings.append({"category":"Repeated connection pattern", "source_ip":src, "destination_ip":dst, "port":dport, "evidence":f"{count} packets in one observed flow", "score":25 if count < 50 else 40, "severity":"Medium" if count < 50 else "High", "confidence":"Rule-based indicator"})
    for src, count in source_counts.items():
        if count >= 250:
            findings.append({"category":"High-volume source", "source_ip":src, "evidence":f"{count} packets observed in the selected window", "score":30, "severity":"Medium", "confidence":"Rule-based indicator"})
    # Aggregate by source: each rule category contributes at most once, and invalid IPs are excluded.
    combined = {}
    for f in findings:
        key = f.get("source_ip")
        if not key or key == "-" or key == "Unknown":
            continue
        rec = combined.setdefault(key, {"source_ip":key, "score":0, "severity":"Low", "categories":[], "evidence":[], "_rule_scores":{}})
        rec["_rule_scores"][f["category"]] = max(rec["_rule_scores"].get(f["category"], 0), f["score"])
        if f["category"] not in rec["categories"]:
            rec["categories"].append(f["category"])
        if f["evidence"] not in rec["evidence"]:
            rec["evidence"].append(f["evidence"])
    for rec in combined.values():
        rec["score"] = min(100, sum(rec.pop("_rule_scores").values()))
        rec["severity"] = "Critical" if rec["score"] >= 70 else "High" if rec["score"] >= 40 else "Medium" if rec["score"] >= 20 else "Low"
        rec["classification"] = "Rule-based risk indicator; requires human review"
    findings = sorted(combined.values(), key=lambda x:x["score"], reverse=True)
    return {
        "protocols": sorted([{"name":k,"count":v} for k,v in protocols.items()], key=lambda x:x["count"], reverse=True)[:8],
        "destination_ports": sorted([{"port":k,"count":v} for k,v in ports.items()], key=lambda x:x["count"], reverse=True)[:8],
        "top_sources": sorted([{"ip":k,"count":v} for k,v in source_counts.items()], key=lambda x:x["count"], reverse=True)[:8],
        "findings": findings,
        "severity_counts": {level:sum(1 for f in findings if f["severity"]==level) for level in ("Low","Medium","High","Critical")},
        "packets_analyzed":len(packets),
        "recent_packets":packets[:200],
    }


@router.get("/suspicious")
def suspicious_activity(minutes: int = 15, current_user: User = Depends(get_current_user)):
    if minutes not in (15, 30, 60, 1440):
        raise HTTPException(422, "Minutes must be 15, 30, 60 or 1440")
    capture_status = monitor.start()
    observed = _observed(minutes)
    with STATE_LOCK:
        state = _load_state()
    baseline = set(state["baseline_ips"])
    reports = state["reports"]
    new_ips = [item for item in observed if item["ip"] not in baseline]
    report_by_ip = {r["ip"]: r for r in reports if r["status"] not in ("Dismissed", "Action Taken")}
    for item in new_ips:
        item["classification"] = "New IP observation"
        item["severity"] = "Medium" if item["packets"] >= 20 else "Low"
        item["status"] = report_by_ip.get(item["ip"], {}).get("status", "New")
        item["report_id"] = report_by_ip.get(item["ip"], {}).get("id")
    return {"baseline_count": len(baseline), "observed_count": len(observed), "new_ip_count": len(new_ips), "new_ips": sorted(new_ips, key=lambda x: x["packets"], reverse=True), "reports": reports[-100:], "analysis": _analyze_packets(minutes), "capture_status": capture_status}


class BaselineRequest(BaseModel):
    minutes: int = Field(default=15)


@router.post("/baseline")
def save_baseline(payload: BaselineRequest, current_user: User = Depends(get_current_user)):
    if current_user.role_id != 1:
        raise HTTPException(403, "Admin permission required to establish the IP baseline")
    if payload.minutes not in (15, 30, 60, 1440):
        raise HTTPException(422, "Minutes must be 15, 30, 60 or 1440")
    observed = _observed(payload.minutes)
    ips = sorted(item["ip"] for item in observed)
    with STATE_LOCK:
        state = _load_state()
        state["baseline_ips"] = ips
        state["baseline_saved_at"] = datetime.now(timezone.utc).isoformat()
        state["baseline_saved_by"] = current_user.full_name
        _save_state(state)
    return {"message": "Baseline saved", "ip_count": len(ips), "saved_at": state["baseline_saved_at"]}


class ReportRequest(BaseModel):
    ip: str = Field(min_length=3, max_length=64)
    description: str = Field(min_length=5, max_length=1000)


@router.post("/reports")
def report_activity(payload: ReportRequest, current_user: User = Depends(get_current_user)):
    if current_user.role_id not in (1, 2):
        raise HTTPException(403, "Only Analysts or Admins may report suspicious activity")
    with STATE_LOCK:
        state = _load_state()
        report = {
            "id": str(uuid4()), "ip": payload.ip.strip(), "description": payload.description.strip(),
            "reporter_id": current_user.id, "reporter_name": current_user.full_name,
            "created_at": datetime.now(timezone.utc).isoformat(), "status": "Reported",
            "reviewed_by": None, "reviewed_at": None, "review_note": None,
        }
        state["reports"].append(report)
        _save_state(state)
    return report


class ReviewRequest(BaseModel):
    action: str = Field(pattern="^(Action Taken|Dismissed)$")
    note: str = Field(default="", max_length=1000)


@router.patch("/reports/{report_id}")
def review_report(report_id: str, payload: ReviewRequest, current_user: User = Depends(get_current_user)):
    if current_user.role_id != 1:
        raise HTTPException(403, "Team Lead review is restricted to Admin accounts in this version")
    with STATE_LOCK:
        state = _load_state()
        report = next((r for r in state["reports"] if r["id"] == report_id), None)
        if report is None:
            raise HTTPException(404, "Report not found")
        if report["status"] in ("Action Taken", "Dismissed"):
            raise HTTPException(409, "This report has already been resolved")
        report["status"] = payload.action
        report["reviewed_by"] = current_user.full_name
        report["reviewed_at"] = datetime.now(timezone.utc).isoformat()
        report["review_note"] = payload.note.strip()
        _save_state(state)
    return report
