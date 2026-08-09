# @crewai-ts/openai

[![npm version](https://img.shields.io/npm/v/@crewai-ts/openai.svg)](https://www.npmjs.com/package/@crewai-ts/openai)

OpenAI and OpenAI-compatible native providers for CrewAI TypeScript.

Provides `OpenAICompletion` and `OpenAICompatibleCompletion` with support for chat completions, responses API, built-in tools (web search, file search, code interpreter, computer use), reasoning summaries, and structured outputs.

## Install

```sh
npm install @crewai-ts/openai
```

Requirements:

- Node.js 22 or later
- `@crewai-ts/core` 0.2.0 or later

## Quick Start

```ts
import { Agent } from "@crewai-ts/core";
import { OpenAICompletion, registerOpenAIProvider } from "@crewai-ts/openai";

registerOpenAIProvider();

const agent = new Agent({
  role: "Assistant",
  goal: "Answer questions",
  backstory: "A helpful assistant.",
  llm: new OpenAICompletion({ model: "gpt-4o" }),
});
```

Or use the registered provider name:

```ts
const agent = new Agent({
  role: "Assistant",
  goal: "Answer questions",
  backstory: "A helpful assistant.",
  llm: "openai/gpt-4o",
});
```

## OpenAI-Compatible Providers

`OpenAICompatibleCompletion` extends `OpenAICompletion` and is configured for
a specific upstream provider via the `provider` option. The list of known
provider keys is exported as `OPENAI_COMPATIBLE_PROVIDERS`.

```ts
import { OpenAICompatibleCompletion } from "@crewai-ts/openai";

// Ollama — local llama.cpp / Ollama server
const ollama = new OpenAICompatibleCompletion({
  provider: "ollama", // or "ollama_chat"
  model: "llama3.1",
  baseUrl: "http://localhost:11434/v1",
  apiKey: "ollama", // any non-empty value; Ollama ignores the key
});

// OpenRouter — hosted OpenAI-compatible routing
const openrouter = new OpenAICompatibleCompletion({
  provider: "openrouter",
  model: "anthropic/claude-3.5-sonnet",
  apiKey: process.env.OPENROUTER_API_KEY,
});
```

Omit `provider` only when you want the default `openrouter` config. Passing
an unknown `provider` throws at construction time.

## Built-in Tools

Enable OpenAI built-in tools:

```ts
const llm = new OpenAICompletion({
  model: "gpt-4o",
  builtinTools: ["web_search", "file_search", "code_interpreter"],
});
```

## Responses API

Use the OpenAI Responses API:

```ts
const llm = new OpenAICompletion({
  model: "gpt-4o",
  api: "responses",
  store: true,
});
```

## Retries and Flex Fallback

`maxRetries` (default `2`) controls how many additional attempts are made
after the first failed request — network errors and HTTP 408/409/429/5xx are
retried with exponential backoff (honoring `Retry-After` / `Retry-After-Ms`
response headers when present). Other errors (e.g. 400/401/404) fail
immediately and are thrown as `OpenAIRequestError`, which preserves the
HTTP status code via `.status`.

Set `flexFallbackToAuto` (or `flex_fallback_to_auto`) to `true` to fall back
from `service_tier: "flex"` to `"auto"` once a retryable error occurs, so a
request that starts on the cheaper Flex tier can still complete on retry
instead of failing outright when Flex capacity is unavailable. Once a
request falls back to `"auto"` it stays on `"auto"` for the remaining
retries of that request. This defaults to `false`, so existing `flex` users
are unaffected unless they opt in:

```ts
const llm = new OpenAICompletion({
  model: "gpt-4o",
  maxRetries: 3,
  additionalParams: { service_tier: "flex" },
  flexFallbackToAuto: true,
});
```

## Exports

- `OpenAICompletion` — main OpenAI provider class
- `OpenAICompatibleCompletion` — OpenAI-compatible provider class
- `OpenAIRequestError` — thrown on failed requests; carries the HTTP `status`
- `ResponsesAPIResult` — responses API result wrapper
- `registerOpenAIProvider` — register the provider with the core runtime
- Result types: `WebSearchResult`, `FileSearchResult`, `CodeInterpreterResult`, `ComputerUseResult`, `ReasoningSummary`

## License

MIT
