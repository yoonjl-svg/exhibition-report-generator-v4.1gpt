(function () {
  const DEFINITIONS = [
    {
      id: "audience",
      title: "관객 규모 비교",
      metricIds: ["total_visitors", "daily_visitors"]
    },
    {
      id: "finance",
      title: "예산 및 수입 구조",
      metricIds: ["total_budget", "total_income", "cost_per_visitor"]
    },
    {
      id: "engagement",
      title: "참여 및 홍보 지표",
      metricIds: ["program_sessions", "program_participants", "press_mentions", "sns_feedback"]
    }
  ];

  function build(ledger, tools) {
    const metricMap = new Map((ledger.metrics || []).map((metric) => [metric.id, metric]));
    const allowedIds = selectedMetricIds(ledger, tools);

    return DEFINITIONS.map((definition) => {
      const rows = definition.metricIds
        .filter((id) => allowedIds.has(id))
        .map((id) => chartRow(metricMap.get(id), tools))
        .filter(Boolean);

      return {
        id: definition.id,
        title: definition.title,
        rows
      };
    }).filter((chart) => chart.rows.length > 0);
  }

  function selectedMetricIds(ledger, tools) {
    const ids = new Set();
    const briefMetrics = tools?.getBriefMetrics ? tools.getBriefMetrics(ledger) : [];
    for (const metric of briefMetrics) ids.add(metric.id);
    for (const observation of ledger.observations || []) {
      if (observation.metric) ids.add(observation.metric);
    }
    return ids;
  }

  function chartRow(metric, tools) {
    if (!metric) return null;
    const current = numberValue(metric.value);
    const reference = numberValue(metric.reference_value);
    if (current === null || reference === null) return null;

    const max = Math.max(Math.abs(current), Math.abs(reference), 1);
    return {
      label: metric.label,
      current,
      reference,
      currentLabel: formatValue(current, metric.unit, tools),
      referenceLabel: formatValue(reference, metric.unit, tools),
      currentPct: Math.max(2, Math.round((Math.abs(current) / max) * 100)),
      referencePct: Math.max(2, Math.round((Math.abs(reference) / max) * 100)),
      context: metric.context || ""
    };
  }

  function renderList(charts) {
    if (!charts.length) return "";
    return charts.map(renderCard).join("");
  }

  function renderReportSection(ledger, tools) {
    const charts = build(ledger, tools);
    if (!charts.length) return "";
    return `
      <section class="report-section chart-section">
        <h2>그래프 요약</h2>
        <div class="report-chart-grid">
          ${renderList(charts)}
        </div>
      </section>
    `;
  }

  function renderCard(chart) {
    const height = 56 + chart.rows.length * 48;
    const rows = chart.rows
      .map((row, index) => renderRow(row, 52 + index * 48))
      .join("");

    return `
      <article class="report-chart" data-chart-id="${escapeHtml(chart.id)}">
        <svg viewBox="0 0 720 ${height}" role="img" aria-label="${escapeHtml(chart.title)}">
          <text x="0" y="20" class="chart-title">${escapeSvg(chart.title)}</text>
          <g class="chart-legend">
            <rect x="522" y="8" width="10" height="10" rx="2"></rect>
            <text x="538" y="17">현재 전시</text>
            <rect x="610" y="8" width="10" height="10" rx="2" class="reference"></rect>
            <text x="626" y="17">기준 평균</text>
          </g>
          ${rows}
        </svg>
      </article>
    `;
  }

  function renderRow(row, y) {
    const barX = 150;
    const barWidth = 330;
    const currentWidth = Math.round((row.currentPct / 100) * barWidth);
    const referenceWidth = Math.round((row.referencePct / 100) * barWidth);

    return `
      <g class="chart-row">
        <text x="0" y="${y + 8}" class="chart-label">${escapeSvg(row.label)}</text>
        <rect x="${barX}" y="${y - 12}" width="${barWidth}" height="12" rx="3" class="chart-track"></rect>
        <rect x="${barX}" y="${y - 12}" width="${currentWidth}" height="12" rx="3" class="current"></rect>
        <text x="496" y="${y - 2}" class="chart-value">${escapeSvg(row.currentLabel)}</text>
        <rect x="${barX}" y="${y + 7}" width="${barWidth}" height="12" rx="3" class="chart-track"></rect>
        <rect x="${barX}" y="${y + 7}" width="${referenceWidth}" height="12" rx="3" class="reference"></rect>
        <text x="496" y="${y + 17}" class="chart-value">${escapeSvg(row.referenceLabel)}</text>
      </g>
    `;
  }

  function numberValue(value) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value.replace(/,/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  }

  function formatValue(value, unit, tools) {
    if (tools?.formatValue) return tools.formatValue(value, unit);
    return String(value);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeSvg(value) {
    return escapeHtml(value);
  }

  window.ReportCharts = {
    build,
    renderList,
    renderReportSection
  };
})();
