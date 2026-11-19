import csv
import math
import os
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime
from functools import lru_cache
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse

from .dashboard import templates
from .models import User
from .permissions import ADMIN, ANALYST, LEAD, ROLE_LABELS, nav_for, primary_role
from .security import get_current_user

router = APIRouter()
PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATASET_PATH = PROJECT_ROOT / "cic.csv"
if not DEFAULT_DATASET_PATH.is_file() and (PROJECT_ROOT.parent / "cic.csv").is_file():
    DEFAULT_DATASET_PATH = PROJECT_ROOT.parent / "cic.csv"
DATASET_PATH = Path(os.environ.get("CIC_DATASET_PATH", str(DEFAULT_DATASET_PATH)))
SAMPLE_LIMIT = 50_000
DISPLAY_LIMIT = 200
DISPLAY_FIELDS = (
    "Dst Port", "Protocol", "Timestamp", "Flow Duration", "Tot Fwd Pkts",
    "Tot Bwd Pkts", "Flow Byts/s", "Flow Pkts/s", "Label",
    "TotLen Fwd Pkts", "TotLen Bwd Pkts",
)


def _role_names(user: User) -> set[str]:
    return {role.role_name for role in user.roles}


def _page_context(user: User, active: str, **values):
    roles = _role_names(user)
    return {
        "user": user,
        "role_label": ROLE_LABELS.get(primary_role(roles), "No role assigned"),
        "nav": nav_for(roles),
        "active": active,
        **values,
    }


@lru_cache(maxsize=1)
def _read_dataset_sample() -> tuple[list[dict[str, str]], dict[str, int], int]:
    if not DATASET_PATH.is_file():
        raise HTTPException(status_code=503, detail=f"CIC-IDS dataset not found: {DATASET_PATH}")
    rows: list[dict[str, str]] = []
    labels: Counter[str] = Counter()
    try:
        with DATASET_PATH.open(newline="", encoding="utf-8-sig", errors="replace") as source:
            reader = csv.DictReader(source)
            if not reader.fieldnames or "Label" not in reader.fieldnames:
                raise HTTPException(status_code=503, detail="CIC-IDS CSV is missing its Label column")
            for index, row in enumerate(reader):
                if index >= SAMPLE_LIMIT:
                    break
                label = (row.get("Label") or "").strip() or "Unknown"
                labels[label] += 1
                rows.append({field: (row.get(field) or "").strip() for field in DISPLAY_FIELDS})
    except (OSError, csv.Error) as exc:
        raise HTTPException(status_code=503, detail=f"Could not read CIC-IDS dataset: {exc}") from exc
    return rows, dict(labels), len(rows)


def _require_monitoring_access(user: User) -> None:
    if not _role_names(user) & {ADMIN, LEAD, ANALYST}:
        raise HTTPException(status_code=403, detail="Monitoring access required")


def _matching_rows(rows: list[dict[str, str]], label: str, search: str) -> list[dict[str, str]]:
    wanted_label = label.strip().casefold()
    query = search.strip().casefold()
    matched = (
        row for row in rows
        if (not wanted_label or row["Label"].casefold() == wanted_label)
        and (not query or any(query in value.casefold() for value in row.values()))
    )
    return list(matched)[:DISPLAY_LIMIT]


def _number(row: dict[str, str], field: str) -> float:
    try:
        value = float(row.get(field, ""))
        return value if math.isfinite(value) else 0
    except (TypeError, ValueError):
        return 0


