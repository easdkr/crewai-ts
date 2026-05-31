import { randomUUID } from "node:crypto";

import {
  applyExecutionContext,
  captureExecutionContext,
  setCurrentFlowContext,
} from "./context.js";
import { Crew, type KickoffOptions } from "./crew.js";
import {
  FlowCreatedEvent,
  FlowFailedEvent,
  FlowFinishedEvent,
  FlowInputReceivedEvent,
  FlowInputRequestedEvent,
  FlowPausedEvent,
  FlowPlotEvent,
  FlowStartedEvent,
  HumanFeedbackReceivedEvent,
  HumanFeedbackRequestedEvent,
  MethodExecutionFailedEvent,
  MethodExecutionFinishedEvent,
  MethodExecutionPausedEvent,
  MethodExecutionStartedEvent,
  crewaiEventBus,
} from "./events.js";
import type { FlowPersistence } from "./flow-persistence.js";
import { extractInputFilesFromInputs, type InputFiles } from "./input-files.js";
import {
  ConsoleInputProvider,
  flowConfig,
  isInputResponse,
} from "./input-provider.js";
import type { CrewOutput } from "./outputs.js";
import { FlowStreamingOutput } from "./streaming.js";
import { CheckpointConfig, coerceCheckpointConfig, RuntimeState, type CheckpointOption } from "./state.js";
import type { InputValues, MaybePromise } from "./types.js";
import { renderInteractive } from "./flow-visualization.js";
import { Memory, MemoryScope, MemorySlice, sanitize_scope_name, type MemoryMatch, type MemoryRecord } from "./memory.js";

export const AND_CONDITION = "AND";
export const OR_CONDITION = "OR";

export type InputProvider = import("./input-provider.js").InputProvider;
export type InputResponse = import("./input-provider.js").InputResponse;

export type FlowCondition = {
  type: "OR" | "AND";
  conditions: readonly FlowConditionInput[];
};
export const FlowCondition = Object.freeze({ kind: "FlowCondition" });
export const FlowConditionType = Object.freeze({ OR: "OR", AND: "AND" });
export const SimpleFlowCondition = Object.freeze({ kind: "SimpleFlowCondition" });
export const FlowConditions = Object.freeze({ kind: "FlowConditions" });
export const P = Object.freeze({ kind: "ParamSpec" });
export const R = Object.freeze({ kind: "TypeVar" });
export const F = Object.freeze({ kind: "TypeVar" });
export const T = Object.freeze({ kind: "TypeVar" });
export const FlowState = Object.freeze({ kind: "FlowState" });
export const FlowMethodName = String;
export const FlowRouteName = String;
export const PendingListenerKey = String;
export const FlowMethodCallable = Function;
export const FlowMethodData = Object.freeze({ kind: "FlowMethodData" });
export const CompletedMethodData = Object.freeze({ kind: "CompletedMethodData" });
export const ExecutionMethodData = Object.freeze({ kind: "ExecutionMethodData" });
export const FlowData = Object.freeze({ kind: "FlowData" });
export const InputHistoryEntry = Object.freeze({ kind: "InputHistoryEntry" });
export const FlowExecutionData = Object.freeze({ kind: "FlowExecutionData" });
export const FlowStructure = Object.freeze({ kind: "FlowStructure" });
export const InputProvider = Object.freeze({ kind: "InputProvider" });
export const InputResponse = Object.freeze({ kind: "InputResponse" });
export const PendingFeedbackContext = Object.freeze({ kind: "PendingFeedbackContext" });
export const HumanFeedbackProvider = Object.freeze({ kind: "HumanFeedbackProvider" });
export const HumanFeedbackResult = Object.freeze({ kind: "HumanFeedbackResult" });
export const HumanFeedbackConfig = Object.freeze({ kind: "HumanFeedbackConfig" });
export const HumanFeedbackMethod = Object.freeze({ kind: "HumanFeedbackMethod" });
export const PreReviewResult = Object.freeze({ kind: "PreReviewResult" });
export const DistilledLessons = Object.freeze({ kind: "DistilledLessons" });
export const FlowMeta = Object.freeze({ kind: "FlowMeta" });
export const MethodInfo = Object.freeze({ kind: "MethodInfo" });
export const EdgeInfo = Object.freeze({ kind: "EdgeInfo" });
export const StateFieldInfo = Object.freeze({ kind: "StateFieldInfo" });
export const StateSchemaInfo = Object.freeze({ kind: "StateSchemaInfo" });
export const FlowStructureInfo = Object.freeze({ kind: "FlowStructureInfo" });
export const ConsoleProvider = ConsoleInputProvider;
export const flow_config = flowConfig;

export type FlowConditionInput = string | FlowCondition | ((...args: never[]) => unknown);

export type FlowMethodKind = "start" | "listen" | "router";

export type FlowMethodEntry = {
  name: string | symbol;
  kind: FlowMethodKind;
  condition: FlowCondition | null;
};

export type FlowOptions<TState extends object = Record<string, unknown>> = {
  initialState?: TState | (() => TState);
  name?: string | null;
  maxMethodCalls?: number;
  inputProvider?: InputProvider | null;
  persistence?: FlowPersistence | null;
  stream?: boolean;
  checkpoint?: CheckpointOption;
  memory?: Memory | MemoryScope | MemorySlice | null;
};

export class LockedDictProxy<TValue extends Record<string, unknown> = Record<string, unknown>> {
  readonly value: TValue;

  constructor(value: TValue = {} as TValue) {
    this.value = value;
  }

  get(key: string, defaultValue?: unknown): unknown {
    return Object.hasOwn(this.value, key) ? this.value[key] : defaultValue;
  }

  set(key: string, value: unknown): this {
    this.value[key as keyof TValue] = value as TValue[keyof TValue];
    return this;
  }

  delete(key: string): boolean {
    const existed = Object.hasOwn(this.value, key);
    Reflect.deleteProperty(this.value, key);
    return existed;
  }

  has(key: string): boolean {
    return Object.hasOwn(this.value, key);
  }

  update(values: Record<string, unknown>): this {
    Object.assign(this.value, values);
    return this;
  }

  clear(): void {
    for (const key of Object.keys(this.value)) {
      Reflect.deleteProperty(this.value, key);
    }
  }

  keys(): IterableIterator<string> {
    return Object.keys(this.value)[Symbol.iterator]();
  }

  values(): IterableIterator<unknown> {
    return Object.values(this.value)[Symbol.iterator]();
  }

  entries(): IterableIterator<[string, unknown]> {
    return Object.entries(this.value)[Symbol.iterator]();
  }

  items(): IterableIterator<[string, unknown]> {
    return this.entries();
  }

  pop(key: string, defaultValue?: unknown): unknown {
    if (!Object.hasOwn(this.value, key)) {
      if (arguments.length >= 2) {
        return defaultValue;
      }
      throw new Error(`Key not found: ${key}`);
    }
    const current = this.value[key];
    Reflect.deleteProperty(this.value, key);
    return current;
  }

  setdefault(key: string, defaultValue: unknown): unknown {
    if (!Object.hasOwn(this.value, key)) {
      this.value[key as keyof TValue] = defaultValue as TValue[keyof TValue];
    }
    return this.value[key];
  }

  copy(): TValue {
    return { ...this.value };
  }

  [Symbol.iterator](): IterableIterator<[string, unknown]> {
    return this.entries();
  }

  toJSON(): TValue {
    return this.value;
  }
}

export class LockedListProxy<TValue = unknown> {
  [index: number]: TValue;

  readonly value: TValue[];

  constructor(value: readonly TValue[] = []) {
    this.value = value as TValue[];
    return new Proxy(this, {
      get(target, property, receiver) {
        if (typeof property === "string" && isArrayIndex(property)) {
          return target.value[Number(property)];
        }
        return Reflect.get(target, property, receiver);
      },
      set(target, property, nextValue, receiver) {
        if (typeof property === "string" && isArrayIndex(property)) {
          target.value[Number(property)] = nextValue as TValue;
          return true;
        }
        return Reflect.set(target, property, nextValue, receiver);
      },
      deleteProperty(target, property) {
        if (typeof property === "string" && isArrayIndex(property)) {
          target.value.splice(Number(property), 1);
          return true;
        }
        return Reflect.deleteProperty(target, property);
      },
      has(target, property) {
        return property in target.value || property in target;
      },
    });
  }

  get length(): number {
    return this.value.length;
  }

  at(index: number): TValue | undefined {
    return this.value.at(index);
  }

  push(...items: TValue[]): number {
    return this.value.push(...items);
  }

  append(item: TValue): void {
    this.value.push(item);
  }

  pop(index = -1): TValue | undefined {
    const normalized = index < 0 ? this.value.length + index : index;
    if (normalized < 0 || normalized >= this.value.length) {
      return undefined;
    }
    return this.value.splice(normalized, 1)[0];
  }

  extend(items: Iterable<TValue>): void {
    this.value.push(...items);
  }

  insert(index: number, item: TValue): void {
    this.value.splice(index, 0, item);
  }

  remove(item: TValue): void {
    const index = this.value.indexOf(item);
    if (index < 0) {
      throw new Error(`Item not found: ${String(item)}`);
    }
    this.value.splice(index, 1);
  }

  splice(start: number, deleteCount?: number, ...items: TValue[]): TValue[] {
    return deleteCount === undefined
      ? this.value.splice(start)
      : this.value.splice(start, deleteCount, ...items);
  }

  includes(item: TValue): boolean {
    return this.value.includes(item);
  }

  indexOf(item: TValue): number {
    return this.value.indexOf(item);
  }

  index(item: TValue, start = 0, stop?: number): number {
    const end = stop ?? this.value.length;
    for (let index = Math.max(0, start); index < Math.min(end, this.value.length); index += 1) {
      if (Object.is(this.value[index], item)) {
        return index;
      }
    }
    throw new Error(`Item not found: ${String(item)}`);
  }

  count(item: TValue): number {
    return this.value.filter((value) => Object.is(value, item)).length;
  }

  sort(options: { key?: ((value: TValue) => unknown) | null; reverse?: boolean } = {}): void {
    const key = options.key ?? null;
    this.value.sort((left, right) => compareSortValues(key ? key(left) : left, key ? key(right) : right));
    if (options.reverse) {
      this.value.reverse();
    }
  }

  reverse(): void {
    this.value.reverse();
  }

  copy(): TValue[] {
    return [...this.value];
  }

  clear(): void {
    this.value.length = 0;
  }

  [Symbol.iterator](): IterableIterator<TValue> {
    return this.value[Symbol.iterator]();
  }

  toJSON(): TValue[] {
    return [...this.value];
  }
}

export class StateProxy<TState extends object = Record<string, unknown>> {
  readonly state: TState;

  constructor(state: TState) {
    this.state = state;
  }

  get(key: keyof TState): TState[keyof TState] {
    return this.state[key];
  }

  set<K extends keyof TState>(key: K, value: TState[K]): this {
    this.state[key] = value;
    return this;
  }

  delete(key: keyof TState): boolean {
    const existed = Object.hasOwn(this.state, key);
    Reflect.deleteProperty(this.state, key);
    return existed;
  }

  has(key: keyof TState): boolean {
    return Object.hasOwn(this.state, key);
  }

  list<TItem = unknown>(key: keyof TState): LockedListProxy<TItem> {
    const value = this.state[key];
    if (!Array.isArray(value)) {
      throw new TypeError(`State field '${String(key)}' is not a list.`);
    }
    return new LockedListProxy<TItem>(value as TItem[]);
  }

  dict<TRecord extends Record<string, unknown> = Record<string, unknown>>(key: keyof TState): LockedDictProxy<TRecord> {
    const value = this.state[key];
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError(`State field '${String(key)}' is not a dict.`);
    }
    return new LockedDictProxy<TRecord>(value as TRecord);
  }

  toJSON(): TState {
    return this.state;
  }

  modelDump(): TState {
    return this.state;
  }

  model_dump(): TState {
    return this.modelDump();
  }
}

function compareSortValues(left: unknown, right: unknown): number {
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }
  return String(left).localeCompare(String(right));
}

export type FlowAskOptions = {
  /** Timeout in seconds. */
  timeout?: number | null;
  metadata?: Record<string, unknown> | null;
};

