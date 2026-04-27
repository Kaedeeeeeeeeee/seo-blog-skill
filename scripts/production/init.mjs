#!/usr/bin/env node
// init: bootstrap a host project with seo-blog.config.json + style-guide.md + topics.csv.
//
// Usage:
//   node scripts/production/init.mjs [--non-interactive]
//
// Non-interactive mode uses sensible defaults; interactive mode prompts.

import { writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { argv, exit, stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";

const DEFAULT_CONFIG = {
  site: {
    url: "https://example.com",
    contentDir: "content/blog",
    locales: ["en"],
    defaultLocale: "en",
  },
  output: {
    format: "mdx",
    frontmatterFields: {
      required: ["title", "description", "date", "tags"],
      optional: ["cover", "status"],
      stripOnPublish: ["status"],
    },
  },
  llm: {
    provider: "deepseek",
    model: "deepseek-v4-flash",
    temperature: 0.3,
  },
  style: {
    guidePath: "./style-guide.md",
    language: "English",
    tone: "informative, concise",
    forbiddenPhrases: [],
    targetLength: [800, 1400],
  },
  templates: {
    default: "glossary",
    available: ["glossary", "comparison", "persona", "data-driven", "howto"],
  },
  safety: {
    warnAt: 100,
    hardStopAt: 500,
  },
};

const STYLE_GUIDE_TEMPLATE = `# Style Guide

This file describes the brand voice and writing rules for blog posts in this project.
Loaded into the LLM system prompt during \`expand\`.

## Voice

- Tone: [describe — e.g. polite, expert, conversational]
- Audience: [describe — e.g. beginners, professionals, hobbyists]
- Reading level: [describe — e.g. high school, college]

## Style rules

- Paragraph length: 1–3 sentences
- Use concrete examples over abstract claims
- Numbers and proper nouns from the bullets must be preserved exactly
- Information density high; avoid redundant connectives

## Vocabulary

- Preferred terms: ...
- Avoid: ...

## Examples

[Optional: paste 1–2 paragraphs from existing posts that exemplify the voice]
`;

const TOPICS_CSV_TEMPLATE = `slug,locale,title,description,tags,template,key_facts,internal_links
example-glossary-post,en,"Example: What is X?","Short description with main keyword.","SEO;Glossary;Example",glossary,"X was defined in 2020;Y is the standard usage;Common misconception is Z","another-post-slug;related-glossary"
`;

async function prompt(rl, question, fallback) {
  const ans = (await rl.question(`${question} [${fallback}]: `)).trim();
  return ans || fallback;
}

async function main() {
  const interactive = !argv.includes("--non-interactive");
  const cwd = process.cwd();

  // Refuse if files already exist
  const configPath = path.join(cwd, "seo-blog.config.json");
  const stylePath = path.join(cwd, "style-guide.md");
  const csvPath = path.join(cwd, "topics.csv");

  for (const p of [configPath, stylePath, csvPath]) {
    if (existsSync(p)) {
      console.error(`Refusing to overwrite existing ${path.basename(p)}. Move or delete it first.`);
      exit(1);
    }
  }

  const config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

  if (interactive) {
    const rl = createInterface({ input: stdin, output: stdout });
    try {
      console.log("\nConfiguring seo-blog for this project. Press enter to accept defaults.\n");
      config.site.url = await prompt(rl, "Site URL", config.site.url);
      config.site.contentDir = await prompt(rl, "Content directory", config.site.contentDir);
      const locales = await prompt(rl, "Locales (comma-sep)", config.site.locales.join(","));
      config.site.locales = locales.split(",").map((s) => s.trim()).filter(Boolean);
      config.site.defaultLocale = await prompt(rl, "Default locale", config.site.locales[0]);
      config.output.format = await prompt(rl, "Output format (mdx|md)", config.output.format);
      config.llm.provider = await prompt(rl, "LLM provider (deepseek|openai|anthropic|gemini)", config.llm.provider);
      config.llm.model = await prompt(rl, "LLM model", config.llm.model);
      config.style.language = await prompt(rl, "Style language", config.style.language);
    } finally {
      rl.close();
    }
  }

  await writeFile(configPath, JSON.stringify(config, null, 2) + "\n");
  await writeFile(stylePath, STYLE_GUIDE_TEMPLATE);
  await writeFile(csvPath, TOPICS_CSV_TEMPLATE);

  console.log(`
✓ Created:
  ${configPath}
  ${stylePath}
  ${csvPath}

Next steps:
  1. Edit style-guide.md with your project's brand voice
  2. Set ${config.llm.apiKeyEnv ?? `${config.llm.provider.toUpperCase()}_API_KEY`} in env or .env.local
  3. Add real rows to topics.csv
  4. Run: seo-blog batch --csv=topics.csv
`);
}

main().catch((e) => {
  console.error(`Error: ${e.message}`);
  exit(1);
});
