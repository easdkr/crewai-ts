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

## Current Models and Thinking

Supported current models include `claude-fable-5-1`, `claude-opus-5`,
`claude-sonnet-5`, and `claude-haiku-4-5`. The core catalog also includes
Claude Opus 4.6–4.8 and Sonnet 4.6. Current Fable, Opus 5, and Sonnet 5
have 1M-token context windows; Haiku 4.5 has 200K. The existing 85% context
safety margin and default model choices are unchanged.

Use adaptive thinking on current Opus, Sonnet, and Fable models:

```ts
const llm = new AnthropicCompletion({
  model: "claude-opus-5",
  maxTokens: 16000,
  thinking: { type: "adaptive" },
  effort: "high",
});
```

`effort` (also `reasoningEffort` / `reasoning_effort`) is sent as
`output_config.effort`. These options and `thinking` are preserved through
`createLLM()` too. Fable 5.1 uses always-on adaptive thinking and cannot
disable thinking or force a particular tool.

Manual thinking remains available on compatible older models, including
Haiku 4.5 and the deprecated manual mode on Opus/Sonnet 4.6:

```ts
import { AnthropicThinkingConfig } from "@crewai-ts/anthropic";

const llm = new AnthropicCompletion({
  model: "claude-haiku-4-5",
  maxTokens: 32768,
  thinking: new AnthropicThinkingConfig({ type: "enabled", budgetTokens: 16000 }),
});
```

Manual thinking is rejected on Opus 4.7 and later and Sonnet 5. Sampling
parameters remain available on 4.6; unsupported sampling settings are omitted
on the newer models.

## Structured Outputs

On supported models, `responseFormat` / `response_format` schema providers
(with `schema`, `modelJsonSchema()`, or `model_json_schema()`) use native
`output_config.format`. The provider returns the parsed JSON object and
reports malformed JSON instead of silently returning unstructured text.
Older models without native support retain the structured-output tool path.

See the official [model catalog](https://platform.claude.com/docs/en/models/overview),
[thinking guide](https://platform.claude.com/docs/en/build-with-claude/thinking),
and [structured output guide](https://platform.claude.com/docs/en/build-with-claude/structured-outputs).

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
