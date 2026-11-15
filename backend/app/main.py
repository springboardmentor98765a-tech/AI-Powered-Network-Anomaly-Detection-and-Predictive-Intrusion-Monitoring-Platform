from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

import app.models  # noqa: F401  (registers the tables with Base)
from app.db.base import Base
from app.db.session import engine, get_db
from app.routers import audit_logs, auth, teams, users 


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Runs once at startup. We move to Alembic migrations later.
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="NetShield AI", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(teams.router)   
app.include_router(audit_logs.router)   
app.include_router(auth.router) 
app.include_router(users.router)


@app.get("/health")
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")
    return {"status": "ok", "database": "connected"}