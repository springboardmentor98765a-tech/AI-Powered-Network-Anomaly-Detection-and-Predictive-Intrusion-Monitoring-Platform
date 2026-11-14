# NetShield AI — Synthetic traffic generator (CICIDS2017-style)
# Developed by Krish | SKK Projects
"""
Real datasets are several GB. So that the project runs on any laptop on day one,
this file creates realistic-looking fake traffic with the same features.
Each attack type has its own 'personality' (e.g. a port scan is tiny and fast,
a DDoS sends floods of small SYN packets).
When you download CICIDS2017 / UNSW-NB15, train on those instead (see train.py).
"""
import numpy as np
import pandas as pd

from app.ml.features import ATTACK_CLASSES, FEATURES

rng = np.random.default_rng()


def _finish(d: dict) -> dict:
    """Calculates the derived features (rates and averages) from the basic ones."""
    total_pkts = max(d["fwd_packets"] + d["bwd_packets"], 1)
    total_bytes = d["fwd_bytes"] + d["bwd_bytes"]
    dur = max(d["duration"], 1e-3)
    d["flow_bytes_per_s"] = total_bytes / dur
    d["flow_packets_per_s"] = total_pkts / dur
    d["avg_packet_size"] = total_bytes / total_pkts
    return d


def _benign() -> dict:
    port = int(rng.choice([80, 443, 53, 123, 8080, 22, 993], p=[.25, .45, .12, .04, .06, .04, .04]))
    proto = 17 if port in (53, 123) else 6
    fwd, bwd = int(rng.poisson(8)) + 1, int(rng.poisson(7)) + 1
    size = float(np.clip(rng.normal(520, 220), 60, 1500))
    return {
        "duration": float(rng.exponential(2.5)) + 0.01,
        "fwd_packets": fwd, "bwd_packets": bwd,
        "fwd_bytes": fwd * size * rng.uniform(.4, .9), "bwd_bytes": bwd * size * rng.uniform(.8, 1.4),
        "syn_count": 1 if proto == 6 else 0, "ack_count": fwd + bwd - 1 if proto == 6 else 0,
        "rst_count": int(rng.random() < .04), "fin_count": int(proto == 6 and rng.random() < .85),
        "dst_port": port, "protocol_num": proto,
    }


def _ddos() -> dict:
    fwd = int(rng.poisson(6)) + 2
    size = float(np.clip(rng.normal(70, 15), 40, 140))
    udp = rng.random() < .25
    return {
        "duration": float(rng.exponential(.3)) + 0.001,
        "fwd_packets": fwd, "bwd_packets": int(rng.poisson(.4)),
        "fwd_bytes": fwd * size, "bwd_bytes": float(rng.uniform(0, 60)),
        "syn_count": 0 if udp else fwd, "ack_count": int(rng.poisson(.3)),
        "rst_count": int(rng.random() < .2), "fin_count": 0,
        "dst_port": int(rng.choice([80, 443, 53])), "protocol_num": 17 if udp else 6,
    }


def _portscan() -> dict:
    bwd = int(rng.random() < .6)
    return {
        "duration": float(rng.uniform(.0005, .06)),
        "fwd_packets": int(rng.choice([1, 2], p=[.7, .3])), "bwd_packets": bwd,
        "fwd_bytes": float(rng.choice([0, 40, 44])), "bwd_bytes": float(bwd * rng.choice([0, 40])),
        "syn_count": 1, "ack_count": 0, "rst_count": bwd, "fin_count": 0,
        "dst_port": int(rng.integers(1, 65535)), "protocol_num": 6,
    }


def _bruteforce() -> dict:
    fwd, bwd = int(rng.poisson(22)) + 4, int(rng.poisson(20)) + 4
    return {
        "duration": float(rng.uniform(1.5, 9)),
        "fwd_packets": fwd, "bwd_packets": bwd,
        "fwd_bytes": fwd * float(np.clip(rng.normal(110, 30), 40, 300)),
        "bwd_bytes": bwd * float(np.clip(rng.normal(140, 35), 40, 300)),
        "syn_count": 1, "ack_count": fwd + bwd - 1, "rst_count": int(rng.random() < .3), "fin_count": 1,
        "dst_port": int(rng.choice([22, 21, 3389, 23], p=[.55, .2, .2, .05])), "protocol_num": 6,
    }


def _webattack() -> dict:
    fwd, bwd = int(rng.poisson(12)) + 3, int(rng.poisson(9)) + 2
    return {
        "duration": float(rng.uniform(.5, 6)),
        "fwd_packets": fwd, "bwd_packets": bwd,
        "fwd_bytes": fwd * float(np.clip(rng.normal(950, 250), 200, 1500)),
        "bwd_bytes": bwd * float(np.clip(rng.normal(350, 150), 60, 1500)),
        "syn_count": 1, "ack_count": fwd + bwd - 1, "rst_count": 0, "fin_count": 1,
        "dst_port": int(rng.choice([80, 443, 8080], p=[.5, .3, .2])), "protocol_num": 6,
    }


def _botnet() -> dict:
    fwd, bwd = int(rng.poisson(5)) + 2, int(rng.poisson(5)) + 2
    return {
        "duration": float(rng.uniform(25, 120)),
        "fwd_packets": fwd, "bwd_packets": bwd,
        "fwd_bytes": fwd * float(np.clip(rng.normal(210, 50), 60, 500)),
        "bwd_bytes": bwd * float(np.clip(rng.normal(190, 50), 60, 500)),
        "syn_count": 1, "ack_count": fwd + bwd - 1, "rst_count": 0, "fin_count": int(rng.random() < .5),
        "dst_port": int(rng.choice([8080, 6667, 4444, 1337, 443])), "protocol_num": 6,
    }


GENERATORS = {
    "BENIGN": _benign, "DDoS": _ddos, "PortScan": _portscan,
    "BruteForce": _bruteforce, "WebAttack": _webattack, "Botnet": _botnet,
}


def generate_flow(label: str | None = None, attack_ratio: float = 0.2) -> dict:
    """Creates ONE fake flow. If no label is given, ~80% are normal traffic."""
    if label is None:
        if rng.random() < attack_ratio:
            label = str(rng.choice(ATTACK_CLASSES[1:], p=[.3, .25, .2, .13, .12]))
        else:
            label = "BENIGN"
    flow = _finish(GENERATORS[label]())
    flow["label"] = label
    return flow


def generate_dataset(n: int = 30_000, attack_ratio: float = 0.35) -> pd.DataFrame:
    """Creates a whole training table of n flows."""
    rows = [generate_flow(attack_ratio=attack_ratio) for _ in range(n)]
    return pd.DataFrame(rows)[FEATURES + ["label"]]
