# NetShield AI

AI-Powered Network Anomaly Detection and Threat Monitoring Platform for Security Operations Center (SOC) teams.

---

## Frontend Documentation

### 1. How to Run

1. **Install Dependencies**:
   ```bash
   cd frontend
   npm install
   ```

2. **Environment Configuration**:
   Create or verify `frontend/.env`:
   ```env
   VITE_API_URL=http://localhost:8000
   ```

3. **Start Development Server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

4. **Production Build & Lint**:
   ```bash
   npm run build
   npm run lint
   ```

---

### 2. Role-to-Dashboard Mapping

The frontend routes to dedicated dashboard components via `DashboardRouter.jsx`:

| Role Name | Display Label | Assigned Dashboard | Primary Functionality |
|---|---|---|---|
| `admin` | Administrator | `AdminDashboard.jsx` | Command Center: 4 user & team metrics, Users by Role chart, 24h Failed Logins count, Recent Security Activity feed, quick action links. |
| `security_analyst` | Security Analyst | `AnalystDashboard.jsx` | Workbench: Real-time telemetry monitoring modules, "My Teams" side-panel, Account Security password rotation. |
| `team_lead` | Team Lead | `TeamLeadDashboard.jsx` | Operations Overview: Led teams roster cards, personnel status, secondary team memberships, and team alert queues. |

---

### 3. Design Tokens

All colors, glass styles, and sizing parameters are centralized in:
`frontend/src/styles/tokens.css`

- **Accent Color**: `--accent: #95ff50;` (Lime). Changing this one variable updates buttons, active navigation markers, focus rings, and logo branding app-wide.
- **Glass Layers**:
  - `--glass-1`: Subtle panels and inputs (`rgba(255, 255, 255, 0.04)`)
  - `--glass-2`: Cards and table containers (`rgba(255, 255, 255, 0.07)`)
  - `--glass-3`: Modals, drawers, and menus (`rgba(18, 22, 26, 0.72)`)

---

### 4. Staged Placeholders (Awaiting Later Modules)

Per the project roadmap, widgets requiring future ML backend services render dedicated `PlaceholderWidget` components (with dashed glass borders, staged indicators, and zero fabricated metrics):

- **Module 2 (Network Monitoring)**:
  - *Live Traffic Overview* (Admin Dashboard)
  - *Live Network Traffic Stream* (Analyst Workbench)
- **Module 3 (Anomaly Detection)**:
  - *Recent Anomalies & Outliers* (Analyst Workbench)
- **Module 4 (Intrusion Prediction)**:
  - *Active Threats & Risk Score* (Admin Dashboard)
- **Module 5 (Alert Management)**:
  - *Alert Volume & Categorization* (Admin Dashboard)
  - *Alert Queue by Priority* (Analyst Workbench)
  - *Assigned Incidents* (Analyst Workbench)
  - *Team Alert Workload Distribution* (Team Lead Dashboard)
  - *Open Incidents by Analyst* (Team Lead Dashboard)
