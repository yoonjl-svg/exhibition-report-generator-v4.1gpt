# v4.1gpt Roadmap

## Phase 1: Ledger Foundation

- Define input schema for exhibition basics, budgets, audiences, programs, publicity, membership, and selected feedback. Done in draft form.
- Generate metrics from input data. Done for the sample input.
- Generate evidence-backed observations. Done for the sample input.
- Validate all references and caveats. Done for generated Ledger validation.
- Add Excel-editable CSV input templates. Done in v4.3.

## Phase 2: Director Review

- Build the review UI around observations, not final prose. Done in v4.4.
- Allow curator toggles for director summary inclusion. Done in v4.4.
- Show evidence and caveats beside every claim.
- Flag data conflicts before report export.
- Show a rendered Markdown report draft from the generated Ledger. Done in v4.3.
- Add print/PDF-ready HTML and DOCX report draft outputs. Done in v4.3.
- Allow curator inclusion/exclusion before browser report export. Done in v4.4.

## Phase 3: Editorial Rendering

- Convert approved observations into restrained report prose. Started in v4.4 browser export.
- Keep fact, comparison, interpretation, and inference visibly separated in internal metadata.
- Maintain a source map from final sentence to observation id.

## Phase 4: Word Export

- Render approved sections into `.docx`. Done in v4.5 browser export.
- Preserve existing report structure where useful.
- Add a concise "핵심 관찰 요약" or "종합 기록" section without turning it into a success/failure judgment.
- Current final export: browser export creates `approved-report.docx`, a review-aware OpenXML Word document.

## Phase 5: Institutional Memory

- Store ledgers per exhibition.
- Compare exhibitions by explicit reference group.
- Build dashboards from metrics and observations.
- Use accumulated ledgers to improve future comparison groups.

## Phase 6: Operating Protocol

- Add a one-command input-to-report rebuild. Done in v4.6.
- Document the final curator workflow. Done in v4.6.
- Keep future refinements focused on content quality and institutional style after real review.

## Phase 7: Input Workbook

- Replace the downloadable CSV ZIP with a single multi-sheet Excel workbook. Done in v4.7.
- Allow the converter to read the workbook directly. Done in v4.7.

## Phase 8: Reference Baselines

- Add existing exhibition records as workbook input. Done in v4.8.
- Generate type-specific reference averages from `정기 기획전`, `특별전`, and `기타` classifications. Done in v4.8.
- Keep manual reference groups as fallback inputs. Done in v4.8.

## Phase 9: Metric Selection

- Fix the first five director-facing metrics as total visitors, daily visitors, total budget, total income, and cost per visitor. Done in v4.9.
- Replace the sixth metric with the strongest non-fixed type-specific deviation. Done in v4.9.
- Show the recommended metric with an explicit recommendation marker and reason. Done in v4.9.

## Phase 10: Metric Card Layout

- Pair related director metrics inside compact cards. Done in v4.10.
- Add program participation rate as a first-class metric. Done in v4.10.
- Add a temporary selected SNS feedback count. Superseded in v4.11 by workbook SNS feedback total.

## Phase 11: Fixed Director Metric Set

- Replace the recommendation card with six fixed paired cards. Done in v4.11.
- Use workbook SNS feedback total rather than counting selected SNS quotes. Done in v4.11.
- Add budget execution rate, group audience ratio, and program sessions to the director metric set. Done in v4.11.

## Phase 12: Metric Strip Refinement

- Show the six director metric cards in a single desktop row. Done in v4.12.
- Use the same reference-comparison hover wording across the full metric set. Done in v4.12.
- Read `SNS 피드백 합계` from historical exhibition data for reference averages. Done in v4.12.

## Phase 13: Browser Input State

- Start the browser app with no loaded report. Done in v4.13.
- Add Excel upload as the primary data input path. Done in v4.13.
- Add temporary sample fill for testing before final publishing. Done in v4.13.
- Remove caveat blocks from rendered report drafts while keeping them in the underlying observation data. Done in v4.13.

## Phase 14: Report Chart Preview

- Add browser-side SVG chart previews to the report column. Done in v4.14.
- Use approved report data and selected metric comparisons as the chart source. Done in v4.14.
- Include the same chart section in browser print/PDF HTML output. Done in v4.14.
- Leave DOCX chart image embedding for the next phase. Pending.

## Phase 15: Integrated Report Preview

- Replace the plain Markdown draft pane with a rendered report preview. Done in v4.15.
- Remove the separate chart preview panel. Done in v4.15.
- Place charts inside the report body under the core metric summary table. Done in v4.15.
