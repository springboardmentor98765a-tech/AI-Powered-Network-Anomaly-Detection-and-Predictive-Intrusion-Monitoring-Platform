# NetShield AI

**Network Anomaly Detection and Predictive Intrusion Monitoring Platform**

NetShield AI is a network-security monitoring platform that combines authenticated security operations, live packet capture, traffic analysis, explainable anomaly assessment, and team-based investigation workflows. It is designed for security analysts, team leads, and administrators who need a shared view of network activity and access-control events.

The application is being developed incrementally. This README describes the functionality currently implemented and distinguishes it from capabilities that are not yet part of the application.

---

## Current implementation status

| Area | Current status | What is available |
|---|---|---|
| User and access management | Implemented | Login, JWT authentication, role-based access, users, roles, teams, profiles, password changes, and audit logs |
| Network monitoring | Implemented | TShark packet capture, PostgreSQL persistence, packet filtering, protocol statistics, traffic summaries, timelines, and host telemetry |
| Anomaly detection | Implemented | Network behaviour analysis, suspicious-activity review, recurring-pattern analysis, and explainable risk classification |
| Intrusion prediction | Not implemented yet | Predictive attack probability and intrusion forecasting |
| Alert management | Not implemented as a standalone module | The anomaly workflow supports team-based suspicious-activity reports and review decisions; a complete alert centre and notification system are separate work |
| Security analytics and reporting | Partially implemented | Security overview and monitoring visualizations are available; broader threat-intelligence reporting and analytics remain future work |
| Machine-learning detection | Not integrated into the current detection workflow | The current anomaly assessment uses rules and historical baselines, not trained ML models |

## Application navigation

The authenticated workspace uses a compact sidebar:

- **Security Overview** — `/dashboard`
- **Network Monitoring** — `/network-monitoring`
- **Anomaly Detection** — `/anomaly-detection`
- **User Management** — groups the existing Users, Roles, and Teams pages under one navigation entry. The pages retain their individual routes and permissions.
- **Audit Logs** — `/audit-logs`, intentionally kept as a separate navigation entry.

The account area also provides **My Profile** and **Change Password**.

### Management pages and access

| Page | Route | Access |
|---|---|---|
| Users | `/users` | Administrator |
| Roles | `/roles` | Administrator |
| Teams | `/teams` | Administrator, Security Analyst, Team Lead / Supervisor |
| Audit Logs | `/audit-logs` | Administrator |

The management navigation groups the first three pages without replacing their page components or changing their URLs. Audit Logs remains separate.

---

## Implemented functionality

## 1. User and access management

### Authentication and account management

- Login using the registered account credentials.
- JWT-based authenticated API requests.
- Logout and authenticated profile retrieval.
- Profile information and password-change screens.
- Password changes require current-password verification and follow the backend password-validation rules.

### Role-based access control

The application uses three roles:

- **Administrator** — manages users and roles, oversees teams, and accesses audit logs.
- **Security Analyst** — monitors network activity, investigates suspicious events, and submits reports to a team lead.
- **Team Lead / Supervisor** — accesses team-scoped activity and reviews suspicious-activity reports for assigned teams.

Access is checked in the frontend for navigation and protected routes, and enforced by backend authorization dependencies. Hiding a navigation item is not the only security control.

### User, role, and team management

- Create, view, search, update, activate, and deactivate user accounts.
- Assign roles to users.
- Create and maintain teams.
- Assign team leads and manage team membership.
- Apply role-specific access to management operations.

### Audit logging

- Records important authentication, administration, authorization, and security-review events.
- Provides an administrator-facing audit-log view with event filtering and details.
- Supports the anomaly workflow by supplying role-based and data-clearance denial events for analysis.

---

## 2. Network monitoring

Network Monitoring collects packet metadata from the selected local network interface, stores capture records, and provides traffic analysis in the frontend.

### Packet collection

- Uses **Wireshark/TShark** to discover interfaces and capture traffic.
- Supports starting and stopping capture sessions.
- Stores capture-session and packet metadata in PostgreSQL.
- Captured metadata includes timestamps, source and destination IP addresses where available, protocol information, ports where available, packet length, protocol stack, and interface details.
- Persists packets in batches rather than committing each packet individually.

### Traffic monitoring and analysis

The monitoring service provides:

- Capture-session history and current capture status.
- Packet and byte totals.
- Unique source and destination IP counts.
- Top source and destination endpoints by observed traffic.
- Incoming, outgoing, and unknown traffic estimates based on available local-interface information.
- Traffic timelines grouped into minute-level buckets.
- Packet filtering by IP address, protocol, port, and time range.
- Protocol packet and byte statistics.