export type FlowInputHistoryEntry = {
  message: string;
  response: string | null;
  methodName: string | null;
  timestamp: Date;
  metadata: Record<string, unknown> | null;
  responseMetadata: Record<string, unknown> | null;
};

export type HumanFeedbackContext = {
  flowName: string;
  methodName: string;
  output: unknown;
  message: string;
  emit: readonly string[] | null;
  defaultOutcome: string | null;
  metadata: Record<string, unknown>;
  llm?: string | Record<string, unknown> | null;
};

export type PendingFeedbackContext = HumanFeedbackContext & {
  flowId: string | null;
  flowClass: string;
  requestedAt: Date;
};

export type HumanFeedbackProvider = {
  requestFeedback(context: PendingFeedbackContext, flow: Flow<object>): MaybePromise<string | null>;
};

export type HumanFeedbackResult = {
  output: unknown;
  feedback: string;
  outcome: string | null;
  timestamp: Date;
  methodName: string;
  metadata: Record<string, unknown>;
};

export type HumanFeedbackConfig = {
  message: string;
  emit?: readonly string[] | null;
  llm?: string | Record<string, unknown> | null;
  defaultOutcome?: string | null;
  metadata?: Record<string, unknown> | null;
  provider?: HumanFeedbackProvider | null;
  learn?: boolean;
  learnSource?: string;
  learn_source?: string;
  learnStrict?: boolean;
  learn_strict?: boolean;
};

export class HumanFeedbackPending extends Error {
  readonly context: PendingFeedbackContext;
  readonly callbackInfo: Record<string, unknown>;

  constructor(options: {
    context: PendingFeedbackContext;
    callbackInfo?: Record<string, unknown> | null;
    message?: string | null;
  }) {
    super(options.message ?? `Human feedback pending for flow '${options.context.flowName}' at method '${options.context.methodName}'`);
    this.name = "HumanFeedbackPending";
    this.context = options.context;
    this.callbackInfo = options.callbackInfo ?? {};
  }
}

export type FlowKickoffOptions = {
  inputs?: InputValues;
  inputFiles?: InputFiles;
  input_files?: InputFiles;
  fromCheckpoint?: CheckpointConfig | null;
  from_checkpoint?: CheckpointConfig | null;
  restoreFromStateId?: string | null;
  restore_from_state_id?: string | null;
};

export type FlowExecutionTraceEntry = {
  methodName: string;
  kind: FlowMethodKind;
  input: unknown;
  output: unknown;
  routerPath: string | null;
};

export type FlowExecutionMethodData = {
  flowMethod: {
    name: string;
    type: FlowMethodKind;
  };
  input: unknown;
  output: unknown;
  routerPath: string | null;
  finalState: Record<string, unknown> | null;
  order: number;
};

export type FlowCompletedMethodData = {
  flowMethod: {
    name: string;
    type: FlowMethodKind;
  };
  output: unknown;
};

export type FlowExecutionData = {
  id: string | null;
  flow: FlowStructure;
  inputs: InputValues;
  completedMethods: readonly FlowCompletedMethodData[];
  executionMethods: readonly FlowExecutionMethodData[];
  finalState: Record<string, unknown>;
};

export type FlowStructureMethod = {
  name: string;
  type: FlowMethodKind | "start_router";
  triggerMethods: readonly string[];
  conditionType: FlowCondition["type"] | null;
  routerPaths: readonly string[];
  hasHumanFeedback: boolean;
};

export type FlowStructureEdge = {
  from: string;
  to: string;
  type: "listen" | "route";
  conditionType: FlowCondition["type"] | null;
  condition: string | null;
};

export type FlowStructure = {
  name: string;
  methods: readonly FlowStructureMethod[];
  edges: readonly FlowStructureEdge[];
  startMethods: readonly string[];
  routerMethods: readonly string[];
};

export type OpenAPISchema = Record<string, unknown>;

export type FlowMethodSignature = {
  operationId: string;
  parameters: Record<string, OpenAPISchema>;
  returns: OpenAPISchema;
  summary?: string;
  description?: string;
};

export type FlowNodeMetadata = {
  type: FlowMethodKind | "start_router";
  is_router?: boolean;
  router_paths?: readonly string[];
  condition_type?: FlowCondition["type"] | "IF" | null;
  trigger_condition_type?: FlowCondition["type"] | null;
  trigger_methods?: readonly string[];
  trigger_condition?: FlowCondition;
  method_signature: FlowMethodSignature;
  source_code?: string;
  class_name?: string;
  class_signature?: string;
};

export type FlowVisualizationEdge = {
  source: string;
  target: string;
  condition_type: FlowCondition["type"] | null;
  is_router_path: boolean;
  router_path_label?: string;
};

export type FlowVisualizationStructure = {
  nodes: Record<string, FlowNodeMetadata>;
  edges: readonly FlowVisualizationEdge[];
  start_methods: readonly string[];
  router_methods: readonly string[];
};

export type FlowSerializedMethodInfo = {
  name: string;
  type: FlowMethodKind | "start_router";
  trigger_methods: readonly string[];
  condition_type: FlowCondition["type"] | null;
  router_paths: readonly string[];
  has_human_feedback: boolean;
  has_crew: boolean;
};

export type FlowSerializedEdgeInfo = {
  from_method: string;
  to_method: string;
  edge_type: "listen" | "route";
  condition: string | null;
};

export type FlowSerializedStateFieldInfo = {
  name: string;
  type: string;
  default?: unknown;
};

export type FlowSerializedStateSchemaInfo = {
  fields: readonly FlowSerializedStateFieldInfo[];
};

export type FlowSerializedStructureInfo = {
  name: string;
  description: string | null;
  methods: readonly FlowSerializedMethodInfo[];
  edges: readonly FlowSerializedEdgeInfo[];
  state_schema: FlowSerializedStateSchemaInfo | null;
  inputs: readonly string[];
};

type AnyFlowMethod<This = unknown> = (this: This, ...args: unknown[]) => MaybePromise<unknown>;
export class FlowMethod {
  readonly _meth: (...args: unknown[]) => unknown;
  readonly _instance: unknown;
  readonly __name__: string;

  constructor(method: (...args: unknown[]) => unknown, instance: unknown = null) {
    this._meth = method;
    this._instance = instance;
    this.__name__ = method.name;
  }

  call(...args: unknown[]): unknown {
    return this._instance ? this._meth(this._instance, ...args) : this._meth(...args);
  }

  unwrap(): (...args: unknown[]) => unknown {
    return this._meth;
  }
}

export class StartMethod extends FlowMethod {
  readonly __is_start_method__ = true;
}

export class ListenMethod extends FlowMethod {}

export class RouterMethod extends FlowMethod {
  readonly __is_router__ = true;
}
type FlowMetadataTarget = abstract new (...args: never[]) => object;

const flowMetadata = new WeakMap<FlowMetadataTarget, FlowMethodEntry[]>();
const humanFeedbackMetadata = new WeakMap<FlowMetadataTarget, Map<string, HumanFeedbackConfig>>();

export class Flow<TState extends object = Record<string, unknown>> {
  readonly name: string | null;
  readonly maxMethodCalls: number;
  inputProvider: InputProvider | null;
  persistence: FlowPersistence | null;
  stream: boolean;
  checkpoint: CheckpointConfig | false | null;
  memory: Memory | MemoryScope | MemorySlice | null;
  state: TState;
  private currentInputFiles: InputFiles = {};
  private readonly runtimeMethodOutputs: unknown[] = [];
  private readonly runtimeCompletedMethods = new Set<string>();
  private readonly runtimeMethodExecutionCounts = new Map<string, number>();
  private readonly runtimeExecutionTrace: FlowExecutionTraceEntry[] = [];
  private readonly runtimeInputHistory: FlowInputHistoryEntry[] = [];
  readonly humanFeedbackHistory: HumanFeedbackResult[] = [];
  lastHumanFeedback: HumanFeedbackResult | null = null;
  private pendingFeedbackContext: PendingFeedbackContext | null = null;
  private lastInputs: InputValues = {};
  private currentMethodName: string | null = null;
  private currentFlowRequestId: string | null = null;
  private checkpointRestoreActive = false;
  private flowPostInitDone = false;
  private readonly autoMemoryDisabled: boolean;

  constructor(options: FlowOptions<TState> = {}) {
    this.name = options.name ?? null;
    this.maxMethodCalls = options.maxMethodCalls ?? 100;
    this.inputProvider = options.inputProvider ?? null;
    this.persistence = options.persistence ?? null;
    this.stream = options.stream ?? false;
    this.checkpoint = coerceCheckpointConfig(options.checkpoint);
    this.autoMemoryDisabled = "memory" in options && options.memory === null;
    this.memory = "memory" in options ? options.memory ?? null : (this.shouldSkipAutoMemory()
      ? null
      : new Memory({ rootScope: `/flow/${sanitize_scope_name(this.flowName())}` }));
    const initialState = options.initialState;
    this.state = typeof initialState === "function"
      ? initialState()
      : initialState
        ? { ...initialState }
        : {} as TState;
  }

  model_post_init(_context: unknown = null): void {
    void _context;
    this.flowPostInit();
  }

  modelPostInit(context: unknown = null): void {
    this.model_post_init(context);
  }

  private flowPostInit(): void {
    if (this.flowPostInitDone) {
      return;
    }
    this.flowPostInitDone = true;
    if (!this.memory && !this.autoMemoryDisabled && !this.shouldSkipAutoMemory()) {
      this.memory = new Memory({ rootScope: `/flow/${sanitize_scope_name(this.flowName())}` });
    }
    crewaiEventBus.emit(this, new FlowCreatedEvent({ flowName: this.flowName() }));
  }

  async kickoff(
    optionsOrInputs: FlowKickoffOptions | InputValues | null = {},
    inputFiles: InputFiles | null = null,
    fromCheckpoint: CheckpointConfig | null = null,
    restoreFromStateId: string | null = null,
  ): Promise<unknown> {
    return await this.kickoffAsync(optionsOrInputs, inputFiles, fromCheckpoint, restoreFromStateId);
  }

