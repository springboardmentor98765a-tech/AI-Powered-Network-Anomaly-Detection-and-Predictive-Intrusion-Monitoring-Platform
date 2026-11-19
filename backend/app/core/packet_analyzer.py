import logging
logging.getLogger("scapy.runtime").setLevel(logging.ERROR)
import ipaddress
import random
from datetime import datetime, timezone, timedelta
from typing import BinaryIO
import scapy.all as scapy

def format_bytes(bytes_count: int) -> str:
    if bytes_count >= 1024 ** 4:
        return f"{bytes_count / (1024 ** 4):.2f} TB"
    elif bytes_count >= 1024 ** 3:
        return f"{bytes_count / (1024 ** 3):.2f} GB"
    elif bytes_count >= 1024 ** 2:
        return f"{bytes_count / (1024 ** 2):.2f} MB"
    elif bytes_count >= 1024:
        return f"{bytes_count / 1024:.2f} KB"
    else:
        return f"{bytes_count} B"

def is_private_ip(ip_str: str) -> bool:
    try:
        ip = ipaddress.ip_address(ip_str)
        return ip.is_private or ip.is_loopback or ip.is_link_local
    except ValueError:
        return False

def determine_direction(src_ip: str, dst_ip: str) -> str:
    src_private = is_private_ip(src_ip)
    dst_private = is_private_ip(dst_ip)

    if src_private and dst_private:
        return "INTERNAL"
    elif src_private and not dst_private:
        return "OUTBOUND"
    elif not src_private and dst_private:
        return "INBOUND"
    else:
        return "INTERNAL"

def parse_pcap_stream(file_stream: BinaryIO, max_packets: int = 5000) -> list[dict]:
    """
    Parses a PCAP file stream into standardized packet dictionaries.
    """
    packets_data = []
    try:
        reader = scapy.PcapReader(file_stream)
        count = 0
        for pkt in reader:
            parsed = parse_single_scapy_packet(pkt)
            if parsed:
                packets_data.append(parsed)
                count += 1
                if count >= max_packets:
                    break
        reader.close()
    except Exception as e:
        print(f"[ERROR] Error reading PCAP: {e}")
    return packets_data

