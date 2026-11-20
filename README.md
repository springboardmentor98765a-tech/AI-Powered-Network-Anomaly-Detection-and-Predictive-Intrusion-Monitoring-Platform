<div align="center">

# 🛡️ NetShield

### Secure Authentication & Role-Based Access Control Module
**AI-Powered Network Anomaly Detection and Predictive Intrusion Monitoring Platform**

![React](https://img.shields.io/badge/Frontend-React%20(Vite)-61DAFB?logo=react&logoColor=white)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![JWT](https://img.shields.io/badge/Auth-JWT-000000?logo=jsonwebtokens&logoColor=white)
![bcrypt](https://img.shields.io/badge/Passwords-bcrypt-1677E8)
![Google](https://img.shields.io/badge/Sign--in-Google%20Identity-4285F4?logo=google&logoColor=white)

*Secure · Monitor · Protect*

</div>

---

## 📌 Overview

NetShield is a cybersecurity monitoring platform. This repository contains **Module 1: the secure
login and access-control foundation** that every other feature of the platform depends on.

Before anyone can view network alerts or investigate intrusions, the platform must know **who they
are** (authentication) and **what they are allowed to do** (authorization). This module delivers
both, with an audit trail of every important action.

Built as part of the **Infosys Springboard Internship**.

---

## 📑 Table of Contents

1. [Key Features](#-key-features)
2. [Screenshots](#-screenshots)
3. [Tech Stack](#-tech-stack)
4. [System Architecture](#-system-architecture)
5. [Authentication Flow](#-authentication-flow)
6. [Role-Based Access Control](#-role-based-access-control)
7. [Database Design](#-database-design)
8. [Security Design](#-security-design)
9. [API Reference](#-api-reference)
10. [Project Structure](#-project-structure)
11. [Getting Started](#-getting-started)
12. [Google Sign-In Setup](#-google-sign-in-setup-optional)
13. [Testing Checklist](#-testing-checklist)
14. [Design Decisions](#-design-decisions)
15. [Roadmap](#-roadmap)
16. [Author](#-author)

---

## ✨ Key Features

### Authentication
- 🔑 Sign in with **email or username** plus password, using a single field
- 🔵 **Google sign-in** for accounts created by an administrator (no public registration)
- 🔒 Passwords stored only as **bcrypt hashes** with a per-password random salt
- 🎟️ **JWT** access tokens with expiry and a unique token ID
- 💾 **Remember Me**: 7-day token (persistent) or 30-minute token (session only)
- 🚪 **Logout that really works**: the token is revoked on the server and rejected afterwards
- 🙈 **Generic error message**: never reveals whether the username or the password was wrong
- 🔁 **Forgot Password** request workflow, recorded for administrators

### Access control
- 👥 Three roles: **Administrator**, **Security Analyst**, **Team Lead**
- 🧭 Role-based menus and pages in the UI, **enforced again in the backend** (401 vs 403)
- 🚫 Inactive accounts are blocked immediately, even if they already hold a valid token
- 🧱 No role dropdown on the login page: the backend decides the role

### Administration
- 👤 **User management**: create, search, filter, activate/deactivate, assign roles, reset passwords
- 🏢 **Team management**: create teams, add and remove members (team leads manage only their own teams)
- 📜 **Audit log**: filter by action, status and date range, with pagination
- 🙋 **Profile page** with self-service password change

---

## 🖼️ Screenshots



| Login | Dashboard |
|---|---|
| <img width="1908" height="890" alt="image" src="https://github.com/user-attachments/assets/d30c250f-8fba-4477-992c-bdbb5da8813f" />
 | <img width="1357" height="888" alt="image" src="https://github.com/user-attachments/assets/71b81c91-f73e-4f58-8746-c4889e42a019" />
 |  <img width="1882" height="878" alt="image" src="https://github.com/user-attachments/assets/37e508d1-82d1-402a-9c27-41b6cb857263" />


| User Management | Audit Logs |
|---|---|
| (<img width="1907" height="888" alt="image" src="https://github.com/user-attachments/assets/91f69ddc-c7f5-4e0d-a0ce-27e9b0641df0" />
) |(<img width="1890" height="891" alt="image" src="https://github.com/user-attachments/assets/7f659492-8c75-404e-b2b2-104bf7a0f7d3" />
) |

---

## 🧰 Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 18 (Vite), React Router, Axios | UI, routing, API calls with automatic token handling |
| Backend | FastAPI (Python 3.10+) | REST API with automatic interactive docs |
| ORM | SQLAlchemy 2.0 | Database access with Python classes |
| Database | PostgreSQL | Users, roles, teams, audit logs, revoked tokens |
| Auth | python-jose (JWT), bcrypt, google-auth | Tokens, password hashing, Google ID-token verification |
| Validation | Pydantic v2 | Request validation and safe response models |

---

## 🏗️ System Architecture

```mermaid
flowchart LR
    U[User Browser] -->|HTTPS requests + Bearer token| F[React Frontend<br/>Vite :5173]
    F -->|Axios + JWT header| B[FastAPI Backend<br/>:8000]
    B -->|SQLAlchemy| D[(PostgreSQL)]
    B -.->|Verify ID token| G[Google Identity]
    F -.->|Sign-in button| G
```

**Backend layers**

```
Router (endpoints)  →  Dependencies (auth + role checks)  →  Models (database)
        ↓
   Schemas (validation)        Audit helper (activity log)
```

---

## 🔐 Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant R as React
    participant A as FastAPI
    participant D as PostgreSQL

    U->>R: Enter email/username + password
    R->>A: POST /auth/login
    A->>D: Find user by email or username
    A->>A: Verify bcrypt hash and check account is active
    alt Valid
        A->>D: Write audit log (success)
        A-->>R: Signed JWT (id, roles, expiry, jti)
        R->>A: GET /auth/me (Bearer token)
        A-->>R: Profile + roles
        R-->>U: Role-based dashboard
    else Invalid
        A->>D: Write audit log (failure + real reason)
        A-->>R: 401 "Invalid username/email or password."
    end
    U->>R: Click Logout
    R->>A: POST /auth/logout
    A->>D: Store token ID in revoked_tokens
    Note over A,D: The same token is rejected from now on
```

---

## 👥 Role-Based Access Control

| Capability | Administrator | Team Lead | Security Analyst |
|---|:---:|:---:|:---:|
| View own profile, change own password | ✅ | ✅ | ✅ |
| Manage users (create, update, activate/deactivate) | ✅ | ❌ | ❌ |
| Assign roles, reset passwords | ✅ | ❌ | ❌ |
| View roles and permission matrix | ✅ | ❌ | ❌ |
| Create teams | ✅ | ❌ | ❌ |
| View teams | All teams | Own teams | Own teams |
| Add / remove team members | All teams | Own teams | ❌ |
| View audit logs | ✅ | ✅ | ❌ |

**Two layers of protection:** the frontend hides what a role cannot use, and the backend
**rejects it anyway** (`401` not logged in, `403` not allowed). Typing a restricted address
in the browser shows *Access denied*.

---

## 🗄️ Database Design

```mermaid
erDiagram
    USERS ||--o{ USER_ROLES : has
    ROLES ||--o{ USER_ROLES : assigned
    USERS ||--o{ TEAM_MEMBERS : joins
    TEAMS ||--o{ TEAM_MEMBERS : contains
    USERS ||--o{ AUDIT_LOGS : performs

    USERS {
        int id PK
        string name
        string username UK
        string email UK
        string password_hash
        string status
        datetime created_at
    }
    ROLES {
        int id PK
        string role_name UK
        string description
    }
    USER_ROLES {
        int user_id FK
        int role_id FK
    }
    TEAMS {
        int id PK
        string team_name UK
        string description
        datetime created_at
    }
    TEAM_MEMBERS {
        int team_id FK
        int user_id FK
        datetime assigned_at
    }
    AUDIT_LOGS {
        int id PK
        int actor_user_id FK
        string action
        string target_type
        int target_id
        string status
        text details
        datetime created_at
    }
    REVOKED_TOKENS {
        int id PK
        string jti UK
        datetime expires_at
    }
```

| Design choice | Reason |
|---|---|
| `user_roles` and `team_members` link tables | Many-to-many relationships (a user can hold several roles and join several teams) |
| Unique, indexed `email` and `username` | No duplicates, and fast lookup on every login |
| `ON DELETE SET NULL` on audit logs | Audit records survive even if a user is removed |
| `ON DELETE CASCADE` on link tables | No orphaned role or team links |
| `revoked_tokens` table | JWTs are stateless, so logout needs a server-side blocklist |

---

## 🛡️ Security Design

| Threat | Protection |
|---|---|
| Stolen database | Passwords stored as **bcrypt** hashes with random salts. Plain text never stored. |
| Password guessing | bcrypt is deliberately slow. Server-enforced strength rules (8+ chars, upper, lower, number). |
| Username discovery | **One generic error** for every failure. Same response time for unknown users (dummy hash check). |
| Token forgery | JWT signed with a secret key. Any modified token is rejected. |
| Stolen token after logout | Token ID is stored in `revoked_tokens` and rejected. |
| Disabled employee | Account status is re-checked on **every request**. |
| Privilege escalation | Roles checked in the **backend**, not only the UI. Admins can't remove their own admin role or deactivate themselves. |
| Fake Google tokens | ID token verified on the server (signature, audience, expiry, verified email). |
| Unauthorized Google accounts | Google sign-in only works for **accounts an administrator already created**. |
| Oversized or malformed input | Pydantic validation with length limits and email checks. |
| Cross-site calls | CORS allows only the frontend address. |
| Log tampering | Audit logs are **read-only** through the API. |
| Leaked secrets | `.env` files are git-ignored. Only `.env.example` templates are committed. |

**Audit trail records:** successful and failed logins (with the real reason, visible only to
authorized roles), logouts, user changes, role assignments, password changes and resets,
password-reset requests, and team changes.

---

## 📡 API Reference

Interactive documentation is available at **http://127.0.0.1:8000/docs** when the backend runs.

### Authentication
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/auth/login` | Public | Email or username + password. Optional `remember`. |
| POST | `/auth/google` | Public | Sign in with a Google ID token (existing accounts only) |
| POST | `/auth/forgot-password` | Public | Record a password-reset request for administrators |
| POST | `/auth/logout` | Logged in | Revoke the current token |
| GET | `/auth/me` | Logged in | Current user profile and roles |

### Users
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/users` | Admin | Create a user |
| GET | `/users` | Admin | List users (search, status filter, pagination) |
| GET | `/users/{id}` | Admin | View one user |
| PUT | `/users/{id}` | Admin | Update name, email or status |
| POST | `/users/{id}/activate` · `/deactivate` | Admin | Enable or disable an account |
| PUT | `/users/{id}/roles` | Admin | Assign roles |
| POST | `/users/{id}/reset-password` | Admin | Set a new password for a user |
| PUT | `/users/me/password` | Logged in | Change your own password (revokes current token) |

### Roles, Teams, Audit
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/roles` | Admin | List roles |
| GET | `/roles/permissions` | Logged in | Permission matrix |
| POST | `/teams` | Admin | Create a team |
| GET | `/teams` | Logged in | All teams (admin) or own teams |
| GET | `/teams/{id}/members` | Admin / team member | List members |
| POST · DELETE | `/teams/{id}/members` | Admin / team lead (own team) | Add or remove a member |
| GET | `/audit-logs` | Admin, Team Lead | Filter by action, status, user, date range |

---

## 📂 Project Structure

```
netshield/
├── backend/
│   ├── app/
│   │   ├── main.py            # App entry point, CORS, router registration
│   │   ├── config.py          # Settings loaded from .env
│   │   ├── database.py        # Engine, session, Base
│   │   ├── models.py          # Database tables
│   │   ├── schemas.py         # Request/response validation
│   │   ├── security.py        # bcrypt hashing and JWT creation/verification
│   │   ├── dependencies.py    # Auth guard, active-account check, role guard
│   │   ├── audit.py           # Audit log helper
│   │   ├── permissions.py     # Role → permitted actions matrix
│   │   └── routers/
│   │       ├── auth.py        # Login, Google, forgot password, logout, me
│   │       ├── users.py       # User management and password change
│   │       ├── roles.py       # Roles and permissions
│   │       ├── teams.py       # Teams and members
│   │       └── audit_logs.py  # Audit log viewing
│   ├── seed.py                # Creates the 3 roles and the first administrator
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/api.js                 # Axios instance with automatic JWT header
│   │   ├── context/AuthContext.jsx    # Login state shared across the app
│   │   ├── components/
│   │   │   ├── Layout.jsx             # Sidebar with role-based menu
│   │   │   └── ProtectedRoute.jsx     # Login + role route guard
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Profile.jsx
│   │   │   ├── Users.jsx
│   │   │   ├── Roles.jsx
│   │   │   ├── Teams.jsx
│   │   │   └── AuditLogs.jsx
│   │   ├── App.jsx                    # Routes
│   │   └── index.css
│   └── .env.example
├── docs/screenshots/
├── .gitignore
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
Python 3.10+ · Node.js (LTS) · PostgreSQL · Git

### 1. Database
Create an empty PostgreSQL database:
```sql
CREATE DATABASE network_security_db;
```

### 2. Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # Windows   (Mac/Linux: source .venv/bin/activate)
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and fill in the values:
```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/network_security_db
SECRET_KEY=<generate with the command below>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
GOOGLE_CLIENT_ID=
```
Generate a secret key:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Create the tables, the three roles and the first administrator (edit the values inside `seed.py` first):
```bash
python seed.py
```

Start the API:
```bash
python -m uvicorn app.main:app --reload --reload-dir app
```
→ API docs: **http://127.0.0.1:8000/docs**

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```
→ App: **http://localhost:5173**

> Keep both terminals running at the same time.

---

## 🔵 Google Sign-In Setup (optional)

1. Open [Google Cloud Console](https://console.cloud.google.com) and create a project.
2. Configure the **OAuth consent screen** (External) and add your test users.
3. Create credentials → **OAuth client ID** → *Web application*.
4. Add the authorized JavaScript origin `http://localhost:5173`.
5. Put the **same Client ID** in both files, then restart both servers:

| File | Variable |
|---|---|
| `backend/.env` | `GOOGLE_CLIENT_ID=...` |
| `frontend/.env` | `VITE_GOOGLE_CLIENT_ID=...` |

Only users **already created by an administrator** (matching email) can sign in with Google.

---

## ✅ Testing Checklist

| Area | What to verify |
|---|---|
| Login | Wrong password and unknown user show the **same** error |
| Login | Email and username both work. Show/hide password works |
| Remember Me | Ticked: still logged in after closing the browser. Unticked: logged out |
| Logout | Back button does not reopen the dashboard. The old token returns 401 |
| Inactive user | Deactivated account cannot log in and existing sessions stop working |
| RBAC | Analyst sees no User Management or Audit Logs. Restricted URLs show *Access denied* |
| Users | Create, duplicate email (409), deactivate, change role, reset password |
| Teams | Create, add, remove. Analysts and leads see only their own teams |
| Audit | Success and failure entries appear and filters work |
| Google | Existing account signs in. Unknown Gmail is rejected and logged |

---

## 🧠 Design Decisions

- **Why JWT plus a revocation table?** JWTs are stateless and can't be "deleted", so logout stores the token ID and every request checks it.
- **Why one generic login error?** Specific messages let attackers discover valid usernames.
- **Why re-check account status on every request?** Deactivating a user must take effect immediately, not when their token expires.
- **Why administrator-created accounts?** For a security platform, public self-registration is a risk. Google sign-in follows the same rule.
- **Why `sessionStorage` by default?** The token disappears when the tab closes. `localStorage` is used only when the user chooses Remember Me.
- **Why a link table for roles?** It allows users to hold more than one role without changing the schema.

---

## 🗺️ Roadmap

**Current module (complete)**
- [x] Secure login, JWT, bcrypt, logout with revocation
- [x] Google sign-in (admin-created accounts only)
- [x] Role-based access control with three roles
- [x] User, role, team and audit log management

**Possible improvements**
- [ ] Refresh tokens and login-attempt lockout
- [ ] Password reset by email link
- [ ] Notification badge for pending password-reset requests
- [ ] Team leads able to search users by name
- [ ] Automated tests (pytest and React Testing Library)

**Upcoming platform modules**
- [ ] Network traffic monitoring
- [ ] AI-based anomaly detection
- [ ] Predictive intrusion alerts and incident investigation

---



---

<div align="center">

**NetShield: Secure · Monitor · Protect** 🛡️

</div>