  async kickoffAsync(
    optionsOrInputs: FlowKickoffOptions | InputValues | null = {},
    inputFiles: InputFiles | null = null,
    fromCheckpoint: CheckpointConfig | null = null,
    restoreFromStateId: string | null = null,
  ): Promise<unknown> {
    const options = normalizeFlowKickoffOptions(optionsOrInputs, inputFiles, fromCheckpoint, restoreFromStateId);
    const checkpointConfig = options.fromCheckpoint ?? options.from_checkpoint ?? null;
    const effectiveRestoreFromStateId = options.restoreFromStateId ?? options.restore_from_state_id ?? null;
    if (checkpointConfig && effectiveRestoreFromStateId) {
      throw new Error("Cannot combine from_checkpoint with restore_from_state_id");
    }
    if (checkpointConfig?.restoreFrom) {
      const restored = await Flow.fromCheckpoint.call(this.constructor as new () => Flow<object>, checkpointConfig);
      return await restored.kickoffAsync(withoutCheckpointOptions(options));
    }
    if (this.stream) {
      return new FlowStreamingOutput(async () => await this.withStreamDisabled(async () => await this.kickoffAsync(options)));
    }
    const extracted = extractInputFilesFromInputs({ ...(options.inputs ?? {}) });
    const inputs = extracted.inputs;
    const previousInputFiles = this.currentInputFiles;
    this.currentInputFiles = {
      ...(options.inputFiles ?? options.input_files ?? {}),
      ...extracted.inputFiles,
    };
    const restoredForkState = effectiveRestoreFromStateId && this.persistence
      ? await loadPersistedFlowState(this.persistence, effectiveRestoreFromStateId)
      : null;
    if (restoredForkState) {
      const nextStateId = typeof inputs.id === "string" && inputs.id.length > 0
        ? inputs.id
        : randomUUID();
      this.state = { ...restoredForkState, id: nextStateId } as TState;
    }
    this.lastInputs = inputs;
    if (restoredForkState) {
      const { id: _id, ...filteredInputs } = inputs;
      void _id;
      Object.assign(this.state, filteredInputs);
    } else {
      Object.assign(this.state, inputs);
    }
    const flowName = this.flowName();
    this.currentFlowRequestId = randomUUID();
    crewaiEventBus.emit(this, new FlowStartedEvent({ flowName, inputs }));

    try {
      const isRestoringCheckpoint = this.checkpointRestoreActive;
      const restoredCompletedMethods = [...this.runtimeCompletedMethods];
      const restoredMethodOutputs = [...this.runtimeMethodOutputs];
      const skipCompletedMethods = new Set(isRestoringCheckpoint ? restoredCompletedMethods : []);
      if (!isRestoringCheckpoint) {
        this.resetRuntimeState();
      }
      const entries = getFlowMetadata(this);
      const outputs = new Map<string, unknown>();
      const completed = new Set<string>(restoredCompletedMethods);
      const queue: Array<{ name: string; input: unknown }> = [];
      let lastOutput: unknown = restoredMethodOutputs.at(-1);
      let methodCalls = 0;

      restoredCompletedMethods.forEach((methodName, index) => {
        outputs.set(methodName, restoredMethodOutputs[index]);
      });

      for (const entry of entries.filter((candidate) => candidate.kind === "start" && !candidate.condition)) {
        const name = String(entry.name);
        if (!skipCompletedMethods.has(name)) {
          queue.push({ name, input: inputs });
        }
      }

      for (const triggerName of restoredCompletedMethods) {
        for (const entry of entries) {
          const name = String(entry.name);
          if (!entry.condition || skipCompletedMethods.has(name) || queue.some((candidate) => candidate.name === name)) {
            continue;
          }
          if (!conditionIncludesTrigger(entry.condition, triggerName)) {
            continue;
          }
          const trigger = conditionSatisfied(entry.condition, completed);
          if (trigger.satisfied) {
            queue.push({ name, input: outputs.get(triggerName) });
          }
        }
      }

      while (queue.length > 0) {
        const current = queue.shift();
        if (!current) {
          continue;
        }
        if (methodCalls >= this.maxMethodCalls) {
          throw new Error(`Flow '${this.name ?? this.constructor.name}' exceeded maxMethodCalls of ${String(this.maxMethodCalls)}.`);
        }
        methodCalls += 1;
        const methodEntry = entries.find((entry) => String(entry.name) === current.name);
        const output = await this.callFlowMethod(current.name, current.input, flowName);
        lastOutput = output;
        outputs.set(current.name, output);
        completed.add(current.name);
        this.runtimeMethodOutputs.push(output);
        this.runtimeCompletedMethods.add(current.name);
        this.runtimeMethodExecutionCounts.set(
          current.name,
          (this.runtimeMethodExecutionCounts.get(current.name) ?? 0) + 1,
        );
        const triggers = [current.name];
        let routerPath: string | null = null;

        if (this.isRouterOutput(methodEntry, current.name, output)) {
          routerPath = stringifyRouterOutput(output);
          completed.add(routerPath);
          outputs.set(routerPath, output);
          triggers.push(routerPath);
        }
        this.runtimeExecutionTrace.push({
          methodName: current.name,
          kind: methodEntry?.kind ?? "listen",
          input: current.input,
          output,
          routerPath,
        });
        await this.saveState(current.name);

        for (const triggerName of triggers) {
          for (const entry of entries) {
            const name = String(entry.name);
            if (!entry.condition || skipCompletedMethods.has(name) || queue.some((candidate) => candidate.name === name)) {
              continue;
            }
            if (!conditionIncludesTrigger(entry.condition, triggerName)) {
              continue;
            }
            const trigger = conditionSatisfied(entry.condition, completed);
            if (trigger.satisfied) {
              queue.push({ name, input: outputs.get(triggerName) });
            }
          }
        }
      }

      crewaiEventBus.emit(this, new FlowFinishedEvent({
        flowName,
        result: lastOutput,
        state: this.stateSnapshot(),
      }));
      return lastOutput;
    } catch (error) {
      if (isHumanFeedbackPending(error)) {
        this.pendingFeedbackContext = error.context;
        await this.savePendingFeedback(error.context);
        crewaiEventBus.emit(this, new FlowPausedEvent({
          flowName,
          pending: error,
          state: this.stateSnapshot(),
        }));
        return error;
      }
      crewaiEventBus.emit(this, new FlowFailedEvent({
        flowName,
        error,
        state: this.stateSnapshot(),
      }));
      throw error;
    } finally {
      this.checkpointRestoreActive = false;
      this.currentFlowRequestId = null;
      this.currentInputFiles = previousInputFiles;
    }
  }

  recall(query: string, options: Parameters<Memory["recall"]>[1] = {}): MemoryMatch[] {
    if (!this.memory) {
      throw new Error("No memory configured for this flow");
    }
    return this.memory.recall(query, options);
  }

  remember(
    content: string | readonly string[],
    options: Parameters<Memory["remember"]>[1] = {},
  ): MemoryRecord | MemoryRecord[] | null {
    if (!this.memory) {
      throw new Error("No memory configured for this flow");
    }
    if (Array.isArray(content)) {
      if (!(this.memory instanceof Memory)) {
        throw new TypeError(`Batch remember requires a Memory instance, got ${this.memory.constructor.name}`);
      }
      return this.memory.rememberMany(content, options);
    }
    return this.memory.remember(String(content), options);
  }

  extractMemories(content: string): readonly string[] {
    if (!this.memory) {
      throw new Error("No memory configured for this flow");
    }
    return this.memory.extractMemories(content);
  }

  extract_memories(content: string): readonly string[] {
    return this.extractMemories(content);
  }

  plot(filename = "crewai_flow.html", show = true): string {
    crewaiEventBus.emit(this, new FlowPlotEvent({ flowName: this.flowName() }));
    return renderInteractive(buildFlowStructure(this), filename, show);
  }

  async akickoff(
    optionsOrInputs: FlowKickoffOptions | InputValues | null = {},
    inputFiles: InputFiles | null = null,
    fromCheckpoint: CheckpointConfig | null = null,
    restoreFromStateId: string | null = null,
  ): Promise<unknown> {
    return await this.kickoffAsync(optionsOrInputs, inputFiles, fromCheckpoint, restoreFromStateId);
  }

  async kickoff_async(
    optionsOrInputs: FlowKickoffOptions | InputValues | null = {},
    inputFiles: InputFiles | null = null,
    fromCheckpoint: CheckpointConfig | null = null,
    restoreFromStateId: string | null = null,
  ): Promise<unknown> {
    return await this.kickoffAsync(optionsOrInputs, inputFiles, fromCheckpoint, restoreFromStateId);
  }

  async resume(feedback = ""): Promise<unknown> {
    return await this.resumeAsync(feedback);
  }

  async resumeAsync(feedback = ""): Promise<unknown> {
    const context = this.pendingFeedbackContext;
    if (!context) {
      throw new Error("Cannot resume flow without pending human feedback.");
    }
    this.pendingFeedbackContext = null;
    const output = await this.continueFromHumanFeedback(context, feedback);
    if (this.persistence && context.flowId) {
      await this.persistence.clearPendingFeedback(context.flowId);
    }
    return output;
  }

  async resume_async(feedback = ""): Promise<unknown> {
    return await this.resumeAsync(feedback);
  }

  async aresume(feedback = ""): Promise<unknown> {
    return await this.resumeAsync(feedback);
  }

  get pendingFeedback(): PendingFeedbackContext | null {
    return this.pendingFeedbackContext ? { ...this.pendingFeedbackContext } : null;
  }

  get pending_feedback(): PendingFeedbackContext | null {
    return this.pendingFeedback;
  }

  static async fromPending<TFlow extends Flow<object>>(
    this: new () => TFlow,
    flowId: string,
    persistence: FlowPersistence,
  ): Promise<TFlow> {
    const record = await persistence.loadPendingFeedback(flowId);
    if (!record) {
      throw new Error(`No pending feedback found for flow '${flowId}'.`);
    }
    const flow = new this();
    flow.persistence = persistence;
    Object.assign(flow.state, record.state);
    flow.pendingFeedbackContext = record.context;
    return flow;
  }

  static async from_pending<TFlow extends Flow<object>>(
    this: new () => TFlow,
    flowId: string,
    persistence: FlowPersistence,
  ): Promise<TFlow> {
    return await Flow.fromPending.call(this, flowId, persistence) as TFlow;
  }

  static async fromState<TFlow extends Flow<object>>(
    this: new () => TFlow,
    flowId: string,
    persistence: FlowPersistence,
  ): Promise<TFlow> {
    const state = await persistence.loadState?.(flowId);
    if (!state) {
      throw new Error(`No persisted state found for flow '${flowId}'.`);
    }
    const flow = new this();
    flow.persistence = persistence;
    Object.assign(flow.state, state);
    return flow;
  }

  static async from_state<TFlow extends Flow<object>>(
    this: new () => TFlow,
    flowId: string,
    persistence: FlowPersistence,
  ): Promise<TFlow> {
    return await Flow.fromState.call(this, flowId, persistence) as TFlow;
  }

  static async fromCheckpoint<TFlow extends Flow<object>>(
    this: new () => TFlow,
    config: CheckpointConfig,
  ): Promise<TFlow> {
    const runtime = await RuntimeState.fromCheckpoint(config, config.provider);
    crewaiEventBus.setRuntimeState(runtime);
    for (const entity of runtime.root) {
      const checkpoint = normalizeFlowCheckpointEntity(entity);
      if (!checkpoint) {
        continue;
      }
      const flow = entity instanceof this ? entity : new this();
      flow.restoreFromCheckpointEntity(checkpoint);
      flow.checkpoint = new CheckpointConfig({
        location: config.location,
        onEvents: config.onEvents,
        provider: config.provider,
        maxCheckpoints: config.maxCheckpoints,
      });
      return flow;
    }
    throw new Error(`No Flow found in checkpoint: ${config.restoreFrom ?? config.restore_from ?? ""}`);
  }

  static async from_checkpoint<TFlow extends Flow<object>>(
    this: new () => TFlow,
    config: CheckpointConfig,
  ): Promise<TFlow> {
    return await Flow.fromCheckpoint.call(this, config) as TFlow;
  }

  static async fork<TFlow extends Flow<object>>(
    this: new () => TFlow,
    config: CheckpointConfig,
    branch?: string | null,
  ): Promise<TFlow> {
    const flow = await Flow.fromCheckpoint.call(this, config) as TFlow;
    const runtime = crewaiEventBus.runtimeState;
    if (!runtime) {
      throw new Error("Cannot fork: no runtime state on the event bus.");
    }
    runtime.fork(branch ?? undefined);
    const newId = randomUUID();
    (flow.state as Record<string, unknown>).id = newId;
    return flow;
  }

  get inputFiles(): InputFiles {
    return { ...this.currentInputFiles };
  }

  get methodOutputs(): readonly unknown[] {
    return [...this.runtimeMethodOutputs];
  }

  get method_outputs(): readonly unknown[] {
    return this.methodOutputs;
  }

  get flow_id(): string {
    return this.flowPersistenceId();
  }

  get completedMethods(): ReadonlySet<string> {
    return new Set(this.runtimeCompletedMethods);
  }

  get methodExecutionCounts(): ReadonlyMap<string, number> {
    return new Map(this.runtimeMethodExecutionCounts);
  }

  get executionTrace(): readonly FlowExecutionTraceEntry[] {
    return this.runtimeExecutionTrace.map((entry) => ({ ...entry }));
  }

  get inputHistory(): readonly FlowInputHistoryEntry[] {
    return this.runtimeInputHistory.map((entry) => ({ ...entry }));
  }

  toExecutionData(): FlowExecutionData {
    const executionMethods = this.runtimeExecutionTrace.map((entry, index): FlowExecutionMethodData => ({
      flowMethod: {
        name: entry.methodName,
        type: entry.kind,
      },
      input: entry.input,
      output: entry.output,
      routerPath: entry.routerPath,
      finalState: this.stateSnapshot(),
      order: index,
    }));
    return {
      id: flowStateId(this.state),
      flow: getFlowStructure(this),
      inputs: { ...this.lastInputs },
      completedMethods: this.runtimeExecutionTrace.map((entry): FlowCompletedMethodData => ({
        flowMethod: {
          name: entry.methodName,
          type: entry.kind,
        },
        output: entry.output,
      })),
      executionMethods,
      finalState: this.stateSnapshot(),
    };
  }

