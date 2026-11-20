
from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.dependencies import get_current_admin
from app.models.user import User
from app.services.network_monitor import monitor

router = APIRouter(
    prefix="/network",
    tags=["Network Monitoring"],
    dependencies=[Depends(get_current_admin)],
)

ALLOWED_MINUTES = (15, 30, 60, 1440)


def validate_minutes(minutes: int) -> int:
    if minutes not in ALLOWED_MINUTES:
        raise HTTPException(
            status_code=422,
            detail="Minutes must be one of: 15, 30, 60 or 1440",
        )
    return minutes


@router.get("/status")
def network_status(current_user: User = Depends(get_current_admin)):
    return monitor.start()


@router.get("/summary")
def network_summary(
    minutes: int = Query(default=15),
    current_user: User = Depends(get_current_admin),
):
    validate_minutes(minutes)
    monitor.start()
    return monitor.summary(minutes)


@router.get("/packets")
def network_packets(
    minutes: int = Query(default=15),
    limit: int = Query(default=50, ge=1, le=200),
    protocol: str | None = Query(default=None, max_length=20),
    ip: str | None = Query(default=None, max_length=64),
    port: str | None = Query(default=None, max_length=5),
    current_user: User = Depends(get_current_admin),
):
    validate_minutes(minutes)
    monitor.start()
    return monitor.packets(minutes, limit, protocol, ip, port)
