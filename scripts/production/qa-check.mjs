#!/usr/bin/env node
// qa-check: validate generated/edited MDX files for publication readiness.
//
// Checks:
//   - frontmatter required fields present
//   - no forbidden phrases (config.style.forbiddenPhrases)
//   - internal links resolve (file exists for /blog/{slug} pattern)
//   - content length in target range
//   - no SUBAGENT NOTES leftover
//   - status:draft removed
//
// Usage:
//   node scripts/production/qa-check.mjs [--config=path] <file> [<file>...]
//
// Exits 0 if all clean, 1 if any errors.

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { argv, exit } from "node:process";
import { loadConfig } from "../lib/config.mjs";
import { parse as fmParse, validate as fmValidate } from "../lib/frontmatter.mjs";
import {
  countContentChars,
  extractInternalLinks,
} from "../lib/markdown-utils.mjs";

function parseArgs(args) {
  const out = { config: null, files: [], strict: false };
  for (const a of args) {
    if (a.startsWith("--config=")) out.config = a.slice(9);
    else if (a === "--strict") out.strict = true;
    else if (a === "--help" || a === "-h") {
      printHelp();
      exit(0);
    } else out.files.push(a);
  }
  return out;
}

function printHelp() {
  console.log(`qa-check: validate MDX files for publication

Usage:
  qa-check [--config=path] [--strict] <file> [<file>...]

Exits 0 if all clean, 1 if any errors.

Options:
  --config=PATH  Path to seo-blog.config.json
  --strict       Treat warnings as errors
  --help, -h     Show this message
`);
}

function checkOne(filePath, body, data, config, slugIndex) {
  const issues = [];
  const warnings = [];

  // 1. frontmatter required fields
  const fmCheck = fmValidate(data, config.output.frontmatterFields);
  for (const e of fmCheck.errors) issues.push(`frontmatter: ${e}`);

  // 2. status:draft must NOT be present
  if (data.status === "draft") issues.push("frontmatter: status: 'draft' must be removed before publish");

  // 3. SUBAGENT NOTES leftover
  if (/SUBAGENT/.test(body)) issues.push("body: SUBAGENT NOTES comment block was not removed");

  // 4. forbidden phrases
  for (const phrase of config.style.forbiddenPhrases) {
    if (body.includes(phrase)) {
      issues.push(`body: forbidden phrase found: "${phrase}"`);
    }
  }

  // 5. internal link integrity
  const links = extractInternalLinks(body);
  for (const { href } of links) {
    // /blog/{slug} pattern
    const m = href.match(/^\/blog\/([a-z0-9-]+)/);
    if (m) {
      const slug = m[1];
      if (!slugIndex.has(slug)) {
        issues.push(`body: broken internal link → /blog/${slug} (target file not found)`);
      }
    }
  }

  // 6. content length in range
  const chars = countContentChars(body);
  const [minLen, maxLen] = config.style.targetLength;
  if (chars < minLen) warnings.push(`length: ${chars} chars < target min ${minLen}`);
  if (chars > maxLen * 1.2) warnings.push(`length: ${chars} chars > target max ${maxLen} +20%`);

  return { issues, warnings, chars };
}

function buildSlugIndex(files, config, projectRoot) {
  // Index all known slugs across all locales so internal-link check works.
  // We index from the file list passed in (assumes user runs qa-check on
  // the full set or has previously committed siblings).
  const idx = new Set();
  for (const f of files) {
    const base = path.basename(f).replace(/\.(mdx?|markdown)$/, "");
    idx.add(base);
  }
  return idx;
}

async function main() {
  const args = parseArgs(argv.slice(2));
  if (args.files.length === 0) {
    printHelp();
    exit(1);
  }

  const { config, projectRoot } = await loadConfig(args.config);
  const slugIndex = buildSlugIndex(args.files, config, projectRoot);

  let totalIssues = 0;
  let totalWarnings = 0;
  let okCount = 0;

  for (const filePath of args.files) {
    if (!existsSync(filePath)) {
      console.error(`⊘ not found: ${filePath}`);
      totalIssues++;
      continue;
    }
    const raw = await readFile(filePath, "utf8");
    const { data, content } = fmParse(raw);
    const { issues, warnings, chars } = checkOne(filePath, content, data, config, slugIndex);

    if (issues.length === 0 && warnings.length === 0) {
      okCount++;
      continue;
    }
    console.log(`${filePath} (${chars} chars)`);
    for (const i of issues) console.log(`  ✗ ${i}`);
    for (const w of warnings) console.log(`  ⚠ ${w}`);
    totalIssues += issues.length;
    totalWarnings += warnings.length;
  }

  console.log(
    `\n--- ${okCount}/${args.files.length} clean | ${totalIssues} errors | ${totalWarnings} warnings ---`,
  );

  if (totalIssues > 0) exit(1);
  if (args.strict && totalWarnings > 0) exit(1);
}

main().catch((e) => {
  console.error(`Error: ${e.message}`);
  exit(1);
});