Supported analytics windows include 15, 30, 60, and 120 minutes. Traffic direction is an estimate; packets without usable IP information may be categorized as unknown.

### Protocol analysis

Protocol classification uses the packet metadata and protocol information available from TShark. Classifications include TCP, UDP, HTTP, HTTPS/TLS, DNS, ICMP/ICMPv6, ARP, and other or unknown traffic.

This is metadata-oriented monitoring. It is not deep inspection of encrypted application payloads or HTTP request bodies.

### Frontend views

**Network Monitoring** (`/network-monitoring`) provides interface selection, capture controls, capture history, traffic metrics, protocol distribution, traffic timelines, top endpoint tables, packet exploration, and host resource telemetry.

**Security Overview** (`/dashboard`) summarizes capture activity and host health. Any detector categories shown as coverage information should not be interpreted as confirmed alerts unless backed by actual detection or alert records.

---

## 3. Anomaly detection

Anomaly Detection analyses local packet-capture history and application audit events. It presents four sections within the Anomaly Detection page.

### Network behaviour analysis

- Groups observed packets into communication flows using source IP, destination IP, protocol, source port, and destination port.
- Summarizes packet count, total bytes, average packet size, packets per second, and first/last observation times.
- Displays protocol composition and high-volume source flows.
- Allows the analyst to inspect flow records in a dedicated scrollable table area.

### Suspicious activity detection

- Identifies newly observed IP addresses based on locally retained packet history.
- Separates role-based authorization denials from data-clearance denials.
- Shows evidence such as actor, client IP where available, endpoint/resource, required roles or clearance, and attempt counts.
- Allows a Security Analyst to submit a suspicious-activity report to a team they belong to.
- Allows the assigned Team Lead or an Administrator to record **Action Taken** or **Dismissed** decisions, with a review note.
- Keeps report visibility scoped to the user's permitted teams.

A first-seen IP address is a review signal, not proof that the address is malicious. Authorization denials are security-relevant events, but do not by themselves prove data exfiltration.

### Pattern recognition

- Identifies IP addresses recurring across multiple capture sessions or active days.
- Groups repeated communication flows using source/destination IP, protocol, and ports.
- Reports packet totals, byte totals, average packet size, average packets per session, capture-session count, and active-day count.
- Separates recurrent patterns from provisional flows that have repeated only within one capture.
- Uses a bounded historical lookback for recurring IP and flow analysis.

### Anomaly classification

- Combines explainable rule-based findings from network observations and security audit events.
- Compares current per-source traffic rates with a historical traffic baseline.
- Assigns each finding a risk score from 0 to 100, a severity band, a classification label, a plain-language assessment, and supporting evidence.
- Sorts findings by risk so that higher-risk events appear first.

The severity bands are:

| Severity | Risk score |
|---|---:|
| Informational | 0–14 |
| Low | 15–39 |
| Medium | 40–64 |
| High | 65–84 |
| Critical | 85–100 |

The traffic comparison uses a seven-day historical baseline. Recurring IP and flow analysis uses a 30-day lookback. The analysis observation window can be selected from the supported time ranges.

### Detection limitations

- A newly observed IP is not automatically malicious.
- A traffic increase is a heuristic deviation and is not, on its own, proof of a DDoS attack.
- Role-based and data-clearance denials indicate authorization events; they are not proof of data exfiltration.
- The packet schema currently stores packet metadata, not HTTP payloads or application request bodies.
- The current classification workflow is explainable and rule/baseline-based. It does not represent a trained machine-learning classifier, and model accuracy metrics should not be inferred from its risk scores.

---

## Technology stack

| Layer | Technologies |
|---|---|
| Frontend | React, Vite, JavaScript, CSS |
| Routing | React Router DOM |
| API client | Axios |
| Icons | Lucide React |
| Backend | Python, FastAPI |
| Database | PostgreSQL |
| ORM | SQLAlchemy |
| Migrations | Alembic |
| Authentication | JWT and password hashing |
| Packet capture | Wireshark / TShark |
| Host telemetry | psutil |
| Version control | Git and GitHub |

---

## Local development setup

The following instructions describe a local Windows development setup. Use separate terminals for the backend and frontend.

### Prerequisites

- Python installed and available on `PATH`.
- Node.js and npm.
- PostgreSQL running locally.
- Wireshark/TShark installed and available on `PATH` for live packet capture.
- A PostgreSQL database created for the project (the default name is `netshield_db`).

### 1. Configure the backend

Open a terminal in the repository root:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Create `backend/.env` with the values for your local PostgreSQL installation:

