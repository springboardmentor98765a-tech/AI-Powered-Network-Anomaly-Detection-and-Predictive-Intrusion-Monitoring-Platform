# NetShield AI — AI-Powered Network Anomaly Detection & Predictive Intrusion Monitoring Platform

[![Project Status: Active Development](https://img.shields.io/badge/Status-Module%202%20Completed-success.svg)]()
[![Backend: FastAPI](https://img.shields.io/badge/Backend-FastAPI-005571?logo=fastapi)]()
[![Frontend: React & Vite](https://img.shields.io/badge/Frontend-React%20%2F%20Vite%20%2F%20TS-61DAFB?logo=react&logoColor=black)]()
[![Database: PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-4169E1?logo=postgresql&logoColor=white)]()

---

## Current Project Status

```text
Module 2 implementation completed; code pushed to GitHub on 20/11/2026.
```

---

## 👤 Developer Profile

- **Developer Name:** Ankit Raj
- **Program:** Infosys Springboard Virtual Internship
- **Institution:** Guru Jambheshwar University of Science and Technology (GJUS&T), Hisar
- **Email:** ankitraj2095@gmail.com

---

## 📊 Project Implementation Status & Tracking

| Module / Milestone | Core Scope                 |    Status     | Completion Date |
| :----------------- | :------------------------- | :-----------: | :-------------: |
| **Module 1**       | **User Management & RBAC** | **Completed** | **15 Nov 2026** |
| **Module 2**       | **Network Monitoring**     | **Completed** | **20 NOv 2026** |
| **Module 3**       | **-**                      |   **Next**    |      **-**      |

---

## 🗂️ Current Repository Structure

```text
AI-Powered-Network-Anomaly-Detection-and-Predictive-Intrusion-Monitoring-Platform/
├── client/                 # React + Vite + TypeScript SOC Portal
│   ├── src/
│   │   ├── components/     # UI elements (Inputs, Sidebar, navigation)
│   │   ├── context/        # Authentication and app state management
│   │   └── pages/          # Dashboard, User Management, Team Operations, Auth
│   ├── package.json
│   └── vite.config.ts
|
├── server/                 # FastAPI Backend Service
│   ├── app/
│   │   ├── api/            # Route controllers (Auth, Users, Teams, Audit)
│   │   ├── config.py       # Environment and application configurations
│   │   ├── database.py     # SQLAlchemy session setup
│   │   ├── models.py       # PostgreSQL database schemas
│   │   ├── schemas.py      # Pydantic data validation models
│   │   ├── security.py     # JWT token generation & password hashing
│   │   └──main.py          # FastAPI application entry point
│   ├── seed.py             # Database seed script for roles and initial admin
│   └── requirements.txt    # Python dependencies
|
├── docs/                   # Project Documentations
└── README.md
```

---

## 🚀 Local Development Setup Guide

### Prerequisites

- Python 3.10+
- Node.js 18+ & npm
- PostgreSQL installed and running locally (Database name: `netshield_ai`)

### 1. Backend Setup (`/server`)

Open a terminal and navigate to the server folder:

```bash
cd server

# Create and activate virtual environment
python -m venv venv
# Windows PowerShell: .\venv\Scripts\Activate.ps1
# Mac/Linux: source venv/bin/activate

# Install Python packages
pip install -r requirements.txt
```

Create a .env file in the `server/` directory:

```bash
# Configure environment variables
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/netshield_ai
SECRET_KEY=your_super_secret_jwt_key
```

Run the seed script manually to populate initial evaluation accounts, then start the server:

```bash
# Populate initial evaluation accounts
python seed.py

# Start the server
uvicorn app.main:app --reload --port 8000
```

- **API Root:** `http://localhost:8000`
- **Interactive Swagger Docs:** `http://localhost:8000/docs`

## 🔑 Default Seed Evaluation Credentials (`seed.py`)

| Role                 | Email Address             | Password              | Privileges & Scope     |
| :------------------- | :------------------------ | :-------------------- | :--------------------- |
| **Administrator**    | `admin@netshield.ai`      | `AdminSecure123!`     | Full user provisioning |
| **Team Lead**        | `alice.lead@netshield.ai` | `LeadPassword123!`    | Team member oversight  |
| **Security Analyst** | `ethan@netshield.ai`      | `AnalystPassword123!` | Network monitoring     |

### 2. Frontend Setup (`/client`)

Open a separate terminal window:

```bash
cd client

# Install Node modules
npm install

# Start the Vite development server
npm run dev
```

- **SOC Web Portal:** Open the local Vite URL provided in your terminal (typically `http://localhost:5173`).

## 📸 UI & API Previews (Module 1 & 2)

|                                                       Authentication (Login & Registration)                                                       |                             User Management & RBAC                             |
| :-----------------------------------------------------------------------------------------------------------------------------------------------: | :----------------------------------------------------------------------------: |
| <img src="docs/screenshots/login.png" alt="Login Page" width="200" /> <img src="docs/screenshots/register.png" alt="Register Page" width="200" /> | <img src="docs/screenshots/dashboard.png" alt="User Management" width="420" /> |

|                              Team Operations                               |                                Audit Logs                                 |
| :------------------------------------------------------------------------: | :-----------------------------------------------------------------------: |
| <img src="docs/screenshots/teams.png" alt="Team Operations" width="420" /> | <img src="docs/screenshots/auditlogs.png" alt="Audit Logs" width="420" /> |

|                               Network Monitoring                                |                               Threat Analytics                               |
| :-----------------------------------------------------------------------------: | :--------------------------------------------------------------------------: |
| <img src="docs/screenshots/network.png" alt="Network Monitoring" width="420" /> | <img src="docs/screenshots/threat.png" alt="Threat Analytics" width="420" /> |
