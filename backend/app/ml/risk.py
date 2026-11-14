# NetShield AI — Risk scoring engine
# Developed by Krish | SKK Projects
"""
Turns AI outputs into ONE number from 0 to 100, like marks out of 100 for 'danger'.
  - How dangerous is this attack type?          (severity weight)
  - How sure is the model that it's an attack?  (attack probability)
  - How strange does the traffic look?          (anomaly score)
  - Is an important server/port being targeted? (asset criticality)
  - Is the source IP on a known-bad list?       (threat intelligence)
"""
SEVERITY_WEIGHT = {
    "BENIGN": 0, "PortScan": 45, "BruteForce": 70, "WebAttack": 75, "Botnet": 80, "DDoS": 90,
}
# Ports of important services (SSH, RDP, SMB, databases...)
CRITICAL_PORTS = {21, 22, 23, 445, 1433, 3306, 3389, 5432, 6379, 27017}


def risk_level(score: int) -> str:
    if score >= 75:
        return "Critical"
    if score >= 50:
        return "High"
    if score >= 25:
        return "Medium"
    return "Low"


def compute_risk(prediction: dict, dst_port: int = 0, threat_intel_hit: bool = False) -> dict:
    attack = prediction["predicted_attack"]
    prob = prediction["attack_probability"]
    anomaly = prediction["anomaly_score"]
    critical = 1.0 if int(dst_port or 0) in CRITICAL_PORTS else 0.0

    if attack != "BENIGN":
        score = 0.65 * SEVERITY_WEIGHT.get(attack, 60) * prob + 25 * anomaly + 10 * critical
    else:
        # Looks normal to the classifier, but the anomaly detector may still be suspicious
        score = 40 * anomaly * (1 if prediction["is_anomaly"] else 0.5) + 5 * critical
    if threat_intel_hit:
        score += 15

    score = int(max(0, min(100, round(score))))
    return {"risk_score": score, "risk_level": risk_level(score)}
