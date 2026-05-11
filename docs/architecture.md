# Architecture

v4.1gpt is organized around an Analysis Ledger.

## Why Not Generate Sentences First

The previous generation model can be summarized as:

```text
input data -> insight sentence -> wording pass -> Word report
```

That model makes the sentence the unit of analysis. It is convenient for document automation, but difficult to audit. A director or curator needs to know what each claim is based on, how representative it is, and whether it is fact, comparison, interpretation, or inference.

v4.1gpt changes the unit of analysis from prose to observation.

```text
input data -> Analysis Ledger -> section arrangement -> editorial wording -> web review -> output
```

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
