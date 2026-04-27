// Config loader + validator for seo-blog.config.json.
//
// Resolves config from (in order):
//   1. --config=path/to/seo-blog.config.json (CLI flag)
//   2. ./seo-blog.config.json (host project root)
//   3. throws

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const REQUIRED_TOP_LEVEL = ["site", "output", "llm", "style", "templates", "safety"];

const DEFAULT_PROVIDERS = {
  deepseek: {
    endpoint: "https://api.deepseek.com/v1/chat/completions",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    pricing: { inputPerM: 0.14, outputPerM: 0.28 },
  },
  openai: {
    endpoint: "https://api.openai.com/v1/chat/completions",
    apiKeyEnv: "OPENAI_API_KEY",
    pricing: { inputPerM: 2.5, outputPerM: 10.0 }, // gpt-4o-mini varies
  },
  anthropic: {
    endpoint: "https://api.anthropic.com/v1/messages",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    pricing: { inputPerM: 3.0, outputPerM: 15.0 }, // sonnet varies
  },
  gemini: {
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models",
    apiKeyEnv: "GEMINI_API_KEY",
    pricing: { inputPerM: 0.075, outputPerM: 0.3 }, // flash varies
  },
};

/** Load config from explicit path or auto-discover in cwd. */
export async function loadConfig(explicitPath) {
  const configPath = explicitPath ?? findConfigPath();
  if (!configPath || !existsSync(configPath)) {
    throw new Error(
      `seo-blog.config.json not found. Run \`seo-blog init\` to create one, ` +
        `or pass --config=path/to/config.json.`,
    );
  }
  const raw = await readFile(configPath, "utf8");
  let config;
  try {
    config = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Failed to parse ${configPath}: ${e.message}`);
  }
  validateConfig(config, configPath);
  return { config, configPath, projectRoot: path.dirname(path.resolve(configPath)) };
}

function findConfigPath() {
  const candidates = [
    path.resolve("seo-blog.config.json"),
    path.resolve(".seo-blog.json"),
  ];
  return candidates.find((p) => existsSync(p));
}

function validateConfig(config, source) {
  const missing = REQUIRED_TOP_LEVEL.filter((k) => !(k in config));
  if (missing.length > 0) {
    throw new Error(
      `Config ${source} is missing required sections: ${missing.join(", ")}`,
    );
  }

  // site
  const { site } = config;
  if (!site.url) throw new Error("config.site.url is required");
  if (!site.contentDir) throw new Error("config.site.contentDir is required");
  if (!Array.isArray(site.locales) || site.locales.length === 0)
    throw new Error("config.site.locales must be a non-empty array");
  if (!site.defaultLocale) site.defaultLocale = site.locales[0];
  if (!site.locales.includes(site.defaultLocale))
    throw new Error("config.site.defaultLocale must be in config.site.locales");

  // output
  const { output } = config;
  if (!["mdx", "md"].includes(output.format))
    throw new Error("config.output.format must be 'mdx' or 'md'");
  if (!output.frontmatterFields?.required)
    throw new Error("config.output.frontmatterFields.required is required");

  // llm
  const { llm } = config;
  if (!llm.provider) throw new Error("config.llm.provider is required");
  if (!llm.model) throw new Error("config.llm.model is required");
  // fill defaults from DEFAULT_PROVIDERS if known and unset
  const defaults = DEFAULT_PROVIDERS[llm.provider];
  if (defaults) {
    if (!llm.endpoint) llm.endpoint = defaults.endpoint;
    if (!llm.apiKeyEnv) llm.apiKeyEnv = defaults.apiKeyEnv;
    if (!llm.pricing) llm.pricing = defaults.pricing;
  }
  if (!llm.endpoint) throw new Error("config.llm.endpoint is required for unknown providers");
  if (!llm.apiKeyEnv) throw new Error("config.llm.apiKeyEnv is required for unknown providers");
  if (typeof llm.temperature !== "number") llm.temperature = 0.3;

  // style
  const { style } = config;
  if (!style.language) throw new Error("config.style.language is required");
  if (!Array.isArray(style.forbiddenPhrases)) style.forbiddenPhrases = [];
  if (!Array.isArray(style.targetLength) || style.targetLength.length !== 2)
    style.targetLength = [800, 1400];

  // templates
  const { templates } = config;
  if (!templates.default) throw new Error("config.templates.default is required");
  if (!Array.isArray(templates.available) || templates.available.length === 0)
    throw new Error("config.templates.available must be a non-empty array");

  // safety
  const { safety } = config;
  if (typeof safety.warnAt !== "number") safety.warnAt = 100;
  if (typeof safety.hardStopAt !== "number") safety.hardStopAt = 500;
}

/** Get the absolute API key from env, throwing if not set. */
export function getApiKey(config) {
  const key = process.env[config.llm.apiKeyEnv];
  if (!key) {
    throw new Error(
      `${config.llm.apiKeyEnv} is not set. Add it to your .env.local or shell env.`,
    );
  }
  return key;
}

export { DEFAULT_PROVIDERS };
