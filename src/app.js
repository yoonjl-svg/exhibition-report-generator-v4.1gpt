(function () {
  const ledger = window.SAMPLE_LEDGER;
  const tools = window.LedgerTools;
  let showEvidence = true;

  const els = {
    title: document.querySelector("#report-title"),
    scopeNote: document.querySelector("#scope-note"),
    metricStrip: document.querySelector("#metric-strip"),
    brief: document.querySelector("#brief-observations"),
    ledgerList: document.querySelector("#ledger-list"),
    count: document.querySelector("#observation-count"),
    health: document.querySelector("#health-list"),
    sectionFilter: document.querySelector("#section-filter"),
    importanceFilter: document.querySelector("#importance-filter"),
    kindFilter: document.querySelector("#kind-filter"),
    toggleEvidence: document.querySelector("#toggle-evidence"),
    copyMarkdown: document.querySelector("#copy-markdown"),
    toast: document.querySelector("#toast")
  };

  function init() {
    els.title.textContent = ledger.report.title;
    els.scopeNote.textContent = ledger.report.scope_note;
    renderFilters();
    renderHealth();
    renderMetrics();
    renderBrief();
    renderLedger();
    bindEvents();
  }

  function renderFilters() {
    const options = [`<option value="all">All</option>`]
      .concat(
        tools.getSections(ledger).map((section) => {
          return `<option value="${section}">${tools.sectionLabel(section)}</option>`;
        })
      )
      .join("");
    els.sectionFilter.innerHTML = options;
  }

  function renderHealth() {
    const result = tools.validateLedger(ledger);
    const values = [
      ["Observations", ledger.observations.length],
      ["Metrics", ledger.metrics.length],
      ["Errors", result.errors.length],
      ["Warnings", result.warnings.length]
    ];

    els.health.innerHTML = values
      .map(([label, value]) => {
        const className = label === "Errors" && value > 0 ? "danger" : label === "Warnings" && value > 0 ? "warn" : "";
        return `<dt>${label}</dt><dd class="${className}">${value}</dd>`;
      })
      .join("");
  }

  function renderMetrics() {
    els.metricStrip.innerHTML = tools
      .getBriefMetrics(ledger)
      .map((metric) => {
        return `
          <article class="metric">
            <p class="label">${metric.label}</p>
            <div class="value">${tools.formatValue(metric.value, metric.unit)}</div>
            <div class="context">${metric.context || ""}</div>
          </article>
        `;
      })
      .join("");
  }

  function renderBrief() {
    els.brief.innerHTML = tools.getDirectorObservations(ledger).map(renderObservation).join("");
  }

  function renderLedger() {
    const filters = {
      section: els.sectionFilter.value,
      importance: els.importanceFilter.value,
      kind: els.kindFilter.value
    };
    const observations = tools.filterObservations(ledger, filters);
    els.count.textContent = `${observations.length} of ${ledger.observations.length} observations`;
    els.ledgerList.innerHTML = observations.map(renderObservation).join("");
  }

  function renderObservation(observation) {
    const evidence = (observation.evidence || []).map((item) => `<li>${escapeHtml(tools.evidenceText(item))}</li>`).join("");
    const caveat = observation.caveat ? `<p class="caveat">${escapeHtml(observation.caveat)}</p>` : "";
    const wording = observation.recommended_wording || observation.claim;

    return `
      <article class="observation" data-id="${observation.id}">
        <div class="observation-header">
          <p class="claim">${escapeHtml(observation.claim)}</p>
          <div class="chips">
            <span class="chip ${observation.importance}">${observation.importance}</span>
            <span class="chip">${tools.sectionLabel(observation.section)}</span>
            <span class="chip">${tools.kindLabel(observation.statement_kind)}</span>
          </div>
        </div>
        <p class="wording">${escapeHtml(wording)}</p>
        ${caveat}
        <div class="evidence" ${showEvidence ? "" : "hidden"}>
          <div class="evidence-title">근거</div>
          <ul>${evidence}</ul>
        </div>
      </article>
    `;
  }

  function bindEvents() {
    for (const el of [els.sectionFilter, els.importanceFilter, els.kindFilter]) {
      el.addEventListener("change", renderLedger);
    }

    els.toggleEvidence.addEventListener("click", () => {
      showEvidence = !showEvidence;
      els.toggleEvidence.setAttribute("aria-pressed", String(showEvidence));
      renderBrief();
      renderLedger();
    });

    els.copyMarkdown.addEventListener("click", async () => {
      const markdown = tools.makeMarkdownReport(ledger);
      try {
        await navigator.clipboard.writeText(markdown);
        showToast("Markdown copied.");
      } catch {
        showToast("Clipboard unavailable. Select generated text from console.");
        console.log(markdown);
      }
    });
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    setTimeout(() => els.toast.classList.remove("show"), 1800);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  init();
})();
