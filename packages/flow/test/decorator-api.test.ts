import { describe, expect, it } from "vitest";

import { Flow, and_, flow, listen, or_, router, start } from "../src/index.js";
import type {
  FlowContext,
  FlowRuntime,
  FlowStateBackend,
  FlowStateBackendSaveMetadata,
} from "../src/index.js";

type MethodDecoratorHarness = (
  value: never,
  context: never,
) => unknown;

type ClassDecoratorHarness = (
  value: never,
  context: never,
) => unknown;

type ResearchState = {
  topic?: string;
  done?: boolean;
  events: string[];
};

class RecordingBackend<TState extends object> implements FlowStateBackend<TState> {
  readonly loads: string[] = [];
  readonly saves: Array<{
    flowId: string;
    state: TState;
    metadata: FlowStateBackendSaveMetadata;
  }> = [];

  async load(flowId: string): Promise<TState | null> {
    this.loads.push(flowId);
    return null;
  }

  async save(flowId: string, state: TState, metadata: FlowStateBackendSaveMetadata): Promise<void> {
    this.saves.push({
      flowId,
      state: structuredClone(state),
      metadata,
    });
  }
}

describe("@Flow decorator API", () => {
  it("runs plain decorated classes with FlowContext state", async () => {
    class ResearchFlowBase {
      begin(ctx: FlowContext<ResearchState>, inputs: { topic: string }) {
        expect("state" in this).toBe(false);
        ctx.state.topic = inputs.topic;
        ctx.state.events.push(`begin:${inputs.topic}`);
        return inputs.topic;
      }

      route(ctx: FlowContext<ResearchState>, topic: string) {
        ctx.state.events.push(`route:${topic}`);
        return topic.length > 0 ? "finish" : "skip";
      }

      complete(ctx: FlowContext<ResearchState>, routeName: string) {
        ctx.state.done = true;
        ctx.state.events.push(`finish:${routeName}`);
        return ctx.state.topic;
      }
    }

    const initializers = [
      decorateMethod(ResearchFlowBase, "begin", start() as unknown as MethodDecoratorHarness),
      decorateMethod(ResearchFlowBase, "route", router("begin") as unknown as MethodDecoratorHarness),
      decorateMethod(ResearchFlowBase, "complete", listen(and_("begin", or_("finish", "manual"))) as unknown as MethodDecoratorHarness),
    ];
    const ResearchFlow = decorateClass(ResearchFlowBase, Flow<ResearchState>({
      initialState: () => ({ done: false, events: [] }),
    }) as unknown as ClassDecoratorHarness);
    const runtime = new ResearchFlow() as InstanceType<typeof ResearchFlow> & FlowRuntime<ResearchState>;
    initializers.forEach((initializer) => {
      initializer.call(runtime);
    });

    const result = await runtime.kickoff({ inputs: { topic: "CrewAI" } });

    expect(result).toBe("CrewAI");
    expect(runtime.stateSnapshot()).toMatchObject({
      topic: "CrewAI",
      done: true,
      events: ["begin:CrewAI", "route:CrewAI", "finish:finish"],
    });
  });

  it("starts each non-persistent decorated kickoff from a fresh initial state", async () => {
    class RepeatFlowBase {
      begin(ctx: FlowContext<ResearchState>, inputs: { topic: string }) {
        ctx.state.topic = inputs.topic;
        ctx.state.events.push(`begin:${inputs.topic}`);
        return ctx.state.events.length;
      }
    }

    const initializer = decorateMethod(RepeatFlowBase, "begin", start() as unknown as MethodDecoratorHarness);
    const RepeatFlow = decorateClass(RepeatFlowBase, Flow<ResearchState>({
      initialState: () => ({ events: [] }),
    }) as unknown as ClassDecoratorHarness);
    const runtime = new RepeatFlow() as InstanceType<typeof RepeatFlow> & FlowRuntime<ResearchState>;
    initializer.call(runtime);

    await expect(runtime.kickoff({ inputs: { topic: "first" } })).resolves.toBe(1);
    expect(runtime.stateSnapshot()).toMatchObject({
      topic: "first",
      events: ["begin:first"],
    });

    await expect(runtime.kickoff({ inputs: { topic: "second" } })).resolves.toBe(1);
    expect(runtime.stateSnapshot()).toMatchObject({
      topic: "second",
      events: ["begin:second"],
    });
  });

  it("loads and saves state through the backend at commit and method completion", async () => {
    const backend = new RecordingBackend<ResearchState>();

    class BackendFlowBase {
      async begin(ctx: FlowContext<ResearchState>, inputs: { id: string; topic: string }) {
        ctx.state.topic = inputs.topic;
        ctx.state.events.push("manual");
        await ctx.commitState();
        ctx.state.events.push("auto");
        return "done";
      }
    }

    const initializer = decorateMethod(BackendFlowBase, "begin", start() as unknown as MethodDecoratorHarness);
    const BackendFlow = decorateClass(BackendFlowBase, Flow<ResearchState>({
      initialState: () => ({ events: [] }),
      stateBackend: backend,
    }) as unknown as ClassDecoratorHarness);
    const runtime = new BackendFlow() as InstanceType<typeof BackendFlow> & FlowRuntime<ResearchState>;
    initializer.call(runtime);

    await expect(runtime.kickoff({ inputs: { id: "flow-1", topic: "CrewAI" } })).resolves.toBe("done");

    expect(backend.loads).toEqual(["flow-1"]);
    expect(backend.saves.map((entry) => entry.flowId)).toEqual(["flow-1", "flow-1"]);
    expect(backend.saves[0]?.state).toMatchObject({ events: ["manual"], topic: "CrewAI" });
    expect(backend.saves[1]?.state).toMatchObject({ events: ["manual", "auto"], topic: "CrewAI" });
    expect(backend.saves[1]?.metadata.methodName).toBe("begin");
  });

  it("uses the kickoff backend id for saves even when methods replace state", async () => {
    const backend = new RecordingBackend<ResearchState>();

    class ReplacingStateFlowBase {
      async begin(ctx: FlowContext<ResearchState>, inputs: { id: string; topic: string }) {
        await ctx.replaceState({ topic: inputs.topic, events: ["replaced"] });
        ctx.state.events.push("auto");
        return "done";
      }
    }

    const initializer = decorateMethod(ReplacingStateFlowBase, "begin", start() as unknown as MethodDecoratorHarness);
    const ReplacingStateFlow = decorateClass(ReplacingStateFlowBase, Flow<ResearchState>({
      initialState: () => ({ events: [] }),
      stateBackend: backend,
    }) as unknown as ClassDecoratorHarness);
    const runtime = new ReplacingStateFlow() as InstanceType<typeof ReplacingStateFlow> & FlowRuntime<ResearchState>;
    initializer.call(runtime);

    await expect(runtime.kickoff({ inputs: { id: "flow-1", topic: "CrewAI" } })).resolves.toBe("done");

    expect(backend.loads).toEqual(["flow-1"]);
    expect(backend.saves.map((entry) => entry.flowId)).toEqual(["flow-1", "flow-1"]);
    expect(backend.saves[0]?.state).toMatchObject({ events: ["replaced"], topic: "CrewAI" });
    expect(backend.saves[1]?.state).toMatchObject({ events: ["replaced", "auto"], topic: "CrewAI" });
  });

  it("supports explicit flow(instance, options) composition", async () => {
    class PlainFlow {
      begin(ctx: FlowContext<ResearchState>, inputs: { topic: string }) {
        ctx.state.topic = inputs.topic;
        ctx.state.events.push("begin");
        return inputs.topic;
      }
    }

    const initializer = decorateMethod(PlainFlow, "begin", start() as unknown as MethodDecoratorHarness);
    const runtime = flow<PlainFlow, ResearchState>(new PlainFlow(), {
      initialState: () => ({ events: [] }),
    });
    initializer.call(runtime);

    await expect(runtime.kickoff({ inputs: { topic: "CrewAI" } })).resolves.toBe("CrewAI");
    expect(runtime.stateSnapshot()).toMatchObject({
      topic: "CrewAI",
      events: ["begin"],
    });
  });
});

