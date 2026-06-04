import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

export type FlowDefinitionCondition = string | Record<string, unknown>;
export const FlowDefinitionCondition = Object.freeze({ kind: "FlowDefinitionCondition" });

export type FlowDefinitionDiagnosticOptions = {
  code: string;
  message: string;
  severity?: "warning" | "error";
  path?: string | null;
};

export class FlowDefinitionDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly severity: "warning" | "error";
  readonly path: string | null;

  constructor(options: FlowDefinitionDiagnosticOptions) {
    this.code = options.code;
    this.message = options.message;
    this.severity = options.severity ?? "warning";
    this.path = options.path ?? null;
  }

  toDict(excludeNone = true): Record<string, unknown> {
    return compactObject({
      code: this.code,
      message: this.message,
      severity: this.severity,
      path: this.path,
    }, excludeNone);
  }

  to_dict(options: { exclude_none?: boolean } = {}): Record<string, unknown> {
    return this.toDict(options.exclude_none ?? true);
  }
}

export type FlowStateDefinitionOptions = {
  type?: "dict" | "pydantic" | "unknown";
  ref?: string | null;
  default?: unknown;
};

export class FlowStateDefinition {
  readonly type: "dict" | "pydantic" | "unknown";
  readonly ref: string | null;
  readonly default: unknown;

  constructor(options: FlowStateDefinitionOptions = {}) {
    this.type = options.type ?? "dict";
    this.ref = options.ref ?? null;
    this.default = options.default ?? null;
  }

  toDict(excludeNone = true): Record<string, unknown> {
    return compactObject({
      type: this.type,
      ref: this.ref,
      default: this.default,
    }, excludeNone);
  }

  to_dict(options: { exclude_none?: boolean } = {}): Record<string, unknown> {
    return this.toDict(options.exclude_none ?? true);
  }
}

export type FlowConfigDefinitionOptions = {
  tracing?: boolean | null;
  stream?: boolean;
  memory?: unknown;
  inputProvider?: unknown;
  input_provider?: unknown;
  suppressFlowEvents?: boolean;
  suppress_flow_events?: boolean;
  maxMethodCalls?: number;
  max_method_calls?: number;
};

export class FlowConfigDefinition {
  readonly tracing: boolean | null;
  readonly stream: boolean;
  readonly memory: unknown;
  readonly inputProvider: unknown;
  readonly input_provider: unknown;
  readonly suppressFlowEvents: boolean;
  readonly suppress_flow_events: boolean;
  readonly maxMethodCalls: number;
  readonly max_method_calls: number;

  constructor(options: FlowConfigDefinitionOptions = {}) {
    this.tracing = options.tracing ?? null;
    this.stream = options.stream ?? false;
    this.memory = options.memory ?? null;
    this.inputProvider = options.inputProvider ?? options.input_provider ?? null;
    this.input_provider = this.inputProvider;
    this.suppressFlowEvents = options.suppressFlowEvents ?? options.suppress_flow_events ?? false;
    this.suppress_flow_events = this.suppressFlowEvents;
    this.maxMethodCalls = options.maxMethodCalls ?? options.max_method_calls ?? 100;
    this.max_method_calls = this.maxMethodCalls;
  }

  toDict(excludeNone = true): Record<string, unknown> {
    return compactObject({
      tracing: this.tracing,
      stream: this.stream,
      memory: this.memory,
      input_provider: this.inputProvider,
      suppress_flow_events: this.suppressFlowEvents,
      max_method_calls: this.maxMethodCalls,
    }, excludeNone);
  }

  to_dict(options: { exclude_none?: boolean } = {}): Record<string, unknown> {
    return this.toDict(options.exclude_none ?? true);
  }
}

export type FlowPersistenceDefinitionOptions = {
  enabled?: boolean;
  verbose?: boolean;
  persistence?: unknown;
};