  reload(executionData: FlowExecutionData): void {
    this.resetRuntimeState();
    Object.assign(this.state, executionData.finalState);
    this.lastInputs = { ...executionData.inputs };
    for (const method of executionData.executionMethods) {
      this.runtimeExecutionTrace.push({
        methodName: method.flowMethod.name,
        kind: method.flowMethod.type,
        input: method.input,
        output: method.output,
        routerPath: method.routerPath,
      });
      this.runtimeMethodOutputs.push(method.output);
      this.runtimeCompletedMethods.add(method.flowMethod.name);
      this.runtimeMethodExecutionCounts.set(
        method.flowMethod.name,
        (this.runtimeMethodExecutionCounts.get(method.flowMethod.name) ?? 0) + 1,
      );
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      type: "Flow",
      class_name: this.constructor.name,
      name: this.name,
      checkpoint_completed_methods: [...this.runtimeCompletedMethods],
      checkpoint_method_outputs: [...this.runtimeMethodOutputs],
      checkpoint_method_counts: Object.fromEntries(this.runtimeMethodExecutionCounts),
      checkpoint_state: this.stateSnapshot(),
    };
  }

  async kickoffCrew(crew: Crew, options: KickoffOptions = {}): Promise<CrewOutput> {
    const inputFiles = {
      ...this.currentInputFiles,
      ...(options.inputFiles ?? options.input_files ?? {}),
    };
    return await crew.kickoff({
      ...options,
      ...(Object.keys(inputFiles).length > 0 ? { inputFiles } : {}),
    });
  }

  ask(message: string, options: FlowAskOptions = {}): MaybePromise<string | null> {
    const metadata = options.metadata ?? null;
    const flowName = this.flowName();
    const methodName = this.currentMethodName;
    crewaiEventBus.emit(this, new FlowInputRequestedEvent({
      flowName,
      methodName,
      message,
      metadata,
    }));

    const provider = this.resolveInputProvider();
    try {
      const response = provider.requestInput(message, this, metadata);
      if (isPromiseLike(response)) {
        return this.resolveAsyncInput(response, {
          flowName,
          methodName,
          message,
          metadata,
          timeout: options.timeout ?? null,
        });
      }
      const normalized = normalizeInputProviderResponse(response);
      this.recordInput(message, normalized.text, methodName, metadata, normalized.metadata);
      crewaiEventBus.emit(this, new FlowInputReceivedEvent({
        flowName,
        methodName,
        message,
        response: normalized.text,
        metadata,
        responseMetadata: normalized.metadata,
      }));
      return normalized.text;
    } catch {
      this.recordInput(message, null, methodName, metadata, null);
      crewaiEventBus.emit(this, new FlowInputReceivedEvent({
        flowName,
        methodName,
        message,
        response: null,
        metadata,
        responseMetadata: null,
      }));
      return null;
    }
  }

  private resolveInputProvider(): InputProvider {
    return this.inputProvider ?? flowConfig.inputProvider ?? new ConsoleInputProvider();
  }

  async requestHumanFeedback(
    methodName: string,
    methodOutput: unknown,
    config: HumanFeedbackConfig,
  ): Promise<HumanFeedbackResult | string> {
    const feedback = await this.collectHumanFeedback(methodName, methodOutput, config);
    const result = this.recordHumanFeedbackResult({
      methodName,
      output: methodOutput,
      feedback,
      emit: config.emit ?? null,
      defaultOutcome: config.defaultOutcome ?? null,
      metadata: config.metadata ?? null,
    });
    crewaiEventBus.emit(this, new HumanFeedbackReceivedEvent({
      flowName: this.flowName(),
      methodName,
      feedback,
      outcome: result.outcome,
    }));
    return config.emit && config.emit.length > 0
      ? result.outcome ?? config.defaultOutcome ?? config.emit[0] ?? ""
      : result;
  }

  get humanFeedback(): HumanFeedbackResult | null {
    return this.lastHumanFeedback;
  }

  private async callFlowMethod(name: string, input: unknown, flowName: string): Promise<unknown> {
    const method = (this as Record<string, unknown>)[name];
    if (typeof method !== "function") {
      throw new Error(`Flow method '${name}' is not callable.`);
    }
    crewaiEventBus.emit(this, new MethodExecutionStartedEvent({
      flowName,
      methodName: name,
      state: this.stateSnapshot(),
    }));
    const previousMethodName = this.currentMethodName;
    const previousContext = captureExecutionContext();
    this.currentMethodName = name;
    setCurrentFlowContext({
      flowRequestId: this.currentFlowRequestId,
      flowId: this.flowPersistenceId(),
      flowMethodName: name,
    });
    try {
      const flowMethod = method as (...args: unknown[]) => MaybePromise<unknown>;
      const result: unknown = await flowMethod.call(this, input);
      crewaiEventBus.emit(this, new MethodExecutionFinishedEvent({
        flowName,
        methodName: name,
        result,
        state: this.stateSnapshot(),
      }));
      return result;
    } catch (error) {
      if (isHumanFeedbackPending(error)) {
        crewaiEventBus.emit(this, new MethodExecutionPausedEvent({
          flowName,
          methodName: name,
          pending: error,
          state: this.stateSnapshot(),
        }));
        throw error;
      }
      crewaiEventBus.emit(this, new MethodExecutionFailedEvent({
        flowName,
        methodName: name,
        error,
        state: this.stateSnapshot(),
      }));
      throw error;
    } finally {
      this.currentMethodName = previousMethodName;
      applyExecutionContext(previousContext);
    }
  }

  private resetRuntimeState(): void {
    this.runtimeMethodOutputs.length = 0;
    this.runtimeCompletedMethods.clear();
    this.runtimeMethodExecutionCounts.clear();
    this.runtimeExecutionTrace.length = 0;
    this.runtimeInputHistory.length = 0;
  }

  private restoreFromCheckpointEntity(checkpoint: FlowCheckpointEntity): void {
    this.resetRuntimeState();
    Object.assign(this.state, checkpoint.checkpoint_state);
    for (const methodName of checkpoint.checkpoint_completed_methods) {
      this.runtimeCompletedMethods.add(methodName);
    }
    this.runtimeMethodOutputs.push(...checkpoint.checkpoint_method_outputs);
    for (const [methodName, count] of Object.entries(checkpoint.checkpoint_method_counts)) {
      this.runtimeMethodExecutionCounts.set(methodName, count);
    }
    this.checkpointRestoreActive = true;
  }

  private async continueFromHumanFeedback(context: PendingFeedbackContext, feedback: string): Promise<unknown> {
    const flowName = this.flowName();
    const result = this.recordHumanFeedbackResult({
      methodName: context.methodName,
      output: context.output,
      feedback,
      emit: context.emit,
      defaultOutcome: context.defaultOutcome,
      metadata: context.metadata,
    });
    crewaiEventBus.emit(this, new HumanFeedbackReceivedEvent({
      flowName,
      methodName: context.methodName,
      feedback,
      outcome: result.outcome,
    }));

    const entries = getFlowMetadata(this);
    const outputs = new Map<string, unknown>();
    const completed = new Set<string>();
    const queue: Array<{ name: string; input: unknown }> = [];
    const methodOutput = context.emit && context.emit.length > 0
      ? result.outcome ?? context.defaultOutcome ?? context.emit[0] ?? ""
      : result;
    outputs.set(context.methodName, methodOutput);
    completed.add(context.methodName);
    const triggers = [context.methodName];
    let routerPath: string | null = null;
    if (context.emit && context.emit.length > 0) {
      routerPath = stringifyRouterOutput(methodOutput);
      outputs.set(routerPath, methodOutput);
      completed.add(routerPath);
      triggers.push(routerPath);
    }
    this.runtimeExecutionTrace.push({
      methodName: context.methodName,
      kind: "start",
      input: context.output,
      output: methodOutput,
      routerPath,
    });
    this.runtimeMethodOutputs.push(methodOutput);
    this.runtimeCompletedMethods.add(context.methodName);
    this.runtimeMethodExecutionCounts.set(
      context.methodName,
      (this.runtimeMethodExecutionCounts.get(context.methodName) ?? 0) + 1,
    );
    await this.saveState(context.methodName);

    for (const triggerName of triggers) {
      enqueueSatisfiedListeners(entries, completed, outputs, queue, triggerName);
    }

    let lastOutput: unknown = methodOutput;
    let methodCalls = 0;
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        continue;
      }
      if (methodCalls >= this.maxMethodCalls) {
        throw new Error(`Flow '${this.name ?? this.constructor.name}' exceeded maxMethodCalls of ${String(this.maxMethodCalls)}.`);
      }
      methodCalls += 1;
      const entry = entries.find((candidate) => String(candidate.name) === current.name);
      const output = await this.callFlowMethod(current.name, current.input, flowName);
      lastOutput = output;
      outputs.set(current.name, output);
      completed.add(current.name);
      this.runtimeMethodOutputs.push(output);
      this.runtimeCompletedMethods.add(current.name);
      this.runtimeMethodExecutionCounts.set(
        current.name,
        (this.runtimeMethodExecutionCounts.get(current.name) ?? 0) + 1,
      );
      const nextTriggers = [current.name];
      let nextRouterPath: string | null = null;
      if (this.isRouterOutput(entry, current.name, output)) {
        nextRouterPath = stringifyRouterOutput(output);
        outputs.set(nextRouterPath, output);
        completed.add(nextRouterPath);
        nextTriggers.push(nextRouterPath);
      }
      this.runtimeExecutionTrace.push({
        methodName: current.name,
        kind: entry?.kind ?? "listen",
        input: current.input,
        output,
        routerPath: nextRouterPath,
      });
      await this.saveState(current.name);
      for (const triggerName of nextTriggers) {
        enqueueSatisfiedListeners(entries, completed, outputs, queue, triggerName);
      }
    }

    crewaiEventBus.emit(this, new FlowFinishedEvent({
      flowName,
      result: lastOutput,
      state: this.stateSnapshot(),
    }));
    return lastOutput;
  }

  private async savePendingFeedback(context: PendingFeedbackContext): Promise<void> {
    if (!this.persistence || !context.flowId) {
      return;
    }
    await this.persistence.savePendingFeedback(context.flowId, context, this.stateSnapshot());
  }

  private async withStreamDisabled<T>(run: () => Promise<T>): Promise<T> {
    const previous = this.stream;
    this.stream = false;
    try {
      return await run();
    } finally {
      this.stream = previous;
    }
  }

  private async saveState(methodName: string): Promise<void> {
    if (!this.persistence?.saveState) {
      return;
    }
    await this.persistence.saveState(this.flowPersistenceId(), methodName, this.stateSnapshot());
  }

  private recordHumanFeedbackResult(options: {
    methodName: string;
    output: unknown;
    feedback: string;
    emit: readonly string[] | null;
    defaultOutcome: string | null;
    metadata: Record<string, unknown> | null;
  }): HumanFeedbackResult {
    const result: HumanFeedbackResult = {
      output: options.output,
      feedback: options.feedback,
      outcome: collapseFeedbackToOutcome(options.feedback, options.emit, options.defaultOutcome),
      timestamp: new Date(),
      methodName: options.methodName,
      metadata: { ...(options.metadata ?? {}) },
    };
    this.humanFeedbackHistory.push(result);
    this.lastHumanFeedback = result;
    return result;
  }

  private async resolveAsyncInput(
    response: PromiseLike<string | InputResponse | null>,
    context: {
      flowName: string;
      methodName: string | null;
      message: string;
      metadata: Record<string, unknown> | null;
      timeout: number | null;
    },
  ): Promise<string | null> {
    let raw: string | InputResponse | null;
    try {
      raw = context.timeout === null
        ? await response
        : await promiseWithTimeout(response, context.timeout * 1000);
    } catch {
      raw = null;
    }
    const normalized = normalizeInputProviderResponse(raw);
    this.recordInput(
      context.message,
      normalized.text,
      context.methodName,
      context.metadata,
      normalized.metadata,
    );
    crewaiEventBus.emit(this, new FlowInputReceivedEvent({
      flowName: context.flowName,
      methodName: context.methodName,
      message: context.message,
      response: normalized.text,
      metadata: context.metadata,
      responseMetadata: normalized.metadata,
    }));
    return normalized.text;
  }

  private recordInput(
    message: string,
    response: string | null,
    methodName: string | null,
    metadata: Record<string, unknown> | null,
    responseMetadata: Record<string, unknown> | null,
  ): void {
    this.runtimeInputHistory.push({
      message,
      response,
      methodName,
      timestamp: new Date(),
      metadata,
      responseMetadata,
    });
  }

  stateSnapshot(): Record<string, unknown> {
    return { ...this.state } as Record<string, unknown>;
  }

  private flowName(): string {
    return this.name ?? this.constructor.name;
  }

  private shouldSkipAutoMemory(): boolean {
    return Boolean((this as { _skip_auto_memory?: unknown })._skip_auto_memory);
  }

  private flowPersistenceId(): string {
    return flowStateId(this.state) ?? this.flowName();
  }

  private isRouterOutput(
    methodEntry: FlowMethodEntry | undefined,
    methodName: string,
    output: unknown,
  ): boolean {
    if (output === undefined || output === null) {
      return false;
    }
    return methodEntry?.kind === "router" || Boolean(humanFeedbackConfigFor(this, methodName)?.emit?.length);
  }

  private async collectHumanFeedback(
    methodName: string,
    methodOutput: unknown,
    config: HumanFeedbackConfig,
  ): Promise<string> {
    const flowName = this.flowName();
    const emit = config.emit ?? null;
    crewaiEventBus.emit(this, new HumanFeedbackRequestedEvent({
      flowName,
      methodName,
      output: methodOutput,
      message: config.message,
      emit,
    }));
    const context: PendingFeedbackContext = {
      flowName,
      methodName,
      output: methodOutput,
      message: config.message,
      emit,
      defaultOutcome: config.defaultOutcome ?? null,
      metadata: { ...(config.metadata ?? {}) },
      llm: config.llm ?? null,
      flowId: this.flowPersistenceId(),
      flowClass: this.constructor.name,
      requestedAt: new Date(),
    };
    const provider = config.provider ?? flowConfig.hitlProvider;
    if (isHumanFeedbackProvider(provider)) {
      return String(await provider.requestFeedback(context, this));
    }
    const feedback = await this.ask(formatFeedbackPrompt(config.message, methodOutput), {
      metadata: config.metadata ?? null,
    });
    return feedback ?? "";
  }
}

