from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import case, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user, require_roles
from app.anomaly_models import ProtectedDataResource, SuspiciousActivityReport
from app.db.session import get_db
from app.models import AuditLog, Team, TeamMember, User
from app.schemas.anomaly import (
    SuspiciousActivityReportCreate,
    SuspiciousActivityReportReview,
    SecurityClearanceUpdate,
)
from app.services.anomaly_detection import build_anomaly_analysis
from app.services.anomaly_model import get_model_status, train_unsupervised_models


router = APIRouter(prefix="/anomaly", tags=["Anomaly Detection"])

ADMIN = "Administrator"
ANALYST = "Security Analyst"
LEAD = "Team Lead / Supervisor"
VIEW_ROLES = (ADMIN, ANALYST, LEAD)
CLEARANCE_LABELS = {1: "PUBLIC", 2: "INTERNAL", 3: "CONFIDENTIAL", 4: "RESTRICTED"}


@router.get("/access/resources")
def list_protected_resources(
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles(*VIEW_ROLES)),
):
    """List resource metadata and the current user's separate data-clearance level."""
    resources = db.scalars(
        select(ProtectedDataResource).order_by(
            ProtectedDataResource.classification_level,
            ProtectedDataResource.resource_name,
        )
    ).all()
    return {
        "current_user": {
            "id": actor.id,
            "name": actor.name,
            "security_clearance_level": actor.security_clearance_level,
            "security_clearance_label": CLEARANCE_LABELS.get(actor.security_clearance_level, "UNKNOWN"),
        },
        "items": [
            {
                "id": resource.id,
                "resource_key": resource.resource_key,
                "resource_name": resource.resource_name,
                "description": resource.description,
                "classification_level": resource.classification_level,
                "classification_label": CLEARANCE_LABELS.get(resource.classification_level, "UNKNOWN"),
                "is_demo": resource.is_demo,
            }
            for resource in resources
        ],
    }


@router.post("/access/resources/{resource_id}/attempt")
def attempt_protected_resource_access(
    resource_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    """Enforce data clearance and audit both allowed and denied content access."""
    resource = db.get(ProtectedDataResource, resource_id)
    if resource is None:
        raise HTTPException(status_code=404, detail="Protected resource not found.")

    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent", "")[:300]
    allowed = actor.security_clearance_level >= resource.classification_level
    action = "DATA_CLEARANCE_GRANTED" if allowed else "DATA_CLEARANCE_DENIED"

    db.add(AuditLog(
        actor_user_id=actor.id,
        action=action,
        target_type="ProtectedDataResource",
        target_id=str(resource.id),
        status="SUCCESS" if allowed else "FAILED",
        details={
            "resource_id": resource.id,
            "resource_key": resource.resource_key,
            "resource_name": resource.resource_name,
            "required_clearance_level": resource.classification_level,
            "required_clearance_label": CLEARANCE_LABELS.get(resource.classification_level),
            "actor_clearance_level": actor.security_clearance_level,
            "actor_clearance_label": CLEARANCE_LABELS.get(actor.security_clearance_level),
            "client_ip": client_ip,
            "path": request.url.path,
            "user_agent": user_agent,
            "is_demo": resource.is_demo,
        },
    ))
    db.commit()

    if not allowed:
        raise HTTPException(
            status_code=403,
            detail=(
                f"Access denied. This resource requires {CLEARANCE_LABELS[resource.classification_level]} "
                f"(Level {resource.classification_level}); your clearance is "
                f"{CLEARANCE_LABELS[actor.security_clearance_level]} "
                f"(Level {actor.security_clearance_level}). The attempt was recorded for anomaly analysis."
            ),
        )

    return {
        "granted": True,
        "resource": {
            "id": resource.id,
            "resource_name": resource.resource_name,
            "classification_level": resource.classification_level,
            "classification_label": CLEARANCE_LABELS.get(resource.classification_level),
            "is_demo": resource.is_demo,
        },
        "content": resource.demo_content,
        "message": "Access granted. The successful clearance check was recorded in the audit log.",
    }


@router.get("/access/users")
def list_user_clearances(
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles(ADMIN)),
):
    users = db.scalars(select(User).order_by(User.username)).all()
    return [
        {
            "id": item.id,
            "name": item.name,
            "username": item.username,
            "security_clearance_level": item.security_clearance_level,
            "security_clearance_label": CLEARANCE_LABELS.get(item.security_clearance_level, "UNKNOWN"),
        }
        for item in users
    ]


