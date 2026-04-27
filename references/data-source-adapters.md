# Data Source Adapters

For data-driven posts (using the `data-driven` template), the skill includes `extract-stats.mjs` to pull statistics from a configured data source and embed them as `key_facts`.

## V1: jq adapter

The only built-in adapter operates on JSON files via [jq](https://jqlang.github.io/jq/).

### Setup

```bash
brew install jq    # macOS
# or apt install jq, etc.
```

### Define queries

Create a `queries.json` file:

```json
{
  "queries": [
    {
      "label": "AI questions in 2025",
      "jq": "[.[] | select(.year == 2025) | select(.question | contains(\"AI\"))] | length"
    },
    {
      "label": "Total questions per year",
      "jq": "[.[] | .year] | group_by(.) | map({year: .[0], count: length})"
    },
    {
      "label": "Most common category",
      "jq": "[.[] | .category] | group_by(.) | map({c: .[0], n: length}) | sort_by(.n) | reverse | .[0]"
    }
  ]
}
```

### Run

```bash
seo-blog extract-stats \
  --source=path/to/data.json \
  --queries=queries.json \
  --output=stats.csv
```

Output:

```csv
"label","value"
"AI questions in 2025","7"
"Total questions per year","[{year: 2021, count: 100}, ...]"
"Most common category","{c: 'technology', n: 1260}"
```

You can paste these values into your topics.csv `key_facts` column manually, or write a script to merge them in.

## Future adapters (V2+)

The skill is designed to support more adapters:

### SQL adapter (planned)

```json
{
  "source": "postgresql://user@host/db",
  "queries": [
    { "label": "...", "sql": "SELECT count(*) FROM articles WHERE published > '2025-01-01'" }
  ]
}
```

### REST adapter (planned)

```json
{
  "source": "https://api.example.com",
  "queries": [
    { "label": "...", "endpoint": "/stats?year=2025", "extract": "$.total_count" }
  ]
}
```

### Custom Node module adapter (planned)

```json
{
  "source": "./scripts/my-data-extractor.mjs",
  "queries": [
    { "label": "...", "fn": "getYearlyCount", "args": [2025] }
  ]
}
```

These will be implemented in V2.5+ as community demand arises. PRs welcome.

## Workflow integration

Typical flow for data-driven posts:

```bash
# 1. Run jq queries to get current stats
seo-blog extract-stats --source=data.json --queries=queries.json --output=stats.csv

# 2. Author opens stats.csv and a fresh topics.csv side by side
#    Combines stats into key_facts column for relevant rows

# 3. Run normal pipeline
seo-blog batch --csv=topics.csv
```

The author still needs to:
- Decide which stats matter for which post
- Phrase the stats as concise key_facts (not raw JSON)
- Provide context (what the stat means)

This is the human-in-loop guardrail. The skill could automate "stat → bullet sentence" but we deliberately don't, because it would invite invention/hallucination.

## Example: IT パスポート data-driven posts

Our example project (`examples/it-passport-syllabus/`) uses this pattern for the past-paper analysis posts:

```bash
# In our project root:
jq '[.[] | select(.year == 2025) | select(.question | contains("AI"))] | length' \
  data/questions.json
# → 7

# This becomes a key_fact in topics.csv:
# "...令和7年度AI関連7問;セキュリティ9問;..."

# Then batch:
seo-blog batch --csv=topics.csv
```

The resulting blog post (`reiwa7-analysis.mdx`) embeds these real numbers, making it impossible for aggregator sites to copy without doing the same data extraction.

This is the strongest defense against SCA penalties: **content grounded in unique data the AI cannot invent**.
