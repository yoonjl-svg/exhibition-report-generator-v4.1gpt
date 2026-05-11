# Analysis Ledger Schema

This is the draft schema used by `data/sample-ledger.json`.

## Ledger

```json
{
  "schema_version": "0.1.0",
  "report": {},
  "reference_groups": [],
  "metrics": [],
  "observations": []
}
```

## Report

```json
{
  "id": "hyper-yellow-demo",
  "title": "전시보고서 v4.1gpt - 《(가)하이퍼 옐로우》",
  "period": "2025.06.13 - 2025.08.17",
  "generated_at": "2026-05-11T15:42:00+09:00",
  "scope_note": "샘플 데이터 기반",
  "brief_metric_ids": ["total_visitors"]
}
```

## Reference Group

```json
{
  "id": "legacy_planned_exhibitions",
  "label": "기존 기획전",
  "selection_rule": "샘플 데이터에 포함된 이전 기획전 전체",
  "caveat": "비교군 제한 사항"
}
```

Reference groups should be explicit. Averages without a defined group are not acceptable in v4.

## Metric

```json
{
  "id": "total_visitors",
  "label": "총 관객 수",
  "value": 15200,
  "unit": "people",
  "context": "기존 기획전 평균 9,413명 대비 상회"
}
```

Supported draft units:

- `people`
- `krw`
- `count`
- `program_count`
- `percent`
- `krw_per_person`

## Observation

```json
{
  "id": "obs-total-visitors-high",
  "type": "comparison",
  "section": "results",
  "claim": "총 관객 수와 일평균 관객 수가 기존 기획전 평균을 상회함",
  "metric": "total_visitors",
  "current_value": 15200,
  "unit": "people",
  "reference_group": "legacy_planned_exhibitions",
  "reference_avg": 9413,
  "difference_pct": 61.5,
  "importance": "high",
  "statement_kind": "comparative",
  "tone": "neutral",
  "caveat": "비교군의 전시 규모, 운영일수, 주제 성격이 동일하다고 볼 수는 없음.",
  "recommended_wording": "총 관객 수 15,200명, 일평균 230명으로 기존 기획전 평균을 상회하는 관객 규모가 확인됨.",
  "evidence": [],
  "report_placement": {
    "director_brief": true,
    "detailed_section": "IV. 전시 결과"
  }
}
```

## Statement Kind

- `factual`: source value or record
- `comparative`: comparison against a defined group
- `interpretive`: restrained interpretation from evidence
- `inference`: weak claim that must carry a caveat
- `data_quality`: validation issue or conflict

## Qualitative Observation

Audience feedback should be treated as selected feedback unless a proper sampling method exists.

```json
{
  "type": "qualitative_observation",
  "source_type": "curated_social_feedback",
  "representativeness": "selected_not_representative",
  "caveat": "전체 관객 의견의 통계적 표본이 아님."
}
```

The system should not turn selected feedback into percentages or general audience sentiment.
