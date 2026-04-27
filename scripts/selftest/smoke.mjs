#!/usr/bin/env node
// Layer 1 smoke test:
//   - cli.mjs --help works
//   - each subcommand --help works
//   - empty CSV → graceful error
//   - missing config → graceful error
//
// Exits 0 on pass, 1 on fail. No external dependencies (no API calls).

import { spawnSync } from "node:child_process";
import { writeFileSync, rmSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { exit } from "node:process";
import { fileURLToPath } from "node:url";

const SKILL_DIR = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const CLI = path.join(SKILL_DIR, "scripts", "cli.mjs");
const TMP = path.join(SKILL_DIR, ".test-output", "smoke");

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

function run(args, opts = {}) {
  return spawnSync("node", [CLI, ...args], {
    encoding: "utf8",
    cwd: opts.cwd || SKILL_DIR,
    env: { ...process.env, ...(opts.env || {}) },
  });
}

test("cli --help shows commands", () => {
  const r = run(["--help"]);
  if (r.status !== 0) throw new Error(`exit ${r.status}: ${r.stderr}`);
  if (!/Commands:/.test(r.stdout)) throw new Error("no 'Commands:' in output");
});

test("cli (no args) shows help and exits 0", () => {
  const r = run([]);
  if (r.status !== 0) throw new Error(`exit ${r.status}`);
  if (!/Commands:/.test(r.stdout)) throw new Error("no help shown");
});

test("cli unknown-command exits 1", () => {
  const r = run(["nonexistent-command"]);
  if (r.status !== 1) throw new Error(`expected exit 1, got ${r.status}`);
});

const subcommands = ["init", "new", "expand", "qa", "batch", "extract-stats", "discover", "pre-flight"];
for (const cmd of subcommands) {
  test(`cli ${cmd} --help works`, () => {
    const r = run([cmd, "--help"]);
    if (r.status !== 0) throw new Error(`exit ${r.status}: ${r.stderr || r.stdout}`);
  });
}

test("new without --csv exits 1", () => {
  const r = run(["new"]);
  if (r.status !== 1) throw new Error(`expected exit 1, got ${r.status}`);
});

test("expand with no files exits 1", () => {
  const r = run(["expand"]);
  if (r.status !== 1) throw new Error(`expected exit 1, got ${r.status}`);
});

test("missing config → graceful error", () => {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
  writeFileSync(path.join(TMP, "topics.csv"), "slug,locale,title\n");
  const r = run(["new", "--csv=topics.csv"], { cwd: TMP });
  if (r.status !== 1) throw new Error(`expected exit 1, got ${r.status}`);
  if (!/seo-blog\.config\.json not found/.test(r.stderr + r.stdout)) {
    throw new Error(`expected friendly error, got: ${r.stderr || r.stdout}`);
  }
  rmSync(TMP, { recursive: true, force: true });
});

let passed = 0;
let failed = 0;
for (const t of tests) {
  try {
    t.fn();
    console.log(`✓ ${t.name}`);
    passed++;
  } catch (e) {
    console.log(`✗ ${t.name}\n    ${e.message}`);
    failed++;
  }
}

console.log(`\n${passed}/${tests.length} passed`);
exit(failed === 0 ? 0 : 1);
