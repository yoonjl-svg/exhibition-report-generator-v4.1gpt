(function () {
  const SECTION_LABELS = {
    overview: "전시 개요",
    composition: "전시 구성",
    results: "전시 결과",
    audience_response: "관객 반응",
    publicity: "홍보/언론",
    membership: "멤버십",
    synthesis: "종합 기록",
    data_quality: "데이터 검증"
  };

  const KIND_LABELS = {
    factual: "사실",
    comparative: "비교",
    interpretive: "해석",
    inference: "추정",
    data_quality: "검증"
  };

  function formatNumber(value) {
    if (typeof value !== "number") return String(value ?? "");
    return new Intl.NumberFormat("ko-KR").format(value);
  }

  function formatKrwAsEok(value) {
    const eok = value / 100000000;
    const hasDecimal = Math.abs(eok % 1) > 0.00001;
    return `${new Intl.NumberFormat("ko-KR", {
      maximumFractionDigits: 1,
      minimumFractionDigits: hasDecimal ? 1 : 0
    }).format(eok)}억`;
  }

  function formatValue(value, unit) {
    if (value === null || value === undefined) return "-";
    if (unit === "krw") return formatKrwAsEok(value);
    if (unit === "people") return `${formatNumber(value)}명`;
    if (unit === "count") return `${formatNumber(value)}건`;
    if (unit === "program_count") return `${formatNumber(value)}개`;
    if (unit === "percent") return `${formatNumber(value)}%`;
    if (unit === "krw_per_person") return `${formatNumber(value)}원/명`;
    return `${formatNumber(value)}${unit ? ` ${unit}` : ""}`;
  }

  function sectionLabel(section) {
    return SECTION_LABELS[section] || section;
  }

  function kindLabel(kind) {
    return KIND_LABELS[kind] || kind;
  }

  function getBriefMetrics(ledger) {
    const ids = ledger.report.brief_metric_ids || [];
    const metrics = new Map(ledger.metrics.map((metric) => [metric.id, metric]));
    return ids.map((id) => metrics.get(id)).filter(Boolean);
  }

  function getBriefMetricGroups(ledger) {
    const metrics = new Map(ledger.metrics.map((metric) => [metric.id, metric]));
    const groups = ledger.report.brief_metric_groups || [];
    if (groups.length) {
      return groups
        .map((group) => ({
          ...group,
          metrics: (group.metric_ids || []).map((id) => metrics.get(id)).filter(Boolean)
        }))
        .filter((group) => group.metrics.length);
    }
    return getBriefMetrics(ledger).map((metric) => ({
      id: metric.id,
      label: metric.label,
      metrics: [metric]
    }));
  }

  function getDirectorObservations(ledger) {
    return ledger.observations
      .filter((observation) => observation.report_placement?.director_brief)
      .sort((a, b) => importanceRank(a.importance) - importanceRank(b.importance));
  }

  function importanceRank(importance) {
    return { high: 0, medium: 1, low: 2 }[importance] ?? 3;
  }

  function getSections(ledger) {
    const values = Array.from(new Set(ledger.observations.map((item) => item.section)));
    return values.sort((a, b) => sectionLabel(a).localeCompare(sectionLabel(b), "ko"));
  }

  function filterObservations(ledger, filters) {
    return ledger.observations.filter((item) => {
      const sectionOk = filters.section === "all" || item.section === filters.section;
      const importanceOk = filters.importance === "all" || item.importance === filters.importance;
      const kindOk = filters.kind === "all" || item.statement_kind === filters.kind;
      return sectionOk && importanceOk && kindOk;
    });
  }

  function validateLedger(ledger) {
    const errors = [];
    const warnings = [];

    if (!ledger.report?.title) errors.push("report.title is required.");
    if (!Array.isArray(ledger.metrics)) errors.push("metrics must be an array.");
    if (!Array.isArray(ledger.observations)) errors.push("observations must be an array.");

    const metricIds = new Set((ledger.metrics || []).map((metric) => metric.id));
    const observationIds = new Set();

    for (const observation of ledger.observations || []) {
      if (!observation.id) errors.push("Every observation needs an id.");
      if (observationIds.has(observation.id)) errors.push(`Duplicate observation id: ${observation.id}`);
      observationIds.add(observation.id);

      for (const field of ["type", "section", "claim", "importance", "statement_kind"]) {
        if (!observation[field]) errors.push(`${observation.id || "unknown"} is missing ${field}.`);
      }

      if (!Array.isArray(observation.evidence) || observation.evidence.length === 0) {
        warnings.push(`${observation.id} has no evidence.`);
      }

      if (observation.metric && !metricIds.has(observation.metric)) {
        errors.push(`${observation.id} references missing metric: ${observation.metric}`);
      }

      if (["interpretive", "inference"].includes(observation.statement_kind) && !observation.caveat) {
        warnings.push(`${observation.id} is interpretive/inferential but has no caveat.`);
      }
    }

    return {
      errors,
      warnings,
      ok: errors.length === 0
    };
  }

  function evidenceText(evidence) {
    if (!evidence) return "";
    const value = evidence.value !== undefined ? `: ${evidence.value}` : "";
    const note = evidence.note ? ` (${evidence.note})` : "";
    return `${evidence.label}${value}${note}`;
  }

  function makeMarkdownReport(ledger) {
    const lines = [];
    lines.push(`# ${ledger.report.title}`);
    lines.push("");
    lines.push("## 핵심 관찰 요약");
    lines.push("");

    for (const metric of getBriefMetrics(ledger)) {
      const context = metric.context ? ` - ${metric.context}` : "";
      lines.push(`- ${metric.label}: ${formatValue(metric.value, metric.unit)}${context}`);
    }

    lines.push("");
    lines.push("## 주요 관찰");
    lines.push("");

    for (const observation of getDirectorObservations(ledger)) {
      lines.push(`### ${observation.claim}`);
      lines.push("");
      lines.push(observation.recommended_wording || observation.claim);
      if (observation.caveat) lines.push(`\n주의: ${observation.caveat}`);
      lines.push("");
      lines.push("근거:");
      for (const evidence of observation.evidence || []) {
        lines.push(`- ${evidenceText(evidence)}`);
      }
      lines.push("");
    }

    return lines.join("\n");
  }

  window.LedgerTools = {
    SECTION_LABELS,
    KIND_LABELS,
    evidenceText,
    filterObservations,
    formatValue,
    getBriefMetricGroups,
    getBriefMetrics,
    getDirectorObservations,
    getSections,
    kindLabel,
    makeMarkdownReport,
    sectionLabel,
    validateLedger
  };
})();
