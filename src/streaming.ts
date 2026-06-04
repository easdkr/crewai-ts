import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

import {
  LLMStreamChunkEvent,
  crewaiEventBus,
  type BaseEvent,
} from "./events.js";
import { CrewOutput } from "./outputs.js";
import { sanitizeToolName } from "./tools.js";

export enum StreamChunkType {
  TEXT = "text",
  TOOL_CALL = "tool_call",
}

export type ToolCallChunk = {
  toolId?: string | null;
  tool_id?: string | null;
  toolName?: string | null;
  tool_name?: string | null;
  arguments: string;
  index?: number;
};
export const ToolCallChunk = Object.freeze({ kind: "ToolCallChunk" });

export type StreamChunkOptions = {
  content: string;
  chunkType?: StreamChunkType;
  chunk_type?: StreamChunkType;
  taskIndex?: number;
  task_index?: number;
  taskName?: string;
  task_name?: string;
  taskId?: string;
  task_id?: string;
  agentRole?: string;
  agent_role?: string;
  agentId?: string;
  agent_id?: string;
  toolCall?: ToolCallChunk | null;
  tool_call?: ToolCallChunk | null;
};

export class StreamChunk {
  readonly content: string;
  readonly chunkType: StreamChunkType;
  readonly chunk_type: StreamChunkType;
  readonly taskIndex: number;
  readonly task_index: number;
  readonly taskName: string;
  readonly task_name: string;
  readonly taskId: string;
  readonly task_id: string;
  readonly agentRole: string;
  readonly agent_role: string;
  readonly agentId: string;
  readonly agent_id: string;
  readonly toolCall: ToolCallChunk | null;
  readonly tool_call: ToolCallChunk | null;

  constructor(options: StreamChunkOptions) {
    this.content = options.content;
    this.chunkType = options.chunkType ?? options.chunk_type ?? StreamChunkType.TEXT;
    this.chunk_type = this.chunkType;
    this.taskIndex = options.taskIndex ?? options.task_index ?? 0;
    this.task_index = this.taskIndex;
    this.taskName = options.taskName ?? options.task_name ?? "";
    this.task_name = this.taskName;
    this.taskId = options.taskId ?? options.task_id ?? "";
    this.task_id = this.taskId;
    this.agentRole = options.agentRole ?? options.agent_role ?? "";
    this.agent_role = this.agentRole;
    this.agentId = options.agentId ?? options.agent_id ?? "";
    this.agent_id = this.agentId;
    this.toolCall = options.toolCall ?? options.tool_call ?? null;
    this.tool_call = this.toolCall;
  }

  toString(): string {
    return this.content;
  }

  __str__(): string {
    return this.toString();
  }
}

export abstract class StreamingOutputBase<TResult> implements AsyncIterable<StreamChunk> {
  protected resultValue: TResult | null = null;
  protected hasResult = false;
  protected completed = false;
  protected cancelled = false;
  protected error: unknown = null;
  protected readonly collectedChunks: StreamChunk[] = [];
  private iteratorStarted = false;

  constructor(private readonly run: () => Promise<TResult>) {}

  get result(): TResult {
    if (!this.completed) {
      throw new Error("Streaming has not completed yet. Iterate over all chunks before accessing result.");
    }
    if (this.error) {
      throw this.error instanceof Error ? this.error : new Error(formatThrownValue(this.error));
    }
    if (!this.hasResult) {
      throw new Error("No result available.");
    }
    return this.resultValue as TResult;
  }

  get isCompleted(): boolean {
    return this.completed;
  }

  get is_completed(): boolean {
    return this.isCompleted;
  }

  get isCancelled(): boolean {
    return this.cancelled;
  }

  get is_cancelled(): boolean {
    return this.isCancelled;
  }

  get chunks(): readonly StreamChunk[] {
    return [...this.collectedChunks];
  }

  getFullText(): string {
    return this.collectedChunks
      .filter((chunk) => chunk.chunkType === StreamChunkType.TEXT)
      .map((chunk) => chunk.content)
      .join("");
  }

