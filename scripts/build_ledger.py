from __future__ import annotations

import argparse
import json
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


KST = timezone(timedelta(hours=9))

BRIEF_METRIC_IDS = [
    "total_visitors",
    "daily_visitors",
    "total_budget",
    "cost_per_visitor",
    "program_participants",
    "press_mentions",
]

UNIT_SUFFIX = {
    "people": "명",
    "count": "건",
    "program_count": "개",
    "percent": "%",
    "krw": "원",
    "krw_per_person": "원/명",
}


def main() -> None:
    parser = argparse.ArgumentParser(description="Build an Analysis Ledger from normalized exhibition input.")
    parser.add_argument("input", type=Path, help="Path to exhibition input JSON.")
    parser.add_argument("--json", dest="json_output", type=Path, default=Path("data/generated-ledger.json"))
    parser.add_argument("--js", dest="js_output", type=Path, default=Path("data/generated-ledger.js"))
    args = parser.parse_args()

    source = read_json(args.input)
    validate_minimum_input(source)
    ledger = build_ledger(source)

    write_json(args.json_output, ledger)
    write_js(args.js_output, ledger)

    print(
        json.dumps(
            {
                "input": str(args.input),
                "json_output": str(args.json_output),
                "js_output": str(args.js_output),
                "metrics": len(ledger["metrics"]),
                "observations": len(ledger["observations"]),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_js(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = "window.GENERATED_LEDGER = "
    text += json.dumps(payload, ensure_ascii=False, indent=2)
    text += ";\n"
    path.write_text(text, encoding="utf-8")


def validate_minimum_input(source: dict[str, Any]) -> None:
    required = ["exhibition", "audience", "budget", "programs", "publicity", "reference_groups"]
    missing = [field for field in required if field not in source]
    if missing:
        raise SystemExit(f"Missing required input fields: {', '.join(missing)}")

    if not source["reference_groups"]:
        raise SystemExit("At least one reference group is required.")

    audience = source["audience"]
    if audience.get("total_visitors", 0) <= 0:
        raise SystemExit("audience.total_visitors must be greater than 0.")
    if audience.get("operating_days", 0) <= 0 and not audience.get("daily_visitors"):
        raise SystemExit("audience.operating_days or audience.daily_visitors is required.")


def build_ledger(source: dict[str, Any]) -> dict[str, Any]:
    exhibition = source["exhibition"]
    reference_groups = source["reference_groups"]
    primary_ref = reference_groups[0]

    metrics = build_metrics(source, primary_ref)
    observations = []
    observations.extend(build_quantitative_observations(source, primary_ref, metrics))
    observations.extend(build_feedback_observations(source))
    observations.extend(build_data_quality_observations(source))

    return {
        "schema_version": "0.2.0",
        "report": {
            "id": exhibition["id"],
            "title": exhibition["title"],
            "period": exhibition["period"]["display"],
            "venue": exhibition.get("venue"),
            "generated_at": datetime.now(KST).isoformat(timespec="seconds"),
            "scope_note": exhibition.get(
                "scope_note",
                "정규화된 전시 입력 데이터를 바탕으로 생성된 Analysis Ledger입니다.",
            ),
            "brief_metric_ids": source.get("brief_metric_ids") or BRIEF_METRIC_IDS,
        },
        "reference_groups": [
            {
                "id": group["id"],
                "label": group["label"],
                "selection_rule": group["selection_rule"],
                "caveat": group["caveat"],
            }
            for group in reference_groups
        ],
        "metrics": metrics,
        "observations": observations,
    }


def build_metrics(source: dict[str, Any], reference_group: dict[str, Any]) -> list[dict[str, Any]]:
    audience = source["audience"]
    budget = source["budget"]
    programs = source["programs"]
    publicity = source["publicity"]
    ref = reference_group["metrics"]

    total_visitors = number(audience["total_visitors"])
    operating_days = number(audience.get("operating_days"))
    daily_visitors = number(audience.get("daily_visitors")) or round(total_visitors / operating_days, 1)
    total_budget = number(budget["total_budget"])
    cost_per_visitor = round(total_budget / total_visitors)
    program_participants = number(programs.get("participants", 0))
    press_mentions = number(publicity.get("press_mentions", 0))
    paid_audience_ratio = derive_paid_ratio(audience)

    metrics = [
        metric(
            "total_visitors",
            "총 관객 수",
            total_visitors,
            "people",
            context_against_reference(total_visitors, ref.get("total_visitors_avg"), "people", reference_group),
        ),
        metric(
            "daily_visitors",
            "일평균 관객",
            daily_visitors,
            "people",
            context_against_reference(daily_visitors, ref.get("daily_visitors_avg"), "people", reference_group),
        ),
        metric(
            "total_budget",
            "총 사용 예산",
            total_budget,
            "krw",
            context_against_reference(total_budget, ref.get("total_budget_avg"), "krw", reference_group),
        ),
        metric(
            "cost_per_visitor",
            "관객당 비용",
            cost_per_visitor,
            "krw_per_person",
            "총 사용 예산 / 총 관객 수",
        ),
        metric(
            "program_participants",
            "프로그램 참여 인원",
            program_participants,
            "people",
            context_against_reference(
                program_participants,
                ref.get("program_participants_avg"),
                "people",
                reference_group,
            ),
        ),
        metric(
            "press_mentions",
            "언론 보도 건수",
            press_mentions,
            "count",
            context_against_reference(press_mentions, ref.get("press_mentions_avg"), "count", reference_group),
        ),
    ]

    if paid_audience_ratio is not None:
        metrics.append(
            metric(
                "paid_audience_ratio",
                "유료 관객 비율",
                paid_audience_ratio,
                "percent",
                context_against_reference(
                    paid_audience_ratio,
                    ref.get("paid_audience_ratio_avg"),
                    "percent",
                    reference_group,
                ),
            )
        )

    return metrics


def build_quantitative_observations(
    source: dict[str, Any],
    reference_group: dict[str, Any],
    metrics: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    metric_map = {item["id"]: item for item in metrics}
    audience = source["audience"]
    budget = source["budget"]
    programs = source["programs"]
    publicity = source["publicity"]
    ref = reference_group["metrics"]
    ref_id = reference_group["id"]
    ref_label = reference_group["label"]
    ref_caveat = reference_group["caveat"]

    observations = []

    total = metric_map["total_visitors"]["value"]
    daily = metric_map["daily_visitors"]["value"]
    total_avg = ref.get("total_visitors_avg")
    daily_avg = ref.get("daily_visitors_avg")
    if total_avg:
        diff = pct_diff(total, total_avg)
        direction = direction_word(diff)
        observations.append(
            observation(
                id="obs-total-visitors-comparison",
                type="comparison",
                section="results",
                claim=f"총 관객 수와 일평균 관객 수가 {ref_label} 평균을 {direction}함",
                metric="total_visitors",
                current_value=total,
                unit="people",
                reference_group=ref_id,
                reference_avg=total_avg,
                difference_pct=diff,
                importance=importance_from_diff(diff, high=20, medium=8),
                statement_kind="comparative",
                tone="neutral",
                caveat=f"{ref_caveat} 성과 판정이 아니라 수치상 특이점으로 기록합니다.",
                recommended_wording=(
                    f"총 관객 수 {format_value(total, 'people')}, 일평균 {format_value(daily, 'people')}으로 "
                    f"{ref_label} 평균 대비 {direction_word(diff, noun=True)} 관객 규모가 확인됨."
                ),
                evidence=[
                    evidence("metric", "총 관객 수", format_value(total, "people")),
                    evidence("metric", f"{ref_label} 평균", format_value(total_avg, "people")),
                    evidence("calculation", "평균 대비 차이", signed_percent(diff)),
                    evidence("metric", "일평균 관객", format_value(daily, "people")),
                    evidence("metric", "일평균 기준값", format_value(daily_avg, "people")) if daily_avg else None,
                ],
                director_brief=True,
                detailed_section="IV. 전시 결과",
            )
        )

    total_budget = metric_map["total_budget"]["value"]
    cost_per_visitor = metric_map["cost_per_visitor"]["value"]
    cost_avg = ref.get("cost_per_visitor_avg")
    if cost_avg:
        diff = pct_diff(cost_per_visitor, cost_avg)
        budget_avg = ref.get("total_budget_avg")
        budget_clause = "총 사용 예산은 높은 편이나" if budget_avg and total_budget > budget_avg else "총 사용 예산과 관객 수를 함께 보면"
        observations.append(
            observation(
                id="obs-cost-per-visitor",
                type="derived_metric",
                section="results",
                claim="관객당 비용이 비교 기준 대비 산출됨",
                metric="cost_per_visitor",
                current_value=cost_per_visitor,
                unit="krw_per_person",
                reference_group=ref_id,
                reference_avg=cost_avg,
                difference_pct=diff,
                importance=importance_from_diff(diff, high=20, medium=10),
                statement_kind="comparative",
                tone="neutral",
                caveat="관객당 비용은 예산 총액과 관객 수만 반영하므로 전시의 질적 완성도나 제작 난이도를 직접 평가하지 않습니다.",
                recommended_wording=(
                    f"{budget_clause}, 관객당 비용은 {format_value(cost_per_visitor, 'krw_per_person')}으로 "
                    f"{ref_label} 기준값과 비교해 검토할 수 있음."
                ),
                evidence=[
                    evidence("metric", "총 사용 예산", format_value(total_budget, "krw")),
                    evidence("metric", "총 관객 수", format_value(total, "people")),
                    evidence("calculation", "관객당 비용", format_value(cost_per_visitor, "krw_per_person")),
                    evidence("metric", f"{ref_label} 기준값", format_value(cost_avg, "krw_per_person")),
                ],
                director_brief=True,
                detailed_section="IV. 전시 결과",
            )
        )

    paid_ratio = metric_map.get("paid_audience_ratio", {}).get("value")
    paid_avg = ref.get("paid_audience_ratio_avg")
    if paid_ratio is not None and paid_avg:
        diff_abs = round(paid_ratio - paid_avg, 1)
        direction = "낮게" if diff_abs < 0 else "높게" if diff_abs > 0 else "유사하게"
        observations.append(
            observation(
                id="obs-paid-audience-ratio",
                type="comparison",
                section="results",
                claim=f"유료 관객 비율은 {ref_label} 평균보다 {direction} 나타남",
                metric="paid_audience_ratio",
                current_value=paid_ratio,
                unit="percent",
                reference_group=ref_id,
                reference_avg=paid_avg,
                difference_abs=diff_abs,
                importance=importance_from_diff(diff_abs, high=15, medium=7),
                statement_kind="comparative",
                tone="neutral",
                caveat="초대, 제휴, 패스, 단체 관람 정책의 영향을 함께 확인해야 하며 수입 성과와 단순히 동일시할 수 없습니다.",
                recommended_wording=(
                    f"유료 관객 비율은 {format_value(paid_ratio, 'percent')}로 {ref_label} 평균과 차이를 보이며, "
                    "관객 확대와 수입 구조를 분리해 검토할 필요가 있음."
                ),
                evidence=[
                    evidence("metric", "유료 관객 비율", format_value(paid_ratio, "percent")),
                    evidence("metric", f"{ref_label} 평균", format_value(paid_avg, "percent")),
                    evidence("calculation", "차이", f"{signed_number(diff_abs)}%p"),
                    evidence("metric", "유료 관객 수", format_value(audience.get("paid_visitors"), "people")),
                ],
                director_brief=True,
                detailed_section="IV. 전시 결과",
            )
        )

    program_avg = ref.get("program_participants_avg")
    participants = metric_map["program_participants"]["value"]
    if program_avg:
        diff = pct_diff(participants, program_avg)
        direction = direction_word(diff)
        observations.append(
            observation(
                id="obs-program-participation",
                type="comparison",
                section="composition",
                claim=f"프로그램 참여 인원은 {ref_label} 평균을 {direction}함",
                metric="program_participants",
                current_value=participants,
                unit="people",
                reference_group=ref_id,
                reference_avg=program_avg,
                difference_pct=diff,
                importance=importance_from_diff(diff, high=25, medium=10),
                statement_kind="comparative",
                tone="neutral",
                caveat="프로그램 유형, 정원, 사전예약 방식이 다르면 단순 참여 인원 비교의 의미가 제한됩니다.",
                recommended_wording=(
                    f"프로그램 {format_value(programs.get('count'), 'program_count')} "
                    f"{format_number(programs.get('sessions', 0))}회차가 운영되었고, 참여 인원은 "
                    f"{format_value(participants, 'people')}으로 비교 기준 대비 {direction_word(diff, noun=True)} 수준임."
                ),
                evidence=[
                    evidence("metric", "프로그램 참여 인원", format_value(participants, "people")),
                    evidence("metric", f"{ref_label} 평균", format_value(program_avg, "people")),
                    evidence("metric", "프로그램 참여율", format_value(programs.get("participation_rate"), "percent")),
                    evidence("calculation", "평균 대비 차이", signed_percent(diff)),
                ],
                director_brief=True,
                detailed_section="III. 전시 구성",
            )
        )

    press_avg = ref.get("press_mentions_avg")
    press_mentions = metric_map["press_mentions"]["value"]
    if press_avg:
        diff = pct_diff(press_mentions, press_avg)
        observations.append(
            observation(
                id="obs-publicity-reference",
                type="interpretive_note",
                section="publicity",
                claim="언론 보도와 자체 채널 지표는 관객 유입 가능성과 함께 참고할 만함",
                metric="press_mentions",
                current_value=press_mentions,
                unit="count",
                reference_group=ref_id,
                reference_avg=press_avg,
                difference_pct=diff,
                importance="medium",
                statement_kind="interpretive",
                tone="restrained",
                caveat="언론 보도 건수와 SNS 게시 수만으로 관객 유입의 인과관계를 확정할 수 없습니다.",
                recommended_wording=(
                    f"언론 보도 {format_value(press_mentions, 'count')}과 SNS 게시 "
                    f"{format_value(publicity.get('sns_posts', 0), 'count')}은 관객 유입과의 직접 인과가 아니라 "
                    "홍보 활동의 참고 지표로 다루는 것이 적절함."
                ),
                evidence=[
                    evidence("metric", "언론 보도 건수", format_value(press_mentions, "count")),
                    evidence("metric", "SNS 게시 건수", format_value(publicity.get("sns_posts", 0), "count")),
                    evidence("metric", f"{ref_label} 보도 평균", format_value(press_avg, "count")),
                    evidence("calculation", "보도 1건당 관객 수", format_value(round(total / press_mentions), "people"))
                    if press_mentions
                    else None,
                ],
                director_brief=False,
                detailed_section="V. 홍보 방식 및 언론 보도",
            )
        )

    return observations


def build_feedback_observations(source: dict[str, Any]) -> list[dict[str, Any]]:
    feedback = source.get("selected_feedback") or []
    if not feedback:
        return []

    by_bucket: dict[str, list[dict[str, Any]]] = {}
    for item in feedback:
        bucket = "critical" if item["polarity"] in {"critical", "suggestion"} else "positive"
        key = f"{bucket}:{item['theme']}"
        by_bucket.setdefault(key, []).append(item)

    observations = []
    for index, (key, items) in enumerate(by_bucket.items(), start=1):
        bucket, theme = key.split(":", 1)
        is_critical = bucket == "critical"
        claim = (
            f"선별된 부정/건의 반응에서 {theme}에 대한 언급이 확인됨"
            if is_critical
            else f"선별된 관객 후기에서 {theme}에 대한 긍정 반응이 확인됨"
        )
        wording = (
            f"선별된 부정 및 건의 반응에서는 {theme}에 관한 의견이 확인됨."
            if is_critical
            else f"선별 입력된 관객 후기에서는 {theme}에 관한 언급이 확인됨."
        )
        observations.append(
            observation(
                id=f"obs-feedback-{index}",
                type="qualitative_observation",
                section="audience_response",
                claim=claim,
                source_type="curated_social_feedback",
                representativeness="selected_not_representative",
                importance="medium",
                statement_kind="interpretive",
                tone="restrained",
                caveat="아래 반응은 전체 관객 의견의 통계적 표본이 아니라 보고서 작성자가 선별 입력한 후기입니다.",
                recommended_wording=wording,
                evidence=[evidence("quote", item["source"], item["quote"]) for item in items],
                director_brief=is_critical,
                detailed_section="VI. 종합 기록",
            )
        )

    return observations


def build_data_quality_observations(source: dict[str, Any]) -> list[dict[str, Any]]:
    checks = source.get("data_quality_checks") or []
    observations = []

    for item in checks:
        observations.append(
            observation(
                id=f"obs-data-{item['id']}",
                type="data_quality",
                section="data_quality",
                claim=item["claim"],
                importance=item.get("importance", "medium"),
                statement_kind="data_quality",
                tone="neutral",
                caveat=item.get("caveat", "보고서 생성 전 원자료 확인이 필요합니다."),
                recommended_wording=f"데이터 검증 필요: {item['claim']}",
                evidence=[evidence("source", source_item["label"], source_item["value"]) for source_item in item["sources"]],
                director_brief=True,
                detailed_section="데이터 검증 로그",
            )
        )

    return observations


def metric(id: str, label: str, value: float, unit: str, context: str) -> dict[str, Any]:
    return {
        "id": id,
        "label": label,
        "value": clean_number(value),
        "unit": unit,
        "context": context,
    }


def observation(**kwargs: Any) -> dict[str, Any]:
    director_brief = kwargs.pop("director_brief")
    detailed_section = kwargs.pop("detailed_section")
    kwargs["evidence"] = [item for item in kwargs.get("evidence", []) if item]
    kwargs["report_placement"] = {
        "director_brief": director_brief,
        "detailed_section": detailed_section,
    }
    return kwargs


def evidence(kind: str, label: str, value: Any) -> dict[str, str] | None:
    if value is None:
        return None
    return {
        "kind": kind,
        "label": label,
        "value": str(value),
    }


def derive_paid_ratio(audience: dict[str, Any]) -> float | None:
    total = number(audience.get("total_visitors"))
    paid = audience.get("paid_visitors")
    if total and paid is not None:
        return round(number(paid) / total * 100, 1)
    return None


def context_against_reference(
    value: float,
    reference_value: float | None,
    unit: str,
    reference_group: dict[str, Any],
) -> str:
    if reference_value is None:
        return "비교 기준값 없음"
    diff = pct_diff(value, reference_value)
    return f"{reference_group['label']} 평균 {format_value(reference_value, unit)} 대비 {direction_word(diff)}"


def pct_diff(value: float, reference_value: float) -> float:
    if reference_value == 0:
        return 0.0
    return round((value - reference_value) / reference_value * 100, 1)


def direction_word(diff: float, noun: bool = False) -> str:
    if abs(diff) < 0.5:
        return "유사" if noun else "유사"
    if diff > 0:
        return "높은" if noun else "상회"
    return "낮은" if noun else "하회"


def importance_from_diff(diff: float, high: float, medium: float) -> str:
    magnitude = abs(diff)
    if magnitude >= high:
        return "high"
    if magnitude >= medium:
        return "medium"
    return "low"


def format_value(value: Any, unit: str) -> str:
    if value is None:
        return "-"
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    suffix = UNIT_SUFFIX.get(unit, unit)
    if unit == "percent":
        return f"{format_number(value)}{suffix}"
    return f"{format_number(value)}{suffix}"


def format_number(value: Any) -> str:
    if value is None:
        return "-"
    if isinstance(value, float) and not value.is_integer():
        return f"{value:,.1f}"
    return f"{int(value):,}" if isinstance(value, (int, float)) else str(value)


def signed_percent(value: float) -> str:
    return f"{signed_number(value)}%"


def signed_number(value: float) -> str:
    if math.isclose(value, 0):
        return "0"
    prefix = "+" if value > 0 else ""
    return f"{prefix}{format_number(value)}"


def number(value: Any) -> float:
    if value is None:
        return 0.0
    return float(value)


def clean_number(value: Any) -> int | float:
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value


if __name__ == "__main__":
    main()
