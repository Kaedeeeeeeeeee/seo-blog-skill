#!/usr/bin/env node
// fetch-titles: for a list of URLs, fetch each page and extract:
//   - <title>
//   - <meta name="description">
//   - <h1> / <h2> headings
//
// Output: TSV (tab-separated) for pipeline use.
//
// Usage:
//   node scripts/discovery/fetch-titles.mjs urls.txt [--concurrency=5] [--output=titles.tsv]

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { argv, exit } from "node:process";
import { runPool } from "../lib/pool.mjs";

const TITLE_RE = /<title[^>]*>([\s\S]*?)<\/title>/i;
const META_DESC_RE = /<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["']/i;
const META_DESC_RE2 = /<meta[^>]+content=["']([^"']+)["'][^>]*name=["']description["']/i;
const H_RE = /<h([12])[^>]*>([\s\S]*?)<\/h\1>/gi;

function decodeHtml(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseArgs(args) {
  const out = { input: null, concurrency: 5, output: null };
  for (const a of args) {
    if (a.startsWith("--concurrency=")) out.concurrency = parseInt(a.slice(14), 10);
    else if (a.startsWith("--output=")) out.output = a.slice(9);
    else if (a === "--help" || a === "-h") {
      console.log("fetch-titles: extract title/description/H1-H2 from URL list\n\nUsage: fetch-titles urls.txt [--concurrency=N] [--output=titles.tsv]");
      exit(0);
    } else if (!a.startsWith("--")) out.input = a;
  }
  return out;
}

async function fetchOne(url) {
  const res = await fetch(url, { headers: { "User-Agent": "seo-blog-skill/0.1" }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const title = decodeHtml(html.match(TITLE_RE)?.[1] ?? "");
  const desc = decodeHtml(html.match(META_DESC_RE)?.[1] ?? html.match(META_DESC_RE2)?.[1] ?? "");
  const headings = [...html.matchAll(H_RE)].map((m) => `H${m[1]}:${decodeHtml(m[2])}`).slice(0, 8);
  return { url, title, desc, headings: headings.join(" | ") };
}

async function main() {
  const args = parseArgs(argv.slice(2));
  if (!args.input) {
    console.error("Usage: fetch-titles urls.txt");
    exit(1);
  }
  if (!existsSync(args.input)) {
    console.error(`Not found: ${args.input}`);
    exit(1);
  }
  const urls = (await readFile(args.input, "utf8")).split(/\r?\n/).filter((l) => l.trim());

  console.warn(`Fetching ${urls.length} URLs (concurrency=${args.concurrency})\n`);
  const rows = [["url", "title", "desc", "headings"].join("\t")];
  const { ok, errors, wallSec } = await runPool(
    urls,
    args.concurrency,
    fetchOne,
    (r) => {
      rows.push([r.url, r.title, r.desc, r.headings].map((c) => c.replace(/\t/g, " ")).join("\t"));
    },
    (e, u) => console.warn(`✗ ${u}: ${e.message}`),
  );

  console.warn(`\n--- ${ok}/${urls.length} ok, ${wallSec.toFixed(1)}s ---`);

  if (args.output) {
    await writeFile(args.output, rows.join("\n") + "\n");
    console.warn(`Wrote ${args.output}`);
  } else {
    console.log(rows.join("\n"));
  }
}

main().catch((e) => {
  console.error(`Error: ${e.message}`);
  exit(1);
});
