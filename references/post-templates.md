# Post Templates

5 built-in templates ship in `templates/`. Each is an MDX skeleton with `{{title}}`, `{{description}}`, `{{key_facts}}`, `{{internal_links}}` placeholders that `new-outline.mjs` fills from the topic CSV.

## When to use each

| Template | Use case | H2 structure |
|---|---|---|
| `glossary` | "What is X?" term definitions | What is X → Why it matters → Examples → Related → Tips → Summary |
| `comparison` | "X vs Y" head-to-heads | Quick answer → Each option → Side-by-side table → When to choose → Related → Summary |
| `persona` | "How should [persona] do X" guides | Is this realistic → Schedule → Routine → Resources → Pitfalls → Summary |
| `data-driven` | Posts grounded in stats | What we measured → Distribution table → Key findings (3) → What it means → Summary |
| `howto` | Step-by-step tutorials | Prerequisites → Step 1...N → Common issues → Summary |

## Choosing in CSV

Every CSV row needs a `template` column with one of these names. The chosen template is written verbatim into your post's body (with placeholders filled).

If unsure, default to `glossary`. It's the most flexible.

## Custom templates

Drop a `*.mdx.tmpl` in your project's `templates/` dir (next to `seo-blog.config.json`). Reference by name in CSV's `template` column.

The skill's `new-outline.mjs` checks project-local templates first, falls back to skill built-ins.

## Placeholder reference

Available placeholders in templates:

| Placeholder | Source |
|---|---|
| `{{title}}` | CSV row's `title` column |
| `{{description}}` | CSV row's `description` column |
| `{{slug}}` | CSV row's `slug` column |
| `{{key_facts}}` | CSV row's `key_facts` column, formatted as bullet list |
| `{{internal_links}}` | CSV row's `internal_links` column, formatted as `[slug](/blog/slug)` joined by `、` |

Frontmatter (title/description/date/tags/cover/status) is NOT placeholder-substituted — it's set programmatically by `new-outline.mjs` from the CSV row. Templates only need to define the body structure.

## Template authoring tips

1. **Lead with key_facts at the top** — this primes the LLM with author-provided ground truth before it expands surrounding sections
2. **End with internal_links** — drives users (and crawlers) to related posts
3. **Use H2/H3 for hierarchy** — the LLM respects existing headings; it won't restructure unless told to
4. **Tables are preserved verbatim** — pre-fill table headers if you want a specific structure
5. **Keep templates short** — 6 H2s is plenty; the LLM expands details

## Example: extending the comparison template

If you frequently write 3-way comparisons (`X vs Y vs Z`), create `templates/comparison-3way.mdx.tmpl`:

```mdx
## Quick answer

{{key_facts}}

## What each option is

### Option A
- ...

### Option B
- ...

### Option C
- ...

## Side-by-side comparison

| Aspect | A | B | C |
| --- | --- | --- | --- |
| ... | ... | ... | ... |

## When to choose which
...

## Related

{{internal_links}}

## Summary
...
```

Then in CSV: `template,...comparison-3way,...`. Validate: `seo-blog new --csv=topics.csv --dry-run` will report if the template name isn't in `templates.available` (config).

Add `comparison-3way` to `templates.available` in `seo-blog.config.json`.
