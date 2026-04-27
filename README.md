# seo-blog-skill

**Outline-driven, multilingual blog generator skill for Claude Code.**

You provide topics + facts. The skill automates **production**: outline scaffolding, LLM prose expansion (DeepSeek/OpenAI/Anthropic/Gemini), QA (forbidden phrases, internal-link integrity), and discovery (competitor sitemap analysis, gap detection, topic clustering).

## What this is, and what it isn't

✅ **This skill helps you**:
- Turn a CSV of topics + facts into 100–500 production-ready blog posts
- Discover what your competitors are writing and find topic gaps
- Enforce style guides (forbidden phrases, target length, brand tone)
- Maintain internal-link integrity at scale
- Work across any MDX/Markdown static site (Next.js, Astro, Hugo, etc.)
- Multi-locale from day 1 (ja/zh/en/etc.)

❌ **This skill does NOT**:
- Do keyword research for you
- Retrieve facts from the web
- Generate "1000 articles for any domain" magic content
- Replace domain expertise

If you don't already know your domain, this skill cannot save you. Google's [scaled content abuse policy](https://developers.google.com/search/blog/2024/03/core-update-spam-policies) explicitly targets AI-generated water content, and this skill includes hard quality gates (block at 500+ posts without explicit audit) to prevent misuse.

## Install

```bash
git clone https://github.com/Kaedeeeeeeeeee/seo-blog-skill.git
cd seo-blog-skill
bash install.sh           # copies to ~/.claude/skills/seo-blog/
# or
bash install.sh --symlink # so your edits here apply immediately
```

Then in Claude Code, invoke the skill:

> Use the seo-blog skill to bootstrap blog production for this project.

## Quickstart (5 minutes)

```bash
# In your host project (e.g. a Next.js + MDX blog)
cd path/to/my-blog

# 1. Initialize config + style guide (interactive)
node ~/.claude/skills/seo-blog/scripts/cli.mjs init

# 2. Edit topics.csv with your topics + facts
$EDITOR topics.csv

# 3. Generate, expand, QA in one shot
node ~/.claude/skills/seo-blog/scripts/cli.mjs batch --csv=topics.csv

# Output: content/blog/{locale}/{slug}.mdx files ready to commit
```

## Discovery (V2)

```bash
# Find topic gaps vs competitors
node ~/.claude/skills/seo-blog/scripts/cli.mjs discover \
  --competitors=competitors.txt \
  --output=raw-topics.csv

# Then review raw-topics.csv, fill key_facts, and feed to batch
```

## Documentation

- [Workflow overview](./references/workflow-overview.md)
- [Outline format](./references/outline-format.md)
- [Post templates](./references/post-templates.md)
- [Safety + quality gates](./references/safety-and-quality-gates.md)
- [LLM providers](./references/llm-providers.md)
- [Discovery playbook](./references/discovery-playbook.md)
- [Example: IT パスポート (100 shipped posts)](./examples/it-passport-syllabus/)

## License

MIT — see [LICENSE](./LICENSE).
