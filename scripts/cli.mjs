#!/usr/bin/env node
// Single CLI entry point. Dispatches to subcommand scripts.
//
// Usage: seo-blog <command> [...args]

import { spawn } from "node:child_process";
import path from "node:path";
import { argv, exit } from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

const COMMANDS = {
  init: { script: "production/init.mjs", desc: "Bootstrap config + style-guide + topics.csv in current dir" },
  new: { script: "production/new-outline.mjs", desc: "CSV → skeleton MDX outlines" },
  expand: { script: "production/expand.mjs", desc: "Skeleton MDX → prosed MDX via LLM" },
  qa: { script: "production/qa-check.mjs", desc: "Validate MDX files for publication" },
  batch: { script: "production/batch.mjs", desc: "End-to-end: new + expand + qa" },
  "extract-stats": { script: "production/extract-stats.mjs", desc: "Pull stats from data source via jq" },
  discover: { script: "discovery/generate-csv.mjs", desc: "Competitor research → raw-topics.csv" },
  "pre-flight": { script: "safety/pre-flight.mjs", desc: "Verify config + env + paths" },
};

function printHelp() {
  console.log(`seo-blog: outline-driven multilingual blog generator

Usage:
  seo-blog <command> [...args]
  seo-blog <command> --help

Commands:`);
  for (const [name, { desc }] of Object.entries(COMMANDS)) {
    console.log(`  ${name.padEnd(15)} ${desc}`);
  }
  console.log(`
Examples:
  seo-blog init
  seo-blog batch --csv=topics.csv --concurrency=4
  seo-blog discover --competitors=competitors.txt --our-sitemap=...

Documentation: https://github.com/Kaedeeeeeeeeee/seo-blog-skill
`);
}

const args = argv.slice(2);
if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
  printHelp();
  exit(0);
}

const cmd = args[0];
const cmdInfo = COMMANDS[cmd];
if (!cmdInfo) {
  console.error(`Unknown command: ${cmd}\n`);
  printHelp();
  exit(1);
}

const child = spawn("node", [path.join(SCRIPT_DIR, cmdInfo.script), ...args.slice(1)], {
  stdio: "inherit",
});
child.on("close", (code) => exit(code ?? 0));
child.on("error", (e) => {
  console.error(`Failed to launch ${cmd}: ${e.message}`);
  exit(1);
});