  get_full_text(): string {
    return this.getFullText();
  }

  setResult(result: TResult): void {
    this.resultValue = result;
    this.hasResult = true;
    this.completed = true;
  }

  _set_result(result: TResult): void {
    this.setResult(result);
  }

  close(): void {
    this.cancelled = true;
    this.completed = true;
  }

  aclose(): Promise<void> {
    this.close();
    return Promise.resolve();
  }

  async __aenter__(): Promise<this> {
    await Promise.resolve();
    return this;
  }

  async __aexit__(..._excInfo: unknown[]): Promise<void> {
    void _excInfo;
    await this.aclose();
  }

  *[Symbol.iterator](): Iterator<StreamChunk> {
    if (!this.completed) {
      throw new Error("Streaming has not completed yet. Use async iteration before sync iteration.");
    }
    yield* this.collectedChunks;
  }

  *__iter__(): IterableIterator<StreamChunk> {
    yield* this;
  }

  async *[Symbol.asyncIterator](): AsyncIterableIterator<StreamChunk> {
    for await (const chunk of this._async_iterate()) {
      yield chunk;
    }
  }

  __aiter__(): AsyncIterableIterator<StreamChunk> {
    return this[Symbol.asyncIterator]();
  }

  async *_async_iterate(): AsyncIterableIterator<StreamChunk> {
    if (this.iteratorStarted) {
      for (const chunk of this.collectedChunks) {
        yield chunk;
      }
      return;
    }
    this.iteratorStarted = true;
    try {
      const result = await this.run();
      this.resultValue = result;
      this.hasResult = true;
      for (const chunk of this.chunksFromResult(result)) {
        if (this.cancelled) {
          break;
        }
        this.collectedChunks.push(chunk);
        yield chunk;
      }
      this.completed = true;
    } catch (error) {
      this.error = error;
      this.completed = true;
      throw error;
    }
  }

  protected abstract chunksFromResult(result: TResult): readonly StreamChunk[];
}

export class CrewStreamingOutput extends StreamingOutputBase<CrewOutput> {
  private resultValues: CrewOutput[] | null = null;

  get results(): readonly CrewOutput[] {
    if (!this.completed) {
      throw new Error("Streaming has not completed yet. Iterate over all chunks before accessing results.");
    }
    if (this.error) {
      throw this.error instanceof Error ? this.error : new Error(formatThrownValue(this.error));
    }
    if (this.resultValues) {
      return [...this.resultValues];
    }
    if (this.hasResult) {
      return [this.resultValue as CrewOutput];
    }
    throw new Error("No results available.");
  }

  setResults(results: readonly CrewOutput[]): void {
    this.resultValues = [...results];
    if (results.length > 0) {
      this.resultValue = results[0] ?? null;
      this.hasResult = true;
    }
    this.completed = true;
  }

  _set_results(results: readonly CrewOutput[]): void {
    this.setResults(results);
  }

  protected chunksFromResult(result: CrewOutput): readonly StreamChunk[] {
    return chunksFromCrewOutput(result);
  }
}

export class FlowStreamingOutput extends StreamingOutputBase<unknown> {
  protected chunksFromResult(result: unknown): readonly StreamChunk[] {
    if (result instanceof CrewOutput) {
      return chunksFromCrewOutput(result);
    }
    if (typeof result === "string") {
      return [new StreamChunk({ content: result })];
    }
    if (result === null || result === undefined) {
      return [];
    }
    return [new StreamChunk({ content: JSON.stringify(result) })];
  }
}

function chunksFromCrewOutput(result: CrewOutput): readonly StreamChunk[] {
  return result.raw
    ? [new StreamChunk({
      content: result.raw,
      taskIndex: Math.max(0, result.tasksOutput.length - 1),
      taskName: result.tasksOutput.at(-1)?.name ?? result.tasksOutput.at(-1)?.description ?? "",
      agentRole: result.tasksOutput.at(-1)?.agent ?? "",
    })]
    : [];
}

