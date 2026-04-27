# Outline Format

The MDX/Markdown file format that `new-outline.mjs` produces and `expand.mjs` consumes.

## Anatomy

```mdx
---
title: "Post title"
description: "Meta description (120-160 chars recommended)"
date: "2026-04-27"
tags: ["Tag1", "Tag2", "Tag3"]
cover: null
status: "draft"
---

## First H2 (typically the concept introduction)

- key_fact 1
- key_fact 2
- key_fact 3

## Second H2

- detail bullet
- detail bullet

## ... (more H2 sections)

## Related

- [related-slug-1](/blog/related-slug-1)
- [related-slug-2](/blog/related-slug-2)

## Summary

- recap point 1
- recap point 2
```

## Frontmatter contract

| Field | Required | Set by | Notes |
|---|---|---|---|
| title | yes | CSV `title` | Your H1 in rendered output (most templates) |
| description | yes | CSV `description` | SEO meta description |
| date | yes | CSV `date` or today | ISO `YYYY-MM-DD` |
| tags | yes | CSV `tags` (semicolon-sep) | YAML array |
| cover | no | CSV `cover` or `null` | Image path |
| status | auto | always `"draft"` after `new-outline` | Removed by `expand` |

`status: "draft"` is critical — the `expand` step removes it after successful expansion. Files with `status: "draft"` are typically excluded from blog listings by the host site (you must implement this filter). `qa-check` rejects files where `status: "draft"` is still present.

## Body contract

- **All H2 (`## `) and H3 (`### `) headings are preserved verbatim** by `expand`
- **Bullets under each heading** are replaced by 2–4 sentences of prose by `expand`
- **Markdown tables** are preserved verbatim
- **Fenced code blocks** are preserved verbatim
- **Internal links** `[text](/path)` are preserved verbatim — these are non-negotiable

## Bullet preservation exceptions

Some H2/H3 sections are clearly meant to remain as lists. The `expand` LLM is told to keep bullets in:

- Sections with 2+ short, parallel items (e.g., "Common errors", "Past exam patterns")
- "Related" or cross-reference sections with internal links

If a bullet section gets converted to prose when it shouldn't, edit the file by hand or refine your style guide.

## Customizing the LLM prompt

`expand.mjs` builds the system prompt from:
1. Hardcoded workflow rules (preserve H2, expand bullets, etc.)
2. Your `style.language` and `style.tone` from config
3. Your `style.forbiddenPhrases` from config
4. The full content of your `style.guidePath` file (style guide)

To change the LLM behavior:
- Edit `style-guide.md` for tone/voice changes
- Edit `seo-blog.config.json > style.forbiddenPhrases` to add new banned phrases
- For deeper changes, fork `scripts/production/expand.mjs` and edit `buildSystemPrompt`

## Multilingual outlines

Each row in `topics.csv` declares a `locale`. The skill writes `{contentDir}/{locale}/{slug}.{ext}`.

To produce the same post in multiple locales:
- Create one CSV row per locale (with translated title/description/key_facts)
- Or write the JA version first, then translate manually (V1 doesn't auto-translate)

V3 may add translation; for now this is intentional (translation quality requires per-language editorial decisions).
