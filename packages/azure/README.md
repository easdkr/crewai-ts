# @crewai-ts/azure

[![npm version](https://img.shields.io/npm/v/@crewai-ts/azure.svg)](https://www.npmjs.com/package/@crewai-ts/azure)

Azure OpenAI native provider for CrewAI TypeScript.

Provides `AzureCompletion` for calling Azure OpenAI Service deployments with full support for chat completions, responses API, reasoning effort, built-in tools, and structured outputs.

## Install

```sh
npm install @crewai-ts/azure
```

Requirements:

- Node.js 22 or later
- `@crewai-ts/core` 0.2.0 or later

## Quick Start

```ts
import { Agent } from "@crewai-ts/core";
import { AzureCompletion, registerAzureProvider } from "@crewai-ts/azure";

registerAzureProvider();

const agent = new Agent({
  role: "Assistant",
  goal: "Answer questions",
  backstory: "A helpful assistant.",
  llm: new AzureCompletion({
    model: "gpt-4o",
    endpoint: "https://my-resource.openai.azure.com",
    apiVersion: "2024-12-01-preview",
  }),
});
```

Or use the registered provider name:

```ts
const agent = new Agent({
  role: "Assistant",
  goal: "Answer questions",
  backstory: "A helpful assistant.",
  llm: "azure/gpt-4o",
});
```

## Configuration

```ts
const llm = new AzureCompletion({
  model: "gpt-4o",
  endpoint: "https://my-resource.openai.azure.com",
  apiVersion: "2024-12-01-preview",
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  maxTokens: 4096,
  temperature: 0.7,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
  stream: false,
  api: "completions", // or "responses"
});
```

## Exports

- `AzureCompletion` — main LLM provider class
- `AzureCompletionParams` — request parameter helper
- `registerAzureProvider` — register the provider with the core runtime

## License

MIT
