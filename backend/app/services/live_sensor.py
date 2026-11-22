"""Optional, metadata-only live collector driven by Wireshark's tshark CLI."""
import asyncio
import csv
import re
import shutil
from datetime import datetime, timezone

from app.config import settings
from app.database import SessionLocal
from app.ml.features import PROTOCOL_NAME
from app.services.pipeline import process_flow

INTERFACE_PATTERN = re.compile(r"^[A-Za-z0-9_.:-]{1,64}$")
FIELDS = (
    "frame.time_epoch", "ip.src", "ipv6.src", "ip.dst", "ipv6.dst",
    "tcp.srcport", "udp.srcport", "tcp.dstport", "udp.dstport",
    "ip.proto", "ipv6.nxt", "frame.len", "tcp.flags.syn", "tcp.flags.ack",
    "tcp.flags.reset", "tcp.flags.fin",
)


class SensorState:
    running = False
    interface = settings.LIVE_SENSOR_INTERFACE
    packets_seen = 0
    flows_processed = 0
    last_error = None


state = SensorState()


def sensor_status():
    return {
        "available": shutil.which("tshark") is not None,
        "running": state.running,
        "interface": state.interface,
        "packets_seen": state.packets_seen,
        "flows_processed": state.flows_processed,
        "last_error": state.last_error,
        "metadata_only": True,
    }


def _packet_from_line(line):
    values = next(csv.reader([line]))
    if len(values) != len(FIELDS):
        return None
    item = dict(zip(FIELDS, values))
    src = item["ip.src"] or item["ipv6.src"]
    dst = item["ip.dst"] or item["ipv6.dst"]
    try:
        timestamp = float(item["frame.time_epoch"])
        length = float(item["frame.len"])
        protocol_num = int(item["ip.proto"] or item["ipv6.nxt"] or 0)
    except ValueError:
        return None
    if not src or not dst or length < 0:
        return None

    def port(tcp_key, udp_key):
        value = item[tcp_key] or item[udp_key] or "0"
        return int(value) if value.isdigit() and int(value) <= 65535 else 0

    return {
        "timestamp": timestamp,
        "src_ip": src,
        "dst_ip": dst,
        "src_port": port("tcp.srcport", "udp.srcport"),
        "dst_port": port("tcp.dstport", "udp.dstport"),
        "protocol_num": protocol_num,
        "protocol": PROTOCOL_NAME.get(protocol_num, f"IP_{protocol_num}"),
        "length": length,
        "syn": item["tcp.flags.syn"] == "1",
        "ack": item["tcp.flags.ack"] == "1",
        "rst": item["tcp.flags.reset"] == "1",
        "fin": item["tcp.flags.fin"] == "1",
    }


class FlowAggregator:
    def __init__(self):
        self.flows = {}

    def add(self, packet):
        key = tuple(packet[name] for name in ("src_ip", "dst_ip", "src_port", "dst_port", "protocol"))
        flow = self.flows.setdefault(key, {
            **{name: packet[name] for name in ("src_ip", "dst_ip", "src_port", "dst_port", "protocol", "protocol_num")},
            "first": packet["timestamp"], "last": packet["timestamp"], "packets": 0,
            "bytes": 0.0, "syn": 0, "ack": 0, "rst": 0, "fin": 0,
        })
        flow["first"] = min(flow["first"], packet["timestamp"])
        flow["last"] = max(flow["last"], packet["timestamp"])
        flow["packets"] += 1
        flow["bytes"] += packet["length"]
        for flag in ("syn", "ack", "rst", "fin"):
            flow[flag] += int(packet[flag])

    def drain_idle(self, now):
        ready = [key for key, flow in self.flows.items() if now - flow["last"] >= settings.LIVE_SENSOR_IDLE_SECONDS]
        return [self._to_flow(self.flows.pop(key)) for key in ready]

    def drain_all(self):
        result = [self._to_flow(flow) for flow in self.flows.values()]
        self.flows.clear()
        return result

    @staticmethod
    def _to_flow(flow):
        duration = max(flow["last"] - flow["first"], 0.001)
        packets, byte_count = flow["packets"], flow["bytes"]
        return {
            "timestamp": datetime.fromtimestamp(flow["last"], timezone.utc).replace(tzinfo=None),
            "src_ip": flow["src_ip"], "dst_ip": flow["dst_ip"],
            "src_port": flow["src_port"], "dst_port": flow["dst_port"],
            "protocol": flow["protocol"], "protocol_num": flow["protocol_num"],
            "duration": duration, "fwd_packets": packets, "bwd_packets": 0,
            "fwd_bytes": byte_count, "bwd_bytes": 0.0,
            "flow_bytes_per_s": byte_count / duration,
            "flow_packets_per_s": packets / duration,
            "avg_packet_size": byte_count / max(packets, 1),
            "syn_count": flow["syn"], "ack_count": flow["ack"],
            "rst_count": flow["rst"], "fin_count": flow["fin"],
        }


def _persist(flows):
    if not flows:
        return 0
    db = SessionLocal()
    try:
        for flow in flows:
            process_flow(db, flow, source="sensor", commit=False)
        db.commit()
        return len(flows)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


async def _run_sensor(interface):
    command = ["tshark", "-l", "-n", "-i", interface, "-T", "fields", "-E", "separator=,", "-E", "quote=d"]
    command.extend(part for field in FIELDS for part in ("-e", field))
    process = await asyncio.create_subprocess_exec(
        *command, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
    )
    aggregator = FlowAggregator()
    try:
        while True:
            line = await process.stdout.readline()
            if not line:
                raise RuntimeError("tshark stopped unexpectedly")
            packet = _packet_from_line(line.decode("utf-8", errors="replace").strip())
            if not packet:
                continue
            state.packets_seen += 1
            aggregator.add(packet)
            saved = await asyncio.to_thread(_persist, aggregator.drain_idle(packet["timestamp"]))
            state.flows_processed += saved
    finally:
        saved = await asyncio.to_thread(_persist, aggregator.drain_all())
        state.flows_processed += saved
        if process.returncode is None:
            process.terminate()
            await process.wait()


async def start_live_sensor(app):
    if state.running:
        return sensor_status()
    if not shutil.which("tshark"):
        state.last_error = "tshark is not installed or is not on PATH."
        raise RuntimeError(state.last_error)
    interface = settings.LIVE_SENSOR_INTERFACE
    if not INTERFACE_PATTERN.fullmatch(interface):
        raise RuntimeError("Configured live sensor interface is invalid.")
    state.running, state.interface, state.last_error = True, interface, None
    task = asyncio.create_task(_run_sensor(interface))
    app.state.live_sensor_task = task

    def record_result(done):
        state.running = False
        try:
            done.result()
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            state.last_error = str(exc)

    task.add_done_callback(record_result)
    return sensor_status()


async def stop_live_sensor(app):
    task = getattr(app.state, "live_sensor_task", None)
    if task and not task.done():
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
    state.running = False
    return sensor_status()
