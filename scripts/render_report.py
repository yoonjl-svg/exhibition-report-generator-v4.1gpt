from __future__ import annotations

import argparse
import html
import json
from pathlib import Path
from typing import Any

from build_ledger import write_text_lf


UNIT_SUFFIX = {
    "people": "명",
    "count": "건",
    "score": "점",
    "session_count": "회",
    "program_count": "개",
    "percent": "%",
    "krw": "원",
    "krw_per_person": "원/명",
}

SECTION_TITLES = [
    ("I", "전시 개요"),
    ("II", "핵심 수치 종합"),
    ("III", "주요 관찰"),
    ("IV", "세부 관찰"),
    ("V", "관객 반응 기록"),
]

DETAIL_SECTION_MAP = {
    "III. 전시 구성": ("III", "전시 구성"),
    "IV. 전시 결과": ("IV", "전시 결과"),
    "V. 홍보 방식 및 언론 보도": ("V", "홍보 방식 및 언론 보도"),
    "VI. 종합 기록": ("VI", "평가 및 개선방안"),
}


def main() -> None:
    parser = argparse.ArgumentParser(description="Render an Analysis Ledger into formatted report outputs.")
    parser.add_argument("ledger", type=Path, help="Path to generated-ledger.json.")
    parser.add_argument("--markdown", type=Path, default=Path("output/report-draft.md"))
    parser.add_argument("--html", dest="html_output", type=Path, default=Path("output/report-draft.html"))
    parser.add_argument("--js", dest="js_output", type=Path, default=Path("data/generated-report.js"))
    args = parser.parse_args()

    ledger = json.loads(args.ledger.read_text(encoding="utf-8"))
    model = build_report_model(ledger)
    markdown = render_markdown(model)
    html_text = render_html(model)

    args.markdown.parent.mkdir(parents=True, exist_ok=True)
    write_text_lf(args.markdown, markdown + "\n")

    args.html_output.parent.mkdir(parents=True, exist_ok=True)
    write_text_lf(args.html_output, html_text + "\n")

    args.js_output.parent.mkdir(parents=True, exist_ok=True)
    write_text_lf(
        args.js_output,
        "window.GENERATED_REPORT = "
        + json.dumps({"title": model["title"], "markdown": markdown, "html": html_text}, ensure_ascii=False)
        + ";\nwindow.GENERATED_REPORT_MARKDOWN = window.GENERATED_REPORT.markdown;\n",
    )

    print(
        json.dumps(
            {
                "ledger": str(args.ledger),
                "markdown": str(args.markdown),
                "html": str(args.html_output),
                "js": str(args.js_output),
                "characters": len(markdown),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


def build_report_model(ledger: dict[str, Any]) -> dict[str, Any]:
    report = ledger["report"]
    metrics = {metric["id"]: metric for metric in ledger.get("metrics", [])}
    observations = ledger.get("observations", [])
    narrative = report.get("narrative", {})

    result_observations = by_detail_section(observations, "IV. 전시 결과")
    composition_observations = by_detail_section(observations, "III. 전시 구성")
    publicity_observations = by_detail_section(observations, "V. 홍보 방식 및 언론 보도")
    audience_observations = by_detail_section(observations, "VI. 종합 기록")
    director_observations = [
        item
        for item in observations
        if item.get("report_placement", {}).get("director_brief") and item.get("statement_kind") != "data_quality"
    ]

    overview_rows = [
        ["전시 제목", report.get("title", "")],
        ["전시 기간", report.get("period", "")],
        ["장소", report.get("venue", "")],
        ["총 사용 예산", metric_value(metrics.get("total_budget"))],
        ["관객 수", audience_summary(metrics)],
        ["프로그램", program_summary(metrics)],
    ]

    sections = [
        {
            "number": "I",
            "title": "전시 개요",
            "blocks": [
                {"type": "table", "rows": overview_rows},
                {"type": "paragraph", "text": narrative.get("theme_and_content") or report.get("scope_note", "")},
            ],
        },
        {
            "number": "II",
            "title": "핵심 수치 종합",
            "blocks": [
                {"type": "metrics", "metrics": brief_metrics(ledger)},
            ],
        },
        {
            "number": "III",
            "title": "주요 관찰",
            "blocks": [
                {
                    "type": "paragraph",
                    "text": "아래 내용은 자동 판정이 아니라 Analysis Ledger에서 도출한 관찰 후보입니다.",
                },
                *bullet_observation_blocks(sorted(director_observations, key=importance_rank)),
            ],
        },
        {
            "number": "IV",
            "title": "세부 관찰",
            "blocks": [
                {"type": "subheading", "text": "1. 전시 구성"},
                {
                    "type": "paragraph",
                    "text": narrative.get(
                        "composition_note",
                        "전시 구성 세부 내용은 입력 템플릿의 narrative.composition_note 항목에 입력합니다.",
                    ),
                },
                *observation_blocks(composition_observations),
                {"type": "subheading", "text": "2. 전시 결과"},
                *observation_blocks(result_observations),
                {"type": "subheading", "text": "3. 홍보 및 언론"},
                *observation_blocks(publicity_observations),
            ],
        },
        {
            "number": "V",
            "title": "관객 반응 기록",
            "blocks": observation_blocks(audience_observations),
        },
    ]

    return {
        "title": report.get("title", "전시보고서"),
        "period": report.get("period", ""),
        "generated_at": report.get("generated_at", ""),
        "sections": sections,
    }


def render_markdown(model: dict[str, Any]) -> str:
    lines = [f"# {model['title']}", ""]
    lines.append("## 목차")
    lines.append("")
    for number, title in SECTION_TITLES:
        lines.append(f"- {number}. {title}")
    lines.append("")

    for section in model["sections"]:
        lines.append(f"## {section['number']}. {section['title']}")
        lines.append("")
        for block in section["blocks"]:
            render_markdown_block(lines, block)
        lines.append("")

    lines.append("끝.")
    return "\n".join(lines).strip()


def render_markdown_block(lines: list[str], block: dict[str, Any]) -> None:
    block_type = block["type"]
    if block_type == "paragraph":
        if block.get("text"):
            lines.append(block["text"])
            lines.append("")
    elif block_type == "subheading":
        lines.append(f"### {block['text']}")
        lines.append("")
    elif block_type == "table":
        lines.append("| 항목 | 내용 |")
        lines.append("| --- | --- |")
        for label, value in block["rows"]:
            if value:
                lines.append(f"| {label} | {value} |")
        lines.append("")
    elif block_type == "metrics":
        lines.append("| 항목 | 값 | 참고 |")
        lines.append("| --- | ---: | --- |")
        for metric in block["metrics"]:
            lines.append(
                f"| {metric['label']} | {format_value(metric.get('value'), metric.get('unit'))} | {metric.get('context', '')} |"
            )
        lines.append("")
    elif block_type == "observation":
        lines.append(f"### {block['claim']}")
        lines.append("")
        lines.append(block["wording"])
        lines.append("")
        if block.get("evidence"):
            lines.append("근거:")
            for item in block["evidence"]:
                lines.append(f"- {evidence_text(item)}")
            lines.append("")
    elif block_type == "bullet":
        lines.append(f"- {block['text']}")
    elif block_type == "data_quality":
        lines.append(f"- {block['text']}")
        if block.get("caveat"):
            lines.append(f"  - 확인 필요: {block['caveat']}")
        for item in block.get("evidence", []):
            lines.append(f"  - {evidence_text(item)}")


def render_html(model: dict[str, Any]) -> str:
    body = []
    body.append("<!doctype html>")
    body.append('<html lang="ko">')
    body.append("<head>")
    body.append('<meta charset="utf-8" />')
    body.append('<meta name="viewport" content="width=device-width, initial-scale=1" />')
    body.append(f"<title>{escape(model['title'])}</title>")
    body.append("<style>")
    body.append(REPORT_CSS)
    body.append("</style>")
    body.append("</head>")
    body.append("<body>")
    body.append('<main class="page">')
    body.append('<section class="cover">')
    body.append("<p>일민미술관 전시보고서</p>")
    body.append(f"<h1>{escape(model['title'])}</h1>")
    if model.get("period"):
        body.append(f"<div>{escape(model['period'])}</div>")
    body.append("</section>")
    body.append('<section class="toc">')
    body.append("<h2>목차</h2>")
    body.append("<ol>")
    for number, title in SECTION_TITLES:
        body.append(f"<li><span>{number}.</span>{escape(title)}</li>")
    body.append("</ol>")
    body.append("</section>")

    for section in model["sections"]:
        body.append('<section class="report-section">')
        body.append(f"<h2>{section['number']}. {escape(section['title'])}</h2>")
        for block in section["blocks"]:
            body.append(render_html_block(block))
        body.append("</section>")

    body.append('<p class="end">끝.</p>')
    body.append("</main>")
    body.append("</body>")
    body.append("</html>")
    return "\n".join(body)


def render_html_block(block: dict[str, Any]) -> str:
    block_type = block["type"]
    if block_type == "paragraph":
        return f"<p>{escape(block.get('text', ''))}</p>" if block.get("text") else ""
    if block_type == "subheading":
        return f"<h3>{escape(block['text'])}</h3>"
    if block_type == "table":
        rows = "".join(
            f"<tr><th>{escape(label)}</th><td>{escape(value)}</td></tr>" for label, value in block["rows"] if value
        )
        return f'<table class="info-table"><tbody>{rows}</tbody></table>'
    if block_type == "metrics":
        rows = "".join(
            "<tr>"
            f"<td>{escape(metric['label'])}</td>"
            f"<td class=\"num\">{escape(format_value(metric.get('value'), metric.get('unit')))}</td>"
            f"<td>{escape(metric.get('context', ''))}</td>"
            "</tr>"
            for metric in block["metrics"]
        )
        return (
            '<table class="metric-table">'
            "<thead><tr><th>항목</th><th>값</th><th>참고</th></tr></thead>"
            f"<tbody>{rows}</tbody></table>"
        )
    if block_type == "observation":
        evidence = "".join(f"<li>{escape(evidence_text(item))}</li>" for item in block.get("evidence", []))
        evidence_html = f"<p class=\"evidence-label\">근거</p><ul>{evidence}</ul>" if evidence else ""
        return (
            '<article class="observation">'
            f"<h3>{escape(block['claim'])}</h3>"
            f"<p>{escape(block['wording'])}</p>"
            f"{evidence_html}</article>"
        )
    if block_type == "bullet":
        return f'<div class="bullet">• {escape(block["text"])}</div>'
    if block_type == "data_quality":
        evidence = "".join(f"<li>{escape(evidence_text(item))}</li>" for item in block.get("evidence", []))
        caveat = f'<p class="caveat">확인 필요: {escape(block["caveat"])}</p>' if block.get("caveat") else ""
        return f'<article class="data-quality"><p>• {escape(block["text"])}</p>{caveat}<ul>{evidence}</ul></article>'
    return ""


def by_detail_section(observations: list[dict[str, Any]], detail_section: str) -> list[dict[str, Any]]:
    return [item for item in observations if item.get("report_placement", {}).get("detailed_section") == detail_section]


def observation_blocks(observations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "type": "observation",
            "claim": item.get("claim", ""),
            "wording": item.get("recommended_wording") or item.get("claim", ""),
            "caveat": item.get("caveat"),
            "evidence": item.get("evidence", []),
        }
        for item in observations
    ]


def bullet_observation_blocks(observations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "type": "bullet",
            "text": item.get("recommended_wording") or item.get("claim", ""),
            "caveat": item.get("caveat"),
        }
        for item in observations
    ]


def data_quality_blocks(observations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "type": "data_quality",
            "text": item.get("recommended_wording") or item.get("claim", ""),
            "caveat": item.get("caveat"),
            "evidence": item.get("evidence", []),
        }
        for item in observations
    ]


