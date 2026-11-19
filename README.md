# NetShield AI — Development Progress

## Project Overview

NetShield AI is a network anomaly detection and predictive intrusion monitoring platform. The project is being developed in modules, starting with user and access management, followed by live network monitoring and subsequent anomaly detection, intrusion prediction, alert management, and analytics capabilities.

This README is maintained as a development progress log. It distinguishes implemented and tested functionality from work planned for later modules.

## Project Modules and Current Status

| Module | Name | Status |
|---|---|---|
| 1 | User Management Module | Core implementation completed |
| 2 | Network Monitoring Module | Core implementation implemented; local integration testing completed, final demonstration checklist remains |
| 3 | Anomaly Detection Module | Planned |
| 4 | Intrusion Prediction Module | Planned |
| 5 | Alert Management Module | Planned |
| 6 | Analytics Dashboard Module | Initial dashboard UI exists; full threat analytics/reporting integration planned |
| 7 | AI Detection Module | Planned |

---

# Module 1: User Management Module

**Status: Core implementation completed**

The first module establishes authentication, authorization, team management, and activity tracking.

### Authentication and Account Management

- User login using username/email and password.
- JWT-based authentication.
- Logout with server-side session revocation.
- Authenticated user profile retrieval.
- Password changes with current-password verification.
- Password validation and session revocation after password changes.

### Role-Based Access Control (RBAC)

The platform has three roles:

- **Administrator:** Administrative functionality and user management.
- **Security Analyst:** Security workspace access based on assigned permissions.
- **Team Lead / Supervisor:** Team leadership and team-related permissions.

Frontend navigation and protected routes use role information, while backend authorization is enforced through role dependencies.

### User Management

Administrator functionality includes:

- Creating and viewing user accounts.
- Searching by name, username, or email.
- Filtering by account status.
- Editing user information.
- Assigning and updating roles.
- Activating and deactivating accounts.

Backend safeguards cover unauthorized role changes, self-deactivation, and removal of the last active administrator.

### Team Management

- Creating and updating teams.
- Assigning team leads.
- Adding and removing team members.
- Viewing team details and membership information.

### Audit Logging

- Recording important platform activities, including authentication and account-management operations.
- Viewing and filtering events by user, action, status, target type, and target ID.
- Date-range filtering, event details, and pagination.

### Module 1 Frontend

- Role-aware dashboard and navigation.
- Dedicated user, role, team, and audit-log interfaces.
- Profile and change-password pages.

---

# Module 2: Network Monitoring Module

**Status: Core monitoring implementation completed; final end-to-end demonstration and repository submission checks remain.**

The second module collects live network packet metadata, stores it in PostgreSQL, analyses traffic and protocols, and visualizes the results in the React application.

### 1. Packet Collection

- Wireshark/TShark is used for live packet capture.
- Network interfaces are discovered through TShark.
- The selected interface is used to start and stop capture sessions.
- Captured packet metadata includes timestamp, source and destination IP addresses (when present), protocol, source and destination ports (when present), packet length, protocol stack, and interface name.
- Capture sessions and packet records are persisted in PostgreSQL.
- Packet records are inserted in batches rather than committing every packet individually.

### 2. Traffic Monitoring

The network API provides:

- Capture-session listing and current capture status.
- Total packets and total bytes for a capture and selected time window.
- Unique source IPs, destination IPs, and hosts.
- Top source and destination IPs, ranked by traffic volume.
- Incoming, outgoing, and unknown-direction traffic estimates, using the local interface IP addresses where possible.
- Traffic activity grouped into one-minute timeline buckets.
- Packet filtering by source IP, destination IP, protocol, port, and date range.
- Supported analytics time windows: 15, 30, 60, and 120 minutes.

Direction is an estimate. Packets without usable IP addresses (for example, ARP packets) may be classified as unknown.

### 3. Protocol Analysis

The packet parser classifies protocols using TShark's protocol information and available ports. The implementation includes classifications for:

- TCP
- UDP
- HTTP
- HTTPS/TLS
- DNS
- ICMP and ICMPv6
- ARP
- Other or unknown protocols

Protocol analytics report packet counts, total bytes, and packet/byte percentages for each detected protocol in the selected time window. The classification reflects the protocol metadata available in the captured packets; it is not deep-packet inspection of encrypted application payloads.

### 4. Traffic Visualization

Two separate frontend pages are provided:

**Network Monitoring** (`/network-monitoring`)

- Network interface selection and live capture controls.
- Capture-session selection.
- Traffic summary metrics.
- Protocol distribution.
- Traffic timeline.
- Incoming/outgoing/unknown traffic summary.
- Top source and destination IP tables.
- Packet explorer with IP, protocol, and port filters.
- CPU, memory, and disk usage from the system-health API.

**Security Overview** (`/dashboard`)

