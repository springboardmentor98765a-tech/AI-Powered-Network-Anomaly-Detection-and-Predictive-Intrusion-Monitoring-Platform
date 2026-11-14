from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import admin, api_auth, auth_stub, dashboard, monitoring
from .database import Base, SessionLocal, engine
from .seed import seed

BASE_DIR = Path(__file__).resolve().parent


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed(db)
    yield


app = FastAPI(title="Network Anomaly Platform - Dashboard", lifespan=lifespan)
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
app.include_router(auth_stub.router)
app.include_router(api_auth.router)
app.include_router(dashboard.router)
app.include_router(admin.router)
app.include_router(monitoring.router)


@app.exception_handler(StarletteHTTPException)
async def http_error(request: Request, exc: StarletteHTTPException):
    # Browser pages bounce to login; API callers get clean JSON (no stack traces).
    if exc.status_code == 401 and not request.url.path.startswith("/api"):
        return RedirectResponse("/login", status_code=303)
    return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse("/dashboard")
