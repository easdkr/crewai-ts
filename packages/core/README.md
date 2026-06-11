# @crewai-ts/core

[![npm version](https://img.shields.io/npm/v/@crewai-ts/core.svg)](https://www.npmjs.com/package/@crewai-ts/core)
[![license](https://img.shields.io/npm/l/@crewai-ts/core.svg)](./LICENSE)
[![types](https://img.shields.io/npm/types/@crewai-ts/core.svg)](https://www.npmjs.com/package/@crewai-ts/core)

The **execution core** of an unofficial TypeScript port of [CrewAI](https://github.com/crewAIInc/crewAI).

`@crewai-ts/core` is intentionally small: it ships the agents, tasks, crews,
tools, hooks, checkpoints, security, events, planning, streaming, and
project-config layers. Native providers (Gemini, OpenAI, Anthropic, Bedrock,
Azure, Snowflake) and optional features (RAG, Memory, Knowledge, MCP, A2A,
Flow) live in their own packages so serverless and Lambda users can install
only what they need.

The package ships **ESM and CommonJS** builds with full type declarations, and
provides Python-style snake_case aliases for the most common async entry
points (`kickoff_async`, `kickoff_for_each_async`, `resume_async`, etc.) to
ease migration from the Python library.

> **Unofficial project.** This is a community port and is **not affiliated
> with, endorsed by, or maintained by crewAI, Inc.** "CrewAI" belongs to its
> respective owner. The original CrewAI is MIT-licensed (Copyright © crewAI,
> Inc.); this port retains that notice — see [License](#license).

## Install

```sh
npm install @crewai-ts/core
# or
pnpm add @crewai-ts/core
yarn add @crewai-ts/core
```

Requirements:

- Node.js 22 or later
- ESM and CommonJS projects are both supported
- Type declarations are included

Native providers and optional features are separate packages:

```sh
# Provider packages — install only what you need
pnpm add @crewai-ts/gemini
pnpm add @crewai-ts/openai
pnpm add @crewai-ts/anthropic
pnpm add @crewai-ts/bedrock
pnpm add @crewai-ts/azure
pnpm add @crewai-ts/snowflake

# Optional feature packages
pnpm add @crewai-ts/rag    # Memory, Knowledge, vector stores, PDF parsing
pnpm add @crewai-ts/mcp    # Model Context Protocol tools
pnpm add @crewai-ts/a2a    # Agent-to-Agent delegation protocol
pnpm add @crewai-ts/flow   # Stateful Flow orchestration
pnpm add @crewai-ts/nestjs # NestJS DI integration
pnpm add @crewai-ts/cli    # crewai-ts CLI
```

## Quick Start

```ts
import { Agent, Crew, Process, Task } from "@crewai-ts/core";

const researcher = new Agent({
  role: "Researcher",
  goal: "Find useful implementation details",
  backstory: "A careful technical analyst.",
  llm: (messages) => `researched: ${messages.at(-1)?.content ?? ""}`,
});

const task = new Task({
  description: "Research {topic}",
  expectedOutput: "A concise implementation brief",
  agent: researcher,
});

const crew = new Crew({
  agents: [researcher],
  tasks: [task],
  process: Process.sequential,
});

const result = await crew.kickoff({
  inputs: { topic: "CrewAI with TypeScript" },
});

console.log(result.raw);
```

## Decorator Style

`@crewai-ts/core` ships standard TypeScript decorators that store
library-private metadata only — no `reflect-metadata` is required.

```ts
import { Agent, Crew, CrewBase, Process, Task, agent, crew, task } from "@crewai-ts/core";

@CrewBase
class ResearchCrew {
  @agent
  researcher() {
    return new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      llm: (messages) => `result: ${messages.at(-1)?.content ?? ""}`,
    });
  }

  @task
  researchTask() {
    return new Task({
      description: "Research {topic}",
      expectedOutput: "A concise brief",
      agent: this.researcher(),
    });
  }

  @crew
  crew() {
    return new Crew({
      agents: [this.researcher()],
      tasks: [this.researchTask()],
      process: Process.sequential,
    });
  }
}

const result = await new ResearchCrew().crew().kickoff({
  inputs: { topic: "CrewAI" },
});

const batchResults = await new ResearchCrew().crew().kickoffForEach({
  inputs: [{ topic: "CrewAI" }, { topic: "TypeScript" }],
});
```

CrewAI Python-style snake_case aliases are also available: `kickoff_async`,
`kickoff_for_each`, `kickoff_for_each_async`, `resume_async`, `from_pending`,
`from_state`.

## LLM Providers

Agents accept a function LLM, an object LLM provider, or a registered model
name. Function LLMs receive the message list and call options; object
providers can expose `getUsageMetrics()` or CrewAI-style
`getTokenUsageSummary()` for exact token accounting.

### Function LLM

```ts
import { Agent } from "@crewai-ts/core";

const agent = new Agent({
  role: "Assistant",
  goal: "Answer questions",
  backstory: "A deterministic assistant.",
  llm: (messages) => `result: ${messages.at(-1)?.content ?? ""}`,
});
```

### Object provider

```ts
import { Agent, registerLLMProvider } from "@crewai-ts/core";

registerLLMProvider("local/research", {
  call: async (messages, { tools } = {}) => {
    return `tools available: ${tools?.map((tool) => tool.name).join(", ") ?? "none"}`;
  },
  getUsageMetrics: () => ({
    totalTokens: 12,
    promptTokens: 8,
    cachedPromptTokens: 0,
    completionTokens: 4,
    reasoningTokens: 0,
    cacheCreationTokens: 0,
    successfulRequests: 1,
  }),
});

const agent = new Agent({
  role: "Researcher",
  goal: "Find facts",
  backstory: "Careful analyst.",
  llm: "local/research",
});
```

### Native provider

Native provider packages register themselves on import and expose both a
class and a model-name string:

```ts
import { Agent } from "@crewai-ts/core";
import { GeminiCompletion, registerGeminiProvider } from "@crewai-ts/gemini";

registerGeminiProvider();

const agent = new Agent({
  role: "Researcher",
  goal: "Find facts",
  backstory: "Careful analyst.",
  llm: new GeminiCompletion({ model: "gemini-2.5-flash" }),
});
```

The same shape works for every native provider
(`OpenAICompletion`, `AnthropicCompletion`, `BedrockCompletion`,
`AzureCompletion`, `SnowflakeCompletion`).

## Tools

Tools are attached to agents or to individual tasks. Task tools take
precedence during that task, matching CrewAI's task-level override behavior.

`StructuredTool` uses an `argsSchema` of `Record<string, { type?, description?, required?, default? }>` — a
simple per-argument spec, **not** a full JSON Schema object.

```ts
import { Agent, StructuredTool, Task } from "@crewai-ts/core";

const search = new StructuredTool({
  name: "search",
  description: "Search for a topic",
  argsSchema: {
    query: { type: "string", required: true },
  },
  maxUsageCount: 3,
  func: ({ query }) => `found ${String(query)}`,
});

const researcher = new Agent({
  role: "Researcher",
  goal: "Find facts",
  backstory: "Careful analyst.",
  tools: [search],
  maxRpm: 30,
  llm: () => ({ toolName: "search", arguments: { query: "CrewAI" } }),
  stepCallback: (step) => {
    console.log(step.type, step.output);
  },
});

const task = new Task({
  description: "Search for CrewAI information",
  expectedOutput: "A search result",
  agent: researcher,
  guardrails: [
    (output) => [output.raw.length > 0, output.raw],
  ],
});
```

When an LLM returns a tool call, the agent executes the tool, appends the
tool result to the message list, and calls the LLM again until it returns a
final answer or reaches `maxIter`. Tools marked `resultAsAnswer` return their
output directly. Set `functionCallingLlm` on an `Agent` or `Crew` when
tool-call selection should use a separate model from the answer-generating
LLM.

Tool results are cached by normalized arguments. Use `cacheFunction` to skip
selected writes, share an `InMemoryToolCache` across tools, or set
`crew.cache = false` to disable library-level caching.

## Hooks

Register global hooks to inspect, mutate, or block LLM and tool calls. Hook
contexts expose CrewAI-compatible camelCase and snake_case fields.

```ts
import { afterLlmCall, beforeToolCall } from "@crewai-ts/core";

afterLlmCall((context) => {
  if (typeof context.response === "string") {
    return context.response.replace("SECRET", "[redacted]");
  }
  return null;
});

beforeToolCall((context) => {
  if (context.tool_name === "delete_file") {
    return false;
  }
  return null;
});
```

## Security

Agents, crews, and tasks expose a `fingerprint` through `SecurityConfig` for
identity, auditing, and deterministic seed-based identifiers.

```ts
import { Agent, Fingerprint, SecurityConfig } from "@crewai-ts/core";

const securityConfig = new SecurityConfig({
  fingerprint: Fingerprint.generate("research-agent", { version: "1.0" }),
});

const agent = new Agent({
  role: "Researcher",
  goal: "Find facts",
  backstory: "Careful analyst.",
  securityConfig,
});

console.log(agent.fingerprint.uuid_str);
```

## Checkpoints

`CheckpointConfig`, `JsonProvider`, and `SqliteProvider` provide
CrewAI-compatible checkpoint configuration and storage. Agents, crews, and
flows accept a `checkpoint` option.

```ts
import { CheckpointConfig, JsonProvider, SqliteProvider } from "@crewai-ts/core";

const checkpoint = new CheckpointConfig({
  location: ".checkpoints",
  onEvents: ["task_completed"],
  provider: new JsonProvider(),
});

const sqliteCheckpoint = new CheckpointConfig({
  location: ".checkpoints.db",
  provider: new SqliteProvider(),
});
```

`SqliteProvider` uses `node:sqlite`, which requires Node.js 22 or later.

## Streaming

Set `stream: true` on a crew to receive a streaming output wrapper from
`kickoff()`. The port exposes the final output as an async stream chunk and
makes the complete result available after iteration.

```ts
import { CrewStreamingOutput } from "@crewai-ts/core";

const streaming = (await crew.kickoff()) as unknown as CrewStreamingOutput;

for await (const chunk of streaming) {
  console.log(chunk.content);
}

console.log(streaming.result.raw);
```

## LiteAgent

`LiteAgent` mirrors CrewAI's deprecated lightweight direct-execution API while
reusing the main `Agent` runtime internally. It returns `LiteAgentOutput`,
keeps the executed messages, exposes usage metrics, and supports the common
snake_case aliases.

```ts
import { LiteAgent } from "@crewai-ts/core";

const agent = new LiteAgent({
  role: "Research Assistant",
  goal: "Answer quickly",
  backstory: "A concise research helper",
  llm: (messages) => `answer: ${messages.at(-1)?.content ?? ""}`,
});

const output = await agent.kickoff_async("What is CrewAI?");
console.log(output.raw);
```

## Agent Planning

Agents can create a reasoning plan before executing a task. `planning: true`
uses a bounded low-effort default config; `PlanningConfig` exposes the custom
prompt and limit knobs.

```ts
import { Agent, PlanningConfig } from "@crewai-ts/core";

const researcher = new Agent({
  role: "Researcher",
  goal: "Find facts",
  backstory: "Careful analyst.",
  llm: "local/research",
  planningConfig: new PlanningConfig({
    maxSteps: 10,
    planPrompt: "Plan this task: {description}",
  }),
});

const answer = await researcher.kickoff("Research CrewAI");
```

## Task Output and Input Files

Tasks can persist their final output to a file and can attach named text
input files. Paths support the same input interpolation as task descriptions,
and directories are created by default.

```ts
const report = new Task({
  description: "Research {topic}",
  expectedOutput: "A concise brief",
  agent: researcher,
  outputFile: "reports/{topic}.md",
  inputFiles: {
    notes: "docs/notes.txt",
  },
});
```

When input files are present, the runtime also exposes a `read_file` tool
that accepts `{ file_name: "notes" }`. Structured file objects passed
through `kickoff({ inputs })` are extracted into the same input-file surface
and removed from interpolation inputs.

## Conditional Tasks

`ConditionalTask` evaluates the previous task output before running. When its
condition returns false, the crew records an empty raw task output and
continues.

```ts
import { ConditionalTask } from "@crewai-ts/core";

const followUp = new ConditionalTask({
  description: "Write follow-up details",
  expectedOutput: "Only needed when the previous task asks for more detail",
  agent: researcher,
  condition: (output) => output.raw.includes("needs follow-up"),
});
```

## Human Input

Set `humanInput` on a task to request feedback after the first output. Empty
feedback accepts the output; non-empty feedback is appended to the next
prompt and the task reruns. Server apps should inject their own provider
instead of using terminal input.

```ts
import { Crew, Process, Task } from "@crewai-ts/core";

const crew = new Crew({
  agents: [reviewer],
  tasks: [
    new Task({
      description: "Review the report",
      expectedOutput: "Approved report",
      agent: reviewer,
      humanInput: true,
    }),
  ],
  process: Process.sequential,
  humanInputProvider: {
    requestFeedback: async ({ output }) => {
      return output.raw.includes("approved") ? "" : "Please include approval.";
    },
  },
});
```

## Crew Planning

Enable `planning` to run a planner LLM before task execution. The planner
returns one plan per task, and each task prompt receives its current plan
without mutating the original task description.

```ts
import { Crew, Process } from "@crewai-ts/core";

const crew = new Crew({
  agents: [researcher],
  tasks: [report],
  process: Process.sequential,
  planning: true,
  planningLlm: "gpt-4o-mini",
});
```

## Events

`crewaiEventBus` exposes typed lifecycle events for crew kickoff, task
execution, tool usage, and failures.

```ts
import { crewaiEventBus } from "@crewai-ts/core";

crewaiEventBus.on("task_completed", (event) => {
  console.log(event.task.id, event.output.raw);
});
```

## YAML-backed Project Config

`CrewProject` mirrors CrewAI's `agents.yaml` / `tasks.yaml` workflow. String
references in config are resolved only against this library's decorated
methods.

```ts
import {
  Agent,
  Crew,
  CrewProject,
  Process,
  Task,
  agent,
  agentOptionsFromConfig,
  crew,
  task,
  taskOptionsFromConfig,
} from "@crewai-ts/core";

class ResearchCrew extends CrewProject {
  agentsConfig = "config/agents.yaml";
  tasksConfig = "config/tasks.yaml";

  @agent
  researcher() {
    return new Agent(agentOptionsFromConfig(this.agentConfig("researcher")));
  }

  @task
  researchTask() {
    return new Task(taskOptionsFromConfig(this.taskConfig("researchTask")));
  }

  @crew
  crew() {
    return new Crew({ process: Process.sequential });
  }
}
```

## Features

**Agents, tasks, and crews**

- `Agent`, `Task`, `ConditionalTask`, `Crew`, `TaskOutput`, and `CrewOutput`
- `LiteAgent` and `LiteAgentOutput` for direct agent execution
- sequential and hierarchical process support, with manager agent / manager
  LLM validation, coworker delegation tools, and `allowDelegation` agents
- `kickoffForEach` / `kickoffForEachAsync` batch execution with aggregate
  usage metrics
- crew `replay(taskRef, inputs?)` from a task id, name, index, or task object
- crew-level planning that injects per-task execution plans before kickoff
- CrewAI-style default task context aggregation from previous task outputs

**Decorators and project config**

- standard TS decorators: `@agent`, `@task`, `@crew`, `@CrewBase`,
  `@beforeKickoff`, `@afterKickoff`, `@outputJson`, `@outputPydantic`,
  `@start`, `@listen`, `@router`
- `CrewProject` YAML / object config loading for `agentsConfig` and
  `tasksConfig`

**Agent execution controls**

- iterative agent tool-use loop with `maxIter` and `resultAsAnswer` support
- agent `maxRetryLimit` retries around task execution failures
- agent `maxExecutionTime` timeout enforcement
- agent and crew `maxRpm` throttling
- agent `useSystemPrompt` for models that do not accept system-role messages
- agent `systemTemplate`, `promptTemplate`, and `responseTemplate` rendering
- agent `injectDate` / `dateFormat` prompt injection
- callable agent `guardrail` with retry-limit enforcement
- agent `PlanningConfig`, `planning`, and legacy `reasoning` compatibility
- deprecated CrewAI agent fields: `allowCodeExecution`, `codeExecutionMode`,
  `respectContextWindow`, `multimodal`

**Tasks**

- task `outputFile` writing with input interpolation and safe path validation
- task `inputFiles` / `input_files` text file prompt injection, plus an
  automatic `read_file` tool for named task, crew, and agent input files
- task `outputConverter` / `converter_cls` hooks for structured conversion
- structured task interpolation for strings, numbers, booleans, arrays,
  objects, and `null`
- single or ordered multiple task `guardrails` with retry support
- task `humanInput` feedback loops with injectable providers
- task execution counters: `usedTools`, `toolsErrors`, `delegations`,
  `promptContext`, `processedByAgents`
- task `allowCrewaiTriggerContext` for `crewai_trigger_payload` kickoff inputs
- `ConditionalTask` skip logic based on the previous task output

**Tools**

- `BaseTool` / `StructuredTool` with argument validation, usage limits,
  tool-call execution, and task-level tool overrides
- tool result caching with `cacheFunction` and shareable `InMemoryToolCache`
- crew `cache: false` to disable library tool result caching

**LLM providers**

- function or object LLM providers with tool-call options, string model
  registry, and token usage aggregation
- native provider implementations live in explicit packages such as
  `@crewai-ts/gemini`

**Flows** (live in `@crewai-ts/flow`)

- `Flow`, `@start`, `@listen`, `@router`, `or_`, `and_`, `ask()` input
  providers, and `@humanFeedback`
- basic `stream: true` crew output from core, plus flow streaming from
  `@crewai-ts/flow`

**Events and hooks**

- typed `crewaiEventBus` lifecycle events for crew kickoff, task execution,
  tool usage, and failures
- agent and crew `stepCallback` hooks for tool / final agent steps
- crew-level `taskCallback` hooks after task callbacks, with duplicate
  callback suppression
- global before / after LLM and tool call hooks

**Memory and knowledge** (live in `@crewai-ts/rag`)

- `Memory` / `MemoryScope` with recall / save tools injected into crews when
  memory is enabled
- `Knowledge` sources (`StringKnowledgeSource`, `TextFileKnowledgeSource`,
  `JSONKnowledgeSource`, `CSVKnowledgeSource`) with agent and crew context
  injection

**State, security, and checkpoints**

- security `Fingerprint` / `SecurityConfig` on agents, crews, and tasks
- checkpoint `CheckpointConfig`, filesystem `JsonProvider`, and SQLite
  `SqliteProvider` (uses `node:sqlite`, requires Node.js 22+)
- state `EventRecord` / `EventNode` graph for event relationship tracking
- state `RuntimeState` checkpoint serialization, restore, lineage, and fork
  helpers
- crew `outputLogFile` task execution logs in text or JSON files
- crew `executionLogs` and `taskExecutionOutputJsonFiles` for per-task audit
  records

## Related Packages

- `@crewai-ts/gemini` — Gemini native provider
- `@crewai-ts/openai` — OpenAI and OpenAI-compatible providers
- `@crewai-ts/anthropic` — Anthropic native provider
- `@crewai-ts/bedrock` — AWS Bedrock native provider
- `@crewai-ts/azure` — Azure OpenAI native provider
- `@crewai-ts/snowflake` — Snowflake Cortex native provider
- `@crewai-ts/mcp` — Model Context Protocol tools
- `@crewai-ts/rag` — Memory, Knowledge, vector stores, and PDF parsing
- `@crewai-ts/a2a` — Agent-to-Agent delegation protocol
- `@crewai-ts/flow` — Stateful Flow orchestration
- `@crewai-ts/nestjs` — NestJS DI integration
- `@crewai-ts/cli` — crewai-ts CLI

## License

MIT

This project is an unofficial TypeScript port of
[CrewAI](https://github.com/crewAIInc/crewAI) (Copyright © crewAI, Inc.),
which is distributed under the MIT License. It is not affiliated with or
endorsed by crewAI, Inc. As required by the MIT License, the original
copyright and permission notice are retained in [LICENSE](./LICENSE).
