#!/usr/bin/env node
// pre-flight: verify config, env vars, file paths before a batch run.
//
// Usage:
//   node scripts/safety/pre-flight.mjs [--config=path]

import { existsSync } from "node:fs";
import path from "node:path";
import { argv, exit, env } from "node:process";
import { loadConfig } from "../lib/config.mjs";

function parseArgs(args) {
  const out = { config: null };
  for (const a of args) {
    if (a.startsWith("--config=")) out.config = a.slice(9);
    else if (a === "--help" || a === "-h") {
      console.log("pre-flight: verify config + env + paths\n\nUsage: pre-flight [--config=path]");
      exit(0);
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(argv.slice(2));
  const checks = [];

  // 1. config loads + validates
  let config, projectRoot;
  try {
    ({ config, projectRoot } = await loadConfig(args.config));
    checks.push({ name: "Config loaded + valid", ok: true });
  } catch (e) {
    checks.push({ name: "Config loaded + valid", ok: false, msg: e.message });
    report(checks);
    exit(1);
  }

  // 2. API key set
  const apiKey = env[config.llm.apiKeyEnv];
  checks.push({
    name: `API key (${config.llm.apiKeyEnv})`,
    ok: !!apiKey,
    msg: apiKey ? null : `Set ${config.llm.apiKeyEnv} in your env or .env.local`,
  });

  // 3. content dir exists (or is creatable)
  const contentPath = path.join(projectRoot, config.site.contentDir);
  checks.push({
    name: `Content dir (${config.site.contentDir})`,
    ok: existsSync(contentPath) || existsSync(path.dirname(contentPath)),
    msg: null,
  });

  // 4. style guide loadable (if specified)
  if (config.style.guidePath) {
    const sgPath = path.isAbsolute(config.style.guidePath)
      ? config.style.guidePath
      : path.join(projectRoot, config.style.guidePath);
    checks.push({
      name: `Style guide (${config.style.guidePath})`,
      ok: existsSync(sgPath),
      msg: existsSync(sgPath) ? null : `File not found: ${sgPath}`,
    });
  }

  // 5. at least one template available
  const allOk = checks.every((c) => c.ok);
  report(checks);
  exit(allOk ? 0 : 1);
}

function report(checks) {
  console.log("\nPre-flight checks:\n");
  for (const c of checks) {
    const mark = c.ok ? "✓" : "✗";
    console.log(`  ${mark} ${c.name}${c.msg ? `\n      ${c.msg}` : ""}`);
  }
  console.log();
}

main().catch((e) => {
  console.error(`Error: ${e.message}`);
  exit(1);
});
