from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path
from typing import Any

from excel_template import read_xlsx_tables
from build_ledger import write_text_lf


NUMERIC_FIELDS = {
    "total_visitors",
    "operating_days",
    "daily_visitors",
    "paid_visitors",
    "free_visitors",
    "group_visitors",
    "group_audience_ratio",
    "total_budget",
    "allocated_budget",
    "execution_rate",
    "income",
    "count",
    "sessions",
    "participants",
    "participation_rate",
    "press_mentions",
    "sns_posts",
    "sns_feedback_total",
    "memberships_sold",
}

FIELD_ALIASES = {
    "id": ["ID"],
    "title": ["전시명", "전시 제목"],
    "type": ["유형", "구분"],
    "total_visitors": ["총 관객 수", "총 관객수", "총관객수"],
    "operating_days": ["운영일수", "운영 일수"],
    "daily_visitors": ["일평균 관객", "일평균 관객 수"],
    "paid_visitors": ["유료 관객 수", "유료 관객수"],
    "group_visitors": ["단체 관객 수", "단체 관객수"],
    "group_audience_ratio": ["단체 관객 비율"],
    "total_budget": ["총 사용 예산", "총예산"],
    "allocated_budget": ["편성 예산"],
    "execution_rate": ["예산 집행률"],
    "budget_execution_rate": ["예산 집행률"],
    "income": ["총 수입", "수입"],
    "cost_per_visitor": ["관객당 비용"],
    "program_sessions": ["프로그램 회수", "프로그램 총 회차", "프로그램 회차"],
    "sessions": ["프로그램 회수", "프로그램 총 회차", "프로그램 회차"],
    "program_participants": ["프로그램 참여 수", "프로그램 참여 인원"],
    "press_mentions": ["보도 건수", "언론 보도 건수"],
    "paid_audience_ratio": ["유료 관객 비율"],
    "sns_feedback_total": ["SNS 피드백 합계", "SNS피드백합계", "sns 피드백 합계"],
}

CORE_KEY_ALIASES = {
    "단체 관객 수": "group_visitors",
    "단체 관객수": "group_visitors",
    "단체 관객 비율": "group_audience_ratio",
    "예산 집행률": "execution_rate",
    "편성 예산": "allocated_budget",
    "총 수입": "income",
    "프로그램 회수": "sessions",
    "프로그램 총 회차": "sessions",
    "프로그램 참여 수": "participants",
    "프로그램 참여 인원": "participants",
    "SNS 피드백 합계": "sns_feedback_total",
    "SNS피드백합계": "sns_feedback_total",
}

REFERENCE_METRIC_FIELDS = (
    "total_visitors_avg",
    "daily_visitors_avg",
    "total_budget_avg",
    "budget_execution_rate_avg",
    "income_avg",
    "cost_per_visitor_avg",
    "group_audience_ratio_avg",
    "program_sessions_avg",
    "program_participants_avg",
    "program_participation_rate_avg",
    "press_mentions_avg",
    "paid_audience_ratio_avg",
    "sns_feedback_avg",
)

REFERENCE_TYPE_IDS = {
    "정기 기획전": "regular_planned_exhibitions",
    "특별전": "special_exhibitions",
    "기타": "other_exhibitions",
}

REFERENCE_AVERAGE_PRECISION = {
    "daily_visitors_avg": 1,
    "budget_execution_rate_avg": 1,
    "group_audience_ratio_avg": 1,
    "program_participation_rate_avg": 1,
    "paid_audience_ratio_avg": 1,
}


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert CSV or multi-sheet Excel templates into normalized exhibition input JSON.")
    parser.add_argument("input", type=Path, help="Directory containing CSV input files, or a multi-sheet .xlsx template.")
    parser.add_argument("--output", type=Path, default=Path("data/sample-input.json"))
    args = parser.parse_args()

    source = build_input_path(args.input)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    write_text_lf(args.output, json.dumps(source, ensure_ascii=False, indent=2) + "\n")
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
            "reference-exhibitions": read_optional_rows(template_dir / "reference-exhibitions.csv"),
            "reference-groups": read_optional_rows(template_dir / "reference-groups.csv"),
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
    historical_groups = build_reference_groups_from_history(
        tables.get("reference-exhibitions", []),
        source["exhibition"].get("type", ""),
    )
    manual_groups = read_reference_groups(tables.get("reference-groups", []))
    source["reference_groups"] = merge_reference_groups(historical_groups, manual_groups)
    source["selected_feedback"] = read_feedback(tables.get("selected-feedback", []))
    source["data_quality_checks"] = read_data_quality(tables.get("data-quality", []))

    return remove_empty_containers(source)


