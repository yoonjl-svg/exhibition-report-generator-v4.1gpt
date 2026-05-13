(function () {
  const DEFINITIONS = [
    {
      id: "audience",
      title: "관객 규모",
      metricIds: ["total_visitors", "daily_visitors"]
    },
    {
      id: "finance",
      title: "재정 지표",
      metricIds: ["total_budget", "total_income", "cost_per_visitor"]
    },
    {
      id: "engagement",
      title: "참여 및 홍보",
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
    return charts.map((chart, index) => renderFigure(chart, index + 1)).join("");
  }

  function renderReportSection(ledger, tools) {
    const charts = build(ledger, tools);
    if (!charts.length) return "";
    return `
      <div class="chart-section">
        <h3>핵심 지표 도표</h3>
        <div class="report-chart-grid">
          ${renderList(charts)}
        </div>
      </div>
    `;
  }

  function renderFigure(chart, figureNumber) {
    const height = 26 + chart.rows.length * 70;
    const rows = chart.rows
      .map((row, index) => renderRow(row, 36 + index * 70))
      .join("");

    return `
      <figure class="report-chart" data-chart-id="${escapeHtml(chart.id)}">
        <figcaption>그림 ${figureNumber}. ${escapeHtml(chart.title)} 비교</figcaption>
        <svg viewBox="0 0 720 ${height}" role="img" aria-label="${escapeHtml(chart.title)}">
          <g class="chart-legend">
            <rect x="0" y="0" width="10" height="10" rx="1"></rect>
            <text x="16" y="9">이번 전시</text>
            <rect x="90" y="0" width="10" height="10" rx="1" class="reference"></rect>
            <text x="106" y="9">기준 평균</text>
          </g>
          ${rows}
        </svg>
      </figure>
    `;
  }

  function renderRow(row, y) {
    const barX = 92;
    const barWidth = 390;
    const valueX = 502;
    const currentWidth = Math.round((row.currentPct / 100) * barWidth);
    const referenceWidth = Math.round((row.referencePct / 100) * barWidth);

    return `
      <g class="chart-row">
        <text x="0" y="${y}" class="chart-label">${escapeSvg(row.label)}</text>
        <text x="0" y="${y + 24}" class="chart-series-label">이번 전시</text>
        <rect x="${barX}" y="${y + 12}" width="${barWidth}" height="10" rx="1" class="chart-track"></rect>
        <rect x="${barX}" y="${y + 12}" width="${currentWidth}" height="10" rx="1" class="current"></rect>
        <text x="${valueX}" y="${y + 22}" class="chart-value">${escapeSvg(row.currentLabel)}</text>
        <text x="0" y="${y + 45}" class="chart-series-label">기준 평균</text>
        <rect x="${barX}" y="${y + 33}" width="${barWidth}" height="10" rx="1" class="chart-track"></rect>
        <rect x="${barX}" y="${y + 33}" width="${referenceWidth}" height="10" rx="1" class="reference"></rect>
        <text x="${valueX}" y="${y + 43}" class="chart-value">${escapeSvg(row.referenceLabel)}</text>
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
