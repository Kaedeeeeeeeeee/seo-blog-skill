# Examples

Real configurations and outputs from projects using this skill.

## it-passport-syllabus/

The canonical example: a Japanese IT exam (IT パスポート) study site that shipped 100 blog posts to https://it-passport-steel.vercel.app using this skill's workflow.

What's in there:

- `seo-blog.config.json` — the project's actual config
- `style-guide.md` — the JA exam-prep voice that worked
- `topics.csv` — 5 sample rows reverse-engineered from shipped posts (full set is 100; 5 is enough to demonstrate)
- `data-source.md` — how the project's `questions.json` (2,800 exam questions) is wired for data-driven posts
- `output-samples/` — 5 actual shipped posts (1 per template type) showing what the pipeline produces

## How to use these

1. **As reference**: read `seo-blog.config.json` and `style-guide.md` to see what a complete config looks like
2. **As starter**: copy the structure, replace IT パスポート content with your domain
3. **As regression test**: `scripts/selftest/regression.mjs` uses these to verify the skill still produces equivalent output as it evolves

## Adding your own example

Examples drive adoption. If you ship a project using this skill:

1. Create `examples/your-project-name/`
2. Add anonymized/sanitized config + 1-3 sample posts
3. Open a PR to https://github.com/Kaedeeeeeeeeee/seo-blog-skill

This helps other users see the skill in real domains.
