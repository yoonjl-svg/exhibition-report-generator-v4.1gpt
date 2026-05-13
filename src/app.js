(function () {
  let ledger = null;
  const sampleLedger = window.GENERATED_LEDGER || window.SAMPLE_LEDGER;
  const tools = window.LedgerTools;
  let showEvidence = true;
  let reviewState = {};

  const els = {
    workspace: document.querySelector("#workspace"),
    title: document.querySelector("#report-title"),
    excelUpload: document.querySelector("#excel-upload"),
    uploadExcelButton: document.querySelector("#upload-excel-button"),
    loadSampleButton: document.querySelector("#load-sample-button"),
    scopeNote: document.querySelector("#scope-note"),
    metricStrip: document.querySelector("#metric-strip"),
    brief: document.querySelector("#brief-observations"),
    ledgerList: document.querySelector("#ledger-list"),
    reportCharts: document.querySelector("#report-charts"),
    reportDraft: document.querySelector("#report-draft"),
    reportDraftNote: document.querySelector("#report-draft-note"),
    count: document.querySelector("#observation-count"),
    health: document.querySelector("#health-list"),
    review: document.querySelector("#review-list"),
    filterSummary: document.querySelector("#filter-summary"),
    sectionFilter: document.querySelector("#section-filter"),
    importanceFilter: document.querySelector("#importance-filter"),
    kindFilter: document.querySelector("#kind-filter"),
    clearFilters: document.querySelector("#clear-filters"),
    exportMenuButton: document.querySelector("#export-menu-button"),
    exportMenu: document.querySelector("#export-menu"),
    toggleEvidence: document.querySelector("#toggle-evidence"),
    downloadReportDoc: document.querySelector("#download-report-doc"),
    printReportPdf: document.querySelector("#print-report-pdf"),
    approveAll: document.querySelector("#approve-all"),
    resetReview: document.querySelector("#reset-review"),
    toast: document.querySelector("#toast")
  };

  function init() {
    bindEvents();
    renderInitialState();
  }

  function renderInitialState() {
    ledger = null;
    reviewState = {};
    els.title.textContent = "전시보고서 데이터 입력";
    els.workspace.hidden = true;
    setReportActionsEnabled(false);
    setExportMenuOpen(false);
  }

  function setLedger(nextLedger, sourceLabel) {
    ledger = nextLedger;
    reviewState = loadReviewState();
    els.title.textContent = ledger.report.title;
    els.scopeNote.textContent = ledger.report.scope_note || "";
    els.workspace.hidden = false;
    setReportActionsEnabled(true);
    renderFilters();
    renderHealth();
    renderReviewSummary();
    renderMetrics();
    renderBrief();
    renderReportCharts();
    renderReportDraft();
    renderLedger();
    showToast(sourceLabel ? `${sourceLabel} 데이터를 불러왔습니다.` : "전시 데이터를 불러왔습니다.");
  }

  function setReportActionsEnabled(enabled) {
    for (const item of [els.exportMenuButton, els.downloadReportDoc, els.printReportPdf]) {
      item.disabled = !enabled;
    }
  }

  function renderFilters() {
    const options = [`<option value="all">전체</option>`]
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
    const hasIssues = result.errors.length > 0 || result.warnings.length > 0;
    const values = [
      ["관찰 항목", ledger.observations.length],
      hasIssues
        ? [
            "검토 필요",
            `오류 ${result.errors.length} / 주의 ${result.warnings.length}`,
            result.errors.length > 0 ? "danger" : "warn"
          ]
        : ["검증 상태", "정상"]
    ];

    els.health.innerHTML = values
      .map(([label, value, className = ""]) => {
        return `<dt>${label}</dt><dd class="${className}">${value}</dd>`;
      })
      .join("");
  }

  function renderReviewSummary() {
    const states = Object.values(reviewState);
    const included = states.filter((item) => item.included).length;
    const director = states.filter((item) => item.included && item.directorBrief).length;
    const values = [
      ["보고서 포함", `${included}/${states.length}`],
      ["핵심 지표", director]
    ];

    els.review.innerHTML = values.map(([label, value]) => `<dt>${label}</dt><dd>${value}</dd>`).join("");
  }

  function renderMetrics() {
    els.metricStrip.innerHTML = tools
      .getBriefMetricGroups(ledger)
      .map(renderMetricGroupCard)
      .join("");
  }

  function renderMetricGroupCard(group) {
    const isSingle = group.metrics.length === 1;
    const className = [
      "metric",
      isSingle ? "metric--single" : "metric--pair",
      group.role === "recommended" ? "metric--recommended" : ""
    ]
      .filter(Boolean)
      .join(" ");
    return `
      <article class="${className}">
        <div class="metric-items">
          ${group.metrics.map((metric) => renderMetricItem(metric)).join("")}
        </div>
      </article>
    `;
  }

  function renderMetricItem(metric) {
    const badge = metric.brief_role === "recommended" ? `<span class="metric-badge">추천</span>` : "";
    const contextParts = [];
    if (metric.context) contextParts.push(metric.context);
    if (metric.recommendation_reason) contextParts.push(metric.recommendation_reason);
    const context = contextParts.join(" ");
    const tooltip = metric.context
      ? `
        <span class="metric-info-wrap">
          <span class="metric-info" tabindex="0" aria-label="${escapeHtml(context)}">i</span>
          <span class="metric-tooltip" role="tooltip">${escapeHtml(context)}</span>
        </span>
      `
      : "";
    return `
      <div class="metric-item">
        <p class="label">${escapeHtml(metric.label)}${badge}${tooltip}</p>
        <div class="value">${escapeHtml(tools.formatValue(metric.value, metric.unit))}</div>
      </div>
    `;
  }

  function renderBrief() {
    els.brief.innerHTML = "";
  }

  function renderReportCharts() {
    if (!window.ReportCharts) {
      els.reportCharts.hidden = true;
      return;
    }
    const charts = window.ReportCharts.build(makeApprovedLedger(), tools);
    els.reportCharts.innerHTML = charts.length
      ? `<h3 class="report-subheading">보고서 그래프</h3>${window.ReportCharts.renderList(charts)}`
      : "";
    els.reportCharts.hidden = charts.length === 0;
  }

  function renderReportDraft() {
    const markdown = getReportMarkdown();
    els.reportDraft.textContent = markdown;
    els.reportDraftNote.textContent = `${markdown.length.toLocaleString("ko-KR")} characters`;
  }

  function renderLedger() {
    const filters = getLedgerFilters();
    const observations = tools.filterObservations(ledger, filters);
    const active = hasActiveLedgerFilters(filters);
    const summary = `${ledger.observations.length}개 중 ${observations.length}개`;
    els.count.textContent = active ? `${summary} 표시 중` : `전체 ${ledger.observations.length}개 관찰`;
    els.filterSummary.textContent = active
      ? `${summary} 표시 중. 출력물은 바뀌지 않습니다.`
      : `전체 ${ledger.observations.length}개 관찰을 표시합니다.`;
    els.filterSummary.classList.toggle("is-active", active);
    els.ledgerList.innerHTML = observations.map(renderObservation).join("");
  }

  function renderObservation(observation) {
    const evidence = (observation.evidence || []).map((item) => `<li>${escapeHtml(tools.evidenceText(item))}</li>`).join("");
    const caveat = observation.caveat ? `<p class="caveat">${escapeHtml(observation.caveat)}</p>` : "";
    const wording = observation.recommended_wording || observation.claim;
    const state = reviewState[observation.id] || defaultObservationState(observation);

    return `
      <article class="observation ${state.included ? "" : "is-excluded"}" data-id="${observation.id}">
        <div class="observation-header">
          <p class="claim">${escapeHtml(observation.claim)}</p>
          <div class="chips">
            <span class="chip ${observation.importance}">${observation.importance}</span>
            <span class="chip">${tools.sectionLabel(observation.section)}</span>
            <span class="chip">${tools.kindLabel(observation.statement_kind)}</span>
          </div>
        </div>
        <div class="review-controls" aria-label="review controls for ${escapeHtml(observation.id)}">
          <label class="inline-control">
            <input type="checkbox" data-review-field="included" data-id="${escapeHtml(observation.id)}" ${state.included ? "checked" : ""} />
            보고서 포함
          </label>
          <label class="inline-control">
            <input type="checkbox" data-review-field="directorBrief" data-id="${escapeHtml(observation.id)}" ${state.directorBrief ? "checked" : ""} />
            핵심 지표
          </label>
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
    els.uploadExcelButton.addEventListener("click", () => els.excelUpload.click());
    els.loadSampleButton.addEventListener("click", loadSampleLedger);
    els.excelUpload.addEventListener("change", handleExcelUpload);

    for (const el of [els.sectionFilter, els.importanceFilter, els.kindFilter]) {
      el.addEventListener("change", () => {
        if (!ledger) return;
        renderLedger();
        showToast(ledgerFilterToast());
      });
    }

    els.clearFilters.addEventListener("click", () => {
      if (!ledger) return;
      els.sectionFilter.value = "all";
      els.importanceFilter.value = "all";
      els.kindFilter.value = "all";
      renderLedger();
      showToast("관찰 데이터 필터를 해제했습니다.");
    });

    for (const reviewContainer of [els.brief, els.ledgerList]) {
      reviewContainer.addEventListener("change", (event) => {
        if (!ledger) return;
        const target = event.target;
        if (!target.dataset.reviewField) return;
        updateObservationReview(target.dataset.id, target.dataset.reviewField, target);
      });
    }

    els.toggleEvidence.addEventListener("click", () => {
      if (!ledger) return;
      showEvidence = !showEvidence;
      els.toggleEvidence.setAttribute("aria-pressed", String(showEvidence));
      renderBrief();
      renderLedger();
    });

    els.exportMenuButton.addEventListener("click", () => {
      if (!ledger) return;
      setExportMenuOpen(els.exportMenu.hidden);
    });

    els.downloadReportDoc.addEventListener("click", () => {
      if (!ledger) return;
      setExportMenuOpen(false);
      if (!window.DocxExport) {
        downloadText("approved-report.doc", makeReportHtml(makeApprovedLedger()), "application/msword");
        showToast("DOCX 생성기를 불러오지 못해 Word 호환 .doc 파일을 다운로드했습니다.");
        return;
      }
      const blob = window.DocxExport.createDocxBlob(makeApprovedLedger(), tools);
      downloadBlob("approved-report.docx", blob);
      showToast("DOCX를 다운로드했습니다.");
    });

    els.printReportPdf.addEventListener("click", () => {
      if (!ledger) return;
      setExportMenuOpen(false);
      openPrintReport(makeApprovedLedger());
    });

    els.approveAll.addEventListener("click", () => {
      if (!ledger) return;
      for (const observation of ledger.observations) {
        reviewState[observation.id] = {
          ...defaultObservationState(observation),
          ...reviewState[observation.id],
          included: true
        };
      }
      persistReviewState();
      renderAll();
      showToast("모든 관찰 항목을 보고서에 포함했습니다.");
    });

    els.resetReview.addEventListener("click", () => {
      if (!ledger) return;
      reviewState = makeDefaultReviewState();
      persistReviewState();
      renderAll();
      showToast("출력 설정을 초기화했습니다.");
    });

    document.addEventListener("click", (event) => {
      const isExportClick = event.target === els.exportMenuButton || els.exportMenu.contains(event.target);
      if (!isExportClick) setExportMenuOpen(false);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setExportMenuOpen(false);
    });
  }

  function loadSampleLedger() {
    if (!sampleLedger) {
      showToast("샘플 데이터를 찾을 수 없습니다.");
      return;
    }
    setLedger(clone(sampleLedger), "샘플");
  }

  async function handleExcelUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!window.InputLoader) {
      showToast("엑셀 입력 모듈을 불러오지 못했습니다.");
      return;
    }
    try {
      showToast("엑셀 파일을 읽는 중입니다.");
      const uploadedLedger = await window.InputLoader.loadWorkbook(file);
      setLedger(uploadedLedger, file.name);
    } catch (error) {
      showToast(error.message || "엑셀 파일을 읽지 못했습니다.");
    }
  }

  function updateObservationReview(id, field, target) {
    const observation = ledger.observations.find((item) => item.id === id);
    reviewState[id] = {
      ...defaultObservationState(observation),
      ...reviewState[id]
    };
    reviewState[id][field] = target.checked;
    persistReviewState();
    renderAll();
  }

  function renderAll() {
    renderReviewSummary();
    renderBrief();
    renderReportCharts();
    renderReportDraft();
    renderLedger();
  }

  function getLedgerFilters() {
    return {
      section: els.sectionFilter.value,
      importance: els.importanceFilter.value,
      kind: els.kindFilter.value
    };
  }

  function hasActiveLedgerFilters(filters) {
    return filters.section !== "all" || filters.importance !== "all" || filters.kind !== "all";
  }

  function ledgerFilterToast() {
    const filters = getLedgerFilters();
    const count = tools.filterObservations(ledger, filters).length;
    if (!hasActiveLedgerFilters(filters)) return "전체 관찰을 표시합니다.";
    return `관찰 데이터 필터: ${ledger.observations.length}개 중 ${count}개 표시`;
  }

  function setExportMenuOpen(open) {
    els.exportMenu.hidden = !open;
    els.exportMenuButton.setAttribute("aria-expanded", String(open));
  }

  function getReportMarkdown() {
    return makeReportMarkdown(makeApprovedLedger());
  }

  function makeDefaultReviewState() {
    const state = {};
    for (const observation of ledger.observations || []) {
      state[observation.id] = defaultObservationState(observation);
    }
    return state;
  }

  function defaultObservationState(observation) {
    return {
      included: true,
      directorBrief: Boolean(observation?.report_placement?.director_brief),
    };
  }

  function loadReviewState() {
    const defaults = makeDefaultReviewState();
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey()) || "{}");
      for (const id of Object.keys(defaults)) {
        defaults[id] = { ...defaults[id], ...(saved[id] || {}) };
      }
    } catch {
      return defaults;
    }
    return defaults;
  }

  function persistReviewState() {
    localStorage.setItem(storageKey(), JSON.stringify(reviewState));
  }

  function storageKey() {
    return `v4-review:${ledger.report?.id || "report"}:${ledger.schema_version || "schema"}`;
  }

  function makeApprovedLedger() {
    const approved = JSON.parse(JSON.stringify(ledger));
    approved.report = {
      ...approved.report,
      review_note: "웹 검토 화면에서 보고서 포함으로 선택된 관찰만 담은 데이터입니다.",
      review_generated_at: new Date().toISOString()
    };
    approved.observations = approved.observations
      .filter((observation) => reviewState[observation.id]?.included !== false)
      .map((observation) => {
        const state = reviewState[observation.id] || defaultObservationState(observation);
        observation.report_placement = {
          ...(observation.report_placement || {}),
          director_brief: Boolean(state.directorBrief)
        };
        observation.review = {
          included: Boolean(state.included),
          director_brief: Boolean(state.directorBrief)
        };
        return observation;
      });
    return approved;
  }

  function makeReportMarkdown(sourceLedger) {
    const lines = [];
    const observations = sourceLedger.observations || [];
    const dataQuality = observations.filter((item) => item.statement_kind === "data_quality");
    const director = observations
      .filter((item) => item.report_placement?.director_brief && item.statement_kind !== "data_quality")
      .sort((a, b) => importanceRank(a.importance) - importanceRank(b.importance));

    lines.push(`# ${sourceLedger.report.title}`);
    lines.push("");
    lines.push("## I. 전시 개요");
    lines.push("");
    pushLine(lines, `- 전시 기간: ${sourceLedger.report.period || ""}`);
    pushLine(lines, `- 장소: ${sourceLedger.report.venue || ""}`);
    pushLine(lines, sourceLedger.report.scope_note || "");
    lines.push("");

    lines.push("## II. 핵심 수치 종합");
    lines.push("");
    lines.push("| 항목 | 값 | 참고 |");
    lines.push("| --- | ---: | --- |");
    for (const metric of tools.getBriefMetrics(sourceLedger)) {
      lines.push(`| ${metric.label} | ${tools.formatValue(metric.value, metric.unit)} | ${metric.context || ""} |`);
    }
    lines.push("");

    lines.push("## III. 주요 관찰");
    lines.push("");
    if (director.length === 0) {
      lines.push("- 요약에 포함된 주요 관찰이 없습니다.");
    } else {
      for (const observation of director) {
        lines.push(`- ${observation.recommended_wording || observation.claim}`);
      }
    }
    lines.push("");

    for (const [heading, items] of groupDetailSections(observations)) {
      lines.push(`## ${heading}`);
      lines.push("");
      for (const observation of items) {
        lines.push(`### ${observation.claim}`);
        lines.push("");
        lines.push(observation.recommended_wording || observation.claim);
        if (observation.evidence?.length) {
          lines.push("");
          lines.push("근거:");
          for (const item of observation.evidence) lines.push(`- ${tools.evidenceText(item)}`);
        }
        lines.push("");
      }
    }

    if (dataQuality.length) {
      lines.push("## 데이터 검증 및 후속 참고");
      lines.push("");
      for (const observation of dataQuality) {
        lines.push(`- ${observation.recommended_wording || observation.claim}`);
        if (observation.caveat) lines.push(`  - 확인 필요: ${observation.caveat}`);
        for (const item of observation.evidence || []) lines.push(`  - ${tools.evidenceText(item)}`);
      }
      lines.push("");
    }

    lines.push("끝.");
    return lines.join("\n").trim();
  }

  function makeReportHtml(sourceLedger) {
    const report = sourceLedger.report || {};
    const observations = sourceLedger.observations || [];
    const dataQuality = observations.filter((item) => item.statement_kind === "data_quality");
    const director = observations
      .filter((item) => item.report_placement?.director_brief && item.statement_kind !== "data_quality")
      .sort((a, b) => importanceRank(a.importance) - importanceRank(b.importance));
    const metricRows = tools
      .getBriefMetrics(sourceLedger)
      .map((metric) => {
        return `<tr><th>${escapeHtml(metric.label)}</th><td>${escapeHtml(tools.formatValue(metric.value, metric.unit))}</td><td>${escapeHtml(metric.context || "")}</td></tr>`;
      })
      .join("");
    const directorBody = director.length
      ? `<ol class="summary-list">${director.map(observationSummaryHtml).join("")}</ol>`
      : `<p>요약에 포함된 주요 관찰이 없습니다.</p>`;
    const chartSection = window.ReportCharts ? window.ReportCharts.renderReportSection(sourceLedger, tools) : "";
    const sectionBlocks = groupDetailSections(observations)
      .map(([heading, items]) => {
        return `<section class="report-section"><h2>${escapeHtml(heading)}</h2>${items.map(observationDetailHtml).join("")}</section>`;
      })
      .join("");
    const dataQualityBlock = dataQuality.length
      ? `<section class="report-section"><h2>데이터 검증 및 후속 참고</h2>${dataQuality.map(observationDetailHtml).join("")}</section>`
      : "";
    const generatedAt = new Date().toLocaleString("ko-KR");

    return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(report.title || "전시보고서")}</title>
  <style>
    @page { size: A4; margin: 20mm 18mm; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #e9e9e9; color: #111; font-family: "Malgun Gothic", "Noto Sans KR", Arial, sans-serif; font-size: 10.5pt; line-height: 1.75; }
    main { width: 210mm; min-height: 297mm; margin: 24px auto; padding: 22mm 18mm; background: #fff; box-shadow: 0 10px 30px rgba(0,0,0,.14); }
    h1 { margin: 0 0 10mm; padding-top: 16mm; border-top: 4px solid #111; font-size: 22pt; line-height: 1.35; word-break: keep-all; }
    h2 { margin: 13mm 0 5mm; padding-bottom: 2mm; border-bottom: 1.5px solid #111; font-size: 15pt; }
    h3 { margin: 7mm 0 2mm; font-size: 11.5pt; }
    p { margin: 0 0 3.5mm; word-break: keep-all; }
    table { width: 100%; border-collapse: collapse; margin: 3mm 0 7mm; table-layout: fixed; }
    th, td { border: 1px solid #b9b9b9; padding: 2.5mm 3mm; vertical-align: top; word-break: keep-all; }
    th { width: 30%; background: #f3f3f3; text-align: left; font-weight: 700; }
    td:nth-child(2) { width: 22%; text-align: right; white-space: nowrap; }
    .cover-meta { display: grid; grid-template-columns: 26mm 1fr; gap: 1.5mm 6mm; margin: 0 0 16mm; }
    .cover-meta dt { color: #555; }
    .cover-meta dd { margin: 0; font-weight: 700; }
    .scope-note { margin: 0 0 10mm; padding: 4mm 5mm; border-left: 3px solid #111; background: #f6f6f6; }
    .summary-list { margin: 0 0 7mm; padding-left: 7mm; }
    .summary-list li { margin-bottom: 4mm; }
    .source { color: #555; font-size: 9.5pt; }
    .report-chart-grid { display: grid; gap: 5mm; margin: 4mm 0 8mm; }
    .report-chart { break-inside: avoid; border: 1px solid #c9c9c9; padding: 4mm; }
    .report-chart svg { display: block; width: 100%; height: auto; }
    .chart-title { font: 700 15px "Malgun Gothic", "Noto Sans KR", Arial, sans-serif; fill: #111; }
    .chart-legend text { font: 11px "Malgun Gothic", "Noto Sans KR", Arial, sans-serif; fill: #555; }
    .chart-legend rect.current,
    .chart-legend rect { fill: #245d4b; }
    .chart-legend rect.reference { fill: #b7afa2; }
    .chart-label { font: 12px "Malgun Gothic", "Noto Sans KR", Arial, sans-serif; fill: #333; }
    .chart-value { font: 11px "Malgun Gothic", "Noto Sans KR", Arial, sans-serif; fill: #444; }
    .chart-track { fill: #edf0e9; }
    .current { fill: #245d4b; }
    .reference { fill: #b7afa2; }
    .observation-block { margin-bottom: 7mm; page-break-inside: avoid; }
    .meta-grid { display: grid; grid-template-columns: 26mm 1fr 26mm 1fr; gap: 1mm 4mm; margin: 2mm 0 3mm; font-size: 9.5pt; }
    .meta-grid dt { color: #555; }
    .meta-grid dd { margin: 0; }
    .caveat { margin-top: 2mm; color: #6f3a0b; }
    .evidence-list { margin: 1mm 0 0; padding-left: 6mm; color: #444; font-size: 9.5pt; }
    .footer { margin-top: 12mm; padding-top: 3mm; border-top: 1px solid #999; color: #666; font-size: 9pt; }
    @media print { body { background: #fff; } main { width: auto; min-height: auto; margin: 0; padding: 0; box-shadow: none; } }
  </style>
</head>
<body>
  <main>
    <section class="cover">
      <p>일민미술관 전시보고서</p>
      <h1>${escapeHtml(report.title || "전시보고서")}</h1>
      <dl class="cover-meta">
        <dt>전시 기간</dt><dd>${escapeHtml(report.period || "")}</dd>
        <dt>장소</dt><dd>${escapeHtml(report.venue || "")}</dd>
      </dl>
      ${report.scope_note ? `<p class="scope-note">${escapeHtml(report.scope_note)}</p>` : ""}
    </section>

    <section class="report-section">
      <h2>I. 핵심 수치 종합</h2>
      <table>
        <thead><tr><th>항목</th><th>값</th><th>참고</th></tr></thead>
        <tbody>${metricRows}</tbody>
      </table>
    </section>

    ${chartSection}

    <section class="report-section">
      <h2>II. 주요 관찰</h2>
      ${directorBody}
    </section>

    ${sectionBlocks}
    ${dataQualityBlock}

    <p class="footer">이 문서는 웹 검토 화면에서 포함 처리된 관찰을 기준으로 생성되었습니다. 생성 시각: ${escapeHtml(generatedAt)}</p>
  </main>
</body>
</html>`;
  }

  function observationSummaryHtml(observation) {
    const evidence = observation.evidence?.length ? tools.evidenceText(observation.evidence[0]) : "";
    return `<li>
      <p>${escapeHtml(observation.recommended_wording || observation.claim)}</p>
      ${evidence ? `<p class="source">근거: ${escapeHtml(evidence)}</p>` : ""}
    </li>`;
  }

  function observationDetailHtml(observation) {
    return `<article class="observation-block">
      <h3>${escapeHtml(observation.claim)}</h3>
      <p>${escapeHtml(observation.recommended_wording || observation.claim)}</p>
      <dl class="meta-grid">
        <dt>중요도</dt><dd>${escapeHtml(observation.importance || "")}</dd>
        <dt>진술 성격</dt><dd>${escapeHtml(tools.kindLabel(observation.statement_kind))}</dd>
        <dt>관찰 ID</dt><dd>${escapeHtml(observation.id || "")}</dd>
      </dl>
      ${evidenceListHtml(observation)}
    </article>`;
  }

  function evidenceListHtml(observation) {
    if (!observation.evidence?.length) return "";
    const items = observation.evidence.map((item) => `<li>${escapeHtml(tools.evidenceText(item))}</li>`).join("");
    return `<p class="source">근거</p><ul class="evidence-list">${items}</ul>`;
  }

  function groupDetailSections(observations) {
    const order = ["III. 전시 구성", "IV. 전시 결과", "V. 홍보 방식 및 언론 보도", "VI. 종합 기록"];
    return order
      .map((section) => [section, observations.filter((item) => item.report_placement?.detailed_section === section)])
      .filter(([, items]) => items.length > 0);
  }

  function importanceRank(importance) {
    return { high: 0, medium: 1, low: 2 }[importance] ?? 3;
  }

  function pushLine(lines, value) {
    if (value) lines.push(value);
  }

  function downloadText(filename, text, mimeType) {
    const blob = new Blob([text], { type: `${mimeType};charset=utf-8` });
    downloadBlob(filename, blob);
  }

  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function openPrintReport(sourceLedger) {
    const html = makeReportHtml(sourceLedger).replace(
      "</body>",
      "<script>window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 250); });</script></body>"
    );
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, "_blank");
    if (!printWindow) {
      downloadBlob("approved-report-print.html", blob);
      showToast("팝업이 차단되어 PDF용 HTML을 다운로드했습니다.");
      return;
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    showToast("인쇄 창에서 PDF로 저장할 수 있습니다.");
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

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  init();
})();
