# crewai-ts

TypeScript port of CrewAI.

## Current port surface

- `Agent`, `Task`, `ConditionalTask`, `Crew`
- `LiteAgent` and `LiteAgentOutput` compatibility layer for direct agent execution
- `Flow` with standard TS `@start`, `@listen`, `@router`, `or_`, `and_`, `ask()` input providers, and `@humanFeedback`
- sequential `Crew.kickoff({ inputs })`
- `TaskOutput` and `CrewOutput`
- standard TS decorators: `@agent`, `@task`, `@crew`, `@beforeKickoff`, `@afterKickoff`, `@outputJson`, `@outputPydantic`, `@start`, `@listen`, `@router`
- `CrewProject` YAML/object config loading for `agentsConfig` and `tasksConfig`
- `BaseTool` / `StructuredTool` with argument validation, usage limits, tool-call execution, and task-level tool overrides
- automatic `read_file` tool for named task, crew, and agent input files
- tool result caching with `cacheFunction` and shareable `InMemoryToolCache`
- crew `cache: false` control for disabling library tool result caching
- sequential process async task scheduling, including sync barriers and CrewAI-style async validation
- typed `crewaiEventBus` lifecycle events for crew kickoff, task execution, tool usage, and failures
- agent and crew `stepCallback` hooks for tool/final agent steps
- crew-level `taskCallback` hooks after task callbacks, with duplicate callback suppression
- global before/after LLM and tool call hooks
- security `Fingerprint` / `SecurityConfig` on agents, crews, and tasks
- checkpoint `CheckpointConfig`, filesystem `JsonProvider`, and SQLite `SqliteProvider`
- state `EventRecord` / `EventNode` graph for event relationship tracking
- state `RuntimeState` checkpoint serialization, restore, lineage, and fork helpers
- crew `outputLogFile` task execution logs in text or JSON files
- crew `executionLogs` and `taskExecutionOutputJsonFiles` for per-task audit records
- crew `replay(taskRef, inputs?)` from a task id, name, index, or task object
- `Memory` / `MemoryScope` with recall/save tools injected into crews when memory is enabled
- `Knowledge` sources (`StringKnowledgeSource`, `TextFileKnowledgeSource`, `JSONKnowledgeSource`, `CSVKnowledgeSource`) with agent and crew context injection
- hierarchical process with manager agent/manager LLM validation and coworker delegation tools
- sequential `allowDelegation` agents with coworker delegate/question tools
- function or object LLM providers with tool-call options, string model registry, and token usage aggregation
- iterative agent tool-use loop with `maxIter` and `resultAsAnswer` support
- agent `maxRetryLimit` retries around task execution failures
- agent `maxExecutionTime` timeout enforcement for task execution
- agent `useSystemPrompt` control for models that do not accept system-role messages
- deprecated CrewAI agent compatibility fields: `allowCodeExecution`, `codeExecutionMode`, `respectContextWindow`, `multimodal`
- agent `systemTemplate`, `promptTemplate`, and `responseTemplate` prompt rendering
- agent `injectDate` / `dateFormat` prompt injection
- callable agent `guardrail` with retry-limit enforcement
- agent-level `PlanningConfig`, `planning`, and legacy `reasoning` compatibility
- agent and crew `maxRpm` throttling for LLM calls
- `kickoffForEach` / `kickoffForEachAsync` batch execution with aggregate usage metrics
- crew-level planning that injects per-task execution plans before kickoff
- CrewAI-style default task context aggregation from previous task outputs
- task `outputFile` writing with input interpolation and safe path validation
- task `inputFiles` / `input_files` text file prompt injection
- task `outputConverter` / `converter_cls` hooks for structured output conversion
- structured task interpolation for strings, numbers, booleans, arrays, objects, and `null`
- single or ordered multiple task `guardrails` with retry support
- task `humanInput` feedback loops with injectable providers
- task execution counters: `usedTools`, `toolsErrors`, `delegations`, `promptContext`, `processedByAgents`
- task `allowCrewaiTriggerContext` support for `crewai_trigger_payload` kickoff inputs
- `ConditionalTask` skip logic based on the previous task output
- basic `stream: true` crew and flow outputs via `CrewStreamingOutput` / `FlowStreamingOutput`

