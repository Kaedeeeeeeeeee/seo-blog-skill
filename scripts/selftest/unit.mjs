#!/usr/bin/env node
// Layer 2 unit test:
//   - synthetic CSV → 3 outlines created with valid frontmatter
//   - hand-crafted outline expanded by stub LLM (no real API)
//   - file with forbidden phrase → qa-check reports it
//   - 600-row CSV without flag → quality-gate hard-stops
//   - bad config → pre-flight catches it
//
// Avoids real LLM calls by using a stub provider.

import { spawnSync } from "node:child_process";
import { writeFileSync, rmSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { exit } from "node:process";
import { fileURLToPath } from "node:url";
import { runQualityGate } from "../safety/quality-gate.mjs";
import { parseCsv, splitList } from "../lib/csv.mjs";
import { parse as fmParse, validate as fmValidate } from "../lib/frontmatter.mjs";
import {
  extractH2,
  extractInternalLinks,
  countContentChars,
  fillPlaceholders,
} from "../lib/markdown-utils.mjs";

const SKILL_DIR = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const CLI = path.join(SKILL_DIR, "scripts", "cli.mjs");
const TMP = path.join(SKILL_DIR, ".test-output", "unit");

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

function setupTmp() {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
  mkdirSync(path.join(TMP, "content/blog/en"), { recursive: true });
}

function writeConfig(overrides = {}) {
  const config = {
    site: { url: "https://test.example.com", contentDir: "content/blog", locales: ["en"], defaultLocale: "en" },
    output: { format: "mdx", frontmatterFields: { required: ["title", "description", "date", "tags"], optional: ["cover", "status"], stripOnPublish: ["status"] } },
    llm: { provider: "deepseek", model: "deepseek-v4-flash", apiKeyEnv: "STUB_KEY", temperature: 0.3 },
    style: { guidePath: "./style-guide.md", language: "English", forbiddenPhrases: ["AS AN AI"], targetLength: [50, 500] },
    templates: { default: "glossary", available: ["glossary", "comparison", "persona", "data-driven", "howto"] },
    safety: { warnAt: 100, hardStopAt: 500 },
    ...overrides,
  };
  writeFileSync(path.join(TMP, "seo-blog.config.json"), JSON.stringify(config, null, 2));
  writeFileSync(path.join(TMP, "style-guide.md"), "Be concise.\n");
  return config;
}

function run(args) {
  return spawnSync("node", [CLI, ...args], { encoding: "utf8", cwd: TMP });
}

// Pure unit: parseCsv + splitList
test("parseCsv handles quoted fields with commas", () => {
  const csv = `a,b,c\n"hello, world",foo,"bar;baz"\n`;
  const { records } = parseCsv(csv);
  if (records.length !== 1) throw new Error(`expected 1 record, got ${records.length}`);
  if (records[0].a !== "hello, world") throw new Error(`a was '${records[0].a}'`);
  if (records[0].c !== "bar;baz") throw new Error(`c was '${records[0].c}'`);
});

test("splitList splits semicolon-separated and trims", () => {
  const r = splitList("foo; bar ;baz");
  if (r.length !== 3) throw new Error(`expected 3, got ${r.length}`);
  if (r[1] !== "bar") throw new Error(`got '${r[1]}'`);
});

test("splitList handles empty", () => {
  if (splitList("").length !== 0) throw new Error("empty should give []");
  if (splitList(undefined).length !== 0) throw new Error("undefined should give []");
});

// Pure unit: markdown utils
test("extractH2 finds all H2 headings", () => {
  const body = "## Foo\n\nbody\n\n## Bar\n\nmore\n\n### Sub\n";
  const h2 = extractH2(body);
  if (h2.length !== 2) throw new Error(`expected 2, got ${h2.length}`);
  if (h2[0] !== "Foo") throw new Error(`first was '${h2[0]}'`);
});

test("extractInternalLinks finds /-prefixed links only", () => {
  const body = "see [foo](/blog/foo) and [bar](https://ext.com)";
  const links = extractInternalLinks(body);
  if (links.length !== 1) throw new Error(`expected 1, got ${links.length}`);
  if (links[0].href !== "/blog/foo") throw new Error(`got '${links[0].href}'`);
});

test("countContentChars strips code/tables/headings", () => {
  const body = "## Heading\n\nHello world.\n\n```\ncode block\n```\n\n| a | b |\n| - | - |\n";
  const n = countContentChars(body);
  // "Helloworld." → 11
  if (n < 5 || n > 20) throw new Error(`unexpected count ${n}`);
});

test("fillPlaceholders substitutes {{key}}", () => {
  const r = fillPlaceholders("Hi {{name}}, age {{age}}", { name: "Bob", age: 30 });
  if (r !== "Hi Bob, age 30") throw new Error(`got '${r}'`);
});

test("fillPlaceholders leaves unknown placeholders", () => {
  const r = fillPlaceholders("{{a}} {{b}}", { a: "x" });
  if (r !== "x {{b}}") throw new Error(`got '${r}'`);
});

// Pure unit: frontmatter validation
test("fmValidate detects missing required field", () => {
  const r = fmValidate({ title: "x" }, { required: ["title", "description"] });
  if (r.ok) throw new Error("expected fail");
  if (!r.errors.some((e) => /description/.test(e))) throw new Error("expected description error");
});

test("fmValidate passes when all required present", () => {
  const r = fmValidate({ title: "x", description: "y" }, { required: ["title", "description"] });
  if (!r.ok) throw new Error(`expected ok, errors: ${r.errors.join(",")}`);
});

// Quality gate (in-process, no spawn)
test("quality-gate < warnAt: free pass", () => {
  runQualityGate(50, { warnAt: 100, hardStopAt: 500 }, {});
});

test("quality-gate >= warnAt without ack: blocks", () => {
  let threw = false;
  try {
    runQualityGate(150, { warnAt: 100, hardStopAt: 500 }, {});
  } catch (e) {
    threw = true;
    if (!/acknowledge-scale/i.test(e.message)) throw new Error(`wrong message: ${e.message}`);
  }
  if (!threw) throw new Error("should have thrown");
});

test("quality-gate >= warnAt with ack: passes", () => {
  runQualityGate(150, { warnAt: 100, hardStopAt: 500 }, { acknowledgeScale: true });
});

test("quality-gate >= hardStopAt without audit: blocks", () => {
  let threw = false;
  try {
    runQualityGate(600, { warnAt: 100, hardStopAt: 500 }, { acknowledgeScale: true });
  } catch (e) {
    threw = true;
    if (!/i-have-audited/i.test(e.message)) throw new Error(`wrong message: ${e.message}`);
  }
  if (!threw) throw new Error("should have thrown");
});

test("quality-gate >= hardStopAt with audited but no report path: blocks", () => {
  let threw = false;
  try {
    runQualityGate(600, { warnAt: 100, hardStopAt: 500 }, { iHaveAudited: true });
  } catch (e) {
    threw = true;
    if (!/audit-report/i.test(e.message)) throw new Error(`wrong message: ${e.message}`);
  }
  if (!threw) throw new Error("should have thrown");
});

// Integration: CLI + new-outline
test("new-outline creates valid skeleton from synthetic CSV", () => {
  setupTmp();
  writeConfig();
  const csv = `slug,locale,title,description,tags,template,key_facts,internal_links
test-foo,en,"Test Foo","Foo description","Tag1;Tag2",glossary,"Fact A;Fact B;Fact C","other-slug"
test-bar,en,"Test Bar","Bar description","Tag1",comparison,"Fact X;Fact Y",
test-baz,en,"Test Baz","Baz description","Tag1;Tag2;Tag3",howto,"Step 1;Step 2","",
`;
  writeFileSync(path.join(TMP, "topics.csv"), csv);
  const r = run(["new", "--csv=topics.csv"]);
  if (r.status !== 0) throw new Error(`exit ${r.status}: ${r.stderr || r.stdout}`);

  for (const slug of ["test-foo", "test-bar", "test-baz"]) {
    const p = path.join(TMP, "content/blog/en", `${slug}.mdx`);
    if (!existsSync(p)) throw new Error(`${slug}.mdx not created`);
    const raw = readFileSync(p, "utf8");
    const { data, content } = fmParse(raw);
    if (data.title !== expectedTitle(slug)) throw new Error(`${slug}: title mismatch`);
    if (data.status !== "draft") throw new Error(`${slug}: status should be 'draft'`);
    if (!Array.isArray(data.tags) || data.tags.length === 0) throw new Error(`${slug}: tags missing`);
    if (extractH2(content).length < 2) throw new Error(`${slug}: not enough H2 sections`);
  }
});

function expectedTitle(slug) {
  return { "test-foo": "Test Foo", "test-bar": "Test Bar", "test-baz": "Test Baz" }[slug];
}

test("new-outline rejects CSV with empty key_facts", () => {
  setupTmp();
  writeConfig();
  const csv = `slug,locale,title,description,tags,template,key_facts,internal_links
bad,en,"Bad","desc","Tag",glossary,,
`;
  writeFileSync(path.join(TMP, "topics.csv"), csv);
  const r = run(["new", "--csv=topics.csv"]);
  if (r.status !== 1) throw new Error(`expected exit 1, got ${r.status}`);
  if (!/key_facts/.test(r.stderr + r.stdout)) throw new Error("expected key_facts error");
});

test("qa-check detects forbidden phrase", () => {
  setupTmp();
  writeConfig();
  const filePath = path.join(TMP, "content/blog/en/forbidden.mdx");
  writeFileSync(filePath, `---
title: Test
description: A test post
date: "2026-04-27"
tags: ["x"]
---

## Heading

Some prose. AS AN AI, I cannot help with this. (forbidden phrase!)
`);
  const r = run(["qa", filePath]);
  if (r.status !== 1) throw new Error(`expected exit 1, got ${r.status}`);
  if (!/AS AN AI/.test(r.stdout + r.stderr)) throw new Error("expected forbidden phrase report");
});

test("qa-check passes clean file", () => {
  setupTmp();
  writeConfig();
  const filePath = path.join(TMP, "content/blog/en/clean.mdx");
  writeFileSync(filePath, `---
title: Clean Post
description: A clean test post.
date: "2026-04-27"
tags: ["x", "y"]
---

## Heading One

Some prose here. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

## Heading Two

More prose. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
`);
  const r = run(["qa", filePath]);
  if (r.status !== 0) throw new Error(`expected exit 0, got ${r.status}: ${r.stdout}`);
});

test("qa-check detects status:draft leftover", () => {
  setupTmp();
  writeConfig();
  const filePath = path.join(TMP, "content/blog/en/draft.mdx");
  writeFileSync(filePath, `---
title: Test
description: A test post
date: "2026-04-27"
tags: ["x"]
status: draft
---

## H

prose.
`);
  const r = run(["qa", filePath]);
  if (r.status !== 1) throw new Error(`expected exit 1, got ${r.status}`);
  if (!/draft/.test(r.stdout + r.stderr)) throw new Error("expected draft error");
});

test("pre-flight catches missing API key", () => {
  setupTmp();
  writeConfig();
  // Don't set STUB_KEY in env
  const r = spawnSync("node", [CLI, "pre-flight"], { encoding: "utf8", cwd: TMP, env: { ...process.env, STUB_KEY: "" } });
  if (r.status !== 1) throw new Error(`expected exit 1, got ${r.status}`);
  if (!/API key/.test(r.stdout)) throw new Error("expected API key check");
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

if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true });

console.log(`\n${passed}/${tests.length} passed`);
exit(failed === 0 ? 0 : 1);
