# NetShield AI

> AI-Powered Network Anomaly Detection and Predictive Intrusion Monitoring Platform

NetShield AI is a SOC-style network security application for collecting network-flow metadata, identifying anomalies, predicting attack categories, calculating risk, generating alerts, and managing incidents. It combines a FastAPI backend, a Next.js dashboard, SQLAlchemy persistence, and machine-learning models.

It is designed as an Infosys Springboard internship project and supports a safe local demonstration using simulated traffic, uploaded flow datasets, Wireshark packet-list CSV exports, or an optional authorised `tshark` live sensor.

## Contents

- [Features](#features)
- [Architecture and flow](#architecture-and-flow)
- [Project modules](#project-modules)
- [Prerequisites](#prerequisites)
- [Local setup](#local-setup)
- [Demo accounts](#demo-accounts-development-only)
- [Traffic ingestion](#traffic-ingestion)
- [Optional live sensor](#optional-live-sensor)
- [API overview](#api-overview)
- [Security controls](#security-controls)
- [Testing](#testing)
- [Docker deployment](#docker-deployment)
- [Demo workflow](#demo-workflow)
- [Limitations](#limitations)

## Features

- JWT authentication with bcrypt password hashing.
- Role-based access control for viewer, analyst, team lead, and administrator roles.
- Pending-registration review and administrator approval workflow.
- User, team, and audit-log administration.
- Network-flow monitoring with protocol, packet, byte, IP, port, direction, and timeline statistics.
- Backend-driven traffic filters for IPs, protocol, port, prediction, minimum risk, and threats only.
- Dataset support for project-flow CSV, CICFlowMeter/CICIDS exports, and Wireshark packet-list CSV exports.
- Isolation Forest anomaly detection and supervised attack classification.
- Risk scoring, severity assignment, threat-intelligence matching, and automatic alerts.
- Alert correlation, incident investigation, ownership, notes, and lifecycle management.
- Threat-intelligence views, model metrics, detection reports, and short-horizon intrusion forecasting.
- Optional administrator-controlled metadata-only `tshark` sensor.
- Docker Compose configuration for PostgreSQL, FastAPI, and Next.js.

## Architecture and flow

```text
Traffic source
  ├─ Built-in simulator
  ├─ Project/CICIDS flow CSV
  ├─ Wireshark packet-list CSV
  └─ Optional tshark sensor
          ↓
Validation, header mapping, and flow aggregation
          ↓
Feature extraction
          ↓
Isolation Forest anomaly detection
          ↓
Attack classification and threat-intelligence lookup
          ↓
Risk score and severity
          ↓
Database: traffic flows, alerts, incidents, audit logs
          ↓
SOC dashboard, analytics, reports, and investigation workflows
```

## Project modules

### 1. User management and secure access

- Login with username or email.
- bcrypt password hashing and verification.
- Expiring JWT access tokens for protected APIs.
- Viewer, analyst, team lead, and admin permissions enforced by the backend.
- Registration requests remain inactive until approved by an administrator.
- User administration, team administration, and audit logging.

### 2. Network monitoring and traffic analysis

- Persisted network-flow records with source/destination addresses, ports, protocols, packets, bytes, duration, and TCP flags.
- Protocol distribution, unknown protocol identification, top IPs, top ports, traffic timelines, and inferred traffic direction.
- Shared backend filters ensure that charts and flow tables use the same filtered data.

### 3. Dataset ingestion and preprocessing

- File extension, MIME type, 10 MiB upload-size, and 5,000-row limits.
- Project-flow and CICIDS/CICFlowMeter column mapping.
- Wireshark packet-list parsing with UTF-8, UTF-8 BOM, Windows-1252, and Latin-1 support.
- Support for comma, semicolon, and tab delimiters, quoted `Info` fields, header variations, and packet-to-flow aggregation.
- Per-row rejection reporting without exposing internal parser errors to the user.

### 4. Anomaly detection and intrusion prediction

- Isolation Forest identifies flows that differ from learned normal behaviour.
- Classifier predicts `BENIGN`, `DDoS`, `PortScan`, `BruteForce`, `WebAttack`, or `Botnet` behaviour.
- Model metrics, model report, and controlled administrator retraining endpoints.

### 5. Risk, alerts, and incidents

- Risk score and severity combine anomaly status, attack confidence, destination-port context, and threat-intelligence matches.
- Suspicious flows create prioritised alerts.
- Analysts can acknowledge, resolve, bulk-update, correlate, and convert alerts into incidents.
- Incident lifecycle: `open` → `investigating` → `contained` → `closed`.

### 6. Analytics and threat intelligence

- Traffic volume, attack share, severity, anomaly, and alert dashboards.
- Top attackers, targeted services, known-bad IP indicators, attack trends, and forecasting.
- Downloadable threat-intelligence and detection reports.

### 7. Testing, security, and deployment readiness

- Automated API coverage for login, role enforcement, CORS, traffic statistics, filters, uploads, Wireshark parsing, alerts, incidents, and registration approval.
- Production frontend build verification.
- Docker Compose stack for PostgreSQL, backend, and frontend.

## Repository structure

```text
.
├── .env.example                # Docker/production environment template
├── .gitignore
├── backend/
│   ├── .dockerignore
│   ├── Dockerfile
│   ├── app/
│   │   ├── ml/                 # autoencoder, features, predictor, risk, training, synthetic data
│   │   ├── routers/            # alerts, analytics, auth, detection, traffic, users
│   │   ├── services/           # live sensor, simulator, ML pipeline, notifier, threat intelligence
│   │   ├── __init__.py
│   │   ├── audit.py            # Audit-log helper
│   │   ├── auth.py             # JWT and RBAC dependencies
│   │   ├── config.py           # Environment-based settings
│   │   ├── database.py         # SQLAlchemy engine, sessions, migration helper
│   │   ├── main.py             # FastAPI application
│   │   ├── models.py           # SQLAlchemy models
│   │   ├── schemas.py          # Pydantic request/response schemas
│   │   └── seed.py             # Development users and simulated history
│   ├── models/
│   │   ├── detection_report.md # Generated ML report
│   │   ├── metrics.json        # Generated ML metrics
│   │   └── netshield_models.joblib # Generated trained model bundle
│   ├── tests/
│   │   ├── __init__.py
│   │   └── test_api.py         # API and import workflow tests
│   ├── netshield.db            # Generated local SQLite database (development)
│   └── requirements.txt
├── frontend/
│   ├── .dockerignore
│   ├── .env.local              # Local API URL; create/update locally, do not commit secrets
│   ├── app/
│   │   ├── alerts/page.js
│   │   ├── dashboard/page.js
│   │   ├── incidents/page.js
│   │   ├── intelligence/page.js
│   │   ├── teams/page.js
│   │   ├── traffic/page.js
│   │   ├── users/page.js
│   │   ├── globals.css
│   │   ├── layout.js
│   │   └── page.js             # Login and registration route
│   ├── components/
│   │   ├── AppShell.js
│   │   ├── Charts.js
│   │   └── ui.js
│   ├── lib/
│   │   ├── api.js              # Backend client and session helpers
│   │   └── usePolling.js
│   ├── Dockerfile
│   ├── jsconfig.json
│   ├── next.config.js
│   ├── package.json
│   ├── package-lock.json
│   ├── postcss.config.js
│   └── tailwind.config.js
├── docs/
│   ├── DEPLOYMENT.md
│   └── MEETING_WORKFLOW.md
├── LICENSE
├── docker-compose.yml
└── README.md

Generated local folders omitted above: `backend/.venv/`, `backend/app/__pycache__/`, `backend/.pytest_cache/`, `frontend/node_modules/`, and `frontend/.next/`.
```

## Prerequisites

- Python 3.10–3.12 recommended.
- Node.js 20 or newer and npm.
- Git.
- Optional: Docker Desktop for container deployment.
- Optional: Wireshark/tshark for packet-list export or live metadata collection.

## Local setup

### 1. Clone the repository

```bash
git clone https://github.com/springboardmentor98765a-tech/AI-Powered-Network-Anomaly-Detection-and-Predictive-Intrusion-Monitoring-Platform.git
cd AI-Powered-Network-Anomaly-Detection-and-Predictive-Intrusion-Monitoring-Platform
```

### 2. Configure and start the backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

On first start, the backend creates its local SQLite database, seeds development accounts when the database is empty, loads/trains the local model bundle, and seeds simulated traffic history when needed.

Useful local URLs:

- API health: <http://localhost:8000/api/health>
- Interactive API documentation: <http://localhost:8000/docs>

### 3. Configure and start the frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Create or update `frontend/.env.local` without replacing other settings:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Open <http://localhost:3000>.

> Do not use `http://localhost:3000` as `NEXT_PUBLIC_API_URL`; the frontend must call the backend on port `8000`.

### 4. Optional model training

From `backend/` with the virtual environment active:

```bash
python -m app.ml.train --rows 5000
```

Train with supplied datasets when available:

```bash
python -m app.ml.train --cicids /path/to/cicids.csv
python -m app.ml.train --unsw /path/to/unsw.csv
```

Synthetic model results are intended for demonstration and must not be represented as real-world security performance.

## Demo accounts (development only)

When starting with a new development database, the backend seeds these accounts:

| Role | Username | Password |
| --- | --- | --- |
| Administrator | `admin` | `admin123` |
| Analyst | `analyst` | `analyst123` |
| Viewer | `viewer` | `viewer123` |

These accounts are for local demonstration only. They are disabled from automatic creation when `ENVIRONMENT=production`.

## Traffic ingestion

### Supported CSV inputs

| Format | Support |
| --- | --- |
| Project flow CSV | Supported when required ML features are present. |
| CICFlowMeter/CICIDS CSV | Supported through existing feature-column mapping. |
| Wireshark packet-list CSV | Supported after exporting packet dissections as CSV. |
| Native `.pcap` / `.pcapng` | Not uploaded directly; export as Wireshark CSV first. |

### Wireshark CSV import

1. Open an authorised capture in Wireshark.
2. Optionally filter displayed traffic, for example `tcp or udp or icmp`.
3. Choose **File → Export Packet Dissections**.
4. Choose **CSV** and include column headings.
5. Keep packet-list fields equivalent to `No.`, `Time`, `Source`, `Destination`, `Protocol`, `Length`, and `Info`.
6. Sign in as an analyst, open **Network traffic**, and upload the CSV.

The importer supports quoted `Info` values containing commas and maps packets into bidirectional flows. Forward and reverse packets/bytes, duration, TCP flags, and rates are derived only from available packet metadata. Rows with invalid IPs, timestamps, lengths, or ports are rejected safely.

Only upload captures from networks that you are authorised to monitor. Avoid collecting passwords, private messages, or customer data.

## Optional live sensor

The optional sensor uses Wireshark’s `tshark` command-line tool. It is disabled by default and collects metadata only: timestamps, IPs, ports, protocol, frame length, and TCP flags. It does not intentionally collect packet payloads.

1. Install Wireshark/tshark and make sure `tshark --version` works in the backend terminal.
2. Set the authorised interface before starting the backend:

```bash
export LIVE_SENSOR_INTERFACE=en0
export LIVE_SENSOR_ENABLED=false
```

3. Sign in as an administrator.
4. Open **Network traffic** and use **Optional live sensor** to start or stop collection.

`LIVE_SENSOR_ENABLED=true` starts the configured sensor automatically when the backend starts. Use that setting only after confirming capture permissions and network authorisation. Sensor start/stop events are included in audit logs.

## API overview

All endpoints except login, registration, and health require a bearer token.

| Area | Examples |
| --- | --- |
| Health | `GET /api/health` |
| Authentication | `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/me` |
| Traffic | `GET /api/traffic/flows`, `GET /api/traffic/stats`, `POST /api/traffic/upload`, `POST /api/traffic/analyze` |
| Live sensor | `GET /api/traffic/sensor/status`, `POST /api/traffic/sensor/start`, `POST /api/traffic/sensor/stop` |
| Analytics | `GET /api/analytics/overview`, `GET /api/analytics/timeline`, `GET /api/analytics/threat-intel` |
| Detection | `GET /api/detection/metrics`, `GET /api/detection/forecast`, `POST /api/detection/retrain` |
| Alerts/incidents | `GET /api/alerts`, `POST /api/incidents`, `PATCH /api/incidents/{id}` |
| Administration | `GET /api/users`, `GET /api/teams`, `GET /api/audit-logs` |

See <http://localhost:8000/docs> for the live OpenAPI contract and complete request/response schemas.

## Security controls

- bcrypt password hashing; plain-text passwords are not stored.
- Signed, expiring JWT access tokens.
- Backend-enforced role-based permissions.
- Pending registration approval; public registration cannot self-assign admin access.
- Failed-login rate limiting: 10 failed attempts per IP per minute.
- Registration rate limiting: 5 attempts per IP per minute.
- CORS permits configured origins only; credentialed wildcard origins are rejected.
- File type, MIME type, size, row-count, header, numeric-value, port, and IP validation for imports.
- Production startup requires an explicit `SECRET_KEY`.
- Development seed users are disabled by default in production.
- Audit records for authentication and sensitive administrative actions.

This is a source-level security review and local automated validation, not a penetration test or a claim of production certification.

## Configuration

Important backend environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `ENVIRONMENT` | `development` | Set to `production` for production safeguards. |
| `DATABASE_URL` | Local SQLite database | SQLAlchemy database URL. |
| `SECRET_KEY` | Development-only value | Required in production for JWT signing. |
| `CORS_ORIGINS` | Local frontend origins | Comma-separated allowed origins. |
| `SIMULATOR_ENABLED` | `true` | Enables built-in demo traffic. |
| `SIMULATOR_INTERVAL` | `4` | Simulator interval in seconds. |
| `DEMO_SEED_ENABLED` | Development: `true` | Creates local demo accounts only for an empty database. |
| `LIVE_SENSOR_ENABLED` | `false` | Starts tshark sensor at backend startup. |
| `LIVE_SENSOR_INTERFACE` | `en0` | Authorised interface for tshark metadata collection. |
| `NETSHIELD_INTERNAL_CIDRS` | Private ranges | Used for traffic-direction inference. |

Never commit production secrets, database passwords, or real `.env` files.

## Testing

### Backend

```bash
cd backend
source .venv/bin/activate
python -m pytest -q
```

The test suite covers health, CORS, authentication, failed-login handling, RBAC, sensor permissions, dashboard APIs, incidents, traffic statistics, filters, project CSV uploads, Wireshark upload parsing, UTF-8 BOM, quoted `Info` fields, Windows-1252 exports, and registration approval.

### Frontend production build

```bash
cd frontend
npm run build -- --webpack
```

Webpack mode is the verified production-build path in this project environment. Standard `npm run build` uses the installed Next.js default builder.

## Docker deployment

The repository includes PostgreSQL, FastAPI, and Next.js services.

```bash
cp .env.example .env
# Edit .env: set unique POSTGRES_PASSWORD and SECRET_KEY values.
docker compose up --build
```

The Docker stack runs production mode, disables automatic demo users, and requires explicit secrets. Read [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) before using cloud infrastructure.

Before public deployment:

- Use HTTPS through a reverse proxy or managed load balancer.
- Store secrets in a managed secret store.
- Use exact HTTPS origins in `CORS_ORIGINS`.
- Restrict database access to backend services.
- Use a managed database backup strategy.
- Run tests and a production build in CI.

## Demo workflow

1. Sign in as `admin`; explain authentication, JWT, roles, and audit logging.
2. Open **Dashboard**; explain traffic volume, attacks, alert severity, incidents, and forecast.
3. Open **Network traffic**; explain flows, packets, bytes, protocol distribution, unknown protocols, top IPs, ports, direction, and timelines.
4. Apply source/destination IP, protocol, port, risk, and threat-only filters. Explain that backend queries update both table and analytics.
5. Sign in as `analyst`; upload a project/CICIDS/Wireshark CSV and show processed/rejected/failed counts.
6. Show the new flow in traffic statistics and analytics.
7. Open **Alerts** and **Incidents**; explain alert prioritisation and the investigation lifecycle.
8. Open **Threat intelligence**; show top attackers, targets, metrics, reports, and forecast.
9. Return to `admin`; show teams, users, registration approvals, and audit logs.
10. If tshark is installed and the network is authorised, demonstrate the optional live sensor.

For a detailed mentor script, see [docs/MEETING_WORKFLOW.md](docs/MEETING_WORKFLOW.md).

## Limitations

- The default local demonstration uses simulated traffic; synthetic model metrics are not real-world security benchmarks.
- Native `.pcap` and `.pcapng` uploads are not parsed directly. Export the packet list from Wireshark as CSV.
- The optional live sensor requires a local tshark installation, OS capture permission, and explicit network authorisation.
- Deployment configuration is included, but cloud deployment requires your own cloud account, DNS, secrets, and operational review.
- This project should not be used as the sole security control for a production network.

## License

See [LICENSE](LICENSE).
