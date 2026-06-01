import { Crew } from "./crew.js";
import { CrewOutput } from "./outputs.js";
import { ensureCrewProject } from "./project.js";
import { getCrewMetadata, initializeCrewMetadata, registerCrewMethod, type MethodKind } from "./metadata.js";
import { registerCrewScopedHooks } from "./hooks.js";
import type { Agent } from "./agent.js";
import type { Task } from "./task.js";
import type { InputValues } from "./types.js";

type AnyMethod<This = unknown, Args extends unknown[] = unknown[], Return = unknown> = (
  this: This,
  ...args: Args
) => Return;
const instanceCache = new WeakMap<object, Map<string | symbol, unknown>>();

function mark(kind: MethodKind) {
  return function decorate<This extends object, Args extends unknown[], Return>(
    value: AnyMethod<This, Args, Return>,
    context: ClassMethodDecoratorContext<This, AnyMethod<This, Args, Return>>,
  ): AnyMethod<This, Args, Return> {
    context.addInitializer(function init(this: This) {
      registerCrewMethod(Object.getPrototypeOf(this) as object, { name: context.name, kind });
    });

    if (
      kind === "agent"
      || kind === "task"
      || kind === "tool"
      || kind === "llm"
      || kind === "callback"
      || kind === "outputJson"
      || kind === "outputPydantic"
      || kind === "cacheHandler"
    ) {
      return function memoized(this: This, ...args: Args): Return {
        if (args.length > 0) {
          return value.call(this, ...args);
        }
        let cache = instanceCache.get(this);
        if (!cache) {
          cache = new Map();
          instanceCache.set(this, cache);
        }
        if (!cache.has(context.name)) {
          cache.set(context.name, (value as AnyMethod<This, [], Return>).call(this));
        }
        return cache.get(context.name) as Return;
      };
    }

    return value;
  };
}

export const agent = mark("agent");
export const task = mark("task");
export const beforeKickoff = mark("beforeKickoff");
export const before_kickoff = beforeKickoff;
export const afterKickoff = mark("afterKickoff");
export const after_kickoff = afterKickoff;
export const tool = mark("tool");
export const llm = mark("llm");
export const callback = mark("callback");
export const outputJson = mark("outputJson");
export const output_json = outputJson;
export const outputPydantic = mark("outputPydantic");
export const output_pydantic = outputPydantic;
export const cacheHandler = mark("cacheHandler");
export const cache_handler = cacheHandler;

export function crew<This extends object, Args extends unknown[]>(
  value: AnyMethod<This, Args, Crew>,
  context: ClassMethodDecoratorContext<This, AnyMethod<This, Args, Crew>>,
): AnyMethod<This, Args, Crew> {
  const decorated = mark("crew")(value, context);
  return function crewWrapper(this: This, ...args: Args): Crew {
    ensureCrewProject(this);
    const entries = getCrewMetadata(this);
    const taskEntries = entries.filter((entry) => entry.kind === "task");
    const agentEntries = entries.filter((entry) => entry.kind === "agent");
    const instantiatedTasks = taskEntries.map((entry) => ensureTaskName(
      callMethod(this, entry.name) as Task,
      entry.name,
    ));
    const instantiatedAgents: Agent[] = [];
    const roles = new Set<string>();

    for (const taskInstance of instantiatedTasks) {
      const taskAgent = taskInstance.agent;
      if (taskAgent && !roles.has(taskAgent.role)) {
        roles.add(taskAgent.role);
        instantiatedAgents.push(taskAgent);
      }
    }
    for (const entry of agentEntries) {
      const agentInstance = callMethod(this, entry.name) as Agent;
      if (!roles.has(agentInstance.role)) {
        roles.add(agentInstance.role);
        instantiatedAgents.push(agentInstance);
      }
    }

    Object.assign(this, {
      agents: instantiatedAgents,
      tasks: instantiatedTasks,
    });

    const crewInstance = decorated.call(this, ...args);
    if (!(crewInstance instanceof Crew)) {
      throw new Error(`@crew method '${String(context.name)}' must return a Crew instance.`);
    }
    if (crewInstance.name === "crew") {
      crewInstance.name = this.constructor.name;
    }
    crewInstance.agents = instantiatedAgents;
    crewInstance.tasks = instantiatedTasks;
    crewInstance.configureAgents();
    crewInstance.beforeKickoffCallbacks.push(
      ...entries
        .filter((entry) => entry.kind === "beforeKickoff")
        .map((entry) => (input: InputValues) => callMethod(this, entry.name, input) as InputValues),
    );
    crewInstance.afterKickoffCallbacks.push(
      ...entries
        .filter((entry) => entry.kind === "afterKickoff")
        .map((entry) => (output: CrewOutput) => callMethod(this, entry.name, output) as CrewOutput),
    );
    return crewInstance;
  };
}

export function CrewBase<T extends abstract new (...args: never[]) => object>(
  constructor: T,
  context: ClassDecoratorContext<T>,
): T {
  context.addInitializer(function init() {
    initializeCrewMetadata(constructor);
  });
  const WrappedCrewBase = class extends (constructor as unknown as new (...args: never[]) => object) {
    constructor(...args: never[]) {
      super(...args);
      registerCrewScopedHooks(this);
    }
  };
  Object.defineProperty(WrappedCrewBase, "name", { value: constructor.name });
  return WrappedCrewBase as unknown as T;
}

function callMethod(instance: object, name: string | symbol, ...args: unknown[]): unknown {
  const method = (instance as Record<string | symbol, unknown>)[name];
  if (typeof method !== "function") {
    throw new Error(`Crew method '${String(name)}' is not callable.`);
  }
  return method.call(instance, ...args) as unknown;
}

function ensureTaskName(taskInstance: Task, methodName: string | symbol): Task {
  if (taskInstance.name) {
    return taskInstance;
  }
  Object.assign(taskInstance, { name: String(methodName) });
  return taskInstance;
}
