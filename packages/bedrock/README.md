# @crewai-ts/bedrock

[![npm version](https://img.shields.io/npm/v/@crewai-ts/bedrock.svg)](https://www.npmjs.com/package/@crewai-ts/bedrock)

AWS Bedrock native provider for CrewAI TypeScript.

Provides `BedrockCompletion` for calling models through AWS Bedrock (Converse API), with support for tool use, guardrails, structured outputs, and streaming.

## Install

```sh
npm install @crewai-ts/bedrock
```

Requirements:

- Node.js 22 or later
- `@crewai-ts/core` 0.2.0 or later
- AWS credentials configured (via environment variables, IAM role, or SDK config)

## Quick Start

```ts
import { Agent } from "@crewai-ts/core";
import { BedrockCompletion, registerBedrockProvider } from "@crewai-ts/bedrock";

registerBedrockProvider();

const agent = new Agent({
  role: "Assistant",
  goal: "Answer questions",
  backstory: "A helpful assistant.",
  llm: new BedrockCompletion({
    model: "anthropic.claude-3-5-sonnet-20241022-v2:0",
    regionName: "us-east-1",
  }),
});
```

Or use the registered provider name:

```ts
const agent = new Agent({
  role: "Assistant",
  goal: "Answer questions",
  backstory: "A helpful assistant.",
  llm: "bedrock/anthropic.claude-3-5-sonnet-20241022-v2:0",
});
```

## Configuration

```ts
const llm = new BedrockCompletion({
  model: "anthropic.claude-3-5-sonnet-20241022-v2:0",
  regionName: "us-east-1",
  maxTokens: 4096,
  topP: 0.9,
  topK: 250,
  temperature: 0.7,
  stream: false,
  guardrailConfig: {
    guardrailIdentifier: "my-guardrail",
    guardrailVersion: "1",
  },
});
```

## Exports

- `BedrockCompletion` — main LLM provider class
- `BedrockConverseRequestBody`, `BedrockConverseStreamRequestBody` —
  branded type-marker constants (used internally to distinguish request-body
  shapes)
- `ConverseToolTypeDef`, `ToolInputSchema`, `ToolSpec` — branded type-marker
  constants (used internally to distinguish tool-spec shapes)
- `registerBedrockProvider` — register the provider with the core runtime

## License

MIT
