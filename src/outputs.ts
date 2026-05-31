import { OutputFormat } from "./types.js";
import { emptyUsageMetrics, type UsageMetrics } from "./llm.js";

export type TaskOutputOptions = {
  description: string;
  name?: string | null;
  expectedOutput?: string | null;
  expected_output?: string | null;
  raw?: string;
  jsonDict?: Record<string, unknown> | null;
  json_dict?: Record<string, unknown> | null;
  pydantic?: unknown;
  agent: string;
  outputFormat?: OutputFormat;
  output_format?: OutputFormat;
  messages?: readonly unknown[];
};

export class TaskOutput {
  readonly description: string;
  readonly name: string | null;
  readonly expectedOutput: string | null;
  summary: string;
  readonly raw: string;
  readonly jsonDict: Record<string, unknown> | null;
  readonly json_dict: Record<string, unknown> | null;
  readonly pydantic: unknown;
  readonly agent: string;
  readonly outputFormat: OutputFormat;
  readonly output_format: OutputFormat;
  readonly messages: readonly unknown[];

  constructor(options: TaskOutputOptions) {
    this.description = options.description;
    this.name = options.name ?? null;
    this.expectedOutput = options.expectedOutput ?? options.expected_output ?? null;
    this.raw = options.raw ?? "";
    this.jsonDict = options.jsonDict ?? options.json_dict ?? null;
    this.json_dict = this.jsonDict;
    this.pydantic = options.pydantic ?? null;
    this.agent = options.agent;
    this.outputFormat = options.outputFormat ?? options.output_format ?? OutputFormat.RAW;
    this.output_format = this.outputFormat;
    this.messages = options.messages ?? [];
    this.summary = "";
    this.set_summary();
  }

  set_summary(): this {
    this.summary = `${this.description.split(/\s+/).slice(0, 10).join(" ")}...`;
    return this;
  }

  get json(): string | null {
    if (this.outputFormat !== OutputFormat.JSON) {
      throw new Error(
        "Invalid output format requested. Set outputJson on the task before reading json.",
      );
    }
    return JSON.stringify(this.jsonDict);
  }

  toDict(): Record<string, unknown> {
    if (this.jsonDict) {
      return { ...this.jsonDict };
    }
    if (this.pydantic && typeof this.pydantic === "object") {
      return { ...(this.pydantic as Record<string, unknown>) };
    }
    return {};
  }

  to_dict(): Record<string, unknown> {
    return this.toDict();
  }

  toString(): string {
    if (this.pydantic !== null && this.pydantic !== undefined) {
      return stringifyOutput(this.pydantic);
    }
    if (this.jsonDict) {
      return JSON.stringify(this.jsonDict);
    }
    return this.raw;
  }

  __str__(): string {
    return this.toString();
  }
}

export type CrewOutputOptions = {
  raw?: string;
  pydantic?: unknown;
  jsonDict?: Record<string, unknown> | null;
  json_dict?: Record<string, unknown> | null;
  tasksOutput?: readonly TaskOutput[];
  tasks_output?: readonly TaskOutput[];
  tokenUsage?: UsageMetrics;
  token_usage?: UsageMetrics;
};

export class CrewOutput {
  readonly raw: string;
  readonly pydantic: unknown;
  readonly jsonDict: Record<string, unknown> | null;
  readonly json_dict: Record<string, unknown> | null;
  readonly tasksOutput: readonly TaskOutput[];
  readonly tasks_output: readonly TaskOutput[];
  readonly tokenUsage: UsageMetrics;
  readonly token_usage: UsageMetrics;

  constructor(options: CrewOutputOptions = {}) {
    this.raw = options.raw ?? "";
    this.pydantic = options.pydantic ?? null;
    this.jsonDict = options.jsonDict ?? options.json_dict ?? null;
    this.json_dict = this.jsonDict;
    this.tasksOutput = options.tasksOutput ?? options.tasks_output ?? [];
    this.tasks_output = this.tasksOutput;
    this.tokenUsage = options.tokenUsage ?? options.token_usage ?? emptyUsageMetrics();
    this.token_usage = this.tokenUsage;
  }

  get json(): string | null {
    const lastTask = this.tasksOutput.at(-1);
    if (!lastTask || lastTask.outputFormat !== OutputFormat.JSON) {
      throw new Error(
        "No JSON output found in the final task. Set outputJson on the final task before reading json.",
      );
    }
    return JSON.stringify(this.jsonDict);
  }

  toDict(): Record<string, unknown> {
    if (this.jsonDict) {
      return { ...this.jsonDict };
    }
    if (this.pydantic && typeof this.pydantic === "object") {
      return { ...(this.pydantic as Record<string, unknown>) };
    }
    return {};
  }

  to_dict(): Record<string, unknown> {
    return this.toDict();
  }

  get(key: string): unknown {
    if (this.pydantic && typeof this.pydantic === "object" && key in this.pydantic) {
      return (this.pydantic as Record<string, unknown>)[key];
    }
    if (this.jsonDict && key in this.jsonDict) {
      return this.jsonDict[key];
    }
    throw new Error(`Key '${key}' not found in CrewOutput.`);
  }

  __getitem__(key: string): unknown {
    return this.get(key);
  }

  toString(): string {
    if (this.pydantic !== null && this.pydantic !== undefined) {
      return stringifyOutput(this.pydantic);
    }
    if (this.jsonDict) {
      return JSON.stringify(this.jsonDict);
    }
    return this.raw;
  }

  __str__(): string {
    return this.toString();
  }
}

function stringifyOutput(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return value.toString();
  }
  return JSON.stringify(value);
}