Decorators store only library-private metadata. They do not use
`reflect-metadata`, parameter decorators, or Nest metadata, so Nest applications
should consume this package as a normal TypeScript library and keep Nest DI
separate.

CrewAI Python-style snake_case aliases are available for common async entry
points, including `kickoff_async`, `kickoff_for_each`,
`kickoff_for_each_async`, `akickoff_for_each`, `resume_async`, `from_pending`,
and `from_state`.

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
    return new Crew({ process: Process.sequential });
  }
}

const result = await new ResearchCrew().crew().kickoff({
  inputs: { topic: "CrewAI" },
});

const batchResults = await new ResearchCrew().crew().kickoffForEach({
  inputs: [{ topic: "CrewAI" }, { topic: "TypeScript" }],
});
```

## Streaming

Set `stream: true` on a crew or flow to receive a streaming output wrapper from
`kickoff()`. The current TypeScript port exposes the final output as an async
stream chunk and makes the complete result available after iteration.

```ts
import { CrewStreamingOutput } from "@crewai-ts/core";

const streaming = await crew.kickoff() as unknown as CrewStreamingOutput;

for await (const chunk of streaming) {
  console.log(chunk.content);
}

console.log(streaming.result.raw);
```

## LiteAgent

`LiteAgent` mirrors CrewAI's deprecated lightweight direct-execution API while
reusing the main `Agent` runtime internally. It returns `LiteAgentOutput`, keeps
the executed messages, exposes usage metrics, and supports the common
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

## Hooks

Register global hooks to inspect, mutate, or block LLM and tool calls. Hook
contexts expose CrewAI-compatible camelCase and snake_case fields where useful.

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
  backstory: "Careful analyst",
  securityConfig,
});

console.log(agent.fingerprint.uuid_str);
```

## Checkpoints

`CheckpointConfig`, `JsonProvider`, and `SqliteProvider` provide CrewAI-compatible
checkpoint configuration and checkpoint storage. Agents, crews, and flows accept
a `checkpoint` option.

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

## Tools

Tools can be attached to agents or tasks. Task tools take precedence during that
task, matching CrewAI's task-level override behavior.

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
  backstory: "Careful analyst",
  tools: [search],
  maxRpm: 30,
  stepCallback: (step) => {
    console.log(step.type, step.output);
  },
  llm: () => ({ toolName: "search", arguments: { query: "CrewAI" } }),
});

const task = new Task({
  description: "Research {topic}",
  expectedOutput: "A concise brief",
  agent: researcher,
  guardrails: [
    (output) => [output.raw.length > 0, output.raw],
  ],
});
```

When an LLM returns a tool call, the agent executes the tool, appends the tool
result to the message list, and calls the LLM again until it returns a final
answer or reaches `maxIter`. Tools marked `resultAsAnswer` return their tool
output directly. Set `functionCallingLlm` on an `Agent` or `Crew` when tool-call
selection should use a separate model from the main answer-generating LLM.

Tools cache successful outputs by normalized arguments. Use `cacheFunction` to
skip selected writes, or pass a shared `InMemoryToolCache` to reuse cached
results across tool instances.

## LLM providers

Agents accept either a function LLM, an object provider with `call()`, or a
registered model name. Function LLMs receive the message list and call options;
object providers can expose `getUsageMetrics()` or CrewAI-style
`getTokenUsageSummary()` for exact token accounting. When they do not, the
runtime records an estimated usage count.

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

const researcher = new Agent({
  role: "Researcher",
  goal: "Find facts",
  backstory: "Careful analyst",
  llm: "local/research",
});

await researcher.kickoff("Summarize the notes", {
  inputFiles: {
    notes: "docs/notes.txt",
  },
});

await researcher.kickoff([
  {
    role: "user",
    content: "Summarize the uploaded notes",
    files: {
      notes: "docs/notes.txt",
    },
  },
]);
```

## Agent planning

Agents can create a reasoning plan before executing a task. `planning: true`
uses a bounded low-effort default config, while `PlanningConfig` exposes the
custom prompt and limit knobs.

```ts
import { Agent, PlanningConfig } from "@crewai-ts/core";

const researcher = new Agent({
  role: "Researcher",
  goal: "Find facts",
  backstory: "Careful analyst",
  llm: "local/research",
  planningConfig: new PlanningConfig({
    maxSteps: 10,
    planPrompt: "Plan this task: {description}",
  }),
});

const answer = await researcher.kickoff("Research CrewAI");
```

