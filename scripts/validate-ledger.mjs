import fs from "node:fs";

const filePath = process.argv[2] || "data/sample-ledger.json";
const raw = fs.readFileSync(filePath, "utf8");
const ledger = JSON.parse(raw);

const errors = [];
const warnings = [];

function requireField(object, field, label) {
  if (object[field] === undefined || object[field] === null || object[field] === "") {
    errors.push(`${label} is missing required field: ${field}`);
  }
}

requireField(ledger, "schema_version", "ledger");
requireField(ledger, "report", "ledger");

if (!Array.isArray(ledger.metrics)) errors.push("ledger.metrics must be an array");
if (!Array.isArray(ledger.observations)) errors.push("ledger.observations must be an array");

const metricIds = new Set();
for (const metric of ledger.metrics || []) {
  requireField(metric, "id", "metric");
  requireField(metric, "label", metric.id || "metric");
  requireField(metric, "unit", metric.id || "metric");
  if (metric.id) {
    if (metricIds.has(metric.id)) errors.push(`duplicate metric id: ${metric.id}`);
    metricIds.add(metric.id);
  }
}

const observationIds = new Set();
for (const observation of ledger.observations || []) {
  const label = observation.id || "observation";

  for (const field of ["id", "type", "section", "claim", "importance", "statement_kind", "tone"]) {
    requireField(observation, field, label);
  }

  if (observation.id) {
    if (observationIds.has(observation.id)) errors.push(`duplicate observation id: ${observation.id}`);
    observationIds.add(observation.id);
  }

  if (observation.metric && !metricIds.has(observation.metric)) {
    errors.push(`${label} references missing metric: ${observation.metric}`);
  }

  if (!Array.isArray(observation.evidence) || observation.evidence.length === 0) {
    warnings.push(`${label} has no evidence`);
  }

  if (["interpretive", "inference"].includes(observation.statement_kind) && !observation.caveat) {
    warnings.push(`${label} should carry a caveat because it is ${observation.statement_kind}`);
  }

  if (observation.type === "qualitative_observation" && observation.representativeness !== "selected_not_representative") {
    warnings.push(`${label} should explicitly mark selected audience feedback as selected_not_representative`);
  }
}

const result = {
  file: filePath,
  metrics: ledger.metrics?.length || 0,
  observations: ledger.observations?.length || 0,
  errors,
  warnings
};

console.log(JSON.stringify(result, null, 2));

if (errors.length > 0) {
  process.exitCode = 1;
}
