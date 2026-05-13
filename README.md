# v4.1gpt

Analysis Ledger-first prototype for Ilmin Museum exhibition reports.

This repository is a clean v4 experiment. It does not depend on, modify, or assume the state of the existing Claude Code repositories.

## Goal

v4.1gpt reframes the generator from a report sentence writer into a structured observation system.

The pipeline is:

```text
Input data
-> Analysis Ledger
-> section arrangement
-> restrained editorial wording
-> web review
-> Word/PDF export later
```

The important shift is that every analytic sentence is backed by a traceable observation object. LLM output, when added later, should act as an editor, not as the source of judgment.

## What Is Implemented

- A dependency-free web preview in `index.html`
- A normalized exhibition input sample in `data/sample-input.json`
- Excel-editable CSV input templates in `templates/sample-input/`
- A CSV-to-JSON input converter in `scripts/csv_input_to_json.py`
- A draft input schema in `schemas/exhibition-input.schema.json`
- A Python Ledger builder in `scripts/build_ledger.py`
- A generated Analysis Ledger in `data/generated-ledger.json`
- A browser copy of the generated Ledger in `data/generated-ledger.js`
- A Markdown report renderer in `scripts/render_report.py`
- A generated report draft in `output/report-draft.md`
- A print/PDF-ready report layout in `output/report-draft.html`
- A Word report draft in `output/report-draft.docx`
- A downloadable CSV input template package in `templates/ilmin-report-input-template.zip`
- A fallback sample Ledger in `data/sample-ledger.json`
- Ledger helpers in `src/ledger.js`
- Web review UI in `src/app.js`
- Approval controls for including/excluding observations from the browser-rendered report
- Browser downloads for approved Ledger JSON, print-ready HTML, and approved `.docx` output
- A one-command rebuild script in `scripts/build_all.py`
- A Node validation script in `scripts/validate-ledger.mjs`
- Architecture and schema notes in `docs/`

## How To Run

Open `index.html` directly in a browser.

No build step is required.

If the browser blocks local file access, run the local preview server:

```powershell
node scripts/serve.mjs 4173
```

Then open:

```text
http://127.0.0.1:4173
```

To validate the sample ledger:

```powershell
node scripts/validate-ledger.mjs data/generated-ledger.json
```

To rebuild the Ledger from the normalized input:

```powershell
python scripts/build_ledger.py data/sample-input.json --json data/generated-ledger.json --js data/generated-ledger.js
```

To rebuild the full CSV-input-to-report flow in one step:

```powershell
python scripts/build_all.py
```

The expanded manual flow is:

```powershell
python scripts/csv_input_to_json.py templates/sample-input --output data/sample-input.json
python scripts/build_ledger.py data/sample-input.json --json data/generated-ledger.json --js data/generated-ledger.js
python scripts/render_report.py data/generated-ledger.json --markdown output/report-draft.md --html output/report-draft.html --js data/generated-report.js
python scripts/render_docx.py data/generated-ledger.json --output output/report-draft.docx
```

The builder uses only the Python standard library. Python 3.10 or newer is recommended.

In the web app, use the review controls and then download:

- `Approved Ledger` for the review-filtered source data
- `HTML` for print/PDF output
- `DOCX` for the approved Word report generated directly in the browser

## v4 Design Principles

- Observations before prose
- Evidence before interpretation
- Caveats beside claims
- Selected audience feedback, not statistical sentiment
- Director-facing compression without automated verdicts
- Word output as a rendering target, not the core product

## Current Scope

This is a working v4.6 foundation. It proves CSV input, the new internal model, the review experience, the input-to-Ledger generation path, print-ready HTML report rendering, static `.docx` draft generation, browser-side approval gating, approved browser `.docx` export, and a one-command rebuild protocol.

The next implementation step after v4.6 is not more report plumbing; it is qualitative refinement after real curator review: section wording, table density, and institutional style tuning.
