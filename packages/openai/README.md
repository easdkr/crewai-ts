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

Use with any OpenAI-compatible API endpoint:

```ts
import { OpenAICompatibleCompletion } from "@crewai-ts/openai";

const llm = new OpenAICompatibleCompletion({
  model: "llama3.1",
  baseUrl: "http://localhost:11434/v1",
  apiKey: "ollama", // or your API key
});
```

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

## Exports

- `OpenAICompletion` — main OpenAI provider class
- `OpenAICompatibleCompletion` — OpenAI-compatible provider class
- `ResponsesAPIResult` — responses API result wrapper
- `registerOpenAIProvider` — register the provider with the core runtime
- Result types: `WebSearchResult`, `FileSearchResult`, `CodeInterpreterResult`, `ComputerUseResult`, `ReasoningSummary`

## License

MIT
