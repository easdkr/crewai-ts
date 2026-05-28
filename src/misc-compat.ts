import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { hasUserDeclinedTracing, isTracingEnabled, loadUserData, updateUserData } from "./settings.js";

let tracingEnabled: boolean | null = null;
let suppressTracingMessages = false;

export function setSuppressTracingMessages(suppress: boolean): boolean {
  const previous = suppressTracingMessages;
  suppressTracingMessages = suppress;
  return previous;
}

export const set_suppress_tracing_messages = setSuppressTracingMessages;

export function shouldSuppressTracingMessages(): boolean {
  return suppressTracingMessages;
}

export const should_suppress_tracing_messages = shouldSuppressTracingMessages;

export function shouldEnableTracing(options: { override?: boolean | null } = {}): boolean {
  if (options.override !== undefined && options.override !== null) {
    return options.override;
  }
  const env = process.env.CREWAI_TRACING_ENABLED?.toLowerCase();
  if (env === "true" || env === "1") {
    return true;
  }
  return isTracingEnabled();
}

export const should_enable_tracing = shouldEnableTracing;

export function setTracingEnabled(enabled: boolean): boolean | null {
  const previous = tracingEnabled;
  tracingEnabled = enabled;
  return previous;
}

export const set_tracing_enabled = setTracingEnabled;

export function resetTracingEnabled(token: boolean | null): void {
  tracingEnabled = token;
}

export const reset_tracing_enabled = resetTracingEnabled;

export function isTracingEnabledInContext(): boolean {
  return tracingEnabled ?? false;
}

export const is_tracing_enabled_in_context = isTracingEnabledInContext;

export function onFirstExecutionTracingConfirmation(): boolean {
  if (process.env.CREWAI_TESTING?.toLowerCase() === "true") {
    return false;
  }
  if (isFirstExecution()) {
    markFirstExecutionDone();
  }
  return false;
}

export const on_first_execution_tracing_confirmation = onFirstExecutionTracingConfirmation;

export function getUserId(): string {
  const data = loadUserData();
  if (typeof data.user_id === "string") {
    return data.user_id;
  }
  const userId = createHash("sha256").update(`${process.env.USER ?? "unknown"}|${randomUUID()}`).digest("hex");
  updateUserData({ user_id: userId });
  return userId;
}

export const get_user_id = getUserId;

export function isFirstExecution(): boolean {
  return !loadUserData().first_execution_done;
}

export const is_first_execution = isFirstExecution;

export function markFirstExecutionDone(userConsented = false): void {
  if (!isFirstExecution()) {
    return;
  }
  updateUserData({
    first_execution_done: true,
    first_execution_at: Date.now() / 1000,
    user_id: getUserId(),
    trace_consent: userConsented,
  });
}

export const mark_first_execution_done = markFirstExecutionDone;

export function markFirstExecutionCompleted(userConsented = false): void {
  markFirstExecutionDone(userConsented);
}

export const mark_first_execution_completed = markFirstExecutionCompleted;

export function safeSerializeToDict(obj: unknown, exclude: ReadonlySet<string> | null = null): Record<string, unknown> {
  try {
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      return Object.fromEntries(
        Object.entries(obj as Record<string, unknown>).filter(([key]) => !exclude?.has(key)),
      );
    }
    return { serialized_data: obj };
  } catch (error) {
    return { serialization_error: error instanceof Error ? error.message : String(error), object_type: typeof obj };
  }
}

export const safe_serialize_to_dict = safeSerializeToDict;

export function truncateMessages(messages: readonly Record<string, unknown>[], maxContentLength = 500, maxMessages = 5): Record<string, unknown>[] {
  return messages.slice(0, maxMessages).map((message) => {
    const content = message.content;
    return typeof content === "string" && content.length > maxContentLength
      ? { ...message, content: `${content.slice(0, maxContentLength)}...` }
      : { ...message };
  });
}

export const truncate_messages = truncateMessages;

export function shouldAutoCollectFirstTimeTraces(): boolean {
  return process.env.CREWAI_TESTING?.toLowerCase() !== "true"
    && !hasUserDeclinedTracing()
    && !isTracingEnabledInContext()
    && isFirstExecution();
}

export const should_auto_collect_first_time_traces = shouldAutoCollectFirstTimeTraces;

export function promptUserForTraceViewing(_timeoutSeconds = 20): boolean {
  void _timeoutSeconds;
  return false;
}

export const prompt_user_for_trace_viewing = promptUserForTraceViewing;

export const CREWAI_ORANGE = "#FF5A50";
export const DARK_GRAY = "#333333";
export const WHITE = "#FFFFFF";
export const GRAY = "#666666";
export const BG_DARK = "#0d1117";
export const BG_CARD = "#161b22";
export const BORDER_SUBTLE = "#30363d";
export const TEXT_PRIMARY = "#e6edf3";
export const TEXT_SECONDARY = "#7d8590";

