# Data Source: questions.json

The IT パスポート project uses a curated dataset of 2,800 past-exam questions across 27 sessions (2009–2025). This document shows how that data feeds into data-driven blog posts via `extract-stats.mjs`.

## Data shape

`web/data/questions.json` is a JSON array; each element is one question:

```json
{
  "id": "2025r07-15",
  "exam_code": "2025r07",
  "year": 2025,
  "era": "reiwa",
  "era_year": 7,
  "season": "annual",
  "number": 15,
  "category": "technology",
  "question": "セキュリティ対策として...",
  "choices": { "ア": "...", "イ": "...", "ウ": "...", "エ": "..." },
  "answer": "ウ",
  "figures": [],
  "source_pdf": "..."
}
```

## Queries used for past-paper analysis posts

`queries.json` for the project:

```json
{
  "queries": [
    { "label": "Reiwa 7 (2025) total", "jq": "[.[] | select(.year == 2025)] | length" },
    { "label": "Reiwa 7 strategy questions", "jq": "[.[] | select(.year == 2025) | select(.category == \"strategy\")] | length" },
    { "label": "Reiwa 7 management questions", "jq": "[.[] | select(.year == 2025) | select(.category == \"management\")] | length" },
    { "label": "Reiwa 7 technology questions", "jq": "[.[] | select(.year == 2025) | select(.category == \"technology\")] | length" },
    { "label": "Reiwa 7 AI keyword count", "jq": "[.[] | select(.year == 2025) | select(.question | contains(\"AI\"))] | length" },
    { "label": "Reiwa 7 セキュリティ keyword", "jq": "[.[] | select(.year == 2025) | select(.question | contains(\"セキュリティ\"))] | length" },
    { "label": "Reiwa 7 IoT keyword", "jq": "[.[] | select(.year == 2025) | select(.question | contains(\"IoT\"))] | length" },
    { "label": "Reiwa 7 figure questions", "jq": "[.[] | select(.year == 2025) | select(.figures | length > 0)] | length" }
  ]
}
```

## Workflow

```bash
# 1. Run extract-stats to pull current numbers
seo-blog extract-stats \
  --source=web/data/questions.json \
  --queries=queries.json \
  --output=stats-reiwa7.csv

# 2. Author opens stats-reiwa7.csv and topics.csv side by side
#    Composes key_facts column for `reiwa7-analysis` row using the actual numbers:
#    "令和7年度100問;ストラテジ35/マネジメント20/テクノロジ45;セキュリティ9問;AI 7問;図表問題0問"

# 3. Run normal pipeline
seo-blog batch --csv=topics.csv
```

## Why this is SCA-resistant

The post `reiwa7-analysis.mdx` cites real numbers extracted from a real dataset. Aggregator sites cannot reproduce the post without:

1. Building a similar dataset (months of OCR + manual review work)
2. Running similar queries
3. Writing original analysis around the numbers

This makes the post both **valuable** (real insights) and **defensible** (hard to replicate without effort). It's the opposite of the SCA-flagged "thin AI rewrite" pattern.

## Adapting to your domain

Replace `questions.json` with your equivalent unique data:
- E-commerce: product catalog with specs/prices
- News site: article archive with metadata
- Education: curriculum/syllabus database
- Product docs: API endpoint manifest

The pattern works whenever you have **proprietary structured data** that competitors don't have.
