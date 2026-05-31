export const CREWAI_TELEMETRY_BASE_URL = "https://telemetry.crewai.com:4319";
export const CREWAI_TELEMETRY_SERVICE_NAME = "crewAI-telemetry";

export type SpanLike = {
  setAttribute?: (name: string, value: unknown) => void;
  set_attribute?: (name: string, value: unknown) => void;
  setStatus?: (status: unknown) => void;
  end?: () => void;
};

export type AddAttributeFn = (span: SpanLike, name: string, value: unknown) => void;

export class SafeOTLPSpanExporter {
  readonly options: Record<string, unknown>;

  constructor(options: Record<string, unknown> = {}) {
    this.options = { ...options };
  }

  export(spans: unknown): string {
    void spans;
    return "success";
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

export class RecordedSpan implements SpanLike {
  readonly name: string;
  readonly attributes: Record<string, unknown> = {};
  status: unknown = null;
  ended = false;

  constructor(name: string) {
    this.name = name;
  }

  setAttribute(name: string, value: unknown): void {
    this.attributes[name] = value;
  }

  set_attribute(name: string, value: unknown): void {
    this.setAttribute(name, value);
  }

  setStatus(status: unknown): void {
    this.status = status;
  }

  end(): void {
    this.ended = true;
  }
}

export class Telemetry {
  static instance: Telemetry | null = null;
  ready = false;
  traceSet = false;
  trace_set = false;
  readonly spans: RecordedSpan[] = [];

  constructor() {
    Telemetry.instance ??= this;
    if (!isTelemetryDisabled()) {
      this.ready = true;
    }
  }

  static getInstance(): Telemetry {
    Telemetry.instance ??= new Telemetry();
    return Telemetry.instance;
  }

  static get_instance(): Telemetry {
    return Telemetry.getInstance();
  }

  setTracer(): void {
    if (this.ready && !this.traceSet) {
      this.traceSet = true;
      this.trace_set = true;
    }
  }

  set_tracer(): void {
    this.setTracer();
  }

  flush(): Promise<void> {
    return Promise.resolve();
  }

  _is_telemetry_disabled(): boolean {
    return isTelemetryDisabled();
  }

  _should_execute_telemetry(): boolean {
    return this.ready && !this._is_telemetry_disabled();
  }

  _safe_telemetry_operation<T>(operation: () => T): T | null {
    if (!this._should_execute_telemetry()) {
      return null;
    }
    try {
      return operation();
    } catch {
      return null;
    }
  }

  _register_shutdown_handlers(): void {
    // Node consumers own process signal handling; keep this as a compatibility no-op.
  }

  _register_signal_handler(_signalName: unknown, _eventClass: unknown, _shutdown = false): void {
    void _shutdown;
    // Compatibility no-op for Python's process signal hook.
  }

  _shutdown(): void {
    this.ready = false;
  }

  _add_attribute(span: SpanLike | null | undefined, key: string, value: unknown): void {
    if (!span) {
      return;
    }
    this._safe_telemetry_operation(() => {
      defaultAddAttribute(span, key, value);
    });
  }

  getSpans(): RecordedSpan[] {
    return [...this.spans];
  }

  get_spans(): RecordedSpan[] {
    return this.getSpans();
  }

  clearSpans(): void {
    this.spans.length = 0;
  }

  clear_spans(): void {
    this.clearSpans();
  }

  crew_creation(crew: unknown, inputs: Record<string, unknown> | null = null): void {
    this._safe_telemetry_operation(() => {
      const span = this.startSpan("Crew Created");
      this._add_attribute(span, "crewai_version", "crewai-ts");
      addCrewAttributes(span, crew, this._add_attribute.bind(this));
      this._add_attribute(span, "crew_process", readProperty(crew, "process"));
      this._add_attribute(span, "crew_memory", readProperty(crew, "memory"));
      this._add_attribute(span, "crew_number_of_tasks", asArray(readProperty(crew, "tasks")).length);
      this._add_attribute(span, "crew_number_of_agents", asArray(readProperty(crew, "agents")).length);
      this._add_attribute(span, "crew_agents", JSON.stringify(asArray(readProperty(crew, "agents")).map((agent) => publicAgentTelemetry(agent, isShareCrew(crew)))));
      this._add_attribute(span, "crew_tasks", JSON.stringify(asArray(readProperty(crew, "tasks")).map((task) => publicTaskTelemetry(task, isShareCrew(crew)))));
      if (isShareCrew(crew)) {
        this._add_attribute(span, "crew_inputs", JSON.stringify(inputs ?? {}));
      }
      closeSpan(span);
    });
  }

  task_started(crew: unknown, task: unknown): RecordedSpan | null {
    return this._safe_telemetry_operation(() => {
      const createdSpan = this.startSpan("Task Created");
      addCrewAndTaskAttributes(createdSpan, crew, task, this._add_attribute.bind(this));
      this.addTaskFingerprintDetails(createdSpan, task);
      addAgentFingerprintToSpan(createdSpan, readProperty(task, "agent"), this._add_attribute.bind(this));
      if (isShareCrew(crew)) {
        this._add_attribute(createdSpan, "formatted_description", readProperty(task, "description") ?? "");
        this._add_attribute(createdSpan, "formatted_expected_output", readProperty(task, "expected_output") ?? readProperty(task, "expectedOutput") ?? "");
      }
      closeSpan(createdSpan);

      const span = this.startSpan("Task Execution");
      addCrewAndTaskAttributes(span, crew, task, this._add_attribute.bind(this));
      this.addTaskFingerprintDetails(span, task, false);
      addAgentFingerprintToSpan(span, readProperty(task, "agent"), this._add_attribute.bind(this));
      if (isShareCrew(crew)) {
        this._add_attribute(span, "formatted_description", readProperty(task, "description") ?? "");
        this._add_attribute(span, "formatted_expected_output", readProperty(task, "expected_output") ?? readProperty(task, "expectedOutput") ?? "");
      }
      return span;
    });
  }

  taskStarted(crew: unknown, task: unknown): RecordedSpan | null {
    return this.task_started(crew, task);
  }

  task_ended(span: SpanLike | null, task: unknown, crew: unknown): void {
    this._safe_telemetry_operation(() => {
      this.addTaskFingerprintDetails(span, task, false);
      if (isShareCrew(crew)) {
        this._add_attribute(span, "task_output", readProperty(readProperty(task, "output"), "raw") ?? "");
      }
      if (span) {
        closeSpan(span);
      }
    });
  }

  taskEnded(span: SpanLike | null, task: unknown, crew: unknown): void {
    this.task_ended(span, task, crew);
  }

  tool_repeated_usage(llm: unknown, tool_name: string, attempts: number): void {
    this.closedSpan("Tool Repeated Usage", {
      crewai_version: "crewai-ts",
      tool_name,
      attempts,
      ...(llmModel(llm) ? { llm: llmModel(llm) } : {}),
    });
  }

  toolRepeatedUsage(llm: unknown, toolName: string, attempts: number): void {
    this.tool_repeated_usage(llm, toolName, attempts);
  }

  tool_usage(llm: unknown, tool_name: string, attempts: number, agent: unknown = null): void {
    this._safe_telemetry_operation(() => {
      const span = this.startSpan("Tool Usage");
      this._add_attribute(span, "crewai_version", "crewai-ts");
      this._add_attribute(span, "tool_name", tool_name);
      this._add_attribute(span, "attempts", attempts);
      if (llmModel(llm)) {
        this._add_attribute(span, "llm", llmModel(llm));
      }
      addAgentFingerprintToSpan(span, agent, this._add_attribute.bind(this));
      closeSpan(span);
    });
  }

  toolUsage(llm: unknown, toolName: string, attempts: number, agent: unknown = null): void {
    this.tool_usage(llm, toolName, attempts, agent);
  }

  tool_usage_error(llm: unknown, agent: unknown = null, tool_name: string | null = null): void {
    this._safe_telemetry_operation(() => {
      const span = this.startSpan("Tool Usage Error");
      this._add_attribute(span, "crewai_version", "crewai-ts");
      if (llmModel(llm)) {
        this._add_attribute(span, "llm", llmModel(llm));
      }
      if (tool_name) {
        this._add_attribute(span, "tool_name", tool_name);
      }
      addAgentFingerprintToSpan(span, agent, this._add_attribute.bind(this));
      closeSpan(span);
    });
  }

  toolUsageError(llm: unknown, agent: unknown = null, toolName: string | null = null): void {
    this.tool_usage_error(llm, agent, toolName);
  }

  individual_test_result_span(crew: unknown, quality: number, exec_time: number, model_name: string): void {
    this.closedSpan("Crew Individual Test Result", {
      crewai_version: "crewai-ts",
      crew_key: readProperty(crew, "key") ?? "",
      crew_id: telemetryString(readProperty(crew, "id")),
      quality: String(quality),
      exec_time: String(exec_time),
      model_name,
    });
  }

  test_execution_span(crew: unknown, iterations: number, inputs: Record<string, unknown> | null, model_name: string): void {
    this.closedSpan("Crew Test Execution", {
      crewai_version: "crewai-ts",
      crew_key: readProperty(crew, "key") ?? "",
      crew_id: telemetryString(readProperty(crew, "id")),
      iterations: String(iterations),
      model_name,
      ...(isShareCrew(crew) ? { inputs: JSON.stringify(inputs ?? {}) } : {}),
    });
  }

  deploy_signup_error_span(): void {
    this.closedSpan("Deploy Signup Error");
  }

  start_deployment_span(uuid: string | null = null): void {
    this.closedSpan("Start Deployment", uuid ? { uuid } : {});
  }

  create_crew_deployment_span(): void {
    this.closedSpan("Create Crew Deployment");
  }

  get_crew_logs_span(uuid: string | null, log_type = "deployment"): void {
    this.closedSpan("Get Crew Logs", {
      log_type,
      ...(uuid ? { uuid } : {}),
    });
  }

  remove_crew_span(uuid: string | null = null): void {
    this.closedSpan("Remove Crew", uuid ? { uuid } : {});
  }

  crew_execution_span(crew: unknown, inputs: Record<string, unknown> | null = null): RecordedSpan | null {
    this.crew_creation(crew, inputs);
    if (!isShareCrew(crew)) {
      return null;
    }
    return this._safe_telemetry_operation(() => {
      const span = this.startSpan("Crew Execution");
      this._add_attribute(span, "crewai_version", "crewai-ts");
      addCrewAttributes(span, crew, this._add_attribute.bind(this), false);
      this._add_attribute(span, "crew_inputs", JSON.stringify(inputs ?? {}));
      this._add_attribute(span, "crew_agents", JSON.stringify(asArray(readProperty(crew, "agents")).map((agent) => publicAgentTelemetry(agent, true))));
      this._add_attribute(span, "crew_tasks", JSON.stringify(asArray(readProperty(crew, "tasks")).map((task) => publicTaskTelemetry(task, true))));
      return span;
    });
  }

  end_crew(crew: unknown, final_string_output: string): void {
    if (!isShareCrew(crew)) {
      return;
    }
    this._safe_telemetry_operation(() => {
      const span = readProperty(crew, "_execution_span") as SpanLike | null;
      this._add_attribute(span, "crewai_version", "crewai-ts");
      this._add_attribute(span, "crew_output", final_string_output);
      this._add_attribute(span, "crew_tasks_output", JSON.stringify(asArray(readProperty(crew, "tasks")).map((task) => ({
        id: telemetryString(readProperty(task, "id")),
        description: readProperty(task, "description") ?? "",
        output: readProperty(readProperty(task, "output"), "raw") ?? "",
      }))));
      if (span) {
        closeSpan(span);
      }
    });
  }

  flow_creation_span(flow_name: string): void {
    this.closedSpan("Flow Creation", { flow_name });
  }

  flow_plotting_span(flow_name: string, node_names: readonly string[]): void {
    this.closedSpan("Flow Plotting", { flow_name, node_names: JSON.stringify(node_names) });
  }

  flow_execution_span(flow_name: string, node_names: readonly string[]): void {
    this.closedSpan("Flow Execution", { flow_name, node_names: JSON.stringify(node_names) });
  }

  env_context_span(tool: string): void {
    this.closedSpan("Environment Context", { crewai_version: "crewai-ts", tool });
  }

  human_feedback_span(
    event_type: string,
    has_routing: boolean,
    num_outcomes = 0,
    feedback_provided: boolean | null = null,
    outcome: string | null = null,
  ): void {
    this.closedSpan("Human Feedback", {
      event_type,
      has_routing,
      num_outcomes,
      ...(feedback_provided === null ? {} : { feedback_provided }),
      ...(outcome === null ? {} : { outcome }),
    });
  }

  feature_usage_span(feature: string): void {
    this.closedSpan("Feature Usage", { crewai_version: "crewai-ts", feature });
  }

  template_installed_span(template_name: string): void {
    this.closedSpan("Template Installed", { crewai_version: "crewai-ts", template_name });
  }

  private startSpan(name: string): RecordedSpan {
    const span = new RecordedSpan(name);
    this.spans.push(span);
    return span;
  }

  private closedSpan(name: string, attributes: Record<string, unknown> = {}): void {
    this._safe_telemetry_operation(() => {
      const span = this.startSpan(name);
      for (const [key, value] of Object.entries(attributes)) {
        this._add_attribute(span, key, value);
      }
      closeSpan(span);
    });
  }

  private addTaskFingerprintDetails(span: SpanLike | null | undefined, task: unknown, includeDetails = true): void {
    const fingerprint = asRecord(readProperty(task, "fingerprint"));
    const uuid = fingerprint?.uuid_str ?? fingerprint?.uuidStr;
    if (uuid) {
      this._add_attribute(span, "task_fingerprint", uuid);
    }
    if (includeDetails && fingerprint) {
      const createdAt = fingerprint.created_at ?? fingerprint.createdAt;
      if (createdAt instanceof Date) {
        this._add_attribute(span, "task_fingerprint_created_at", createdAt.toISOString());
      } else if (typeof createdAt === "string" || typeof createdAt === "number" || typeof createdAt === "boolean") {
        this._add_attribute(span, "task_fingerprint_created_at", String(createdAt));
      }
      if (fingerprint.metadata) {
        this._add_attribute(span, "task_fingerprint_metadata", JSON.stringify(fingerprint.metadata));
      }
    }
  }
}

export function addAgentFingerprintToSpan(span: SpanLike, agent: unknown, addAttributeFn: AddAttributeFn = defaultAddAttribute): void {
  const record = asRecord(agent);
  const fingerprint = asRecord(record?.fingerprint);
  const uuid = fingerprint?.uuid_str ?? fingerprint?.uuidStr;
  if (uuid) {
    addAttributeFn(span, "agent_fingerprint", uuid);
  }
  if (typeof record?.role === "string") {
    addAttributeFn(span, "agent_role", record.role);
  }
}

export const add_agent_fingerprint_to_span = addAgentFingerprintToSpan;

export function addCrewAttributes(span: SpanLike, crew: unknown, addAttributeFn: AddAttributeFn = defaultAddAttribute, includeFingerprint = true): void {
  const record = asRecord(crew);
  addAttributeFn(span, "crew_key", record?.key ?? "");
  addAttributeFn(span, "crew_id", telemetryString(record?.id));
  if (includeFingerprint) {
    const fingerprint = asRecord(record?.fingerprint);
    const uuid = fingerprint?.uuid_str ?? fingerprint?.uuidStr;
    if (uuid) {
      addAttributeFn(span, "crew_fingerprint", uuid);
    }
  }
}

export const add_crew_attributes = addCrewAttributes;

export function addTaskAttributes(span: SpanLike, task: unknown, addAttributeFn: AddAttributeFn = defaultAddAttribute, includeFingerprint = true): void {
  const record = asRecord(task);
  addAttributeFn(span, "task_key", record?.key ?? "");
  addAttributeFn(span, "task_id", telemetryString(record?.id));
  if (includeFingerprint) {
    const fingerprint = asRecord(record?.fingerprint);
    const uuid = fingerprint?.uuid_str ?? fingerprint?.uuidStr;
    if (uuid) {
      addAttributeFn(span, "task_fingerprint", uuid);
    }
  }
}

export const add_task_attributes = addTaskAttributes;

export function addCrewAndTaskAttributes(
  span: SpanLike,
  crew: unknown,
  task: unknown,
  addAttributeFn: AddAttributeFn = defaultAddAttribute,
  includeFingerprints = true,
): void {
  addCrewAttributes(span, crew, addAttributeFn, includeFingerprints);
  addTaskAttributes(span, task, addAttributeFn, includeFingerprints);
}

export const add_crew_and_task_attributes = addCrewAndTaskAttributes;

export function closeSpan(span: SpanLike): void {
  span.setStatus?.({ code: "OK" });
  span.end?.();
}

export const close_span = closeSpan;

function isTelemetryDisabled(): boolean {
  return process.env.CREWAI_DISABLE_TELEMETRY === "true"
    || process.env.CREWAI_DISABLE_TELEMETRY === "1"
    || process.env.CREWAI_DISABLE_TRACKING === "true"
    || process.env.CREWAI_DISABLE_TRACKING === "1"
    || process.env.OTEL_SDK_DISABLED === "true";
}

function defaultAddAttribute(span: SpanLike, name: string, value: unknown): void {
  if (span.setAttribute) {
    span.setAttribute(name, value);
    return;
  }
  span.set_attribute?.(name, value);
}

function telemetryString(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return value.toString();
  }
  return JSON.stringify(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function readProperty(value: unknown, key: string): unknown {
  const record = asRecord(value);
  return record?.[key];
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isShareCrew(crew: unknown): boolean {
  return readProperty(crew, "share_crew") === true || readProperty(crew, "shareCrew") === true;
}

function llmModel(llm: unknown): string | null {
  const model = readProperty(llm, "model");
  return typeof model === "string" ? model : null;
}

function publicAgentTelemetry(agent: unknown, includePrivateFields: boolean): Record<string, unknown> {
  const output: Record<string, unknown> = {
    key: readProperty(agent, "key") ?? "",
    id: telemetryString(readProperty(agent, "id")),
    role: readProperty(agent, "role") ?? "",
    "verbose?": readProperty(agent, "verbose") ?? false,
    max_iter: readProperty(agent, "max_iter") ?? readProperty(agent, "maxIter") ?? null,
    max_rpm: readProperty(agent, "max_rpm") ?? readProperty(agent, "maxRpm") ?? null,
    function_calling_llm: llmModel(readProperty(agent, "function_calling_llm") ?? readProperty(agent, "functionCallingLlm")) ?? "",
    llm: llmModel(readProperty(agent, "llm")) ?? telemetryString(readProperty(agent, "llm")),
    "delegation_enabled?": readProperty(agent, "allow_delegation") ?? readProperty(agent, "allowDelegation") ?? false,
    "allow_code_execution?": readProperty(agent, "allow_code_execution") ?? readProperty(agent, "allowCodeExecution") ?? false,
    max_retry_limit: readProperty(agent, "max_retry_limit") ?? readProperty(agent, "maxRetryLimit") ?? 3,
    tools_names: asArray(readProperty(agent, "tools")).map((tool) => readProperty(tool, "name") ?? ""),
  };
  if (includePrivateFields) {
    output.goal = readProperty(agent, "goal") ?? "";
    output.backstory = readProperty(agent, "backstory") ?? "";
  }
  return output;
}

function publicTaskTelemetry(task: unknown, includePrivateFields: boolean): Record<string, unknown> {
  const output: Record<string, unknown> = {
    key: readProperty(task, "key") ?? "",
    id: telemetryString(readProperty(task, "id")),
    "async_execution?": readProperty(task, "async_execution") ?? readProperty(task, "asyncExecution") ?? false,
    "human_input?": readProperty(task, "human_input") ?? readProperty(task, "humanInput") ?? false,
    agent_role: readProperty(readProperty(task, "agent"), "role") ?? "None",
    agent_key: readProperty(readProperty(task, "agent"), "key") ?? null,
    tools_names: asArray(readProperty(task, "tools")).map((tool) => readProperty(tool, "name") ?? ""),
  };
  if (includePrivateFields) {
    output.description = readProperty(task, "description") ?? "";
    output.expected_output = readProperty(task, "expected_output") ?? readProperty(task, "expectedOutput") ?? "";
    output.context = Array.isArray(readProperty(task, "context"))
      ? asArray(readProperty(task, "context")).map((entry) => readProperty(entry, "description") ?? "")
      : null;
  }
  return output;
}
