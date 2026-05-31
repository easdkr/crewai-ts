import type { LiteAgentOutput } from "./lite-agent-output.js";
import type { TaskOutput } from "./outputs.js";
import { callLLM, createLLMClient, type LLM } from "./llm.js";
import type { LLMMessage } from "./types.js";
import {
  LLMGuardrailCompletedEvent,
  LLMGuardrailStartedEvent,
  crewaiEventBus,
} from "./events.js";

export type GuardrailCallable = (output: TaskOutput | LiteAgentOutput) => readonly [boolean, unknown];
export const GuardrailCallable = Function;
export type GuardrailType = GuardrailCallable | string;
export const GuardrailType = Object.freeze({ kind: "GuardrailType" });
export type GuardrailsType = readonly GuardrailType[] | GuardrailType;
export const GuardrailsType = Object.freeze({ kind: "GuardrailsType" });
export type AsyncGuardrailCallable = (output: TaskOutput | LiteAgentOutput) => Promise<readonly [boolean, unknown]>;

export class GuardrailResult {
  readonly success: boolean;
  readonly result: unknown;
  readonly error: string | null;

  constructor(options: { success: boolean; result?: unknown; error?: string | null }) {
    if (options.success && options.error) {
      throw new Error("Cannot have both result and error when success is True");
    }
    if (!options.success && options.result !== undefined && options.result !== null) {
      throw new Error("Cannot have both result and error when success is False");
    }
    this.success = options.success;
    this.result = options.result ?? null;
    this.error = options.error ?? null;
  }

  static fromTuple(result: readonly [boolean, unknown]): GuardrailResult {
    const [success, data] = result;
    return new GuardrailResult({
      success,
      result: success ? data : null,
      error: success ? null : String(data),
    });
  }

  static from_tuple(result: readonly [boolean, unknown]): GuardrailResult {
    return GuardrailResult.fromTuple(result);
  }

  static validateResultErrorExclusivity(value: unknown, info: { data?: Record<string, unknown> } = {}): unknown {
    const values = info.data ?? {};
    if (values.success === true && value && values.error) {
      throw new Error("Cannot have both result and error when success is True");
    }
    if (values.success === false && value && values.result) {
      throw new Error("Cannot have both result and error when success is False");
    }
    return value;
  }

  static validate_result_error_exclusivity(value: unknown, info: { data?: Record<string, unknown> } = {}): unknown {
    return GuardrailResult.validateResultErrorExclusivity(value, info);
  }
}

export function serializeGuardrailForJson(value: unknown, fieldName = "guardrail"): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "function") {
    process.emitWarning(
      `Callable '${fieldName}' cannot be JSON-serialized and will be dropped during checkpointing; restored checkpoints will not run this guardrail.`,
      "UserWarning",
    );
  }
  return null;
}

export const serialize_guardrail_for_json = serializeGuardrailForJson;

export function serializeGuardrailsForJson(value: unknown, fieldName = "guardrails"): readonly string[] | string | null {
  if (Array.isArray(value)) {
    return value
      .map((item) => serializeGuardrailForJson(item, fieldName))
      .filter((item): item is string => item !== null);
  }
  return serializeGuardrailForJson(value, fieldName);
}

export const serialize_guardrails_for_json = serializeGuardrailsForJson;

export function processGuardrail(
  output: TaskOutput | LiteAgentOutput,
  guardrail: GuardrailCallable | null | undefined,
  options: {
    retryCount?: number;
    retry_count?: number;
    fromAgent?: unknown;
    from_agent?: unknown;
    fromTask?: unknown;
    from_task?: unknown;
    eventSource?: unknown;
    event_source?: unknown;
  } = {},
): GuardrailResult {
  if (!isOutputLike(output)) {
    throw new TypeError("Output must be a TaskOutput or LiteAgentOutput");
  }
  if (!guardrail) {
    throw new Error("Guardrail must not be None");
  }
  const retryCount = options.retryCount ?? options.retry_count ?? 0;
  const fromAgent = options.fromAgent ?? options.from_agent;
  const fromTask = options.fromTask ?? options.from_task;
  const eventSource = options.eventSource ?? options.event_source ?? output;
  const started = new LLMGuardrailStartedEvent({
    guardrail,
    retry_count: retryCount,
    ...(fromAgent === undefined ? {} : { from_agent: fromAgent }),
    ...(fromTask === undefined ? {} : { from_task: fromTask }),
  });
  crewaiEventBus.emit(eventSource, started);
  try {
    const result = GuardrailResult.fromTuple(guardrail(output));
    crewaiEventBus.emit(eventSource, new LLMGuardrailCompletedEvent({
      success: result.success,
      result: result.result,
      ...(result.error === null ? {} : { error: result.error }),
      retry_count: retryCount,
      guardrail_type: started.guardrail_type,
      guardrail_name: started.guardrail_name,
      ...(fromAgent === undefined ? {} : { from_agent: fromAgent }),
      ...(fromTask === undefined ? {} : { from_task: fromTask }),
    }));
    return result;
  } catch (error) {
    crewaiEventBus.emit(eventSource, new LLMGuardrailCompletedEvent({
      success: false,
      result: null,
      error,
      retry_count: retryCount,
      guardrail_type: started.guardrail_type,
      guardrail_name: started.guardrail_name,
      ...(fromAgent === undefined ? {} : { from_agent: fromAgent }),
      ...(fromTask === undefined ? {} : { from_task: fromTask }),
    }));
    throw error;
  }
}

export const process_guardrail = processGuardrail;

