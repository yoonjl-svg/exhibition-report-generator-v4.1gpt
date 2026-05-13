from __future__ import annotations

import argparse
import json
from pathlib import Path

from build_ledger import build_ledger, validate_minimum_input, write_js, write_json, write_text_lf
from csv_input_to_json import build_input, build_input_path
from render_docx import write_docx
from render_report import build_report_model, render_html, render_markdown
from excel_template import write_template_xlsx


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the full input-to-report build pipeline.")
    parser.add_argument("--csv-dir", type=Path, default=Path("templates/sample-input"))
    parser.add_argument("--xlsx-input", type=Path, default=None)
    parser.add_argument("--xlsx-template", type=Path, default=Path("templates/ilmin-report-input-template.xlsx"))
    parser.add_argument("--input-json", type=Path, default=Path("data/sample-input.json"))
    parser.add_argument("--ledger-json", type=Path, default=Path("data/generated-ledger.json"))
    parser.add_argument("--ledger-js", type=Path, default=Path("data/generated-ledger.js"))
    parser.add_argument("--markdown", type=Path, default=Path("output/report-draft.md"))
    parser.add_argument("--html", type=Path, default=Path("output/report-draft.html"))
    parser.add_argument("--report-js", type=Path, default=Path("data/generated-report.js"))
    parser.add_argument("--docx", type=Path, default=Path("output/report-draft.docx"))
    args = parser.parse_args()

    source = build_input(args.csv_dir) if args.xlsx_input is None else build_input_path(args.xlsx_input)
    args.input_json.parent.mkdir(parents=True, exist_ok=True)
    write_text_lf(args.input_json, json.dumps(source, ensure_ascii=False, indent=2) + "\n")

    validate_minimum_input(source)
    ledger = build_ledger(source)
    write_json(args.ledger_json, ledger)
    write_js(args.ledger_js, ledger)

    model = build_report_model(ledger)
    markdown = render_markdown(model)
    html_text = render_html(model)

    args.markdown.parent.mkdir(parents=True, exist_ok=True)
    write_text_lf(args.markdown, markdown + "\n")

    args.html.parent.mkdir(parents=True, exist_ok=True)
    write_text_lf(args.html, html_text + "\n")

    args.report_js.parent.mkdir(parents=True, exist_ok=True)
    write_text_lf(
        args.report_js,
        "window.GENERATED_REPORT = "
        + json.dumps({"title": model["title"], "markdown": markdown, "html": html_text}, ensure_ascii=False)
        + ";\nwindow.GENERATED_REPORT_MARKDOWN = window.GENERATED_REPORT.markdown;\n",
    )

    args.docx.parent.mkdir(parents=True, exist_ok=True)
    write_docx(args.docx, model)

    template_written = False
    if args.xlsx_template and (
        args.xlsx_input is None or args.xlsx_template.resolve() != args.xlsx_input.resolve()
    ):
        write_template_xlsx(args.csv_dir, args.xlsx_template)
        template_written = True

    print(
        json.dumps(
            {
                "csv_dir": str(args.csv_dir),
                "xlsx_input": str(args.xlsx_input) if args.xlsx_input else None,
                "xlsx_template": str(args.xlsx_template),
                "xlsx_template_written": template_written,
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
