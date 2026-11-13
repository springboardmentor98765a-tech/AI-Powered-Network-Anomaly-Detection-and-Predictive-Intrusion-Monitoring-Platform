# NetShield AI

Network Anomaly Detection & Predictive Intrusion Monitoring Platform.

---

## Work Progress Log

### 2026-11-13 — Module 1: Core Platform & Access Control
- **Security Analyst Authentication**: Login via email/username, bcrypt password hashing, signed JWT with blocklist revocation on logout, and non-revealing 401 error messages.
- **Role-Based Access Control (RBAC)**: Strict permission enforcement on backend and frontend across 3 roles: Administrator, Team Lead / Supervisor, and Security Analyst.
- **Team Management**: Team creation, member assignment/removal, duplicate checks, and role-scoped team views.
- **Audit Logging**: Immutable security logs for logins, logouts, account updates, and team changes with search and filtering.
- **UI & Database**: Minimal light-theme UI using React (Vite, Tailwind CSS, shadcn/ui) with FastAPI and PostgreSQL.

---

## Quickstart

### Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL (database: `netshield`)

### 1. Backend
```bash
cd backend
python -m venv .venv
.\.venv\Scripts\activate      # Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env        # Linux/macOS: cp .env.example .env
python run.py
```
- API: `http://localhost:8000`
- API Docs: `http://localhost:8000/docs`

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```
- Web UI: `http://localhost:5173`

*(Windows shortcut: run `.\start_backend.bat` and `.\start_frontend.bat` from root).*

### 3. Run Automated Tests
```bash
cd backend
python test_module1.py
```

---

## Seed Evaluation Accounts

| Role | Username | Password |
| :--- | :--- | :--- |
| **Administrator** | `admin` | `Admin@NetShield2026!` |
| **Team Lead** | `lead_sarah` | `Lead@NetShield2026!` |
| **Security Analyst** | `analyst_alex` | `Analyst@NetShield2026!` |
