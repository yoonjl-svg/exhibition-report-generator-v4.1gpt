# Input Protocol

v4.8 accepts exhibition data through a single multi-sheet Excel file.

## Files

Download and edit:

```text
templates/ilmin-report-input-template.xlsx
```

The workbook contains five sheets:

- `core`: exhibition basics, audience, budget, programs, publicity, membership, and director brief metric ids
- `reference-exhibitions`: existing exhibition records used to calculate type-specific reference averages
- `reference-groups`: optional manual comparison groups and reference averages
- `selected-feedback`: selected audience feedback, not statistical sentiment
- `data-quality`: conflicts or source issues that should remain visible before export

CSV fallback files still exist under `templates/sample-input/`, but the Excel workbook is the recommended input format because it avoids CSV encoding problems in Excel.

## Convert Input To JSON

For normal operation with an edited workbook, run the complete rebuild:

```powershell
python scripts/build_all.py --xlsx-input templates/ilmin-report-input-template.xlsx
```

This converts input data, rebuilds the Ledger, and regenerates report outputs.
The script preserves the workbook passed through `--xlsx-input`.

For repository maintenance, running `python scripts/build_all.py` without `--xlsx-input` uses the CSV fallback files and regenerates the downloadable Excel template from them.

To convert an edited workbook directly, run:

```powershell
python scripts/csv_input_to_json.py templates/ilmin-report-input-template.xlsx --output data/sample-input.json
```

For step-by-step debugging, run the individual commands below.

Run the CSV fallback converter:

```powershell
python scripts/csv_input_to_json.py templates/sample-input --output data/sample-input.json
```

This produces the normalized input record used by the Ledger builder.

## Generate Ledger

Run:

```powershell
python scripts/build_ledger.py data/sample-input.json --json data/generated-ledger.json --js data/generated-ledger.js
```

This produces the Analysis Ledger and the browser-readable copy.

## Generate Report Draft

Run:

```powershell
python scripts/render_report.py data/generated-ledger.json --markdown output/report-draft.md --html output/report-draft.html --js data/generated-report.js
python scripts/render_docx.py data/generated-ledger.json --output output/report-draft.docx
```

This produces Markdown, print/PDF-ready HTML, DOCX, and the browser-readable copy.

## Download Template

The web app links to:

```text
templates/ilmin-report-input-template.xlsx
```

This workbook contains the five input sheets in one file.

The `reference-exhibitions` sheet is the preferred source for comparison baselines. Set `exhibition.type` in the `core` sheet, using values such as `정기 기획전`, `특별전`, or `기타`. The converter groups existing exhibitions by the same `type`, calculates averages, and places the matching type first in `reference_groups`. The `reference-groups` sheet remains available as a manual fallback or override.

The `brief_metrics.ids` row in the `core` sheet uses paired director-facing indicators plus one automatic slot:

```text
total_visitors,daily_visitors,total_budget,total_income,program_participants,program_participation_rate,press_mentions,sns_feedback,cost_per_visitor,auto
```

The `auto` token is replaced during Ledger generation with the non-fixed metric that has the largest deviation from the current type-specific reference baseline. In the web app, these ids are arranged as paired cards: audience, finance, program, publicity/feedback, cost per visitor, and recommendation.

## Validate

Run:

```powershell
node scripts/validate-ledger.mjs data/generated-ledger.json
```

The Ledger should have zero errors before Word export is attempted.
