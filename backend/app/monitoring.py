
import csv
import io
from collections import Counter
from pathlib import Path
from datetime import datetime

DATASET_PATH = Path(__file__).resolve().parent.parent / "data" / "cic.csv"


def get_monitoring_summary():
    total_flows = 0
    normal_flows = 0
    attack_counts = Counter()
    protocol_counts = Counter()

    earliest_timestamp = None
    latest_timestamp = None

    with DATASET_PATH.open(
        "r",
        encoding="utf-8-sig",
        newline=""
    ) as file:

        reader = csv.DictReader(file)

        for row in reader:
            total_flows += 1

            label = row.get("Label", "").strip()
            protocol = row.get("Protocol", "Unknown").strip()
            timestamp = row.get("Timestamp", "").strip()

            if label.lower() in ("benign", "normal"):
                normal_flows += 1
            else:
                attack_counts[label or "Unknown"] += 1

            protocol_counts[protocol or "Unknown"] += 1

            if timestamp:
                try:
                    parsed_time = datetime.strptime(
                        timestamp,
                        "%d/%m/%Y %H:%M:%S"
                    )

                    if (
                        earliest_timestamp is None
                        or parsed_time < earliest_timestamp
                    ):
                        earliest_timestamp = parsed_time

                    if (
                        latest_timestamp is None
                        or parsed_time > latest_timestamp
                    ):
                        latest_timestamp = parsed_time

                except ValueError:
                    pass

    return {
        "source": "CIC-IDS2018",
        "mode": "historical",

        "total_flows": total_flows,
        "normal_flows": normal_flows,
        "attack_flows": total_flows - normal_flows,

        "attack_distribution": [
            {"name": name, "value": count}
            for name, count in attack_counts.items()
        ],

        "protocol_distribution": [
            {"protocol": protocol, "count": count}
            for protocol, count in protocol_counts.items()
        ],

        "dataset_start": (
            earliest_timestamp.isoformat()
            if earliest_timestamp else None
        ),

        "dataset_end": (
            latest_timestamp.isoformat()
            if latest_timestamp else None
        )
    }


def get_monitoring_flows(
    page=1,
    page_size=25,
    protocol=None,
    label=None,
    traffic_type=None
):
    matching_records = []
    total_matches = 0

    with DATASET_PATH.open(
        "r",
        encoding="utf-8-sig",
        newline=""
    ) as file:

        reader = csv.DictReader(file)

        for row in reader:
            row_protocol = row.get("Protocol", "").strip()
            row_label = row.get("Label", "").strip()

            if protocol and row_protocol != protocol:
                continue

            if label and row_label.lower() != label.lower():
                continue

            if traffic_type == "normal":
                if row_label.lower() not in ("benign", "normal"):
                    continue

            if traffic_type == "attack":
                if row_label.lower() in ("benign", "normal"):
                    continue

            total_matches += 1

            start_index = (page - 1) * page_size
            end_index = start_index + page_size

            if start_index <= total_matches - 1 < end_index:
                matching_records.append({
                    "timestamp": row.get("Timestamp"),
                    "protocol": row_protocol,
                    "flow_duration": row.get("Flow Duration"),
                    "label": row_label,
                    "traffic_type": (
                        "Normal"
                        if row_label.lower() in ("benign", "normal")
                        else "Attack"
                    )
                })

    return {
        "page": page,
        "page_size": page_size,
        "total_records": total_matches,
        "total_pages": (
            (total_matches + page_size - 1) // page_size
        ),
        "records": matching_records
    }


def get_monitoring_timeline(interval="hour"):
    timeline = {}

    with DATASET_PATH.open(
        "r",
        encoding="utf-8-sig",
        newline=""
    ) as file:

        reader = csv.DictReader(file)

        for row in reader:
            timestamp = row.get("Timestamp", "").strip()
            label = row.get("Label", "").strip().lower()

            if not timestamp:
                continue

            try:
                parsed_time = datetime.strptime(
                    timestamp,
                    "%d/%m/%Y %H:%M:%S"
                )
            except ValueError:
                continue

            if interval == "day":
                time_key = parsed_time.strftime("%Y-%m-%d")
            else:
                time_key = parsed_time.strftime("%Y-%m-%d %H:00")

            if time_key not in timeline:
                timeline[time_key] = {
                    "time": time_key,
                    "normal": 0,
                    "attack": 0
                }

            if label in ("benign", "normal"):
                timeline[time_key]["normal"] += 1
            else:
                timeline[time_key]["attack"] += 1

    return {
        "source": "CIC-IDS2018",
        "interval": interval,
        "data": [
            timeline[key]
            for key in sorted(timeline.keys())
        ]
    }


def generate_monitoring_csv(
    protocol=None,
    label=None,
    traffic_type=None
):
    output = io.StringIO()

    writer = csv.writer(output)

    writer.writerow([
        "Timestamp",
        "Protocol",
        "Flow Duration (microseconds)",
        "Label",
        "Traffic Type"
    ])

    with DATASET_PATH.open(
        "r",
        encoding="utf-8-sig",
        newline=""
    ) as file:

        reader = csv.DictReader(file)

        for row in reader:
            row_protocol = row.get("Protocol", "").strip()
            row_label = row.get("Label", "").strip()

            if protocol and row_protocol != protocol:
                continue

            if label and row_label.lower() != label.lower():
                continue

            is_normal = row_label.lower() in ("benign", "normal")

            if traffic_type == "normal" and not is_normal:
                continue

            if traffic_type == "attack" and is_normal:
                continue

            writer.writerow([
                row.get("Timestamp", ""),
                row_protocol,
                row.get("Flow Duration", ""),
                row_label,
                "Normal" if is_normal else "Attack"
            ])

    return output.getvalue()
