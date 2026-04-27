#!/usr/bin/env node
// fetch-sitemap: download a sitemap.xml (or sitemap index), recursively
// expand sitemap-of-sitemaps, and emit the URL list.
//
// Usage:
//   node scripts/discovery/fetch-sitemap.mjs <sitemap-url> [<sitemap-url>...]
//   node scripts/discovery/fetch-sitemap.mjs --output=urls.txt <sitemap-url>

import { writeFile } from "node:fs/promises";
import { argv, exit } from "node:process";

const URL_RE = /<loc>([^<]+)<\/loc>/g;
const SITEMAP_INDEX_RE = /<sitemapindex/i;

function parseArgs(args) {
  const out = { output: null, urls: [] };
  for (const a of args) {
    if (a.startsWith("--output=")) out.output = a.slice(9);
    else if (a === "--help" || a === "-h") {
      printHelp();
      exit(0);
    } else out.urls.push(a);
  }
  return out;
}

function printHelp() {
  console.log(`fetch-sitemap: get URL list from sitemap.xml

Usage:
  fetch-sitemap [--output=urls.txt] <sitemap-url> [<sitemap-url>...]
`);
}

async function fetchOne(url) {
  const res = await fetch(url, { headers: { "User-Agent": "seo-blog-skill/0.1" } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return await res.text();
}

async function expandSitemap(url, depth = 0) {
  if (depth > 3) {
    console.warn(`⊘ depth limit at ${url}`);
    return [];
  }
  let xml;
  try {
    xml = await fetchOne(url);
  } catch (e) {
    console.warn(`✗ ${url}: ${e.message}`);
    return [];
  }
  const urls = [...xml.matchAll(URL_RE)].map((m) => m[1].trim());
  if (SITEMAP_INDEX_RE.test(xml)) {
    // Recurse into each sub-sitemap
    const collected = [];
    for (const sub of urls) {
      collected.push(...(await expandSitemap(sub, depth + 1)));
    }
    return collected;
  }
  return urls;
}

async function main() {
  const args = parseArgs(argv.slice(2));
  if (args.urls.length === 0) {
    printHelp();
    exit(1);
  }

  const all = [];
  for (const u of args.urls) {
    console.warn(`→ ${u}`);
    const urls = await expandSitemap(u);
    console.warn(`  ${urls.length} URLs`);
    all.push(...urls);
  }
  const unique = [...new Set(all)];
  console.warn(`\n${unique.length} unique URLs (${all.length} total)`);

  if (args.output) {
    await writeFile(args.output, unique.join("\n") + "\n");
    console.warn(`Wrote ${args.output}`);
  } else {
    for (const u of unique) console.log(u);
  }
}

main().catch((e) => {
  console.error(`Error: ${e.message}`);
  exit(1);
});
