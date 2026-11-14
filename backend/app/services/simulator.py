# NetShield AI — Live network sensor (traffic simulator)
# Developed by Krish | SKK Projects
"""
In a real company, a sensor (Zeek, Wireshark/tshark, CICFlowMeter) watches the network
and reports flows. For the demo, this file pretends to be that sensor: every few
seconds it creates a small batch of flows (mostly normal, some attacks) and sends
them through the detection pipeline.
"""
import asyncio
import random
from datetime import timedelta

from app.database import SessionLocal, utcnow
from app.ml.features import PROTOCOL_NAME
from app.ml.synthetic import generate_flow
from app.services.pipeline import process_flow
from app.services.threat_intel import KNOWN_BAD_IPS

INTERNAL_SERVERS = ["10.0.1.10", "10.0.1.11", "10.0.1.20", "10.0.2.5", "10.0.2.8", "10.0.3.15"]
BAD_IPS = list(KNOWN_BAD_IPS)
OTHER_EXTERNAL = ["77.88.55.60", "212.47.230.9", "139.59.12.88", "41.215.240.3", "5.188.62.140"]


def make_live_flow(label: str | None = None) -> dict:
    flow = generate_flow(label)
    if flow["label"] == "BENIGN":
        flow["src_ip"] = f"192.168.1.{random.randint(2, 254)}"
    else:  # attackers come from outside; some are on the threat-intel list
        flow["src_ip"] = random.choice(BAD_IPS) if random.random() < 0.5 else random.choice(OTHER_EXTERNAL)
    flow["dst_ip"] = random.choice(INTERNAL_SERVERS)
    flow["src_port"] = random.randint(1024, 65535)
    flow["protocol"] = PROTOCOL_NAME.get(flow["protocol_num"], "OTHER")
    return flow


def seed_history(minutes: int = 120, flows: int = 600) -> None:
    """Fills the database with past traffic so charts are not empty on first start."""
    db = SessionLocal()
    try:
        now = utcnow()
        for _ in range(flows):
            flow = make_live_flow()
            flow["timestamp"] = now - timedelta(seconds=random.uniform(0, minutes * 60))
            process_flow(db, flow, source="sensor", commit=False)
        db.commit()
    finally:
        db.close()


async def run_simulator(interval: float) -> None:
    print(f"[sensor] live traffic simulator started (every {interval}s)")
    while True:
        try:
            await asyncio.to_thread(_one_batch)
        except Exception as exc:  # keep the sensor alive no matter what
            print(f"[sensor] error: {exc}")
        await asyncio.sleep(interval)


def _one_batch() -> None:
    db = SessionLocal()
    try:
        # Sometimes an 'attack burst' happens: several flows of the same attack together
        if random.random() < 0.15:
            label = random.choice(["DDoS", "PortScan", "BruteForce"])
            batch = [make_live_flow(label) for _ in range(random.randint(4, 8))]
            attacker, target = batch[0]["src_ip"], batch[0]["dst_ip"]
            for flow in batch:  # one attacker hitting one server, like a real burst
                flow["src_ip"], flow["dst_ip"] = attacker, target
        else:
            batch = [make_live_flow() for _ in range(random.randint(3, 7))]
        for flow in batch:
            process_flow(db, flow, source="sensor", commit=False)
        db.commit()
    finally:
        db.close()
