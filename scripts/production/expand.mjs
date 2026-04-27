#!/usr/bin/env node
// expand: skeleton outline MDX → fully-prosed MDX via LLM.
//
// Usage:
//   node scripts/production/expand.mjs [--concurrency=N] [--config=path] <file> [<file>...]
//
// For each input file:
//   1. read the file
//   2. read configured style guide
//   3. send (system: workflow + style) + (user: file content) to LLM
//   4. unwrap response, write back to disk

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { argv, exit } from "node:process";
import { loadConfig } from "../lib/config.mjs";
import { callLLM, unwrap } from "../lib/llm.mjs";
import { runPool } from "../lib/pool.mjs";

function parseArgs(args) {
  const out = { concurrency: 1, config: null, files: [] };
  for (const a of args) {
    if (a.startsWith("--concurrency=")) out.concurrency = Math.max(1, parseInt(a.slice(14), 10));
    else if (a.startsWith("--config=")) out.config = a.slice(9);
    else if (a === "--help" || a === "-h") {
      printHelp();
      exit(0);
    } else {
      out.files.push(a);
    }
  }
  return out;
}

function printHelp() {
  console.log(`expand: skeleton outline → prosed MDX via LLM

Usage:
  expand [--concurrency=N] [--config=path] <file> [<file>...]

Options:
  --concurrency=N  Parallel API calls (default: 1; recommended 3-4)
  --config=PATH    Path to seo-blog.config.json
  --help, -h       Show this message
`);
}

function buildSystemPrompt(config, styleGuideText) {
  const lang = config.style.language;
  const tone = config.style.tone || "neutral";
  const [minLen, maxLen] = config.style.targetLength;
  const forbidden = config.style.forbiddenPhrases.length
    ? `Forbidden phrases (must NOT appear in output): ${config.style.forbiddenPhrases.map((p) => `"${p}"`).join(", ")}.`
    : "";

  return `You are filling in a blog post outline. The user will paste an MDX file containing complete frontmatter and a body skeleton with H2/H3 headings and \`-\` bullet points listing facts.

## Your task

Return the FULL FILE (frontmatter + body), with the following changes applied:

1. **Expand bullets into prose.** Inside the body, every \`- ...\` bullet under each H2/H3 heading must be replaced by 2–4 flowing sentences in ${lang} (${tone} tone) covering the same facts. Do NOT keep bullets at all, EXCEPT:
   - Sub-lists explicitly under headings that are clearly enumerations (e.g. exam question patterns, related-link lists with 2+ short items).
   - Markdown tables — preserve verbatim.
   - Fenced code blocks — preserve verbatim.
2. **Total body length: ${minLen}–${maxLen} characters.**
3. **Frontmatter**: preserve every field and value EXCEPT delete the \`status: "draft"\` line if present.
4. **Delete any \`{/* SUBAGENT WRITING NOTES … */}\` comment block** at the top of the body if present.
5. **Keep every H2 and H3 heading exactly** as written.
6. **Preserve every internal link** \`[text](/path)\` exactly — these are non-negotiable.

## Style rules (strict)

${styleGuideText ? styleGuideText + "\n" : ""}
${forbidden}

- Numbers, proper nouns, and stats from the bullets must be preserved exactly. No invention or embellishment.
- High information density. Avoid redundant connectives.
- Paragraphs of 1–3 sentences.

## Output format (CRITICAL)

Return ONLY the raw MDX file content, starting with \`---\` (frontmatter open) and ending with the last line of the body. NO markdown code fences (\`\`\`mdx etc.) wrapping the output. NO preamble. NO trailing commentary. The output is written directly back to disk — anything extra breaks the file.`;
}

async function loadStyleGuide(config, projectRoot) {
  if (!config.style.guidePath) return "";
  const p = path.isAbsolute(config.style.guidePath)
    ? config.style.guidePath
    : path.join(projectRoot, config.style.guidePath);
  if (!existsSync(p)) return "";
  return readFile(p, "utf8");
}

async function expandOne(filePath, config, systemPrompt) {
  const original = await readFile(filePath, "utf8");
  const userPrompt = `Here is the outline file. Apply the rules and return the FULL FILE content with bullets expanded, status:draft removed, SUBAGENT NOTES deleted. Output raw file content only.\n\n${original}`;
  const result = await callLLM(config, { system: systemPrompt, user: userPrompt });
  const cleaned = unwrap(result.text);
  await writeFile(filePath, cleaned);
  return { filePath, chars: cleaned.length, ...result };
}

async function main() {
  const args = parseArgs(argv.slice(2));
  if (args.files.length === 0) {
    printHelp();
    exit(1);
  }

  const { config, projectRoot } = await loadConfig(args.config);
  const styleGuide = await loadStyleGuide(config, projectRoot);
  const systemPrompt = buildSystemPrompt(config, styleGuide);

  // Filter to existing files
  const files = args.files.filter((f) => {
    if (!existsSync(f)) {
      console.warn(`⊘ not found: ${f}`);
      return false;
    }
    return true;
  });
  if (files.length === 0) {
    console.error("No existing files to process.");
    exit(1);
  }

  console.log(`Expanding ${files.length} files via ${config.llm.provider}/${config.llm.model} (concurrency=${args.concurrency})\n`);

  let totalCost = 0;
  const { ok, errors, wallSec } = await runPool(
    files,
    args.concurrency,
    (f) => expandOne(f, config, systemPrompt),
    (r) => {
      totalCost += r.costUSD;
      console.log(
        `✓ ${r.filePath} — ${r.chars} chars, ${(r.ms / 1000).toFixed(1)}s, ${r.inputTokens}→${r.outputTokens} tok ($${r.costUSD.toFixed(4)})`,
      );
    },
    (e, f) => console.error(`✗ ${f}: ${e.message}`),
  );

  console.log(
    `\n--- ${ok}/${files.length} ok, ${wallSec.toFixed(1)}s wall, $${totalCost.toFixed(4)} total ---`,
  );
  if (errors.length > 0) exit(1);
}

main().catch((e) => {
  console.error(`Error: ${e.message}`);
  exit(1);
});
