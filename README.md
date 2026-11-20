# NetShield AI – AI-Powered Network Anomaly Detection and Predictive Intrusion Monitoring Platform

## Project Overview
NetShield AI is a project focused on detecting network anomalies and monitoring potential security threats using AI-based techniques.

The project is being developed in modules. **Module 1 – User Management** has been completed.

## Module 1: User Management

**Development Period:** 10 November 2026 – 14 November 2026  
**Status:** Completed

### Work Completed

- Set up the backend using **Python and FastAPI**.
- Integrated **PostgreSQL** as the database.
- Implemented user registration and login authentication.
- Added secure password hashing using Argon2.
- Implemented JWT-based authentication and authorization.
- Created role-based access control with Admin, Analyst, and Viewer roles.
- Developed user management features (Create, Read, Update, Delete).
- Implemented team management and team member assignment.
- Added audit logging to track important user and team activities.
- Developed the frontend using **React and Vite**.
- Connected the frontend with the FastAPI backend.
- Implemented role-based access restrictions in the application.
- Added automated backend tests using Pytest.

### Technologies Used

| Component | Technology |
|---|---|
| Frontend | React, Vite |
| Backend | Python, FastAPI |
| Database | PostgreSQL |
| Authentication | JWT |
| Password Security | Argon2 |
| Testing | Pytest |
| Version Control | Git, GitHub |

### Testing and Validation

- Backend automated tests: **24 passed**
- Frontend linting: **0 errors**
- Backend and frontend integration tested.
- Git repository updated successfully.

---

### Progress Update – 20 November 2026

**Module 2 – Network Monitoring Integration (Week 2, Milestone 1)**

Completed the integration of live network monitoring into the existing NetShield AI platform.

**Work Completed:**

1. Integrated live packet capture using Wireshark TShark.
2. Developed FastAPI endpoints for network monitoring:
   - Network capture status
   - Traffic summary
   - Recent packet details
3. Implemented Admin-only access to network monitoring APIs.
4. Integrated the Network Monitoring dashboard into the existing Admin interface.
5. Added live traffic statistics, including total packets, bytes, active IPs and protocol distribution.
6. Added traffic activity visualization, top IP addresses and recent packet information.
7. Implemented time-based and packet filtering options.
8. Added network monitoring authorization tests.

**Testing:**
- Backend: 32 tests passed.
- Frontend: Build successful.
- Frontend lint: No errors; minor warnings remain.
- Verified live packet capture and dashboard data retrieval.

**Technologies Used:** Python, FastAPI, React, JavaScript, Wireshark TShark, PostgreSQL.

**GitHub:** Changes successfully pushed to the `Deepthika-A` branch.

**Latest Commit:** `eb133dd` – Add live network monitoring and packet capture.

**Current Status:** Week 2 – Milestone 1. Network monitoring integration completed. Further validation and dashboard testing are in progress.

**Next Steps:** Complete dashboard validation and prepare the Milestone 1 demonstration.


**Last Updated:** 20 November 2026

**Developer:** Deepthika
