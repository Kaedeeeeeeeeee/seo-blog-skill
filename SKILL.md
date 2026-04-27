---
name: seo-blog
description: Outline-driven multilingual blog generator. Use when the user wants to batch-produce SEO blog posts from a topic CSV (with author-provided facts) into an MDX/Markdown static site, OR when they want competitor research + topic gap discovery. Supports DeepSeek/OpenAI/Anthropic/Gemini providers, ja/zh/en/etc locales. Author provides facts; this skill automates production. Always trigger on phrases like "batch blog generation", "programmatic SEO", "outline to article", "competitor sitemap analysis", "topic gap discovery", "scale blog production", or when the user pastes a topics CSV asking to expand it.
version: 0.1.0
license: MIT
---

# seo-blog

A skill for **outline-driven, multilingual, batch blog production**. The author writes topics + facts (the irreplaceable expert work). The skill automates outline scaffolding, LLM prose expansion, QA, internal-link weaving, and competitor topic discovery.

## When to use this skill

Trigger when:
- User wants to produce 10-500 blog posts from a topic list
- User pastes a topics CSV and asks to "expand" or "generate" articles
- User asks about programmatic SEO, batch content production, or LLM-driven blog automation
- User asks "how can I scale my blog content?"
- User wants competitor sitemap analysis or topic gap discovery

