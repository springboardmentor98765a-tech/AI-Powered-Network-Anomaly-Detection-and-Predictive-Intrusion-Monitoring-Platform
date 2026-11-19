import os
import re
import shutil
import subprocess
import threading

from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select

from app.db.session import SessionLocal
from app.network_models import NetworkCaptureSession, NetworkPacket


class NetworkCaptureManager:
    """
    Manages one live TShark capture process.

    Packet metadata is read from TShark's tab-separated output
    and persisted to PostgreSQL in batches.
    """

    PACKET_FIELDS = [
        "frame.time_epoch",
        "ip.src",
        "ip.dst",
        "ipv6.src",
        "ipv6.dst",
        "_ws.col.Protocol",
        "tcp.srcport",
        "tcp.dstport",
        "udp.srcport",
        "udp.dstport",
        "frame.len",
        "frame.protocols",
    ]

    def __init__(self):
        self._lock = threading.RLock()
        self._process = None
        self._thread = None
        self._stop_event = None
        self._capture_id = None
        self._interface_name = None

    # ---------------------------------------------------------
    # TSHARK LOCATION
    # ---------------------------------------------------------

    def _find_tshark(self):
        """
        Locate TShark using an environment variable, PATH,
        or the standard Windows Wireshark installation paths.
        """

        configured_path = os.getenv("TSHARK_PATH")

        if configured_path:
            path = Path(configured_path)

            if path.is_file():
                return str(path)

            raise FileNotFoundError(
                f"TSHARK_PATH does not point to a valid file: {path}"
            )

        executable = shutil.which("tshark")

        if executable:
            return executable

        possible_paths = [
            Path(os.environ.get("ProgramFiles", "C:/Program Files"))
            / "Wireshark"
            / "tshark.exe",

            Path(os.environ.get("ProgramFiles(x86)", "C:/Program Files (x86)"))
            / "Wireshark"
            / "tshark.exe",
        ]

        for path in possible_paths:
            if path.is_file():
                return str(path)

        raise FileNotFoundError(
            "TShark was not found. Install Wireshark with TShark "
            "or configure the TSHARK_PATH environment variable."
        )

    # ---------------------------------------------------------
    # NETWORK INTERFACE DISCOVERY
    # ---------------------------------------------------------

    def get_interfaces(self):
        """
        Return network interfaces detected by TShark.
        """

        tshark = self._find_tshark()

        result = subprocess.run(
            [tshark, "-D"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=15,
            check=False,
        )

        if result.returncode != 0:
            raise RuntimeError(
                result.stderr.strip() or
                "Unable to retrieve network interfaces."
            )

        interfaces = []

        for line in result.stdout.splitlines():
            match = re.match(
                r"^\s*(\d+)\.\s+(.+?)\s+\((.*?)\)\s*$",
                line,
            )

            if not match:
                continue

            index = int(match.group(1))
            device = match.group(2).strip()
            name = match.group(3).strip()

            interfaces.append({
                "index": index,
                "device": device,
                "name": name,
            })

        return interfaces

    def _resolve_interface(self, interface_index):
        interfaces = self.get_interfaces()

        for interface in interfaces:
            if interface["index"] == interface_index:
                return interface

        raise ValueError(
            f"Network interface index {interface_index} "
            "was not found. Refresh the interface list."
        )

    # ---------------------------------------------------------
    # PROTOCOL CLASSIFICATION
    # ---------------------------------------------------------

    @staticmethod
    def _classify_protocol(display_protocol, protocol_stack, ports):
        """
        Prefer the most specific protocol identified by TShark.

        Examples:
        TCP carrying DNS traffic -> DNS
        TCP carrying TLS on port 443 -> HTTPS
        Plain TCP traffic -> TCP
        """

        display = (display_protocol or "").strip().upper()

        stack = {
            item.strip().upper()
            for item in (protocol_stack or "").split(":")
            if item.strip()
        }

        ports = set(ports)

        if "ARP" in stack or display == "ARP":
            return "ARP"

        if "DNS" in stack or display == "DNS":
            return "DNS"

        if "HTTP" in stack or display in {"HTTP", "HTTP2"}:
            return "HTTP"

        if "QUIC" in stack or display == "QUIC":
            return "HTTPS"

        if "TLS" in stack or display in {"TLS", "SSL"}:
            return "HTTPS" if 443 in ports else "TLS"

        if "ICMPV6" in stack or display == "ICMPV6":
            return "ICMPV6"

        if "ICMP" in stack or display == "ICMP":
            return "ICMP"

        if "TCP" in stack or display == "TCP":
            if 80 in ports:
                return "HTTP"

            if 443 in ports:
                return "HTTPS"

            if 53 in ports:
                return "DNS"

            return "TCP"

        if "UDP" in stack or display == "UDP":
            if 53 in ports:
                return "DNS"

            return "UDP"

        if display:
            return display

        return "UNKNOWN"

    # ---------------------------------------------------------
    # PACKET PARSING
    # ---------------------------------------------------------

    @classmethod
    def _parse_packet(cls, line, interface_name, capture_id):
        """
        Convert one TShark tab-separated record into
        a NetworkPacket object.

        TShark field order must match PACKET_FIELDS.
        """

        fields = line.rstrip("\r\n").split("\t")

        if len(fields) < len(cls.PACKET_FIELDS):
            return None

        try:
            timestamp = datetime.fromtimestamp(
                float(fields[0]),
                tz=timezone.utc,
            )
        except (ValueError, OverflowError, OSError):
            return None

        source_ip = fields[1].strip() or fields[3].strip() or None
        destination_ip = fields[2].strip() or fields[4].strip() or None

        tcp_source_port = fields[6].strip()
        tcp_destination_port = fields[7].strip()
        udp_source_port = fields[8].strip()
        udp_destination_port = fields[9].strip()

        source_port_text = tcp_source_port or udp_source_port
        destination_port_text = (
            tcp_destination_port or udp_destination_port
        )

        def safe_port(value):
            if not value:
                return None

            try:
                port = int(value)

                if 0 <= port <= 65535:
                    return port

            except ValueError:
                pass

            return None

        source_port = safe_port(source_port_text)
        destination_port = safe_port(destination_port_text)

        try:
            packet_length = int(fields[10])
        except ValueError:
            return None

        if packet_length < 0:
            return None

        protocol = cls._classify_protocol(
            display_protocol=fields[5],
            protocol_stack=fields[11],
            ports=[source_port, destination_port],
        )

        return NetworkPacket(
            capture_id=capture_id,
            captured_at=timestamp,
            source_ip=source_ip,
            destination_ip=destination_ip,
            protocol=protocol,
            source_port=source_port,
            destination_port=destination_port,
            packet_length=packet_length,
            protocol_stack=fields[11] or None,
            interface_name=interface_name,
        )

    # ---------------------------------------------------------
    # DATABASE HELPERS
    # ---------------------------------------------------------

    @staticmethod
    def _update_capture(capture_id, status, error_message=None):
        db = SessionLocal()

        try:
            capture = db.get(NetworkCaptureSession, capture_id)

            if capture is None:
                return

            capture.status = status

            if status in {"stopped", "failed"}:
                capture.stopped_at = datetime.now(timezone.utc)

            if error_message:
                capture.error_message = error_message[:2000]

            db.commit()

        finally:
            db.close()

    # ---------------------------------------------------------
    # BACKGROUND PACKET READER
    # ---------------------------------------------------------

    def _read_packets(
        self,
        process,
        capture_id,
        interface_name,
        stop_event,
    ):
        db = SessionLocal()

        pending_packets = 0
        total_packets = 0
        total_bytes = 0
        error_message = None

        try:
            if process.stdout is None:
                raise RuntimeError(
                    "TShark output stream was not available."
                )

            for line in process.stdout:
                if not line.strip():
                    continue

                packet = self._parse_packet(
                    line=line,
                    interface_name=interface_name,
                    capture_id=capture_id,
                )

                if packet is None:
                    continue

                db.add(packet)

                pending_packets += 1
                total_packets += 1
                total_bytes += packet.packet_length

                # Persist in batches to avoid a database commit
                # for every individual packet.
                if pending_packets >= 100:
                    self._flush_batch(
                        db,
                        capture_id,
                        pending_packets,
                    )

                    pending_packets = 0

            process.wait()

            if pending_packets:
                self._flush_batch(
                    db,
                    capture_id,
                    pending_packets,
                )

                pending_packets = 0

            capture = db.get(
                NetworkCaptureSession,
                capture_id,
            )

            if capture is not None:
                if stop_event.is_set():
                    capture.status = "stopped"
                elif process.returncode == 0:
                    capture.status = "stopped"
                else:
                    capture.status = "failed"
                    capture.error_message = (
                        f"TShark exited with code {process.returncode}."
                    )

                capture.stopped_at = datetime.now(timezone.utc)
                db.commit()

        except Exception as exc:
            db.rollback()
            error_message = str(exc)

            capture = db.get(
                NetworkCaptureSession,
                capture_id,
            )

            if capture is not None:
                capture.status = "failed"
                capture.stopped_at = datetime.now(timezone.utc)
                capture.error_message = error_message[:2000]
                db.commit()

        finally:
            db.close()

            with self._lock:
                if self._capture_id == capture_id:
                    self._process = None
                    self._thread = None
                    self._stop_event = None
                    self._capture_id = None
                    self._interface_name = None

    @staticmethod
    def _flush_batch(db, capture_id, packet_count):
        """
        Commit buffered packets and update capture counters
        in the same database transaction.
        """

        capture = db.get(
            NetworkCaptureSession,
            capture_id,
        )

        if capture is None:
            raise RuntimeError("Capture session no longer exists.")

        pending_bytes = sum(
            packet.packet_length
            for packet in db.new
            if isinstance(packet, NetworkPacket)
            and packet.capture_id == capture_id
        )

        capture.packet_count += packet_count
        capture.total_bytes += pending_bytes

        db.commit()

    # ---------------------------------------------------------
    # START CAPTURE
    # ---------------------------------------------------------

    def start_capture(self, interface_index, started_by_id):
        with self._lock:
            if (
                self._process is not None
                and self._process.poll() is None
            ):
                raise RuntimeError(
                    "A network capture is already running."
                )

            tshark = self._find_tshark()
            interface = self._resolve_interface(interface_index)

            db = SessionLocal()

            try:
                capture = NetworkCaptureSession(
                    interface_id=interface["device"],
                    interface_name=interface["name"],
                    status="starting",
                    started_by_id=started_by_id,
                    packet_count=0,
                    total_bytes=0,
                )

                db.add(capture)
                db.commit()
                db.refresh(capture)

                capture_id = capture.id

            finally:
                db.close()

            command = [
                tshark,
                "-i", interface["device"],
                "-l",
                "-n",
                "-T", "fields",
            ]

            for field in self.PACKET_FIELDS:
                command.extend(["-e", field])

            command.extend([
                "-E", "header=n",
                "-E", "separator=/t",
                "-E", "occurrence=f",
                "-E", "quote=n",
            ])

            try:
                process = subprocess.Popen(
                    command,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.DEVNULL,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    bufsize=1,
                )

                self._process = process
                self._capture_id = capture_id
                self._interface_name = interface["name"]
                self._stop_event = threading.Event()

                self._update_capture(
                    capture_id,
                    "running",
                )

                thread = threading.Thread(
                    target=self._read_packets,
                    args=(
                        process,
                        capture_id,
                        interface["name"],
                        self._stop_event,
                    ),
                    daemon=True,
                    name=f"netshield-capture-{capture_id}",
                )

                self._thread = thread
                thread.start()

                return {
                    "capture_id": capture_id,
                    "interface_index": interface_index,
                    "interface_name": interface["name"],
                    "status": "running",
                    "message": "Network capture started successfully.",
                }

            except Exception as exc:
                self._update_capture(
                    capture_id,
                    "failed",
                    str(exc),
                )

                self._process = None
                self._capture_id = None
                self._interface_name = None
                self._thread = None
                self._stop_event = None

                raise RuntimeError(
                    f"Unable to start TShark capture: {exc}"
                ) from exc

    # ---------------------------------------------------------
    # STOP CAPTURE
    # ---------------------------------------------------------

    def stop_capture(self):
        with self._lock:
            process = self._process
            capture_id = self._capture_id
            stop_event = self._stop_event

            if process is None or capture_id is None:
                return {
                    "status": "not_running",
                    "message": "No active network capture.",
                }

            if stop_event is not None:
                stop_event.set()

            if process.poll() is None:
                try:
                    process.terminate()
                except OSError:
                    pass

            return {
                "capture_id": capture_id,
                "status": "stopping",
                "message": "Network capture is stopping.",
            }

    # ---------------------------------------------------------
    # CURRENT CAPTURE STATUS
    # ---------------------------------------------------------

    def get_status(self):
        with self._lock:
            process = self._process

            if process is not None and process.poll() is None:
                return {
                    "running": True,
                    "capture_id": self._capture_id,
                    "interface_name": self._interface_name,
                }

            return {
                "running": False,
                "capture_id": None,
                "interface_name": None,
            }


network_capture_manager = NetworkCaptureManager()