#!/usr/bin/env node
// new-outline: CSV → skeleton MDX outlines, one per row.
//
// Usage:
//   node scripts/production/new-outline.mjs --csv=topics.csv [--config=path]
//
// Per row, reads the configured template (templates.{template}.mdx.tmpl),
// fills frontmatter from the row, then outputs to {contentDir}/{locale}/{slug}.{ext}.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { argv, exit } from "node:process";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../lib/config.mjs";
import { parseCsv, splitList } from "../lib/csv.mjs";
import { stringify as fmStringify } from "../lib/frontmatter.mjs";
import { fillPlaceholders } from "../lib/markdown-utils.mjs";

const SKILL_DIR = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));

function parseArgs(args) {
  const out = { csv: null, config: null, dryRun: false };
  for (const a of args) {
    if (a.startsWith("--csv=")) out.csv = a.slice("--csv=".length);
    else if (a.startsWith("--config=")) out.config = a.slice("--config=".length);
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--help" || a === "-h") {
      printHelp();
      exit(0);
    }
  }
  return out;
}

function printHelp() {
  console.log(`new-outline: CSV → skeleton MDX outlines

Usage:
  new-outline --csv=topics.csv [--config=path] [--dry-run]

Options:
  --csv=PATH       Topic CSV (required)
  --config=PATH    Path to seo-blog.config.json (default: ./seo-blog.config.json)
  --dry-run        Print what would be written without touching disk
  --help, -h       Show this message
`);
}

async function loadTemplate(templateName, projectRoot) {
  // 1. project-local override
  const localPath = path.join(projectRoot, "templates", `${templateName}.mdx.tmpl`);
  if (existsSync(localPath)) return readFile(localPath, "utf8");
  // 2. skill built-in
  const skillPath = path.join(SKILL_DIR, "templates", `${templateName}.mdx.tmpl`);
  if (existsSync(skillPath)) return readFile(skillPath, "utf8");
  throw new Error(
    `Template '${templateName}' not found. Looked in:\n  ${localPath}\n  ${skillPath}`,
  );
}

function rowToFrontmatter(row, config) {
  const today = new Date().toISOString().slice(0, 10);
  const fm = {
    title: row.title,
    description: row.description,
    date: row.date || today,
    tags: splitList(row.tags),
    cover: row.cover || null,
    status: "draft",
  };
  return fm;
}

function outlinePath(row, config, projectRoot) {
  const ext = config.output.format === "md" ? "md" : "mdx";
  return path.join(
    projectRoot,
    config.site.contentDir,
    row.locale || config.site.defaultLocale,
    `${row.slug}.${ext}`,
  );
}

async function main() {
  const args = parseArgs(argv.slice(2));
  if (!args.csv) {
    printHelp();
    exit(1);
  }
  if (!existsSync(args.csv)) {
    console.error(`CSV not found: ${args.csv}`);
    exit(1);
  }

  const { config, projectRoot } = await loadConfig(args.config);
  const csvText = await readFile(args.csv, "utf8");
  const { records } = parseCsv(csvText);

  if (records.length === 0) {
    console.error("CSV is empty (no data rows).");
    exit(1);
  }

  // Validate required fields
  const required = ["slug", "locale", "title", "description", "tags", "template", "key_facts"];
  const errors = [];
  records.forEach((r, i) => {
    for (const f of required) {
      if (!r[f] || r[f].trim() === "") {
        errors.push(`Row ${i + 2}: missing ${f}`);
      }
    }
    if (r.locale && !config.site.locales.includes(r.locale)) {
      errors.push(`Row ${i + 2}: locale '${r.locale}' not in config.site.locales`);
    }
    if (r.template && !config.templates.available.includes(r.template)) {
      errors.push(`Row ${i + 2}: template '${r.template}' not in config.templates.available`);
    }
  });
  if (errors.length > 0) {
    console.error("CSV validation failed:");
    for (const e of errors) console.error(`  ${e}`);
    exit(1);
  }

  let written = 0;
  let skipped = 0;
  for (const row of records) {
    const outPath = outlinePath(row, config, projectRoot);
    if (existsSync(outPath)) {
      console.warn(`⊘ exists, skipping: ${outPath}`);
      skipped++;
      continue;
    }

    const tmpl = await loadTemplate(row.template, projectRoot);
    const internalLinks = splitList(row.internal_links || "")
      .map((s) => `[${s}](/blog/${s})`)
      .join("、");
    const keyFacts = splitList(row.key_facts);
    const body = fillPlaceholders(tmpl, {
      title: row.title,
      description: row.description,
      key_facts: keyFacts.map((f) => `- ${f}`).join("\n"),
      internal_links: internalLinks,
      slug: row.slug,
    });
    const fm = rowToFrontmatter(row, config);
    const final = fmStringify(fm, body);

    if (args.dryRun) {
      console.log(`→ would write ${outPath} (${final.length} chars)`);
    } else {
      await mkdir(path.dirname(outPath), { recursive: true });
      await writeFile(outPath, final);
      console.log(`✓ ${outPath}`);
    }
    written++;
  }

  console.log(`\n${written} written, ${skipped} skipped`);
}

main().catch((e) => {
  console.error(`Error: ${e.message}`);
  exit(1);
});