function normalizeInputProviderResponse(value: string | InputResponse | null): {
  text: string | null;
  metadata: Record<string, unknown> | null;
} {
  if (isInputResponse(value)) {
    return {
      text: value.text,
      metadata: value.metadata ?? null,
    };
  }
  return {
    text: value,
    metadata: null,
  };
}

function normalizeHumanFeedbackConfig(config: HumanFeedbackConfig): HumanFeedbackConfig {
  return {
    message: config.message,
    emit: config.emit ? [...config.emit] : null,
    llm: serializeHumanFeedbackLlm(config.llm ?? "gpt-4o-mini"),
    defaultOutcome: config.defaultOutcome ?? null,
    metadata: config.metadata ? { ...config.metadata } : null,
    provider: config.provider ?? null,
    learn: config.learn ?? false,
    learnSource: config.learnSource ?? config.learn_source ?? "hitl",
    learn_source: config.learnSource ?? config.learn_source ?? "hitl",
    learnStrict: config.learnStrict ?? config.learn_strict ?? false,
    learn_strict: config.learnStrict ?? config.learn_strict ?? false,
  };
}

function humanFeedbackConfigFor(instanceOrConstructor: object | FlowMetadataTarget, methodName: string): HumanFeedbackConfig | null {
  return getHumanFeedbackMetadata(instanceOrConstructor).get(methodName) ?? null;
}

function isHumanFeedbackProvider(value: unknown): value is HumanFeedbackProvider {
  return value !== null
    && typeof value === "object"
    && "requestFeedback" in value
    && typeof value.requestFeedback === "function";
}

function serializeHumanFeedbackLlm(value: unknown): string | Record<string, unknown> | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value !== "object") {
    return null;
  }
  const withConfig = value as { toConfigDict?: () => unknown; to_config_dict?: () => unknown };
  const config = typeof withConfig.toConfigDict === "function"
    ? withConfig.toConfigDict()
    : typeof withConfig.to_config_dict === "function"
      ? withConfig.to_config_dict()
      : null;
  if (config && typeof config === "object" && !Array.isArray(config)) {
    return { ...(config as Record<string, unknown>) };
  }
  const record = value as Record<string, unknown>;
  const model = record.model;
  if (typeof model !== "string" || !model) {
    return null;
  }
  const provider = record.provider;
  return typeof provider === "string" && provider && !model.includes("/")
    ? `${provider}/${model}`
    : model;
}

function isHumanFeedbackPending(value: unknown): value is HumanFeedbackPending {
  return value instanceof HumanFeedbackPending;
}

function collapseFeedbackToOutcome(
  feedback: string,
  emit: readonly string[] | null,
  defaultOutcome: string | null,
): string | null {
  if (!emit || emit.length === 0) {
    return null;
  }
  const normalizedFeedback = feedback.trim().toLowerCase();
  if (!normalizedFeedback) {
    return defaultOutcome ?? emit[0] ?? null;
  }
  const exact = emit.find((outcome) => outcome.toLowerCase() === normalizedFeedback);
  if (exact) {
    return exact;
  }
  const contained = emit.find((outcome) => normalizedFeedback.includes(outcome.toLowerCase()));
  return contained ?? defaultOutcome ?? emit[0] ?? null;
}

function formatFeedbackPrompt(message: string, output: unknown): string {
  const renderedOutput = typeof output === "string" ? output : JSON.stringify(output, null, 2);
  return `${message}\n\nOutput for review:\n${renderedOutput}`;
}

function isPromiseLike<T>(value: T | PromiseLike<T> | null): value is PromiseLike<T> {
  return value !== null
    && (typeof value === "object" || typeof value === "function")
    && "then" in value
    && typeof value.then === "function";
}

function enqueueSatisfiedListeners(
  entries: readonly FlowMethodEntry[],
  completed: ReadonlySet<string>,
  outputs: ReadonlyMap<string, unknown>,
  queue: Array<{ name: string; input: unknown }>,
  triggerName: string,
): void {
  for (const entry of entries) {
    const name = String(entry.name);
    if (!entry.condition || queue.some((candidate) => candidate.name === name)) {
      continue;
    }
    if (!conditionIncludesTrigger(entry.condition, triggerName)) {
      continue;
    }
    const trigger = conditionSatisfied(entry.condition, completed);
    if (trigger.satisfied) {
      queue.push({ name, input: outputs.get(triggerName) });
    }
  }
}

async function promiseWithTimeout<T>(promise: PromiseLike<T>, timeoutMs: number): Promise<T | null> {
  if (timeoutMs <= 0) {
    return null;
  }
  return await Promise.race([
    promise,
    new Promise<null>((resolve) => {
      setTimeout(() => {
        resolve(null);
      }, timeoutMs);
    }),
  ]);
}

export function start<This extends object>(
  value: AnyFlowMethod<This>,
  context: ClassMethodDecoratorContext<This, AnyFlowMethod<This>>,
): AnyFlowMethod<This>;
export function start(condition?: FlowConditionInput): MethodDecoratorFactory;
export function start<This extends object>(
  valueOrCondition?: AnyFlowMethod<This> | FlowConditionInput,
  context?: ClassMethodDecoratorContext<This, AnyFlowMethod<This>>,
): AnyFlowMethod<This> | MethodDecoratorFactory {
  if (context) {
    return flowDecorator("start", null)(valueOrCondition as AnyFlowMethod<This>, context);
  }
  return flowDecorator("start", normalizeFlowCondition(valueOrCondition));
}

export function listen(condition: FlowConditionInput): MethodDecoratorFactory {
  return flowDecorator("listen", normalizeFlowCondition(condition));
}

export function router(condition: FlowConditionInput): MethodDecoratorFactory {
  return flowDecorator("router", normalizeFlowCondition(condition));
}

export function humanFeedback(configOrMessage: HumanFeedbackConfig | string): MethodDecoratorFactory {
  const config = typeof configOrMessage === "string"
    ? { message: configOrMessage }
    : configOrMessage;
  return function decorate<This extends object>(
    value: AnyFlowMethod<This>,
    context: ClassMethodDecoratorContext<This, AnyFlowMethod<This>>,
  ): AnyFlowMethod<This> {
    context.addInitializer(function init(this: This) {
      const ctor = this.constructor as FlowMetadataTarget;
      const entries = humanFeedbackMetadata.get(ctor) ?? new Map<string, HumanFeedbackConfig>();
      entries.set(String(context.name), normalizeHumanFeedbackConfig(config));
      humanFeedbackMetadata.set(ctor, entries);
    });

    return async function wrapped(this: This, ...args: unknown[]): Promise<unknown> {
      const output = await value.call(this, ...args);
      if (!(this instanceof Flow)) {
        return output;
      }
      return await this.requestHumanFeedback(String(context.name), output, normalizeHumanFeedbackConfig(config));
    };
  };
}

export const human_feedback = humanFeedback;

export function or_(...conditions: FlowConditionInput[]): FlowCondition {
  return { type: "OR", conditions: conditions.map(normalizeConditionInput) };
}

export function and_(...conditions: FlowConditionInput[]): FlowCondition {
  return { type: "AND", conditions: conditions.map(normalizeConditionInput) };
}

