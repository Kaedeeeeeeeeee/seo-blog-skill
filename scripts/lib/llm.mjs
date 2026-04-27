// Provider-agnostic LLM dispatcher.
//
// Default path: OpenAI-compatible chat/completions API
//   (works for DeepSeek, OpenAI, Together, Groq, Mistral, Fireworks)
// Native adapters for Anthropic and Gemini.

import { getApiKey } from "./config.mjs";

/**
 * Call the configured LLM with system + user messages.
 * Returns { text, inputTokens, outputTokens, costUSD, ms }.
 */
export async function callLLM(config, { system, user }) {
  const provider = config.llm.provider;
  const t0 = Date.now();
  let result;

  switch (provider) {
    case "anthropic":
      result = await callAnthropic(config, { system, user });
      break;
    case "gemini":
      result = await callGemini(config, { system, user });
      break;
    default:
      // OpenAI-compatible path (deepseek, openai, together, groq, mistral, ...)
      result = await callOpenAICompat(config, { system, user });
  }

  const ms = Date.now() - t0;
  const { inputPerM, outputPerM } = config.llm.pricing;
  const costUSD =
    ((result.inputTokens ?? 0) * inputPerM +
      (result.outputTokens ?? 0) * outputPerM) /
    1_000_000;
  return { ...result, ms, costUSD };
}

async function callOpenAICompat(config, { system, user }) {
  const res = await fetch(config.llm.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey(config)}`,
    },
    body: JSON.stringify({
      model: config.llm.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: config.llm.temperature,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LLM ${res.status}: ${body.slice(0, 500)}`);
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error(`No content in response: ${JSON.stringify(data).slice(0, 300)}`);
  const usage = data.usage ?? {};
  return {
    text,
    inputTokens: usage.prompt_tokens,
    outputTokens: usage.completion_tokens,
  };
}

async function callAnthropic(config, { system, user }) {
  const res = await fetch(config.llm.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": getApiKey(config),
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.llm.model,
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: user }],
      temperature: config.llm.temperature,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic ${res.status}: ${body.slice(0, 500)}`);
  }
  const data = await res.json();
  const text = data.content?.[0]?.text;
  if (!text) throw new Error(`No content in Anthropic response: ${JSON.stringify(data).slice(0, 300)}`);
  return {
    text,
    inputTokens: data.usage?.input_tokens,
    outputTokens: data.usage?.output_tokens,
  };
}

async function callGemini(config, { system, user }) {
  const url = `${config.llm.endpoint}/${config.llm.model}:generateContent?key=${getApiKey(config)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { temperature: config.llm.temperature },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 500)}`);
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`No content in Gemini response: ${JSON.stringify(data).slice(0, 300)}`);
  const usage = data.usageMetadata ?? {};
  return {
    text,
    inputTokens: usage.promptTokenCount,
    outputTokens: usage.candidatesTokenCount,
  };
}

/** Strip common LLM wrapper artifacts (code fences, leading whitespace). */
export function unwrap(text) {
  let t = text.trim();
  t = t.replace(/^```(?:mdx|markdown|md)?\s*\n/, "");
  t = t.replace(/\n```\s*$/, "");
  return t.trim() + "\n";
}
