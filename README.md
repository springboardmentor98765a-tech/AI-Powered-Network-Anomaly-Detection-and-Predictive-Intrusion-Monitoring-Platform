# NetShield AI
### AI-Powered Network Anomaly Detection and Predictive Intrusion Monitoring Platform

**Project Status:** Under Active Development  
**Application Type:** Full-Stack Network Security Monitoring Platform  
**Current Focus:** Authentication and Historical Network Traffic Analysis

---

## 1. Project Overview

NetShield AI is a web-based network security monitoring platform developed using React, FastAPI, and PostgreSQL.

The platform aims to help security analysts and organizations monitor network activity, analyze suspicious traffic patterns, investigate potential threats, and generate security reports.

The current implementation integrates the CIC-IDS2018 dataset to provide historical network traffic analysis through an interactive dashboard.

The application is being developed incrementally, beginning with authentication and progressing toward advanced security monitoring capabilities.

**Important:** The current monitoring functionality analyzes historical dataset records. Real-time intrusion monitoring and predictive machine-learning detection remain future development objectives.

## 2. Problem Statement

Modern networks generate large volumes of traffic records, making manual security analysis difficult.

Security teams need accessible tools to identify abnormal activity, examine attack patterns, understand traffic behavior, and investigate security incidents.

NetShield AI addresses these challenges by providing a centralized interface for historical network traffic exploration and security analysis.

## 3. Project Objectives

The primary objectives are:

1. Develop a secure authentication and user management system.
2. Implement role-based access to monitoring features.
3. Integrate network traffic datasets for security analysis.
4. Visualize normal and attack-labeled traffic.
5. Provide searchable and paginated network activity records.
6. Support security reporting and data export.
7. Develop alerting and incident management capabilities.
8. Extend the platform toward predictive intrusion monitoring.

## 4. Technology Stack

| Component | Technology |
|---|---|
| Frontend | React 18 |
| Frontend build tool | Vite 6 |
| Backend | Python and FastAPI |
| Database | PostgreSQL |
| ORM | SQLAlchemy |
| Database driver | psycopg |
| Authentication | JWT |
| Password security | Argon2 |
| OAuth integration | Authlib |
| Charts | Recharts |
| Icons | Lucide React |
| API testing | FastAPI Swagger UI |
| Dataset | CIC-IDS2018 |
| Version control | Git and GitHub |
| Development environment | Visual Studio Code |

Dependency versions are maintained in `backend/requirements.txt` and `frontend/package.json`.

## 5. System Architecture

```text
                  NetShield AI
                       |
              React Frontend
                       |
              User Authentication
                       |
                FastAPI Backend
                  /         \
                 /           \
        Authentication     Monitoring
            Module          Module
               |               |
           PostgreSQL     CIC-IDS2018
            Database       CSV Dataset
               |               |
          User Records     Traffic Analysis
                               |
                       Monitoring Dashboard
                               |
                    Statistics and Charts
```

### Architecture Explanation

**Frontend:** Provides authentication forms, dashboard navigation, charts, tables, and user interactions.

**Backend:** Processes API requests, validates authentication, retrieves user information, and performs historical network traffic analysis.

**Database:** Stores application account information.

**Dataset:** Supplies historical network flow records used for monitoring and visualization.

## 6. Project Structure

```text
netshield-auth-starter/
|
|-- backend/
|   |-- app/
|   |   |-- main.py
|   |   |-- models.py
|   |   |-- schemas.py
|   |   |-- security.py
|   |   |-- database.py
|   |   |-- config.py
|   |   |-- monitoring.py
|   |
|   |-- data/
|   |   |-- cic.csv
|   |
|   |-- requirements.txt
|   |-- .env.example
|
|-- frontend/
|   |-- src/
|   |   |-- App.jsx
|   |   |-- Dashboard.jsx
|   |   |-- Welcome.jsx
|   |   |-- main.jsx
|   |   |-- style.css
|   |
|   |-- package.json
|   |-- .env.example
|
|-- .gitignore
|-- README.md
```

The `Welcome.jsx` component remains in the project structure, although the normal login flow now opens the main dashboard directly.

## 7. Development Process

### Phase 1 — Initial Project Setup

The development environment was established using React, Vite, FastAPI, Python, and PostgreSQL.

Activities included:

- Configuring the frontend and backend project structure.
- Creating the Python virtual environment.
- Installing project dependencies.
- Configuring environment variables.
- Establishing frontend-to-backend communication.
- Running the application locally.

