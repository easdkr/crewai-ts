# @crewai-ts/anthropic

[![npm version](https://img.shields.io/npm/v/@crewai-ts/anthropic.svg)](https://www.npmjs.com/package/@crewai-ts/anthropic)

Anthropic native provider for CrewAI TypeScript.

Provides `AnthropicCompletion` with full support for Claude models, including tool use, thinking mode, structured outputs, file uploads, and the Anthropic tool-search beta.

## Install

```sh
npm install @crewai-ts/anthropic
```

Requirements:

- Node.js 22 or later
- `@crewai-ts/core` 0.2.0 or later

## Quick Start

```ts
import { Agent } from "@crewai-ts/core";
import { AnthropicCompletion, registerAnthropicProvider } from "@crewai-ts/anthropic";

registerAnthropicProvider();

const agent = new Agent({
  role: "Writer",
  goal: "Write concise prose",
  backstory: "A careful wordsmith.",
  llm: new AnthropicCompletion({ model: "claude-sonnet-4-5" }),
});
```

Or use the registered provider name:

```ts
const agent = new Agent({
  role: "Writer",
  goal: "Write concise prose",
  backstory: "A careful wordsmith.",
  llm: "anthropic/claude-sonnet-4-5",
});
```

## Thinking Mode

Enable extended thinking for reasoning-heavy tasks:

```ts
import { AnthropicThinkingConfig } from "@crewai-ts/anthropic";

const llm = new AnthropicCompletion({
  model: "claude-opus-4-5",
  thinking: new AnthropicThinkingConfig({ type: "enabled", budget_tokens: 16000 }),
});
```

## Tool Search

Use the Anthropic tool-search beta:

```ts
import { AnthropicToolSearchConfig } from "@crewai-ts/anthropic";

const llm = new AnthropicCompletion({
  model: "claude-sonnet-4-5",
  toolSearch: new AnthropicToolSearchConfig({ type: "bm25" }),
});
```

## Exports

- `AnthropicCompletion` — main LLM provider class
- `AnthropicThinkingConfig` — thinking mode configuration
- `AnthropicToolSearchConfig` — tool search configuration
- `registerAnthropicProvider` — register the provider with the core runtime
- Model constants: `NATIVE_STRUCTURED_OUTPUT_MODELS`, `TOOL_SEARCH_TOOL_TYPES`, `ANTHROPIC_FILES_API_BETA`, `ANTHROPIC_STRUCTURED_OUTPUTS_BETA`

## License

MIT
