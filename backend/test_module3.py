import sys
from fastapi.testclient import TestClient
from app.main import app
from app.db.init_db import init_db

def run_module3_tests():
    print("=" * 60)
    print("RUNNING MODULE 3 (ANOMALY DETECTION) AUTOMATED TESTS")
    print("=" * 60)

    # Initialize tables and seed records
    init_db()

    with TestClient(app) as client:
        # Authenticate as Administrator
        res = client.post("/api/v1/auth/login", json={
            "username_or_email": "admin",
            "password": "Admin@NetShield2026!"
        })
        assert res.status_code == 200, f"Admin login failed: {res.text}"
        admin_token = res.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        # Authenticate as Security Analyst
        res = client.post("/api/v1/auth/login", json={
            "username_or_email": "analyst_alex",
            "password": "Analyst@NetShield2026!"
        })
        assert res.status_code == 200, f"Analyst login failed: {res.text}"
        analyst_token = res.json()["access_token"]
        analyst_headers = {"Authorization": f"Bearer {analyst_token}"}

        # Authenticate as Team Lead
        res = client.post("/api/v1/auth/login", json={
            "username_or_email": "lead_sarah",
            "password": "Lead@NetShield2026!"
        })
        assert res.status_code == 200, f"Team Lead login failed: {res.text}"
        lead_token = res.json()["access_token"]
        lead_headers = {"Authorization": f"Bearer {lead_token}"}

        # 1. Anomaly Overview Telemetry
        res = client.get("/api/v1/anomaly/overview", headers=admin_headers)
        assert res.status_code == 200, f"Overview failed: {res.text}"
        overview = res.json()
        assert overview["total_anomalies"] > 0
        assert overview["critical_threats"] > 0
        assert overview["mistakes_identified"] > 0
        assert overview["regular_patterns_count"] >= 10
        print(f"[PASS] 1. Overview Telemetry: Total={overview['total_anomalies']}, Critical={overview['critical_threats']}, Mistakes={overview['mistakes_identified']}, Patterns={overview['regular_patterns_count']}")

        # 2. Network Behavior Analysis (Tabular format with technical terms)
        res = client.get("/api/v1/anomaly/behavior", headers=admin_headers)
        assert res.status_code == 200, f"Behavior analysis failed: {res.text}"
        behavior_list = res.json()
        assert len(behavior_list) >= 8
        metric_names = [m["metric_name"] for m in behavior_list]
        assert "Packet Inter-Arrival Time (IAT)" in metric_names
        assert "TCP SYN-to-ACK Asymmetry" in metric_names
        assert "Shannon Port Entropy" in metric_names
        sample_metric = behavior_list[0]
        assert "z_score" in sample_metric and "volatility" in sample_metric and "status" in sample_metric
        print(f"[PASS] 2. Network Behavior Analysis (Tabular): Verified {len(behavior_list)} technical metrics (IAT, SYN:ACK asymmetry, Shannon entropy, Z-scores)")

        # 3. Suspicious Activity Detection: New Unrecognized IPs & Clearance Violations
        res = client.get("/api/v1/anomaly/suspicious", headers=analyst_headers)
        assert res.status_code == 200, f"Suspicious activities query failed: {res.text}"
        suspicious_list = res.json()
        assert len(suspicious_list) >= 5

        # Verify New IP detection
        new_ips = [s for s in suspicious_list if s["activity_type"] == "NEW_UNRECOGNIZED_IP"]
        assert len(new_ips) > 0
        assert any(s["source_ip"] == "198.51.100.44" for s in new_ips)

        # Verify Unauthorized Clearance Access detection
        clearance_violations = [s for s in suspicious_list if s["activity_type"] == "UNAUTHORIZED_CLEARANCE_ACCESS"]
        assert len(clearance_violations) > 0
        assert any("Tier 3" in s["required_clearance"] for s in clearance_violations)
        print(f"[PASS] 3. Suspicious Activity Detection: Detected {len(new_ips)} New Unrecognized IPs and {len(clearance_violations)} Clearance Violations")

        # 4. Analyst Feature: Report Suspicious Activity to Team Lead
        target_activity = next((s for s in suspicious_list if s["status"] == "DETECTED"), suspicious_list[0])
        report_payload = {
            "analyst_notes": "Identified anomalous connection attempts from external subnet. Requesting Team Lead review for perimeter blocking."
        }
        res = client.post(
            f"/api/v1/anomaly/suspicious/{target_activity['id']}/report",
            headers=analyst_headers,
            json=report_payload
        )
        assert res.status_code == 200, f"Analyst report failed: {res.text}"
        reported_record = res.json()
        assert reported_record["status"] == "REPORTED_TO_LEAD"
        assert reported_record["analyst_notes"] == report_payload["analyst_notes"]
        assert reported_record["reported_by_name"] is not None
        print(f"[PASS] 4. Analyst Workflow: Successfully reported activity #{target_activity['id']} to Team Lead with technical justification")

        # 5. RBAC Restriction: Security Analyst blocked (403) from taking action or dismissing alert
        resolve_payload = {
            "action": "BLOCKED_IP",
            "resolution_notes": "Attempting unauthorized resolution as analyst"
        }
        res = client.post(
            f"/api/v1/anomaly/suspicious/{target_activity['id']}/resolve",
            headers=analyst_headers,
            json=resolve_payload
        )
        assert res.status_code == 403, "Analyst should be blocked from resolving activity alerts"
        print("[PASS] 5. RBAC Restriction: Security Analyst strictly blocked (403 Forbidden) from resolving alerts")

        # 6. Team Lead Workflow: Take Action on Suspicious Activity
        lead_action_payload = {
            "action": "BLOCKED_IP",
            "resolution_notes": "Confirmed malicious port probing behavior. Blocked IP at edge border firewall."
        }
        res = client.post(
            f"/api/v1/anomaly/suspicious/{target_activity['id']}/resolve",
            headers=lead_headers,
            json=lead_action_payload
        )
        assert res.status_code == 200, f"Team Lead action failed: {res.text}"
        acted_record = res.json()
        assert acted_record["status"] == "ACTION_TAKEN"
        assert acted_record["resolution_action"] == "BLOCKED_IP"
        assert acted_record["resolved_by_name"] is not None
        print(f"[PASS] 6. Team Lead Workflow: Successfully executed 'Take Action' (BLOCKED_IP) on activity #{target_activity['id']}")

        # 7. Team Lead Workflow: Dismiss Alert
        dismiss_target = next((s for s in suspicious_list if s["id"] != target_activity["id"]), suspicious_list[-1])
        lead_dismiss_payload = {
            "action": "DISMISSED_AUTHORIZED",
            "resolution_notes": "Reviewed host activity with network engineering. Confirmed scheduled deployment testing."
        }
        res = client.post(
            f"/api/v1/anomaly/suspicious/{dismiss_target['id']}/resolve",
            headers=lead_headers,
            json=lead_dismiss_payload
        )
        assert res.status_code == 200, f"Team Lead dismiss failed: {res.text}"
        dismissed_record = res.json()
        assert dismissed_record["status"] == "DISMISSED"
        assert dismissed_record["resolution_action"] == "DISMISSED_AUTHORIZED"
        print(f"[PASS] 7. Team Lead Workflow: Successfully executed 'Dismiss Alert' (DISMISSED_AUTHORIZED) on activity #{dismiss_target['id']}")

        # 8. Pattern Recognition: Regularly Used IPs & Regular Packet Transfers
        res = client.get("/api/v1/anomaly/patterns", headers=analyst_headers)
        assert res.status_code == 200, f"Patterns query failed: {res.text}"
        patterns = res.json()
        regular_ips = [p for p in patterns if p["pattern_type"] == "REGULAR_IP"]
        scheduled_transfers = [p for p in patterns if p["pattern_type"] == "SCHEDULED_TRANSFER"]
        assert len(regular_ips) >= 5
        assert len(scheduled_transfers) >= 5
        assert any(p["source_ip"] == "10.0.0.1" for p in regular_ips)
        assert any("NTP" in p["name"] for p in scheduled_transfers)
        print(f"[PASS] 8. Pattern Recognition: Baselined {len(regular_ips)} Regularly Used IPs and {len(scheduled_transfers)} Regular Packet Transfers")

        # 9. Anomaly Classification: Dangerous Attacks vs Operational Mistakes
        res = client.get("/api/v1/anomaly/classifications", headers=analyst_headers)
        assert res.status_code == 200, f"Classifications query failed: {res.text}"
        classifications = res.json()
        assert len(classifications) >= 6

        dangerous_attacks = [c for c in classifications if not c["is_mistake"]]
        operational_mistakes = [c for c in classifications if c["is_mistake"]]
        assert len(dangerous_attacks) >= 3
        assert len(operational_mistakes) >= 3

        # Verify critical dangerous attack
        syn_flood = next(c for c in dangerous_attacks if "SYN Flood" in c["threat_signature"])
        assert syn_flood["risk_level"] == "CRITICAL"
        assert "T1498" in syn_flood["vector_identifier"]

        # Verify operational mistake (not an attack)
        cert_mistake = next(c for c in operational_mistakes if "Certificate" in c["threat_signature"])
        assert cert_mistake["is_mistake"] is True
        assert cert_mistake["risk_level"] in ["LOW", "MEDIUM"]
        print(f"[PASS] 9. Anomaly Classification: Classified {len(dangerous_attacks)} Dangerous Attacks and {len(operational_mistakes)} Operational Mistakes")

        # 10. Audit Logging Verification
        res = client.get("/api/v1/audit?target_type=SUSPICIOUS_ACTIVITY", headers=admin_headers)
        assert res.status_code == 200, f"Audit logs query failed: {res.text}"
        audit_data = res.json()
        assert len(audit_data) > 0
        print(f"[PASS] 10. Audit Logging: Verified {len(audit_data)} immutable audit records logged for anomaly detection and team lead actions")

    print("=" * 60)
    print("ALL 10 MODULE 3 (ANOMALY DETECTION) TESTS PASSED!")
    print("=" * 60)

if __name__ == "__main__":
    run_module3_tests()
