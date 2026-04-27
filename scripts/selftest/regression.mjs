#!/usr/bin/env node
// Layer 3 regression test:
//   - Runs `new` on examples/it-passport-syllabus/topics.csv
//   - Compares generated outline structure to shipped output samples
//   - Pass criteria: ≥80% structural match (H2 set, internal links, frontmatter)
//
// Does NOT run `expand` (avoids real API calls + nondeterminism).
// To validate prose quality, run a manual expand pass + diff against shipped samples.

import { readFile, rm, mkdtemp, mkdir, writeFile, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { exit } from "node:process";
import { fileURLToPath } from "node:url";
import { parse as fmParse } from "../lib/frontmatter.mjs";
import { extractH2, extractInternalLinks } from "../lib/markdown-utils.mjs";

const SKILL_DIR = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const CLI = path.join(SKILL_DIR, "scripts", "cli.mjs");
const EXAMPLE_DIR = path.join(SKILL_DIR, "examples", "it-passport-syllabus");
const SHIPPED_DIR = path.join(EXAMPLE_DIR, "output-samples");

async function main() {
  // Sandbox: temporary project with the example config + CSV
  const sandbox = await mkdtemp(path.join(os.tmpdir(), "seo-blog-regression-"));
  console.log(`Sandbox: ${sandbox}\n`);

  // Copy config files into sandbox
  await copyFile(
    path.join(EXAMPLE_DIR, "seo-blog.config.json"),
    path.join(sandbox, "seo-blog.config.json"),
  );
  await copyFile(
    path.join(EXAMPLE_DIR, "style-guide.md"),
    path.join(sandbox, "style-guide.md"),
  );
  await copyFile(
    path.join(EXAMPLE_DIR, "topics.csv"),
    path.join(sandbox, "topics.csv"),
  );

  // Run `new` to generate skeleton outlines
  const r = spawnSync("node", [CLI, "new", "--csv=topics.csv"], {
    encoding: "utf8",
    cwd: sandbox,
  });
  if (r.status !== 0) {
    console.error(`✗ new-outline failed: ${r.stderr || r.stdout}`);
    await rm(sandbox, { recursive: true, force: true });
    exit(1);
  }

  // Compare generated outline structure to shipped samples
  const shippedFiles = (await readFile(SHIPPED_DIR + "/.").catch(() => null)) || null;
  // List shipped files manually
  const shipped = ["dx-toha", "saas-paas-iaas", "agile-scrum", "study-30min-daily", "reiwa7-analysis"];

  let totalScore = 0;
  let totalMax = 0;
  let perPostResults = [];

  for (const slug of shipped) {
    const generatedPath = path.join(sandbox, "content/blog/ja", `${slug}.mdx`);
    const shippedPath = path.join(SHIPPED_DIR, `${slug}.mdx`);
    if (!existsSync(generatedPath)) {
      console.log(`✗ ${slug}: generated file not found`);
      perPostResults.push({ slug, score: 0, max: 100, issues: ["not generated"] });
      totalMax += 100;
      continue;
    }
    if (!existsSync(shippedPath)) {
      console.log(`⊘ ${slug}: shipped sample not found, skipping`);
      continue;
    }

    const generated = await readFile(generatedPath, "utf8");
    const shippedContent = await readFile(shippedPath, "utf8");

    const result = compareStructure(generated, shippedContent);
    totalScore += result.score;
    totalMax += result.max;
    perPostResults.push({ slug, ...result });

    const pct = ((result.score / result.max) * 100).toFixed(1);
    const mark = result.score / result.max >= 0.8 ? "✓" : "✗";
    console.log(`${mark} ${slug}: ${pct}% (${result.score}/${result.max})`);
    if (result.issues.length > 0) {
      for (const i of result.issues) console.log(`    - ${i}`);
    }
  }

  await rm(sandbox, { recursive: true, force: true });

  const overallPct = ((totalScore / totalMax) * 100).toFixed(1);
  console.log(`\nOverall: ${overallPct}% (${totalScore}/${totalMax})`);

  if (totalScore / totalMax >= 0.8) {
    console.log("✓ Regression PASS (≥80% match)");
    exit(0);
  } else {
    console.log("✗ Regression FAIL (<80% match)");
    exit(1);
  }
}

function compareStructure(generated, shipped) {
  const issues = [];
  let score = 0;
  let max = 0;

  // 1. Frontmatter required fields present in generated (max 30)
  const gen = fmParse(generated);
  const ship = fmParse(shipped);

  max += 30;
  const requiredFields = ["title", "description", "date", "tags"];
  for (const f of requiredFields) {
    if (gen.data[f]) score += 7.5;
    else issues.push(`frontmatter missing: ${f}`);
  }

  // 2. H2 headings: generated should have ≥ 50% of shipped's H2 count (max 30)
  // (We expect generated to be a skeleton with template H2s, not all of shipped's
  // H2s — partial overlap is fine. The expand step adds the rest.)
  max += 30;
  const genH2 = extractH2(gen.content);
  const shipH2 = extractH2(ship.content);
  if (genH2.length >= 3) score += 15;
  else issues.push(`only ${genH2.length} H2 in generated (expected ≥3)`);
  if (genH2.length >= shipH2.length * 0.5) score += 15;
  else issues.push(`H2 count too low vs shipped (${genH2.length} vs ${shipH2.length})`);

  // 3. Internal links: at least 1 internal link in generated (max 20)
  max += 20;
  const genLinks = extractInternalLinks(gen.content);
  const shipLinks = extractInternalLinks(ship.content);
  if (genLinks.length >= 1) score += 10;
  else issues.push("no internal links in generated");
  if (genLinks.length >= Math.min(shipLinks.length, 2)) score += 10;
  else issues.push(`internal links count low (${genLinks.length} vs shipped ${shipLinks.length})`);

  // 4. status: draft set in generated (max 10)
  max += 10;
  if (gen.data.status === "draft") score += 10;
  else issues.push("status: draft not set on generated");

  // 5. tags array (max 10)
  max += 10;
  if (Array.isArray(gen.data.tags) && gen.data.tags.length > 0) score += 10;
  else issues.push("tags array empty/missing");

  return { score, max, issues };
}

main().catch((e) => {
  console.error(`Error: ${e.message}`);
  exit(1);
});