def read_core(rows: list[dict[str, str]], source: dict[str, Any]) -> None:
    for row in rows:
        section = row["section"].strip()
        key = canonical_core_key(row["key"].strip())
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
        if not row_value(row, "id"):
            continue
        metrics = {}
        for key in REFERENCE_METRIC_FIELDS:
            value = row_value(row, key).strip()
            if value:
                metrics[key] = parse_number(value)
        groups.append(
            {
                "id": row_value(row, "id").strip(),
                "label": row_value(row, "label").strip(),
                "selection_rule": row_value(row, "selection_rule").strip(),
                "caveat": row_value(row, "caveat").strip(),
                "metrics": metrics,
            }
        )
    return groups


def build_reference_groups_from_history(rows: list[dict[str, str]], current_type: str) -> list[dict[str, Any]]:
    grouped: dict[str, list[dict[str, str]]] = {}
    for row in rows:
        type_name = row_value(row, "type").strip() or row_value(row, "category").strip()
        if not type_name:
            continue
        grouped.setdefault(type_name, []).append(row)

    ordered_types = []
    if current_type in grouped:
        ordered_types.append(current_type)
    ordered_types.extend(type_name for type_name in grouped if type_name not in ordered_types)

    groups = []
    for index, type_name in enumerate(ordered_types, start=1):
        items = grouped[type_name]
        metrics = historical_average_metrics(items)
        if not metrics:
            continue
        groups.append(
            {
                "id": reference_type_id(type_name, index),
                "label": type_name,
                "selection_rule": f"기존 전시 데이터 중 '{type_name}' 유형 {len(items)}건",
                "caveat": "기존 전시 원자료의 유형 분류와 입력된 수치를 바탕으로 자동 산출한 비교군입니다.",
                "metrics": metrics,
            }
        )
    return groups


def historical_average_metrics(rows: list[dict[str, str]]) -> dict[str, int | float]:
    values = {
        "total_visitors_avg": present_numbers(optional_number(row_value(row, "total_visitors")) for row in rows),
        "daily_visitors_avg": present_numbers(historical_daily_visitors(row) for row in rows),
        "total_budget_avg": present_numbers(optional_number(row_value(row, "total_budget")) for row in rows),
        "budget_execution_rate_avg": present_numbers(historical_budget_execution_rate(row) for row in rows),
        "income_avg": present_numbers(optional_number(row_value(row, "income")) for row in rows),
        "cost_per_visitor_avg": present_numbers(historical_cost_per_visitor(row) for row in rows),
        "group_audience_ratio_avg": present_numbers(historical_group_audience_ratio(row) for row in rows),
        "program_sessions_avg": present_numbers(historical_program_sessions(row) for row in rows),
        "program_participants_avg": present_numbers(
            optional_number(row_value(row, "program_participants")) for row in rows
        ),
        "program_participation_rate_avg": present_numbers(
            historical_program_participation_rate(row) for row in rows
        ),
        "press_mentions_avg": present_numbers(optional_number(row_value(row, "press_mentions")) for row in rows),
        "paid_audience_ratio_avg": present_numbers(historical_paid_ratio(row) for row in rows),
        "sns_feedback_avg": present_numbers(optional_number(row_value(row, "sns_feedback_total")) for row in rows),
    }
    return {
        key: rounded_average(metric_values, REFERENCE_AVERAGE_PRECISION.get(key, 0))
        for key, metric_values in values.items()
        if metric_values
    }


def historical_daily_visitors(row: dict[str, str]) -> float | None:
    daily_visitors = optional_number(row_value(row, "daily_visitors"))
    if daily_visitors is not None:
        return daily_visitors
    total_visitors = optional_number(row_value(row, "total_visitors"))
    operating_days = optional_number(row_value(row, "operating_days"))
    if total_visitors and operating_days:
        return total_visitors / operating_days
    return None


def historical_budget_execution_rate(row: dict[str, str]) -> float | None:
    execution_rate = optional_number(row_value(row, "execution_rate"))
    if execution_rate is None:
        execution_rate = optional_number(row_value(row, "budget_execution_rate"))
    if execution_rate is not None:
        return execution_rate
    total_budget = optional_number(row_value(row, "total_budget"))
    allocated_budget = optional_number(row_value(row, "allocated_budget"))
    if total_budget is not None and allocated_budget:
        return total_budget / allocated_budget * 100
    return None


