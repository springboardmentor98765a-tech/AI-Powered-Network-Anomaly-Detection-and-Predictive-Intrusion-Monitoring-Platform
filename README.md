
# NetShield AI
## AI-Powered Network Anomaly Detection and Predictive Intrusion Monitoring Platform

NetShield AI is a network security monitoring platform designed to analyse network traffic, identify unusual activities, detect potential intrusions and generate security alerts.

The platform combines machine learning, network traffic analysis and a centralized security dashboard to help security analysts monitor suspicious network behaviour.

## Project Objectives

- Monitor network traffic and analyse network flows.
- Identify unusual network behaviour using machine learning.
- Classify suspicious activities into potential attack categories.
- Calculate risk scores for detected threats.
- Generate security alerts and manage incidents.
- Provide a centralized dashboard for security monitoring.
- Implement authentication and role-based access control.
- Maintain audit records of important platform activities.

## Technology Stack

### Backend
- Python
- FastAPI
- SQLAlchemy
- PostgreSQL / SQLite
- JWT Authentication
- bcrypt

### Frontend
- Next.js
- React.js
- JavaScript
- HTML / JSX
- CSS
- Tailwind CSS
- Chart.js

### Machine Learning
- Scikit-learn
- Isolation Forest
- Random Forest
- XGBoost (optional)
- NumPy
- Pandas

### Development and Testing
- Visual Studio Code
- Git and GitHub
- Pytest
- Postman
- Docker and Docker Compose

## Major Project Modules

### 1. User Management
- User authentication and login.
- Password hashing.
- JWT-based authentication.
- Role-based access control.
- User account management.
- Team management.
- Audit logging.

### 2. Network Monitoring
- Network traffic collection.
- Traffic preprocessing.
- Protocol analysis.
- Network traffic visualization.
- CSV-based traffic ingestion.

### 3. Anomaly Detection
- Network behaviour analysis.
- Isolation Forest-based anomaly detection.
- Identification of unusual network activities.

### 4. Intrusion Prediction
- Machine learning-based attack classification.
- Risk scoring.
- Attack probability analysis.
- Intrusion forecasting.

### 5. Alert Management
- Threat alert generation.
- Alert prioritization.
- Incident management.
- Security notifications.

### 6. Analytics Dashboard
- Network traffic analytics.
- Attack visualization.
- Security metrics.
- Threat intelligence reporting.

## Project Structure

```text
NetShield-AI/
|
├── backend/
│   ├── app/
│   │   ├── routers/
│   │   ├── services/
│   │   ├── ml/
│   │   ├── main.py
│   │   ├── auth.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── database.py
│   │   └── audit.py
│   |
│   ├── tests/
│   └── requirements.txt
|
├── frontend/
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── package.json
|
├── docs/
├── docker-compose.yml
└── README.md
```

## Installation and Setup

### Requirements
- Python 3.11 or 3.12 recommended.
- Node.js.
- npm.
- Git.

### 1. Clone the Repository

```bash
git clone <repository-url>
cd AI-Powered-Network-Anomaly-Detection-and-Predictive-Intrusion-Monitoring-Platform
```

### 2. Setup Backend

```bash
cd backend

python3 -m venv .venv

source .venv/bin/activate

pip install -r requirements.txt
```

### 3. Train Machine Learning Models

```bash
python -m app.ml.train --rows 5000
```

The default training workflow uses synthetic network traffic.
Random Forest can be used when the optional XGBoost runtime is unavailable.

### 4. Start Backend

```bash
uvicorn app.main:app --reload
```

Backend address:

http://localhost:8000

API documentation:

http://localhost:8000/docs

### 5. Setup Frontend

Open another terminal:

```bash
cd frontend

npm install

npm run dev
```

Frontend address:

http://localhost:3000

## Testing

### Backend Tests

From the backend directory:

```bash
python -m pytest -v
```

### Frontend Production Build

From the frontend directory:

```bash
npm run build
```

## Dataset Information

The initial demonstration supports synthetic network traffic.

The project also provides dataset-loading workflows for:

- CICIDS2017
- UNSW-NB15

Real datasets must be obtained separately and configured before training on them.

Synthetic demonstration results should not be interpreted as real-world detection performance.

## Security Considerations

- Passwords must be stored as secure hashes.
- Authentication tokens must be protected.
- Sensitive configuration must be stored in environment variables.
- Protected APIs must enforce authorization on the backend.
- Audit logs must not contain passwords or authentication tokens.
- Demo credentials must be changed before deployment.

## Project Status

This project is being developed as part of the Infosys Springboard Virtual Internship.

Implementation, testing and documentation are organized according to the mentor-provided project milestones.

## Future Enhancements

- Real-time packet collection.
- Advanced threat intelligence integrations.
- Improved role and permission management.
- Enhanced incident investigation workflows.
- Extended model evaluation using real network datasets.
- Production deployment and monitoring.
