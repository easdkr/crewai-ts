export type InputValues = Record<string, unknown>;

export type MaybePromise<T> = T | Promise<T>;

export type LLMMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  files?: import("./input-files.js").InputFiles;
  cache_breakpoint?: boolean;
};

export const LLMMessage = class LLMMessage {
  readonly role: "system" | "user" | "assistant" | "tool";
  readonly content: string;
  readonly files?: import("./input-files.js").InputFiles;
  readonly cache_breakpoint?: boolean;

  constructor(options: LLMMessage) {
    this.role = options.role;
    this.content = options.content;
    if (options.files !== undefined) {
      this.files = options.files;
    }
    if (options.cache_breakpoint !== undefined) {
      this.cache_breakpoint = options.cache_breakpoint;
    }
  }
};

export type LLM = import("./llm.js").LLM;

export type ToolContext = {
  input: string;
  inputs: InputValues;
};

export type Tool = {
  name: string;
  description?: string;
  resultAsAnswer?: boolean;
  run: (context?: ToolContext | Record<string, unknown> | string) => MaybePromise<unknown>;
};

export const Tool = Object;

export function create_literals_from_strings<T extends readonly string[]>(values: T): T {
  return values;
}

export type AgentStep =
  | {
    type: "tool";
    agentRole: string;
    iteration: number;
    toolName: string;
    toolArgs: Record<string, unknown>;
    output: string;
    resultAsAnswer: false;
  }
  | {
    type: "direct_tool";
    agentRole: string;
    iteration: number;
    toolName: string;
    toolArgs: Record<string, unknown>;
    output: string;
    resultAsAnswer: true;
  }
  | {
    type: "final";
    agentRole: string;
    iteration: number;
    output: string;
  };

export type AgentStepCallback = (step: AgentStep) => MaybePromise<void>;

export type TaskCallback = (output: import("./outputs.js").TaskOutput) => MaybePromise<void>;

export type CrewKickoffCallback<T> = (value: T) => MaybePromise<T>;

export enum Process {
  sequential = "sequential",
  hierarchical = "hierarchical",
}

export enum OutputFormat {
  RAW = "raw",
  JSON = "json",
  PYDANTIC = "pydantic",
}
