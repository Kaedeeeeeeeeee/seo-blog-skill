#!/usr/bin/env node
// gap-analysis: compare competitor topics to our existing site, score each.
//
// Usage:
//   node scripts/discovery/gap-analysis.mjs \
//     --competitor-titles=comp-titles.tsv \
//     --our-sitemap=https://my-site.com/sitemap.xml \
//     [--output=gaps.tsv]

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { argv, exit } from "node:process";

function parseArgs(args) {
  const out = { competitorTitles: null, ourSitemap: null, ourTitles: null, output: null };
  for (const a of args) {
    if (a.startsWith("--competitor-titles=")) out.competitorTitles = a.slice(20);
    else if (a.startsWith("--our-sitemap=")) out.ourSitemap = a.slice(14);
    else if (a.startsWith("--our-titles=")) out.ourTitles = a.slice(13);
    else if (a.startsWith("--output=")) out.output = a.slice(9);
    else if (a === "--help" || a === "-h") {
      console.log(`gap-analysis: score competitor topics vs our coverage

Usage:
  gap-analysis --competitor-titles=comp.tsv \\
    (--our-sitemap=URL | --our-titles=ours.tsv) \\
    [--output=gaps.tsv]

Output columns: candidate_title, competitor_url, gap_score
gap_score 0.0 = we already cover; 1.0 = entirely uncovered
`);
      exit(0);
    }
  }
  return out;
}

const URL_RE = /<loc>([^<]+)<\/loc>/g;

async function fetchOurTopics({ ourSitemap, ourTitles }) {
  if (ourTitles) {
    const text = await readFile(ourTitles, "utf8");
    const lines = text.split(/\r?\n/).filter(Boolean);
    const headers = lines[0].split("\t");
    const titleIdx = headers.indexOf("title");
    return lines.slice(1).map((l) => l.split("\t")[titleIdx]).filter(Boolean);
  }
  if (ourSitemap) {
    const res = await fetch(ourSitemap);
    if (!res.ok) throw new Error(`Failed to fetch ${ourSitemap}: ${res.status}`);
    const xml = await res.text();
    // Just use the URLs as a topic proxy (slug-based)
    return [...xml.matchAll(URL_RE)].map((m) => slugFromUrl(m[1]));
  }
  return [];
}

function slugFromUrl(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? "";
  } catch {
    return "";
  }
}

function tokenize(s) {
  return new Set(
    String(s)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1),
  );
}

function jaccard(a, b) {
  const inter = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);
  if (union.size === 0) return 0;
  return inter.size / union.size;
}

async function main() {
  const args = parseArgs(argv.slice(2));
  if (!args.competitorTitles || (!args.ourSitemap && !args.ourTitles)) {
    console.error("Usage: gap-analysis --competitor-titles=comp.tsv (--our-sitemap=URL | --our-titles=ours.tsv)");
    exit(1);
  }
  if (!existsSync(args.competitorTitles)) {
    console.error(`Not found: ${args.competitorTitles}`);
    exit(1);
  }

  const ourTopics = await fetchOurTopics(args);
  const ourTokens = ourTopics.map(tokenize);
  console.warn(`Our coverage: ${ourTopics.length} topics`);

  const compText = await readFile(args.competitorTitles, "utf8");
  const compLines = compText.split(/\r?\n/).filter(Boolean);
  const compHeaders = compLines[0].split("\t");
  const titleIdx = compHeaders.indexOf("title");
  const urlIdx = compHeaders.indexOf("url");
  if (titleIdx === -1) {
    console.error("competitor input must have 'title' column");
    exit(1);
  }

  const rows = [["candidate_title", "competitor_url", "gap_score"].join("\t")];
  for (const line of compLines.slice(1)) {
    const cols = line.split("\t");
    const title = cols[titleIdx];
    const url = urlIdx >= 0 ? cols[urlIdx] : "";
    if (!title) continue;
    const tokens = tokenize(title);
    let maxOverlap = 0;
    for (const ot of ourTokens) {
      const score = jaccard(tokens, ot);
      if (score > maxOverlap) maxOverlap = score;
    }
    const gapScore = (1 - maxOverlap).toFixed(3);
    rows.push([title, url, gapScore].join("\t"));
  }

  console.warn(`Scored ${rows.length - 1} candidates\n`);

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
