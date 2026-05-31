import { readFileSync } from "node:fs";
import { parse } from "yaml";

import { ensureCrewProject, loadConfig, mapAgentVariables, mapTaskVariables } from "./project.js";
import { getCrewMetadata } from "./metadata.js";

export const P = Object.freeze({ kind: "ParamSpec" });
export const P2 = Object.freeze({ kind: "ParamSpec" });
export const R = Object.freeze({ kind: "TypeVar" });
export const R2 = Object.freeze({ kind: "TypeVar" });
export const T = Object.freeze({ kind: "TypeVar" });
export const SelfT = Object.freeze({ kind: "TypeVar" });
export const TaskResultT = Object.freeze({ kind: "TypeVar" });
export const CallableT = Object.freeze({ kind: "TypeVar" });

export const AgentConfig = Object.freeze({ kind: "AgentConfig" });
export const TaskConfig = Object.freeze({ kind: "TaskConfig" });
export const CrewMetadata = Object.freeze({ kind: "CrewMetadata" });
export const CrewInstance = Object.freeze({ kind: "CrewInstance" });
export const CrewClass = Object.freeze({ kind: "CrewClass" });
export const TaskResult = Object.freeze({ kind: "TaskResult" });
export const OutputClass = Object.freeze({ kind: "OutputClass" });
export const OutputJsonClass = Object.freeze({ kind: "OutputJsonClass" });
export const OutputPydanticClass = Object.freeze({ kind: "OutputPydanticClass" });

type AnyFunction = (...args: readonly unknown[]) => unknown;

export class DecoratedMethod {
  readonly _meth: AnyFunction;
  readonly __name__: string;
  readonly __doc__: string | null;

  constructor(method: AnyFunction) {
    this._meth = method;
    this.__name__ = method.name;
    this.__doc__ = null;
  }

  call(thisArg: unknown, ...args: readonly unknown[]): unknown {
    return this._meth.apply(thisArg, [...args]);
  }

  invoke(...args: readonly unknown[]): unknown {
    return this._meth(...args);
  }

  unwrap(): AnyFunction {
    return this._meth;
  }
}

export class BeforeKickoffMethod extends DecoratedMethod {
  readonly is_before_kickoff = true;
}

export class AfterKickoffMethod extends DecoratedMethod {
  readonly is_after_kickoff = true;
}

export class AgentMethod extends DecoratedMethod {
  readonly is_agent = true;
}

export class TaskMethod extends DecoratedMethod {
  readonly is_task = true;

  ensureTaskName<TResult>(result: TResult): TResult {
    const candidate: unknown = result;
    if (typeof candidate === "object" && candidate !== null && "name" in candidate && !Reflect.get(candidate, "name")) {
      Reflect.set(candidate, "name", this.__name__);
    }
    return result;
  }

  ensure_task_name<TResult>(result: TResult): TResult {
    return this.ensureTaskName(result);
  }

  override call(thisArg: unknown, ...args: readonly unknown[]): unknown {
    return this.ensureTaskName(super.call(thisArg, ...args));
  }

  override invoke(...args: readonly unknown[]): unknown {
    return this.ensureTaskName(super.invoke(...args));
  }
}

export class CrewMethod extends DecoratedMethod {
  readonly is_crew = true;
}

export class ToolMethod extends DecoratedMethod {
  readonly is_tool = true;
}

export class LLMMethod extends DecoratedMethod {
  readonly is_llm = true;
}

export class CallbackMethod extends DecoratedMethod {
  readonly is_callback = true;
}

export class CacheHandlerMethod extends DecoratedMethod {
  readonly is_cache_handler = true;
}

export class OutputJsonMethod extends DecoratedMethod {
  readonly is_output_json = true;
}

export class OutputPydanticMethod extends DecoratedMethod {
  readonly is_output_pydantic = true;
}

export class BoundTaskMethod {
  readonly is_task = true;
  private readonly taskMethod: TaskMethod;
  private readonly instance: unknown;

  constructor(taskMethod: TaskMethod, instance: unknown) {
    this.taskMethod = taskMethod;
    this.instance = instance;
  }

  call(...args: readonly unknown[]): unknown {
    return this.taskMethod.call(this.instance, ...args);
  }
}

export const CrewBaseMeta = {
  initialize(instance: object): object {
    ensureCrewProject(instance);
    return instance;
  },
};

export function loadYaml(configPath: string): Record<string, unknown> {
  const parsed: unknown = parse(readFileSync(configPath, "utf8"));
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : {};
}

export const load_yaml = loadYaml;

export function loadConfigurations(instance: object): void {
  ensureCrewProject(instance);
}

export const load_configurations = loadConfigurations;

export function mapAllAgentVariables(instance: object): void {
  const state = ensureCrewProject(instance);
  mapAgentVariables(instance, state);
}

export const map_all_agent_variables = mapAllAgentVariables;

export function mapAllTaskVariables(instance: object): void {
  const state = ensureCrewProject(instance);
  mapTaskVariables(instance, state);
}

export const map_all_task_variables = mapAllTaskVariables;

export function closeMcpServer<TOutput>(_instance: object, output: TOutput): TOutput {
  return output;
}

export const close_mcp_server = closeMcpServer;

export const cache = new Map<string, unknown>();

export function getMcpTools(instance: object): unknown[] {
  const record = instance as Record<string, unknown>;
  const maybeTools = record.mcpTools ?? record.mcp_tools;
  return Array.isArray(maybeTools) ? maybeTools : [];
}

export const get_mcp_tools = getMcpTools;

export function memoize<TFunction extends AnyFunction>(method: TFunction): TFunction {
  const cache = new Map<string, unknown>();
  return function memoized(this: unknown, ...args: readonly unknown[]) {
    const key = stableKey(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = method.apply(this, [...args]);
    cache.set(key, result);
    return result;
  } as TFunction;
}

export function getAllMethods(instance: object): Record<string, unknown> {
  const methods: Record<string, unknown> = {};
  let current: object | null = instance;
  while (current && current !== Object.prototype) {
    for (const name of Object.getOwnPropertyNames(current)) {
      if (name === "constructor") {
        continue;
      }
      const value = (instance as Record<string, unknown>)[name];
      if (typeof value === "function") {
        methods[name] = value;
      }
    }
    current = Object.getPrototypeOf(current) as object | null;
  }
  return methods;
}

export const get_all_methods = getAllMethods;

export function crewMetadataFor(instance: object): Record<string, unknown> {
  const metadata = getCrewMetadata(instance);
  return {
    original_methods: getAllMethods(instance),
    original_tasks: Object.fromEntries(metadata.filter((entry) => entry.kind === "task").map((entry) => [String(entry.name), Reflect.get(instance, entry.name)])),
    original_agents: Object.fromEntries(metadata.filter((entry) => entry.kind === "agent").map((entry) => [String(entry.name), Reflect.get(instance, entry.name)])),
    before_kickoff: Object.fromEntries(metadata.filter((entry) => entry.kind === "beforeKickoff").map((entry) => [String(entry.name), Reflect.get(instance, entry.name)])),
    after_kickoff: Object.fromEntries(metadata.filter((entry) => entry.kind === "afterKickoff").map((entry) => [String(entry.name), Reflect.get(instance, entry.name)])),
    kickoff: Object.fromEntries(metadata.filter((entry) => entry.kind === "crew").map((entry) => [String(entry.name), Reflect.get(instance, entry.name)])),
  };
}

export function loadProjectConfig(path: string): Record<string, unknown> {
  return loadConfig(path);
}

function stableKey(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      return Object.fromEntries(Object.entries(item as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)));
    }
    return item;
  });
}
