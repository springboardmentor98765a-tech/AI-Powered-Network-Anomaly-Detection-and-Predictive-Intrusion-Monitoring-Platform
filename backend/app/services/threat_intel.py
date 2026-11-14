# NetShield AI — Threat intelligence (IP reputation)
# Developed by Krish | SKK Projects
"""
In real SOCs, 'threat intelligence feeds' are lists of IP addresses known to be bad.
Here we keep a small local feed. You can extend lookup() to call a real API
(for example AbuseIPDB or AlienVault OTX) using your own API key.
"""
KNOWN_BAD_IPS = {
    "185.220.101.34": {"tag": "Tor exit node", "country": "DE"},
    "45.155.205.233": {"tag": "Known scanner", "country": "RU"},
    "103.75.201.4": {"tag": "Brute-force source", "country": "CN"},
    "91.240.118.172": {"tag": "Botnet C2", "country": "NL"},
    "198.51.100.66": {"tag": "DDoS participant", "country": "US"},
    "203.0.113.45": {"tag": "Web exploit kit", "country": "BR"},
}


def lookup(ip: str) -> dict | None:
    """Returns reputation info if the IP is on our bad list, otherwise None."""
    return KNOWN_BAD_IPS.get(ip)


def is_internal(ip: str) -> bool:
    return ip.startswith(("10.", "192.168.", "172.16."))
