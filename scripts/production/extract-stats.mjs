#!/usr/bin/env node
// extract-stats: pull statistics from a configured data source so they can
// be embedded into key_facts of a topic CSV.
//
// V1 supports the `jq` adapter (queries against a JSON file).
// Future: SQL adapter, REST adapter, custom Node module adapter.
//
// Usage:
//   node scripts/production/extract-stats.mjs \
//     --source=path/to/data.json \
//     --queries=queries.json \
//     [--output=stats.csv]
//
// queries.json format:
// {
//   "queries": [
//     { "label": "AI 出題数", "jq": "[.[] | select(.year==2025) | select(.question | contains(\"AI\"))] | length" }
//   ]
// }

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { argv, exit } from "node:process";

function parseArgs(args) {
  const out = { source: null, queries: null, output: null };
  for (const a of args) {
    if (a.startsWith("--source=")) out.source = a.slice(9);
    else if (a.startsWith("--queries=")) out.queries = a.slice(10);
    else if (a.startsWith("--output=")) out.output = a.slice(9);
    else if (a === "--help" || a === "-h") {
      printHelp();
      exit(0);
    }
  }
  return out;
}

function printHelp() {
  console.log(`extract-stats: extract stats from data source via jq

Usage:
  extract-stats --source=data.json --queries=queries.json [--output=stats.csv]

Adapter: jq (JSON file). Future adapters: SQL, REST, custom module.

queries.json schema:
  { "queries": [ { "label": "...", "jq": "..." } ] }
`);
}

function runJq(source, query) {
  const result = spawnSync("jq", [query, source], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`jq failed: ${result.stderr.trim()}`);
  }
  return result.stdout.trim();
}

async function main() {
  const args = parseArgs(argv.slice(2));
  if (!args.source || !args.queries) {
    printHelp();
    exit(1);
  }
  if (!existsSync(args.source)) {
    console.error(`Source not found: ${args.source}`);
    exit(1);
  }
  if (!existsSync(args.queries)) {
    console.error(`Queries file not found: ${args.queries}`);
    exit(1);
  }

  // Verify jq is installed
  const probe = spawnSync("jq", ["--version"], { encoding: "utf8" });
  if (probe.status !== 0) {
    console.error("jq is not installed. Install via `brew install jq` or your package manager.");
    exit(1);
  }

  const queriesData = JSON.parse(await readFile(args.queries, "utf8"));
  if (!Array.isArray(queriesData.queries)) {
    console.error("queries.json must have a 'queries' array");
    exit(1);
  }

  const rows = [["label", "value"]];
  for (const q of queriesData.queries) {
    try {
      const value = runJq(args.source, q.jq);
      rows.push([q.label, value]);
      console.log(`✓ ${q.label}: ${value}`);
    } catch (e) {
      console.error(`✗ ${q.label}: ${e.message}`);
    }
  }

  if (args.output) {
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    await writeFile(args.output, csv);
    console.log(`\nWrote ${args.output}`);
  }
}

main().catch((e) => {
  console.error(`Error: ${e.message}`);
  exit(1);
});