def parse_single_scapy_packet(pkt) -> dict | None:
    try:
        pkt_len = len(pkt)
        pkt_time = getattr(pkt, "time", None)
        if pkt_time is not None:
            ts = datetime.fromtimestamp(float(pkt_time), tz=timezone.utc)
        else:
            ts = datetime.now(timezone.utc)

        src_ip = "0.0.0.0"
        dst_ip = "0.0.0.0"
        src_port = None
        dst_port = None
        protocol = "OTHER"
        flags = None
        info = ""

        # Check ARP
        if pkt.haslayer(scapy.ARP):
            arp = pkt[scapy.ARP]
            src_ip = arp.psrc
            dst_ip = arp.pdst
            protocol = "ARP"
            op = "Who has" if arp.op == 1 else "Reply at"
            info = f"ARP {op} {dst_ip}"
            direction = "INTERNAL"
            return {
                "timestamp": ts,
                "src_ip": src_ip,
                "src_port": None,
                "dst_ip": dst_ip,
                "dst_port": None,
                "protocol": protocol,
                "packet_length": pkt_len,
                "direction": direction,
                "flags": None,
                "info": info,
            }

        # Check IP / IPv6
        if pkt.haslayer(scapy.IP):
            ip_layer = pkt[scapy.IP]
            src_ip = ip_layer.src
            dst_ip = ip_layer.dst
        elif pkt.haslayer(scapy.IPv6):
            ip_layer = pkt[scapy.IPv6]
            src_ip = ip_layer.src
            dst_ip = ip_layer.dst
        else:
            # Non-IP packet
            return None

        # Check Transport Protocols
        if pkt.haslayer(scapy.TCP):
            tcp = pkt[scapy.TCP]
            src_port = tcp.sport
            dst_port = tcp.dport
            flags = str(tcp.flags)
            protocol = "TCP"

            # Check Application Layer by Port or payload
            if src_port == 443 or dst_port == 443:
                protocol = "HTTPS"
                info = f"TLS Application Data [{src_port} -> {dst_port}]"
            elif src_port == 80 or dst_port == 80 or src_port == 8080 or dst_port == 8080:
                protocol = "HTTP"
                info = f"HTTP Traffic [{src_port} -> {dst_port}]"
            elif src_port == 53 or dst_port == 53:
                protocol = "DNS"
                info = f"DNS over TCP [{src_port} -> {dst_port}]"
            elif src_port == 22 or dst_port == 22:
                protocol = "SSH"
                info = f"SSH Remote Session [{src_port} -> {dst_port}]"
            else:
                info = f"TCP Seq={tcp.seq} Flags=[{flags}]"

        elif pkt.haslayer(scapy.UDP):
            udp = pkt[scapy.UDP]
            src_port = udp.sport
            dst_port = udp.dport
            protocol = "UDP"

            if src_port == 53 or dst_port == 53:
                protocol = "DNS"
                if pkt.haslayer(scapy.DNS):
                    dns = pkt[scapy.DNS]
                    if dns.qr == 0 and dns.qd:
                        qname = dns.qd.qname.decode("utf-8", errors="ignore").rstrip(".")
                        info = f"Standard query A {qname}"
                    elif dns.qr == 1:
                        info = f"Standard query response ({len(dns.an)} answers)"
                    else:
                        info = "DNS Query/Response"
                else:
                    info = f"DNS UDP Port 53 [{src_port} -> {dst_port}]"
            elif src_port in (67, 68) or dst_port in (67, 68):
                protocol = "DHCP"
                info = f"DHCP Configuration [{src_port} -> {dst_port}]"
            elif src_port == 123 or dst_port == 123:
                protocol = "NTP"
                info = f"Network Time Protocol [{src_port} -> {dst_port}]"
            else:
                info = f"UDP Datagram Len={udp.len} [{src_port} -> {dst_port}]"

        elif pkt.haslayer(scapy.ICMP):
            icmp = pkt[scapy.ICMP]
            protocol = "ICMP"
            type_desc = "Echo Request" if icmp.type == 8 else "Echo Reply" if icmp.type == 0 else f"Type {icmp.type}"
            info = f"ICMP {type_desc} id={getattr(icmp, 'id', 0)} seq={getattr(icmp, 'seq', 0)}"

        else:
            # Unknown / Unclassified Protocol
            protocol = "OTHER"
            info = f"IP Proto={getattr(ip_layer, 'proto', 'Unknown')}"

        direction = determine_direction(src_ip, dst_ip)

        return {
            "timestamp": ts,
            "src_ip": src_ip,
            "src_port": src_port,
            "dst_ip": dst_ip,
            "dst_port": dst_port,
            "protocol": protocol,
            "packet_length": pkt_len,
            "direction": direction,
            "flags": flags,
            "info": info,
        }
    except Exception as e:
        return None