export const CSSExtension = Object.freeze({ kind: "CSSExtension" });
export const JSExtension = Object.freeze({ kind: "JSExtension" });

export type FlowVizStructure = {
  nodes?: Record<string, Record<string, unknown>>;
  edges?: readonly Record<string, unknown>[];
  start_methods?: readonly string[];
  startMethods?: readonly string[];
};

export function calculateNodePositions(dag: FlowVizStructure): Record<string, { level: number; x: number; y: number }> {
  const nodeNames = Object.keys(dag.nodes ?? {});
  const startMethods = new Set(dag.start_methods ?? dag.startMethods ?? []);
  return Object.fromEntries(nodeNames.map((name, index) => [
    name,
    {
      level: startMethods.has(name) ? 0 : 1,
      x: index * 260,
      y: startMethods.has(name) ? 0 : 220,
    },
  ]));
}

export const calculate_node_positions = calculateNodePositions;

export function renderInteractive(dag: FlowVizStructure, filename = "flow_dag.html", show = true): string {
  void show;
  const dir = mkdtempSync(join(tmpdir(), "crewai-flow-"));
  const outputPath = join(dir, filename.split(/[\\/]/).at(-1) ?? "flow_dag.html");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>CrewAI Flow</title></head><body><pre>${escapeHtml(JSON.stringify({ dag, positions: calculateNodePositions(dag) }, null, 2))}</pre></body></html>`;
  writeFileSync(outputPath, html, "utf8");
  return outputPath;
}

export const render_interactive = renderInteractive;

export const ProtocolVersion = Object.freeze(["0.2.0", "0.2.1", "0.2.2", "0.2.3", "0.2.4", "0.2.5", "0.2.6", "0.3.0", "0.4.0"]);
export const Url = String;
export const AgentResponseProtocol = Object.freeze({ kind: "AgentResponseProtocol" });
export const PartsMetadataDict = Object.freeze({ kind: "PartsMetadataDict" });
export const PartsDict = Object.freeze({ kind: "PartsDict" });
export const PollingHandlerType = Object.freeze({ kind: "PollingHandlerType" });
export const StreamingHandlerType = Object.freeze({ kind: "StreamingHandlerType" });
export const PushNotificationHandlerType = Object.freeze({ kind: "PushNotificationHandlerType" });
export const HandlerType = Object.freeze({ kind: "HandlerType" });
export const HANDLER_REGISTRY = new Map<unknown, unknown>();

export class CommonParams {
  readonly turn_number: number;
  readonly is_multiturn: boolean;
  readonly agent_role: string | null;
  readonly endpoint: string;
  readonly a2a_agent_name: string | null;
  readonly context_id: string | null;
  readonly from_task: unknown;
  readonly from_agent: unknown;

  constructor(options: {
    turn_number?: number;
    is_multiturn?: boolean;
    agent_role?: string | null;
    endpoint: string;
    a2a_agent_name?: string | null;
    context_id?: string | null;
    from_task?: unknown;
    from_agent?: unknown;
  }) {
    this.turn_number = options.turn_number ?? 0;
    this.is_multiturn = options.is_multiturn ?? false;
    this.agent_role = options.agent_role ?? null;
    this.endpoint = options.endpoint;
    this.a2a_agent_name = options.a2a_agent_name ?? null;
    this.context_id = options.context_id ?? null;
    this.from_task = options.from_task;
    this.from_agent = options.from_agent;
  }
}

export const BaseHandlerKwargs = Object.freeze({ kind: "BaseHandlerKwargs" });
export const PollingHandlerKwargs = Object.freeze({ kind: "PollingHandlerKwargs" });
export const StreamingHandlerKwargs = Object.freeze({ kind: "StreamingHandlerKwargs" });
export const PushNotificationHandlerKwargs = Object.freeze({ kind: "PushNotificationHandlerKwargs" });
export const PushNotificationResultStore = Object.freeze({ kind: "PushNotificationResultStore" });
export const UpdateHandler = Object.freeze({ kind: "UpdateHandler" });

export function extractCommonParams(kwargs: Record<string, unknown>): CommonParams {
  if (typeof kwargs.endpoint !== "string") {
    throw new Error("endpoint is required for update handlers");
  }
  return new CommonParams({
    turn_number: typeof kwargs.turn_number === "number" ? kwargs.turn_number : 0,
    is_multiturn: typeof kwargs.is_multiturn === "boolean" ? kwargs.is_multiturn : false,
    agent_role: typeof kwargs.agent_role === "string" ? kwargs.agent_role : null,
    endpoint: kwargs.endpoint,
    a2a_agent_name: typeof kwargs.a2a_agent_name === "string" ? kwargs.a2a_agent_name : null,
    context_id: typeof kwargs.context_id === "string" ? kwargs.context_id : null,
    from_task: kwargs.from_task,
    from_agent: kwargs.from_agent,
  });
}

export const extract_common_params = extractCommonParams;

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
