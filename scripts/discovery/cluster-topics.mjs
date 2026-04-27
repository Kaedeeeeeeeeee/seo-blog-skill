#!/usr/bin/env node
// cluster-topics: take a list of titles/topics and cluster them via LLM.
//
// Usage:
//   node scripts/discovery/cluster-topics.mjs titles.tsv [--config=path] [--output=clusters.json]
//
// Input: TSV with at least a 'title' column (output of fetch-titles)
// Output: JSON like { "Cluster Name": ["title1", ...], ... }

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { argv, exit } from "node:process";
import { loadConfig } from "../lib/config.mjs";
import { callLLM, unwrap } from "../lib/llm.mjs";

function parseArgs(args) {
  const out = { input: null, config: null, output: null };
  for (const a of args) {
    if (a.startsWith("--config=")) out.config = a.slice(9);
    else if (a.startsWith("--output=")) out.output = a.slice(9);
    else if (a === "--help" || a === "-h") {
      console.log("cluster-topics: LLM-cluster topic titles\n\nUsage: cluster-topics titles.tsv [--config=path] [--output=clusters.json]");
      exit(0);
    } else if (!a.startsWith("--")) out.input = a;
  }
  return out;
}

async function main() {
  const args = parseArgs(argv.slice(2));
  if (!args.input) {
    console.error("Usage: cluster-topics titles.tsv");
    exit(1);
  }
  if (!existsSync(args.input)) {
    console.error(`Not found: ${args.input}`);
    exit(1);
  }
  const { config } = await loadConfig(args.config);

  const text = await readFile(args.input, "utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    console.error("Input is empty or has only header");
    exit(1);
  }
  const headers = lines[0].split("\t");
  const titleIdx = headers.indexOf("title");
  if (titleIdx === -1) {
    console.error("Input must have a 'title' column");
    exit(1);
  }
  const titles = lines.slice(1).map((l) => l.split("\t")[titleIdx]).filter(Boolean);

  console.warn(`Clustering ${titles.length} titles via ${config.llm.provider}/${config.llm.model}\n`);

  const system = `You are a topic clustering assistant. The user will paste a list of blog post titles. Group them into 5-15 thematic clusters. Each cluster should have a short descriptive name (in the language of the titles) and contain related titles.

Return STRICT JSON ONLY (no prose, no code fences):
{
  "ClusterName1": ["exact title 1", "exact title 2", ...],
  "ClusterName2": [...],
  ...
}

Use the exact titles from the input verbatim. Do not invent new titles.`;

  const user = `Cluster these ${titles.length} titles:\n\n${titles.map((t, i) => `${i + 1}. ${t}`).join("\n")}`;

  const result = await callLLM(config, { system, user });
  const cleaned = unwrap(result.text);

  let clusters;
  try {
    // Strip any leading non-JSON
    const jsonStart = cleaned.indexOf("{");
    const jsonEnd = cleaned.lastIndexOf("}");
    clusters = JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1));
  } catch (e) {
    console.error(`Failed to parse LLM output as JSON: ${e.message}`);
    console.error(`Raw output:\n${cleaned}`);
    exit(1);
  }

  console.warn(`✓ ${Object.keys(clusters).length} clusters, $${result.costUSD.toFixed(4)}\n`);
  for (const [name, items] of Object.entries(clusters)) {
    console.warn(`  ${name} (${items.length})`);
  }

  const json = JSON.stringify(clusters, null, 2);
  if (args.output) {
    await writeFile(args.output, json + "\n");
    console.warn(`\nWrote ${args.output}`);
  } else {
    console.log(json);
  }
}

main().catch((e) => {
  console.error(`Error: ${e.message}`);
  exit(1);
});
