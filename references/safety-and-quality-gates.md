# Safety & Quality Gates

This skill includes hard quality gates that **block** large batch runs unless explicitly acknowledged. This document explains why, and when overrides are appropriate.

## The risk: scaled content abuse (SCA)

Google's [March 2024 spam policy update](https://developers.google.com/search/blog/2024/03/core-update-spam-policies) targets "scaled content abuse" — pages produced primarily to manipulate search rankings without adding value for users. AI-generated content is not banned per se, but mass-producing thousands of low-value pages — even if technically unique — risks site-wide de-indexing.

Real cases (2024–2026):
- The "SEO Heist" case: ~1,800 AI articles generated from a competitor's sitemap, briefly received millions of views, then was de-indexed
- Multiple AI content farms saw 80%+ traffic drops after the March 2024 update
- Even legitimate sites with too much thin AI content have been affected

## Default thresholds

| Post count | Behavior |
|---|---|
| < `warnAt` (default 100) | Free pass, no flag needed |
| `warnAt`–`hardStopAt` (default 100–499) | Requires `--acknowledge-scale` flag |
| ≥ `hardStopAt` (default 500) | Requires `--i-have-audited` AND `--audit-report=path/to/audit.md` |

Configure via `safety.warnAt` and `safety.hardStopAt` in `seo-blog.config.json`.

## When `--acknowledge-scale` is appropriate

Pass this flag when you have:
- Reviewed your topic CSV personally
- Confirmed each row has substantive `key_facts` (not placeholder)
- Decided the 100+ batch represents genuine editorial intent

You can still produce bad content with this flag. The flag just confirms you've thought about it.

## When `--i-have-audited` is appropriate

This flag is for genuinely large runs (500+) where mass production has clear editorial value:

- **Per-question pages**: e.g. 2,800 exam question pages, each with unique content + answer + explanation
- **Per-product pages**: e.g. 1,000 product pages with real product data
- **Per-location pages**: e.g. 500 city-specific service pages with real local data

Required: an `audit-report.md` file describing:
1. Sample size: how many posts were manually reviewed (recommend 10% of total, minimum 50)
2. Reviewer: who did the review and their qualifications
3. Quality criteria: what was checked (factual accuracy, uniqueness, value-add)
4. Findings: what fraction passed, what was changed
5. Risk acknowledgment: explicit statement that you understand the SCA risk

Example skeleton:

```markdown
# Audit Report — 2026-04-27

## Scope
- 800 generated posts in `content/blog/ja/per-question/`
- Sample size: 100 (12.5%)

## Reviewer
- [Name], domain expert in [field]

## Criteria
- Factual accuracy of generated explanation vs source data
- Uniqueness (no duplicate paragraphs across sample)
- User value (would a beginner learn from this?)

## Findings
- 92/100 passed all criteria
- 8/100 had factual issues; corrected before approval
- 0 duplicates found

## Risk acknowledgment
We understand that large-scale AI-assisted content carries SCA risk. We
have reviewed Google's policy and believe this batch represents genuine
editorial value (each page is grounded in unique source data).
```

## Bypassing the gates

The gates are config-driven. Setting `safety.warnAt: 999999` and `safety.hardStopAt: 999999` disables them. **This is your right and your responsibility.** The skill author will not be liable for de-indexing penalties from misuse.

## Best practices regardless of scale

Even small batches should:
- Have unique `key_facts` per row (no copy-pasting)
- Avoid pure synonym-replacement of competitor content
- Include real examples, numbers, and citations
- Be reviewed manually before publishing (skim every 10th post at minimum)
- Avoid publishing all posts in a single day (Google notices burst patterns)

## When to NOT use this skill at all

- You don't have domain expertise (skill cannot generate facts)
- You want to copy/paraphrase competitor content (legally and ethically risky)
- Your goal is volume for ad revenue without user value (this is what SCA targets)
- You're trying to rank a brand-new domain with no E-E-A-T signals (fresh sites with mass AI content are flagged most aggressively)
