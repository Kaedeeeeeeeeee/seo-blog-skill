# LLM Providers

The skill supports any OpenAI-compatible chat API as a default, plus native adapters for Anthropic and Gemini. New providers add in ~30 lines.

## Built-in providers

### DeepSeek (recommended for cost)

```json
{
  "llm": {
    "provider": "deepseek",
    "model": "deepseek-v4-flash",
    "apiKeyEnv": "DEEPSEEK_API_KEY",
    "temperature": 0.3
  }
}
```

- Endpoint and pricing auto-filled
- Get API key: https://platform.deepseek.com/api_keys
- `deepseek-v4-flash`: $0.14 / $0.28 per 1M tokens (input/output)
- `deepseek-v4-pro`: ~$0.435 / $0.87 per 1M (75% off until 2026/05/05)
- Excellent for batch / outline-driven workflow

### OpenAI

```json
{
  "llm": {
    "provider": "openai",
    "model": "gpt-4o-mini",
    "apiKeyEnv": "OPENAI_API_KEY",
    "temperature": 0.3
  }
}
```

- API key: https://platform.openai.com/api-keys
- Models vary in pricing significantly; update `pricing` in config

### Anthropic Claude

```json
{
  "llm": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-6",
    "apiKeyEnv": "ANTHROPIC_API_KEY",
    "temperature": 0.3
  }
}
```

- API key: https://console.anthropic.com/
- Best quality but ~10-30x cost vs DeepSeek
- Worth it for high-stakes content; overkill for batch

### Gemini

```json
{
  "llm": {
    "provider": "gemini",
    "model": "gemini-2.5-flash",
    "apiKeyEnv": "GEMINI_API_KEY",
    "temperature": 0.3
  }
}
```

- API key: https://aistudio.google.com/apikey
- Generous free tier
- Quality varies by language; especially good for English/German

## OpenAI-compatible alternatives

Set `provider` to anything not in the built-in list, and explicitly specify `endpoint`:

### Together AI

```json
{
  "llm": {
    "provider": "together",
    "model": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    "endpoint": "https://api.together.xyz/v1/chat/completions",
    "apiKeyEnv": "TOGETHER_API_KEY",
    "temperature": 0.3,
    "pricing": { "inputPerM": 0.88, "outputPerM": 0.88 }
  }
}
```

### Groq (fast)

```json
{
  "llm": {
    "endpoint": "https://api.groq.com/openai/v1/chat/completions",
    "provider": "groq",
    "model": "llama-3.3-70b-versatile",
    "apiKeyEnv": "GROQ_API_KEY",
    "pricing": { "inputPerM": 0.59, "outputPerM": 0.79 }
  }
}
```

### Mistral

```json
{
  "llm": {
    "provider": "mistral",
    "endpoint": "https://api.mistral.ai/v1/chat/completions",
    "model": "mistral-large-latest",
    "apiKeyEnv": "MISTRAL_API_KEY",
    "pricing": { "inputPerM": 2.0, "outputPerM": 6.0 }
  }
}
```

## Setting your API key

**Never put the key in `seo-blog.config.json`** (it's typically committed to git).

Put it in `.env.local` at your project root:

```
DEEPSEEK_API_KEY=sk-...
```

Then run scripts via `node --env-file=.env.local ...`, or export in shell, or use a process manager that loads it.

## Adding a new provider (custom)

If your provider doesn't speak OpenAI-compatible chat, add a native adapter:

1. Edit `scripts/lib/llm.mjs`
2. Add a `case "yourprovider":` branch in `callLLM`
3. Implement `callYourProvider(config, { system, user })` returning `{ text, inputTokens, outputTokens }`
4. (Optional) Add to `DEFAULT_PROVIDERS` in `scripts/lib/config.mjs` for endpoint/pricing defaults

Patches welcome.

## Cost considerations

Approximate cost per 1000-character Japanese post (our experience):

| Provider/model | Input/Output cost | Per post | 100 posts |
|---|---|---|---|
| deepseek-v4-flash | $0.14/$0.28 | ~$0.001 | ~$0.10 |
| gemini-2.5-flash | $0.075/$0.30 | ~$0.0008 | ~$0.08 |
| gpt-4o-mini | $0.15/$0.60 | ~$0.002 | ~$0.20 |
| claude-sonnet-4 | $3.00/$15.00 | ~$0.04 | ~$4.00 |
| claude-opus-4 | $15/$75 | ~$0.20 | ~$20 |

For most outline-driven blog work, **DeepSeek or Gemini is the cost-effective sweet spot**. Use Sonnet/Opus only when output quality is mission-critical (and consider doing a quality comparison run on 5 posts to decide).