export class FlowPersistenceDefinition {
  readonly enabled: boolean;
  readonly verbose: boolean;
  readonly persistence: unknown;

  constructor(options: FlowPersistenceDefinitionOptions = {}) {
    this.enabled = options.enabled ?? false;
    this.verbose = options.verbose ?? false;
    this.persistence = options.persistence ?? null;
  }

  toDict(excludeNone = true): Record<string, unknown> {
    return compactObject({
      enabled: this.enabled,
      verbose: this.verbose,
      persistence: this.persistence,
    }, excludeNone);
  }

  to_dict(options: { exclude_none?: boolean } = {}): Record<string, unknown> {
    return this.toDict(options.exclude_none ?? true);
  }
}

export type FlowHumanFeedbackDefinitionOptions = {
  message: string;
  emit?: readonly string[] | null;
  llm?: unknown;
  defaultOutcome?: string | null;
  default_outcome?: string | null;
  metadata?: Record<string, unknown> | null;
  provider?: unknown;
  learn?: boolean;
  learnSource?: string;
  learn_source?: string;
  learnStrict?: boolean;
  learn_strict?: boolean;
};

export class FlowHumanFeedbackDefinition {
  readonly message: string;
  readonly emit: readonly string[] | null;
  readonly llm: unknown;
  readonly defaultOutcome: string | null;
  readonly default_outcome: string | null;
  readonly metadata: Record<string, unknown> | null;
  readonly provider: unknown;
  readonly learn: boolean;
  readonly learnSource: string;
  readonly learn_source: string;
  readonly learnStrict: boolean;
  readonly learn_strict: boolean;

  constructor(options: FlowHumanFeedbackDefinitionOptions) {
    this.message = options.message;
    this.emit = options.emit ? [...options.emit] : null;
    this.llm = options.llm === undefined ? "gpt-4o-mini" : options.llm;
    this.defaultOutcome = options.defaultOutcome ?? options.default_outcome ?? null;
    this.default_outcome = this.defaultOutcome;
    this.metadata = options.metadata ?? null;
    this.provider = options.provider ?? null;
    this.learn = options.learn ?? false;
    this.learnSource = options.learnSource ?? options.learn_source ?? "hitl";
    this.learn_source = this.learnSource;
    this.learnStrict = options.learnStrict ?? options.learn_strict ?? false;
    this.learn_strict = this.learnStrict;
  }

  toDict(excludeNone = true): Record<string, unknown> {
    return compactObject({
      message: this.message,
      emit: this.emit,
      llm: this.llm,
      default_outcome: this.defaultOutcome,
      metadata: this.metadata,
      provider: this.provider,
      learn: this.learn,
      learn_source: this.learnSource,
      learn_strict: this.learnStrict,
    }, excludeNone);
  }

  to_dict(options: { exclude_none?: boolean } = {}): Record<string, unknown> {
    return this.toDict(options.exclude_none ?? true);
  }
}

export type FlowMethodDefinitionOptions = {
  start?: boolean | FlowDefinitionCondition | null;
  listen?: FlowDefinitionCondition | null;
  router?: boolean;
  emit?: readonly string[] | null;
  humanFeedback?: FlowHumanFeedbackDefinition | FlowHumanFeedbackDefinitionOptions | null;
  human_feedback?: FlowHumanFeedbackDefinition | FlowHumanFeedbackDefinitionOptions | null;
  persist?: FlowPersistenceDefinition | FlowPersistenceDefinitionOptions | null;
};

export class FlowMethodDefinition {
  readonly start: boolean | FlowDefinitionCondition | null;
  readonly listen: FlowDefinitionCondition | null;
  readonly router: boolean;
  readonly emit: readonly string[] | null;
  readonly humanFeedback: FlowHumanFeedbackDefinition | null;
  readonly human_feedback: FlowHumanFeedbackDefinition | null;
  readonly persist: FlowPersistenceDefinition | null;

