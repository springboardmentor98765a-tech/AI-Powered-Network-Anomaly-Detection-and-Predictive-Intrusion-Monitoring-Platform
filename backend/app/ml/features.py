# NetShield AI — Feature list, dataset loaders and preprocessing
# Developed by Krish | SKK Projects
"""
A 'feature' is one measurable fact about a network flow (like duration or packet count).
Both CICIDS2017 and UNSW-NB15 use different column names, so we translate them
into ONE common format that the rest of the project understands.
"""
import numpy as np
import pandas as pd

FEATURES = [
    "duration", "fwd_packets", "bwd_packets", "fwd_bytes", "bwd_bytes",
    "flow_bytes_per_s", "flow_packets_per_s", "syn_count", "ack_count",
    "rst_count", "fin_count", "avg_packet_size", "dst_port", "protocol_num",
]

# Very large numbers (bytes per second etc.) are squashed with log so the model
# is not confused by huge values.
LOG_FEATURES = [
    "duration", "fwd_packets", "bwd_packets", "fwd_bytes", "bwd_bytes",
    "flow_bytes_per_s", "flow_packets_per_s", "syn_count", "ack_count",
]

ATTACK_CLASSES = ["BENIGN", "DDoS", "PortScan", "BruteForce", "WebAttack", "Botnet"]
PROTOCOL_NUM = {"TCP": 6, "UDP": 17, "ICMP": 1}
PROTOCOL_NAME = {v: k for k, v in PROTOCOL_NUM.items()}


# ---------------------------------------------------------------- CICIDS2017
CICIDS_COLUMNS = {
    "Flow Duration": "duration",
    "Total Fwd Packets": "fwd_packets",
    "Total Backward Packets": "bwd_packets",
    "Total Length of Fwd Packets": "fwd_bytes",
    "Total Length of Bwd Packets": "bwd_bytes",
    "Flow Bytes/s": "flow_bytes_per_s",
    "Flow Packets/s": "flow_packets_per_s",
    "SYN Flag Count": "syn_count",
    "ACK Flag Count": "ack_count",
    "RST Flag Count": "rst_count",
    "FIN Flag Count": "fin_count",
    "Average Packet Size": "avg_packet_size",
    "Destination Port": "dst_port",
    "Label": "label",
}


def map_cicids_label(label: str) -> str | None:
    label = str(label).strip()
    if label == "BENIGN":
        return "BENIGN"
    if label.startswith("DoS") or label == "DDoS":
        return "DDoS"
    if label == "PortScan":
        return "PortScan"
    if "Patator" in label:
        return "BruteForce"
    if label.startswith("Web Attack"):
        return "WebAttack"
    if label == "Bot":
        return "Botnet"
    return None  # rare classes (Infiltration, Heartbleed) are skipped


def load_cicids(path: str, max_rows: int | None = 200_000) -> pd.DataFrame:
    df = pd.read_csv(path, nrows=max_rows, low_memory=False)
    df.columns = df.columns.str.strip()  # CICIDS headers have extra spaces
    df = df[[c for c in CICIDS_COLUMNS if c in df.columns]].rename(columns=CICIDS_COLUMNS)
    df["duration"] = df["duration"] / 1_000_000  # microseconds -> seconds
    df["protocol_num"] = 6  # this CSV version has no protocol column; most traffic is TCP
    df["label"] = df["label"].map(map_cicids_label)
    return df.dropna(subset=["label"])


# ---------------------------------------------------------------- UNSW-NB15
UNSW_LABELS = {
    "Normal": "BENIGN", "DoS": "DDoS", "Reconnaissance": "PortScan",
    "Exploits": "WebAttack", "Backdoor": "Botnet", "Backdoors": "Botnet",
}


def load_unsw(path: str, max_rows: int | None = 200_000) -> pd.DataFrame:
    raw = pd.read_csv(path, nrows=max_rows, low_memory=False)
    raw.columns = raw.columns.str.strip()
    df = pd.DataFrame()
    df["duration"] = raw["dur"]
    df["fwd_packets"] = raw["spkts"]
    df["bwd_packets"] = raw["dpkts"]
    df["fwd_bytes"] = raw["sbytes"]
    df["bwd_bytes"] = raw["dbytes"]
    total_bytes = raw["sbytes"] + raw["dbytes"]
    total_pkts = (raw["spkts"] + raw["dpkts"]).clip(lower=1)
    df["flow_bytes_per_s"] = total_bytes / raw["dur"].clip(lower=1e-3)
    df["flow_packets_per_s"] = raw.get("rate", total_pkts / raw["dur"].clip(lower=1e-3))
    df["syn_count"] = (raw.get("synack", 0) > 0).astype(int)
    df["ack_count"] = (raw.get("ackdat", 0) > 0).astype(int)
    df["rst_count"] = (raw.get("state", "") == "RST").astype(int)
    df["fin_count"] = (raw.get("state", "") == "FIN").astype(int)
    df["avg_packet_size"] = total_bytes / total_pkts
    df["dst_port"] = 0  # the official train/test CSVs have no port column
    df["protocol_num"] = raw["proto"].str.upper().map(PROTOCOL_NUM).fillna(0)
    df["label"] = raw["attack_cat"].fillna("Normal").str.strip().map(UNSW_LABELS)
    return df.dropna(subset=["label"])


# ---------------------------------------------------------------- Cleaning
def clean_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Data cleaning: remove infinity, missing values, duplicates and negative numbers."""
    df = df.replace([np.inf, -np.inf], np.nan).dropna(subset=FEATURES)
    df = df.drop_duplicates()
    df[FEATURES] = df[FEATURES].clip(lower=0)
    return df.reset_index(drop=True)


def transform(df: pd.DataFrame) -> np.ndarray:
    """Turns the feature columns into the number grid the model sees (before scaling)."""
    x = df[FEATURES].astype(float).copy()
    for col in LOG_FEATURES:
        x[col] = np.log1p(x[col])
    return x.values


def flow_to_frame(flow: dict) -> pd.DataFrame:
    """Converts one flow (a Python dict) into a one-row table with the right columns."""
    row = {f: float(flow.get(f, 0) or 0) for f in FEATURES}
    if "protocol_num" not in flow:
        row["protocol_num"] = PROTOCOL_NUM.get(str(flow.get("protocol", "TCP")).upper(), 0)
    return pd.DataFrame([row])