function decorateMethod<T extends object>(
  constructor: new () => T,
  name: keyof T & string,
  decorator: MethodDecoratorHarness,
): (this: T) => void {
  const initializers: Array<(this: T) => void> = [];
  type TestMethod = (this: T, ...args: unknown[]) => unknown;
  const prototype = constructor.prototype as Record<string, unknown>;
  const original = prototype[name] as TestMethod;
  const applyDecorator = decorator as unknown as (
    value: TestMethod,
    context: ClassMethodDecoratorContext<T, TestMethod>,
  ) => TestMethod | undefined;
  const replacement = applyDecorator(original, {
    kind: "method",
    name,
    static: false,
    private: false,
    access: {
      has: (object: T) => name in object,
      get: (object: T) => (object as Record<string, unknown>)[name] as TestMethod,
    },
    addInitializer: (init: (this: T) => void) => {
      initializers.push(init);
    },
    metadata: undefined,
  });

  if (replacement !== undefined) {
    Object.defineProperty(constructor.prototype, name, {
      configurable: true,
      writable: true,
      value: replacement,
    });
  }

  const initializer = initializers[0];
  if (!initializer) {
    throw new Error(`Decorator '${name}' did not register an initializer.`);
  }
  return initializer;
}

function decorateClass<T extends new () => object>(
  constructor: T,
  decorator: ClassDecoratorHarness,
): T {
  const initializers: Array<(this: T) => void> = [];
  const applyDecorator = decorator as unknown as (
    value: T,
    context: ClassDecoratorContext<T>,
  ) => T | undefined;
  const replacement = applyDecorator(constructor, {
    kind: "class",
    name: constructor.name,
    addInitializer: (init: (this: T) => void) => {
      initializers.push(init);
    },
    metadata: undefined,
  });
  const decorated = replacement ?? constructor;
  initializers.forEach((initializer) => {
    initializer.call(decorated);
  });
  return decorated;
}
