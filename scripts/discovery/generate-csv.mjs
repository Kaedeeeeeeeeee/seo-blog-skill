#!/usr/bin/env node
// generate-csv: orchestrates the full discovery pipeline.
//   1. fetch-sitemap    on each competitor URL → urls.txt
//   2. fetch-titles     → titles.tsv
//   3. cluster-topics   → clusters.json
//   4. gap-analysis     vs our sitemap → gaps.tsv
//   5. merge into raw-topics.csv ready for human curation
//
// Usage:
//   node scripts/discovery/generate-csv.mjs \
//     --competitors=competitors.txt \
//     --our-sitemap=https://my-site.com/sitemap.xml \
//     --output=raw-topics.csv \
//     [--config=path] [--workdir=./.discovery] [--max-titles=200]

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { argv, exit } from "node:process";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../lib/config.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(args) {
  const out = {
    competitors: null,
    ourSitemap: null,
    output: "raw-topics.csv",
    workdir: ".discovery",
    maxTitles: 200,
    config: null,
  };
  for (const a of args) {
    if (a.startsWith("--competitors=")) out.competitors = a.slice(14);
    else if (a.startsWith("--our-sitemap=")) out.ourSitemap = a.slice(14);
    else if (a.startsWith("--output=")) out.output = a.slice(9);
    else if (a.startsWith("--workdir=")) out.workdir = a.slice(10);
    else if (a.startsWith("--max-titles=")) out.maxTitles = parseInt(a.slice(13), 10);
    else if (a.startsWith("--config=")) out.config = a.slice(9);
    else if (a === "--help" || a === "-h") {
      printHelp();
      exit(0);
    }
  }
  return out;
}

function printHelp() {
  console.log(`discover: full competitor research pipeline

Usage:
  discover --competitors=competitors.txt --our-sitemap=URL [options]

Options:
  --competitors=PATH  File with competitor sitemap URLs (one per line)
  --our-sitemap=URL   URL of our own sitemap.xml (for gap analysis)
  --output=PATH       Output CSV (default: raw-topics.csv)
  --workdir=PATH      Working directory for intermediate files (default: .discovery)
  --max-titles=N      Cap titles fetched per competitor (default: 200)
  --config=PATH       Path to seo-blog.config.json
  --help, -h          Show this message
`);
}

function runScript(scriptPath, args) {
  const r = spawnSync("node", [scriptPath, ...args], { stdio: "inherit" });
  if (r.status !== 0) throw new Error(`${path.basename(scriptPath)} failed (exit ${r.status})`);
}

async function main() {
  const args = parseArgs(argv.slice(2));
  if (!args.competitors) {
    printHelp();
    exit(1);
  }
  if (!existsSync(args.competitors)) {
    console.error(`Not found: ${args.competitors}`);
    exit(1);
  }

  // Validate config exists (we'll use it for cluster-topics)
  await loadConfig(args.config);

  await mkdir(args.workdir, { recursive: true });

  const competitorUrls = (await readFile(args.competitors, "utf8"))
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith("#"));

  console.error(`\n=== Step 1/4: fetch-sitemap from ${competitorUrls.length} competitors ===\n`);
  const urlsPath = path.join(args.workdir, "urls.txt");
  runScript(path.join(SCRIPT_DIR, "fetch-sitemap.mjs"), [`--output=${urlsPath}`, ...competitorUrls]);

  // Cap to max-titles to stay polite
  const allUrls = (await readFile(urlsPath, "utf8")).split(/\r?\n/).filter(Boolean);
  const sample = allUrls.slice(0, args.maxTitles);
  await writeFile(urlsPath, sample.join("\n") + "\n");
  console.error(`(sampled ${sample.length} of ${allUrls.length} URLs)`);

  console.error(`\n=== Step 2/4: fetch-titles ===\n`);
  const titlesPath = path.join(args.workdir, "titles.tsv");
  runScript(path.join(SCRIPT_DIR, "fetch-titles.mjs"), [urlsPath, `--output=${titlesPath}`, "--concurrency=4"]);

  console.error(`\n=== Step 3/4: cluster-topics ===\n`);
  const clustersPath = path.join(args.workdir, "clusters.json");
  const clusterArgs = [titlesPath, `--output=${clustersPath}`];
  if (args.config) clusterArgs.push(`--config=${args.config}`);
  runScript(path.join(SCRIPT_DIR, "cluster-topics.mjs"), clusterArgs);

  let gapsPath = null;
  if (args.ourSitemap) {
    console.error(`\n=== Step 4/4: gap-analysis ===\n`);
    gapsPath = path.join(args.workdir, "gaps.tsv");
    runScript(path.join(SCRIPT_DIR, "gap-analysis.mjs"), [
      `--competitor-titles=${titlesPath}`,
      `--our-sitemap=${args.ourSitemap}`,
      `--output=${gapsPath}`,
    ]);
  } else {
    console.error("(skipping gap-analysis: no --our-sitemap)");
  }

  // Merge: titles + clusters + gap_score → raw-topics.csv
  console.error(`\n=== Merging into ${args.output} ===\n`);
  const titles = (await readFile(titlesPath, "utf8")).split(/\r?\n/).filter(Boolean);
  const titleHeaders = titles[0].split("\t");
  const titleRecords = titles.slice(1).map((l) => {
    const cols = l.split("\t");
    return Object.fromEntries(titleHeaders.map((h, i) => [h, cols[i] ?? ""]));
  });

  const clusters = JSON.parse(await readFile(clustersPath, "utf8"));
  const titleToCluster = new Map();
  for (const [name, items] of Object.entries(clusters)) {
    for (const t of items) titleToCluster.set(t, name);
  }

  let gapMap = new Map();
  if (gapsPath) {
    const gapLines = (await readFile(gapsPath, "utf8")).split(/\r?\n/).filter(Boolean);
    const gapHeaders = gapLines[0].split("\t");
    const titleIdx = gapHeaders.indexOf("candidate_title");
    const scoreIdx = gapHeaders.indexOf("gap_score");
    for (const line of gapLines.slice(1)) {
      const cols = line.split("\t");
      gapMap.set(cols[titleIdx], cols[scoreIdx]);
    }
  }

  const rows = [["candidate_title", "competitor_url", "h2_structure", "gap_score", "suggested_cluster"].map(csvEscape).join(",")];
  for (const r of titleRecords) {
    const cluster = titleToCluster.get(r.title) || "";
    const gap = gapMap.get(r.title) || "";
    rows.push([r.title, r.url, r.headings, gap, cluster].map(csvEscape).join(","));
  }
  await writeFile(args.output, rows.join("\n") + "\n");

  console.error(`\n✓ ${rows.length - 1} candidates → ${args.output}`);
  console.error(`\nNext steps:`);
  console.error(`  1. Open ${args.output}, review and select rows worth writing`);
  console.error(`  2. Add columns to a new topics.csv: slug, locale, title, description, tags, template, key_facts, internal_links`);
  console.error(`  3. Fill key_facts column (your domain expertise — this is the irreplaceable part)`);
  console.error(`  4. Run: seo-blog batch --csv=topics.csv\n`);
}

function csvEscape(v) {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

main().catch((e) => {
  console.error(`Error: ${e.message}`);
  exit(1);
});