export type LLMGuardrailOptions = {
  description: string;
  llm: LLM;
};

export class LLMGuardrailResult {
  readonly valid: boolean;
  readonly feedback: string | null;

  constructor(options: { valid: boolean; feedback?: string | null }) {
    this.valid = options.valid;
    this.feedback = options.feedback ?? null;
  }
}

export class LLMGuardrail {
  readonly description: string;
  readonly llm: LLM;

  constructor(options: LLMGuardrailOptions);
  constructor(description: string, llm: LLM);
  constructor(optionsOrDescription: LLMGuardrailOptions | string, llm?: LLM) {
    if (typeof optionsOrDescription === "string") {
      if (!llm) {
        throw new Error("LLMGuardrail requires an llm.");
      }
      this.description = optionsOrDescription;
      this.llm = llm;
      return;
    }
    this.description = optionsOrDescription.description;
    this.llm = optionsOrDescription.llm;
  }

  async validateOutput(taskOutput: TaskOutput | LiteAgentOutput): Promise<LLMGuardrailResult> {
    const messages: LLMMessage[] = [
      {
        role: "system",
        content: [
          "You validate whether a task result complies with a guardrail.",
          "Return JSON only with keys valid:boolean and feedback:string|null.",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          "Ensure the following task result complies with the given guardrail.",
          "",
          "Task result:",
          taskOutput.raw,
          "",
          "Guardrail:",
          this.description,
          "",
          "If invalid, provide clear feedback explaining what is wrong. If valid, set feedback to null.",
        ].join("\n"),
      },
    ];
    const response = await callLLM(createLLMClient(this.llm), messages, {
      responseModel: LLMGuardrailResult,
    });
    return parseLLMGuardrailResult(response);
  }

  async call(taskOutput: TaskOutput | LiteAgentOutput): Promise<readonly [boolean, unknown]> {
    try {
      const result = await this.validateOutput(taskOutput);
      return result.valid ? [true, taskOutput.raw] : [false, result.feedback];
    } catch (error) {
      return [false, `Error while validating the task output: ${formatGuardrailError(error)}`];
    }
  }

  asGuardrail(): AsyncGuardrailCallable {
    return this.call.bind(this);
  }
}

export type HallucinationGuardrailOptions = {
  llm: LLM;
  context?: string | null;
  threshold?: number | null;
  toolResponse?: string;
  tool_response?: string;
};

export type HallucinationGuardrailHook = (
  guardrail: HallucinationGuardrail,
  taskOutput: TaskOutput | LiteAgentOutput,
) => readonly [boolean, unknown];

let hallucinationGuardrailHook: HallucinationGuardrailHook | null = null;

export function setHallucinationGuardrailHook(hook: HallucinationGuardrailHook | null): void {
  hallucinationGuardrailHook = hook;
}

export const set_hallucination_guardrail_hook = setHallucinationGuardrailHook;

export class HallucinationGuardrail {
  readonly context: string | null;
  readonly llm: LLM;
  readonly threshold: number | null;
  readonly toolResponse: string;
  readonly tool_response: string;

  constructor(options: HallucinationGuardrailOptions);
  constructor(llm: LLM, context?: string | null, threshold?: number | null, toolResponse?: string);
  constructor(
    optionsOrLlm: HallucinationGuardrailOptions | LLM,
    context?: string | null,
    threshold?: number | null,
    toolResponse = "",
  ) {
    if (isHallucinationGuardrailOptions(optionsOrLlm)) {
      this.llm = optionsOrLlm.llm;
      this.context = optionsOrLlm.context ?? null;
      this.threshold = optionsOrLlm.threshold ?? null;
      this.toolResponse = optionsOrLlm.toolResponse ?? optionsOrLlm.tool_response ?? "";
      this.tool_response = this.toolResponse;
      return;
    }
    this.llm = optionsOrLlm;
    this.context = context ?? null;
    this.threshold = threshold ?? null;
    this.toolResponse = toolResponse;
    this.tool_response = this.toolResponse;
  }

  get description(): string {
    return "HallucinationGuardrail (no-op)";
  }

  call(taskOutput: TaskOutput | LiteAgentOutput): readonly [boolean, unknown] {
    if (hallucinationGuardrailHook) {
      return hallucinationGuardrailHook(this, taskOutput);
    }
    return [true, taskOutput.raw];
  }

  asGuardrail(): GuardrailCallable {
    return this.call.bind(this);
  }
}

function isOutputLike(output: unknown): output is TaskOutput | LiteAgentOutput {
  return Boolean(output && typeof output === "object" && "raw" in output);
}

function parseLLMGuardrailResult(response: unknown): LLMGuardrailResult {
  const value = typeof response === "string" ? parseJsonObject(response) : response;
  if (isRecord(value) && typeof value.valid === "boolean") {
    return new LLMGuardrailResult({
      valid: value.valid,
      feedback: typeof value.feedback === "string" ? value.feedback : null,
    });
  }
  if (typeof response === "string") {
    const normalized = response.trim().toLowerCase();
    if (normalized === "valid" || normalized.includes("\"valid\":true")) {
      return new LLMGuardrailResult({ valid: true });
    }
    return new LLMGuardrailResult({ valid: false, feedback: response });
  }
  throw new Error("The guardrail result is not a valid structured response");
}

function parseJsonObject(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function formatGuardrailError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isHallucinationGuardrailOptions(value: unknown): value is HallucinationGuardrailOptions {
  return Boolean(value && typeof value === "object" && "llm" in value);
}
