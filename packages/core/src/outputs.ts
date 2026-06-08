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
  readonly expected_output: string | null;
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
    this.expected_output = this.expectedOutput;
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
    this.summary = `${this.description.split(" ").slice(0, 10).join(" ")}...`;
    return this;
  }

  get json(): string | null {
    if (this.outputFormat !== OutputFormat.JSON) {
      throw new Error(
        [
          "Invalid output format requested.",
          "If you would like to access the JSON output,",
          "please make sure to set the output_json property for the task",
        ].join("\n"),
      );
    }
    return jsonDumps(this.jsonDict);
  }

  toDict(): Record<string, unknown> {
    if (hasJsonDictContent(this.jsonDict)) {
      return { ...this.jsonDict };
    }
    const dumped = dumpPydanticLike(this.pydantic);
    if (dumped) {
      return dumped;
    }
    return {};
  }

  to_dict(): Record<string, unknown> {
    return this.toDict();
  }

  modelDump(): Record<string, unknown> {
    return {
      description: this.description,
      raw: this.raw,
      pydantic: this.pydantic,
      json_dict: this.jsonDict,
      agent: this.agent,
      summary: this.summary,
      name: this.name ?? this.description,
      expected_output: this.expectedOutput,
      output_format: this.outputFormat,
      messages: [...this.messages],
    };
  }

  model_dump(): Record<string, unknown> {
    return this.modelDump();
  }

  toJSON(): Record<string, unknown> {
    return this.modelDump();
  }

  toString(): string {
    if (this.pydantic !== null && this.pydantic !== undefined) {
      return stringifyOutput(this.pydantic);
    }
    if (hasJsonDictContent(this.jsonDict)) {
      return pythonRepr(this.jsonDict);
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
    if (!lastTask) {
      throw new RangeError("list index out of range");
    }
    if (lastTask.outputFormat !== OutputFormat.JSON) {
      throw new Error(
        "No JSON output found in the final task. Please make sure to set the output_json property in the final task in your crew.",
      );
    }
    return jsonDumps(this.jsonDict);
  }

  toDict(): Record<string, unknown> {
    if (hasJsonDictContent(this.jsonDict)) {
      return { ...this.jsonDict };
    }
    const dumped = dumpPydanticLike(this.pydantic);
    if (dumped) {
      return dumped;
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
    if (hasJsonDictContent(this.jsonDict) && key in this.jsonDict) {
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
    if (hasJsonDictContent(this.jsonDict)) {
      return pythonRepr(this.jsonDict);
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
  return String(value);
}

function hasJsonDictContent(value: Record<string, unknown> | null): value is Record<string, unknown> {
  return value !== null && Object.keys(value).length > 0;
}

function jsonDumps(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => jsonDumps(item)).join(", ")}]`;
  }
  if (typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => `${JSON.stringify(key)}: ${jsonDumps(item)}`)
      .join(", ")}}`;
  }
  return JSON.stringify(value);
}

function pythonRepr(value: unknown): string {
  if (typeof value === "string") {
    return `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "True" : "False";
  }
  if (value === null || value === undefined) {
    return "None";
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => pythonRepr(item)).join(", ")}]`;
  }
  if (typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => `${pythonRepr(key)}: ${pythonRepr(item)}`)
      .join(", ")}}`;
  }
  if (typeof value === "bigint" || typeof value === "symbol" || typeof value === "function") {
    return value.toString();
  }
  return JSON.stringify(value);
}

function dumpPydanticLike(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const dump = record.model_dump ?? record.modelDump;
  if (typeof dump === "function") {
    const dumped = (dump as (this: unknown) => unknown).call(value);
    return dumped && typeof dumped === "object"
      ? { ...(dumped as Record<string, unknown>) }
      : {};
  }
  return { ...record };
}