def _timestamp(value: str) -> datetime | None:
    for pattern in ("%d-%m-%Y %H:%M", "%d-%m-%Y %H:%M:%S", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(value, pattern)
        except ValueError:
            continue
    return None


@dataclass
class _PortTotals:
    flows: int = 0
    bytes: int = 0
    packets: int = 0


@dataclass
class _HourTotals:
    flows: int = 0
    bytes: int = 0
    benign: int = 0
    threats: int = 0


@dataclass
class _FlowSummary:
    total_flows: int = 0
    total_bytes: int = 0
    benign_flows: int = 0
    label_counts: Counter[str] = field(default_factory=Counter)
    ports: dict[str, _PortTotals] = field(default_factory=dict)
    benign_times: Counter[str] = field(default_factory=Counter)
    threat_times: Counter[str] = field(default_factory=Counter)
    benign_bytes_by_time: Counter[str] = field(default_factory=Counter)
    threat_bytes_by_time: Counter[str] = field(default_factory=Counter)
    records: list[dict[str, str | int]] = field(default_factory=list)


def _accumulate_flow(summary: _FlowSummary, row: dict[str, str]) -> None:
    label = row["Label"]
    is_benign = label.casefold() == "benign"
    byte_count = max(0, int(
        _number(row, "TotLen Fwd Pkts") + _number(row, "TotLen Bwd Pkts")
    ))
    packet_count = max(0, int(_number(row, "Tot Fwd Pkts") + _number(row, "Tot Bwd Pkts")))
    port = row["Dst Port"] or "Unknown"

    summary.total_flows += 1
    summary.total_bytes += byte_count
    summary.benign_flows += int(is_benign)
    summary.label_counts[label] += 1

    port_totals = summary.ports.setdefault(port, _PortTotals())
    port_totals.flows += 1
    port_totals.bytes += byte_count
    port_totals.packets += packet_count

    if is_benign:
        summary.benign_times[row["Timestamp"]] += 1
        summary.benign_bytes_by_time[row["Timestamp"]] += byte_count
    else:
        summary.threat_times[row["Timestamp"]] += 1
        summary.threat_bytes_by_time[row["Timestamp"]] += byte_count


def _merge_summary(target: _FlowSummary, source: _FlowSummary) -> None:
    target.total_flows += source.total_flows
    target.total_bytes += source.total_bytes
    target.benign_flows += source.benign_flows
    target.label_counts.update(source.label_counts)
    target.benign_times.update(source.benign_times)
    target.threat_times.update(source.threat_times)
    target.benign_bytes_by_time.update(source.benign_bytes_by_time)
    target.threat_bytes_by_time.update(source.threat_bytes_by_time)
    for port, values in source.ports.items():
        totals = target.ports.setdefault(port, _PortTotals())
        totals.flows += values.flows
        totals.bytes += values.bytes
        totals.packets += values.packets


def _summary_payload(summary: _FlowSummary) -> dict:
    top_ports = sorted(
        (
            {"port": port, "flows": values.flows, "bytes": values.bytes, "packets": values.packets}
            for port, values in summary.ports.items()
        ),
        key=lambda item: (-item["flows"], item["port"]),
    )[:10]
    hourly: dict[datetime, _HourTotals] = {}
    for timestamps, byte_counts, benign in (
        (summary.benign_times, summary.benign_bytes_by_time, True),
        (summary.threat_times, summary.threat_bytes_by_time, False),
    ):
        for value, count in timestamps.items():
            flow_time = _timestamp(value)
            if flow_time is None:
                continue
            hour = flow_time.replace(minute=0, second=0, microsecond=0)
            totals = hourly.setdefault(hour, _HourTotals())
            totals.flows += count
            totals.bytes += byte_counts[value]
            if benign:
                totals.benign += count
            else:
                totals.threats += count

    return {
        "total_flows": summary.total_flows,
        "total_bytes": summary.total_bytes,
        "benign_flows": summary.benign_flows,
        "threat_flows": summary.total_flows - summary.benign_flows,
        "labels": [
            {"name": name, "count": count}
            for name, count in summary.label_counts.most_common()
        ],
        "top_ports": top_ports,
        "trend": [
            {
                "time": hour.strftime("%d %b %H:00"),
                "flows": values.flows,
                "bytes": values.bytes,
                "benign": values.benign,
                "threats": values.threats,
            }
            for hour, values in sorted(hourly.items())[-24:]
        ],
        "records": summary.records,
    }


@lru_cache(maxsize=1)
def _read_full_dataset_summary() -> tuple[int, dict[str, _FlowSummary], _FlowSummary, _FlowSummary]:
    if not DATASET_PATH.is_file():
        raise HTTPException(status_code=503, detail=f"CIC-IDS dataset not found: {DATASET_PATH}")

    by_label: dict[str, _FlowSummary] = {}
    all_records: list[dict[str, str | int]] = []
    threat_records: list[dict[str, str | int]] = []
    fields = (
        "Dst Port", "Protocol", "Timestamp", "Tot Fwd Pkts", "Tot Bwd Pkts",
        "TotLen Fwd Pkts", "TotLen Bwd Pkts", "Label",
    )
    try:
        with DATASET_PATH.open(newline="", encoding="utf-8-sig", errors="replace") as source:
            reader = csv.reader(source)
            header = next(reader, None)
            if not header or "Label" not in header:
                raise HTTPException(status_code=503, detail="CIC-IDS CSV is missing its Label column")
            indexes = {name: header.index(name) for name in fields if name in header}
            if "Label" not in indexes:
                raise HTTPException(status_code=503, detail="CIC-IDS CSV is missing its Label column")

            for values in reader:
                row = {
                    name: values[indexes[name]].strip() if name in indexes and indexes[name] < len(values) else ""
                    for name in fields
                }
                row["Label"] = row["Label"] or "Unknown"
                label_summary = by_label.setdefault(row["Label"], _FlowSummary())
                _accumulate_flow(label_summary, row)
                is_threat = row["Label"].casefold() != "benign"
                if (
                    len(label_summary.records) < 20
                    or len(all_records) < 20
                    or (is_threat and len(threat_records) < 20)
                ):
                    record = {
                        "timestamp": row["Timestamp"],
                        "dst_port": row["Dst Port"] or "Unknown",
                        "protocol": row["Protocol"] or "Unknown",
                        "label": row["Label"],
                        "bytes": max(0, int(
                            _number(row, "TotLen Fwd Pkts") + _number(row, "TotLen Bwd Pkts")
                        )),
                        "packets": max(0, int(
                            _number(row, "Tot Fwd Pkts") + _number(row, "Tot Bwd Pkts")
                        )),
                    }
                    if len(label_summary.records) < 20:
                        label_summary.records.append(record)
                    if len(all_records) < 20:
                        all_records.append(record)
                    if is_threat and len(threat_records) < 20:
                        threat_records.append(record)
    except (OSError, csv.Error) as exc:
        raise HTTPException(status_code=503, detail=f"Could not read CIC-IDS dataset: {exc}") from exc

    all_flows = _FlowSummary(records=all_records)
    threat_flows = _FlowSummary(records=threat_records)
    for label, summary in by_label.items():
        _merge_summary(all_flows, summary)
        if label.casefold() != "benign":
            _merge_summary(threat_flows, summary)
    return all_flows.total_flows, by_label, all_flows, threat_flows


@router.get("/api/monitoring/summary")
def monitoring_summary(
    label: str = "",
    threats_only: bool = False,
    user: User = Depends(get_current_user),
):
    _require_monitoring_access(user)
    scanned, by_label, all_summary, threat_summary = _read_full_dataset_summary()
    available_labels = sorted(by_label)
    selected_label = next(
        (name for name in available_labels if name.casefold() == label.strip().casefold()),
        None,
    )
    if threats_only:
        if label.strip() and selected_label is None:
            summary = _FlowSummary()
        else:
            summary = by_label.get(selected_label, _FlowSummary()) if selected_label else threat_summary
        if selected_label and selected_label.casefold() == "benign":
            summary = _FlowSummary()
    else:
        summary = (
            by_label.get(selected_label, _FlowSummary())
            if label.strip()
            else all_summary
        )
    return {
        "source": "CIC-IDS 2018 full CSV",
        "scanned": scanned,
        "available_labels": available_labels,
        **_summary_payload(summary),
    }


@router.get("/monitoring/activity", response_class=HTMLResponse)
def activity_page(request: Request, label: str = "", q: str = "",
                  user: User = Depends(get_current_user)):
    _require_monitoring_access(user)
    rows, labels, scanned = _read_dataset_sample()
    return templates.TemplateResponse(
        request, "dataset_activity.html",
        _page_context(user, "/monitoring/activity", page_title="Network Activity",
                      rows=_matching_rows(rows, label, q), labels=labels,
                      scanned=scanned, total_labels=sum(labels.values()),
                      selected_label=label, search=q, alerts_only=False),
    )


@router.get("/monitoring/alerts", response_class=HTMLResponse)
def alerts_page(request: Request, label: str = "", q: str = "",
                user: User = Depends(get_current_user)):
    _require_monitoring_access(user)
    rows, labels, scanned = _read_dataset_sample()
    attacks = [row for row in rows if row["Label"].casefold() not in {"benign", "unknown"}]
    return templates.TemplateResponse(
        request, "dataset_activity.html",
        _page_context(user, "/monitoring/alerts", page_title="Dataset Alerts",
                      rows=_matching_rows(attacks, label, q), labels=labels,
                      scanned=scanned, total_labels=sum(labels.values()),
                      selected_label=label, search=q, alerts_only=True),
    )
