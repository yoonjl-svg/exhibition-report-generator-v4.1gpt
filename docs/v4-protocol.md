# v4 Protocol

This protocol defines how v4 should move from raw exhibition records to a director-readable report without allowing the system to overclaim.

## 1. Normalize Input

Curator-authored input is stored as `data/sample-input.json` and validated against the draft shape in `schemas/exhibition-input.schema.json`.

For practical entry, v4.7 provides a single Excel workbook at `templates/ilmin-report-input-template.xlsx`.

```text
templates/ilmin-report-input-template.xlsx
  - core
  - reference-groups
  - selected-feedback
  - data-quality
-> scripts/csv_input_to_json.py
-> data/sample-input.json
```

The input should separate:

- exhibition basics
- audience data
- budget data
- program data
- publicity data
- selected audience feedback
- explicit reference groups
- data quality checks

Selected audience feedback must remain selected feedback. It should not be treated as a statistical audience survey unless the collection method supports that.

## 2. Generate Metrics

The builder derives a stable metric list from the input.

Examples:

- total visitors
- daily visitors
- total budget
- cost per visitor
- program participants
- press mentions
- paid audience ratio

Each metric carries a context string when a reference value exists.

## 3. Generate Observations

The builder turns metrics and selected qualitative records into Analysis Ledger observations.

Each observation must carry:

- claim
- statement kind
- evidence
- caveat
- importance
- intended report placement

The claim is not the final prose. It is a structured observation that can be inspected, approved, removed, or rewritten before export.

## 4. Validate Ledger

Run:

```powershell
node scripts/validate-ledger.mjs data/generated-ledger.json
```

Validation checks:

- required report fields
- duplicate observation ids
- missing metric references
- missing evidence
- missing caveats on interpretive or inferential observations
- selected feedback representativeness flags

## 5. Review in Web UI

The web UI loads `data/generated-ledger.js` first and falls back to `data/sample-ledger.js`.

The UI is for reviewing observations before they become a polished report. A curator or director-facing reviewer should be able to see:

- director summary candidates
- evidence attached to each claim
- caveats and representativeness notes
- data quality warnings
- omitted or lower-priority observations

v4.4 adds browser-side approval controls:

- `보고서 포함`: whether the observation is allowed into the generated report
- `요약 포함`: whether the observation appears in the director-facing summary

The review state is saved in the browser's local storage for the current report id and schema version. The reviewed data download includes only included observations and records summary inclusion.

## 6. Render Report

Markdown report rendering is now available as the first report-generation layer.

```text
data/generated-ledger.json
-> scripts/render_report.py
-> output/report-draft.md
-> output/report-draft.html
-> data/generated-report.js
-> web report draft panel
```

The HTML output uses the old Ilmin report as a layout reference only: A4 page rhythm, title page, table treatment, typography, and print/PDF behavior. It does not copy the old report's content sequence.

Word export is also available as a draft layer:

```text
data/generated-ledger.json
-> scripts/render_docx.py
-> output/report-draft.docx
```

Word export is a rendering target, not the source of truth.

The web UI can also export review-aware report files directly from the browser:

- `reviewed-data.json`: included observations only
- `PDF`: print-ready A4 report opened for saving as PDF
- `approved-report.docx`: approved Word document generated as an OpenXML package in the browser

The static `output/report-draft.docx` remains a sample generated from the full Ledger. The browser `DOCX` button is the review-aware final export path.

The reviewed data should render into:

- director summary or synthesis record
- existing report sections
- data quality appendix or internal log
- optional Markdown preview

LLM use, when added, should be limited to restrained editorial rendering from approved observations.

## 7. Preserve Institutional Memory

Every exhibition should eventually keep its final input and final Ledger.

The accumulated Ledgers can later support:

- explicit reference groups
- year-end review
- dashboard metrics
- comparison across exhibition types
- reusable caveat and evidence patterns

## 8. Rebuild Protocol

v4.6 adds a single local rebuild command:

```powershell
python scripts/build_all.py
```

This regenerates normalized JSON, generated Ledger JSON/JS, Markdown, HTML, report JS, the static sample `.docx`, and the Excel input template.

For an edited Excel workbook, use:

```powershell
python scripts/build_all.py --xlsx-input templates/ilmin-report-input-template.xlsx
```

When the workbook is supplied as input, the script preserves that workbook instead of regenerating it from the CSV fallback files.
