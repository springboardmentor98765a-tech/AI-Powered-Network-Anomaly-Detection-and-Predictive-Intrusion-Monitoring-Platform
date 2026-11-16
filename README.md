# NetShield AI
## AI-Powered Network Anomaly Detection and Predictive Intrusion Monitoring Platform

NetShield AI is a network security management platform designed to provide centralized monitoring and administration of security-related activities.

The platform provides authentication, role-based access control, user management, team management, security audit logging, and an administrative dashboard.

It combines a React-based frontend with a FastAPI backend and SQLite database to provide a structured environment for managing users, permissions, teams, and security events.

## Project Objectives

- Develop a centralized network security management platform.
- Implement secure user authentication and authorization.
- Provide role-based access control for different user categories.
- Manage users, roles, and team memberships.
- Maintain records of authentication and administrative activities.
- Provide a dashboard for monitoring platform statistics.
- Implement secure API communication between frontend and backend.
- Establish a foundation for future machine learning-based network anomaly detection.

## Technology Stack

### Backend
- Python
- FastAPI
- SQLAlchemy
- SQLite
- JWT Authentication
- pwdlib
- Argon2 Password Hashing
- Pydantic
- SlowAPI

### Frontend
- React.js
- JavaScript
- HTML / JSX
- CSS
- Vite
- Axios

### Database
- SQLite
- SQLAlchemy ORM

### Development and Testing
- Visual Studio Code
- Git and GitHub
- Python Virtual Environment
- npm
- FastAPI Swagger UI

## Major Project Modules

### 1. Authentication and Authorization
- User login using username or email.
- JWT-based authentication.
- Secure password hashing using Argon2.
- Authentication session management.
- Logout functionality.
- Password change functionality.
- Protected frontend routes.

### 2. Role-Based Access Control (RBAC)
- Administrator role.
- Security Analyst role.
- Team Lead / Supervisor role.
- Role-based permissions.
- Restricted access to administrative operations.
- Backend authorization checks.

### 3. User Management
- Create new users.
- View registered users.
- Update user information.
- Assign roles to users.
- Activate and deactivate user accounts.
- Reset user passwords.

### 4. Team Management
- Create and update teams.
- View team information.
- Assign users to teams.
- Remove team members.
- Role-based team access restrictions.

### 5. Security Audit Logging
- Record authentication activities.
- Track administrative actions.
- Maintain security audit records.
- Filter audit logs by action and status.
- Filter logs by actor and target type.
- View individual audit log details.

### 6. Administrative Dashboard
- Display total registered users.
- Display active users.
- Display total teams.
- Display total security audit events.
- Show recent platform activity.
- Centralized administrative overview.

### 7. API Security
- JWT token validation.
- Protected API endpoints.
- Role-based authorization.
- Authentication session validation.
- Session revocation.
- Login rate limiting.
- Secure password storage.

## Project Structure

```text
NetworkAnomalyPlatform/
|
├── backend/
│   ├── app/
│   │   ├── models/
│   │   │   ├── user.py
│   │   │   ├── role.py
│   │   │   ├── team.py
│   │   │   ├── audit_log.py
│   │   │   └── auth_session.py
│   │   │
│   │   ├── routes/
│   │   │   ├── auth.py
│   │   │   ├── users.py
│   │   │   ├── roles.py
│   │   │   ├── teams.py
│   │   │   ├── audit.py
│   │   │   ├── dashboard.py
│   │   │   └── rbac.py
│   │   │
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── main.py
│   │   ├── database.py
│   │   └── create_admin.py
│   │
│   └── requirements.txt
|
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── styles/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   │
│   ├── package.json
│   ├── package-lock.json
│   └── vite.config.js
|
├── .gitignore
└── README.md
```

## Installation and Setup

### Requirements

- Python 3.10 or later.
- Node.js.
- npm.
- Git.
- Visual Studio Code (recommended).

### 1. Clone the Repository

```bash
git clone https://github.com/springboardmentor98765a-tech/AI-Powered-Network-Anomaly-Detection-and-Predictive-Intrusion-Monitoring-Platform.git

cd AI-Powered-Network-Anomaly-Detection-and-Predictive-Intrusion-Monitoring-Platform
```

Switch to the development branch:

```bash
git checkout Lalam-Yasaswi
```

### 2. Setup Backend

Navigate to the backend directory:

```bash
cd backend
```

Create a virtual environment:

```bash
python -m venv venv
```

Activate the virtual environment.

**Windows PowerShell:**

```powershell
.\venv\Scripts\Activate.ps1
```

**Linux / macOS:**

```bash
source venv/bin/activate
```

Install backend dependencies:

```bash
pip install -r requirements.txt
```

Create a `.env` file inside the backend directory:

```env
DATABASE_URL=sqlite:///./user_management.db
SECRET_KEY=your_secure_secret_key
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

Replace the example secret key with a securely generated secret.

### 3. Start Backend

From the backend directory, run:

```bash
python -m uvicorn app.main:app --reload
```

Backend address:

http://127.0.0.1:8000

API documentation:

http://127.0.0.1:8000/docs

### 4. Setup Frontend

Open another terminal and navigate to the frontend directory:

```bash
cd frontend
```

Install frontend dependencies:

```bash
npm install
```

Start the frontend development server:

```bash
npm run dev
```

Frontend address:

http://localhost:5173

## API Endpoints

| Module | Endpoint | Description |
|---|---|---|
| Authentication | `/auth/login` | User login |
| Authentication | `/auth/me` | Retrieve current user |
| Authentication | `/auth/logout` | User logout |
| Authentication | `/auth/change-password` | Change password |
| Users | `/users/` | User management |
| Teams | `/teams/` | Team management |
| Roles | `/roles/` | Retrieve roles |
| Audit | `/audit/` | Retrieve audit logs |
| Audit | `/audit/search/filter` | Filter audit logs |
| Dashboard | `/dashboard/stats` | Retrieve dashboard statistics |
| RBAC | `/rbac/admin` | Administrator access |
| RBAC | `/rbac/analyst` | Security Analyst access |
| RBAC | `/rbac/team-lead` | Team Lead access |