## Flows

Flows run decorated methods as a stateful workflow. `@start` methods begin the
run, `@listen` methods react to completed methods or router path strings, and
`@router` methods return the next path label.

```ts
import { Flow, and_, listen, router, start } from "@crewai-ts/core";

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

  @listen(and_("research", "begin"))
  finish() {
    this.state.done = true;
    return `researched ${this.state.topic}`;
  }
}

const result = await new ResearchFlow().kickoff({
  inputs: { topic: "CrewAI" },
});
```

`@start("path")` is also supported for conditional starts after a method or
router path fires. Flow execution is bounded by `maxMethodCalls` so cyclic
flows fail clearly instead of running forever.

Inside a flow, use `this.kickoffCrew(crew)` to run a crew with the flow's
`inputFiles` / `input_files` automatically forwarded.

Flows can request user input through `this.ask()`. Set an `inputProvider` on
the flow instance or `flowConfig.inputProvider` globally. Providers may return
a string, `null`, or `{ text, metadata }`; responses are available through
`flow.inputHistory`.

```ts
const flow = new ResearchFlow({
  inputProvider: {
    requestInput: async (_message, _flow, metadata) => ({
      text: "CrewAI",
      metadata: { source: metadata?.channel },
    }),
  },
});

const topic = await flow.ask("Topic?", {
  metadata: { channel: "research" },
  timeout: 30,
});
```

Flow methods can also be wrapped with `@humanFeedback`. The method output is
sent to a feedback provider, the result is stored on
`flow.lastHumanFeedback` / `flow.humanFeedbackHistory`, and `emit` values make
the method act as a router.

```ts
class ReviewFlow extends Flow {
  @start()
  @humanFeedback({
    message: "Review this draft",
    emit: ["approved", "rejected"],
    provider: {
      requestFeedback: async () => "approved",
    },
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

Providers that hand off review to an external system can throw
`HumanFeedbackPending`. `kickoff()` returns that object, emits
`method_execution_paused` and `flow_paused`, and does not treat the pause as a
Flow failure. The same Flow instance can continue with `resume(feedback)` or
`resumeAsync(feedback)`, which records `lastHumanFeedback` and resumes any
listeners waiting on the paused method or emitted outcome.

```ts
provider: {
  requestFeedback: (context) => {
    throw new HumanFeedbackPending({
      context,
      callbackInfo: { ticketId: "review-123" },
    });
  },
}
```

To resume after process restart, provide a `JsonFlowPersistence` in the Flow
constructor. Pending feedback is written with the current state and can be
restored with `Flow.fromPending(flowId, persistence)`.

```ts
const persistence = new JsonFlowPersistence(".flows");
const pending = await flow.kickoff();

if (pending instanceof HumanFeedbackPending && pending.context.flowId) {
  const restored = await ReviewFlow.fromPending(pending.context.flowId, persistence);
  await restored.resume("approved");
}
```

The same persistence object stores ordinary Flow state after each completed
method. Use `Flow.fromState(flowId, persistence)` to restore the latest state
snapshot for a Flow id.

After a run, `flow.methodOutputs`, `flow.completedMethods`,
`flow.methodExecutionCounts`, and `flow.executionTrace` expose the last
execution's method-level runtime state.

Use `getFlowStructure(flowOrClass)` to inspect the static Flow graph for
visualization or tooling.

Use `flow.toExecutionData()` and `flow.reload(data)` to export and restore the
last run's state, completed methods, method outputs, and execution trace.
Flows emit `flow_started`, `flow_input_requested`, `flow_input_received`,
`human_feedback_requested`, `human_feedback_received`,
`method_execution_started`, `method_execution_finished`,
`method_execution_failed`, `method_execution_paused`, `flow_finished`,
`flow_failed`, and `flow_paused` events on `crewaiEventBus`.

## Task output files

Tasks can persist their final output to a file. Paths support the same input
interpolation as task descriptions, and directories are created by default.

```ts
const report = new Task({
  description: "Research {topic}",
  expectedOutput: "A concise brief",
  agent: researcher,
  outputFile: "reports/{topic}.md",
});
```

## Task input files

Tasks can attach named text input files. The runtime loads their content into
the task prompt so function LLMs and text-only providers can consume the same
named file surface. When input files are present, the runtime also exposes a
`read_file` tool that accepts `{ file_name: "notes" }`.

```ts
const task = new Task({
  description: "Summarize the provided notes",
  expectedOutput: "A concise summary",
  agent: researcher,
  inputFiles: {
    notes: "docs/notes.txt",
    inline: {
      filename: "brief.md",
      contentType: "text/markdown",
      content: "# Brief\nSummarize this.",
    },
  },
});