Do NOT trigger when:
- User wants pure keyword research (use a dedicated SEO skill)
- User wants to write a single hand-crafted post (overkill)
- User wants AI to generate facts from nothing (this skill explicitly refuses — that's scaled content abuse)

## Hard rules

1. **The author provides facts.** This skill expands outlines into prose; it does not invent facts. If the user wants the skill to write articles "from a domain name" with no input, refuse and explain why ([SCA risk](./references/safety-and-quality-gates.md)).
2. **Quality gates are enforced.** Runs of 100+ posts warn; 500+ posts hard-stop unless `--i-have-audited` is passed AND an audit report path is supplied.
3. **Project-agnostic.** All project-specific data lives in `seo-blog.config.json` + `style-guide.md` + `topics.csv` in the host repo. The skill itself does not know about any specific niche.
4. **Multilingual from day 1.** Locale is part of the outline path (`{contentDir}/{locale}/{slug}.{ext}`).

## The 9-step workflow

This is the canonical author flow. Steps 2-3 and 5 are manual (author input); the rest are automated.

```
1. (auto) discover     → competitor sitemaps + PAA + gap analysis → raw-topics.csv
2. (manual) curate     → review raw-topics.csv, select topics worth writing
3. (manual) seed facts → fill key_facts column (author's domain expertise)
4. (auto) new-outline  → key_facts CSV → skeleton MDX files (one per row)
5. (manual, optional)  → author refines bullets in each .mdx
6. (auto) expand       → skeleton MDX → prosed MDX via LLM
7. (auto) qa           → forbidden phrases, frontmatter, internal-link integrity
8. (auto) safety gate  → block runs >500 unless audited
9. (manual) commit + deploy
```

For details on each step, read [references/workflow-overview.md](./references/workflow-overview.md).

## Quick reference

### 1. Bootstrap a host project

```
node {SKILL_DIR}/scripts/cli.mjs init
```

Interactively creates:
- `seo-blog.config.json` — site/llm/style/templates/safety config
- `style-guide.md` — project-specific brand voice
- `topics.csv` — empty CSV with required columns

### 2. Generate skeleton outlines

```
node {SKILL_DIR}/scripts/cli.mjs new --csv=topics.csv
```

Produces one MDX per row at `{contentDir}/{locale}/{slug}.mdx`.

### 3. Expand with LLM

```
node {SKILL_DIR}/scripts/cli.mjs expand --concurrency=4 'content/blog/ja/*.mdx'
```

Uses configured LLM provider. See [references/llm-providers.md](./references/llm-providers.md) for setup per provider.

### 4. QA

```
node {SKILL_DIR}/scripts/cli.mjs qa 'content/blog/ja/*.mdx'
```

Reports: forbidden phrases, broken internal links, frontmatter issues, length out of range.

### 5. Or one-shot batch

```
node {SKILL_DIR}/scripts/cli.mjs batch --csv=topics.csv
```

Runs new → expand → qa end-to-end.

### 6. Discovery (competitor research)

```
node {SKILL_DIR}/scripts/cli.mjs discover \
  --competitors=competitors.txt \
  --our-sitemap=https://my-site.com/sitemap.xml \
  --output=raw-topics.csv
```

Scrapes competitor sitemaps + titles + Google PAA, clusters via LLM, computes gap-vs-us. See [references/discovery-playbook.md](./references/discovery-playbook.md).

## CSV schemas

### topics.csv (production input)

| column | required | example |
|---|---|---|
| slug | yes | `dx-toha` |
| locale | yes | `ja` |
| title | yes | `DXとは｜ITパスポート試験の頻出ポイント` |
| description | yes | `経産省定義から「2025年の崖」まで...` |
| tags | yes | `IT パスポート;ストラテジ系;DX` (semicolon-sep) |
| template | yes | `glossary` (one of templates.available) |
| key_facts | yes | `経産省 2018 定義;2025年の崖=12兆円;3段階モデル` (semicolon-sep) |
| internal_links | no | `agile-scrum;business-models` (sister slugs) |
| date | no | defaults to today (ISO YYYY-MM-DD) |
| cover | no | image path or empty |

QA rejects rows with empty `key_facts` (this is the human-in-loop guardrail).

### raw-topics.csv (discovery output)

| column | example |
|---|---|
| candidate_title | `ITパスポート シラバス6.5 改定ポイント` |
| competitor_url | `https://comp1.com/...` |
| h2_structure | `定義;変更点;影響` |
| paa_questions | `["..."]` |
| gap_score | `0.85` (0=we cover already, 1=fully uncovered) |
| suggested_template | `glossary` |
| suggested_cluster | `シラバス改定` |

Author promotes selected rows to `topics.csv` and fills `key_facts`.

## Built-in templates

5 templates ship in `./templates/`. Each is an MDX skeleton with frontmatter placeholders + standard H2 structure.

| template | use case | H2 set |
|---|---|---|
| `glossary` | term definitions, "X とは" posts | 定義 → 試験ポイント → 具体例 → 関連用語 → 学習のコツ → まとめ |
| `comparison` | "X vs Y" posts | それぞれの定義 → 比較表 → 選び方 → よくある質問 → まとめ |
| `persona` | persona × time guides | 前提 → スケジュール → 教材 → つまずき対策 → まとめ |
| `data-driven` | analyses with embedded statistics | 集計対象 → 分布 → キーワード別 → 注目変化 → 学習優先順位 → まとめ |
| `howto` | step-by-step tutorials | 前提 → ステップ1...N → よくあるトラブル → まとめ |

Custom templates: drop a `*.mdx.tmpl` in your project's `./templates/` and reference by name.

## Quality gates (SCA prevention)

| post count | behavior |
|---|---|
| 1–99 | free pass |
| 100–499 | warning + requires `--acknowledge-scale` flag |
| 500+ | hard stop unless `--i-have-audited` AND `--audit-report=path/to/audit.md` |

This is intentional. Mass-producing AI water content **will get your site de-indexed** by Google's [scaled content abuse policy](https://developers.google.com/search/blog/2024/03/core-update-spam-policies). The skill enforces this so users don't shoot themselves in the foot.

See [references/safety-and-quality-gates.md](./references/safety-and-quality-gates.md) for the full rationale and audit checklist.

## Configuration

The host project must have `seo-blog.config.json` at the repo root. Run `init` to scaffold it. Schema is documented in [references/workflow-overview.md](./references/workflow-overview.md#configuration).

Key config sections:
- `site` — URL, contentDir, locales
- `output` — format (mdx/md), frontmatter schema
- `llm` — provider, model, endpoint, apiKeyEnv, pricing
- `style` — guidePath, language, forbiddenPhrases, targetLength
- `templates` — default template, available list
- `safety` — warnAt / hardStopAt thresholds

## File-by-file index

- `scripts/cli.mjs` — single CLI entry, dispatches to subcommands
- `scripts/lib/` — config loader, LLM dispatcher, gray-matter wrapper, concurrency pool
- `scripts/production/` — new-outline, expand, qa-check, batch, extract-stats
- `scripts/discovery/` — fetch-sitemap, fetch-titles, scrape-paa, cluster-topics, gap-analysis, generate-csv
- `scripts/safety/` — pre-flight, quality-gate
- `scripts/selftest/` — smoke, unit, regression
- `templates/` — 5 built-in MDX skeletons
- `references/` — long-form docs (loaded on demand)
- `examples/it-passport-syllabus/` — canonical example: 100 posts shipped to it-passport-steel.vercel.app

## Reference docs (load on demand)

- [workflow-overview.md](./references/workflow-overview.md) — full 9-step author flow, config schema
- [outline-format.md](./references/outline-format.md) — exact MDX outline spec
- [post-templates.md](./references/post-templates.md) — when to use each of 5 templates
- [style-guide-template.md](./references/style-guide-template.md) — how to write project's style guide
- [seo-infra-checklist.md](./references/seo-infra-checklist.md) — what SEO infra the host site needs (Article schema, hreflang, sitemap.xml, etc.)
- [safety-and-quality-gates.md](./references/safety-and-quality-gates.md) — SCA risks, audit checklist, when to override
- [llm-providers.md](./references/llm-providers.md) — adding/configuring providers
- [data-source-adapters.md](./references/data-source-adapters.md) — wiring data sources for data-driven posts
- [discovery-playbook.md](./references/discovery-playbook.md) — competitor research methodology
