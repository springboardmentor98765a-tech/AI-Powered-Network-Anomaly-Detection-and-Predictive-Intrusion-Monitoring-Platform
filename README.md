# NetShield AI — Network Anomaly Dashboard

FastAPI backend and React/Vite frontend for role-based network monitoring, user/team administration, audit logs, and read-only CIC-IDS 2018 dataset views.

## Project layout

```text
backend/
  app/                 FastAPI routes, database models, auth, templates, and static assets
  .env.example         PostgreSQL and application settings template
  requirements.txt
  run.py
  test_dashboard.py
frontend/
  src/                 React dashboard and sign-in page
  package.json
  vite.config.js       Proxies API and legacy management pages to FastAPI
```

## Requirements

- Python 3.10+
- Node.js 18+
- PostgreSQL (create an empty database named `netshield`)

## Configure PostgreSQL

From `backend`, copy `.env.example` to `.env` and set the PostgreSQL fields to your connection details:

```text
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=netshield
```

The password is read separately, so characters such as `@` do not need URL-encoding. Set `SECRET_KEY` to a random secret of at least 32 characters. The application creates its tables and demo accounts in the configured database on startup; it does not fall back to SQLite. Alternatively, you can provide a `DATABASE_URL` environment variable.

### Demo login credentials

These accounts are created when the configured database is empty:

| Role | Email / username | Password | Status |
| --- | --- | --- | --- |
| Administrator | `admin@demo.local` | `Admin@123` | Active |
| Team Lead / Supervisor | `lead@demo.local` | `Lead@123` | Active |
| Security Analyst | `analyst@demo.local` | `Analyst@123` | Active |
| Security Analyst | `meera@demo.local` | `Analyst@123` | Active |
| Inactive test account | `old@demo.local` | `Old@12345` | Inactive; sign-in is rejected |

## Run locally

Start the backend in one terminal:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
python run.py
```

Edit `backend\.env` before starting if your PostgreSQL username, password, host, or port differ from the example. The API docs are at `http://127.0.0.1:8000/docs`.

Start the frontend in a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal (normally `http://localhost:5173`). The React dashboard is available at both `/` and `/dashboard`; the development proxy forwards API calls and management/monitoring pages to FastAPI. You can also use the server-rendered pages directly at the backend URL, including its `/dashboard`.

## Sign up

Use **Sign up** on the frontend login page to create an account. A normalized email address can only be registered once, and passwords are stored as hashes. Sign-up requires a matching password confirmation and allows one selection: Security Analyst or Team Lead / Supervisor. Administrator access can only be assigned by an administrator.

## CIC-IDS dataset

The project reads `cic.csv` from the project root (the file is excluded from Git because it is large). If it is stored elsewhere, set `CIC_DATASET_PATH` in `backend\.env`. The dark React dashboard keeps the existing account counts and aggregates charts over the entire CSV. The server-rendered activity and alert pages still inspect the first 50,000 rows and display up to 200 matching records. CIC-IDS 2018 is historical offline traffic data; this project does not train a model or monitor live traffic.

## Tests

```powershell
cd backend
pytest -q
```
