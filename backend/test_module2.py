import sys
import io
from fastapi.testclient import TestClient
from app.main import app
from app.db.init_db import init_db

def run_module2_tests():
    print("=" * 60)
    print("RUNNING MODULE 2 (NETWORK MONITORING) AUTOMATED TESTS")
    print("=" * 60)

    # Initialize tables
    init_db()

    with TestClient(app) as client:
        # Authenticate
        res = client.post("/api/v1/auth/login", json={
            "username_or_email": "admin",
            "password": "Admin@NetShield2026!"
        })
        assert res.status_code == 200, f"Login failed: {res.text}"
        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Traffic Overview (Packets & Bytes Calculation)
        res = client.get("/api/v1/traffic/overview", headers=headers)
        assert res.status_code == 200, f"Overview failed: {res.text}"
        data = res.json()
        assert data["total_packets"] > 0
        assert data["total_bytes"] > 0
        assert "formatted_bytes" in data
        assert data["active_connections"] > 0
        print(f"[PASS] 1. Traffic Overview: {data['total_packets']} packets, {data['formatted_bytes']}, {data['active_connections']} connections")

        # 2. Traffic Direction Determination (Inbound / Outbound / Internal)
        dir_stats = data["direction_stats"]
        assert "inbound_packets" in dir_stats
        assert "outbound_packets" in dir_stats
        assert "internal_packets" in dir_stats
        assert dir_stats["inbound_packets"] + dir_stats["outbound_packets"] + dir_stats["internal_packets"] == data["total_packets"]
        print(f"[PASS] 2. Directional Flow: Inbound={dir_stats['inbound_packets']}, Outbound={dir_stats['outbound_packets']}, Internal={dir_stats['internal_packets']}")

        # 3. Top Active Talkers (Source and Destination IPs)
        top_src = data["top_sources"]
        top_dst = data["top_destinations"]
        assert len(top_src) > 0
        assert len(top_dst) > 0
        assert "ip" in top_src[0] and "packets" in top_src[0] and "bytes" in top_src[0]
        print(f"[PASS] 3. Top Talkers identified: Top Source={top_src[0]['ip']} ({top_src[0]['packets']} pkts), Top Dest={top_dst[0]['ip']} ({top_dst[0]['packets']} pkts)")

        # 4. Traffic Activity Over Time
        ts = data["time_series"]
        assert len(ts) > 0
        assert "time" in ts[0] and "packets" in ts[0] and "bytes" in ts[0]
        print(f"[PASS] 4. Traffic Activity over time: {len(ts)} time intervals calculated")

        # 5. Protocol Analysis (TCP, UDP, HTTP, HTTPS, DNS, ICMP, ARP, OTHER)
        res = client.get("/api/v1/traffic/protocols", headers=headers)
        assert res.status_code == 200
        proto_data = res.json()
        protocols_detected = [p["protocol"] for p in proto_data["protocols"]]
        for expected in ["TCP", "UDP", "HTTPS", "HTTP", "DNS", "ICMP", "ARP"]:
            assert expected in protocols_detected, f"Protocol {expected} not detected"
        assert proto_data["tcp_count"] > 0
        assert proto_data["udp_count"] > 0
        assert "tcp_vs_udp_ratio" in proto_data
        print(f"[PASS] 5. Protocol Analysis: Identified {len(protocols_detected)} protocols, TCP:UDP ratio={proto_data['tcp_vs_udp_ratio']}")

        # 6. Filter by Protocol (e.g. DNS)
        res = client.get("/api/v1/traffic/packets?protocol=DNS", headers=headers)
        assert res.status_code == 200
        dns_packets = res.json()["packets"]
        assert len(dns_packets) > 0
        assert all(p["protocol"] == "DNS" for p in dns_packets)
        print(f"[PASS] 6. Protocol Filter: Successfully filtered {len(dns_packets)} DNS packets")

        # 7. Filter by IP Address
        test_ip = top_src[0]["ip"]
        res = client.get(f"/api/v1/traffic/packets?src_ip={test_ip}", headers=headers)
        assert res.status_code == 200
        ip_packets = res.json()["packets"]
        assert len(ip_packets) > 0
        assert all(p["src_ip"] == test_ip for p in ip_packets)
        print(f"[PASS] 7. IP Address Filter: Filtered {len(ip_packets)} packets from {test_ip}")

        # 8. Filter by Port (e.g. 53 or 443)
        res = client.get("/api/v1/traffic/packets?port=53", headers=headers)
        assert res.status_code == 200
        port_packets = res.json()["packets"]
        assert len(port_packets) > 0
        assert all(p["src_port"] == 53 or p["dst_port"] == 53 for p in port_packets)
        print(f"[PASS] 8. Port Filter: Filtered {len(port_packets)} packets on Port 53")

        # 9. Filter by Direction (e.g. INBOUND)
        res = client.get("/api/v1/traffic/packets?direction=INBOUND", headers=headers)
        assert res.status_code == 200
        inbound_pkts = res.json()["packets"]
        assert len(inbound_pkts) > 0
        assert all(p["direction"] == "INBOUND" for p in inbound_pkts)
        print(f"[PASS] 9. Direction Filter: Filtered {len(inbound_pkts)} INBOUND packets")

        # 10. Generate Fresh Packet Trace
        res = client.post("/api/v1/traffic/generate-sample?count=100", headers=headers)
        assert res.status_code == 200
        assert res.json()["packets_generated"] == 100
        print("[PASS] 10. Packet Collection: Generated 100 fresh realistic network packets")

        print("=" * 60)
        print("ALL 10 MODULE 2 (NETWORK MONITORING) TESTS PASSED!")
        print("=" * 60)

if __name__ == "__main__":
    run_module2_tests()
