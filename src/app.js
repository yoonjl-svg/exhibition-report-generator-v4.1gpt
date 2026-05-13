(function () {
  let ledger = null;
  const sampleLedger = window.GENERATED_LEDGER || window.SAMPLE_LEDGER;
  const tools = window.LedgerTools;
  let showEvidence = true;
  let reviewState = {};
  let referenceOpenState = {};

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
    reportDraft: document.querySelector("#report-draft"),
    reportDraftNote: document.querySelector("#report-draft-note"),
    count: document.querySelector("#observation-count"),
    health: document.querySelector("#health-list"),
    review: document.querySelector("#review-list"),
    referenceSummary: document.querySelector("#reference-summary"),
    referenceGroupList: document.querySelector("#reference-group-list"),
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
    renderReferenceGroups();
    renderHealth();
    renderReviewSummary();
    renderMetrics();
    renderBrief();
    renderReportDraft();
    renderLedger();
    showToast(sourceLabel ? `${sourceLabel} 데이터를 불러왔습니다.` : "전시 데이터를 불러왔습니다.");
  }

  function setReportActionsEnabled(enabled) {
    for (const item of [els.exportMenuButton, els.downloadReportDoc, els.printReportPdf]) {
      item.disabled = !enabled;
    }
  }

  function renderReferenceGroups() {
    const groups = ledger.reference_groups || [];
    const activeId = currentReferenceGroupId();
    const activeGroup = groups.find((group) => group.id === activeId) || groups[0];
    if (!groups.length) {
      els.referenceSummary.textContent = "비교 기준 데이터 없음";
      els.referenceGroupList.innerHTML = "";
      return;
    }
    const activeCount = referenceGroupCount(activeGroup);
    els.referenceSummary.textContent = activeCount
      ? `${activeGroup.label} ${activeCount}건 기준`
      : `${activeGroup.label} 기준`;
    els.referenceGroupList.innerHTML = groups.map((group) => renderReferenceGroup(group, activeId)).join("");
  }

  function renderReferenceGroup(group, activeId) {
    const members = referenceGroupMembers(group);
    const count = referenceGroupCount(group);
    const isActive = group.id === activeId;
    const isOpen = referenceOpenState[group.id] ?? isActive;
    const disabled = !canRebuildReferenceGroup() && !isActive;
    return `
      <article class="reference-group ${isActive ? "is-active" : ""}" data-reference-id="${escapeHtml(group.id)}">
        <div class="reference-group-head">
          <label class="reference-choice">
            <input type="checkbox" data-reference-choice="${escapeHtml(group.id)}" ${isActive ? "checked" : ""} ${disabled ? "disabled" : ""} />
            <span>${escapeHtml(group.label)}</span>
          </label>
          <button class="reference-toggle" type="button" data-reference-toggle="${escapeHtml(group.id)}" aria-expanded="${String(isOpen)}">${isOpen ? "접기" : "펼치기"}</button>
        </div>
        <p class="reference-rule">${escapeHtml(group.selection_rule || (count ? `${count}건` : "비교군 설명 없음"))}</p>
        <div class="reference-members" ${isOpen ? "" : "hidden"}>
          ${members.length ? `<ul>${members.map(renderReferenceMember).join("")}</ul>` : `<p>펼쳐볼 전시 목록이 없습니다.</p>`}
        </div>
      </article>
    `;
  }

  function renderReferenceMember(member) {
    const details = [
      member.type,
      member.total_visitors !== undefined && member.total_visitors !== null ? tools.formatValue(member.total_visitors, "people") : "",
      member.daily_visitors !== undefined && member.daily_visitors !== null ? `일평균 ${tools.formatValue(member.daily_visitors, "people")}` : ""
    ]
      .filter(Boolean)
      .join(" · ");
    return `<li><strong>${escapeHtml(member.title || member.id || "제목 없음")}</strong>${details ? `<span>${escapeHtml(details)}</span>` : ""}</li>`;
  }

  function currentReferenceGroupId() {
    return (
      ledger.report?.reference_group_id ||
      (ledger.metrics || []).find((metric) => metric.reference_group)?.reference_group ||
      ledger.reference_groups?.[0]?.id ||
      ""
    );
  }

  function referenceGroupMembers(group) {
    return Array.isArray(group?.members) ? group.members : [];
  }

  function referenceGroupCount(group) {
    if (!group) return 0;
    const members = referenceGroupMembers(group);
    if (members.length) return members.length;
    const match = String(group.selection_rule || "").match(/(\d+)\s*건/);
    return match ? Number(match[1]) : 0;
  }

  function canRebuildReferenceGroup() {
    return Boolean(ledger?.source_input && window.InputLoader?.buildLedger);
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
    const reportObservationIds = new Set(
      (ledger.observations || [])
        .filter((observation) => observation.statement_kind !== "data_quality")
        .map((observation) => observation.id)
    );
    const states = Object.entries(reviewState)
      .filter(([id]) => reportObservationIds.has(id))
      .map(([, state]) => state);
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

  function renderReportDraft() {
    const approved = makeApprovedLedger();
    els.reportDraft.innerHTML = reportPreviewHtml(approved);
    els.reportDraftNote.textContent = "보고서 미리보기";
  }

  function renderLedger() {
    const observations = ledger.observations || [];
    els.count.textContent = `전체 ${observations.length}개 관찰`;
    els.ledgerList.innerHTML = observations.map(renderObservation).join("");
  }

  function renderObservation(observation) {
    const evidence = (observation.evidence || []).map((item) => `<li>${escapeHtml(tools.evidenceText(item))}</li>`).join("");
    const caveat = observation.caveat ? `<p class="caveat">${escapeHtml(observation.caveat)}</p>` : "";
    const wording = observation.recommended_wording || observation.claim;
    const state = reviewState[observation.id] || defaultObservationState(observation);
    const isDataQuality = observation.statement_kind === "data_quality";
    const articleClass = [
      "observation",
      isDataQuality ? "is-data-quality" : "",
      !isDataQuality && !state.included ? "is-excluded" : ""
    ]
      .filter(Boolean)
      .join(" ");
    const reviewControls = isDataQuality
      ? ""
      : `
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
      `;

    return `
      <article class="${articleClass}" data-id="${observation.id}">
        <div class="observation-header">
          <p class="claim">${escapeHtml(observation.claim)}</p>
          <div class="chips">
            <span class="chip ${observation.importance}">${observation.importance}</span>
            <span class="chip">${tools.sectionLabel(observation.section)}</span>
            <span class="chip">${tools.kindLabel(observation.statement_kind)}</span>
          </div>
        </div>
        ${reviewControls}
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

    els.referenceGroupList.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const toggle = target?.closest("[data-reference-toggle]");
      if (!toggle || !ledger) return;
      const id = toggle.dataset.referenceToggle;
      referenceOpenState[id] = !(referenceOpenState[id] ?? id === currentReferenceGroupId());
      renderReferenceGroups();
    });

    els.referenceGroupList.addEventListener("change", (event) => {
      const target = event.target instanceof HTMLInputElement ? event.target : null;
      if (!ledger || !target || !target.dataset.referenceChoice) return;
      if (!target.checked) {
        target.checked = true;
        return;
      }
      applyReferenceGroup(target.dataset.referenceChoice);
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
        if (observation.statement_kind === "data_quality") continue;
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

  function applyReferenceGroup(referenceId) {
    if (referenceId === currentReferenceGroupId()) {
      renderReferenceGroups();
      return;
    }
    if (!canRebuildReferenceGroup()) {
      renderReferenceGroups();
      showToast("이 데이터에는 비교 기준 재계산용 원본 입력이 포함되어 있지 않습니다.");
      return;
    }
    const nextLedger = window.InputLoader.buildLedger(clone(ledger.source_input), referenceId);
    setLedger(nextLedger, nextLedger.report.reference_group_label || "비교 기준");
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
    renderReferenceGroups();
    renderReviewSummary();
    renderBrief();
    renderReportDraft();
    renderLedger();
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
    if (observation?.statement_kind === "data_quality") {
      return {
        included: false,
        directorBrief: false,
      };
    }
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
      .filter((observation) => {
        return observation.statement_kind !== "data_quality" && reviewState[observation.id]?.included !== false;
      })
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
    lines.push("| 지표 | 이번 전시 | 기준값 | 차이 |");
    lines.push("| --- | ---: | ---: | ---: |");
    for (const row of metricSummaryRows(sourceLedger)) {
      lines.push(`| ${row.label} | ${row.current} | ${row.reference} | ${row.difference} |`);
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

    lines.push("끝.");
    return lines.join("\n").trim();
  }

  function makeReportHtml(sourceLedger) {
    const report = sourceLedger.report || {};
    const observations = sourceLedger.observations || [];
    const director = observations
      .filter((item) => item.report_placement?.director_brief && item.statement_kind !== "data_quality")
      .sort((a, b) => importanceRank(a.importance) - importanceRank(b.importance));
    const metricRows = metricSummaryRows(sourceLedger)
      .map((row) => {
        return `<tr><th>${escapeHtml(row.label)}</th><td class="numeric">${escapeHtml(row.current)}</td><td class="numeric">${escapeHtml(row.reference)}</td><td class="numeric delta">${escapeHtml(row.difference)}</td></tr>`;
      })
      .join("");
    const referenceLabel = reportReferenceLabel(sourceLedger);
    const directorBody = director.length
      ? `<ol class="summary-list">${director.map(observationSummaryHtml).join("")}</ol>`
      : `<p>요약에 포함된 주요 관찰이 없습니다.</p>`;
    const chartSection = window.ReportCharts ? window.ReportCharts.renderReportSection(sourceLedger, tools) : "";
    const sectionBlocks = groupDetailSections(observations)
      .map(([heading, items]) => {
        return `<section class="report-section"><h2>${escapeHtml(heading)}</h2>${items.map(observationDetailHtml).join("")}</section>`;
      })
      .join("");
    const generatedAt = new Date().toLocaleString("ko-KR");

    return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(report.title || "전시보고서")}</title>
  <style>
    @page { size: A4; margin: 18mm 17mm 20mm; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #e7e7e2; color: #161616; font-family: "Noto Sans KR", "Malgun Gothic", Arial, sans-serif; font-size: 10pt; line-height: 1.78; }
    main { width: 210mm; min-height: 297mm; margin: 22px auto; padding: 20mm 17mm 18mm; background: #fff; box-shadow: 0 10px 30px rgba(0,0,0,.13); }
    h1 { margin: 0 0 13mm; padding-top: 7mm; border-top: 3px solid #161616; font-size: 20pt; line-height: 1.38; word-break: keep-all; }
    h2 { margin: 14mm 0 5mm; padding-top: 2.5mm; border-top: 1.5px solid #161616; font-size: 13.5pt; line-height: 1.35; }
    h3 { margin: 8mm 0 3mm; font-size: 10.5pt; line-height: 1.45; }
    p { margin: 0 0 3.5mm; word-break: keep-all; }
    table { width: 100%; border-collapse: collapse; margin: 3mm 0 4mm; table-layout: fixed; }
    th, td { border: 0; border-bottom: 1px solid #d9d9d2; padding: 2.3mm 1.5mm; vertical-align: top; word-break: keep-all; }
    thead th { border-top: 1.5px solid #161616; border-bottom: 1px solid #161616; color: #555; font-size: 8.8pt; font-weight: 700; text-align: left; }
    tbody tr:last-child th, tbody tr:last-child td { border-bottom: 1.5px solid #161616; }
    tbody th { width: 27%; font-weight: 700; text-align: left; }
    .numeric { text-align: right; white-space: nowrap; }
    .delta { width: 17%; }
    .table-note { margin: -1mm 0 7mm; color: #666; font-size: 9pt; }
    .report-kicker { margin: 0 0 5mm; color: #555; font-size: 9.3pt; font-weight: 700; }
    .cover-meta { display: grid; grid-template-columns: 24mm 1fr; gap: 1.5mm 6mm; margin: 0 0 15mm; }
    .cover-meta dt { color: #555; font-size: 9.5pt; }
    .cover-meta dd { margin: 0; font-weight: 700; }
    .scope-note { margin: 0 0 10mm; padding: 0 0 0 4mm; border-left: 2px solid #161616; color: #444; }
    .summary-list { margin: 0 0 7mm; padding-left: 6mm; }
    .summary-list li { margin-bottom: 3.5mm; }
    .source { color: #666; font-size: 9pt; }
    .chart-section { margin-top: 7mm; }
    .report-chart-grid { display: grid; gap: 5.5mm; margin: 4mm 0 8mm; }
    .report-chart { break-inside: avoid; margin: 0; padding: 0 0 4.5mm; border-bottom: 1px solid #d9d9d2; }
    .report-chart figcaption { margin: 0 0 2.5mm; font-size: 9pt; font-weight: 700; }
    .report-chart svg { display: block; width: 100%; height: auto; }
    .chart-legend text, .chart-series-label, .chart-value { font: 10px "Noto Sans KR", "Malgun Gothic", Arial, sans-serif; fill: #666; }
    .chart-legend rect.current,
    .chart-legend rect { fill: #255c4a; }
    .chart-legend rect.reference { fill: #aaa59b; }
    .chart-label { font: 700 11px "Noto Sans KR", "Malgun Gothic", Arial, sans-serif; fill: #222; }
    .chart-track { fill: #efefea; }
    .current { fill: #255c4a; }
    .reference { fill: #aaa59b; }
    .observation-block { margin-bottom: 7.5mm; page-break-inside: avoid; }
    .meta-grid { display: grid; grid-template-columns: 24mm 1fr 24mm 1fr; gap: 1mm 4mm; margin: 2mm 0 3mm; font-size: 9pt; }
    .meta-grid dt { color: #555; }
    .meta-grid dd { margin: 0; }
    .caveat { margin-top: 2mm; color: #6f3a0b; }
    .evidence-list { margin: 1mm 0 0; padding-left: 5mm; color: #555; font-size: 9pt; }
    .footer { margin-top: 12mm; padding-top: 3mm; border-top: 1px solid #aaa; color: #666; font-size: 8.8pt; }
    @media print { body { background: #fff; } main { width: auto; min-height: auto; margin: 0; padding: 0; box-shadow: none; } }
  </style>
</head>
<body>
  <main>
    <section class="cover">
      <p class="report-kicker">일민미술관 전시보고서</p>
      <h1>${escapeHtml(report.title || "전시보고서")}</h1>
      <dl class="cover-meta">
        <dt>전시 기간</dt><dd>${escapeHtml(report.period || "")}</dd>
        <dt>장소</dt><dd>${escapeHtml(report.venue || "")}</dd>
      </dl>
      ${report.scope_note ? `<p class="scope-note">${escapeHtml(report.scope_note)}</p>` : ""}
    </section>

    <section class="report-section">
      <h2>I. 핵심 수치 종합</h2>
      <table class="metric-summary-table">
        <thead><tr><th>지표</th><th>이번 전시</th><th>기준값</th><th>차이</th></tr></thead>
        <tbody>${metricRows}</tbody>
      </table>
      ${referenceLabel ? `<p class="table-note">기준값: ${escapeHtml(referenceLabel)} 평균</p>` : ""}
      ${chartSection}
    </section>

    <section class="report-section">
      <h2>II. 주요 관찰</h2>
      ${directorBody}
    </section>

    ${sectionBlocks}

    <p class="footer">이 문서는 웹 검토 화면에서 포함 처리된 관찰을 기준으로 생성되었습니다. 생성 시각: ${escapeHtml(generatedAt)}</p>
  </main>
</body>
</html>`;
  }

  function metricSummaryRows(sourceLedger) {
    return tools.getBriefMetrics(sourceLedger).map((metric) => ({
      label: metric.label,
      current: tools.formatValue(metric.value, metric.unit),
      reference:
        metric.reference_value !== undefined && metric.reference_value !== null
          ? tools.formatValue(metric.reference_value, metric.unit)
          : "비교 기준 없음",
      difference: metricDifferenceLabel(metric)
    }));
  }

  function reportReferenceLabel(sourceLedger) {
    const metric = tools.getBriefMetrics(sourceLedger).find((item) => item.reference_label);
    return metric?.reference_label || "";
  }

  function metricDifferenceLabel(metric) {
    if (metric.difference_abs !== undefined && metric.difference_abs !== null) {
      const value = Number(metric.difference_abs);
      if (!Number.isFinite(value)) return "-";
      if (metric.unit === "percent") return `${signedNumber(value)}%p`;
      return signedFormattedValue(value, metric.unit);
    }
    if (metric.difference_pct !== undefined && metric.difference_pct !== null) {
      const value = Number(metric.difference_pct);
      return Number.isFinite(value) ? `${signedNumber(value)}%` : "-";
    }
    const current = Number(metric.value);
    const reference = Number(metric.reference_value);
    if (Number.isFinite(current) && Number.isFinite(reference) && reference !== 0) {
      return `${signedNumber(((current - reference) / reference) * 100)}%`;
    }
    return "-";
  }

  function signedFormattedValue(value, unit) {
    const sign = value > 0 ? "+" : "";
    return `${sign}${tools.formatValue(value, unit)}`;
  }

  function signedNumber(value) {
    const rounded = Math.abs(value) >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
    const formatted = rounded.toLocaleString("ko-KR", {
      maximumFractionDigits: 1,
      minimumFractionDigits: Number.isInteger(rounded) ? 0 : 1
    });
    return `${rounded > 0 ? "+" : ""}${formatted}`;
  }

  function reportPreviewHtml(sourceLedger) {
    const html = makeReportHtml(sourceLedger);
    const document = new DOMParser().parseFromString(html, "text/html");
    const main = document.querySelector("main");
    return main ? main.innerHTML : "";
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
