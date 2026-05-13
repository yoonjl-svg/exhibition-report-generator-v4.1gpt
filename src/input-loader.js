(function () {
  const FIXED_BRIEF_METRIC_IDS = [
    "total_visitors",
    "daily_visitors",
    "total_budget",
    "budget_execution_rate",
    "total_income",
    "cost_per_visitor",
    "paid_audience_ratio",
    "group_audience_ratio",
    "program_sessions",
    "program_participants",
    "press_mentions",
    "sns_feedback"
  ];

  const BRIEF_METRIC_GROUPS = [
    { id: "audience", label: "관객", metric_ids: ["total_visitors", "daily_visitors"] },
    { id: "budget", label: "예산", metric_ids: ["total_budget", "budget_execution_rate"] },
    { id: "income_cost", label: "수입/비용", metric_ids: ["total_income", "cost_per_visitor"] },
    { id: "paid_group", label: "관객 구성", metric_ids: ["paid_audience_ratio", "group_audience_ratio"] },
    { id: "program", label: "프로그램", metric_ids: ["program_sessions", "program_participants"] },
    { id: "publicity", label: "홍보/반응", metric_ids: ["press_mentions", "sns_feedback"] }
  ];

  const NUMERIC_FIELDS = new Set([
    "total_visitors",
    "operating_days",
    "daily_visitors",
    "paid_visitors",
    "free_visitors",
    "group_visitors",
    "group_audience_ratio",
    "total_budget",
    "allocated_budget",
    "execution_rate",
    "income",
    "count",
    "sessions",
    "participants",
    "participation_rate",
    "press_mentions",
    "sns_posts",
    "sns_feedback_total",
    "memberships_sold"
  ]);

  const FIELD_ALIASES = {
    id: ["ID"],
    title: ["전시명", "전시 제목"],
    type: ["유형", "구분"],
    total_visitors: ["총 관객 수", "총 관객수", "총관객수"],
    operating_days: ["운영일수", "운영 일수"],
    daily_visitors: ["일평균 관객", "일평균 관객 수"],
    paid_visitors: ["유료 관객 수", "유료 관객수"],
    group_visitors: ["단체 관객 수", "단체 관객수"],
    group_audience_ratio: ["단체 관객 비율"],
    total_budget: ["총 사용 예산", "총예산"],
    allocated_budget: ["편성 예산"],
    execution_rate: ["예산 집행률"],
    budget_execution_rate: ["예산 집행률"],
    income: ["총 수입", "수입"],
    cost_per_visitor: ["관객당 비용"],
    program_sessions: ["프로그램 회수", "프로그램 총 회차", "프로그램 회차"],
    sessions: ["프로그램 회수", "프로그램 총 회차", "프로그램 회차"],
    program_participants: ["프로그램 참여 수", "프로그램 참여 인원"],
    press_mentions: ["보도 건수", "언론 보도 건수"],
    paid_audience_ratio: ["유료 관객 비율"],
    sns_feedback_total: ["SNS 피드백 합계", "SNS피드백합계", "sns 피드백 합계"]
  };

  const CORE_KEY_ALIASES = {
    "단체 관객 수": "group_visitors",
    "단체 관객수": "group_visitors",
    "단체 관객 비율": "group_audience_ratio",
    "예산 집행률": "execution_rate",
    "편성 예산": "allocated_budget",
    "총 수입": "income",
    "프로그램 회수": "sessions",
    "프로그램 총 회차": "sessions",
    "프로그램 참여 수": "participants",
    "프로그램 참여 인원": "participants",
    "SNS 피드백 합계": "sns_feedback_total",
    "SNS피드백합계": "sns_feedback_total"
  };

  const REFERENCE_TYPE_IDS = {
    "정기 기획전": "regular_planned_exhibitions",
    "특별전": "special_exhibitions",
    "기타": "other_exhibitions"
  };

  const PRECISION = {
    daily_visitors_avg: 1,
    budget_execution_rate_avg: 1,
    group_audience_ratio_avg: 1,
    program_participation_rate_avg: 1,
    paid_audience_ratio_avg: 1
  };

  async function loadWorkbook(file) {
    const tables = await readXlsxTables(file);
    const source = buildInputFromTables(tables);
    return buildLedger(source);
  }

  async function readXlsxTables(file) {
    if (!("DecompressionStream" in window)) {
      throw new Error("현재 브라우저는 XLSX 압축 해제를 지원하지 않습니다. 최신 Chrome 또는 Edge에서 다시 시도하세요.");
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const entries = await unzip(bytes);
    const workbook = parseXml(text(entries.get("xl/workbook.xml")));
    const rels = parseXml(text(entries.get("xl/_rels/workbook.xml.rels")));
    const sharedStrings = entries.has("xl/sharedStrings.xml") ? readSharedStrings(parseXml(text(entries.get("xl/sharedStrings.xml")))) : [];
    const relTargets = new Map(
      localElements(rels, "Relationship").map((rel) => [rel.getAttribute("Id"), rel.getAttribute("Target")])
    );
    const tables = {};
    for (const sheet of localElements(workbook, "sheet")) {
      const name = sheet.getAttribute("name");
      const relId = sheet.getAttribute("r:id") || sheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
      const target = normalizeXlsxPath(`xl/${relTargets.get(relId).replace(/^\//, "")}`);
      const rows = worksheetRows(parseXml(text(entries.get(target))), sharedStrings);
      const headers = rows[0] || [];
      tables[name] = rows.slice(1).filter((row) => row.some((cell) => String(cell).trim())).map((row) => {
        const item = {};
        headers.forEach((header, index) => {
          item[header] = row[index] || "";
        });
        return item;
      });
    }
    return tables;
  }

  async function unzip(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let eocd = -1;
    for (let i = bytes.length - 22; i >= 0; i -= 1) {
      if (view.getUint32(i, true) === 0x06054b50) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) throw new Error("XLSX 파일 구조를 읽을 수 없습니다.");
    const entryCount = view.getUint16(eocd + 10, true);
    let offset = view.getUint32(eocd + 16, true);
    const output = new Map();
    const decoder = new TextDecoder();

    for (let i = 0; i < entryCount; i += 1) {
      if (view.getUint32(offset, true) !== 0x02014b50) throw new Error("XLSX 중앙 디렉터리를 읽을 수 없습니다.");
      const compression = view.getUint16(offset + 10, true);
      const compressedSize = view.getUint32(offset + 20, true);
      const nameLength = view.getUint16(offset + 28, true);
      const extraLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const localOffset = view.getUint32(offset + 42, true);
      const name = decoder.decode(bytes.slice(offset + 46, offset + 46 + nameLength));
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = bytes.slice(dataStart, dataStart + compressedSize);
      output.set(normalizeXlsxPath(name), await inflateEntry(compressed, compression));
      offset += 46 + nameLength + extraLength + commentLength;
    }
    return output;
  }

  async function inflateEntry(bytes, compression) {
    if (compression === 0) return bytes;
    if (compression !== 8) throw new Error("지원하지 않는 XLSX 압축 방식입니다.");
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  function text(bytes) {
    if (!bytes) throw new Error("XLSX 내부 파일이 누락되었습니다.");
    return new TextDecoder().decode(bytes);
  }

  function parseXml(value) {
    const xml = new DOMParser().parseFromString(value, "application/xml");
    if (xml.querySelector("parsererror")) throw new Error("XLSX XML을 해석하지 못했습니다.");
    return xml;
  }

  function readSharedStrings(xml) {
    return localElements(xml, "si").map((item) => localElements(item, "t").map((node) => node.textContent || "").join(""));
  }

  function worksheetRows(xml, sharedStrings) {
    return localElements(xml, "row").map((rowNode) => {
      const values = {};
      for (const cell of localElements(rowNode, "c")) {
        const ref = cell.getAttribute("r");
        const column = ref ? columnIndex(ref) : Object.keys(values).length + 1;
        values[column] = cellValue(cell, sharedStrings);
      }
      const max = Math.max(0, ...Object.keys(values).map(Number));
      return Array.from({ length: max }, (_, index) => values[index + 1] || "");
    });
  }

  function cellValue(cell, sharedStrings) {
    const type = cell.getAttribute("t");
    if (type === "inlineStr") return localElements(cell, "t").map((node) => node.textContent || "").join("");
    const value = localElements(cell, "v")[0]?.textContent || "";
    if (type === "s") return sharedStrings[Number(value)] || "";
    return value;
  }

  function localElements(node, localName) {
    return Array.from(node.getElementsByTagName("*")).filter((item) => item.localName === localName);
  }

  function columnIndex(ref) {
    const letters = ref.match(/[A-Z]+/i)?.[0].toUpperCase() || "A";
    return Array.from(letters).reduce((value, char) => value * 26 + char.charCodeAt(0) - 64, 0);
  }

  function normalizeXlsxPath(path) {
    const parts = [];
    for (const part of path.split("/")) {
      if (!part || part === ".") continue;
      if (part === "..") parts.pop();
      else parts.push(part);
    }
    return parts.join("/");
  }

  function buildInputFromTables(tables) {
    const source = {
      schema_version: "0.2.0",
      exhibition: { period: {} },
      narrative: {},
      audience: {},
      budget: {},
      programs: {},
      publicity: {},
      membership: {},
      reference_groups: [],
      selected_feedback: [],
      data_quality_checks: []
    };
    readCore(tables.core || [], source);
    const history = buildReferenceGroupsFromHistory(tables["reference-exhibitions"] || [], source.exhibition.type || "");
    const manual = readReferenceGroups(tables["reference-groups"] || []);
    source.reference_groups = mergeReferenceGroups(history, manual);
    source.selected_feedback = readFeedback(tables["selected-feedback"] || []);
    source.data_quality_checks = readDataQuality(tables["data-quality"] || []);
    return removeEmpty(source);
  }

  function readCore(rows, source) {
    for (const row of rows) {
      const section = String(row.section || "").trim();
      const key = canonicalCoreKey(String(row.key || "").trim());
      const rawValue = String(row.value || "").trim();
      if (!section || !key || rawValue === "") continue;
      if (section === "period") source.exhibition.period[key] = rawValue;
      else if (section === "brief_metrics" && key === "ids") source.brief_metric_ids = rawValue.split(",").map((item) => item.trim()).filter(Boolean);
      else if (["audience", "budget", "programs", "publicity", "membership"].includes(section)) source[section][key] = coerceValue(key, rawValue);
      else if (section === "narrative") source.narrative[key] = rawValue;
      else if (section === "exhibition") source.exhibition[key] = rawValue;
    }
  }

  function readReferenceGroups(rows) {
    return rows.filter((row) => rowValue(row, "id")).map((row) => {
      const metrics = {};
      for (const key of [
        "total_visitors_avg",
        "daily_visitors_avg",
        "total_budget_avg",
        "budget_execution_rate_avg",
        "income_avg",
        "cost_per_visitor_avg",
        "group_audience_ratio_avg",
        "program_sessions_avg",
        "program_participants_avg",
        "program_participation_rate_avg",
        "press_mentions_avg",
        "paid_audience_ratio_avg",
        "sns_feedback_avg"
      ]) {
        const value = rowValue(row, key);
        if (value) metrics[key] = parseNumber(value);
      }
      return {
        id: rowValue(row, "id").trim(),
        label: rowValue(row, "label").trim(),
        selection_rule: rowValue(row, "selection_rule").trim(),
        caveat: rowValue(row, "caveat").trim(),
        metrics
      };
    });
  }

  function buildReferenceGroupsFromHistory(rows, currentType) {
    const grouped = new Map();
    for (const row of rows) {
      const typeName = rowValue(row, "type").trim() || rowValue(row, "category").trim();
      if (!typeName) continue;
      if (!grouped.has(typeName)) grouped.set(typeName, []);
      grouped.get(typeName).push(row);
    }
    const ordered = [];
    if (grouped.has(currentType)) ordered.push(currentType);
    for (const typeName of grouped.keys()) if (!ordered.includes(typeName)) ordered.push(typeName);
    const groups = ordered.map((typeName, index) => ({
      id: referenceTypeId(typeName, index + 1),
      label: typeName,
      selection_rule: `기존 전시 데이터 중 '${typeName}' 유형 ${grouped.get(typeName).length}건`,
      caveat: "기존 전시 원자료의 유형 분류와 입력된 수치를 바탕으로 자동 산출한 비교군입니다.",
      metrics: historicalAverageMetrics(grouped.get(typeName)),
      members: grouped.get(typeName).map(referenceMember)
    })).filter((group) => Object.keys(group.metrics).length);
    if (rows.length) {
      const allMembers = Array.from(grouped.values()).flat();
      const metrics = historicalAverageMetrics(allMembers);
      if (Object.keys(metrics).length) {
        groups.push({
          id: "all_reference_exhibitions",
          label: "전체 전시",
          selection_rule: `기존 전시 데이터 전체 ${allMembers.length}건`,
          caveat: "유형을 구분하지 않고 입력된 기존 전시 전체를 평균낸 비교군입니다.",
          metrics,
          members: allMembers.map(referenceMember)
        });
      }
    }
    return groups;
  }

  function referenceMember(row) {
    return {
      id: rowValue(row, "id").trim(),
      title: rowValue(row, "title").trim(),
      type: rowValue(row, "type").trim() || rowValue(row, "category").trim(),
      total_visitors: optionalNumber(rowValue(row, "total_visitors")),
      daily_visitors: historicalDailyVisitors(row),
      total_budget: optionalNumber(rowValue(row, "total_budget")),
      note: rowValue(row, "note").trim()
    };
  }

  function historicalAverageMetrics(rows) {
    const values = {
      total_visitors_avg: presentNumbers(rows.map((row) => optionalNumber(rowValue(row, "total_visitors")))),
      daily_visitors_avg: presentNumbers(rows.map(historicalDailyVisitors)),
      total_budget_avg: presentNumbers(rows.map((row) => optionalNumber(rowValue(row, "total_budget")))),
      budget_execution_rate_avg: presentNumbers(rows.map(historicalBudgetExecutionRate)),
      income_avg: presentNumbers(rows.map((row) => optionalNumber(rowValue(row, "income")))),
      cost_per_visitor_avg: presentNumbers(rows.map(historicalCostPerVisitor)),
      group_audience_ratio_avg: presentNumbers(rows.map(historicalGroupAudienceRatio)),
      program_sessions_avg: presentNumbers(rows.map(historicalProgramSessions)),
      program_participants_avg: presentNumbers(rows.map((row) => optionalNumber(rowValue(row, "program_participants")))),
      program_participation_rate_avg: presentNumbers(rows.map(historicalProgramParticipationRate)),
      press_mentions_avg: presentNumbers(rows.map((row) => optionalNumber(rowValue(row, "press_mentions")))),
      paid_audience_ratio_avg: presentNumbers(rows.map(historicalPaidRatio)),
      sns_feedback_avg: presentNumbers(rows.map((row) => optionalNumber(rowValue(row, "sns_feedback_total"))))
    };
    return Object.fromEntries(
      Object.entries(values).filter(([, items]) => items.length).map(([key, items]) => [key, roundedAverage(items, PRECISION[key] || 0)])
    );
  }

  function historicalDailyVisitors(row) {
    const daily = optionalNumber(rowValue(row, "daily_visitors"));
    if (daily !== null) return daily;
    const total = optionalNumber(rowValue(row, "total_visitors"));
    const days = optionalNumber(rowValue(row, "operating_days"));
    return total && days ? total / days : null;
  }

  function historicalBudgetExecutionRate(row) {
    const direct = optionalNumber(rowValue(row, "execution_rate")) ?? optionalNumber(rowValue(row, "budget_execution_rate"));
    if (direct !== null) return direct;
    const total = optionalNumber(rowValue(row, "total_budget"));
    const allocated = optionalNumber(rowValue(row, "allocated_budget"));
    return total !== null && allocated ? (total / allocated) * 100 : null;
  }

  function historicalCostPerVisitor(row) {
    const direct = optionalNumber(rowValue(row, "cost_per_visitor"));
    if (direct !== null) return direct;
    const totalBudget = optionalNumber(rowValue(row, "total_budget"));
    const totalVisitors = optionalNumber(rowValue(row, "total_visitors"));
    return totalBudget && totalVisitors ? totalBudget / totalVisitors : null;
  }

  function historicalGroupAudienceRatio(row) {
    const direct = optionalNumber(rowValue(row, "group_audience_ratio"));
    if (direct !== null) return direct;
    const total = optionalNumber(rowValue(row, "total_visitors"));
    const group = optionalNumber(rowValue(row, "group_visitors"));
    return total && group !== null ? (group / total) * 100 : null;
  }

  function historicalProgramSessions(row) {
    return optionalNumber(rowValue(row, "program_sessions")) ?? optionalNumber(rowValue(row, "sessions"));
  }

  function historicalProgramParticipationRate(row) {
    const direct = optionalNumber(rowValue(row, "program_participation_rate"));
    if (direct !== null) return direct;
    const participants = optionalNumber(rowValue(row, "program_participants"));
    const total = optionalNumber(rowValue(row, "total_visitors"));
    return participants !== null && total ? (participants / total) * 100 : null;
  }

  function historicalPaidRatio(row) {
    const direct = optionalNumber(rowValue(row, "paid_audience_ratio"));
    if (direct !== null) return direct;
    const total = optionalNumber(rowValue(row, "total_visitors"));
    const paid = optionalNumber(rowValue(row, "paid_visitors"));
    return total && paid !== null ? (paid / total) * 100 : null;
  }

  function readFeedback(rows) {
    return rows.filter((row) => row.id).map((row) => ({
      id: String(row.id).trim(),
      source: String(row.source || "").trim(),
      theme: String(row.theme || "").trim(),
      polarity: String(row.polarity || "").trim(),
      quote: String(row.quote || "").trim(),
      ...(row.note ? { note: String(row.note).trim() } : {})
    }));
  }

  function readDataQuality(rows) {
    const grouped = new Map();
    for (const row of rows) {
      const id = String(row.id || "").trim();
      if (!id) continue;
      if (!grouped.has(id)) {
        grouped.set(id, {
          id,
          claim: String(row.claim || "").trim(),
          importance: String(row.importance || "medium").trim(),
          caveat: String(row.caveat || "").trim(),
          sources: []
        });
      }
      const label = String(row.source_label || "").trim();
      const value = String(row.source_value || "").trim();
      if (label || value) grouped.get(id).sources.push({ label, value });
    }
    return Array.from(grouped.values());
  }

  function buildLedger(source, referenceGroupId) {
    validateSource(source);
    const referenceGroup =
      source.reference_groups.find((group) => group.id === referenceGroupId) || source.reference_groups[0];
    const metrics = buildMetrics(source, referenceGroup);
    const selection = buildBriefSelection(metrics);
    annotateBriefMetrics(metrics, selection);
    return {
      schema_version: "0.2.0",
      report: {
        id: source.exhibition.id || `uploaded-${Date.now()}`,
        title: source.exhibition.title,
        period: source.exhibition.period?.display || "",
        venue: source.exhibition.venue || "",
        generated_at: new Date().toISOString(),
        scope_note: source.exhibition.scope_note || "업로드한 엑셀 템플릿에서 생성한 보고서입니다.",
        reference_group_id: referenceGroup.id,
        reference_group_label: referenceGroup.label,
        reference_group_rule: referenceGroup.selection_rule,
        reference_group_count: referenceGroup.members?.length || null,
        brief_metric_ids: selection.ids,
        brief_metric_groups: selection.groups,
        brief_metric_strategy: {
          fixed_ids: selection.fixed_ids,
          recommended_metric_id: null,
          recommendation_basis: null,
          recommendation_reason: null
        }
      },
      reference_groups: source.reference_groups,
      source_input: source,
      metrics,
      observations: buildObservations(source, referenceGroup, metrics)
    };
  }

  function validateSource(source) {
    for (const key of ["exhibition", "audience", "budget", "programs", "publicity"]) {
      if (!source[key]) throw new Error(`입력 템플릿에 ${key} 데이터가 없습니다.`);
    }
    if (!source.reference_groups?.length) throw new Error("기준 전시 데이터 또는 비교군 데이터가 필요합니다.");
    if (!source.audience.total_visitors || !source.audience.operating_days) throw new Error("총 관객 수와 운영일수는 필수입니다.");
    if (!source.budget.total_budget) throw new Error("총 사용 예산은 필수입니다.");
  }

  function buildMetrics(source, referenceGroup) {
    const audience = source.audience;
    const budget = source.budget;
    const programs = source.programs;
    const publicity = source.publicity;
    const ref = referenceGroup.metrics || {};
    const totalVisitors = number(audience.total_visitors);
    const dailyVisitors = number(audience.daily_visitors) || round(totalVisitors / number(audience.operating_days), 1);
    const totalBudget = number(budget.total_budget);
    const totalIncome = optionalNumber(budget.income);
    const costPerVisitor = Math.round(totalBudget / totalVisitors);
    const programSessions = number(programs.sessions || 0);
    const programParticipants = number(programs.participants || 0);
    const pressMentions = number(publicity.press_mentions || 0);
    const snsFeedback = optionalNumber(publicity.sns_feedback_total);
    const paidRatio = derivePaidRatio(audience);
    const groupRatio = deriveGroupRatio(audience);

    const metrics = [
      metricAgainstReference("total_visitors", "총 관객 수", totalVisitors, "people", ref.total_visitors_avg, referenceGroup),
      metricAgainstReference("daily_visitors", "일평균 관객", dailyVisitors, "people", ref.daily_visitors_avg, referenceGroup),
      metricAgainstReference("total_budget", "총 사용 예산", totalBudget, "krw", ref.total_budget_avg, referenceGroup),
      metricAgainstReference("budget_execution_rate", "예산 집행률", deriveBudgetExecutionRate(budget), "percent", ref.budget_execution_rate_avg, referenceGroup, "absolute"),
      metricAgainstReference("total_income", "총 수입", totalIncome, "krw", ref.income_avg, referenceGroup),
      metricAgainstReference("cost_per_visitor", "관객당 비용", costPerVisitor, "krw_per_person", ref.cost_per_visitor_avg, referenceGroup),
      metricAgainstReference("program_sessions", "프로그램 회수", programSessions, "session_count", ref.program_sessions_avg, referenceGroup),
      metricAgainstReference("program_participants", "프로그램 참여 수", programParticipants, "people", ref.program_participants_avg, referenceGroup),
      metricAgainstReference("press_mentions", "보도 건수", pressMentions, "count", ref.press_mentions_avg, referenceGroup),
      metricAgainstReference("sns_feedback", "SNS 피드백", snsFeedback, "score", ref.sns_feedback_avg, referenceGroup)
    ];
    if (paidRatio !== null) metrics.push(metricAgainstReference("paid_audience_ratio", "유료 관객 비율", paidRatio, "percent", ref.paid_audience_ratio_avg, referenceGroup, "absolute"));
    if (groupRatio !== null) metrics.push(metricAgainstReference("group_audience_ratio", "단체 관객 비율", groupRatio, "percent", ref.group_audience_ratio_avg, referenceGroup, "absolute"));
    return metrics;
  }

  function buildObservations(source, referenceGroup, metrics) {
    const metricMap = Object.fromEntries(metrics.map((item) => [item.id, item]));
    const ref = referenceGroup.metrics || {};
    const refLabel = referenceGroup.label;
    const observations = [];
    addTotalVisitorsObservation(observations, metricMap, ref, refLabel, referenceGroup);
    addCostObservation(observations, metricMap, ref, refLabel, source);
    addPaidObservation(observations, metricMap, ref, refLabel, source);
    addProgramObservation(observations, metricMap, ref, refLabel, source);
    addPublicityObservation(observations, metricMap, ref, refLabel, source);
    observations.push(...buildFeedbackObservations(source));
    observations.push(...buildDataQualityObservations(source));
    return observations;
  }

  function addTotalVisitorsObservation(observations, metricMap, ref, refLabel, referenceGroup) {
    const totalAvg = ref.total_visitors_avg;
    if (!totalAvg) return;
    const total = metricMap.total_visitors.value;
    const daily = metricMap.daily_visitors.value;
    const diff = pctDiff(total, totalAvg);
    observations.push(observation({
      id: "obs-total-visitors-comparison",
      type: "comparison",
      section: "results",
      claim: `총 관객 수와 일평균 관객 수가 ${refLabel} 평균을 ${directionWord(diff)}함`,
      metric: "total_visitors",
      current_value: total,
      unit: "people",
      reference_group: referenceGroup.id,
      reference_avg: totalAvg,
      difference_pct: diff,
      importance: importanceFromDiff(diff, 20, 8),
      statement_kind: "comparative",
      tone: "neutral",
      caveat: `${referenceGroup.caveat} 성과 판정이 아니라 수치상 특이점으로 기록합니다.`,
      recommended_wording: `총 관객 수 ${formatValue(total, "people")}, 일평균 ${formatValue(daily, "people")}으로 ${refLabel} 평균 대비 ${directionWord(diff, true)} 관객 규모가 확인됨.`,
      evidence: [
        evidence("metric", "총 관객 수", formatValue(total, "people")),
        evidence("metric", `${refLabel} 평균`, formatValue(totalAvg, "people")),
        evidence("calculation", "평균 대비 차이", signedPercent(diff)),
        evidence("metric", "일평균 관객", formatValue(daily, "people")),
        ref.daily_visitors_avg ? evidence("metric", "일평균 기준값", formatValue(ref.daily_visitors_avg, "people")) : null
      ],
      director_brief: true,
      detailed_section: "IV. 전시 결과"
    }));
  }

  function addCostObservation(observations, metricMap, ref, refLabel) {
    if (!ref.cost_per_visitor_avg) return;
    const cost = metricMap.cost_per_visitor.value;
    const diff = pctDiff(cost, ref.cost_per_visitor_avg);
    observations.push(observation({
      id: "obs-cost-per-visitor",
      type: "derived_metric",
      section: "results",
      claim: "관객당 비용이 비교 기준 대비 산출됨",
      metric: "cost_per_visitor",
      current_value: cost,
      unit: "krw_per_person",
      reference_group: "",
      reference_avg: ref.cost_per_visitor_avg,
      difference_pct: diff,
      importance: importanceFromDiff(diff, 20, 10),
      statement_kind: "comparative",
      tone: "neutral",
      caveat: "관객당 비용은 예산 총액과 관객 수만 반영하므로 전시의 질적 완성도나 제작 난이도를 직접 평가하지 않습니다.",
      recommended_wording: `관객당 비용은 ${formatValue(cost, "krw_per_person")}으로 ${refLabel} 기준값과 비교해 검토할 수 있음.`,
      evidence: [
        evidence("calculation", "관객당 비용", formatValue(cost, "krw_per_person")),
        evidence("metric", `${refLabel} 기준값`, formatValue(ref.cost_per_visitor_avg, "krw_per_person"))
      ],
      director_brief: true,
      detailed_section: "IV. 전시 결과"
    }));
  }

  function addPaidObservation(observations, metricMap, ref, refLabel, source) {
    const paid = metricMap.paid_audience_ratio?.value;
    if (paid === undefined || !ref.paid_audience_ratio_avg) return;
    const diffAbs = round(paid - ref.paid_audience_ratio_avg, 1);
    observations.push(observation({
      id: "obs-paid-audience-ratio",
      type: "comparison",
      section: "results",
      claim: `유료 관객 비율은 ${refLabel} 평균보다 ${diffAbs < 0 ? "낮게" : "높게"} 나타남`,
      metric: "paid_audience_ratio",
      current_value: paid,
      unit: "percent",
      reference_avg: ref.paid_audience_ratio_avg,
      difference_abs: diffAbs,
      importance: importanceFromDiff(diffAbs, 15, 7),
      statement_kind: "comparative",
      tone: "neutral",
      caveat: "초대, 제휴, 패스, 단체 관람 정책의 영향을 함께 확인해야 하며 수입 성과와 단순히 동일시할 수 없습니다.",
      recommended_wording: `유료 관객 비율은 ${formatValue(paid, "percent")}로 ${refLabel} 평균과 차이를 보이며, 관객 확대와 수입 구조를 분리해 검토할 필요가 있음.`,
      evidence: [
        evidence("metric", "유료 관객 비율", formatValue(paid, "percent")),
        evidence("metric", `${refLabel} 평균`, formatValue(ref.paid_audience_ratio_avg, "percent")),
        evidence("calculation", "차이", `${signedNumber(diffAbs)}%p`),
        evidence("metric", "유료 관객 수", formatValue(source.audience.paid_visitors, "people"))
      ],
      director_brief: true,
      detailed_section: "IV. 전시 결과"
    }));
  }

  function addProgramObservation(observations, metricMap, ref, refLabel, source) {
    if (!ref.program_participants_avg) return;
    const participants = metricMap.program_participants.value;
    const diff = pctDiff(participants, ref.program_participants_avg);
    observations.push(observation({
      id: "obs-program-participation",
      type: "comparison",
      section: "composition",
      claim: `프로그램 참여 인원은 ${refLabel} 평균을 ${directionWord(diff)}함`,
      metric: "program_participants",
      current_value: participants,
      unit: "people",
      reference_avg: ref.program_participants_avg,
      difference_pct: diff,
      importance: importanceFromDiff(diff, 25, 10),
      statement_kind: "comparative",
      tone: "neutral",
      caveat: "프로그램 유형, 정원, 사전예약 방식이 다르면 단순 참여 인원 비교의 의미가 제한됩니다.",
      recommended_wording: `프로그램 ${formatValue(source.programs.count, "program_count")} ${formatNumber(source.programs.sessions || 0)}회차가 운영되었고, 참여 인원은 ${formatValue(participants, "people")}으로 비교 기준 대비 ${directionWord(diff, true)} 수준임.`,
      evidence: [
        evidence("metric", "프로그램 참여 인원", formatValue(participants, "people")),
        evidence("metric", `${refLabel} 평균`, formatValue(ref.program_participants_avg, "people")),
        evidence("metric", "프로그램 참여율", formatValue(source.programs.participation_rate, "percent")),
        evidence("calculation", "평균 대비 차이", signedPercent(diff))
      ],
      director_brief: true,
      detailed_section: "III. 전시 구성"
    }));
  }

  function addPublicityObservation(observations, metricMap, ref, refLabel, source) {
    if (!ref.press_mentions_avg) return;
    const press = metricMap.press_mentions.value;
    const diff = pctDiff(press, ref.press_mentions_avg);
    observations.push(observation({
      id: "obs-publicity-reference",
      type: "interpretive_note",
      section: "publicity",
      claim: "언론 보도와 자체 채널 지표는 관객 유입 가능성과 함께 참고할 만함",
      metric: "press_mentions",
      current_value: press,
      unit: "count",
      reference_avg: ref.press_mentions_avg,
      difference_pct: diff,
      importance: "medium",
      statement_kind: "interpretive",
      tone: "restrained",
      caveat: "언론 보도 건수와 SNS 게시 수만으로 관객 유입의 인과관계를 확정할 수 없습니다.",
      recommended_wording: `언론 보도 ${formatValue(press, "count")}과 SNS 게시 ${formatValue(source.publicity.sns_posts || 0, "count")}은 관객 유입과의 직접 인과가 아니라 홍보 활동의 참고 지표로 다루는 것이 적절함.`,
      evidence: [
        evidence("metric", "언론 보도 건수", formatValue(press, "count")),
        evidence("metric", "SNS 게시 건수", formatValue(source.publicity.sns_posts || 0, "count")),
        evidence("metric", `${refLabel} 보도 평균`, formatValue(ref.press_mentions_avg, "count"))
      ],
      director_brief: false,
      detailed_section: "V. 홍보 방식 및 언론 보도"
    }));
  }

  function buildFeedbackObservations(source) {
    const feedback = source.selected_feedback || [];
    if (!feedback.length) return [];
    const buckets = new Map();
    for (const item of feedback) {
      const bucket = ["critical", "suggestion"].includes(item.polarity) ? "critical" : "positive";
      const key = `${bucket}:${item.theme}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(item);
    }
    return Array.from(buckets.entries()).map(([key, items], index) => {
      const [bucket, theme] = key.split(":");
      const critical = bucket === "critical";
      return observation({
        id: `obs-feedback-${index + 1}`,
        type: "qualitative_observation",
        section: "audience_response",
        claim: critical ? `선별된 부정/건의 반응에서 ${theme}에 대한 언급이 확인됨` : `선별된 관객 후기에서 ${theme}에 대한 긍정 반응이 확인됨`,
        source_type: "curated_social_feedback",
        representativeness: "selected_not_representative",
        importance: "medium",
        statement_kind: "interpretive",
        tone: "restrained",
        caveat: "아래 반응은 전체 관객 의견의 통계적 표본이 아니라 보고서 작성자가 선별 입력한 후기입니다.",
        recommended_wording: critical ? `선별된 부정 및 건의 반응에서는 ${theme}에 관한 의견이 확인됨.` : `선별 입력된 관객 후기에서는 ${theme}에 관한 언급이 확인됨.`,
        evidence: items.map((item) => evidence("quote", item.source, item.quote)),
        director_brief: critical,
        detailed_section: "VI. 종합 기록"
      });
    });
  }

  function buildDataQualityObservations(source) {
    return (source.data_quality_checks || []).map((item) => observation({
      id: `obs-data-${item.id}`,
      type: "data_quality",
      section: "data_quality",
      claim: item.claim,
      importance: item.importance || "medium",
      statement_kind: "data_quality",
      tone: "neutral",
      caveat: item.caveat || "보고서 생성 전 원자료 확인이 필요합니다.",
      recommended_wording: `데이터 검증 필요: ${item.claim}`,
      evidence: (item.sources || []).map((sourceItem) => evidence("source", sourceItem.label, sourceItem.value)),
      director_brief: true,
      detailed_section: "데이터 검증 로그"
    }));
  }

  function buildBriefSelection(metrics) {
    const metricIds = new Set(metrics.map((item) => item.id));
    const groups = BRIEF_METRIC_GROUPS.map((group) => ({
      ...group,
      metric_ids: group.metric_ids.filter((id) => metricIds.has(id))
    })).filter((group) => group.metric_ids.length);
    const ids = groups.flatMap((group) => group.metric_ids);
    return {
      ids,
      groups,
      fixed_ids: FIXED_BRIEF_METRIC_IDS.filter((id) => metricIds.has(id))
    };
  }

  function annotateBriefMetrics(metrics, selection) {
    const fixed = new Set(selection.fixed_ids);
    for (const metric of metrics) if (fixed.has(metric.id)) metric.brief_role = "fixed";
  }

  function metricAgainstReference(id, label, value, unit, referenceValue, referenceGroup, scoreKind = "percent") {
    const item = metric(id, label, value, unit, contextAgainstReference(value, referenceValue, unit, referenceGroup), {
      reference_group: referenceGroup.id,
      reference_label: referenceGroup.label,
      reference_value: cleanNumber(referenceValue),
      recommendation_score: 0
    });
    if (value !== null && value !== undefined && referenceValue) {
      if (scoreKind === "absolute") {
        item.difference_abs = round(value - referenceValue, 1);
        item.recommendation_score = Math.abs(item.difference_abs);
      } else {
        item.difference_pct = pctDiff(value, referenceValue);
        item.recommendation_score = Math.abs(item.difference_pct);
      }
    }
    return item;
  }

  function metric(id, label, value, unit, context, extra = {}) {
    return { id, label, value: cleanNumber(value), unit, context, ...Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== null && v !== undefined)) };
  }

  function observation(payload) {
    const { director_brief, detailed_section, ...rest } = payload;
    return {
      ...rest,
      evidence: (rest.evidence || []).filter(Boolean),
      report_placement: {
        director_brief,
        detailed_section
      }
    };
  }

  function evidence(kind, label, value) {
    if (value === null || value === undefined || value === "") return null;
    return { kind, label, value: String(value) };
  }

  function contextAgainstReference(value, referenceValue, unit, referenceGroup) {
    if (value === null || value === undefined) return "입력값 없음";
    if (referenceValue === null || referenceValue === undefined) return "비교 기준값 없음";
    return `${referenceGroup.label} 평균 ${formatContextValue(referenceValue, unit)} 대비 ${directionWord(pctDiff(value, referenceValue))}`;
  }

  function formatValue(value, unit) {
    if (value === null || value === undefined) return "-";
    const suffix = { people: "명", count: "건", score: "점", session_count: "회", program_count: "개", percent: "%", krw: "원", krw_per_person: "원/명" }[unit] || unit || "";
    return `${formatNumber(value)}${suffix}`;
  }

  function formatContextValue(value, unit) {
    if (unit === "krw") return formatKrwAsEok(value);
    return formatValue(value, unit);
  }

  function formatKrwAsEok(value) {
    const eok = Number(value) / 100000000;
    return `${Number.isInteger(eok) ? eok.toLocaleString("ko-KR") : eok.toLocaleString("ko-KR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}억`;
  }

  function formatNumber(value) {
    if (value === null || value === undefined) return "-";
    if (typeof value === "number" && !Number.isInteger(value)) return value.toLocaleString("ko-KR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
    return typeof value === "number" ? value.toLocaleString("ko-KR") : String(value);
  }

  function derivePaidRatio(audience) {
    const total = number(audience.total_visitors);
    return total && audience.paid_visitors !== undefined ? round(number(audience.paid_visitors) / total * 100, 1) : null;
  }

  function deriveGroupRatio(audience) {
    const direct = optionalNumber(audience.group_audience_ratio);
    if (direct !== null) return direct;
    const total = number(audience.total_visitors);
    const group = optionalNumber(audience.group_visitors);
    return total && group !== null ? round(group / total * 100, 1) : null;
  }

  function deriveBudgetExecutionRate(budget) {
    const direct = optionalNumber(budget.execution_rate);
    if (direct !== null) return direct;
    const total = optionalNumber(budget.total_budget);
    const allocated = optionalNumber(budget.allocated_budget);
    return allocated && total !== null ? round(total / allocated * 100, 1) : null;
  }

  function coerceValue(key, value) {
    return NUMERIC_FIELDS.has(key) ? parseNumber(value) : value;
  }

  function canonicalCoreKey(key) {
    return CORE_KEY_ALIASES[key] || key;
  }

  function rowValue(row, key) {
    if (row[key] !== undefined) return String(row[key] || "");
    const normalized = new Map(Object.entries(row).map(([header, value]) => [normalizeHeader(header), String(value || "")]));
    for (const candidate of [key, ...(FIELD_ALIASES[key] || [])]) {
      if (normalized.has(normalizeHeader(candidate))) return normalized.get(normalizeHeader(candidate));
    }
    return "";
  }

  function normalizeHeader(value) {
    return String(value).replace(/[\s_()（）·/]+/g, "").toLowerCase();
  }

  function referenceTypeId(typeName, index) {
    if (REFERENCE_TYPE_IDS[typeName]) return REFERENCE_TYPE_IDS[typeName];
    const slug = String(typeName).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    return slug ? `reference_${slug}` : `reference_type_${index}`;
  }

  function mergeReferenceGroups(history, manual) {
    const ids = new Set(history.map((group) => group.id));
    return history.concat(manual.filter((group) => !ids.has(group.id)));
  }

  function removeEmpty(value) {
    if (Array.isArray(value)) return value.map(removeEmpty).filter((item) => item !== null && item !== undefined && item !== "");
    if (value && typeof value === "object") {
      const entries = Object.entries(value).map(([key, item]) => [key, removeEmpty(item)]).filter(([, item]) => {
        if (Array.isArray(item)) return item.length;
        if (item && typeof item === "object") return Object.keys(item).length;
        return item !== null && item !== undefined && item !== "";
      });
      return Object.fromEntries(entries);
    }
    return value;
  }

  function parseNumber(value) {
    const numberValue = Number(String(value).replace(/,/g, "").trim());
    return Number.isInteger(numberValue) ? numberValue : numberValue;
  }

  function optionalNumber(value) {
    if (value === null || value === undefined || String(value).trim() === "") return null;
    return Number(String(value).replace(/,/g, "").trim());
  }

  function number(value) {
    return optionalNumber(value) || 0;
  }

  function cleanNumber(value) {
    return typeof value === "number" && Number.isInteger(value) ? value : value;
  }

  function presentNumbers(values) {
    return values.filter((value) => value !== null && value !== undefined && !Number.isNaN(value));
  }

  function roundedAverage(values, precision) {
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    return precision ? round(average, precision) : Math.round(average);
  }

  function pctDiff(value, referenceValue) {
    return referenceValue ? round((value - referenceValue) / referenceValue * 100, 1) : 0;
  }

  function directionWord(diff, noun = false) {
    if (Math.abs(diff) < 0.5) return "유사";
    if (diff > 0) return noun ? "높은" : "상회";
    return noun ? "낮은" : "하회";
  }

  function importanceFromDiff(diff, high, medium) {
    const magnitude = Math.abs(diff);
    if (magnitude >= high) return "high";
    if (magnitude >= medium) return "medium";
    return "low";
  }

  function signedPercent(value) {
    return `${signedNumber(value)}%`;
  }

  function signedNumber(value) {
    if (Math.abs(value) < 0.00001) return "0";
    return `${value > 0 ? "+" : ""}${formatNumber(value)}`;
  }

  function round(value, precision) {
    const factor = 10 ** precision;
    return Math.round(value * factor) / factor;
  }

  window.InputLoader = { loadWorkbook, buildInputFromTables, buildLedger };
})();