**Outcome:** The full-stack development environment was established.

### Phase 2 — Authentication Module

The authentication module provides the foundation for accessing NetShield AI.

Implemented functionality includes:

- User registration.
- Email/password login.
- Password hashing using Argon2.
- JWT-based authentication.
- HttpOnly authentication cookies.
- Authentication session validation.
- Logout functionality.
- Google OAuth integration in the authentication starter.

The application also uses role information to determine which navigation options are displayed.

#### User Roles

| Role | Intended Responsibility |
|---|---|
| Security Analyst | Network traffic monitoring and analysis |
| SOC Team | Security operations and incident investigation |
| Enterprise | Organization-level monitoring and reporting |
| Administrator | System administration and user management |

**Current limitation:** Complete backend role authorization and privileged-account approval require further development.

### Phase 3 — Dashboard Navigation

Initially, the application used:

```text
Login → Welcome Page → Dashboard
```

The navigation was simplified to:

```text
Login → Dashboard → Logout → Login
```

The dashboard now displays the authenticated username and provides a Logout button.

This flow has been manually tested.

### Phase 4 — Dataset Integration

The CIC-IDS2018 dataset was integrated into the monitoring backend.

The application reads network flow records from a local CSV file and calculates traffic statistics.

#### Dataset Statistics

| Metric | Observed Value |
|---|---:|
| Total network flows | 1,048,575 |
| Normal traffic records | 667,626 |
| Attack-labeled records | 380,949 |
| Attack categories | 2 |
| Protocol values detected | 3 |

The observed attack categories are:

- FTP-BruteForce
- SSH-Bruteforce

These statistics describe the local CSV file used during development, not the complete CIC-IDS2018 collection.

### Phase 5 — Monitoring Backend Development

The monitoring backend was developed to provide historical network traffic information through REST APIs.

Implemented functions include:

**Monitoring Summary**

Calculates total flows, normal traffic, attack traffic, attack categories, protocol distribution, and dataset timestamps.

**Network Flow Retrieval**

Provides paginated historical network activity records.

**Historical Timeline**

Groups network records into hourly or daily intervals and calculates normal and attack-labeled traffic counts.

**CSV Export**

An initial export function and API endpoint have been added. Final download verification and performance improvements remain pending.

### Phase 6 — Monitoring Dashboard Development

The monitoring dashboard includes:

- Total Network Flows card.
- Normal Traffic card.
- Attack-Labeled Traffic card.
- Attack Categories card.
- Protocols Detected card.
- Historical Network Traffic Analysis chart.
- Attack Distribution chart.
- Historical Network Activity table.

The statistics, attack distribution, and historical timeline have been connected to the dataset.

### Phase 7 — API Testing and Debugging

Development testing was performed using browser requests, Swagger UI, and backend terminal output.

Activities included:

- Verifying authenticated user information.
- Testing monitoring summary responses.
- Testing paginated flow retrieval.
- Testing hourly traffic aggregation.
- Verifying dataset-backed dashboard charts.
- Resolving Python indentation errors.
- Investigating HTTP 401 authentication responses.
- Testing dashboard login and logout navigation.

These are manual development checks. An automated test suite has not yet been established.

## 8. API Documentation

| Method | Endpoint | Description | Status |
|---|---|---|---|
| GET | `/auth/me` | Retrieve authenticated user information | Tested |
| POST | `/auth/logout` | Clear authentication cookie | Tested |
| GET | `/monitoring/summary` | Retrieve dataset statistics | Tested |
| GET | `/monitoring/flows` | Retrieve paginated network records | Implemented |
| GET | `/monitoring/timeline` | Retrieve hourly/daily traffic statistics | Tested |
| GET | `/monitoring/export` | Export filtered historical records | Verification pending |

Registration, login, and Google OAuth endpoints are also implemented in the authentication backend.

Their current request and response contracts can be inspected through FastAPI Swagger UI.

### Example Monitoring Requests

```http
GET /monitoring/summary
```

```http
GET /monitoring/flows?page=1&page_size=25
```

```http
GET /monitoring/timeline?interval=hour
```

```http
GET /monitoring/timeline?interval=day
```

```http
GET /monitoring/export?traffic_type=attack
```

Protected endpoints require valid authentication credentials.

## 9. Installation and Setup

### Prerequisites

