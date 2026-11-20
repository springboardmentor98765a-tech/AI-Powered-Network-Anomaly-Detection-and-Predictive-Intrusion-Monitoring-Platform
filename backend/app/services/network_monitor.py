"""Lightweight live packet monitor backed by the Wireshark TShark CLI.

Capture starts when an authenticated Admin opens Network Monitoring. Packet
records are kept in a bounded in-memory buffer; no new PCAP files are written.
"""
from __future__ import annotations

import atexit
import ipaddress
import os
import re
import shutil
import subprocess
import threading
import time
from collections import Counter, deque
from datetime import datetime, timezone
from typing import Any


class NetworkMonitor:
    def __init__(self, max_packets: int = 10000) -> None:
        self._packets: deque[dict[str, Any]] = deque(maxlen=max_packets)
        self._lock = threading.RLock()
        self._process: subprocess.Popen[str] | None = None
        self._reader: threading.Thread | None = None
        self._stderr_reader: threading.Thread | None = None
        self._started_at: float | None = None
        self._last_error = ""
        self._interface = ""
        self._tshark_path = ""

    def _find_tshark(self) -> str | None:
        configured = os.getenv("TSHARK_PATH", "").strip()
        candidates = [
            configured,
            shutil.which("tshark") or "",
            r"C:\Program Files\Wireshark\tshark.exe",
            r"C:\Program Files (x86)\Wireshark\tshark.exe",
        ]
        for candidate in candidates:
            if candidate and os.path.isfile(candidate):
                return candidate
        return None

    def _find_wifi_interface(self, executable: str) -> str:
        configured = os.getenv("TSHARK_INTERFACE", "").strip()
        if configured:
            return configured

        result = subprocess.run(
            [executable, "-D"],
            capture_output=True,
            text=True,
            timeout=8,
            check=False,
        )
        if result.returncode != 0:
            raise RuntimeError((result.stderr or "Unable to list capture interfaces").strip())

        lines = result.stdout.splitlines()
        for line in lines:
            if re.search(r"\(Wi-?Fi\)", line, re.IGNORECASE):
                match = re.match(r"\s*\d+\.\s+(.+?)\s+\(", line)
                if match:
                    return match.group(1).strip()
                number = re.match(r"\s*(\d+)\.", line)
                if number:
                    return number.group(1)

        # If Windows reports a localized adapter name, use the first non-loopback
        # interface rather than silently selecting the loopback adapter.
        for line in lines:
            if "loopback" not in line.lower() and "etwdump" not in line.lower():
                match = re.match(r"\s*\d+\.\s+(.+?)\s+\(", line)
                if match:
                    return match.group(1).strip()
                number = re.match(r"\s*(\d+)\.", line)
                if number:
                    return number.group(1)
        raise RuntimeError("No suitable network capture interface was found.")

    @staticmethod
    def _main_protocol(protocol_stack: str) -> str:
        layers = [part.lower() for part in protocol_stack.split(":") if part]
        preferred = (
            "dns", "http", "tls", "quic", "ssh", "smtp", "ftp",
            "dhcp", "ntp", "icmpv6", "icmp", "arp", "lldp", "tcp", "udp",
        )
        for protocol in preferred:
            if protocol in layers:
                return protocol.upper()
        return (layers[-1].upper() if layers else "OTHER")

    @staticmethod
    def _direction(src: str, dst: str) -> str:
        try:
            src_private = ipaddress.ip_address(src).is_private
            dst_private = ipaddress.ip_address(dst).is_private
        except ValueError:
            return "unknown"
        if src_private and not dst_private:
            return "outbound"
        if not src_private and dst_private:
            return "inbound"
        if src_private and dst_private:
            return "internal"
        return "external"

    def _read_stderr(self, stream: Any) -> None:
        try:
            for line in iter(stream.readline, ""):
                if line.strip():
                    with self._lock:
                        self._last_error = line.strip()[-1000:]
        except Exception:
            pass

    def _read_packets(self, stream: Any) -> None:
        try:
            for line in iter(stream.readline, ""):
                if not line.strip():
                    continue
                fields = line.rstrip("\r\n").split("\t")
                if len(fields) < 11:
                    continue
                try:
                    timestamp = float(fields[0])
                    length = int(fields[10])
                except (ValueError, TypeError):
                    continue

                src = fields[1] or fields[3]
                dst = fields[2] or fields[4]
                src_port = fields[5] or fields[7]
                dst_port = fields[6] or fields[8]
                protocol = self._main_protocol(fields[9])
                packet = {
                    "timestamp": timestamp,
                    "time": datetime.fromtimestamp(timestamp, timezone.utc).isoformat(),
                    "source_ip": src or "-",
                    "destination_ip": dst or "-",
                    "source_port": src_port or "-",
                    "destination_port": dst_port or "-",
                    "protocol": protocol,
                    "bytes": max(length, 0),
                    "direction": self._direction(src, dst) if src and dst else "unknown",
                }
                with self._lock:
                    self._packets.append(packet)
        except Exception as exc:
            with self._lock:
                self._last_error = f"Packet reader stopped: {exc}"

    def start(self) -> dict[str, Any]:
        with self._lock:
            if self._process is not None and self._process.poll() is None:
                return self.status()

            executable = self._find_tshark()
            if not executable:
                self._last_error = (
                    "TShark was not found. Install Wireshark or configure TSHARK_PATH."
                )
                return self.status()

            try:
                interface = self._find_wifi_interface(executable)
                command = [
                    executable, "-l", "-n", "-i", interface, "-T", "fields",
                    "-e", "frame.time_epoch",
                    "-e", "ip.src", "-e", "ip.dst",
                    "-e", "ipv6.src", "-e", "ipv6.dst",
                    "-e", "tcp.srcport", "-e", "tcp.dstport",
                    "-e", "udp.srcport", "-e", "udp.dstport",
                    "-e", "frame.protocols", "-e", "frame.len",
                ]
                creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
                self._process = subprocess.Popen(
                    command,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    bufsize=1,
                    creationflags=creationflags,
                )
                self._interface = interface
                self._tshark_path = executable
                self._started_at = time.time()
                self._last_error = ""
                self._reader = threading.Thread(
                    target=self._read_packets,
                    args=(self._process.stdout,),
                    daemon=True,
                    name="netshield-tshark-reader",
                )
                self._stderr_reader = threading.Thread(
                    target=self._read_stderr,
                    args=(self._process.stderr,),
                    daemon=True,
                    name="netshield-tshark-stderr",
                )
                self._reader.start()
                self._stderr_reader.start()
                # Give TShark a moment to report an immediate permission/interface error.
                time.sleep(0.35)
                if self._process.poll() is not None:
                    self._last_error = self._last_error or (
                        f"TShark exited with code {self._process.returncode}."
                    )
                return self.status()
            except Exception as exc:
                self._last_error = str(exc)
                self._process = None
                return self.status()

    def status(self) -> dict[str, Any]:
        process = self._process
        running = process is not None and process.poll() is None
        return {
            "running": running,
            "interface": self._interface or None,
            "tshark_path": self._tshark_path or None,
            "started_at": self._started_at,
            "packets_buffered": len(self._packets),
            "error": None if running else (self._last_error or "Capture is not running."),
        }

    def _window_packets(self, minutes: int) -> list[dict[str, Any]]:
        cutoff = time.time() - minutes * 60
        with self._lock:
            return [packet for packet in self._packets if packet["timestamp"] >= cutoff]

    def summary(self, minutes: int = 15) -> dict[str, Any]:
        packets = self._window_packets(minutes)
        protocol_counts = Counter(packet["protocol"] for packet in packets)
        source_counts = Counter(
            packet["source_ip"] for packet in packets if packet["source_ip"] != "-"
        )
        destination_counts = Counter(
            packet["destination_ip"] for packet in packets if packet["destination_ip"] != "-"
        )
        active_ips = {
            ip for packet in packets
            for ip in (packet["source_ip"], packet["destination_ip"])
            if ip != "-"
        }

        bucket_count = 12 if minutes <= 60 else 24
        bucket_seconds = (minutes * 60) / bucket_count
        now = time.time()
        buckets = []
        for index in range(bucket_count):
            start = now - minutes * 60 + index * bucket_seconds
            buckets.append({
                "time": datetime.fromtimestamp(start, timezone.utc).strftime("%H:%M"),
                "packets": 0,
                "bytes": 0,
            })
        for packet in packets:
            index = int((packet["timestamp"] - (now - minutes * 60)) / bucket_seconds)
            index = min(max(index, 0), bucket_count - 1)
            buckets[index]["packets"] += 1
            buckets[index]["bytes"] += packet["bytes"]

        directions = Counter(packet["direction"] for packet in packets)
        return {
            "window_minutes": minutes,
            "total_packets": len(packets),
            "total_bytes": sum(packet["bytes"] for packet in packets),
            "active_ips": len(active_ips),
            "protocols": [
                {"protocol": name, "packets": count}
                for name, count in protocol_counts.most_common()
            ],
            "top_sources": [
                {"ip": ip, "packets": count}
                for ip, count in source_counts.most_common(5)
            ],
            "top_destinations": [
                {"ip": ip, "packets": count}
                for ip, count in destination_counts.most_common(5)
            ],
            "directions": dict(directions),
            "traffic_timeline": buckets,
            "buffer_limit": self._packets.maxlen,
        }

    def packets(
        self,
        minutes: int = 15,
        limit: int = 50,
        protocol: str | None = None,
        ip: str | None = None,
        port: str | None = None,
    ) -> list[dict[str, Any]]:
        rows = self._window_packets(minutes)
        if protocol:
            rows = [row for row in rows if row["protocol"].lower() == protocol.lower()]
        if ip:
            needle = ip.strip().lower()
            rows = [
                row for row in rows
                if needle in row["source_ip"].lower()
                or needle in row["destination_ip"].lower()
            ]
        if port:
            needle = str(port).strip()
            rows = [
                row for row in rows
                if row["source_port"] == needle or row["destination_port"] == needle
            ]
        return list(reversed(rows[-limit:]))

    def stop(self) -> None:
        with self._lock:
            process = self._process
            if process is not None and process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    process.kill()
            self._process = None


monitor = NetworkMonitor()
atexit.register(monitor.stop)