def generate_sample_traffic(count: int = 400) -> list[dict]:
    """
    Generates realistic, representative network packets matching mentor's requirements:
    - Protocols: TCP, UDP, HTTP, HTTPS, DNS, ICMP, ARP, UNKNOWN
    - Direction: Inbound, Outbound, Internal
    - Top active talkers & servers
    - Realistic timestamps spanning the past 30 minutes
    """
    now = datetime.now(timezone.utc)
    packets = []

    # Host definitions
    internal_workstations = [
        "192.168.1.105", # Alex
        "192.168.1.110", # Sarah
        "192.168.1.115", # Priya
        "192.168.1.120", # Dev workstation
        "192.168.1.140", # Admin host
    ]
    internal_servers = [
        "10.0.0.5",  # Core Domain Controller / DNS
        "10.0.0.8",  # Internal Web App / SQL
        "10.0.0.12", # File Server (SMB)
        "10.0.0.15", # Database Server
        "10.0.0.20", # Gateway / Firewall
    ]
    external_servers = [
        "142.250.190.46", # Google Search / API
        "104.244.42.1",   # Cloud CDN
        "151.101.1.69",   # Cloudflare Edge
        "185.199.108.153",# GitHub API
        "45.33.32.156",   # Suspicious Scanner (Port Scan / Anomaly)
        "198.51.100.24",  # Threat Intelligence Sinkhole
    ]
    dns_domains = [
        "api.github.com",
        "clients.google.com",
        "auth.netshield.ai",
        "corp.internal.local",
        "update.microsoft.com",
        "cdn.cloudflare.net",
        "telemetry.suspicious-domain.xyz",
    ]

    for i in range(count):
        # Time distribution across past 20 minutes
        offset_seconds = random.randint(0, 1200)
        pkt_time = now - timedelta(seconds=1200 - offset_seconds)

        proto_choice = random.choices(
            ["HTTPS", "TCP", "DNS", "HTTP", "ICMP", "ARP", "UDP", "OTHER"],
            weights=[38, 22, 14, 10, 6, 5, 4, 1],
            k=1
        )[0]

        if proto_choice == "ARP":
            src_ip = random.choice(internal_workstations)
            dst_ip = "192.168.1.1" # Gateway
            src_port = None
            dst_port = None
            pkt_len = 64
            direction = "INTERNAL"
            flags = None
            info = f"Who has {dst_ip}? Tell {src_ip}"

        elif proto_choice == "ICMP":
            src_ip = random.choice(internal_workstations)
            dst_ip = random.choice(["10.0.0.20", "8.8.8.8", "1.1.1.1"])
            src_port = None
            dst_port = None
            pkt_len = random.choice([64, 84, 98])
            direction = determine_direction(src_ip, dst_ip)
            flags = None
            seq_num = random.randint(1, 100)
            info = f"Echo Request (ping) id=0x{random.randint(1000, 9999):x} seq={seq_num}"

        elif proto_choice == "DNS":
            src_ip = random.choice(internal_workstations)
            dst_ip = "10.0.0.5" # Internal DNS Server
            src_port = random.randint(49152, 65535)
            dst_port = 53
            pkt_len = random.randint(72, 180)
            direction = "INTERNAL"
            flags = None
            domain = random.choice(dns_domains)
            info = f"Standard query 0x{random.randint(1000, 9999):x} A {domain}"

        elif proto_choice == "HTTP":
            src_ip = random.choice(internal_workstations)
            dst_ip = random.choice(["10.0.0.8", "192.168.1.105", random.choice(external_servers)])
            src_port = random.randint(49152, 65535)
            dst_port = 80
            pkt_len = random.randint(250, 1460)
            direction = determine_direction(src_ip, dst_ip)
            flags = "PSH, ACK"
            endpoints = ["/api/v1/health", "/login", "/static/app.js", "/index.html", "/auth/session"]
            info = f"GET {random.choice(endpoints)} HTTP/1.1 [200 OK]"

        elif proto_choice == "HTTPS":
            src_ip = random.choice(internal_workstations)
            dst_ip = random.choice(external_servers)
            src_port = random.randint(49152, 65535)
            dst_port = 443
            pkt_len = random.randint(80, 1500)
            direction = "OUTBOUND"
            flags = random.choice(["ACK", "PSH, ACK", "SYN"])
            info = f"TLSv1.3 Application Data [{src_port} -> 443] Len={pkt_len}"

        elif proto_choice == "TCP":
            # Realistic TCP handshake / sync / teardown or scanner traffic
            is_scan = random.random() < 0.15
            if is_scan:
                src_ip = "45.33.32.156" # Scanner IP
                dst_ip = random.choice(internal_servers)
                src_port = random.randint(10000, 60000)
                dst_port = random.choice([21, 22, 23, 80, 443, 1433, 3306, 8080])
                pkt_len = 60
                direction = "INBOUND"
                flags = "SYN"
                info = f"TCP SYN Stealth Probe [{src_port} -> {dst_port}]"
            else:
                src_ip = random.choice(internal_workstations)
                dst_ip = random.choice(internal_servers)
                src_port = random.randint(49152, 65535)
                dst_port = random.choice([3306, 5432, 8000, 445])
                pkt_len = random.randint(64, 1420)
                direction = "INTERNAL"
                flags = random.choice(["SYN, ACK", "ACK", "PSH, ACK", "FIN, ACK"])
                info = f"TCP Connection [{src_port} -> {dst_port}] Seq={random.randint(10000, 99999)}"

        elif proto_choice == "UDP":
            src_ip = random.choice(internal_workstations)
            dst_ip = "10.0.0.5"
            src_port = random.randint(49152, 65535)
            dst_port = 123
            pkt_len = 76
            direction = "INTERNAL"
            flags = None
            info = f"NTP Client Request [{src_port} -> 123]"

        else: # OTHER / UNCLASSIFIED
            src_ip = "192.168.1.140"
            dst_ip = "224.0.0.251" # Multicast
            src_port = None
            dst_port = None
            pkt_len = 54
            direction = "INTERNAL"
            flags = None
            info = "IGMPv3 Membership Report (Unclassified payload)"

        packets.append({
            "timestamp": pkt_time,
            "src_ip": src_ip,
            "src_port": src_port,
            "dst_ip": dst_ip,
            "dst_port": dst_port,
            "protocol": proto_choice,
            "packet_length": pkt_len,
            "direction": direction,
            "flags": flags,
            "info": info,
        })

    # Sort chronologically
    packets.sort(key=lambda p: p["timestamp"])
    return packets
