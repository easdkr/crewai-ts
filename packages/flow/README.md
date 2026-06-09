# @crewai-ts/flow

[![npm version](https://img.shields.io/npm/v/@crewai-ts/flow.svg)](https://www.npmjs.com/package/@crewai-ts/flow)

Flow orchestration, persistence, and visualization features for CrewAI TypeScript.

This package provides the `Flow` class and decorators (`@start`, `@listen`, `@router`, `@humanFeedback`) for building stateful, event-driven workflows. It also includes persistence, conversation state, flow visualization, and input providers.

## Install

```sh
npm install @crewai-ts/flow
```

Requirements:

- Node.js 22 or later
- `@crewai-ts/core` 0.2.0 or later

## Quick Start

```ts
import { Flow, start, listen, router, and_ } from "@crewai-ts/flow";

class ResearchFlow extends Flow<{ topic?: string; done?: boolean }> {
  @start()
  begin(inputs: { topic: string }) {
    this.state.topic = inputs.topic;
    return inputs.topic;
  }

  @router("begin")
  route() {
    return this.state.topic ? "research" : "skip";
  }

  @listen("research")
  doResearch() {
    return `Researching ${this.state.topic}`;
  }

  @listen(and_("research", "begin"))
  finish() {
    this.state.done = true;
    return `Finished researching ${this.state.topic}`;
  }
}

const result = await new ResearchFlow().kickoff({
  inputs: { topic: "CrewAI" },
});
```

## Persistence

Save and restore flow state across process restarts:

```ts
import { JsonFlowPersistence, SQLiteFlowPersistence } from "@crewai-ts/flow";

const flow = new ResearchFlow({
  persistence: new JsonFlowPersistence("./.flows"),
});
```

## Human Feedback

Request human feedback during flow execution:

```ts
import { humanFeedback } from "@crewai-ts/flow";

class ReviewFlow extends Flow {
  @start()
  @humanFeedback({
    message: "Review this draft",
    emit: ["approved", "rejected"],
  })
  draft() {
    return "Draft content";
  }

  @listen("approved")
  publish() {
    return this.lastHumanFeedback?.output;
  }
}
```

## Visualization

Generate interactive flow visualizations:

```ts
import { renderInteractive } from "@crewai-ts/flow";

const html = renderInteractive(flow);
```

## Input Providers

Request user input during flow execution:

```ts
const flow = new ResearchFlow({
  inputProvider: {
    requestInput: async (message, flow, metadata) => ({
      text: "CrewAI",
      metadata: { source: metadata?.channel },
    }),
  },
});

const topic = await flow.ask("Topic?", { metadata: { channel: "research" } });
```

## Exports

- `Flow`, `start`, `listen`, `router`, `and_`, `or_`, `humanFeedback`
- `FlowConfig`, `ConsoleInputProvider`, `isInputResponse`
- `JsonFlowPersistence`, `SQLiteFlowPersistence`
- `FlowDefinition`, `FlowMethodDefinition`, `FlowStateDefinition`
- `renderInteractive`, `calculateNodePositions`
- `ConversationState`, `AgentMessage`, `ConversationEvent`

## License

MIT
