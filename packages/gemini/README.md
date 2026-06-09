# @crewai-ts/gemini

[![npm version](https://img.shields.io/npm/v/@crewai-ts/gemini.svg)](https://www.npmjs.com/package/@crewai-ts/gemini)

Gemini native provider for CrewAI TypeScript.

Provides `GeminiCompletion` with full support for Google Gemini models, including tool use, file uploads, and a comprehensive model catalog.

## Install

```sh
npm install @crewai-ts/gemini
```

Requirements:

- Node.js 22 or later
- `@crewai-ts/core` 0.2.0 or later

## Quick Start

```ts
import { Agent } from "@crewai-ts/core";
import { GeminiCompletion, registerGeminiProvider } from "@crewai-ts/gemini";

registerGeminiProvider();

const agent = new Agent({
  role: "Researcher",
  goal: "Find facts",
  backstory: "A careful analyst.",
  llm: new GeminiCompletion({ model: "gemini-2.5-flash" }),
});
```

Or use the registered provider name:

```ts
const agent = new Agent({
  role: "Researcher",
  goal: "Find facts",
  backstory: "A careful analyst.",
  llm: "gemini/gemini-2.5-flash",
});
```

## Model Catalog

All Gemini models are available as constants:

```ts
import { GEMINI_MODELS, GeminiModels } from "@crewai-ts/gemini";

// GEMINI_MODELS is an array of all supported model names
// GeminiModels is the TypeScript union type
```

Popular models include:

- `gemini-2.5-pro`
- `gemini-2.5-flash`
- `gemini-2.0-flash`
- `gemini-1.5-pro`
- `gemini-1.5-flash`

## Exports

- `GeminiCompletion` — main LLM provider class
- `GEMINI_MODELS`, `GeminiModels` — model catalog constants and types
- `registerGeminiProvider` — register the provider with the core runtime

## License

MIT
