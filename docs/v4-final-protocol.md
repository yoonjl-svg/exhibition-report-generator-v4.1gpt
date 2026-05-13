# v4.6 Final Operating Protocol

This protocol describes the complete v4 flow after the planning spike.

## Version Ladder

- v4.1: Analysis Ledger foundation
- v4.2: normalized JSON input and generated Ledger
- v4.3: CSV input templates and formatted report outputs
- v4.4: observation review controls and approval-gated report export
- v4.5: browser-generated approved `.docx`
- v4.6: one-command rebuild and final operating protocol

## Operating Flow

1. Edit the CSV files in `templates/sample-input/`.
2. Run the full local rebuild:

```powershell
python scripts/build_all.py
```

3. Commit and push the regenerated files.
4. Open the GitHub Pages app.
5. Review each observation:
   - `Include`: controls whether the observation enters the report.
   - `Director`: controls whether it appears in the director-facing summary.
   - `Status`: records draft, reviewed, or approved state.
6. Download final outputs from the web app:
   - `Approved Ledger`: review-filtered source of truth
   - `HTML`: print/PDF-ready report
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

The current v4.6 system does not yet automate:

- automatic collection of audience feedback from the web
- LLM rewriting inside the browser
- institutional cross-year dashboards

Those should be treated as future modules built on top of the approved Ledger structure.
