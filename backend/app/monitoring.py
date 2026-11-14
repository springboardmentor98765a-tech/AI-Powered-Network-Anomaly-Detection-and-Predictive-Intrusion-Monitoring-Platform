import csv
import os
from collections import Counter
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