export const TaskInfo = Object.freeze({ kind: "TaskInfo" });
export type TaskInfo = {
  index: number;
  name: string;
  id: string;
  agent_role: string;
  agent_id: string;
};

type QueueItem = StreamChunk | null | Error;
type StreamHandler = (source: unknown, event: BaseEvent) => void;
const currentStreamIds = new AsyncLocalStorage<readonly string[]>();

class ChunkQueue {
  private readonly items: QueueItem[] = [];
  private readonly waiters: Array<(item: QueueItem) => void> = [];

  put(item: QueueItem): void {
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter(item);
      return;
    }
    this.items.push(item);
  }

  get(): QueueItem | undefined {
    return this.items.shift();
  }

  wait(): Promise<QueueItem> {
    const item = this.get();
    if (item !== undefined) {
      return Promise.resolve(item);
    }
    return new Promise((resolve) => {
      this.waiters.push(resolve);
    });
  }
}

export class StreamingState {
  readonly current_task_info: TaskInfo;
  readonly currentTaskInfo: TaskInfo;
  readonly result_holder: unknown[];
  readonly resultHolder: unknown[];
  readonly sync_queue: ChunkQueue;
  readonly syncQueue: ChunkQueue;
  readonly async_queue: ChunkQueue | null;
  readonly asyncQueue: ChunkQueue | null;
  readonly loop: null = null;
  readonly handler: StreamHandler;
  readonly stream_id: string | null;
  readonly streamId: string | null;

  constructor(options: {
    currentTaskInfo: TaskInfo;
    resultHolder: unknown[];
    syncQueue: ChunkQueue;
    asyncQueue?: ChunkQueue | null;
    handler: StreamHandler;
    streamId?: string | null;
  }) {
    this.current_task_info = options.currentTaskInfo;
    this.currentTaskInfo = options.currentTaskInfo;
    this.result_holder = options.resultHolder;
    this.resultHolder = options.resultHolder;
    this.sync_queue = options.syncQueue;
    this.syncQueue = options.syncQueue;
    this.async_queue = options.asyncQueue ?? null;
    this.asyncQueue = this.async_queue;
    this.handler = options.handler;
    this.stream_id = options.streamId ?? null;
    this.streamId = this.stream_id;
  }
}

export const logger = Object.freeze({
  debug: (...args: unknown[]) => {
    void args;
  },
  error: (...args: unknown[]) => {
    void args;
  },
});

export function createStreamingState(
  currentTaskInfo: TaskInfo,
  resultHolder: unknown[],
  useAsync = false,
): StreamingState {
  const syncQueue = new ChunkQueue();
  const asyncQueue = useAsync ? new ChunkQueue() : null;
  const streamId = randomUUID();
  const handler = createStreamHandler(currentTaskInfo, syncQueue, asyncQueue, streamId);
  crewaiEventBus.on("llm_stream_chunk", handler);
  return new StreamingState({
    currentTaskInfo,
    resultHolder,
    syncQueue,
    asyncQueue,
    handler,
    streamId,
  });
}

export const create_streaming_state = createStreamingState;

export function registerCleanup(streamingOutput: unknown, state: StreamingState): void {
  if (isRecord(streamingOutput)) {
    streamingOutput._on_cleanup = () => {
      unregisterHandler(state.handler);
    };
  }
}

export const register_cleanup = registerCleanup;

export function signalEnd(state: StreamingState, isAsync = false): void {
  queueFor(state, isAsync).put(null);
}

export const signal_end = signalEnd;

export function signalError(state: StreamingState, error: Error, isAsync = false): void {
  queueFor(state, isAsync).put(error);
}

export const signal_error = signalError;