Install:

- Python 3.11 or newer.
- Node.js LTS.
- PostgreSQL.
- Git.
- Visual Studio Code.

Create a PostgreSQL database named `netshield`.

### Backend Setup

Open a terminal inside the backend directory.

Create a virtual environment:

```powershell
py -m venv .venv
```

Activate the environment:

```powershell
.\.venv\Scripts\Activate.ps1
```

Install dependencies:

```powershell
pip install -r requirements.txt
```

Create the environment configuration:

```powershell
Copy-Item .env.example .env
```

Configure the database URL, JWT secret, and any required OAuth credentials.

Generate a random JWT secret:

```powershell
py -c "import secrets; print(secrets.token_urlsafe(48))"
```

Place the authorized dataset at:

```text
backend/data/cic.csv
```

Start the backend:

```powershell
uvicorn app.main:app --reload
```

Backend API documentation:

`http://localhost:8000/docs`

### Frontend Setup

Open another terminal inside the frontend directory.

Install dependencies:

```powershell
npm install
```

Create the environment configuration:

```powershell
Copy-Item .env.example .env
```

Start the frontend:

```powershell
npm run dev
```

Open the application:

`http://localhost:5173`

### Google OAuth Configuration

Google authentication requires an OAuth Web Application client.

The authentication starter uses the following local callback address:

```text
http://localhost:8000/auth/google/callback
```

Configure the Google client credentials in the backend environment file.

## 10. Current Development Status

| Feature | Status |
|---|---|
| Backend and frontend setup | Implemented |
| User registration and login | Implemented |
| Authentication session | Implemented |
| Logout | Tested |
| Role-aware navigation | Implemented |
| Historical dataset integration | Implemented |
| Monitoring statistics | Implemented |
| Attack distribution chart | Implemented |
| Historical traffic chart | Implemented |
| Historical activity table | Implemented |
| Flow pagination API | Implemented |
| CSV export | Under verification |
| Advanced filtering | In progress |
| Alerts page | Pending |
| Analysis page | Pending |
| Reports page | Pending |
| Backend role authorization | Requires further verification |
| Real-time monitoring | Future development |
| Predictive ML detection | Future development |

## 11. Known Limitations

The current implementation has several limitations.

**Historical data:** The monitoring dashboard analyzes CSV records rather than live network packets.

**Timestamp anomalies:** Some dataset records contain timestamps from 1970. These require data-quality handling.

**Performance:** Monitoring functions currently scan a large CSV file. Caching, indexing, or database-backed querying could improve performance.

**Export:** The initial CSV export implementation builds output in memory and requires optimization for large downloads.

**Authorization:** Backend role-based permission enforcement must be verified independently of frontend navigation.

**Account security:** Email verification, privileged-role approval, CSRF protection, rate limiting, and stronger token lifecycle controls remain development priorities.

## 12. Future Enhancements

Planned enhancements include:

1. Complete Alerts, Analysis, and Reports pages.
2. Add comprehensive network traffic filtering.
3. Implement reliable CSV and Excel exports.
4. Improve dataset processing performance.
5. Introduce incident investigation workflows.
6. Implement secure user and role administration.
7. Develop automated API and integration tests.
8. Add predictive network anomaly detection.
9. Explore real-time monitoring integration.
10. Prepare the platform for deployment.

## 13. GitHub Repository Guidelines

The repository should contain application source code, dependency manifests, configuration examples, and documentation.

The following should not be committed:

- Environment files containing secrets.
- Python virtual environments.
- `node_modules`.
- Generated cache files.
- Local database files.
- Large dataset files unless explicitly approved.

Recommended `.gitignore` entries:

```gitignore
.venv/
venv/
__pycache__/
*.pyc

node_modules/
dist/

.env
.env.*
!.env.example

backend/data/*.csv

*.db
*.sqlite
*.sqlite3
```

Development changes should be committed to the assigned personal Git branch rather than directly to `main`.

## 14. Conclusion

NetShield AI has progressed from an authentication starter into a full-stack application capable of analyzing and visualizing historical network security data.

The current implementation provides the foundation for authentication, role-aware navigation, dataset processing, network traffic statistics, and historical monitoring.

Development will continue with reporting, alerting, advanced analysis, stronger authorization, and future predictive monitoring capabilities.

---

**NetShield AI — Network Security Monitoring and Analysis**

*Project documentation for the current development checkpoint.*