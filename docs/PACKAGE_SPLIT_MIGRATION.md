# Package Split Migration

This is a breaking package-boundary change. `@crewai-ts/core` is no longer the
everything package; it is the lightweight execution core and contract package.

Install only the packages your application uses.

## Minimal Installs

Core-only:

```bash
pnpm add @crewai-ts/core
```

Gemini-only:

```bash
pnpm add @crewai-ts/core @crewai-ts/gemini
```

```ts
import { Agent } from "@crewai-ts/core";
import { GeminiCompletion, registerGeminiProvider } from "@crewai-ts/gemini";

registerGeminiProvider();

const agent = new Agent({
  role: "Researcher",
  goal: "Answer with Gemini",
  backstory: "Careful analyst",
  llm: new GeminiCompletion({ model: "gemini-2.5-flash" }),
});
```

## Import Replacements

| Old import surface | New package |
| --- | --- |
| `GeminiCompletion`, `GeminiCompletionOptions`, `GEMINI_MODELS`, `GeminiModels` | `@crewai-ts/gemini` |
| `OpenAICompletion`, `OpenAICompatibleCompletion`, `OPENAI_COMPATIBLE_PROVIDERS`, `ResponsesAPIResult` | `@crewai-ts/openai` |
| `AnthropicCompletion` and Anthropic-specific request helpers | `@crewai-ts/anthropic` |
| `BedrockCompletion` and Bedrock Converse helpers | `@crewai-ts/bedrock` |
| `AzureCompletion` and Azure OpenAI helpers | `@crewai-ts/azure` |
| `SnowflakeCompletion` and Snowflake Cortex helpers | `@crewai-ts/snowflake` |
| `@crewai-ts/core/mcp`, MCP clients, MCP transports, MCP native tools | `@crewai-ts/mcp` |
| `@crewai-ts/core/rag`, `@crewai-ts/core/knowledge`, `@crewai-ts/core/memory` | `@crewai-ts/rag` |
| `@crewai-ts/core/a2a`, `@crewai-ts/core/a2a/*`, A2A/A2UI protocol types | `@crewai-ts/a2a` |
| `@crewai-ts/core/flow`, `@crewai-ts/core/flow/*`, Flow DSL paths | `@crewai-ts/flow` |

## Provider Registration

Native providers are no longer auto-registered by importing `@crewai-ts/core`.
Register the provider package before resolving provider model names through the
core registry:

```ts
import { createLLM } from "@crewai-ts/core";
import { registerOpenAIProvider } from "@crewai-ts/openai";

registerOpenAIProvider();

const llm = createLLM("gpt-4o-mini");
```

The same pattern applies to `@crewai-ts/gemini`, `@crewai-ts/anthropic`,
`@crewai-ts/bedrock`, `@crewai-ts/azure`, and `@crewai-ts/snowflake`.

## Optional Feature Hooks

Some core options can still reference optional feature concepts, but the
implementation is installed by importing the owning package:

- Import `@crewai-ts/rag` before using package-owned Memory, Knowledge, RAG, or
  PDF text extraction helpers. This package owns `pdf-parse`.
- Import `@crewai-ts/a2a` before using A2A server-card helpers on agents.
- Import `@crewai-ts/mcp` for MCP clients, native tools, resolver helpers, and
  the `@modelcontextprotocol/sdk` dependency.
- Import `@crewai-ts/flow` for Flow orchestration, persistence, visualization,
  and Flow DSL compatibility paths. This package owns `yaml`.

## Core Dependency Boundary

`@crewai-ts/core` has no direct install dependencies. It must not pull provider
implementations, RAG/PDF parsing, MCP SDKs, A2A/A2UI, Flow, or optional platform
integrations into Lambda/serverless deployments unless those packages are
installed explicitly.
