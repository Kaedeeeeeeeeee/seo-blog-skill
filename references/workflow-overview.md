# Workflow Overview

The 9-step author flow, with config schema reference.

## The 9 steps

```
1. (auto) discover     → competitor sitemaps + PAA → raw-topics.csv
2. (manual) curate     → review raw-topics.csv, select topics worth writing
3. (manual) seed facts → fill key_facts column with verified facts
4. (auto) new-outline  → key_facts CSV → skeleton MDX files
5. (manual, optional)  → author refines bullets in each .mdx
6. (auto) expand       → skeleton MDX → prosed MDX via LLM
7. (auto) qa           → forbidden phrases, frontmatter, internal-link integrity
8. (auto) safety gate  → block runs >500 unless audited
9. (manual) commit + deploy
```

### What each step actually does

**1. discover** — `seo-blog discover --competitors=competitors.txt --our-sitemap=URL`
   - Fetches each competitor's sitemap.xml
   - Recursively follows sitemap-of-sitemaps
   - Pulls page title, meta description, H1/H2 from each URL
   - LLM-clusters titles into thematic groups
   - Computes Jaccard token overlap vs your sitemap → gap_score
   - Emits `raw-topics.csv` with candidate titles, structures, gap scores, suggested clusters

**2. curate (manual)** — open `raw-topics.csv` in Excel/Numbers/Sheets
   - Sort by `gap_score DESC` (most uncovered first)
   - Filter by `suggested_cluster` to focus a batch
   - Delete rows you don't want to write
   - Tip: don't cherry-pick more than ~30-50 per batch unless you're prepared to write the facts

**3. seed facts (manual)** — for each surviving row, fill `key_facts` column
   - Format: semicolon-separated, e.g. `経産省 2018 定義;2025年の崖=12兆円;3段階モデル`
   - Each fact should be a self-contained statement the author has verified
   - This is THE bottleneck and THE differentiator. AI cannot do this for you.
   - For data-driven posts, use `scripts/production/extract-stats.mjs` to pull stats from a JSON source via jq

**4. new-outline** — `seo-blog new --csv=topics.csv`
   - For each row, picks the template (`templates/{template}.mdx.tmpl`)
   - Fills frontmatter (title/description/date/tags) from CSV
   - Inserts `key_facts` as bullet points under the first H2
   - Inserts internal links into the related-section H2
   - Adds `status: draft` to frontmatter
   - Writes to `{contentDir}/{locale}/{slug}.{ext}`

**5. refine (manual, optional)** — open each .mdx and add detail to bullets
   - Skip if `key_facts` is already detailed enough
   - Most valuable for data-driven and comparison posts

**6. expand** — `seo-blog expand --concurrency=4 'content/blog/ja/*.mdx'`
   - Reads each file, sends to configured LLM with style guide injected
   - LLM expands bullets into prose, removes draft status, removes any SUBAGENT NOTES
   - Writes back to disk
   - Concurrency 1-8 recommended; rate limit varies by provider

**7. qa** — `seo-blog qa 'content/blog/ja/*.mdx'`
   - Validates frontmatter has all required fields
   - Scans for forbidden phrases from config
   - Checks `/blog/{slug}` internal links resolve to existing files
   - Warns if content length is way out of target range
   - Exits 1 if any errors (CI-friendly)

**8. safety gate** — automatic, runs before any batch
   - <100 posts: free pass
   - 100–499 posts: requires `--acknowledge-scale`
   - 500+ posts: requires `--i-have-audited` + `--audit-report=path/to/audit.md`
   - See `references/safety-and-quality-gates.md`

**9. commit + deploy** — manual
   - Review the generated files in git diff
   - `git add content/blog/ja/*.mdx && git commit -m "..."`
   - Push, let your CI/CD deploy

## One-shot batch

If you trust the pipeline (after running it a few times), use `seo-blog batch --csv=topics.csv` to do steps 4+6+7 in one command.

## Configuration

Schema for `seo-blog.config.json` (in your project root):

```json
{
  "site": {
    "url": "https://example.com",
    "contentDir": "content/blog",
    "locales": ["ja", "zh", "en"],
    "defaultLocale": "ja"
  },
  "output": {
    "format": "mdx",
    "frontmatterFields": {
      "required": ["title", "description", "date", "tags"],
      "optional": ["cover", "status"],
      "stripOnPublish": ["status"]
    }
  },
  "llm": {
    "provider": "deepseek",
    "model": "deepseek-v4-flash",
    "endpoint": "https://api.deepseek.com/v1/chat/completions",
    "apiKeyEnv": "DEEPSEEK_API_KEY",
    "temperature": 0.3,
    "pricing": { "inputPerM": 0.14, "outputPerM": 0.28 }
  },
  "style": {
    "guidePath": "./style-guide.md",
    "language": "Japanese (keigo, です/ます調)",
    "tone": "polite, exam-prep",
    "forbiddenPhrases": ["いかがでしたか", "本記事では", "まとめると、"],
    "targetLength": [800, 1400]
  },
  "templates": {
    "default": "glossary",
    "available": ["glossary", "comparison", "persona", "data-driven", "howto"]
  },
  "safety": {
    "warnAt": 100,
    "hardStopAt": 500
  }
}
```

### Field explanations

- `site.url` — used for absolute URL building in discovery / sitemap comparison
- `site.contentDir` — relative to project root; outlines written to `{contentDir}/{locale}/{slug}.{ext}`
- `site.locales` — array of locale codes; CSV `locale` column must be one of these
- `output.format` — `mdx` or `md`
- `output.frontmatterFields.required` — qa-check fails if any are missing
- `output.frontmatterFields.stripOnPublish` — fields removed by expand step (e.g. `status: draft`)
- `llm.provider` — `deepseek` / `openai` / `anthropic` / `gemini` / any OpenAI-compatible
- `llm.endpoint` — auto-filled for known providers; required for custom
- `llm.apiKeyEnv` — env var name (the key itself goes in `.env.local`, never in this file)
- `llm.pricing` — for cost reporting in expand output
- `style.guidePath` — relative to project root; injected into LLM system prompt
- `style.language` — descriptive (used in LLM prompt)
- `style.forbiddenPhrases` — qa-check rejects files containing any of these
- `style.targetLength` — `[min, max]` in characters; qa-check warns if out of range
- `templates.default` — used when CSV row has no `template` column
- `templates.available` — whitelist; CSV rows must use one of these
- `safety.warnAt` / `safety.hardStopAt` — see `safety-and-quality-gates.md`
