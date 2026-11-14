# NetShield AI — Alert management and incident management
# Developed by Krish | SKK Projects
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import case
from sqlalchemy.orm import Session

from app import models, schemas
from app.audit import log_action
from app.auth import get_current_user, require_role
from app.database import get_db

router = APIRouter(prefix="/api", tags=["Alerts & Incidents"])

SEVERITY_RANK = case(
    (models.Alert.severity == "Critical", 4), (models.Alert.severity == "High", 3),
    (models.Alert.severity == "Medium", 2), else_=1)
STATUS_RANK = case((models.Alert.status == "open", 0), (models.Alert.status == "acknowledged", 1), else_=2)


@router.get("/alerts", response_model=list[schemas.AlertOut])
def list_alerts(status: str | None = None, severity: str | None = None, attack_type: str | None = None,
                limit: int = 200, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Alert prioritisation: open first, then most severe, then highest risk, then newest."""
    q = db.query(models.Alert)
    if status:
        q = q.filter(models.Alert.status == status)
    if severity:
        q = q.filter(models.Alert.severity == severity)
    if attack_type:
        q = q.filter(models.Alert.attack_type == attack_type)
    return q.order_by(STATUS_RANK, SEVERITY_RANK.desc(), models.Alert.risk_score.desc(),
                      models.Alert.created_at.desc()).limit(min(limit, 1000)).all()


@router.patch("/alerts/{alert_id}", response_model=schemas.AlertOut)
def update_alert(alert_id: int, body: schemas.AlertUpdate, request: Request, db: Session = Depends(get_db),
                 user: models.User = Depends(require_role("analyst"))):
    alert = db.get(models.Alert, alert_id)
    if not alert:
        raise HTTPException(404, "Alert not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(alert, key, value)
    db.commit()
    db.refresh(alert)
    log_action(db, user, "alert_updated", f"alert #{alert.id} -> {alert.status}", request)
    return alert


@router.post("/alerts/bulk")
def bulk_update(body: schemas.BulkAlertUpdate, request: Request, db: Session = Depends(get_db),
                user: models.User = Depends(require_role("analyst"))):
    n = db.query(models.Alert).filter(models.Alert.id.in_(body.ids)).update(
        {models.Alert.status: body.status}, synchronize_session=False)
    db.commit()
    log_action(db, user, "alerts_bulk_updated", f"{n} alerts -> {body.status}", request)
    return {"updated": n}


@router.get("/alerts/correlate")
def correlate_alerts(min_alerts: int = 3, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Alert correlation: many open alerts from the same attacker are probably ONE incident."""
    groups = defaultdict(list)
    for a in db.query(models.Alert).filter(models.Alert.status != "resolved",
                                           models.Alert.incident_id.is_(None)).all():
        groups[a.src_ip].append(a)
    rank = {"Low": 1, "Medium": 2, "High": 3, "Critical": 4}
    result = []
    for ip, alerts in groups.items():
        if len(alerts) >= min_alerts:
            worst = max(alerts, key=lambda a: rank.get(a.severity, 0))
            result.append({
                "src_ip": ip, "alert_count": len(alerts), "alert_ids": [a.id for a in alerts],
                "attack_types": sorted({a.attack_type for a in alerts}),
                "targets": sorted({a.dst_ip for a in alerts}), "max_severity": worst.severity,
            })
    return sorted(result, key=lambda g: (-rank[g["max_severity"]], -g["alert_count"]))


def _incident_out(inc: models.Incident) -> dict:
    data = schemas.IncidentOut.model_validate(inc).model_dump()
    data["alert_count"] = len(inc.alerts)
    return data


@router.get("/incidents", response_model=list[schemas.IncidentOut])
def list_incidents(db: Session = Depends(get_db), _=Depends(get_current_user)):
    incidents = db.query(models.Incident).order_by(models.Incident.created_at.desc()).all()
    return [_incident_out(i) for i in incidents]


@router.get("/incidents/{incident_id}")
def get_incident(incident_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    inc = db.get(models.Incident, incident_id)
    if not inc:
        raise HTTPException(404, "Incident not found")
    data = _incident_out(inc)
    data["alerts"] = [schemas.AlertOut.model_validate(a).model_dump() for a in inc.alerts]
    return data


@router.post("/incidents", response_model=schemas.IncidentOut, status_code=201)
def create_incident(body: schemas.IncidentCreate, request: Request, db: Session = Depends(get_db),
                    user: models.User = Depends(require_role("analyst"))):
    inc = models.Incident(title=body.title, description=body.description, severity=body.severity,
                          created_by_id=user.id, assigned_to_id=body.assigned_to_id or user.id)
    db.add(inc)
    db.flush()
    if body.alert_ids:  # link alerts and mark them acknowledged
        db.query(models.Alert).filter(models.Alert.id.in_(body.alert_ids)).update(
            {models.Alert.incident_id: inc.id, models.Alert.status: "acknowledged"},
            synchronize_session=False)
    db.commit()
    db.refresh(inc)
    log_action(db, user, "incident_created", f"#{inc.id} {inc.title} ({len(body.alert_ids)} alerts)", request)
    return _incident_out(inc)


@router.patch("/incidents/{incident_id}", response_model=schemas.IncidentOut)
def update_incident(incident_id: int, body: schemas.IncidentUpdate, request: Request,
                    db: Session = Depends(get_db), user: models.User = Depends(require_role("analyst"))):
    inc = db.get(models.Incident, incident_id)
    if not inc:
        raise HTTPException(404, "Incident not found")
    changes = body.model_dump(exclude_unset=True)
    for key, value in changes.items():
        setattr(inc, key, value)
    if changes.get("status") == "closed":  # closing an incident resolves its alerts
        for a in inc.alerts:
            a.status = "resolved"
    db.commit()
    db.refresh(inc)
    log_action(db, user, "incident_updated", f"#{inc.id}: {sorted(changes)}", request)
    return _incident_out(inc)
