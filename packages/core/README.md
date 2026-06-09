# @crewai-ts/core

[![npm version](https://img.shields.io/npm/v/@crewai-ts/core.svg)](https://www.npmjs.com/package/@crewai-ts/core)
[![types](https://img.shields.io/npm/types/@crewai-ts/core.svg)](https://www.npmjs.com/package/@crewai-ts/core)

An **unofficial** TypeScript port of [CrewAI](https://github.com/crewAIInc/crewAI) for building multi-agent workflows with agents, tasks, crews, flows, memory, knowledge, tools, checkpoints, and streaming.

This project is not affiliated with, endorsed by, or maintained by crewAI, Inc.

## Install

```sh
npm install @crewai-ts/core
```

Requirements:

- Node.js 22 or later
- ESM and CommonJS projects are both supported
- Type declarations are included

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

```ts
import { Agent, Crew, Process, Task, agent, crew, task } from "@crewai-ts/core";

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
```

## LLM Providers

Pass a function LLM directly:

```ts
const llm = (messages: Array<{ content?: string }>) => {
  return `answer: ${messages.at(-1)?.content ?? ""}`;
};
```

Or register a named provider:

```ts
import { Agent, registerLLMProvider } from "@crewai-ts/core";

registerLLMProvider("demo/provider", () => ({
  call: async (messages) => `provider result: ${messages.at(-1)?.content ?? ""}`,
}));

const agent = new Agent({
  role: "Assistant",
  goal: "Use a registered provider",
  backstory: "A deterministic assistant.",
  llm: "demo/provider",
});
```

## Tools

```ts
import { Agent, StructuredTool, Task } from "@crewai-ts/core";

const search = new StructuredTool({
  name: "search",
  description: "Search internal notes",
  schema: {
    type: "object",
    properties: {
      query: { type: "string" },
    },
    required: ["query"],
  },
  func: async ({ query }) => `result for ${query}`,
});

const researcher = new Agent({
  role: "Researcher",
  goal: "Use tools when useful",
  backstory: "Tool-using analyst.",
  tools: [search],
  llm: () => ({ toolName: "search", arguments: { query: "CrewAI" } }),
});

const task = new Task({
  description: "Search for CrewAI information",
  expectedOutput: "Search result",
  agent: researcher,
});
```

## Features

- `Agent`, `Task`, `ConditionalTask`, `Crew`, `TaskOutput`, and `CrewOutput`
- Sequential and hierarchical process support
- Crew kickoff, batch kickoff, replay, planning, and usage metrics
- Standard TypeScript decorators: `@agent`, `@task`, `@crew`, `@beforeKickoff`, `@afterKickoff`
- Tool calling with `BaseTool` and `StructuredTool`
- Memory and knowledge sources
- JSON and SQLite checkpoint providers
- Flow APIs with `@start`, `@listen`, `@router`, `and_`, and `or_`
- Human input providers and task guardrails
- Streaming crew and flow output helpers
- Python-style snake_case compatibility aliases for common CrewAI entry points

## Related Packages

- `@crewai-ts/nestjs`: NestJS dependency-injection integration
- `@crewai-ts/cli`: CLI helpers for CrewAI-style TypeScript projects

## License

MIT
