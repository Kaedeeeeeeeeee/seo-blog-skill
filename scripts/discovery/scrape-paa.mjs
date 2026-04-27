#!/usr/bin/env node
// scrape-paa: scrape Google "People Also Ask" suggestions for a query.
//
// NOTE: This uses Google's public search results page. Heavy use will get
// IPs throttled or temporarily blocked. Use responsibly: low volume,
// rate-limit yourself, consider rotating User-Agents. For production
// volume, use a paid API (DataForSEO, SerpAPI).
//
// Usage:
//   node scripts/discovery/scrape-paa.mjs "search query" [--lang=ja] [--output=paa.txt]

import { writeFile } from "node:fs/promises";
import { argv, exit } from "node:process";

const PAA_QUESTION_RE = /<div[^>]*role=["']heading["'][^>]*>([^<]+)<\/div>/g;

function parseArgs(args) {
  const out = { query: null, lang: "en", output: null };
  for (const a of args) {
    if (a.startsWith("--lang=")) out.lang = a.slice(7);
    else if (a.startsWith("--output=")) out.output = a.slice(9);
    else if (a === "--help" || a === "-h") {
      console.log(`scrape-paa: extract Google People-Also-Ask questions

Usage: scrape-paa "query" [--lang=ja] [--output=paa.txt]

Note: low-volume use only. Use a paid API for scale.`);
      exit(0);
    } else if (!a.startsWith("--")) out.query = a;
  }
  return out;
}

async function fetchPAA(query, lang) {
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=${lang}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      "Accept-Language": `${lang},en;q=0.9`,
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  // Multiple patterns, Google's HTML structure changes often; this is a
  // best-effort scraper.
  const questions = new Set();
  for (const match of html.matchAll(PAA_QUESTION_RE)) {
    const q = match[1].trim();
    if (q.length > 5 && q.length < 200 && /[?？]/.test(q)) questions.add(q);
  }
  return [...questions];
}

async function main() {
  const args = parseArgs(argv.slice(2));
  if (!args.query) {
    console.error('Usage: scrape-paa "search query" [--lang=ja]');
    exit(1);
  }

  console.warn(`→ "${args.query}" (lang=${args.lang})`);
  let questions;
  try {
    questions = await fetchPAA(args.query, args.lang);
  } catch (e) {
    console.error(`Error: ${e.message}`);
    exit(1);
  }

  if (questions.length === 0) {
    console.warn(
      "⊘ No PAA found. Possible reasons: query has no PAA box, Google changed HTML, " +
        "or you've been rate-limited. Try a paid API for reliable results.",
    );
  } else {
    console.warn(`Found ${questions.length} questions`);
  }

  if (args.output) {
    await writeFile(args.output, questions.join("\n") + "\n");
    console.warn(`Wrote ${args.output}`);
  } else {
    for (const q of questions) console.log(q);
  }
}

main().catch((e) => {
  console.error(`Error: ${e.message}`);
  exit(1);
});
