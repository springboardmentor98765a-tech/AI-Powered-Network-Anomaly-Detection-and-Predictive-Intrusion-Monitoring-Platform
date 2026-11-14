# NetShield AI — FastAPI application entry point
# Developed by Krish | SKK Projects
"""
Start locally (from the backend folder):
    uvicorn app.main:app --reload
Then open http://localhost:8000/docs to see and test every API.
"""
import asyncio
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app.ml.predictor import predictor
from app.routers import alerts, analytics, auth, detection, traffic, users
from app.seed import needs_history, seed_users
from app.services.simulator import run_simulator, seed_history


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ---- runs once when the server starts
    Base.metadata.create_all(bind=engine)  # create tables if they don't exist
    seed_users()
    await asyncio.to_thread(predictor.load)  # load (or first-time train) the AI models
    if needs_history():
        print("[startup] creating 2 hours of sample traffic history...")
        await asyncio.to_thread(seed_history)
    task = asyncio.create_task(run_simulator(settings.SIMULATOR_INTERVAL)) if settings.SIMULATOR_ENABLED else None
    yield
    # ---- runs once when the server stops
    if task:
        task.cancel()


app = FastAPI(
    title="NetShield AI",
    description="Network Anomaly Detection & Threat Monitoring System — Developed by Krish | SKK Projects",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware, allow_origins=settings.CORS_ORIGINS, allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)


@app.middleware("http")
async def timing_middleware(request: Request, call_next):
    """API-gateway style logging: measures how long every request takes."""
    start = time.perf_counter()
    response = await call_next(request)
    response.headers["X-Process-Time-ms"] = f"{(time.perf_counter() - start) * 1000:.1f}"
    return response


for r in (auth.router, users.router, traffic.router, detection.router, alerts.router, analytics.router):
    app.include_router(r)


@app.get("/api/health", tags=["System"])
def health():
    return {"status": "ok", "model_loaded": predictor.ready, "simulator": settings.SIMULATOR_ENABLED}
