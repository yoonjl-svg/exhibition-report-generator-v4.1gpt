from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any

from excel_template import read_xlsx_tables


NUMERIC_FIELDS = {
    "total_visitors",
    "operating_days",
    "daily_visitors",
    "paid_visitors",
    "free_visitors",
    "total_budget",
    "income",
    "count",
    "sessions",
    "participants",
    "participation_rate",
    "press_mentions",
    "sns_posts",
    "memberships_sold",
}

REFERENCE_METRIC_FIELDS = (
    "total_visitors_avg",
    "daily_visitors_avg",
    "total_budget_avg",
    "cost_per_visitor_avg",
    "program_participants_avg",
    "press_mentions_avg",
    "paid_audience_ratio_avg",
)


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert CSV or multi-sheet Excel templates into normalized exhibition input JSON.")
    parser.add_argument("input", type=Path, help="Directory containing CSV input files, or a multi-sheet .xlsx template.")
    parser.add_argument("--output", type=Path, default=Path("data/sample-input.json"))
    args = parser.parse_args()

    source = build_input_path(args.input)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(source, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "input": str(args.input),
                "output": str(args.output),
                "feedback_items": len(source.get("selected_feedback", [])),
                "reference_groups": len(source.get("reference_groups", [])),
                "data_quality_checks": len(source.get("data_quality_checks", [])),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


def build_input_path(path: Path) -> dict[str, Any]:
    if path.suffix.lower() == ".xlsx":
        return build_input_from_tables(read_xlsx_tables(path))
    return build_input(path)


def build_input(template_dir: Path) -> dict[str, Any]:
    return build_input_from_tables(
        {
            "core": read_rows(template_dir / "core.csv"),
            "reference-groups": read_rows(template_dir / "reference-groups.csv"),
            "selected-feedback": read_rows(template_dir / "selected-feedback.csv"),
            "data-quality": read_rows(template_dir / "data-quality.csv"),
        }
    )


def build_input_from_tables(tables: dict[str, list[dict[str, str]]]) -> dict[str, Any]:
    source: dict[str, Any] = {
        "schema_version": "0.2.0",
        "exhibition": {
            "period": {},
        },
        "narrative": {},
        "audience": {},
        "budget": {},
        "programs": {},
        "publicity": {},
        "membership": {},
        "reference_groups": [],
        "selected_feedback": [],
        "data_quality_checks": [],
    }

    read_core(tables["core"], source)
    source["reference_groups"] = read_reference_groups(tables["reference-groups"])
    source["selected_feedback"] = read_feedback(tables.get("selected-feedback", []))
    source["data_quality_checks"] = read_data_quality(tables.get("data-quality", []))

    return remove_empty_containers(source)


def read_core(rows: list[dict[str, str]], source: dict[str, Any]) -> None:
    for row in rows:
        section = row["section"].strip()
        key = row["key"].strip()
        value = row["value"].strip()
        if value == "":
            continue

        if section == "period":
            source["exhibition"]["period"][key] = value
        elif section == "brief_metrics" and key == "ids":
            source["brief_metric_ids"] = [item.strip() for item in value.split(",") if item.strip()]
        elif section in {"audience", "budget", "programs", "publicity", "membership"}:
            source[section][key] = coerce_value(key, value)
        elif section == "narrative":
            source["narrative"][key] = value
        elif section == "exhibition":
            source["exhibition"][key] = value
        else:
            raise SystemExit(f"Unknown core section/key: {section}.{key}")


def read_reference_groups(rows: list[dict[str, str]]) -> list[dict[str, Any]]:
    groups = []
    for row in rows:
        if not row.get("id"):
            continue
        metrics = {}
        for key in REFERENCE_METRIC_FIELDS:
            value = row.get(key, "").strip()
            if value:
                metrics[key] = parse_number(value)
        groups.append(
            {
                "id": row["id"].strip(),
                "label": row["label"].strip(),
                "selection_rule": row["selection_rule"].strip(),
                "caveat": row["caveat"].strip(),
                "metrics": metrics,
            }
        )
    return groups


def read_feedback(rows: list[dict[str, str]]) -> list[dict[str, Any]]:
    feedback = []
    for row in rows:
        if not row.get("id"):
            continue
        item = {
            "id": row["id"].strip(),
            "source": row["source"].strip(),
            "theme": row["theme"].strip(),
            "polarity": row["polarity"].strip(),
            "quote": row["quote"].strip(),
        }
        note = row.get("note", "").strip()
        if note:
            item["note"] = note
        feedback.append(item)
    return feedback


def read_data_quality(rows: list[dict[str, str]]) -> list[dict[str, Any]]:
    grouped: dict[str, dict[str, Any]] = {}
    for row in rows:
        check_id = row.get("id", "").strip()
        if not check_id:
            continue
        check = grouped.setdefault(
            check_id,
            {
                "id": check_id,
                "claim": row["claim"].strip(),
                "importance": row["importance"].strip() or "medium",
                "caveat": row.get("caveat", "").strip(),
                "sources": [],
            },
        )
        label = row.get("source_label", "").strip()
        value = row.get("source_value", "").strip()
        if label or value:
            check["sources"].append({"label": label, "value": value})

    return list(grouped.values())


def read_rows(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        raise SystemExit(f"Missing CSV input file: {path}")
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def coerce_value(key: str, value: str) -> Any:
    if key in NUMERIC_FIELDS:
        return parse_number(value)
    return value


def parse_number(value: str) -> int | float:
    cleaned = value.replace(",", "").strip()
    number = float(cleaned)
    return int(number) if number.is_integer() else number


def remove_empty_containers(value: Any) -> Any:
    if isinstance(value, dict):
        cleaned = {key: remove_empty_containers(item) for key, item in value.items()}
        return {key: item for key, item in cleaned.items() if item not in ({}, [], None, "")}
    if isinstance(value, list):
        return [remove_empty_containers(item) for item in value]
    return value


if __name__ == "__main__":
    main()
