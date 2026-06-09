# @crewai-ts/a2a

[![npm version](https://img.shields.io/npm/v/@crewai-ts/a2a.svg)](https://www.npmjs.com/package/@crewai-ts/a2a)

Agent-to-Agent (A2A) protocol and A2UI features for CrewAI TypeScript.

This package implements the Google A2A protocol for delegating tasks between agents, plus A2UI (Agent-to-User Interface) schema support for structured agent-to-user interactions.

## Install

```sh
npm install @crewai-ts/a2a
```

Requirements:

- Node.js 22 or later
- `@crewai-ts/core` 0.2.0 or later

## Quick Start

Register the A2A hooks so agents can delegate to other agents via the A2A protocol:

```ts
import { Agent } from "@crewai-ts/core";
import "@crewai-ts/a2a"; // auto-registers hooks on import

const agent = new Agent({
  role: "Coordinator",
  goal: "Delegate tasks to specialist agents",
  backstory: "An orchestrator that uses A2A delegation.",
  a2a: {
    agents: [
      { name: "researcher", url: "http://localhost:3001/agent.json" },
    ],
  },
});
```

## A2A Protocol

The A2A protocol supports:

- **Agent cards** — discoverable agent metadata with transport negotiation
- **Task delegation** — send tasks to remote agents and receive results
- **Streaming** — receive partial results as they are generated
- **Push notifications** — register callbacks for async task completion
- **Authentication** — JWT-based auth between agents

### Agent Cards

```ts
import { A2AAgentCard } from "@crewai-ts/a2a";

const card: A2AAgentCard = {
  name: "researcher",
  url: "https://agents.example.com/researcher",
  preferredTransport: "HTTP+JSON",
};
```

### A2UI Schemas

Load and validate A2UI schemas for structured agent-to-user interfaces:

```ts
import { loadSchema, A2UIModel } from "@crewai-ts/a2a";

const schema = loadSchema("server_to_client", { version: "v0.9" });
const model = A2UIModel.modelValidate(schema);
```

## Exports

- `A2AAgentCard`, `A2AAgentInterface`, `A2AAgentResponseProtocol`
- `A2ATransport`, `A2AProtocolVersion`, `A2ANegotiationSource`
- `loadSchema`, `A2UIModel`, `A2UIRecord`
- Task execution helpers: `_execute_task_with_a2a`, `wrap_agent_with_a2a_instance`

## License

MIT