  constructor(options: FlowMethodDefinitionOptions = {}) {
    this.start = options.start ?? null;
    this.listen = options.listen ?? null;
    this.router = options.router ?? false;
    this.emit = options.emit ? [...options.emit] : null;
    const humanFeedback = options.humanFeedback ?? options.human_feedback ?? null;
    this.humanFeedback = humanFeedback instanceof FlowHumanFeedbackDefinition
      ? humanFeedback
      : humanFeedback ? new FlowHumanFeedbackDefinition(humanFeedback) : null;
    this.human_feedback = this.humanFeedback;
    const persist = options.persist ?? null;
    this.persist = persist instanceof FlowPersistenceDefinition
      ? persist
      : persist ? new FlowPersistenceDefinition(persist) : null;
  }

  get isStart(): boolean {
    return Boolean(this.start);
  }

  get is_start(): boolean {
    return this.isStart;
  }

  toDict(excludeNone = true): Record<string, unknown> {
    return compactObject({
      start: this.start,
      listen: this.listen,
      router: this.router,
      emit: this.emit,
      human_feedback: this.humanFeedback?.toDict(excludeNone) ?? null,
      persist: this.persist?.toDict(excludeNone) ?? null,
    }, excludeNone);
  }

  to_dict(options: { exclude_none?: boolean } = {}): Record<string, unknown> {
    return this.toDict(options.exclude_none ?? true);
  }
}

export type FlowDefinitionOptions = {
  schema?: string;
  schema_?: string;
  name: string;
  description?: string | null;
  state?: FlowStateDefinition | FlowStateDefinitionOptions | null;
  config?: FlowConfigDefinition | FlowConfigDefinitionOptions;
  persist?: FlowPersistenceDefinition | FlowPersistenceDefinitionOptions | null;
  methods?: Record<string, FlowMethodDefinition | FlowMethodDefinitionOptions>;
  diagnostics?: readonly (FlowDefinitionDiagnostic | FlowDefinitionDiagnosticOptions)[];
};

export class FlowDefinition {
  readonly schema_: string;
  readonly name: string;
  readonly description: string | null;
  readonly state: FlowStateDefinition | null;
  readonly config: FlowConfigDefinition;
  readonly persist: FlowPersistenceDefinition | null;
  readonly methods: Record<string, FlowMethodDefinition>;
  diagnostics: FlowDefinitionDiagnostic[];

  constructor(options: FlowDefinitionOptions) {
    this.schema_ = options.schema_ ?? options.schema ?? "crewai.flow/v1";
    this.name = options.name;
    this.description = options.description ?? null;
    this.state = options.state instanceof FlowStateDefinition
      ? options.state
      : options.state ? new FlowStateDefinition(options.state) : null;
    this.config = options.config instanceof FlowConfigDefinition
      ? options.config
      : new FlowConfigDefinition(options.config ?? {});
    this.persist = options.persist instanceof FlowPersistenceDefinition
      ? options.persist
      : options.persist ? new FlowPersistenceDefinition(options.persist) : null;
    this.methods = Object.fromEntries(
      Object.entries(options.methods ?? {}).map(([name, method]) => [
        name,
        method instanceof FlowMethodDefinition ? method : new FlowMethodDefinition(method),
      ]),
    );
    this.diagnostics = (options.diagnostics ?? []).map((diagnostic) => diagnostic instanceof FlowDefinitionDiagnostic
      ? diagnostic
      : new FlowDefinitionDiagnostic(diagnostic));
  }

  toDict(options: { excludeNone?: boolean; exclude_none?: boolean } = {}): Record<string, unknown> {
    const excludeNone = options.excludeNone ?? options.exclude_none ?? true;
    const methods = Object.fromEntries(
      Object.entries(this.methods).map(([name, method]) => [name, method.toDict(excludeNone)]),
    );
    return compactObject({
      schema: this.schema_,
      name: this.name,
      description: this.description,
      state: this.state?.toDict(excludeNone) ?? null,
      config: this.config.toDict(excludeNone),
      persist: this.persist?.toDict(excludeNone) ?? null,
      methods,
      diagnostics: this.diagnostics.map((diagnostic) => diagnostic.toDict(excludeNone)),
    }, excludeNone);
  }

