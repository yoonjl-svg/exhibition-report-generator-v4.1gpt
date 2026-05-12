from __future__ import annotations

import argparse
import json
import zipfile
from pathlib import Path
from typing import Any
from xml.sax.saxutils import escape

from render_report import SECTION_TITLES, build_report_model, evidence_text, format_value


def main() -> None:
    parser = argparse.ArgumentParser(description="Render an Analysis Ledger into a Word .docx report draft.")
    parser.add_argument("ledger", type=Path, help="Path to generated-ledger.json.")
    parser.add_argument("--output", type=Path, default=Path("output/report-draft.docx"))
    args = parser.parse_args()

    ledger = json.loads(args.ledger.read_text(encoding="utf-8"))
    model = build_report_model(ledger)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    write_docx(args.output, model)

    print(json.dumps({"ledger": str(args.ledger), "output": str(args.output)}, ensure_ascii=False, indent=2))


def write_docx(path: Path, model: dict[str, Any]) -> None:
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as docx:
        docx.writestr("[Content_Types].xml", content_types_xml())
        docx.writestr("_rels/.rels", rels_xml())
        docx.writestr("word/styles.xml", styles_xml())
        docx.writestr("word/settings.xml", settings_xml())
        docx.writestr("word/document.xml", document_xml(model))


def document_xml(model: dict[str, Any]) -> str:
    body: list[str] = []
    body.append(paragraph("일민미술관 전시보고서", "Kicker"))
    body.append(paragraph(model["title"], "Title"))
    if model.get("period"):
        body.append(paragraph(model["period"], "Subtitle"))
    body.append(paragraph("", "BodyText"))
    body.append(paragraph("목차", "Heading1"))
    for number, title in SECTION_TITLES:
        body.append(paragraph(f"{number}. {title}", "TocLine"))
    body.append(page_break())

    for section in model["sections"]:
        body.append(paragraph(f"{section['number']}. {section['title']}", "Heading1"))
        for block in section["blocks"]:
            body.extend(block_xml(block))

    body.append(paragraph("끝.", "BodyText", align="right"))
    body.append(section_properties())
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        "<w:body>"
        + "".join(body)
        + "</w:body></w:document>"
    )


def block_xml(block: dict[str, Any]) -> list[str]:
    block_type = block["type"]
    parts: list[str] = []
    if block_type == "paragraph":
        if block.get("text"):
            parts.append(paragraph(block["text"], "BodyText"))
    elif block_type == "subheading":
        parts.append(paragraph(block["text"], "Heading2"))
    elif block_type == "table":
        rows = [[label, value] for label, value in block["rows"] if value]
        parts.append(table(rows, header=False))
    elif block_type == "metrics":
        rows = [["항목", "값", "참고"]]
        for metric in block["metrics"]:
            rows.append([metric["label"], format_value(metric.get("value"), metric.get("unit")), metric.get("context", "")])
        parts.append(table(rows, header=True))
    elif block_type == "observation":
        parts.append(paragraph(block["claim"], "Heading2"))
        parts.append(paragraph(block["wording"], "BodyText"))
        if block.get("caveat"):
            parts.append(paragraph(f"한계: {block['caveat']}", "Caveat"))
        if block.get("evidence"):
            parts.append(paragraph("근거", "EvidenceLabel"))
            for item in block["evidence"]:
                parts.append(paragraph(f"• {evidence_text(item)}", "Evidence"))
    elif block_type == "bullet":
        parts.append(paragraph(f"• {block['text']}", "Bullet"))
        if block.get("caveat"):
            parts.append(paragraph(f"한계: {block['caveat']}", "Caveat"))
    elif block_type == "data_quality":
        parts.append(paragraph(f"• {block['text']}", "Bullet"))
        if block.get("caveat"):
            parts.append(paragraph(f"확인 필요: {block['caveat']}", "Caveat"))
        for item in block.get("evidence", []):
            parts.append(paragraph(f"• {evidence_text(item)}", "Evidence"))
    return parts


def paragraph(text: str, style: str = "BodyText", align: str | None = None) -> str:
    align_xml = f'<w:jc w:val="{align}"/>' if align else ""
    return (
        "<w:p>"
        f'<w:pPr><w:pStyle w:val="{style}"/>{align_xml}</w:pPr>'
        f"<w:r><w:t xml:space=\"preserve\">{escape(text)}</w:t></w:r>"
        "</w:p>"
    )


def page_break() -> str:
    return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'


def table(rows: list[list[str]], header: bool = False) -> str:
    table_rows = []
    for row_index, row in enumerate(rows):
        cells = []
        for value in row:
            shade = '<w:shd w:fill="F2F2F2"/>' if header and row_index == 0 else ""
            cells.append(
                "<w:tc>"
                f"<w:tcPr>{shade}<w:tcW w:w=\"3000\" w:type=\"dxa\"/></w:tcPr>"
                + paragraph(str(value), "TableText")
                + "</w:tc>"
            )
        table_rows.append("<w:tr>" + "".join(cells) + "</w:tr>")
    return (
        "<w:tbl>"
        '<w:tblPr><w:tblW w:w="0" w:type="auto"/>'
        '<w:tblBorders><w:top w:val="single" w:sz="6" w:color="B8B8B8"/>'
        '<w:left w:val="single" w:sz="6" w:color="B8B8B8"/>'
        '<w:bottom w:val="single" w:sz="6" w:color="B8B8B8"/>'
        '<w:right w:val="single" w:sz="6" w:color="B8B8B8"/>'
        '<w:insideH w:val="single" w:sz="6" w:color="B8B8B8"/>'
        '<w:insideV w:val="single" w:sz="6" w:color="B8B8B8"/></w:tblBorders></w:tblPr>'
        + "".join(table_rows)
        + "</w:tbl>"
    )


def section_properties() -> str:
    return (
        "<w:sectPr>"
        '<w:pgSz w:w="11906" w:h="16838"/>'
        '<w:pgMar w:top="1134" w:right="1021" w:bottom="1134" w:left="1021" w:header="720" w:footer="720" w:gutter="0"/>'
        "</w:sectPr>"
    )


def content_types_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
</Types>"""


def rels_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"""


def settings_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:defaultTabStop w:val="720"/>
</w:settings>"""


def styles_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
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
    <w:pPr><w:spacing w:after="720"/></w:pPr>
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
  <w:style w:type="paragraph" w:styleId="TocLine">
    <w:name w:val="TOC Line"/>
    <w:rPr><w:rFonts w:ascii="Malgun Gothic" w:hAnsi="Malgun Gothic" w:eastAsia="Malgun Gothic"/><w:sz w:val="22"/></w:rPr>
    <w:pPr><w:spacing w:after="100"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Bullet">
    <w:name w:val="Bullet"/>
    <w:rPr><w:rFonts w:ascii="Malgun Gothic" w:hAnsi="Malgun Gothic" w:eastAsia="Malgun Gothic"/><w:sz w:val="21"/></w:rPr>
    <w:pPr><w:spacing w:after="100" w:line="360" w:lineRule="auto"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Caveat">
    <w:name w:val="Caveat"/>
    <w:rPr><w:color w:val="444444"/><w:rFonts w:ascii="Malgun Gothic" w:hAnsi="Malgun Gothic" w:eastAsia="Malgun Gothic"/><w:sz w:val="20"/></w:rPr>
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
</w:styles>"""


if __name__ == "__main__":
    main()
