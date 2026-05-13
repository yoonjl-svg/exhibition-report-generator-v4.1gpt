# Input Protocol

v4.3 accepts exhibition data through Excel-editable CSV files.

## Files

Edit the files under `templates/sample-input/`.

- `core.csv`: exhibition basics, audience, budget, programs, publicity, membership, and director brief metric ids
- `reference-groups.csv`: comparison groups and reference averages
- `selected-feedback.csv`: selected audience feedback, not statistical sentiment
- `data-quality.csv`: conflicts or source issues that should remain visible before export

These files can be opened and edited in Excel. Save them back as CSV UTF-8 when possible.

## Convert CSV To JSON

For normal operation, run the complete rebuild:

```powershell
python scripts/build_all.py
```

This converts CSV input, rebuilds the Ledger, and regenerates report outputs.

For step-by-step debugging, run the individual commands below.

Run:

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
templates/ilmin-report-input-template.zip
```

This ZIP contains the CSV files under `templates/sample-input/`.

## Validate

Run:

```powershell
node scripts/validate-ledger.mjs data/generated-ledger.json
```

The Ledger should have zero errors before Word export is attempted.
