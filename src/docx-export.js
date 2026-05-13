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
        [["항목", "값", "참고"]].concat(
          getBriefMetrics(ledger, tools).map((metric) => [
            metric.label,
            formatValue(metric.value, metric.unit, tools),
            metric.context || ""
          ])
        ),
        true
      )
    );

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
          .map((value) => {
            const shade = header && rowIndex === 0 ? '<w:shd w:fill="F2F2F2"/>' : "";
            return (
              "<w:tc>" +
              `<w:tcPr>${shade}<w:tcW w:w="3000" w:type="dxa"/></w:tcPr>` +
              paragraph(String(value ?? ""), "TableText") +
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
      '<w:tblBorders><w:top w:val="single" w:sz="6" w:color="B8B8B8"/>' +
      '<w:left w:val="single" w:sz="6" w:color="B8B8B8"/>' +
      '<w:bottom w:val="single" w:sz="6" w:color="B8B8B8"/>' +
      '<w:right w:val="single" w:sz="6" w:color="B8B8B8"/>' +
      '<w:insideH w:val="single" w:sz="6" w:color="B8B8B8"/>' +
      '<w:insideV w:val="single" w:sz="6" w:color="B8B8B8"/></w:tblBorders></w:tblPr>' +
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
    <w:rPr><w:rFonts w:ascii="Malgun Gothic" w:hAnsi="Malgun Gothic" w:eastAsia="Malgun Gothic"/><w:sz w:val="21"/></w:rPr>
    <w:pPr><w:spacing w:after="160" w:line="360" w:lineRule="auto"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Kicker">
    <w:name w:val="Kicker"/>
    <w:rPr><w:b/><w:rFonts w:ascii="Malgun Gothic" w:hAnsi="Malgun Gothic" w:eastAsia="Malgun Gothic"/><w:sz w:val="22"/></w:rPr>
    <w:pPr><w:spacing w:before="720" w:after="720"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:rPr><w:b/><w:rFonts w:ascii="Malgun Gothic" w:hAnsi="Malgun Gothic" w:eastAsia="Malgun Gothic"/><w:sz w:val="42"/></w:rPr>
    <w:pPr><w:spacing w:after="320"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle">
    <w:name w:val="Subtitle"/>
    <w:rPr><w:rFonts w:ascii="Malgun Gothic" w:hAnsi="Malgun Gothic" w:eastAsia="Malgun Gothic"/><w:sz w:val="24"/></w:rPr>
    <w:pPr><w:spacing w:after="220"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ScopeNote">
    <w:name w:val="Scope Note"/>
    <w:rPr><w:color w:val="333333"/><w:rFonts w:ascii="Malgun Gothic" w:hAnsi="Malgun Gothic" w:eastAsia="Malgun Gothic"/><w:sz w:val="21"/></w:rPr>
    <w:pPr><w:spacing w:before="240" w:after="420" w:line="360" w:lineRule="auto"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="Heading 1"/>
    <w:rPr><w:b/><w:rFonts w:ascii="Malgun Gothic" w:hAnsi="Malgun Gothic" w:eastAsia="Malgun Gothic"/><w:sz w:val="30"/></w:rPr>
    <w:pPr><w:spacing w:before="420" w:after="180"/><w:pBdr><w:bottom w:val="single" w:sz="8" w:space="3" w:color="111111"/></w:pBdr></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="Heading 2"/>
    <w:rPr><w:b/><w:rFonts w:ascii="Malgun Gothic" w:hAnsi="Malgun Gothic" w:eastAsia="Malgun Gothic"/><w:sz w:val="23"/></w:rPr>
    <w:pPr><w:spacing w:before="260" w:after="120"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Bullet">
    <w:name w:val="Bullet"/>
    <w:rPr><w:rFonts w:ascii="Malgun Gothic" w:hAnsi="Malgun Gothic" w:eastAsia="Malgun Gothic"/><w:sz w:val="21"/></w:rPr>
    <w:pPr><w:spacing w:after="100" w:line="360" w:lineRule="auto"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Caveat">
    <w:name w:val="Caveat"/>
    <w:rPr><w:color w:val="6F3A0B"/><w:rFonts w:ascii="Malgun Gothic" w:hAnsi="Malgun Gothic" w:eastAsia="Malgun Gothic"/><w:sz w:val="20"/></w:rPr>
    <w:pPr><w:ind w:left="360"/><w:spacing w:after="120"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="EvidenceLabel">
    <w:name w:val="Evidence Label"/>
    <w:rPr><w:b/><w:rFonts w:ascii="Malgun Gothic" w:hAnsi="Malgun Gothic" w:eastAsia="Malgun Gothic"/><w:sz w:val="20"/></w:rPr>
    <w:pPr><w:spacing w:before="120" w:after="40"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Evidence">
    <w:name w:val="Evidence"/>
    <w:rPr><w:color w:val="555555"/><w:rFonts w:ascii="Malgun Gothic" w:hAnsi="Malgun Gothic" w:eastAsia="Malgun Gothic"/><w:sz w:val="19"/></w:rPr>
    <w:pPr><w:ind w:left="360"/><w:spacing w:after="80"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="TableText">
    <w:name w:val="Table Text"/>
    <w:rPr><w:rFonts w:ascii="Malgun Gothic" w:hAnsi="Malgun Gothic" w:eastAsia="Malgun Gothic"/><w:sz w:val="19"/></w:rPr>
    <w:pPr><w:spacing w:after="0"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Footer">
    <w:name w:val="Footer"/>
    <w:rPr><w:color w:val="666666"/><w:rFonts w:ascii="Malgun Gothic" w:hAnsi="Malgun Gothic" w:eastAsia="Malgun Gothic"/><w:sz w:val="18"/></w:rPr>
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
