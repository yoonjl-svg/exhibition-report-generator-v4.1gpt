from __future__ import annotations

import argparse
import json
from pathlib import Path

from build_ledger import build_ledger, validate_minimum_input, write_js, write_json
from csv_input_to_json import build_input
from render_docx import write_docx
from render_report import build_report_model, render_html, render_markdown


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the full CSV-to-report build pipeline.")
    parser.add_argument("--csv-dir", type=Path, default=Path("templates/sample-input"))
    parser.add_argument("--input-json", type=Path, default=Path("data/sample-input.json"))
    parser.add_argument("--ledger-json", type=Path, default=Path("data/generated-ledger.json"))
    parser.add_argument("--ledger-js", type=Path, default=Path("data/generated-ledger.js"))
    parser.add_argument("--markdown", type=Path, default=Path("output/report-draft.md"))
    parser.add_argument("--html", type=Path, default=Path("output/report-draft.html"))
    parser.add_argument("--report-js", type=Path, default=Path("data/generated-report.js"))
    parser.add_argument("--docx", type=Path, default=Path("output/report-draft.docx"))
    args = parser.parse_args()

    source = build_input(args.csv_dir)
    args.input_json.parent.mkdir(parents=True, exist_ok=True)
    args.input_json.write_text(json.dumps(source, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    validate_minimum_input(source)
    ledger = build_ledger(source)
    write_json(args.ledger_json, ledger)
    write_js(args.ledger_js, ledger)

    model = build_report_model(ledger)
    markdown = render_markdown(model)
    html_text = render_html(model)

    args.markdown.parent.mkdir(parents=True, exist_ok=True)
    args.markdown.write_text(markdown + "\n", encoding="utf-8")

    args.html.parent.mkdir(parents=True, exist_ok=True)
    args.html.write_text(html_text + "\n", encoding="utf-8")

    args.report_js.parent.mkdir(parents=True, exist_ok=True)
    args.report_js.write_text(
        "window.GENERATED_REPORT = "
        + json.dumps({"title": model["title"], "markdown": markdown, "html": html_text}, ensure_ascii=False)
        + ";\nwindow.GENERATED_REPORT_MARKDOWN = window.GENERATED_REPORT.markdown;\n",
        encoding="utf-8",
    )

    args.docx.parent.mkdir(parents=True, exist_ok=True)
    write_docx(args.docx, model)

    print(
        json.dumps(
            {
                "csv_dir": str(args.csv_dir),
                "input_json": str(args.input_json),
                "ledger_json": str(args.ledger_json),
                "ledger_js": str(args.ledger_js),
                "markdown": str(args.markdown),
                "html": str(args.html),
                "report_js": str(args.report_js),
                "docx": str(args.docx),
                "metrics": len(ledger.get("metrics", [])),
                "observations": len(ledger.get("observations", [])),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