@router.patch("/access/users/{user_id}/clearance")
def update_user_clearance(
    user_id: int,
    data: SecurityClearanceUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles(ADMIN)),
):
    user_to_update = db.get(User, user_id)
    if user_to_update is None:
        raise HTTPException(status_code=404, detail="User not found.")

    previous_level = user_to_update.security_clearance_level
    user_to_update.security_clearance_level = data.level
    db.add(AuditLog(
        actor_user_id=actor.id,
        action="SECURITY_CLEARANCE_UPDATED",
        target_type="User",
        target_id=str(user_to_update.id),
        status="SUCCESS",
        details={
            "username": user_to_update.username,
            "previous_clearance_level": previous_level,
            "new_clearance_level": data.level,
        },
    ))
    db.commit()
    return {
        "user_id": user_to_update.id,
        "username": user_to_update.username,
        "security_clearance_level": user_to_update.security_clearance_level,
        "security_clearance_label": CLEARANCE_LABELS[data.level],
    }


def _user_roles(user: User) -> set[str]:
    return {role.role_name for role in user.roles}


def _visible_team_ids(db: Session, actor: User, roles: set[str]):
    if ADMIN in roles:
        return None

    visible_ids: set[int] = set()
    if LEAD in roles:
        lead_ids = db.scalars(
            select(Team.id).where(Team.team_lead_id == actor.id)
        ).all()
        visible_ids.update(lead_ids)

    if ANALYST in roles:
        member_ids = db.scalars(
            select(TeamMember.team_id).where(TeamMember.user_id == actor.id)
        ).all()
        visible_ids.update(member_ids)

    return sorted(visible_ids)


def _serialize_report(report: SuspiciousActivityReport):
    return {
        "id": report.id,
        "team_id": report.team_id,
        "team_name": report.team.team_name if report.team else None,
        "activity_type": report.activity_type,
        "title": report.title,
        "description": report.description,
        "source_ip": report.source_ip,
        "destination_ip": report.destination_ip,
        "evidence": report.evidence,
        "status": report.status,
        "reported_by_user_id": report.reported_by_user_id,
        "reporter_name": report.reporter.name if report.reporter else "Former user",
        "reviewed_by_user_id": report.reviewed_by_user_id,
        "reviewer_name": report.reviewer.name if report.reviewer else None,
        "review_note": report.review_note,
        "created_at": report.created_at,
        "reviewed_at": report.reviewed_at,
    }


@router.get("/analysis")
def get_anomaly_analysis(
    window_minutes: int = Query(default=60, ge=15, le=120),
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(*VIEW_ROLES)),
):
    """Return Module 3 behavior, suspicious activity, patterns and classifications."""
    if window_minutes not in (15, 30, 60, 120):
        raise HTTPException(
            status_code=422,
            detail="window_minutes must be 15, 30, 60 or 120.",
        )
    return build_anomaly_analysis(db, window_minutes)


@router.get("/model/status")
def get_anomaly_model_status(
    current_user=Depends(require_roles(*VIEW_ROLES)),
):
    return get_model_status()


@router.post("/model/train")
def train_anomaly_models(
    contamination: float = Query(default=0.05, ge=0.01, le=0.15),
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles(ADMIN, ANALYST)),
):
    try:
        metadata = train_unsupervised_models(db, contamination=contamination)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    db.add(AuditLog(
        actor_user_id=actor.id,
        action="ANOMALY_MODEL_TRAINED",
        target_type="AnomalyDetectionModel",
        target_id="module3-unsupervised",
        status="SUCCESS",
        details={
            "training_flows": metadata.get("training_flows"),
            "algorithms": metadata.get("algorithms"),
            "contamination": metadata.get("contamination"),
        },
    ))
    db.commit()
    return metadata


@router.get("/teams")
def get_report_teams(
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles(ANALYST, LEAD, ADMIN)),
):
    """List teams the current user is allowed to report to or review."""
    roles = _user_roles(actor)
    team_ids = _visible_team_ids(db, actor, roles)

    query = select(Team).order_by(Team.team_name)
    if team_ids is not None:
        if not team_ids:
            return []
        query = query.where(Team.id.in_(team_ids))

    teams = db.scalars(query).all()
    return [
        {
            "id": team.id,
            "team_name": team.team_name,
            "team_lead_id": team.team_lead_id,
            "is_team_lead": team.team_lead_id == actor.id,
        }
        for team in teams
    ]


