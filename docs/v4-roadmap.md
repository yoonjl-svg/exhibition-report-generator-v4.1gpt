# v4.1gpt Roadmap

## Phase 1: Ledger Foundation

- Define input schema for exhibition basics, budgets, audiences, programs, publicity, membership, and selected feedback. Done in draft form.
- Generate metrics from input data. Done for the sample input.
- Generate evidence-backed observations. Done for the sample input.
- Validate all references and caveats. Done for generated Ledger validation.
- Add Excel-editable CSV input templates. Done in v4.3.

## Phase 2: Director Review

- Build the review UI around observations, not final prose.
- Allow curator toggles for director summary inclusion.
- Show evidence and caveats beside every claim.
- Flag data conflicts before report export.
- Show a rendered Markdown report draft from the generated Ledger. Done in v4.3.

## Phase 3: Editorial Rendering

- Convert approved observations into restrained report prose.
- Keep fact, comparison, interpretation, and inference visibly separated in internal metadata.
- Maintain a source map from final sentence to observation id.

## Phase 4: Word Export

- Render approved sections into `.docx`.
- Preserve existing report structure where useful.
- Add a concise "핵심 관찰 요약" or "종합 기록" section without turning it into a success/failure judgment.

## Phase 5: Institutional Memory

- Store ledgers per exhibition.
- Compare exhibitions by explicit reference group.
- Build dashboards from metrics and observations.
- Use accumulated ledgers to improve future comparison groups.