  to_dict(options: { exclude_none?: boolean } = {}): Record<string, unknown> {
    return this.toDict({ excludeNone: options.exclude_none ?? true });
  }

  toJson(options: { indent?: number | null; excludeNone?: boolean; exclude_none?: boolean } = {}): string {
    const indent = options.indent === undefined ? 2 : options.indent;
    return JSON.stringify(this.toDict(options), null, indent ?? undefined);
  }

  to_json(options: { indent?: number | null; exclude_none?: boolean } = {}): string {
    const nextOptions: { indent?: number | null; excludeNone?: boolean } = {
      excludeNone: options.exclude_none ?? true,
    };
    if ("indent" in options) {
      nextOptions.indent = options.indent;
    }
    return this.toJson(nextOptions);
  }

  toYaml(options: { excludeNone?: boolean; exclude_none?: boolean } = {}): string {
    return stringifyYaml(this.toDict({
      excludeNone: options.excludeNone ?? options.exclude_none ?? false,
    }));
  }

  to_yaml(options: { exclude_none?: boolean } = {}): string {
    return this.toYaml({ excludeNone: options.exclude_none ?? false });
  }

  static fromDict(data: Record<string, unknown>): FlowDefinition {
    const serializedDiagnostics = deserializeDiagnostics(data.diagnostics);
    const options: FlowDefinitionOptions = {
      name: typeof data.name === "string" ? data.name : "",
      description: typeof data.description === "string" ? data.description : null,
      state: isRecord(data.state) ? data.state : null,
      config: isRecord(data.config) ? data.config : {},
      persist: isRecord(data.persist) ? data.persist : null,
      methods: deserializeMethods(data.methods),
      diagnostics: serializedDiagnostics,
    };
    if (typeof data.schema === "string") {
      options.schema = data.schema;
    }
    const definition = new FlowDefinition(options);
    definition.diagnostics = mergeDiagnostics(serializedDiagnostics, definition.validateContract());
    definition.logDiagnostics();
    return definition;
  }

  static from_dict(data: Record<string, unknown>): FlowDefinition {
    return FlowDefinition.fromDict(data);
  }

  static fromJson(data: string): FlowDefinition {
    return FlowDefinition.fromDict(JSON.parse(data) as Record<string, unknown>);
  }

  static from_json(data: string): FlowDefinition {
    return FlowDefinition.fromJson(data);
  }

  static fromYaml(data: string): FlowDefinition {
    const parsed = parseYaml(data) as unknown;
    if (!isRecord(parsed)) {
      throw new Error("FlowDefinition YAML must deserialize to an object.");
    }
    return FlowDefinition.fromDict(parsed);
  }

  static from_yaml(data: string): FlowDefinition {
    return FlowDefinition.fromYaml(data);
  }

  static jsonSchema(): Record<string, unknown> {
    return {
      title: "FlowDefinition",
      type: "object",
      properties: {
        schema: { type: "string", default: "crewai.flow/v1" },
        name: { type: "string" },
        description: { type: ["string", "null"] },
        state: { type: ["object", "null"] },
        config: { type: "object" },
        persist: { type: ["object", "null"] },
        methods: { type: "object" },
        diagnostics: { type: "array" },
      },
      required: ["name"],
    };
  }

  static json_schema(): Record<string, unknown> {
    return FlowDefinition.jsonSchema();
  }

