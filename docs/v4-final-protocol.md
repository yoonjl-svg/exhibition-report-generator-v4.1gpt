# v4.12 Final Operating Protocol

This protocol describes the complete v4 flow after the planning spike.

## Version Ladder

- v4.1: Analysis Ledger foundation
- v4.2: normalized JSON input and generated Ledger
- v4.3: CSV input templates and formatted report outputs
- v4.4: observation review controls and approval-gated report export
- v4.5: browser-generated approved `.docx`
- v4.6: one-command rebuild and final operating protocol
- v4.7: single-workbook Excel template
- v4.8: type-specific reference baselines from existing exhibition records
- v4.9: five fixed director metrics plus one automatically recommended metric
- v4.10: compact paired metric cards in the director view
- v4.11: six fixed paired director cards with budget execution, group audience ratio, program sessions, and workbook SNS feedback total
- v4.12: desktop single-row director metric strip and full reference comparisons for all director metrics

## Operating Flow

1. Edit `templates/ilmin-report-input-template.xlsx`.
2. Run the full local rebuild:

```powershell
python scripts/build_all.py --xlsx-input templates/ilmin-report-input-template.xlsx
```

3. Commit and push the regenerated files.
4. Open the GitHub Pages app.
5. Review each observation:
   - `보고서 포함`: controls whether the observation enters the report.
   - `핵심 지표`: controls whether it appears in the director-facing summary.
6. Download final outputs from the web app:
   - `PDF`: print-ready report opened for saving as PDF
   - `DOCX`: approved Word report generated in the browser

## Source Of Truth

The source of truth is not a final paragraph. It is the approved Analysis Ledger.

The final Word file is a rendering target. If there is a conflict between final prose and the Ledger, the Ledger should be corrected first and the report regenerated.

## Review Rule

No observation should appear in the final report unless it has:

- a clear claim
- evidence
- a statement kind
- a caveat where the claim is interpretive, inferential, or based on selected feedback
- an explicit reviewer decision in the web UI

## Boundary

The current v4.12 system does not yet automate:

- automatic collection of audience feedback from the web
- LLM rewriting inside the browser
- institutional cross-year dashboards

Those should be treated as future modules built on top of the approved data structure.
