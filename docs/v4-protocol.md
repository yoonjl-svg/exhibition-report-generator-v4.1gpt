# v4 Protocol

This protocol defines how v4 should move from raw exhibition records to a director-readable report without allowing the system to overclaim.

## 1. Normalize Input

Curator-authored input is stored as `data/sample-input.json` and validated against the draft shape in `schemas/exhibition-input.schema.json`.

For practical entry, v4.3 adds Excel-editable CSV files under `templates/sample-input/`.

```text
templates/sample-input/core.csv
templates/sample-input/reference-groups.csv
templates/sample-input/selected-feedback.csv
templates/sample-input/data-quality.csv
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

The UI is for reviewing observations, not for reading a polished report. A curator or director-facing reviewer should be able to see:

- director summary candidates
- evidence attached to each claim
- caveats and representativeness notes
- data quality warnings
- omitted or lower-priority observations

## 6. Render Report

Markdown report rendering is now available as the first report-generation layer.

```text
data/generated-ledger.json
-> scripts/render_report.py
-> output/report-draft.md
-> data/generated-report.js
-> web report draft panel
```

Word export is the next layer, not the source of truth.

The approved Ledger should render into:

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
