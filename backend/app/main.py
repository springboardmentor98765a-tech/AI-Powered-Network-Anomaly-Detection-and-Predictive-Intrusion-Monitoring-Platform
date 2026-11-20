from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app import models  # noqa: F401
from app.routers import auth, users, roles, teams, audit_logs

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Network Security Platform API")

# Allow the React app (running on port 5173) to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(roles.router)
app.include_router(teams.router)
app.include_router(audit_logs.router)


@app.get("/")
def health_check():
    return {"status": "Backend is running"}