# Style Guide Template

Each project should have a `style-guide.md` (path configured in `style.guidePath`) describing its brand voice. This document is injected verbatim into the LLM system prompt during `expand`.

## What to include

A good style guide is **2-4 short sections** (less than 1 page). The LLM reads it on every API call, so brevity helps.

### 1. Voice & tone (1 paragraph)

Describe:
- Formality level (casual / professional / academic)
- Person (first / second / third)
- Energy (calm / enthusiastic / authoritative)

Example:
> The voice is polite Japanese keigo (です/ます調), addressing exam-takers as peers. Confident but not preachy. Information-dense; avoid filler. Assume the reader is busy and wants the answer fast.

### 2. Audience (1 paragraph)

Describe:
- Who is reading
- What they already know
- What they want to learn

Example:
> Reader is a 20-50 y/o Japanese working professional or college student preparing for the IT パスポート exam. Has basic computer literacy but limited IT theory background. Wants exam-passing knowledge, not deep technical understanding.

### 3. Style rules (bullet list)

Things you want or don't want:

```
- Paragraphs of 1-3 sentences
- Use concrete examples (specific years, company names, numbers)
- Numbers from key_facts MUST be preserved exactly; no rounding or invention
- Avoid filler phrases ("いかがでしたか", "本記事では")
- "Related" sections at the end should link to 2-4 sister posts
```

### 4. Vocabulary (optional)

If your domain has preferred terms:

```
Preferred: "iパス" or "ITパスポート" (not "IT pass" or "iPass")
Preferred: "セキュリティ" (not "セキュリュリティ")
Avoid: brand names of competitors (Salesforce, etc.) — use generic terms
```

### 5. Examples (optional but powerful)

Paste 1-2 paragraphs from existing posts that exemplify the voice. The LLM learns voice better from examples than from descriptions.

## Example: full style guide

```markdown
# Style Guide — IT パスポート学習サイト

## Voice & tone

The voice is polite Japanese keigo (です/ます調), addressing exam-takers as peers. Confident but not preachy. Information-dense; avoid filler. Assume the reader is busy and wants the answer fast.

## Audience

Reader is a 20–50 y/o Japanese working professional or college student preparing for the IT パスポート exam. Has basic computer literacy but limited IT theory background. Wants exam-passing knowledge, not deep technical understanding. Time-constrained.

## Style rules

- Paragraphs of 1–3 sentences
- Use concrete examples (years, company names, specific numbers from key_facts)
- Numbers and proper nouns from bullets MUST be preserved exactly
- Avoid filler: no "いかがでしたか", "本記事では", "まとめると、"
- "関連用語" sections at the end link to 2–4 sister posts
- Use 全角 punctuation (、。) consistently
- Bold key terms with **...** on first introduction

## Vocabulary

- Preferred: "iパス" or "ITパスポート" (not "IT pass")
- Preferred: 試験頻出 (not 出題が多い) for SEO consistency

## Example paragraph

> 暗号化方式には共通鍵暗号と公開鍵暗号の2種類があります。共通鍵は処理が速く大容量データに向きますが、鍵の配送が課題です。公開鍵は配送問題を解決しますが速度が遅いため、実運用では「公開鍵で共通鍵を渡し、本データは共通鍵で暗号化する」ハイブリッド方式が一般的です。
```

## How the style guide is used

`expand.mjs` reads `style.guidePath` and injects the entire file content into the LLM system prompt, after the standard workflow rules. The LLM applies the style throughout expansion.

## Tips

- **Iterate**: write a draft style guide, run `expand` on 5 posts, check output, refine the guide, re-run
- **Don't over-specify**: rules the LLM can already infer from your forbidden-phrases list don't need restating
- **Update when adding forbidden phrases**: if you add a phrase to `forbiddenPhrases` config, also explain *why* in the style guide so the LLM understands intent