def brief_metrics(ledger: dict[str, Any]) -> list[dict[str, Any]]:
    metric_map = {metric["id"]: metric for metric in ledger.get("metrics", [])}
    return [metric_map[item] for item in ledger.get("report", {}).get("brief_metric_ids", []) if item in metric_map]


def metric_value(metric: dict[str, Any] | None) -> str:
    if not metric:
        return ""
    return format_value(metric.get("value"), metric.get("unit"))


def audience_summary(metrics: dict[str, dict[str, Any]]) -> str:
    total = metric_value(metrics.get("total_visitors"))
    daily = metric_value(metrics.get("daily_visitors"))
    if total and daily:
        return f"{total}(일평균 {daily})"
    return total or daily


def program_summary(metrics: dict[str, dict[str, Any]]) -> str:
    participants = metric_value(metrics.get("program_participants"))
    return f"프로그램 참여 인원 {participants}" if participants else ""


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


def escape(value: Any) -> str:
    return html.escape(str(value or ""), quote=True)


REPORT_CSS = """
@page {
  size: A4;
  margin: 20mm 18mm;
}
* {
  box-sizing: border-box;
}
body {
  margin: 0;
  color: #111;
  background: #e9e9e9;
  font-family: "Malgun Gothic", "Noto Sans KR", Arial, sans-serif;
  font-size: 10.5pt;
  line-height: 1.75;
}
.page {
  width: 210mm;
  min-height: 297mm;
  margin: 24px auto;
  padding: 22mm 18mm;
  background: #fff;
  box-shadow: 0 10px 30px rgba(0,0,0,.14);
}
.cover {
  margin-bottom: 26mm;
  padding-top: 22mm;
  border-top: 4px solid #111;
}
.cover p {
  margin: 0 0 20mm;
  font-weight: 700;
}
h1 {
  margin: 0 0 8mm;
  font-size: 22pt;
  line-height: 1.35;
  word-break: keep-all;
}
h2 {
  margin: 14mm 0 5mm;
  padding-bottom: 2mm;
  border-bottom: 1.5px solid #111;
  font-size: 15pt;
}
h3 {
  margin: 7mm 0 2mm;
  font-size: 11.5pt;
}
p {
  margin: 0 0 4mm;
  word-break: keep-all;
}
.toc {
  margin-bottom: 12mm;
}
.toc ol {
  margin: 0;
  padding: 0;
  list-style: none;
}
.toc li {
  display: flex;
  gap: 8mm;
  padding: 1.5mm 0;
  border-bottom: 1px solid #ddd;
}
.toc span {
  min-width: 12mm;
  font-weight: 700;
}
table {
  width: 100%;
  margin: 4mm 0 7mm;
  border-collapse: collapse;
  table-layout: fixed;
}
th,
td {
  border: 1px solid #b8b8b8;
  padding: 2.5mm 3mm;
  vertical-align: top;
}
th {
  width: 30mm;
  background: #f2f2f2;
  font-weight: 700;
  text-align: left;
}
.metric-table th {
  width: auto;
}
.metric-table .num {
  text-align: right;
  white-space: nowrap;
}
.observation,
.data-quality {
  break-inside: avoid;
  margin-bottom: 7mm;
}
.caveat {
  margin-top: 2mm;
  padding-left: 3mm;
  border-left: 3px solid #777;
  color: #444;
}
.evidence-label {
  margin: 3mm 0 1mm;
  font-weight: 700;
}
ul {
  margin: 0 0 5mm 6mm;
  padding-left: 4mm;
}
.bullet {
  margin: 0 0 4mm;
  padding-left: 5mm;
  text-indent: -5mm;
}
.bullet span {
  display: block;
  margin-left: 5mm;
  color: #444;
}
.end {
  margin-top: 12mm;
  text-align: right;
}
@media print {
  body {
    background: #fff;
  }
  .page {
    width: auto;
    min-height: auto;
    margin: 0;
    padding: 0;
    box-shadow: none;
  }
}
"""


if __name__ == "__main__":
    main()