const result = await new Crew({ agents: [researcher], tasks: [task] }).kickoff({
  inputFiles: {
    sharedNotes: "docs/shared-notes.txt",
  },
});
```

Structured file objects passed through `kickoff({ inputs })` are extracted into
the same input-file surface and removed from interpolation inputs. Raw string
inputs are left untouched, so normal values such as `"docs/notes.txt"` are not
treated as files unless passed through `inputFiles` / `input_files`.

## Conditional tasks

`ConditionalTask` evaluates the previous task output before running. When its
condition returns false, the crew records an empty raw task output and continues.

```ts
import { ConditionalTask } from "@crewai-ts/core";

const followUp = new ConditionalTask({
  description: "Write follow-up details",
  expectedOutput: "Only needed when the previous task asks for more detail",
  agent: researcher,
  condition: (output) => output.raw.includes("needs follow-up"),
});
```

## Human input

Set `humanInput` on a task to request feedback after the first output. Empty
feedback accepts the output; non-empty feedback is appended to the next prompt
and the task reruns. Server apps should inject their own provider instead of
using terminal input.

```ts
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
  humanInputProvider: {
    requestFeedback: async ({ output }) => {
      return output.raw.includes("approved") ? "" : "Please include approval.";
    },
  },
});
```

## Crew planning

Enable `planning` to run a planner LLM before task execution. The planner returns
one plan per task, and each task prompt receives its current plan without
mutating the original task description.

```ts
const crew = new Crew({
  agents: [researcher],
  tasks: [report],
  planning: true,
  planningLlm: "gpt-4o-mini",
});
```

## Memory

Enable memory on a crew to append relevant memory context to task prompts and
inject recall/save tools into task execution. Agent-level memory is also
available through `new Agent({ memory })` and stores completed agent results.

```ts
import { Agent, Crew, Memory, Process, Task } from "@crewai-ts/core";

const memory = new Memory();
memory.remember("CrewAI supports sequential crews");

const researcher = new Agent({
  role: "Researcher",
  goal: "Use memory",
  backstory: "Careful analyst",
  llm: () => ({
    toolName: "Search_memory",
    arguments: { queries: ["sequential crews"] },
  }),
});

const crew = new Crew({
  agents: [researcher],
  tasks: [
    new Task({
      description: "Recall CrewAI facts",
      expectedOutput: "Relevant memories",
      agent: researcher,
    }),
  ],
  process: Process.sequential,
  memory,
});
```

## Knowledge

Attach `Knowledge` or `knowledgeSources` to an agent or crew to inject relevant
source snippets into task prompts as additional information.

```ts
import { Agent, Crew, StringKnowledgeSource, TextFileKnowledgeSource, Task } from "@crewai-ts/core";

const researcher = new Agent({
  role: "Researcher",
  goal: "Use knowledge",
  backstory: "Careful analyst",
  llm: (messages) => messages.at(-1)?.content ?? "",
});

const crew = new Crew({
  agents: [researcher],
  tasks: [
    new Task({
      description: "Explain Nest integration",
      expectedOutput: "Integration guidance",
      agent: researcher,
    }),
  ],
  knowledgeSources: [
    new StringKnowledgeSource("Nest should consume crewai-ts as a normal TypeScript library."),
    new TextFileKnowledgeSource("knowledge/nest-notes.txt"),
  ],
});

crew.resetMemories("knowledge");
```

## YAML-backed project config

`CrewProject` mirrors CrewAI's `agents.yaml` / `tasks.yaml` workflow. String
references in config are resolved only against this library's decorated methods.

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

## Scripts

- `npm run build` builds ESM output and declarations.
- `npm run check` runs TypeScript in no-emit mode.
- `npm test` runs Vitest.
- `npm run lint` runs ESLint.