def historical_cost_per_visitor(row: dict[str, str]) -> float | None:
    cost_per_visitor = optional_number(row_value(row, "cost_per_visitor"))
    if cost_per_visitor is not None:
        return cost_per_visitor
    total_budget = optional_number(row_value(row, "total_budget"))
    total_visitors = optional_number(row_value(row, "total_visitors"))
    if total_budget and total_visitors:
        return total_budget / total_visitors
    return None


def historical_group_audience_ratio(row: dict[str, str]) -> float | None:
    group_ratio = optional_number(row_value(row, "group_audience_ratio"))
    if group_ratio is not None:
        return group_ratio
    total_visitors = optional_number(row_value(row, "total_visitors"))
    group_visitors = optional_number(row_value(row, "group_visitors"))
    if total_visitors and group_visitors is not None:
        return group_visitors / total_visitors * 100
    return None


def historical_program_sessions(row: dict[str, str]) -> float | None:
    program_sessions = optional_number(row_value(row, "program_sessions"))
    if program_sessions is not None:
        return program_sessions
    return optional_number(row_value(row, "sessions"))


def historical_program_participation_rate(row: dict[str, str]) -> float | None:
    participation_rate = optional_number(row_value(row, "program_participation_rate"))
    if participation_rate is not None:
        return participation_rate
    participants = optional_number(row_value(row, "program_participants"))
    total_visitors = optional_number(row_value(row, "total_visitors"))
    if participants is not None and total_visitors:
        return participants / total_visitors * 100
    return None


def historical_paid_ratio(row: dict[str, str]) -> float | None:
    paid_ratio = optional_number(row_value(row, "paid_audience_ratio"))
    if paid_ratio is not None:
        return paid_ratio
    total_visitors = optional_number(row_value(row, "total_visitors"))
    paid_visitors = optional_number(row_value(row, "paid_visitors"))
    if total_visitors and paid_visitors is not None:
        return paid_visitors / total_visitors * 100
    return None


def rounded_average(values: list[float], precision: int) -> int | float:
    average = sum(values) / len(values)
    if precision == 0:
        return int(round(average))
    return round(average, precision)


def present_numbers(values: Any) -> list[float]:
    return [value for value in values if value is not None]


def canonical_core_key(key: str) -> str:
    return CORE_KEY_ALIASES.get(key, key)


def row_value(row: dict[str, str], key: str) -> str:
    if key in row:
        return row.get(key, "")
    normalized = {normalize_header(header): value for header, value in row.items()}
    for candidate in [key, *FIELD_ALIASES.get(key, [])]:
        value = normalized.get(normalize_header(candidate))
        if value is not None:
            return value
    return ""


def normalize_header(value: str) -> str:
    return re.sub(r"[\s_()（）·/]+", "", value).lower()


def reference_type_id(type_name: str, index: int) -> str:
    if type_name in REFERENCE_TYPE_IDS:
        return REFERENCE_TYPE_IDS[type_name]
    slug = re.sub(r"[^a-z0-9]+", "_", type_name.lower()).strip("_")
    return f"reference_{slug}" if slug else f"reference_type_{index}"


def merge_reference_groups(
    historical_groups: list[dict[str, Any]],
    manual_groups: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    historical_ids = {group["id"] for group in historical_groups}
    return historical_groups + [group for group in manual_groups if group["id"] not in historical_ids]


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


def read_optional_rows(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    return read_rows(path)


def coerce_value(key: str, value: str) -> Any:
    if key in NUMERIC_FIELDS:
        return parse_number(value)
    return value


def parse_number(value: str) -> int | float:
    cleaned = value.replace(",", "").strip()
    number = float(cleaned)
    return int(number) if number.is_integer() else number


def optional_number(value: str | None) -> float | None:
    if value is None or value.strip() == "":
        return None
    return float(str(value).replace(",", "").strip())


def remove_empty_containers(value: Any) -> Any:
    if isinstance(value, dict):
        cleaned = {key: remove_empty_containers(item) for key, item in value.items()}
        return {key: item for key, item in cleaned.items() if item not in ({}, [], None, "")}
    if isinstance(value, list):
        return [remove_empty_containers(item) for item in value]
    return value


if __name__ == "__main__":
    main()
