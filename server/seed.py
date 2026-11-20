# server/seed.py
from datetime import datetime, timedelta
from app.database import Base, SessionLocal, engine
from app.models import NetworkFlow, Role, User
from app.security import hash_password

# Ensure all tables (including network_flows) exist before seeding
Base.metadata.create_all(bind=engine)

db = SessionLocal()

print("🌱 Starting database seeding...")

# 1. Ensure Roles Exist
roles_data = [
    ("Administrator", "Manage users, roles, teams, and platform settings; view audit logs."),
    ("Security Analyst", "Use security monitoring and investigation features assigned to them."),
    ("Team Lead", "View team activity and oversee assigned analysts."),
]

for name, desc in roles_data:
    existing_role = db.query(Role).filter(Role.role_name == name).first()
    if not existing_role:
        db.add(Role(role_name=name, description=desc))
db.commit()

# Fetch role references
admin_role = db.query(Role).filter(Role.role_name == "Administrator").first()
lead_role = db.query(Role).filter(Role.role_name == "Team Lead").first()
analyst_role = db.query(Role).filter(Role.role_name == "Security Analyst").first()

# 2. Define Users to Create
users_to_create = [
    # 1 Admin
    {
        "name": "System Administrator",
        "email": "admin@netshield.ai",
        "password": "AdminSecure123!",
        "role": admin_role,
    },
    # 2 Managers (Team Leads)
    {
        "name": "Alice Manager",
        "email": "alice.lead@netshield.ai",
        "password": "LeadPassword123!",
        "role": lead_role,
    },
    {
        "name": "Bob Manager",
        "email": "bob.lead@netshield.ai",
        "password": "LeadPassword123!",
        "role": lead_role,
    },
    # 5 Analysts
    {
        "name": "Analyst Charlie",
        "email": "charlie@netshield.ai",
        "password": "AnalystPassword123!",
        "role": analyst_role,
    },
    {
        "name": "Analyst Diana",
        "email": "diana@netshield.ai",
        "password": "AnalystPassword123!",
        "role": analyst_role,
    },
    {
        "name": "Analyst Ethan",
        "email": "ethan@netshield.ai",
        "password": "AnalystPassword123!",
        "role": analyst_role,
    },
    {
        "name": "Analyst Fiona",
        "email": "fiona@netshield.ai",
        "password": "AnalystPassword123!",
        "role": analyst_role,
    },
    {
        "name": "Analyst George",
        "email": "george@netshield.ai",
        "password": "AnalystPassword123!",
        "role": analyst_role,
    },
]

# Seed Users
for u_data in users_to_create:
    existing_user = db.query(User).filter(User.email == u_data["email"]).first()
    if not existing_user:
        new_user = User(
            name=u_data["name"],
            email=u_data["email"],
            password_hash=hash_password(u_data["password"]),
            status="active",
        )
        new_user.roles.append(u_data["role"])
        db.add(new_user)
        print(f"Created user: {u_data['email']} ({u_data['role'].role_name})")
    else:
        print(f"User already exists: {u_data['email']}")

db.commit()

# 3. Seed Initial Network Flows (Module 2 Telemetry)
if db.query(NetworkFlow).count() == 0:
    now = datetime.utcnow()
    sample_flows = [
        # OUTBOUND HTTPS
        NetworkFlow(
            timestamp=now - timedelta(minutes=25),
            source_ip="192.168.1.15",
            destination_ip="104.21.44.12",
            source_port=51422,
            destination_port=443,
            protocol="HTTPS",
            packet_length=1480,
            flow_duration=34.5,
            flag="ACK",
            status="NORMAL",
        ),
        # INBOUND SUSPICIOUS TCP (SSH)
        NetworkFlow(
            timestamp=now - timedelta(minutes=20),
            source_ip="185.220.101.4",
            destination_ip="192.168.1.22",
            source_port=49152,
            destination_port=22,
            protocol="TCP",
            packet_length=8450,
            flow_duration=910.2,
            flag="SYN",
            status="SUSPICIOUS",
        ),
        # OUTBOUND DNS
        NetworkFlow(
            timestamp=now - timedelta(minutes=15),
            source_ip="192.168.1.10",
            destination_ip="8.8.8.8",
            source_port=60112,
            destination_port=53,
            protocol="DNS",
            packet_length=196,
            flow_duration=12.1,
            flag="ACK",
            status="NORMAL",
        ),
        # OUTBOUND UDP
        NetworkFlow(
            timestamp=now - timedelta(minutes=12),
            source_ip="192.168.1.15",
            destination_ip="172.217.16.14",
            source_port=53810,
            destination_port=8443,
            protocol="UDP",
            packet_length=2640,
            flow_duration=48.0,
            flag="PSH",
            status="NORMAL",
        ),
        # OUTBOUND HTTP
        NetworkFlow(
            timestamp=now - timedelta(minutes=10),
            source_ip="192.168.1.18",
            destination_ip="45.33.32.156",
            source_port=49880,
            destination_port=80,
            protocol="HTTP",
            packet_length=920,
            flow_duration=27.4,
            flag="ACK",
            status="NORMAL",
        ),
        # OUTBOUND ICMP
        NetworkFlow(
            timestamp=now - timedelta(minutes=7),
            source_ip="192.168.1.10",
            destination_ip="1.1.1.1",
            source_port=0,
            destination_port=0,
            protocol="ICMP",
            packet_length=84,
            flow_duration=9.8,
            flag="ECHO",
            status="NORMAL",
        ),
        # INTERNAL ARP
        NetworkFlow(
            timestamp=now - timedelta(minutes=4),
            source_ip="192.168.1.1",
            destination_ip="192.168.1.15",
            source_port=0,
            destination_port=0,
            protocol="ARP",
            packet_length=60,
            flow_duration=1.5,
            flag="ARP",
            status="NORMAL",
        ),
        # UNKNOWN / UNCLASSIFIED PROTOCOL
        NetworkFlow(
            timestamp=now - timedelta(minutes=1),
            source_ip="192.168.1.22",
            destination_ip="104.21.44.12",
            source_port=55201,
            destination_port=9999,
            protocol="UNKNOWN",
            packet_length=4120,
            flow_duration=315.6,
            flag="RST",
            status="SUSPICIOUS",
        ),
    ]
    db.add_all(sample_flows)
    db.commit()
    print(f"🌱 Seeded {len(sample_flows)} initial network flow records.")

db.close()
print("✅ Seeding completed successfully!")