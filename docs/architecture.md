# Architecture

v4.1gpt is organized around an Analysis Ledger.

## Why Not Generate Sentences First

The previous generation model can be summarized as:

```text
input data -> insight sentence -> wording pass -> Word report
```

That model makes the sentence the unit of analysis. It is convenient for document automation, but difficult to audit. A director or curator needs to know what each claim is based on, how representative it is, and whether it is fact, comparison, interpretation, or inference.

v4.1gpt changes the unit of analysis from prose to observation. v4.2 adds the first generation path from normalized exhibition input to the Ledger.

```text
normalized input -> metric derivation -> Analysis Ledger -> section arrangement -> editorial wording -> web review -> output
```

## Current Pipeline

```text
templates/sample-input/*.csv
-> scripts/csv_input_to_json.py
-> data/sample-input.json
-> scripts/build_ledger.py
-> data/generated-ledger.json
-> data/generated-ledger.js
-> index.html review UI
```

The report draft path is:

```text
data/generated-ledger.json
-> scripts/render_report.py
-> output/report-draft.md
-> output/report-draft.html
-> data/generated-report.js
-> index.html report draft panel
```

The Word output path is:

```text
data/generated-ledger.json
-> scripts/render_docx.py
-> output/report-draft.docx
```

The review-aware browser export path is:

```text
web review state
-> approved Analysis Ledger
-> src/docx-export.js
-> approved-report.docx
```

The local one-command rebuild path is:

```text
templates/sample-input/*.csv
-> scripts/build_all.py
-> templates/ilmin-report-input-template.xlsx
-> data/sample-input.json
-> data/generated-ledger.json / data/generated-ledger.js
-> output/report-draft.md / output/report-draft.html / output/report-draft.docx
```

The `reference-exhibitions` input sheet stores existing exhibition records with a `type` field. During conversion, those records are grouped by type and averaged to produce reference groups. The current exhibition's type is placed first, so the Ledger builder uses that type-specific baseline before any manual fallback group.

The browser app loads `data/generated-ledger.js` first and keeps `data/sample-ledger.js` as a fallback. It also loads `data/generated-report.js` when a rendered report draft exists. The report layout references the old Ilmin report's page and table style, but the content order follows the v4 analysis protocol.

## Core Objects

### Metric

A normalized quantitative value.

Examples:

- total visitors
- daily visitors
- total budget
- cost per visitor
- paid audience ratio
- press mentions

### Observation

A reportable unit of meaning.

Each observation carries:

- a claim
- the source metric or source type
- comparison group, if any
- importance
- statement kind
- caveat
- evidence
- intended report placement

### Report Placement

The same observation can appear in a compressed director view and in a detailed report section. This avoids creating two unrelated narratives.

### Input Record

The normalized input is not the same as the Ledger. It is a curator-authored source record that keeps factual data, selected feedback, and comparison groups separate before analysis rules run.

## LLM Role

LLM output should be constrained to editorial transformation:

- compressing observations
- aligning tone with Ilmin Museum report style
- removing overclaiming
- producing final prose from evidence-backed objects

The LLM should not invent comparison groups, causal relationships, or institutional judgment.

## Review UI

The web UI exists before Word export because review is the most important v4 workflow.

The curator should be able to inspect:

- which observations are included in the director summary
- which observations are omitted
- evidence attached to each claim
- caveats and representativeness notes
- data quality warnings

## Output Targets

Word export is a rendering target, not the source of truth.

The Ledger can later produce:

- director summary
- full exhibition report
- data quality log
- dashboard
- internal year-end comparison
- archive metadata
