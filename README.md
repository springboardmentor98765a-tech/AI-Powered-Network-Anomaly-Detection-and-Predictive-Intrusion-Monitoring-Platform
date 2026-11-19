# Module 1 - User Management

## Setup

Backend requires Python 3.11+:

```powershell
python -m pip install -r backend\requirements.txt
cd backend
python seed.py
python -m uvicorn app.main:app --reload
```

Frontend requires Node.js:

```powershell
npm --prefix frontend install
npm --prefix frontend run dev
```

Copy `backend\.env.example` to `backend\.env` and set a production `JWT_SECRET`, database URL, and CORS origins before deployment. The default development database is SQLite.

## Development accounts

The seed command creates development-only accounts:

- `admin` / `Admin123!`
- `analyst` / `Analyst123!`
- `teamlead` / `TeamLead123!`

Change or remove these accounts before production use.

## API

FastAPI's interactive API documentation is available at `http://localhost:8000/docs`.

Authentication is provided by `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`, and `/api/auth/change-password`. User, team, membership, dashboard, role, and audit-log endpoints are under `/api/users`, `/api/teams`, `/api/dashboard`, `/api/roles`, and `/api/audit-logs`.

Administrator permissions cover user/team administration and audit access. Security Analysts and Team Leads can view their permitted team scope and their own dashboard/profile capabilities. Authorization is enforced by backend dependencies; frontend navigation is not a security boundary.
