# Discovery Playbook

How to use the discovery pipeline (V2) to find topic gaps without paid SEO tools.

## What discovery gives you

Discovery emits `raw-topics.csv` with these columns:

| column | meaning |
|---|---|
| candidate_title | competitor's article title |
| competitor_url | source URL |
| h2_structure | competitor's H2 list (semicolon-sep) |
| gap_score | 0.0=we already cover, 1.0=fully uncovered |
| suggested_cluster | LLM-assigned theme |

This is **input for human curation**, not finished article specs. You select the rows worth writing, then write `key_facts` yourself.

## Quick start

```bash
# 1. List your competitors (their sitemap URLs)
cat > competitors.txt <<EOF
https://competitor-1.com/sitemap.xml
https://competitor-2.com/sitemap.xml
https://blog-aggregator.com/sitemap_blog.xml
EOF

# 2. Run discovery
seo-blog discover \
  --competitors=competitors.txt \
  --our-sitemap=https://my-site.com/sitemap.xml \
  --output=raw-topics.csv

# 3. Open raw-topics.csv, sort by gap_score DESC
# 4. Pick rows you actually want to write
# 5. Build topics.csv with your selected rows + key_facts column
# 6. Run: seo-blog batch --csv=topics.csv
```

## Finding good competitors

Where to find competitor sitemaps:

1. **Direct check**: visit `https://competitor.com/sitemap.xml` — most sites expose it
2. **robots.txt**: `https://competitor.com/robots.txt` — often lists sitemap location
3. **Google query**: `site:competitor.com filetype:xml` or `inurl:sitemap`
4. **Industry roundups**: search "best X blog 2026" — the top results are usually your competitors

Pick 3–10 competitors. Mix:
- 1-2 dominant aggregators (large topic surface)
- 2-3 niche specialists (depth in your area)
- 1-2 adjacent sites (find tangential opportunities)

## Reading gap_score

`gap_score` uses Jaccard token overlap between competitor title and your existing slugs. Interpretation:

- **0.0–0.3**: We already have a similar post. Skip unless our version is weak.
- **0.3–0.7**: Partial overlap. Could be worth covering at a different angle.
- **0.7–1.0**: Genuine gap. Strong candidate.

The score is a heuristic — review titles in context. Sometimes a 0.4-score topic is worth writing because our existing version is shallow.

## How clustering helps

`suggested_cluster` is LLM-assigned. Use it to:

1. **Batch by theme**: write all "シラバス改定" cluster posts in one session
2. **Spot keyword opportunities**: a cluster with 20+ candidates suggests a pillar-page opportunity
3. **Avoid scattershot**: writing 10 posts across 10 unrelated clusters is harder than 10 posts in 1 cluster

## Adding PAA (People Also Ask)

For specific high-value topics, run PAA scraping separately:

```bash
seo-blog discover ... # produces raw-topics.csv
# Pick top 5 candidates by gap_score
node scripts/discovery/scrape-paa.mjs "DXとは" --lang=ja --output=paa-dx.txt
node scripts/discovery/scrape-paa.mjs "シラバス改定" --lang=ja --output=paa-syllabus.txt
```

Then weave PAA questions into your post's H2 structure (they're literal user questions, great for snippet capture).

⚠ **PAA scraping is fragile**: Google changes its HTML; scraping may return zero results. For production volume, use a paid API (DataForSEO, SerpAPI). For exploratory use, the built-in scraper is fine.

## Workflow with no competitor list

If you don't have competitors yet:

1. **Use your own sitemap as the input** — discover gives you a topic clustering view of your own content (useful for spotting pillar opportunities)
2. **Use Google search results** — manually collect URLs for "your-niche tutorial 2026", paste into `urls.txt`, skip sitemap step
3. **Use a knowledge taxonomy** — if your domain has a published syllabus/curriculum (like IT パスポート's IPA syllabus), that's your topic universe; discovery is unnecessary

## Honest limitations

- **No real search volume**: discovery doesn't know which topics get traffic. Every gap is "potentially worth writing", but only a fraction will actually rank.
- **No SERP difficulty**: even big gaps may be hard to rank for if competition is fierce.
- **No backlink data**: we don't know who's already a domain authority on each topic.
- **PAA is unreliable**: Google rate-limits, changes HTML, varies by region.

For these signals, paid tools (Ahrefs/Semrush/DataForSEO) are still the gold standard. The free discovery here gives you 60-70% of the value with 0% of the cost — good enough for most use cases, especially for niche/educational sites.

## Estimated runtime

For 5 competitors, ~200 URLs each (max-titles default):

| Step | Time | Cost |
|---|---|---|
| fetch-sitemap | ~30s | free |
| fetch-titles (1000 URLs, concurrency=4) | ~5–10 min | free |
| cluster-topics (LLM) | ~30s | ~$0.005 |
| gap-analysis | ~5s | free |
| **Total** | **~10 min** | **~$0.01** |
