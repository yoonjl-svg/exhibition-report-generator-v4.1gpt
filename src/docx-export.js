(function () {
  function createDocxBlob(ledger, tools) {
    const files = [
      { name: "[Content_Types].xml", text: contentTypesXml() },
      { name: "_rels/.rels", text: relsXml() },
      { name: "word/document.xml", text: documentXml(ledger, tools) },
      { name: "word/styles.xml", text: stylesXml() },
      { name: "word/settings.xml", text: settingsXml() }
    ];
    return new Blob([zipFiles(files)], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    });
  }

  function documentXml(ledger, tools) {
    const report = ledger.report || {};
    const observations = ledger.observations || [];
    const director = observations
      .filter((item) => item.report_placement?.director_brief && item.statement_kind !== "data_quality")
      .sort((a, b) => importanceRank(a.importance) - importanceRank(b.importance));
    const body = [];

    body.push(paragraph("일민미술관 전시보고서", "Kicker"));
    body.push(paragraph(report.title || "전시보고서", "Title"));
    if (report.period) body.push(paragraph(report.period, "Subtitle"));
    if (report.venue) body.push(paragraph(report.venue, "Subtitle"));
    if (report.scope_note) body.push(paragraph(report.scope_note, "ScopeNote"));
    body.push(pageBreak());

    body.push(paragraph("I. 핵심 수치 종합", "Heading1"));
    body.push(
      table(
        [["지표", "이번 전시", "기준값", "차이"]].concat(
          metricSummaryRows(ledger, tools).map((row) => [
            row.label,
            row.current,
            row.reference,
            row.difference
          ])
        ),
        true
      )
    );
    const referenceLabel = reportReferenceLabel(ledger, tools);
    if (referenceLabel) body.push(paragraph(`기준값: ${referenceLabel} 평균`, "TableNote"));
    body.push(chartSummary(ledger, tools));

    body.push(paragraph("II. 주요 관찰", "Heading1"));
    if (director.length) {
      for (const observation of director) {
        body.push(paragraph(`• ${observation.recommended_wording || observation.claim}`, "Bullet"));
        if (observation.evidence?.length) {
          body.push(paragraph(`근거: ${evidenceText(observation.evidence[0], tools)}`, "Evidence"));
        }
      }
    } else {
      body.push(paragraph("요약에 포함된 주요 관찰이 없습니다.", "BodyText"));
    }

    for (const [heading, items] of groupDetailSections(observations)) {
      body.push(paragraph(heading, "Heading1"));
      for (const observation of items) {
        body.push(paragraph(observation.claim, "Heading2"));
        body.push(paragraph(observation.recommended_wording || observation.claim, "BodyText"));
        body.push(
          table(
            [
              ["중요도", observation.importance || ""],
              ["진술 성격", kindLabel(observation.statement_kind, tools)],
              ["관찰 ID", observation.id || ""]
            ],
            false
          )
        );
        if (observation.evidence?.length) {
          body.push(paragraph("근거", "EvidenceLabel"));
          for (const item of observation.evidence) {
            body.push(paragraph(`• ${evidenceText(item, tools)}`, "Evidence"));
          }
        }
      }
    }

    body.push(paragraph("이 문서는 웹 검토 화면에서 포함 처리된 관찰을 기준으로 생성되었습니다.", "Footer"));
    body.push(sectionProperties());

    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      "<w:body>" +
      body.join("") +
      "</w:body></w:document>"
    );
  }

  function paragraph(text, style, align) {
    const alignXml = align ? `<w:jc w:val="${align}"/>` : "";
    return (
      "<w:p>" +
      `<w:pPr><w:pStyle w:val="${style || "BodyText"}"/>${alignXml}</w:pPr>` +
      `<w:r><w:t xml:space="preserve">${escapeXml(text || "")}</w:t></w:r>` +
      "</w:p>"
    );
  }

  function pageBreak() {
    return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
  }

  function table(rows, header) {
    const tableRows = rows
      .map((row, rowIndex) => {
        const cells = row
          .map((value, cellIndex) => {
            const shade = header && rowIndex === 0 ? '<w:shd w:fill="F7F8F5"/>' : "";
            const align = cellIndex > 0 && row.length > 2 ? '<w:jc w:val="right"/>' : "";
            return (
              "<w:tc>" +
              `<w:tcPr>${shade}<w:tcW w:w="3000" w:type="dxa"/></w:tcPr>` +
              paragraph(String(value ?? ""), "TableText", align ? "right" : undefined) +
              "</w:tc>"
            );
          })
          .join("");
        return `<w:tr>${cells}</w:tr>`;
      })
      .join("");

    return (
      "<w:tbl>" +
      '<w:tblPr><w:tblW w:w="0" w:type="auto"/>' +
      '<w:tblBorders><w:top w:val="single" w:sz="10" w:color="111111"/>' +
      '<w:left w:val="nil"/>' +
      '<w:bottom w:val="single" w:sz="10" w:color="111111"/>' +
      '<w:right w:val="nil"/>' +
      '<w:insideH w:val="single" w:sz="4" w:color="D9D9D2"/>' +
      '<w:insideV w:val="nil"/></w:tblBorders></w:tblPr>' +
      tableRows +
      "</w:tbl>"
    );
  }

  function sectionProperties() {
    return (
      "<w:sectPr>" +
      '<w:pgSz w:w="11906" w:h="16838"/>' +
      '<w:pgMar w:top="1134" w:right="1021" w:bottom="1134" w:left="1021" w:header="720" w:footer="720" w:gutter="0"/>' +
      "</w:sectPr>"
    );
  }

  function groupDetailSections(observations) {
    const order = ["III. 전시 구성", "IV. 전시 결과", "V. 홍보 방식 및 언론 보도", "VI. 종합 기록"];
    return order
      .map((section) => [section, observations.filter((item) => item.report_placement?.detailed_section === section)])
      .filter(([, items]) => items.length > 0);
  }

  function getBriefMetrics(ledger, tools) {
    if (tools?.getBriefMetrics) return tools.getBriefMetrics(ledger);
    return ledger.metrics || [];
  }

  function metricSummaryRows(ledger, tools) {
    return getBriefMetrics(ledger, tools).map((metric) => ({
      label: metric.label,
      current: formatValue(metric.value, metric.unit, tools),
      reference:
        metric.reference_value !== undefined && metric.reference_value !== null
          ? formatValue(metric.reference_value, metric.unit, tools)
          : "비교 기준 없음",
      difference: metricDifferenceLabel(metric, tools)
    }));
  }

  function reportReferenceLabel(ledger, tools) {
    const metric = getBriefMetrics(ledger, tools).find((item) => item.reference_label);
    return metric?.reference_label || "";
  }

  function metricDifferenceLabel(metric, tools) {
    if (metric.difference_abs !== undefined && metric.difference_abs !== null) {
      const value = Number(metric.difference_abs);
      if (!Number.isFinite(value)) return "-";
      if (metric.unit === "percent") return `${signedNumber(value)}%p`;
      return signedFormattedValue(value, metric.unit, tools);
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

  function signedFormattedValue(value, unit, tools) {
    const sign = value > 0 ? "+" : "";
    return `${sign}${formatValue(value, unit, tools)}`;
  }

  function signedNumber(value) {
    const rounded = Math.abs(value) >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
    const formatted = rounded.toLocaleString("ko-KR", {
      maximumFractionDigits: 1,
      minimumFractionDigits: Number.isInteger(rounded) ? 0 : 1
    });
    return `${rounded > 0 ? "+" : ""}${formatted}`;
  }

  function chartSummary(ledger, tools) {
    const charts = buildChartGroups(ledger, tools);
    if (!charts.length) return "";
    const body = [paragraph("핵심 지표 도표", "Heading2")];
    charts.forEach((chart, index) => {
      body.push(paragraph(`그림 ${index + 1}. ${chart.title} 비교`, "FigureCaption"));
      body.push(
        table(
          [["지표", "이번 전시", "기준 평균"]].concat(
            chart.rows.map((row) => [row.label, row.currentLabel, row.referenceLabel])
          ),
          true
        )
      );
    });
    return body.join("");
  }

  function buildChartGroups(ledger, tools) {
    const definitions = [
      { title: "관객 규모", metricIds: ["total_visitors", "daily_visitors"] },
      { title: "재정 지표", metricIds: ["total_budget", "total_income", "cost_per_visitor"] },
      { title: "참여 및 홍보", metricIds: ["program_sessions", "program_participants", "press_mentions", "sns_feedback"] }
    ];
    const metricMap = new Map((ledger.metrics || []).map((metric) => [metric.id, metric]));
    const allowed = new Set(getBriefMetrics(ledger, tools).map((metric) => metric.id));
    return definitions
      .map((definition) => ({
        title: definition.title,
        rows: definition.metricIds
          .filter((id) => allowed.has(id))
          .map((id) => metricMap.get(id))
          .filter((metric) => metric && metric.reference_value !== undefined && metric.reference_value !== null)
          .map((metric) => ({
            label: metric.label,
            currentLabel: formatValue(metric.value, metric.unit, tools),
            referenceLabel: formatValue(metric.reference_value, metric.unit, tools)
          }))
      }))
      .filter((chart) => chart.rows.length);
  }

  function formatValue(value, unit, tools) {
    if (tools?.formatValue) return tools.formatValue(value, unit);
    if (value === null || value === undefined || value === "") return "-";
    return unit ? `${value} ${unit}` : String(value);
  }

  function evidenceText(item, tools) {
    if (tools?.evidenceText) return tools.evidenceText(item);
    const source = item?.source ? `${item.source}: ` : "";
    return `${source}${item?.label || item?.metric || ""} ${item?.value ?? ""}`.trim();
  }

  function kindLabel(kind, tools) {
    if (tools?.kindLabel) return tools.kindLabel(kind);
    return kind || "";
  }

  function importanceRank(importance) {
    return { high: 0, medium: 1, low: 2 }[importance] ?? 3;
  }

  function contentTypesXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
</Types>`;
  }

  function relsXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
  }

  function settingsXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:defaultTabStop w:val="720"/>
</w:settings>`;
  }

  function stylesXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="BodyText">
    <w:name w:val="Body Text"/>
    <w:rPr><w:rFonts w:ascii="Noto Sans KR" w:hAnsi="Noto Sans KR" w:eastAsia="Noto Sans KR"/><w:sz w:val="20"/></w:rPr>
    <w:pPr><w:spacing w:after="150" w:line="360" w:lineRule="auto"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Kicker">
    <w:name w:val="Kicker"/>
    <w:rPr><w:b/><w:color w:val="555555"/><w:rFonts w:ascii="Noto Sans KR" w:hAnsi="Noto Sans KR" w:eastAsia="Noto Sans KR"/><w:sz w:val="19"/></w:rPr>
    <w:pPr><w:spacing w:before="520" w:after="320"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:rPr><w:b/><w:rFonts w:ascii="Noto Sans KR" w:hAnsi="Noto Sans KR" w:eastAsia="Noto Sans KR"/><w:sz w:val="40"/></w:rPr>
    <w:pPr><w:spacing w:after="360"/><w:pBdr><w:top w:val="single" w:sz="18" w:space="8" w:color="111111"/></w:pBdr></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle">
    <w:name w:val="Subtitle"/>
    <w:rPr><w:rFonts w:ascii="Noto Sans KR" w:hAnsi="Noto Sans KR" w:eastAsia="Noto Sans KR"/><w:sz w:val="22"/></w:rPr>
    <w:pPr><w:spacing w:after="220"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ScopeNote">
    <w:name w:val="Scope Note"/>
    <w:rPr><w:color w:val="444444"/><w:rFonts w:ascii="Noto Sans KR" w:hAnsi="Noto Sans KR" w:eastAsia="Noto Sans KR"/><w:sz w:val="20"/></w:rPr>
    <w:pPr><w:ind w:left="260"/><w:spacing w:before="240" w:after="420" w:line="360" w:lineRule="auto"/><w:pBdr><w:left w:val="single" w:sz="8" w:space="6" w:color="111111"/></w:pBdr></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="Heading 1"/>
    <w:rPr><w:b/><w:rFonts w:ascii="Noto Sans KR" w:hAnsi="Noto Sans KR" w:eastAsia="Noto Sans KR"/><w:sz w:val="27"/></w:rPr>
    <w:pPr><w:spacing w:before="520" w:after="200"/><w:pBdr><w:top w:val="single" w:sz="10" w:space="5" w:color="111111"/></w:pBdr></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="Heading 2"/>
    <w:rPr><w:b/><w:rFonts w:ascii="Noto Sans KR" w:hAnsi="Noto Sans KR" w:eastAsia="Noto Sans KR"/><w:sz w:val="21"/></w:rPr>
    <w:pPr><w:spacing w:before="260" w:after="120"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Bullet">
    <w:name w:val="Bullet"/>
    <w:rPr><w:rFonts w:ascii="Noto Sans KR" w:hAnsi="Noto Sans KR" w:eastAsia="Noto Sans KR"/><w:sz w:val="20"/></w:rPr>
    <w:pPr><w:spacing w:after="100" w:line="360" w:lineRule="auto"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Caveat">
    <w:name w:val="Caveat"/>
    <w:rPr><w:color w:val="6F3A0B"/><w:rFonts w:ascii="Noto Sans KR" w:hAnsi="Noto Sans KR" w:eastAsia="Noto Sans KR"/><w:sz w:val="19"/></w:rPr>
    <w:pPr><w:ind w:left="360"/><w:spacing w:after="120"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="EvidenceLabel">
    <w:name w:val="Evidence Label"/>
    <w:rPr><w:b/><w:rFonts w:ascii="Noto Sans KR" w:hAnsi="Noto Sans KR" w:eastAsia="Noto Sans KR"/><w:sz w:val="19"/></w:rPr>
    <w:pPr><w:spacing w:before="120" w:after="40"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Evidence">
    <w:name w:val="Evidence"/>
    <w:rPr><w:color w:val="555555"/><w:rFonts w:ascii="Noto Sans KR" w:hAnsi="Noto Sans KR" w:eastAsia="Noto Sans KR"/><w:sz w:val="18"/></w:rPr>
    <w:pPr><w:ind w:left="360"/><w:spacing w:after="80"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="TableText">
    <w:name w:val="Table Text"/>
    <w:rPr><w:rFonts w:ascii="Noto Sans KR" w:hAnsi="Noto Sans KR" w:eastAsia="Noto Sans KR"/><w:sz w:val="18"/></w:rPr>
    <w:pPr><w:spacing w:after="0"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="TableNote">
    <w:name w:val="Table Note"/>
    <w:rPr><w:color w:val="666666"/><w:rFonts w:ascii="Noto Sans KR" w:hAnsi="Noto Sans KR" w:eastAsia="Noto Sans KR"/><w:sz w:val="18"/></w:rPr>
    <w:pPr><w:spacing w:before="80" w:after="220"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="FigureCaption">
    <w:name w:val="Figure Caption"/>
    <w:rPr><w:b/><w:rFonts w:ascii="Noto Sans KR" w:hAnsi="Noto Sans KR" w:eastAsia="Noto Sans KR"/><w:sz w:val="18"/></w:rPr>
    <w:pPr><w:spacing w:before="180" w:after="80"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Footer">
    <w:name w:val="Footer"/>
    <w:rPr><w:color w:val="666666"/><w:rFonts w:ascii="Noto Sans KR" w:hAnsi="Noto Sans KR" w:eastAsia="Noto Sans KR"/><w:sz w:val="17"/></w:rPr>
    <w:pPr><w:spacing w:before="360" w:after="0"/></w:pPr>
  </w:style>
</w:styles>`;
  }

  function zipFiles(files) {
    const encoder = new TextEncoder();
    const entries = files.map((file) => {
      const nameBytes = encoder.encode(file.name);
      const data = typeof file.text === "string" ? encoder.encode(file.text) : file.bytes;
      return {
        nameBytes,
        data,
        crc: crc32(data),
        localOffset: 0
      };
    });
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    for (const entry of entries) {
      entry.localOffset = offset;
      const localHeader = new Uint8Array(30 + entry.nameBytes.length);
      const local = new DataView(localHeader.buffer);
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);
      local.setUint16(6, 0x0800, true);
      local.setUint16(8, 0, true);
      local.setUint16(10, 0, true);
      local.setUint16(12, 0, true);
      local.setUint32(14, entry.crc, true);
      local.setUint32(18, entry.data.length, true);
      local.setUint32(22, entry.data.length, true);
      local.setUint16(26, entry.nameBytes.length, true);
      local.setUint16(28, 0, true);
      localHeader.set(entry.nameBytes, 30);
      localParts.push(localHeader, entry.data);
      offset += localHeader.length + entry.data.length;
    }

    const centralStart = offset;
    for (const entry of entries) {
      const centralHeader = new Uint8Array(46 + entry.nameBytes.length);
      const central = new DataView(centralHeader.buffer);
      central.setUint32(0, 0x02014b50, true);
      central.setUint16(4, 20, true);
      central.setUint16(6, 20, true);
      central.setUint16(8, 0x0800, true);
      central.setUint16(10, 0, true);
      central.setUint16(12, 0, true);
      central.setUint16(14, 0, true);
      central.setUint32(16, entry.crc, true);
      central.setUint32(20, entry.data.length, true);
      central.setUint32(24, entry.data.length, true);
      central.setUint16(28, entry.nameBytes.length, true);
      central.setUint16(30, 0, true);
      central.setUint16(32, 0, true);
      central.setUint16(34, 0, true);
      central.setUint16(36, 0, true);
      central.setUint32(38, 0, true);
      central.setUint32(42, entry.localOffset, true);
      centralHeader.set(entry.nameBytes, 46);
      centralParts.push(centralHeader);
      offset += centralHeader.length;
    }

    const centralSize = offset - centralStart;
    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);
    eocdView.setUint32(0, 0x06054b50, true);
    eocdView.setUint16(4, 0, true);
    eocdView.setUint16(6, 0, true);
    eocdView.setUint16(8, entries.length, true);
    eocdView.setUint16(10, entries.length, true);
    eocdView.setUint32(12, centralSize, true);
    eocdView.setUint32(16, centralStart, true);
    eocdView.setUint16(20, 0, true);

    return concatUint8Arrays(localParts.concat(centralParts, eocd));
  }

  function concatUint8Arrays(parts) {
    const length = parts.reduce((sum, part) => sum + part.length, 0);
    const output = new Uint8Array(length);
    let offset = 0;
    for (const part of parts) {
      output.set(part, offset);
      offset += part.length;
    }
    return output;
  }

  function crc32(data) {
    let crc = 0xffffffff;
    for (let i = 0; i < data.length; i += 1) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ data[i]) & 0xff];
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[n] = c >>> 0;
  }

  function escapeXml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  window.DocxExport = { createDocxBlob };
})();