export function getFlowMetadata(instanceOrConstructor: object | FlowMetadataTarget): readonly FlowMethodEntry[] {
  const ctor = typeof instanceOrConstructor === "function"
    ? instanceOrConstructor as FlowMetadataTarget
    : instanceOrConstructor.constructor as FlowMetadataTarget;
  const inherited: FlowMethodEntry[] = [];
  let current: FlowMetadataTarget | null = ctor;
  const rootConstructor = Function.prototype.constructor as FlowMetadataTarget;
  while (current && current !== rootConstructor) {
    inherited.unshift(...(flowMetadata.get(current) ?? []));
    const prototype = Object.getPrototypeOf(current.prototype) as object | null;
    current = prototype ? prototype.constructor as FlowMetadataTarget : null;
  }

  const seen = new Set<string>();
  return inherited.filter((entry) => {
    const key = `${String(entry.name)}:${entry.kind}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function getHumanFeedbackMetadata(instanceOrConstructor: object | FlowMetadataTarget): ReadonlyMap<string, HumanFeedbackConfig> {
  const ctor = typeof instanceOrConstructor === "function"
    ? instanceOrConstructor as FlowMetadataTarget
    : instanceOrConstructor.constructor as FlowMetadataTarget;
  const inherited = new Map<string, HumanFeedbackConfig>();
  let current: FlowMetadataTarget | null = ctor;
  const rootConstructor = Function.prototype.constructor as FlowMetadataTarget;
  while (current && current !== rootConstructor) {
    for (const [name, config] of humanFeedbackMetadata.get(current) ?? []) {
      inherited.set(name, config);
    }
    const prototype = Object.getPrototypeOf(current.prototype) as object | null;
    current = prototype ? prototype.constructor as FlowMetadataTarget : null;
  }
  return inherited;
}

export function getFlowStructure(instanceOrConstructor: object | FlowMetadataTarget): FlowStructure {
  const entries = getFlowMetadata(instanceOrConstructor);
  const feedbackMetadata = getHumanFeedbackMetadata(instanceOrConstructor);
  const name = typeof instanceOrConstructor === "function"
    ? instanceOrConstructor.name
    : instanceOrConstructor.constructor.name;
  const names = [...new Set(entries.map((entry) => String(entry.name)))];
  const methods = names.map((methodName) => createStructureMethod(methodName, entries, feedbackMetadata));
  const edges = entries.flatMap((entry) =>
    entry.condition
      ? conditionEdges(entry.condition, String(entry.name), methods)
      : [],
  );

  return {
    name,
    methods,
    edges,
    startMethods: methods.filter((method) => method.type === "start" || method.type === "start_router").map((method) => method.name),
    routerMethods: methods.filter((method) => method.type === "router" || method.type === "start_router").map((method) => method.name),
  };
}

export const get_flow_structure = getFlowStructure;

export function visualizeFlowStructure(
  structure: FlowVisualizationStructure,
  filename = "flow_dag.html",
  show = true,
): string {
  return renderInteractive({
    nodes: structure.nodes,
    edges: structure.edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      condition_type: edge.condition_type,
      is_router_path: edge.is_router_path,
      router_path_label: edge.router_path_label ?? null,
    })),
    start_methods: structure.start_methods,
  }, filename, show);
}

export const visualize_flow_structure = visualizeFlowStructure;

export function typeToOpenAPISchema(typeHint: unknown): OpenAPISchema {
  if (typeHint === undefined || typeHint === null) {
    return {};
  }
  if (typeHint === String || typeHint === "string") {
    return { type: "string" };
  }
  if (typeHint === Number || typeHint === "number") {
    return { type: "number" };
  }
  if (typeHint === Boolean || typeHint === "boolean") {
    return { type: "boolean" };
  }
  if (typeHint === BigInt || typeHint === "bigint") {
    return { type: "integer" };
  }
  if (typeHint === Array || typeHint === "array") {
    return { type: "array" };
  }
  if (typeHint === Object || typeHint === "object") {
    return { type: "object" };
  }
  if (typeof typeHint === "function" && typeHint.name) {
    return { type: "object", className: typeHint.name };
  }
  return {};
}

export const type_to_openapi_schema = typeToOpenAPISchema;

export function extractMethodSignature(method: unknown, methodName: string): FlowMethodSignature {
  if (typeof method !== "function") {
    return { operationId: methodName, parameters: {}, returns: {} };
  }
  const source = Function.prototype.toString.call(method);
  const doc = extractLeadingComment(source);
  return {
    operationId: methodName,
    parameters: Object.fromEntries(extractFunctionParameterNames(source).map((name) => [name, {}])),
    returns: {},
    ...(doc.summary ? { summary: doc.summary } : {}),
    ...(doc.description ? { description: doc.description } : {}),
  };
}

export const extract_method_signature = extractMethodSignature;

export function getPossibleReturnConstants(method: unknown): readonly string[] | null {
  if (typeof method !== "function") {
    return null;
  }
  const source = Function.prototype.toString.call(method);
  const variableValues = collectLocalStringValues(source);
  const objectValues = collectLocalObjectStringValues(source);
  const constants: string[] = [];
  for (const expression of extractReturnExpressions(source)) {
    for (const value of stringConstantsFromExpression(expression, variableValues, objectValues)) {
      if (!constants.includes(value)) {
        constants.push(value);
      }
    }
  }
  return constants.length > 0 ? constants : null;
}

export const get_possible_return_constants = getPossibleReturnConstants;

export function buildFlowStructure(instanceOrConstructor: object | FlowMetadataTarget): FlowVisualizationStructure {
  const entries = getFlowMetadata(instanceOrConstructor);
  const structure = getFlowStructure(instanceOrConstructor);
  const nodes: Record<string, FlowNodeMetadata> = {};
  const startMethods: string[] = [];
  const routerMethods: string[] = [];
  const edges: FlowVisualizationEdge[] = [];
  const className = typeof instanceOrConstructor === "function"
    ? instanceOrConstructor.name
    : instanceOrConstructor.constructor.name;
  const classSignature = className ? `class ${className}` : undefined;

  for (const method of structure.methods) {
    const methodValue = getMethodValue(instanceOrConstructor, method.name);
    const metadata: FlowNodeMetadata = {
      type: method.type,
      method_signature: extractMethodSignature(methodValue, method.name),
      ...(className ? { class_name: className } : {}),
      ...(classSignature ? { class_signature: classSignature } : {}),
      ...(typeof methodValue === "function" ? { source_code: Function.prototype.toString.call(methodValue) } : {}),
    };
    if (method.type === "router" || method.type === "start_router") {
      const inferredPaths = getPossibleReturnConstants(methodValue) ?? [];
      metadata.is_router = true;
      metadata.router_paths = uniqueStrings([...method.routerPaths, ...inferredPaths]);
      metadata.condition_type = method.conditionType ?? "IF";
      routerMethods.push(method.name);
    }
    if (method.type === "start" || method.type === "start_router") {
      startMethods.push(method.name);
    }
    if (method.conditionType) {
      metadata.trigger_condition_type = method.conditionType;
      metadata.condition_type ??= method.conditionType;
    }
    if (method.triggerMethods.length > 0) {
      metadata.trigger_methods = method.triggerMethods;
    }
    const condition = entries.find((entry) => String(entry.name) === method.name && entry.condition)?.condition;
    if (condition) {
      metadata.trigger_condition = condition;
    }
    nodes[method.name] = metadata;
  }

  for (const entry of entries) {
    if (!entry.condition) {
      continue;
    }
    edges.push(...createVisualizationEdgesFromCondition(entry.condition, String(entry.name), nodes));
  }

  for (const routerName of routerMethods) {
    const routerPaths = nodes[routerName]?.router_paths ?? [];
    for (const path of routerPaths) {
      for (const entry of entries) {
        if (String(entry.name) === routerName || !entry.condition) {
          continue;
        }
        if (extractDirectOrTriggers(entry.condition).includes(path)) {
          edges.push({
            source: routerName,
            target: String(entry.name),
            condition_type: null,
            is_router_path: true,
            router_path_label: path,
          });
        }
      }
    }
  }

  return {
    nodes,
    edges: dedupeVisualizationEdges(edges),
    start_methods: startMethods,
    router_methods: routerMethods,
  };
}

export const build_flow_structure = buildFlowStructure;

export function flowStructure(instanceOrConstructor: object | FlowMetadataTarget): FlowSerializedStructureInfo {
  const structure = getFlowStructure(instanceOrConstructor);
  const visualization = buildFlowStructure(instanceOrConstructor);
  return {
    name: structure.name,
    description: extractClassDescription(instanceOrConstructor),
    methods: structure.methods.map((method): FlowSerializedMethodInfo => {
      const methodValue = getMethodValue(instanceOrConstructor, method.name);
      return {
        name: method.name,
        type: method.type,
        trigger_methods: method.triggerMethods,
        condition_type: method.conditionType,
        router_paths: visualization.nodes[method.name]?.router_paths ?? method.routerPaths,
        has_human_feedback: method.hasHumanFeedback,
        has_crew: detectsCrewReference(methodValue),
      };
    }),
    edges: visualization.edges.map((edge): FlowSerializedEdgeInfo => ({
      from_method: edge.source,
      to_method: edge.target,
      edge_type: edge.is_router_path ? "route" : "listen",
      condition: edge.router_path_label ?? null,
    })),
    state_schema: extractStateSchema(instanceOrConstructor),
    inputs: extractFlowInputs(instanceOrConstructor),
  };
}

export const flow_structure = flowStructure;

export function calculateExecutionPaths(structure: FlowVisualizationStructure): number {
  const graph = new Map<string, FlowVisualizationEdge[]>();
  for (const edge of structure.edges) {
    graph.set(edge.source, [...(graph.get(edge.source) ?? []), edge]);
  }
  const nodeNames = new Set(Object.keys(structure.nodes));
  const sources = new Set(structure.edges.map((edge) => edge.source));
  const terminalNodes = [...nodeNames].filter((name) => !sources.has(name));
  if (structure.start_methods.length === 0 || terminalNodes.length === 0) {
    return 0;
  }

  const countFrom = (node: string, visited: ReadonlySet<string>): number => {
    if (terminalNodes.includes(node)) {
      return 1;
    }
    if (visited.has(node)) {
      return 0;
    }
    const nextVisited = new Set(visited);
    nextVisited.add(node);
    const outgoing = graph.get(node) ?? [];
    if (outgoing.length === 0) {
      return 1;
    }
    const total = outgoing.reduce((sum, edge) => sum + countFrom(edge.target, nextVisited), 0);
    return total > 0 ? total : 1;
  };

  return Math.max(
    1,
    structure.start_methods.reduce((sum, startMethod) => sum + countFrom(startMethod, new Set<string>()), 0),
  );
}

export const calculate_execution_paths = calculateExecutionPaths;

export function calculateNodeLevels(instanceOrConstructor: object | FlowMetadataTarget | FlowVisualizationStructure): Record<string, number> {
  const structure = normalizeVisualizationStructure(instanceOrConstructor);
  const levels: Record<string, number> = {};
  const queue = [...structure.start_methods];
  const pendingAndParents = new Map<string, Set<string>>();
  const incomingAndParents = new Map<string, Set<string>>();
  const bySource = edgesBySource(structure);

  for (const methodName of structure.start_methods) {
    levels[methodName] = 0;
  }
  for (const edge of structure.edges) {
    if (edge.condition_type === "AND") {
      const parents = incomingAndParents.get(edge.target) ?? new Set<string>();
      parents.add(edge.source);
      incomingAndParents.set(edge.target, parents);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift() as string;
    const currentLevel = levels[current] ?? 0;
    for (const edge of bySource.get(current) ?? []) {
      if (edge.condition_type === "AND") {
        const seenParents = pendingAndParents.get(edge.target) ?? new Set<string>();
        seenParents.add(current);
        pendingAndParents.set(edge.target, seenParents);
        const requiredParents = incomingAndParents.get(edge.target) ?? new Set<string>();
        if (![...requiredParents].every((parent) => seenParents.has(parent))) {
          continue;
        }
      }
      const nextLevel = currentLevel + 1;
      const existingLevel = levels[edge.target];
      if (existingLevel === undefined || existingLevel > nextLevel) {
        levels[edge.target] = nextLevel;
        queue.push(edge.target);
      }
    }
  }

  const fallbackLevel = Object.values(levels).length > 0 ? Math.max(...Object.values(levels)) + 1 : 0;
  for (const methodName of Object.keys(structure.nodes)) {
    levels[methodName] ??= fallbackLevel;
  }
  return levels;
}

export const calculate_node_levels = calculateNodeLevels;

export function countOutgoingEdges(instanceOrConstructor: object | FlowMetadataTarget | FlowVisualizationStructure): Record<string, number> {
  const structure = normalizeVisualizationStructure(instanceOrConstructor);
  const counts = Object.fromEntries(Object.keys(structure.nodes).map((name) => [name, 0]));
  for (const edge of structure.edges) {
    if (edge.source in counts) {
      counts[edge.source] = (counts[edge.source] ?? 0) + 1;
    }
  }
  return counts;
}

export const count_outgoing_edges = countOutgoingEdges;

export function buildAncestorDict(instanceOrConstructor: object | FlowMetadataTarget | FlowVisualizationStructure): Record<string, ReadonlySet<string>> {
  const structure = normalizeVisualizationStructure(instanceOrConstructor);
  const parents = parentsByChild(structure);
  const ancestors: Record<string, ReadonlySet<string>> = {};
  const visit = (node: string, seen: ReadonlySet<string>): Set<string> => {
    const collected = new Set<string>();
    for (const parent of parents.get(node) ?? []) {
      if (seen.has(parent)) {
        continue;
      }
      collected.add(parent);
      for (const ancestor of visit(parent, new Set([...seen, parent]))) {
        collected.add(ancestor);
      }
    }
    return collected;
  };
  for (const methodName of Object.keys(structure.nodes)) {
    ancestors[methodName] = visit(methodName, new Set([methodName]));
  }
  return ancestors;
}

export const build_ancestor_dict = buildAncestorDict;

export function isAncestor(node: string, ancestorCandidate: string, ancestors: Readonly<Record<string, ReadonlySet<string>>>): boolean {
  return ancestors[node]?.has(ancestorCandidate) ?? false;
}

export const is_ancestor = isAncestor;

export function dfsAncestors(
  node: string,
  ancestors: Record<string, Set<string>>,
  visited: Set<string>,
  flow: unknown,
): void {
  if (visited.has(node)) {
    return;
  }
  visited.add(node);
  const structure = normalizeVisualizationStructure(flow as object | FlowMetadataTarget | FlowVisualizationStructure);
  for (const edge of structure.edges) {
    if (edge.source !== node) {
      continue;
    }
    const targetAncestors = ancestors[edge.target] ?? new Set<string>();
    targetAncestors.add(node);
    for (const ancestor of ancestors[node] ?? []) {
      targetAncestors.add(ancestor);
    }
    ancestors[edge.target] = targetAncestors;
    dfsAncestors(edge.target, ancestors, visited, structure);
  }
}

export const dfs_ancestors = dfsAncestors;

export function buildParentChildrenDict(instanceOrConstructor: object | FlowMetadataTarget | FlowVisualizationStructure): Record<string, readonly string[]> {
  const structure = normalizeVisualizationStructure(instanceOrConstructor);
  const children = new Map<string, Set<string>>();
  for (const edge of structure.edges) {
    const targets = children.get(edge.source) ?? new Set<string>();
    targets.add(edge.target);
    children.set(edge.source, targets);
  }
  return Object.fromEntries([...children.entries()].map(([parent, childSet]) => [parent, [...childSet].sort()]));
}

export const build_parent_children_dict = buildParentChildrenDict;

export function getChildIndex(parent: string, child: string, parentChildren: Readonly<Record<string, readonly string[]>>): number {
  return [...(parentChildren[parent] ?? [])].sort().indexOf(child);
}

export const get_child_index = getChildIndex;

export function processRouterPaths(
  flow: unknown,
  current: string,
  currentLevel: number,
  levels: Record<string, number>,
  queue: { push?: (value: string) => unknown; append?: (value: string) => unknown },
): void {
  const structure = normalizeVisualizationStructure(flow as object | FlowMetadataTarget | FlowVisualizationStructure);
  for (const edge of structure.edges) {
    if (edge.source !== current || !edge.is_router_path) {
      continue;
    }
    if (levels[edge.target] === undefined || (levels[edge.target] ?? 0) > currentLevel + 1) {
      levels[edge.target] = currentLevel + 1;
      if (typeof queue.push === "function") {
        queue.push(edge.target);
      } else if (typeof queue.append === "function") {
        queue.append(edge.target);
      }
    }
  }
}

export const process_router_paths = processRouterPaths;

export function isFlowMethodName(value: unknown): value is string {
  return typeof value === "string";
}

export const is_flow_method_name = isFlowMethodName;

export function isFlowMethodCallable(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === "function" && "name" in value;
}

export const is_flow_method_callable = isFlowMethodCallable;

export function isFlowConditionDict(value: unknown): value is FlowCondition {
  if (!isRecord(value)) {
    return false;
  }
  const type = value.type;
  if (type !== "AND" && type !== "OR") {
    return false;
  }
  const conditions = value.conditions;
  return conditions === undefined
    || (Array.isArray(conditions) && conditions.every((condition) => typeof condition === "string" || isFlowConditionDict(condition)));
}

export const is_flow_condition_dict = isFlowConditionDict;

export function isFlowConditionList(value: unknown): value is FlowConditionInput[] {
  return Array.isArray(value) && value.every((item) => isFlowMethodName(item) || isFlowConditionDict(item));
}

export const is_flow_condition_list = isFlowConditionList;

export function isSimpleFlowCondition(value: unknown): value is [string, string[]] {
  return Array.isArray(value)
    && value.length === 2
    && typeof value[0] === "string"
    && Array.isArray(value[1])
    && value[1].every((item) => typeof item === "string");
}

export const is_simple_flow_condition = isSimpleFlowCondition;

export function isFlowMethod(value: unknown): boolean {
  return isRecord(value)
    && (
      value.__is_flow_method__ === true
      || value.__is_start_method__ === true
      || "__trigger_methods__" in value
      || value.__is_router__ === true
    );
}

export const is_flow_method = isFlowMethod;

type MethodDecoratorFactory = <This extends object>(
  value: AnyFlowMethod<This>,
  context: ClassMethodDecoratorContext<This, AnyFlowMethod<This>>,
) => AnyFlowMethod<This>;

function createStructureMethod(
  methodName: string,
  entries: readonly FlowMethodEntry[],
  feedbackMetadata: ReadonlyMap<string, HumanFeedbackConfig>,
): FlowStructureMethod {
  const methodEntries = entries.filter((entry) => String(entry.name) === methodName);
  const feedbackConfig = feedbackMetadata.get(methodName);
  const hasHumanFeedbackRouter = Boolean(feedbackConfig?.emit?.length);
  const isStart = methodEntries.some((entry) => entry.kind === "start");
  const isRouter = methodEntries.some((entry) => entry.kind === "router") || hasHumanFeedbackRouter;
  const condition = methodEntries.find((entry) => entry.condition)?.condition ?? null;
  return {
    name: methodName,
    type: isStart && isRouter
      ? "start_router"
      : isStart
        ? "start"
        : isRouter
          ? "router"
          : "listen",
    triggerMethods: condition ? extractAllTriggerNames(condition) : [],
    conditionType: condition?.type ?? null,
    routerPaths: feedbackConfig?.emit ?? routerPathsFor(methodName, entries),
    hasHumanFeedback: Boolean(feedbackConfig),
  };
}

function conditionEdges(
  condition: FlowCondition,
  target: string,
  methods: readonly FlowStructureMethod[],
): FlowStructureEdge[] {
  return condition.conditions.flatMap((nested) =>
    nestedConditionEdges(nested, target, condition.type, methods),
  );
}

function nestedConditionEdges(
  condition: FlowConditionInput,
  target: string,
  conditionType: FlowCondition["type"],
  methods: readonly FlowStructureMethod[],
): FlowStructureEdge[] {
  if (typeof condition === "string") {
    return [{
      from: condition,
      to: target,
      type: isRouterPath(condition, methods) ? "route" : "listen",
      conditionType,
      condition: isRouterPath(condition, methods) ? condition : null,
    }];
  }
  if (typeof condition === "function") {
    return nestedConditionEdges(condition.name, target, conditionType, methods);
  }
  return conditionEdges(condition, target, methods);
}

function createVisualizationEdgesFromCondition(
  condition: FlowCondition,
  target: string,
  nodes: Record<string, FlowNodeMetadata>,
): FlowVisualizationEdge[] {
  if (condition.type === "AND") {
    return extractAllTriggerNames(condition)
      .filter((trigger) => trigger in nodes)
      .map((trigger) => ({
        source: trigger,
        target,
        condition_type: "AND",
        is_router_path: false,
      }));
  }
  return condition.conditions.flatMap((nested) =>
    nestedVisualizationEdges(nested, target, condition.type, nodes),
  );
}

function nestedVisualizationEdges(
  condition: FlowConditionInput,
  target: string,
  conditionType: FlowCondition["type"],
  nodes: Record<string, FlowNodeMetadata>,
): FlowVisualizationEdge[] {
  if (typeof condition === "string") {
    return condition in nodes
      ? [{
        source: condition,
        target,
        condition_type: conditionType,
        is_router_path: false,
      }]
      : [];
  }
  if (typeof condition === "function") {
    return nestedVisualizationEdges(condition.name, target, conditionType, nodes);
  }
  return createVisualizationEdgesFromCondition(condition, target, nodes);
}

function dedupeVisualizationEdges(edges: readonly FlowVisualizationEdge[]): readonly FlowVisualizationEdge[] {
  const seen = new Set<string>();
  return edges.filter((edge) => {
    const key = [
      edge.source,
      edge.target,
      edge.condition_type ?? "",
      edge.is_router_path ? "route" : "listen",
      edge.router_path_label ?? "",
    ].join("\0");
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function normalizeVisualizationStructure(value: object | FlowMetadataTarget | FlowVisualizationStructure): FlowVisualizationStructure {
  return isFlowVisualizationStructure(value) ? value : buildFlowStructure(value);
}

function isFlowVisualizationStructure(value: object | FlowMetadataTarget | FlowVisualizationStructure): value is FlowVisualizationStructure {
  return "nodes" in value && "edges" in value && "start_methods" in value && "router_methods" in value;
}

function edgesBySource(structure: FlowVisualizationStructure): ReadonlyMap<string, readonly FlowVisualizationEdge[]> {
  const graph = new Map<string, FlowVisualizationEdge[]>();
  for (const edge of structure.edges) {
    graph.set(edge.source, [...(graph.get(edge.source) ?? []), edge]);
  }
  return graph;
}

function parentsByChild(structure: FlowVisualizationStructure): ReadonlyMap<string, ReadonlySet<string>> {
  const parents = new Map<string, Set<string>>();
  for (const edge of structure.edges) {
    const sources = parents.get(edge.target) ?? new Set<string>();
    sources.add(edge.source);
    parents.set(edge.target, sources);
  }
  return parents;
}

function extractClassDescription(instanceOrConstructor: object | FlowMetadataTarget): string | null {
  const value = (typeof instanceOrConstructor === "function" ? instanceOrConstructor : instanceOrConstructor.constructor) as {
    description?: unknown;
    flowDescription?: unknown;
    flow_description?: unknown;
  };
  const description = value.description ?? value.flowDescription ?? value.flow_description;
  return typeof description === "string" && description.trim() ? description.trim() : null;
}

function detectsCrewReference(method: unknown): boolean {
  if (typeof method !== "function") {
    return false;
  }
  const source = Function.prototype.toString.call(method);
  return /\.crew\s*\(\s*\)|\bnew\s+Crew\s*\(|\bCrew\s*\(/.test(source);
}

function extractStateSchema(instanceOrConstructor: object | FlowMetadataTarget): FlowSerializedStateSchemaInfo | null {
  const stateHolder = instanceOrConstructor as { initialState?: unknown; initial_state?: unknown };
  const state: unknown = instanceOrConstructor instanceof Flow
    ? instanceOrConstructor.state as unknown
    : stateHolder.initialState ?? stateHolder.initial_state;
  if (!isSerializableStateRecord(state)) {
    return null;
  }
  const fields = Object.entries(state).map(([name, value]) => ({
    name,
    type: flowStateValueType(value),
    ...(value === undefined ? {} : { default: value }),
  }));
  return fields.length > 0 ? { fields } : null;
}

function extractFlowInputs(instanceOrConstructor: object | FlowMetadataTarget): readonly string[] {
  const ctor = typeof instanceOrConstructor === "function"
    ? instanceOrConstructor as FlowMetadataTarget
    : instanceOrConstructor.constructor as FlowMetadataTarget;
  const source = Function.prototype.toString.call(ctor);
  const constructorMatch = source.match(/constructor\s*\(([^)]*)\)/);
  if (!constructorMatch?.[1]) {
    return [];
  }
  const standard = new Set(["options", "initialState", "initial_state", "persistence", "stream", "checkpoint", "maxMethodCalls", "max_method_calls"]);
  return constructorMatch[1]
    .split(",")
    .map((part) => part.replace(/=.*/, "").replace(/^\s*(?:public|private|protected|readonly)\s+/, "").trim())
    .filter((part) => part && /^[A-Za-z_$][\w$]*$/.test(part) && !standard.has(part) && !part.startsWith("_"));
}

function isSerializableStateRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function flowStateValueType(value: unknown): string {
  if (Array.isArray(value)) {
    return "array";
  }
  if (value === null) {
    return "null";
  }
  if (value instanceof Date) {
    return "Date";
  }
  return typeof value;
}

function getMethodValue(instanceOrConstructor: object | FlowMetadataTarget, methodName: string): unknown {
  const target = typeof instanceOrConstructor === "function"
    ? instanceOrConstructor.prototype as Record<string, unknown>
    : instanceOrConstructor as Record<string, unknown>;
  const value = target[methodName];
  if (typeof value === "function") {
    return value;
  }
  const prototype = typeof instanceOrConstructor === "function"
    ? instanceOrConstructor.prototype as Record<string, unknown>
    : Object.getPrototypeOf(instanceOrConstructor) as Record<string, unknown> | null;
  return prototype?.[methodName];
}

function extractFunctionParameterNames(source: string): readonly string[] {
  const open = source.indexOf("(");
  if (open === -1) {
    return [];
  }
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
      if (depth === 0) {
        return source
          .slice(open + 1, index)
          .split(",")
          .map((part) => part.replace(/=.*/, "").replace(/^\s*\.\.\./, "").trim())
          .filter((part) => part && /^[A-Za-z_$][\w$]*$/.test(part));
      }
    }
  }
  return [];
}

function extractReturnExpressions(source: string): readonly string[] {
  const expressions: string[] = [];
  const returnPattern = /\breturn\s+([^;\n}]*)/g;
  for (const match of source.matchAll(returnPattern)) {
    const expression = match[1]?.trim();
    if (expression) {
      expressions.push(expression);
    }
  }
  return expressions;
}

function collectLocalStringValues(source: string): ReadonlyMap<string, readonly string[]> {
  const values = new Map<string, readonly string[]>();
  const declarationPattern = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+)/g;
  for (const match of source.matchAll(declarationPattern)) {
    const name = match[1];
    const expression = match[2]?.trim();
    if (!name || !expression || expression.startsWith("{")) {
      continue;
    }
    const constants = extractStringLiterals(expression);
    if (constants.length > 0) {
      values.set(name, constants);
    }
  }
  return values;
}

function collectLocalObjectStringValues(source: string): ReadonlyMap<string, readonly string[]> {
  const values = new Map<string, readonly string[]>();
  const declarationPattern = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\{([\s\S]*?)\}\s*;?/g;
  for (const match of source.matchAll(declarationPattern)) {
    const name = match[1];
    const body = match[2];
    if (!name || body === undefined) {
      continue;
    }
    const constants = extractStringLiterals(body);
    if (constants.length > 0) {
      values.set(name, constants);
    }
  }
  return values;
}

function stringConstantsFromExpression(
  expression: string,
  variableValues: ReadonlyMap<string, readonly string[]>,
  objectValues: ReadonlyMap<string, readonly string[]>,
): readonly string[] {
  const trimmed = expression.trim();
  const constants = [...extractStringLiterals(trimmed)];
  const variableName = trimmed.match(/^[A-Za-z_$][\w$]*$/)?.[0];
  if (variableName && variableValues.has(variableName)) {
    return variableValues.get(variableName) ?? [];
  }
  const objectName = trimmed.match(/^([A-Za-z_$][\w$]*)\s*(?:\[[^\]]+\]|\.\w+)/)?.[1];
  if (objectName && objectValues.has(objectName)) {
    return objectValues.get(objectName) ?? [];
  }
  const tokenPattern = /\b([A-Za-z_$][\w$]*)(\s*(?:\[[^\]]+\]|\.\w+))?/g;
  for (const match of trimmed.matchAll(tokenPattern)) {
    const token = match[1];
    const access = match[2];
    if (!token) {
      continue;
    }
    const values = access && objectValues.has(token)
      ? objectValues.get(token)
      : variableValues.get(token);
    for (const value of values ?? []) {
      if (!constants.includes(value)) {
        constants.push(value);
      }
    }
  }
  return constants;
}

function extractStringLiterals(value: string): readonly string[] {
  const literals: string[] = [];
  const literalPattern = /(["'`])((?:\\.|(?!\1)[\s\S])*)\1/g;
  for (const match of value.matchAll(literalPattern)) {
    const raw = match[2];
    if (raw === undefined || raw.includes("${")) {
      continue;
    }
    const unescaped = raw.replaceAll(/\\(["'`\\])/g, "$1");
    if (!literals.includes(unescaped)) {
      literals.push(unescaped);
    }
  }
  return literals;
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function extractLeadingComment(source: string): { summary: string | null; description: string | null } {
  const match = source.match(/^\s*(?:async\s+)?(?:function\s+)?[\w$]*\s*\([^)]*\)\s*\{\s*\/\*\*([\s\S]*?)\*\//);
  if (!match?.[1]) {
    return { summary: null, description: null };
  }
  const lines = match[1]
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s?/, "").trim())
    .filter(Boolean);
  return {
    summary: lines[0] ?? null,
    description: lines.length > 1 ? lines.slice(1).join("\n") : null,
  };
}

function routerPathsFor(methodName: string, entries: readonly FlowMethodEntry[]): readonly string[] {
  const routerEntry = entries.find((entry) => String(entry.name) === methodName && entry.kind === "router");
  if (!routerEntry) {
    return [];
  }
  return [
    ...new Set(
      entries
        .filter((entry) => String(entry.name) !== methodName)
        .flatMap((entry) => entry.condition ? extractDirectOrTriggers(entry.condition) : []),
    ),
  ];
}

function isRouterPath(trigger: string, methods: readonly FlowStructureMethod[]): boolean {
  return methods.some((method) => method.routerPaths.includes(trigger));
}

function extractDirectOrTriggers(condition: FlowCondition): string[] {
  if (condition.type === "AND") {
    return [];
  }
  return condition.conditions.flatMap((nested) => {
    if (typeof nested === "string") {
      return [nested];
    }
    if (typeof nested === "function") {
      return [nested.name];
    }
    return extractDirectOrTriggers(nested);
  });
}

function extractAllTriggerNames(condition: FlowCondition): string[] {
  return condition.conditions.flatMap((nested) => {
    if (typeof nested === "string") {
      return [nested];
    }
    if (typeof nested === "function") {
      return [nested.name];
    }
    return extractAllTriggerNames(nested);
  });
}

function flowDecorator(kind: FlowMethodKind, condition: FlowCondition | null): MethodDecoratorFactory {
  return function decorate<This extends object>(
    value: AnyFlowMethod<This>,
    context: ClassMethodDecoratorContext<This, AnyFlowMethod<This>>,
  ): AnyFlowMethod<This> {
    context.addInitializer(function init(this: This) {
      const ctor = this.constructor as FlowMetadataTarget;
      const entries = flowMetadata.get(ctor) ?? [];
      entries.push({ name: context.name, kind, condition });
      flowMetadata.set(ctor, entries);
    });
    return value;
  };
}

function normalizeFlowCondition(condition: FlowConditionInput | undefined): FlowCondition | null {
  if (!condition) {
    return null;
  }
  if (typeof condition === "object" && "type" in condition) {
    return condition;
  }
  return or_(condition);
}

function normalizeConditionInput(condition: FlowConditionInput): string | FlowCondition {
  if (typeof condition === "function") {
    return condition.name;
  }
  return condition;
}

function conditionSatisfied(
  condition: FlowCondition,
  completed: ReadonlySet<string>,
): { satisfied: true; triggerName: string } | { satisfied: false } {
  if (condition.type === "OR") {
    for (const nested of condition.conditions) {
      const result = nestedConditionSatisfied(nested, completed);
      if (result.satisfied) {
        return result;
      }
    }
    return { satisfied: false };
  }

  const results = condition.conditions.map((nested) => nestedConditionSatisfied(nested, completed));
  if (results.every((result) => result.satisfied)) {
    const last = results.at(-1) as { satisfied: true; triggerName: string } | undefined;
    return { satisfied: true, triggerName: last === undefined ? "" : last.triggerName };
  }
  return { satisfied: false };
}

function conditionIncludesTrigger(condition: FlowCondition, triggerName: string): boolean {
  return condition.conditions.some((nested) => nestedIncludesTrigger(nested, triggerName));
}

function nestedIncludesTrigger(condition: FlowConditionInput, triggerName: string): boolean {
  if (typeof condition === "string") {
    return condition === triggerName;
  }
  if (typeof condition === "function") {
    return condition.name === triggerName;
  }
  return conditionIncludesTrigger(condition, triggerName);
}

function flowStateId(state: object): string | null {
  const id = (state as Record<string, unknown>).id;
  return typeof id === "string" ? id : null;
}

function stringifyRouterOutput(output: unknown): string {
  if (
    typeof output === "string"
    || typeof output === "number"
    || typeof output === "boolean"
    || typeof output === "bigint"
  ) {
    return output.toString();
  }
  throw new Error("Flow router methods must return a string, number, boolean, or bigint path.");
}

type FlowCheckpointEntity = {
  checkpoint_completed_methods: string[];
  checkpoint_method_outputs: unknown[];
  checkpoint_method_counts: Record<string, number>;
  checkpoint_state: Record<string, unknown>;
};

function normalizeFlowCheckpointEntity(entity: unknown): FlowCheckpointEntity | null {
  if (entity instanceof Flow) {
    return {
      checkpoint_completed_methods: [...entity.completedMethods],
      checkpoint_method_outputs: [...entity.methodOutputs],
      checkpoint_method_counts: Object.fromEntries(entity.methodExecutionCounts),
      checkpoint_state: entity.stateSnapshot(),
    };
  }
  if (!entity || typeof entity !== "object") {
    return null;
  }
  const record = entity as Record<string, unknown>;
  if (record.type !== "Flow") {
    return null;
  }
  return {
    checkpoint_completed_methods: Array.isArray(record.checkpoint_completed_methods)
      ? record.checkpoint_completed_methods.map(String)
      : [],
    checkpoint_method_outputs: Array.isArray(record.checkpoint_method_outputs)
      ? Array.from(record.checkpoint_method_outputs as unknown[])
      : [],
    checkpoint_method_counts: normalizeMethodCounts(record.checkpoint_method_counts),
    checkpoint_state: isRecord(record.checkpoint_state)
      ? { ...record.checkpoint_state }
      : {},
  };
}

function normalizeMethodCounts(value: unknown): Record<string, number> {
  if (!isRecord(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, count]) => typeof count === "number" && Number.isFinite(count))
      .map(([name, count]) => [name, count]),
  ) as Record<string, number>;
}

function isArrayIndex(property: string): boolean {
  if (property === "") {
    return false;
  }
  const index = Number(property);
  return Number.isInteger(index) && index >= 0 && String(index) === property;
}

function withoutCheckpointOptions(options: FlowKickoffOptions): FlowKickoffOptions {
  return {
    ...(options.inputs === undefined ? {} : { inputs: options.inputs }),
    ...(options.inputFiles === undefined ? {} : { inputFiles: options.inputFiles }),
    ...(options.input_files === undefined ? {} : { input_files: options.input_files }),
    ...(options.restoreFromStateId === undefined ? {} : { restoreFromStateId: options.restoreFromStateId }),
    ...(options.restore_from_state_id === undefined ? {} : { restore_from_state_id: options.restore_from_state_id }),
  };
}

function normalizeFlowKickoffOptions(
  optionsOrInputs: FlowKickoffOptions | InputValues | null,
  inputFiles: InputFiles | null,
  fromCheckpoint: CheckpointConfig | null,
  restoreFromStateId: string | null,
): FlowKickoffOptions {
  const base = optionsOrInputs ?? {};
  const options = isFlowKickoffOptions(base)
    ? { ...base }
    : { inputs: base };
  if (inputFiles !== null) {
    options.inputFiles = inputFiles;
  }
  if (fromCheckpoint !== null) {
    options.fromCheckpoint = fromCheckpoint;
  }
  if (restoreFromStateId !== null) {
    options.restoreFromStateId = restoreFromStateId;
  }
  return options;
}

function isFlowKickoffOptions(value: FlowKickoffOptions | InputValues): value is FlowKickoffOptions {
  return Object.hasOwn(value, "inputs")
    || Object.hasOwn(value, "inputFiles")
    || Object.hasOwn(value, "input_files")
    || Object.hasOwn(value, "fromCheckpoint")
    || Object.hasOwn(value, "from_checkpoint")
    || Object.hasOwn(value, "restoreFromStateId")
    || Object.hasOwn(value, "restore_from_state_id");
}

async function loadPersistedFlowState(
  persistence: FlowPersistence,
  flowId: string,
): Promise<Record<string, unknown> | null> {
  if (persistence.loadState) {
    return await persistence.loadState(flowId);
  }
  if (persistence.load_state) {
    return await persistence.load_state(flowId);
  }
  return null;
}

function nestedConditionSatisfied(
  condition: FlowConditionInput,
  completed: ReadonlySet<string>,
): { satisfied: true; triggerName: string } | { satisfied: false } {
  if (typeof condition === "string") {
    return completed.has(condition)
      ? { satisfied: true, triggerName: condition }
      : { satisfied: false };
  }
  if (typeof condition === "function") {
    return completed.has(condition.name)
      ? { satisfied: true, triggerName: condition.name }
      : { satisfied: false };
  }
  return conditionSatisfied(condition, completed);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
