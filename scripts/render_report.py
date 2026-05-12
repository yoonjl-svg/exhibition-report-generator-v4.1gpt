from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path
from typing import Any


UNIT_SUFFIX = {
    "people": "명",
    "count": "건",
    "program_count": "개",
    "percent": "%",
    "krw": "원",
    "krw_per_person": "원/명",
}


SECTION_ORDER = [
    "I. 전시 개요",
    "II. 핵심 수치 종합",
    "III. 전시 구성",
    "IV. 전시 결과",
    "V. 홍보 방식 및 언론 보도",
    "VI. 종합 기록",
    "데이터 검증 로그",
]


def main() -> None:
    parser = argparse.ArgumentParser(description="Render an Analysis Ledger into a Markdown report draft.")
    parser.add_argument("ledger", type=Path, help="Path to generated-ledger.json.")
    parser.add_argument("--markdown", type=Path, default=Path("output/report-draft.md"))
    parser.add_argument("--js", type=Path, default=Path("data/generated-report.js"))
    args = parser.parse_args()

    ledger = json.loads(args.ledger.read_text(encoding="utf-8"))
    markdown = render_report(ledger)

    args.markdown.parent.mkdir(parents=True, exist_ok=True)
    args.markdown.write_text(markdown + "\n", encoding="utf-8")

    args.js.parent.mkdir(parents=True, exist_ok=True)
    args.js.write_text("window.GENERATED_REPORT_MARKDOWN = " + json.dumps(markdown, ensure_ascii=False) + ";\n", encoding="utf-8")

    print(
        json.dumps(
            {
                "ledger": str(args.ledger),
                "markdown": str(args.markdown),
                "js": str(args.js),
                "characters": len(markdown),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


def render_report(ledger: dict[str, Any]) -> str:
    report = ledger["report"]
    observations = ledger.get("observations", [])
    director_observations = [
        item
        for item in observations
        if item.get("report_placement", {}).get("director_brief") and item.get("statement_kind") != "data_quality"
    ]
    data_quality = [item for item in observations if item.get("statement_kind") == "data_quality"]

    lines: list[str] = []
    lines.append(f"# {report['title']}")
    lines.append("")
    lines.append("## I. 전시 개요")
    lines.append("")
    add_kv(lines, "전시 기간", report.get("period"))
    add_kv(lines, "장소", report.get("venue"))
    add_kv(lines, "작성 기준", report.get("scope_note"))
    lines.append("")

    lines.append("## II. 핵심 수치 종합")
    lines.append("")
    lines.append("| 항목 | 값 | 참고 |")
    lines.append("| --- | ---: | --- |")
    for metric in brief_metrics(ledger):
        lines.append(
            f"| {metric['label']} | {format_value(metric.get('value'), metric.get('unit'))} | {metric.get('context', '')} |"
        )
    lines.append("")

    lines.append("## III. 핵심 관찰 요약")
    lines.append("")
    if director_observations:
        for item in sorted(director_observations, key=importance_rank):
            lines.append(f"- {item.get('recommended_wording') or item.get('claim')}")
            if item.get("caveat"):
                lines.append(f"  - 한계: {item['caveat']}")
    else:
        lines.append("- 핵심 관찰 후보가 없습니다.")
    lines.append("")

    for section in ordered_sections(observations):
        section_items = [
            item
            for item in observations
            if item.get("report_placement", {}).get("detailed_section") == section
            and item.get("statement_kind") != "data_quality"
        ]
        if not section_items:
            continue
        lines.append(f"## {section}")
        lines.append("")
        for item in section_items:
            lines.append(f"### {item.get('claim')}")
            lines.append("")
            lines.append(item.get("recommended_wording") or item.get("claim", ""))
            if item.get("caveat"):
                lines.append("")
                lines.append(f"한계: {item['caveat']}")
            if item.get("evidence"):
                lines.append("")
                lines.append("근거:")
                for evidence in item["evidence"]:
                    lines.append(f"- {evidence_text(evidence)}")
            lines.append("")

    if data_quality:
        lines.append("## 데이터 검증 로그")
        lines.append("")
        for item in data_quality:
            lines.append(f"- {item.get('recommended_wording') or item.get('claim')}")
            if item.get("caveat"):
                lines.append(f"  - 확인 필요: {item['caveat']}")
            for evidence in item.get("evidence", []):
                lines.append(f"  - {evidence_text(evidence)}")
        lines.append("")

    lines.append("---")
    lines.append("")
    lines.append("이 문서는 Analysis Ledger에서 자동 렌더링한 보고서 초안입니다. 최종 문안 확정 전 담당자의 검토가 필요합니다.")
    return "\n".join(lines).strip()


def add_kv(lines: list[str], label: str, value: Any) -> None:
    if value:
        lines.append(f"- {label}: {value}")


def brief_metrics(ledger: dict[str, Any]) -> list[dict[str, Any]]:
    metric_map = {metric["id"]: metric for metric in ledger.get("metrics", [])}
    return [metric_map[item] for item in ledger.get("report", {}).get("brief_metric_ids", []) if item in metric_map]


def ordered_sections(observations: list[dict[str, Any]]) -> list[str]:
    sections = {item.get("report_placement", {}).get("detailed_section") for item in observations}
    sections.discard(None)
    known = [section for section in SECTION_ORDER if section in sections and section != "데이터 검증 로그"]
    unknown = sorted(section for section in sections if section not in SECTION_ORDER)
    return known + unknown


def evidence_text(evidence: dict[str, Any]) -> str:
    value = f": {evidence['value']}" if evidence.get("value") is not None else ""
    note = f" ({evidence['note']})" if evidence.get("note") else ""
    return f"{evidence.get('label', '')}{value}{note}"


def importance_rank(item: dict[str, Any]) -> int:
    return {"high": 0, "medium": 1, "low": 2}.get(item.get("importance"), 3)


def format_value(value: Any, unit: str | None) -> str:
    if value is None:
        return "-"
    suffix = UNIT_SUFFIX.get(unit or "", unit or "")
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    if isinstance(value, float):
        formatted = f"{value:,.1f}"
    elif isinstance(value, int):
        formatted = f"{value:,}"
    else:
        formatted = str(value)
    return f"{formatted}{suffix}"


if __name__ == "__main__":
    main()