- Overview of available network/capture metrics.
- Traffic and protocol information where supplied by the monitoring APIs.
- Host system-health information.
- Security/attack categories are represented in the UI, but categories must not be interpreted as confirmed detections until the anomaly-detection and alert-management modules provide real detection/alert records.

### 5. Backend API Endpoints

The network router is mounted under `/api/v1/network`.

| Endpoint | Purpose |
|---|---|
| `GET /interfaces` | Discover available capture interfaces |
| `POST /captures/start` | Start a capture on an interface |
| `POST /captures/{capture_id}/stop` | Stop an active capture |
| `GET /captures/status` | Get current capture status and totals |
| `GET /captures` | List capture sessions |
| `GET /captures/{capture_id}/summary` | Traffic summary, top IPs, and direction estimates |
| `GET /captures/{capture_id}/protocol-stats` | Protocol packet/byte statistics |
| `GET /captures/{capture_id}/traffic-timeline` | Traffic grouped by minute |
| `GET /captures/{capture_id}/packets` | Paginated packet search and filters |
| `GET /system-health` | CPU, memory, disk, and host network I/O counters |

The analytics endpoints accept `window_minutes` values of 15, 30, 60, or 120. The system-health endpoint uses `psutil` to report host resource metrics.

### Module 2 Validation Performed

The following local checks have been performed during development:

- Python application modules compiled successfully using `python -m compileall app`.
- Alembic reports a single migration head for the current database migration chain.
- The network interfaces endpoint returned the available interfaces, including Wi-Fi.
- Live TShark capture on the Wi-Fi interface completed and packet records were retrieved from PostgreSQL.
- One recorded capture returned 14,098 stored packets.
- Another recorded capture returned 2,642 packets and 291,631 bytes.
- The traffic summary endpoint returned packet/byte totals, unique hosts, top IPs, and direction estimates.
- Protocol statistics returned ARP, HTTPS, UDP, TCP, DNS, and ICMPv6 records for a stored capture.
- The system-health endpoint returned CPU, memory, disk, and network-I/O metrics from the development machine.
- The React/Vite production build completed successfully.

These are local development checks, not a claim of production deployment or a completed 20-minute demonstration. A longer live capture should be performed during the final demonstration to populate multiple timeline buckets.

### Module 2 Scope Boundaries

Module 2 implements packet collection, traffic monitoring, protocol analysis, and traffic visualization. It does **not** yet implement a full attack-detection engine. Port-scan, traffic-flood, brute-force detection, persistent security-alert management, threat prediction, and ML-based attack classification are tracked under the subsequent anomaly-detection, intrusion-prediction, alert-management, and AI-detection work described in the project plan.

---

# Planned Modules

## Module 3: Anomaly Detection Module

Planned according to the project specification:

- Network behaviour analysis.
- Suspicious activity detection.
- Pattern recognition.
- Anomaly classification.

## Module 4: Intrusion Prediction Module

Planned:

- Threat prediction.
- Attack probability analysis.
- Risk scoring.
- Intrusion forecasting.

## Module 5: Alert Management Module

Planned:

- Real-time threat alerts.
- Alert prioritization.
- Incident management.
- Security notifications.

## Module 6: Analytics Dashboard Module

Planned:

- Traffic analytics.
- Threat intelligence reports.
- Security metrics.
- Attack trend monitoring.

The Module 2 monitoring pages provide an initial UI foundation; full threat-intelligence reporting and attack-trend analytics depend on later modules.

## Module 7: AI Detection Module

Planned:

- Machine-learning model training.
- Attack classification.
- Behavioural analysis.
- Prediction workflows.

---

# Technology Stack

| Component | Technologies |
|---|---|
| Frontend | React, Vite, JavaScript, CSS |
| Routing | React Router DOM |
| HTTP client | Axios |
| Icons | Lucide React |
| Backend | Python, FastAPI |
| Database | PostgreSQL |
| ORM | SQLAlchemy |
| Database migrations | Alembic |
| Authentication | JWT and password hashing |
| Network capture | Wireshark / TShark |
| Host telemetry | psutil |
| Version control | Git and GitHub |

Datasets for later machine-learning work are kept separate from the live packet-capture workflow. Dataset preprocessing and model training are not part of the completed Module 2 implementation.

---

# Development Progress Log

| Milestone | Work recorded |
|---|---|
| Module 1 | Authentication, RBAC, user management, team management, audit logging, and account pages implemented. |
| Module 2 — Backend | TShark interface discovery and live capture, PostgreSQL capture/packet persistence, traffic analytics, protocol statistics, packet filters, timeline, and system-health API implemented. |
| Module 2 — Frontend | Network Monitoring page and Security Overview page integrated into the existing authenticated React application. |
| Module 2 — Validation | Local capture/API checks, Python compilation, and Vite production build completed successfully. Final longer-duration demonstration and repository review remain. |

---