```dotenv
APP_NAME=NetShield AI
API_VERSION=v1
DB_HOST=localhost
DB_PORT=5432
DB_NAME=netshield_db
DB_USER=postgres
DB_PASSWORD=YOUR_POSTGRES_PASSWORD
SECRET_KEY=REPLACE_WITH_A_LONG_RANDOM_SECRET
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

Do not commit `.env` or real passwords/secrets. The backend settings read the individual `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` variables.

From the `backend` directory, apply the migrations present on your current branch and seed the required roles:

```powershell
alembic upgrade head
python -m app.db.seed_roles
python -m app.db.seed_admin
```

The administrator seed command prompts for the initial administrator's name, username, email, and password.

Start the API:

```powershell
uvicorn app.main:app --reload
```

The backend runs at `http://127.0.0.1:8000`. The FastAPI interactive API documentation is available at `http://127.0.0.1:8000/docs`.

### 2. Configure the frontend

Open a second terminal in the repository root:

```powershell
cd frontend
npm install
npm run dev
```

Vite serves the frontend at `http://localhost:5173` by default. The Axios client uses `http://127.0.0.1:8000/api/v1` as its default API base URL. To override it, create `frontend/.env.local` with:

```dotenv
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

### 3. Start live packet capture

Ensure TShark is installed and visible to the backend process. Open Network Monitoring, select the interface to monitor, and start a capture. Captured packet metadata is stored in PostgreSQL and can then be used by the monitoring and anomaly-analysis views.

Depending on the Windows installation and selected interface, packet capture may require appropriate permissions. If no interfaces are listed, check the TShark installation and `PATH` before troubleshooting the frontend.

---

## Main application routes

| Route | Page | Access |
|---|---|---|
| `/login` | Login | Public |
| `/dashboard` | Security Overview | Authenticated users |
| `/network-monitoring` | Network Monitoring | Administrator, Security Analyst, Team Lead / Supervisor |
| `/anomaly-detection` | Anomaly Detection | Administrator, Security Analyst, Team Lead / Supervisor |
| `/users` | Users (inside User Management) | Administrator |
| `/roles` | Roles (inside User Management) | Administrator |
| `/teams` | Teams (inside User Management) | Administrator, Security Analyst, Team Lead / Supervisor |
| `/audit-logs` | Audit Logs | Administrator |
| `/profile` | My Profile | Authenticated users |
| `/change-password` | Change Password | Authenticated users |

---

## Validation checklist before release

The project has been exercised locally during development. Before creating a release or pushing a new set of changes, run the checks against the current working tree rather than relying on earlier results.

### Backend

```powershell
cd backend
python -m compileall app
alembic heads
```

Confirm that the database is reachable, migrations are current, and the API starts successfully.

### Frontend

```powershell
cd frontend
npm run build
npm run lint
```

### End-to-end checks

- Sign in with an Administrator, Security Analyst, and Team Lead / Supervisor account.
- Confirm the correct navigation items and management tabs appear for each role.
- Confirm Audit Logs remains a separate Administrator-only navigation item.
- Start and stop a packet capture and verify that packets are persisted and displayed.
- Check the four Anomaly Detection sections and their independent data panels.
- Submit a suspicious-activity report as an Analyst and review it as the assigned Team Lead.
- Verify both Action Taken and Dismissed decisions and confirm the audit events are recorded.

A successful frontend build alone does not prove that the database, packet capture, role restrictions, or report workflow are functioning end to end.

---

## Scope not yet implemented

The following are separate capabilities and should not be confused with the currently implemented packet-monitoring and rule-based anomaly-analysis workflows:

- Predictive intrusion forecasting and attack-probability modelling.
- A trained ML detection pipeline with dataset preprocessing, training, model evaluation, and model-performance reporting.
- A complete centralized alert centre, configurable notifications, and automated response/blocking.
- Full threat-intelligence enrichment and integrated security reporting.
- Production deployment and operational hardening.

---

## Repository structure

```text
NetShield-AI/
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI routers and authorization dependencies
│   │   ├── core/         # Settings and security utilities
│   │   ├── db/           # Database session and seed scripts
│   │   ├── schemas/      # Request and response schemas
│   │   ├── services/     # Packet capture and analysis services
│   │   └── models.py    # Core database models
│   ├── migrations/      # Alembic migrations
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/  # App layout and protected-route components
│   │   ├── context/     # Authentication context
│   │   ├── pages/       # Dashboard, monitoring, anomaly and management pages
│   │   └── services/    # Axios API client
│   └── package.json
└── README.md
```

---

## Development note

Keep local environment files, passwords, database exports, packet captures containing sensitive information, and generated datasets out of Git. Review `git status` and the staged diff before committing.
