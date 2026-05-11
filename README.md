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
- A sample Analysis Ledger in `data/sample-ledger.json`
- A browser copy of the same sample in `data/sample-ledger.js`
- Ledger helpers in `src/ledger.js`
- Web review UI in `src/app.js`
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
node scripts/validate-ledger.mjs data/sample-ledger.json
```

## v4 Design Principles

- Observations before prose
- Evidence before interpretation
- Caveats beside claims
- Selected audience feedback, not statistical sentiment
- Director-facing compression without automated verdicts
- Word output as a rendering target, not the core product

## Current Scope

This is a first working foundation for v4.1gpt. It proves the new internal model and review experience, but does not yet generate `.docx` files.

The next implementation step is to connect real exhibition input data to the Analysis Ledger builder.
