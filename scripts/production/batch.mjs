#!/usr/bin/env node
// batch: end-to-end pipeline. CSV → outlines → expand → QA.
//
// Usage:
//   node scripts/production/batch.mjs --csv=topics.csv [options]

import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { argv, exit } from "node:process";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { loadConfig } from "../lib/config.mjs";
import { parseCsv } from "../lib/csv.mjs";
import { runQualityGate } from "../safety/quality-gate.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(args) {
  const out = {
    csv: null,
    config: null,
    concurrency: 4,
    skipExpand: false,
    skipQa: false,
    acknowledgeScale: false,
    iHaveAudited: false,
    auditReport: null,
  };
  for (const a of args) {
    if (a.startsWith("--csv=")) out.csv = a.slice(6);
    else if (a.startsWith("--config=")) out.config = a.slice(9);
    else if (a.startsWith("--concurrency=")) out.concurrency = parseInt(a.slice(14), 10);
    else if (a === "--skip-expand") out.skipExpand = true;
    else if (a === "--skip-qa") out.skipQa = true;
    else if (a === "--acknowledge-scale") out.acknowledgeScale = true;
    else if (a === "--i-have-audited") out.iHaveAudited = true;
    else if (a.startsWith("--audit-report=")) out.auditReport = a.slice(15);
    else if (a === "--help" || a === "-h") {
      printHelp();
      exit(0);
    }
  }
  return out;
}

function printHelp() {
  console.log(`batch: CSV → outlines → expand → QA, end-to-end

Usage:
  batch --csv=topics.csv [options]

Options:
  --csv=PATH                Topic CSV (required)
  --config=PATH             Path to seo-blog.config.json
  --concurrency=N           Parallel LLM calls (default: 4)
  --skip-expand             Only generate outlines, skip LLM step
  --skip-qa                 Skip QA pass at end
  --acknowledge-scale       Required for >100 posts
  --i-have-audited          Required for >500 posts
  --audit-report=PATH       Required with --i-have-audited
  --help, -h                Show this message
`);
}

function runScript(scriptPath, args) {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [scriptPath, ...args], { stdio: "inherit" });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${path.basename(scriptPath)} exited with code ${code}`));
    });
    child.on("error", reject);
  });
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

  // Quality gate: count rows, check thresholds
  const csvText = await readFile(args.csv, "utf8");
  const { records } = parseCsv(csvText);
  runQualityGate(records.length, config.safety, {
    acknowledgeScale: args.acknowledgeScale,
    iHaveAudited: args.iHaveAudited,
    auditReport: args.auditReport,
  });

  console.log(`\n=== Step 1/3: generate outlines ===\n`);
  const newOutlineArgs = [`--csv=${args.csv}`];
  if (args.config) newOutlineArgs.push(`--config=${args.config}`);
  await runScript(path.join(SCRIPT_DIR, "new-outline.mjs"), newOutlineArgs);

  if (args.skipExpand) {
    console.log("\n--- skipping expand step (--skip-expand) ---");
    return;
  }

  // Build glob of files to expand: contentDir/{locale}/{slug}.{ext} for each row
  const ext = config.output.format === "md" ? "md" : "mdx";
  const filesToExpand = records.map((r) =>
    path.join(
      projectRoot,
      config.site.contentDir,
      r.locale || config.site.defaultLocale,
      `${r.slug}.${ext}`,
    ),
  );

  console.log(`\n=== Step 2/3: expand ${filesToExpand.length} outlines ===\n`);
  const expandArgs = [`--concurrency=${args.concurrency}`, ...filesToExpand];
  if (args.config) expandArgs.unshift(`--config=${args.config}`);
  await runScript(path.join(SCRIPT_DIR, "expand.mjs"), expandArgs);

  if (args.skipQa) {
    console.log("\n--- skipping QA step (--skip-qa) ---");
    return;
  }

  console.log(`\n=== Step 3/3: QA ${filesToExpand.length} files ===\n`);
  const qaArgs = filesToExpand.slice();
  if (args.config) qaArgs.unshift(`--config=${args.config}`);
  await runScript(path.join(SCRIPT_DIR, "qa-check.mjs"), qaArgs);

  console.log(`\n✓ batch complete`);
}

main().catch((e) => {
  console.error(`Error: ${e.message}`);
  exit(1);
});