  validateContract(): FlowDefinitionDiagnostic[] {
    const diagnostics: FlowDefinitionDiagnostic[] = [];
    for (const [methodName, method] of Object.entries(this.methods)) {
      const path = `methods.${methodName}`;
      if (method.router && !method.isStart && method.listen === null) {
        diagnostics.push(new FlowDefinitionDiagnostic({
          code: "router_without_trigger",
          severity: "error",
          path,
          message: "router: true requires either start or listen",
        }));
      }
      if (method.emit && !method.router) {
        diagnostics.push(new FlowDefinitionDiagnostic({
          code: "emit_without_router",
          path: `${path}.emit`,
          message: "emit is only used by routers to declare downstream events",
        }));
      }
      const humanFeedback = method.humanFeedback;
      if (!humanFeedback) {
        continue;
      }
      if (humanFeedback.emit && !humanFeedback.llm) {
        diagnostics.push(new FlowDefinitionDiagnostic({
          code: "human_feedback_llm_required",
          severity: "error",
          path: `${path}.human_feedback.llm`,
          message: "llm is required when human_feedback.emit is set",
        }));
      }
      if (humanFeedback.defaultOutcome !== null && !humanFeedback.emit) {
        diagnostics.push(new FlowDefinitionDiagnostic({
          code: "human_feedback_default_requires_emit",
          severity: "error",
          path: `${path}.human_feedback.default_outcome`,
          message: "default_outcome requires human_feedback.emit",
        }));
      } else if (
        humanFeedback.defaultOutcome !== null
        && humanFeedback.emit
        && !humanFeedback.emit.includes(humanFeedback.defaultOutcome)
      ) {
        diagnostics.push(new FlowDefinitionDiagnostic({
          code: "human_feedback_default_not_in_emit",
          severity: "error",
          path: `${path}.human_feedback.default_outcome`,
          message: "default_outcome must be one of human_feedback.emit",
        }));
      }
    }
    return diagnostics;
  }

  validate_contract(): FlowDefinitionDiagnostic[] {
    return this.validateContract();
  }

  withDiagnostics(): this {
    this.diagnostics = this.validateContract();
    this.logDiagnostics();
    return this;
  }

  with_diagnostics(): this {
    return this.withDiagnostics();
  }

  logDiagnostics(): void {
    for (const diagnostic of this.diagnostics) {
      if (diagnostic.severity === "error") {
        console.error(`Flow definition diagnostic for ${this.name}${diagnostic.path ? ` at ${diagnostic.path}` : ""} [${diagnostic.code}]: ${diagnostic.message}`);
      } else {
        console.warn(`Flow definition diagnostic for ${this.name}${diagnostic.path ? ` at ${diagnostic.path}` : ""} [${diagnostic.code}]: ${diagnostic.message}`);
      }
    }
  }

  log_diagnostics(): void {
    this.logDiagnostics();
  }
}

function deserializeMethods(value: unknown): Record<string, FlowMethodDefinitionOptions> {
  if (!isRecord(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).filter(([, method]) => isRecord(method)),
  ) as Record<string, FlowMethodDefinitionOptions>;
}

function deserializeDiagnostics(value: unknown): FlowDefinitionDiagnostic[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isRecord).map((item) => new FlowDefinitionDiagnostic({
    code: typeof item.code === "string" ? item.code : "",
    message: typeof item.message === "string" ? item.message : "",
    severity: item.severity === "error" ? "error" : "warning",
    path: typeof item.path === "string" ? item.path : null,
  }));
}

function mergeDiagnostics(...groups: readonly FlowDefinitionDiagnostic[][]): FlowDefinitionDiagnostic[] {
  const diagnostics: FlowDefinitionDiagnostic[] = [];
  const seen = new Set<string>();
  for (const group of groups) {
    for (const diagnostic of group) {
      const key = JSON.stringify([diagnostic.code, diagnostic.severity, diagnostic.path, diagnostic.message]);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      diagnostics.push(diagnostic);
    }
  }
  return diagnostics;
}

function compactObject(record: Record<string, unknown>, excludeNone: boolean): Record<string, unknown> {
  if (!excludeNone) {
    return record;
  }
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== null && value !== undefined),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
