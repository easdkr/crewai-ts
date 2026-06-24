# @crewai-ts/flow

[![npm version](https://img.shields.io/npm/v/@crewai-ts/flow.svg)](https://www.npmjs.com/package/@crewai-ts/flow)

Flow orchestration, persistence, and visualization features for CrewAI TypeScript.

This package provides the `@Flow()` class decorator and method decorators (`@start`, `@listen`, `@router`, `@humanFeedback`) for building stateful, event-driven workflows. It also includes persistence, conversation state, flow visualization, state backends, and input providers.

## Install

```sh
npm install @crewai-ts/flow
```

Requirements:

- Node.js 22 or later
- `@crewai-ts/core` 0.2.0 or later

## Quick Start

```ts
import { Flow, start, listen, router, and_, type FlowContext, type FlowRuntime } from "@crewai-ts/flow";

type ResearchState = { topic?: string; done?: boolean };

interface ResearchFlow extends FlowRuntime<ResearchState> {}

@Flow<ResearchState>({
  initialState: () => ({ done: false }),
})
class ResearchFlow {
  @start()
  begin(ctx: FlowContext<ResearchState>, inputs: { topic: string }) {
    ctx.state.topic = inputs.topic;
    return inputs.topic;
  }

  @router("begin")
  route(ctx: FlowContext<ResearchState>) {
    return ctx.state.topic ? "research" : "skip";
  }

  @listen("research")
  doResearch(ctx: FlowContext<ResearchState>) {
    return `Researching ${ctx.state.topic}`;
  }

  @listen(and_("research", "begin"))
  finish(ctx: FlowContext<ResearchState>) {
    ctx.state.done = true;
    return `Finished researching ${ctx.state.topic}`;
  }
}

const result = await new ResearchFlow().kickoff({
  inputs: { topic: "CrewAI" },
});
```

TypeScript does not widen class instance types from decorators, so the
`interface ResearchFlow extends FlowRuntime<ResearchState> {}` merge lets
`new ResearchFlow().kickoff()` typecheck.

## Persistence

Save and restore flow state across process restarts:

```ts
import { flow, JsonFlowPersistence, SQLiteFlowPersistence } from "@crewai-ts/flow";

const runtime = flow(new ResearchFlow(), {
  persistence: new JsonFlowPersistence("./.flows"),
});
```

Runtime state can live in a `FlowStateBackend` when you opt in with
`stateBackend`, such as `new InMemoryFlowStateBackend()` for local state or a
Redis/SQL implementation. State is saved after each method and whenever
`ctx.commitState()` is called.

## Human Feedback

Request human feedback during flow execution:

```ts
import { Flow, humanFeedback, listen, start, type FlowContext, type FlowRuntime } from "@crewai-ts/flow";

type ReviewState = { draft?: string };

interface ReviewFlow extends FlowRuntime<ReviewState> {}

@Flow<ReviewState>()
class ReviewFlow {
  @start()
  @humanFeedback({
    message: "Review this draft",
    emit: ["approved", "rejected"],
  })
  draft(ctx: FlowContext<ReviewState>) {
    ctx.state.draft = "Draft content";
    return "Draft content";
  }

  @listen("approved")
  publish(ctx: FlowContext<ReviewState>) {
    return ctx.state.draft;
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
import { flow } from "@crewai-ts/flow";

const runtime = flow(new ResearchFlow(), {
  inputProvider: {
    requestInput: async (message, flow, metadata) => ({
      text: "CrewAI",
      metadata: { source: metadata?.channel },
    }),
  },
});

const topic = await runtime.ask("Topic?", { metadata: { channel: "research" } });
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
