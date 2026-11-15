# NetShield AI — Authentication starter

This is a learning starter for a React + FastAPI + PostgreSQL authentication module.

## Included
- React login/signup interface
- Email/password registration and login
- Argon2 password hashing
- JWT access token stored in an HttpOnly cookie
- Google OAuth / OpenID Connect login and first-time account creation
- `/auth/me` and `/auth/logout`
- Public signup cannot create Administrator accounts

## 1. Prerequisites
Install Node.js (LTS), Python 3.11+, PostgreSQL, and VS Code.

Create a PostgreSQL database named `netshield`.

## 2. Backend setup
Open a terminal in `backend`:

Windows PowerShell:
```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `backend/.env` and set `DATABASE_URL`, `JWT_SECRET`, and (for Google) the Google client credentials.

Generate a strong local JWT secret with:
```powershell
py -c "import secrets; print(secrets.token_urlsafe(48))"
```

Start FastAPI:
```powershell
uvicorn app.main:app --reload
```
API docs: http://localhost:8000/docs

## 3. Frontend setup
Open a second terminal in `frontend`:

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```
Open http://localhost:5173.

## 4. Google OAuth setup
In Google Cloud Console:
1. Create/select a project and configure the OAuth consent screen.
2. Create an OAuth Client ID of type **Web application**.
3. Add `http://localhost:8000/auth/google/callback` as an Authorized redirect URI.
4. Put the client ID and client secret in `backend/.env`.
5. Restart FastAPI.

The Google button starts the OAuth flow at the backend. The backend verifies the Google identity and sets the app's own JWT cookie.

## 5. Important design/security notes
- This is a local development starter, not production-ready.
- `secure=False` is for localhost only. Set `secure=True` behind HTTPS in production.
- Use a separate random session secret and JWT secret in production.
- Add CSRF protection when using cookie-based authentication in production.
- Add refresh-token rotation/revocation if you need longer sessions and robust server-side logout. This starter expires and deletes the access cookie, but a copied JWT remains valid until its expiry.
- Add email verification, password reset, rate limiting, audit logging, role/permission tables, teams, and organization membership before calling Module 1 complete.
- SOC and Enterprise public signups currently create accounts with the selected role. For a real deployment, add invitation/approval checks before granting those roles. Do not let users self-assign privileged roles.
- The current code uses a simple role column to get the authentication flow running. Expand to Roles/User_Roles and backend permission dependencies for the full RBAC requirement.
- Do not commit `.env` files or secrets to GitHub.