@router.post("/reports", status_code=status.HTTP_201_CREATED)
def create_suspicious_activity_report(
    data: SuspiciousActivityReportCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles(ANALYST)),
):
    """Allow an analyst to submit a suspicious activity report to their team lead."""
    team = db.scalar(
        select(Team)
        .join(TeamMember, TeamMember.team_id == Team.id)
        .where(
            Team.id == data.team_id,
            TeamMember.user_id == actor.id,
        )
    )
    if team is None:
        raise HTTPException(
            status_code=403,
            detail="You can only report activity to a team you belong to.",
        )
    if team.team_lead_id is None:
        raise HTTPException(
            status_code=409,
            detail="This team does not currently have an assigned team lead.",
        )

    report = SuspiciousActivityReport(
        team_id=team.id,
        reported_by_user_id=actor.id,
        activity_type=data.activity_type,
        title=data.title,
        description=data.description,
        source_ip=data.source_ip,
        destination_ip=data.destination_ip,
        evidence=data.evidence,
        status="PENDING",
    )
    db.add(report)
    db.flush()

    db.add(AuditLog(
        actor_user_id=actor.id,
        action="SUSPICIOUS_ACTIVITY_REPORTED",
        target_type="SuspiciousActivityReport",
        target_id=str(report.id),
        status="SUCCESS",
        details={
            "team_id": team.id,
            "activity_type": report.activity_type,
            "source_ip": report.source_ip,
            "destination_ip": report.destination_ip,
        },
    ))
    db.commit()

    report = db.scalar(
        select(SuspiciousActivityReport)
        .options(
            selectinload(SuspiciousActivityReport.team),
            selectinload(SuspiciousActivityReport.reporter),
            selectinload(SuspiciousActivityReport.reviewer),
        )
        .where(SuspiciousActivityReport.id == report.id)
    )
    return _serialize_report(report)


@router.get("/reports")
def list_suspicious_activity_reports(
    report_status: str | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles(*VIEW_ROLES)),
):
    """List reports for the user's teams; team leads see reports assigned to their teams."""
    if report_status and report_status not in {"PENDING", "ACTION_TAKEN", "DISMISSED"}:
        raise HTTPException(422, "status must be PENDING, ACTION_TAKEN or DISMISSED.")

    roles = _user_roles(actor)
    team_ids = _visible_team_ids(db, actor, roles)

    query = select(SuspiciousActivityReport).options(
        selectinload(SuspiciousActivityReport.team),
        selectinload(SuspiciousActivityReport.reporter),
        selectinload(SuspiciousActivityReport.reviewer),
    )
    if team_ids is not None:
        if not team_ids:
            return []
        query = query.where(SuspiciousActivityReport.team_id.in_(team_ids))
    if report_status:
        query = query.where(SuspiciousActivityReport.status == report_status)

    query = query.order_by(
        case((SuspiciousActivityReport.status == "PENDING", 0), else_=1),
        SuspiciousActivityReport.created_at.desc(),
    )
    reports = db.scalars(query.limit(200)).all()
    return [_serialize_report(item) for item in reports]


@router.patch("/reports/{report_id}/review")
def review_suspicious_activity_report(
    report_id: int,
    data: SuspiciousActivityReportReview,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles(LEAD, ADMIN)),
):
    """Allow the assigned team lead (or administrator) to act on or dismiss a report."""
    report = db.scalar(
        select(SuspiciousActivityReport)
        .options(selectinload(SuspiciousActivityReport.team))
        .where(SuspiciousActivityReport.id == report_id)
    )
    if report is None:
        raise HTTPException(404, "Suspicious activity report not found.")

    roles = _user_roles(actor)
    is_admin = ADMIN in roles
    is_assigned_lead = report.team and report.team.team_lead_id == actor.id
    if not (is_admin or is_assigned_lead):
        raise HTTPException(
            status_code=403,
            detail="Only the assigned team lead or an administrator can review this report.",
        )

    if report.status != "PENDING":
        raise HTTPException(
            status_code=409,
            detail="This report has already been reviewed.",
        )

    report.status = data.decision
    report.reviewed_by_user_id = actor.id
    report.review_note = data.review_note
    report.reviewed_at = datetime.now(timezone.utc)

    db.add(AuditLog(
        actor_user_id=actor.id,
        action=(
            "SUSPICIOUS_ACTIVITY_ACTION_TAKEN"
            if data.decision == "ACTION_TAKEN"
            else "SUSPICIOUS_ACTIVITY_DISMISSED"
        ),
        target_type="SuspiciousActivityReport",
        target_id=str(report.id),
        status="SUCCESS",
        details={
            "team_id": report.team_id,
            "review_note": data.review_note,
        },
    ))
    db.commit()

    report = db.scalar(
        select(SuspiciousActivityReport)
        .options(
            selectinload(SuspiciousActivityReport.team),
            selectinload(SuspiciousActivityReport.reporter),
            selectinload(SuspiciousActivityReport.reviewer),
        )
        .where(SuspiciousActivityReport.id == report_id)
    )
    return _serialize_report(report)
