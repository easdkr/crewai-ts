export const CREWAI_TELEMETRY_BASE_URL = "https://telemetry.crewai.com:4319";
export const CREWAI_TELEMETRY_SERVICE_NAME = "crewAI-telemetry";

export type SpanLike = {
  setAttribute?: (name: string, value: unknown) => void;
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

export class Telemetry {
  static instance: Telemetry | null = null;
  ready = false;
  traceSet = false;
  trace_set = false;

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
    this.traceSet = true;
    this.trace_set = true;
  }

  set_tracer(): void {
    this.setTracer();
  }

  flush(): Promise<void> {
    return Promise.resolve();
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
    || process.env.OTEL_SDK_DISABLED === "true";
}

function defaultAddAttribute(span: SpanLike, name: string, value: unknown): void {
  span.setAttribute?.(name, value);
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