export function* createChunkGenerator(
  state: StreamingState,
  runFunc: () => void,
  outputHolder: unknown[] = [],
): Generator<StreamChunk> {
  try {
    runWithStreamId(state, runFunc);
    signalEnd(state);
    for (;;) {
      const item = state.sync_queue.get();
      if (item === undefined || item === null) {
        break;
      }
      if (item instanceof Error) {
        throw item;
      }
      yield item;
    }
  } finally {
    finalizeStreaming(state, outputHolder[0]);
  }
}

export const create_chunk_generator = createChunkGenerator;

export async function* createAsyncChunkGenerator(
  state: StreamingState,
  runCoro: () => unknown,
  outputHolder: unknown[] = [],
): AsyncGenerator<StreamChunk> {
  if (!state.async_queue) {
    throw new Error("Async queue not initialized. Use create_streaming_state(use_async=true).");
  }
  const task = runWithStreamId(state, async () => await Promise.resolve().then(() => runCoro())).finally(() => {
    signalEnd(state, true);
  });
  try {
    for (;;) {
      const item = await state.async_queue.wait();
      if (item === null) {
        break;
      }
      if (item instanceof Error) {
        throw item;
      }
      yield item;
    }
    await task;
  } finally {
    finalizeStreaming(state, outputHolder[0]);
  }
}

export const create_async_chunk_generator = createAsyncChunkGenerator;

function formatThrownValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === null || value === undefined) {
    return "Unknown streaming error.";
  }
  try {
    return JSON.stringify(value);
  } catch {
    return "Unknown streaming error.";
  }
}

function createStreamHandler(
  currentTaskInfo: TaskInfo,
  syncQueue: ChunkQueue,
  asyncQueue: ChunkQueue | null,
  streamId: string | null,
): StreamHandler {
  return (_source: unknown, event: BaseEvent) => {
    if (!(event instanceof LLMStreamChunkEvent)) {
      return;
    }
    const activeStreamIds = currentStreamIds.getStore() ?? [];
    if (activeStreamIds.length > 0 && streamId && !activeStreamIds.includes(streamId)) {
      return;
    }
    const chunk = createStreamChunk(event, currentTaskInfo);
    if (asyncQueue) {
      asyncQueue.put(chunk);
    } else {
      syncQueue.put(chunk);
    }
  };
}

function runWithStreamId<T>(state: StreamingState, callback: () => T): T {
  if (!state.stream_id) {
    return callback();
  }
  const previous = currentStreamIds.getStore() ?? [];
  return currentStreamIds.run([...previous, state.stream_id], callback);
}

function createStreamChunk(event: LLMStreamChunkEvent, currentTaskInfo: TaskInfo): StreamChunk {
  const toolCall = event.tool_call
    ? {
        tool_id: event.tool_call.id ?? null,
        tool_name: event.tool_call.function.name ? sanitizeToolName(event.tool_call.function.name) : null,
        arguments: event.tool_call.function.arguments,
        index: event.tool_call.index,
      }
    : null;
  return new StreamChunk({
    content: event.chunk,
    chunk_type: toolCall ? StreamChunkType.TOOL_CALL : StreamChunkType.TEXT,
    task_index: currentTaskInfo.index,
    task_name: currentTaskInfo.name,
    task_id: currentTaskInfo.id,
    agent_role: event.agent_role ?? currentTaskInfo.agent_role,
    agent_id: event.agent_id ?? currentTaskInfo.agent_id,
    tool_call: toolCall,
  });
}

function unregisterHandler(handler: StreamHandler): void {
  crewaiEventBus.off("llm_stream_chunk", handler);
}

function finalizeStreaming(state: StreamingState, streamingOutput: unknown): void {
  unregisterHandler(state.handler);
  if (isRecord(streamingOutput)) {
    streamingOutput._on_cleanup = null;
    const setResult = streamingOutput._set_result;
    if (typeof setResult === "function" && state.result_holder.length > 0) {
      setResult.call(streamingOutput, state.result_holder[0]);
    }
  }
}

function queueFor(state: StreamingState, isAsync: boolean): ChunkQueue {
  return isAsync && state.async_queue ? state.async_queue : state.sync_queue;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
