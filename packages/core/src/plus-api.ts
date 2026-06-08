import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { getAuthToken } from "./auth.js";
import { DEFAULT_CREWAI_ENTERPRISE_URL, Settings } from "./settings.js";

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export type AvailableExport = {
  name: string;
};

export type EnvVarEntry = {
  name: string;
  description: string;
  required: boolean;
  default: string | null;
};

export type ToolMetadata = {
  name: string;
  module: string;
  humanized_name: string;
  description: string;
  run_params_schema: Record<string, unknown>;
  init_params_schema: Record<string, unknown>;
  env_vars: readonly EnvVarEntry[];
};

export type ToolsMetadataPayload = {
  package: string;
  tools: readonly ToolMetadata[] | null;
};

export type PublishToolPayload = {
  handle: string;
  public: boolean;
  version: string;
  file: string;
  description: string | null;
  available_exports: readonly AvailableExport[] | null;
  tools_metadata: ToolsMetadataPayload | null;
};

export type CrewDeploymentSpec = {
  name: string;
  repo_clone_url: string;
  env: Record<string, string>;
};

export type CreateCrewPayload = {
  deploy: CrewDeploymentSpec;
};

export type TraceExecutionContext = {
  crew_fingerprint: string | null;
  crew_name: string | null;
  flow_name: string | null;
  crewai_version: string;
  privacy_level: string;
};

export type TraceExecutionMetadata = {
  expected_duration_estimate: number;
  agent_count: number;
  task_count: number;
  flow_method_count: number;
  execution_started_at: string;
};

export type TraceBatchInitPayload = {
  user_identifier?: string;
  trace_id: string;
  execution_type: string;
  execution_context: TraceExecutionContext;
  execution_metadata: TraceExecutionMetadata;
  ephemeral_trace_id?: string;
};

export type TraceBatchMetadata = {
  events_count: number;
  batch_sequence: number;
  is_final_batch: boolean;
};

export type TraceEventsPayload = {
  events: readonly Record<string, unknown>[];
  batch_metadata: TraceBatchMetadata;
};

export type TraceFinalizePayload = {
  status: "completed";
  duration_ms: number | null;
  final_event_count: number;
};

export type TraceFailedPayload = {
  status: "failed";
  failure_reason: string;
};

export type PlusApiResponse<T = unknown> = {
  status: number;
  ok: boolean;
  headers: Headers;
  json(): Promise<T>;
  text(): Promise<string>;
};

export type PlusAPIOptions = {
  apiKey?: string | null;
  api_key?: string | null;
  baseUrl?: string | null;
  base_url?: string | null;
  settings?: Settings;
  fetch?: typeof fetch;
  version?: string;
};

type MakeRequestOptions = {
  json?: unknown;
  params?: Record<string, string> | null;
  timeout?: number | null;
  verify?: boolean;
};

export class PlusAPI {
  static readonly TOOLS_RESOURCE = "/crewai_plus/api/v1/tools";
  static readonly SKILLS_RESOURCE = "/crewai_plus/api/v1/skills";
  static readonly ORGANIZATIONS_RESOURCE = "/crewai_plus/api/v1/me/organizations";
  static readonly CREWS_RESOURCE = "/crewai_plus/api/v1/crews";
  static readonly AGENTS_RESOURCE = "/crewai_plus/api/v1/agents";
  static readonly TRACING_RESOURCE = "/crewai_plus/api/v1/tracing";
  static readonly EPHEMERAL_TRACING_RESOURCE = "/crewai_plus/api/v1/tracing/ephemeral";
  static readonly INTEGRATIONS_RESOURCE = "/crewai_plus/api/v1/integrations";

  readonly apiKey: string | null;
  readonly api_key: string | null;
  readonly headers: Record<string, string>;
  readonly baseUrl: string;
  readonly base_url: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: PlusAPIOptions | string | null = {}) {
    const normalized = typeof options === "string" || options === null ? { apiKey: options } : options;
    const settings = normalized.settings ?? new Settings();
    const version = normalized.version ?? "0.0.0";
    this.apiKey = normalized.apiKey ?? normalized.api_key ?? null;
    this.api_key = this.apiKey;
    this.headers = {
      "Content-Type": "application/json",
      "User-Agent": `CrewAI-CLI/${version}`,
      "X-Crewai-Version": version,
    };
    if (this.apiKey) {
      this.headers.Authorization = `Bearer ${this.apiKey}`;
    }
    if (settings.org_uuid) {
      this.headers["X-Crewai-Organization-Id"] = settings.org_uuid;
    }
    this.baseUrl = normalized.baseUrl ?? normalized.base_url ?? process.env.CREWAI_PLUS_URL ?? settings.enterprise_base_url ?? DEFAULT_CREWAI_ENTERPRISE_URL;
    this.base_url = this.baseUrl;
    this.fetchImpl = normalized.fetch ?? fetch;
  }

  async makeRequest<T = unknown>(
    method: HttpMethod,
    endpoint: string,
    options: MakeRequestOptions = {},
  ): Promise<PlusApiResponse<T>> {
    const url = new URL(endpoint, this.baseUrl);
    if (options.params) {
      for (const [key, value] of Object.entries(options.params)) {
        url.searchParams.set(key, value);
      }
    }
    const response = await this.fetchImpl(url, {
      method,
      headers: this.headers,
      ...(options.json === undefined ? {} : { body: JSON.stringify(options.json) }),
      ...(options.timeout ? { signal: AbortSignal.timeout(options.timeout * 1000) } : {}),
    });
    return response as PlusApiResponse<T>;
  }

  _make_request<T = unknown>(method: HttpMethod, endpoint: string, options: MakeRequestOptions = {}): Promise<PlusApiResponse<T>> {
    return this.makeRequest<T>(method, endpoint, options);
  }

  loginToToolRepository(userIdentifier?: string | null) {
    return this.makeRequest("POST", `${PlusAPI.TOOLS_RESOURCE}/login`, {
      json: userIdentifier ? { user_identifier: userIdentifier } : {},
    });
  }

  login_to_tool_repository(userIdentifier?: string | null) {
    return this.loginToToolRepository(userIdentifier);
  }

  getTool(handle: string) {
    return this.makeRequest("GET", `${PlusAPI.TOOLS_RESOURCE}/${handle}`);
  }

  get_tool(handle: string) {
    return this.getTool(handle);
  }

  getAgent(handle: string) {
    return this.makeRequest("GET", `${PlusAPI.AGENTS_RESOURCE}/${handle}`);
  }

  get_agent(handle: string) {
    return this.getAgent(handle);
  }

  publishTool(
    handle: string,
    isPublic: boolean,
    version: string,
    description: string | null,
    encodedFile: string,
    availableExports: readonly AvailableExport[] | null = null,
    toolsMetadata: readonly ToolMetadata[] | null = null,
  ) {
    const payload: PublishToolPayload = {
      handle,
      public: isPublic,
      version,
      file: encodedFile,
      description,
      available_exports: availableExports,
      tools_metadata: toolsMetadata ? { package: handle, tools: toolsMetadata } : null,
    };
    return this.makeRequest("POST", PlusAPI.TOOLS_RESOURCE, { json: payload });
  }

  publish_tool(
    handle: string,
    isPublic: boolean,
    version: string,
    description: string | null,
    encodedFile: string,
    availableExports: readonly AvailableExport[] | null = null,
    toolsMetadata: readonly ToolMetadata[] | null = null,
  ) {
    return this.publishTool(handle, isPublic, version, description, encodedFile, availableExports, toolsMetadata);
  }

  getSkill(org: string, name: string, version?: string | null) {
    return this.makeRequest("GET", `${PlusAPI.SKILLS_RESOURCE}/${org}/${name}`, {
      params: version ? { version } : null,
    });
  }

  get_skill(org: string, name: string, version?: string | null) {
    return this.getSkill(org, name, version);
  }

  publishSkill(org: string, name: string, version: string, isPublic: boolean, description: string | null, encodedFile: string) {
    return this.makeRequest("POST", PlusAPI.SKILLS_RESOURCE, {
      json: { org, name, version, public: isPublic, description, file: encodedFile },
    });
  }

  publish_skill(org: string, name: string, version: string, isPublic: boolean, description: string | null, encodedFile: string) {
    return this.publishSkill(org, name, version, isPublic, description, encodedFile);
  }

  listSkills(org?: string | null) {
    return this.makeRequest("GET", PlusAPI.SKILLS_RESOURCE, { params: org ? { org } : null });
  }

  list_skills(org?: string | null) {
    return this.listSkills(org);
  }

  deployByName(projectName: string) {
    return this.makeRequest("POST", `${PlusAPI.CREWS_RESOURCE}/by-name/${projectName}/deploy`);
  }

  deploy_by_name(projectName: string) {
    return this.deployByName(projectName);
  }

  deployByUuid(uuid: string) {
    return this.makeRequest("POST", `${PlusAPI.CREWS_RESOURCE}/${uuid}/deploy`);
  }

  deploy_by_uuid(uuid: string) {
    return this.deployByUuid(uuid);
  }

  crewStatusByName(projectName: string) {
    return this.makeRequest("GET", `${PlusAPI.CREWS_RESOURCE}/by-name/${projectName}/status`);
  }

  crew_status_by_name(projectName: string) {
    return this.crewStatusByName(projectName);
  }

  crewStatusByUuid(uuid: string) {
    return this.makeRequest("GET", `${PlusAPI.CREWS_RESOURCE}/${uuid}/status`);
  }

  crew_status_by_uuid(uuid: string) {
    return this.crewStatusByUuid(uuid);
  }

  crewByName(projectName: string, logType = "deployment") {
    return this.makeRequest("GET", `${PlusAPI.CREWS_RESOURCE}/by-name/${projectName}/logs/${logType}`);
  }

  crew_by_name(projectName: string, logType = "deployment") {
    return this.crewByName(projectName, logType);
  }

  crewByUuid(uuid: string, logType = "deployment") {
    return this.makeRequest("GET", `${PlusAPI.CREWS_RESOURCE}/${uuid}/logs/${logType}`);
  }

  crew_by_uuid(uuid: string, logType = "deployment") {
    return this.crewByUuid(uuid, logType);
  }

  deleteCrewByName(projectName: string) {
    return this.makeRequest("DELETE", `${PlusAPI.CREWS_RESOURCE}/by-name/${projectName}`);
  }

  delete_crew_by_name(projectName: string) {
    return this.deleteCrewByName(projectName);
  }

  deleteCrewByUuid(uuid: string) {
    return this.makeRequest("DELETE", `${PlusAPI.CREWS_RESOURCE}/${uuid}`);
  }

  delete_crew_by_uuid(uuid: string) {
    return this.deleteCrewByUuid(uuid);
  }

  listCrews() {
    return this.makeRequest("GET", PlusAPI.CREWS_RESOURCE);
  }

  list_crews() {
    return this.listCrews();
  }

  createCrew(payload: CreateCrewPayload) {
    return this.makeRequest("POST", PlusAPI.CREWS_RESOURCE, { json: payload });
  }

  create_crew(payload: CreateCrewPayload) {
    return this.createCrew(payload);
  }

  getOrganizations() {
    return this.makeRequest("GET", PlusAPI.ORGANIZATIONS_RESOURCE);
  }

  get_organizations() {
    return this.getOrganizations();
  }

  initializeTraceBatch(payload: TraceBatchInitPayload) {
    return this.makeRequest("POST", `${PlusAPI.TRACING_RESOURCE}/batches`, { json: payload, timeout: 30 });
  }

  initialize_trace_batch(payload: TraceBatchInitPayload) {
    return this.initializeTraceBatch(payload);
  }

  initializeEphemeralTraceBatch(payload: TraceBatchInitPayload) {
    return this.makeRequest("POST", `${PlusAPI.EPHEMERAL_TRACING_RESOURCE}/batches`, { json: payload });
  }

  initialize_ephemeral_trace_batch(payload: TraceBatchInitPayload) {
    return this.initializeEphemeralTraceBatch(payload);
  }

  sendTraceEvents(traceBatchId: string, payload: TraceEventsPayload) {
    return this.makeRequest("POST", `${PlusAPI.TRACING_RESOURCE}/batches/${traceBatchId}/events`, { json: payload, timeout: 30 });
  }

  send_trace_events(traceBatchId: string, payload: TraceEventsPayload) {
    return this.sendTraceEvents(traceBatchId, payload);
  }

  sendEphemeralTraceEvents(traceBatchId: string, payload: TraceEventsPayload) {
    return this.makeRequest("POST", `${PlusAPI.EPHEMERAL_TRACING_RESOURCE}/batches/${traceBatchId}/events`, { json: payload, timeout: 30 });
  }

  send_ephemeral_trace_events(traceBatchId: string, payload: TraceEventsPayload) {
    return this.sendEphemeralTraceEvents(traceBatchId, payload);
  }

  finalizeTraceBatch(traceBatchId: string, payload: TraceFinalizePayload) {
    return this.makeRequest("PATCH", `${PlusAPI.TRACING_RESOURCE}/batches/${traceBatchId}/finalize`, { json: payload, timeout: 30 });
  }

  finalize_trace_batch(traceBatchId: string, payload: TraceFinalizePayload) {
    return this.finalizeTraceBatch(traceBatchId, payload);
  }

  finalizeEphemeralTraceBatch(traceBatchId: string, payload: TraceFinalizePayload) {
    return this.makeRequest("PATCH", `${PlusAPI.EPHEMERAL_TRACING_RESOURCE}/batches/${traceBatchId}/finalize`, { json: payload, timeout: 30 });
  }

  finalize_ephemeral_trace_batch(traceBatchId: string, payload: TraceFinalizePayload) {
    return this.finalizeEphemeralTraceBatch(traceBatchId, payload);
  }

  markTraceBatchAsFailed(traceBatchId: string, errorMessage: string) {
    const payload: TraceFailedPayload = { status: "failed", failure_reason: errorMessage };
    return this.makeRequest("PATCH", `${PlusAPI.TRACING_RESOURCE}/batches/${traceBatchId}`, { json: payload, timeout: 30 });
  }

  mark_trace_batch_as_failed(traceBatchId: string, errorMessage: string) {
    return this.markTraceBatchAsFailed(traceBatchId, errorMessage);
  }

  markEphemeralTraceBatchAsFailed(traceBatchId: string, errorMessage: string) {
    const payload: TraceFailedPayload = { status: "failed", failure_reason: errorMessage };
    return this.makeRequest("PATCH", `${PlusAPI.EPHEMERAL_TRACING_RESOURCE}/batches/${traceBatchId}`, { json: payload, timeout: 30 });
  }

  mark_ephemeral_trace_batch_as_failed(traceBatchId: string, errorMessage: string) {
    return this.markEphemeralTraceBatchAsFailed(traceBatchId, errorMessage);
  }

  getMcpConfigs(slugs: readonly string[]) {
    return this.makeRequest("GET", `${PlusAPI.INTEGRATIONS_RESOURCE}/mcp_configs`, {
      params: { slugs: slugs.join(",") },
      timeout: 30,
    });
  }

  get_mcp_configs(slugs: readonly string[]) {
    return this.getMcpConfigs(slugs);
  }

  getTriggers() {
    return this.makeRequest("GET", `${PlusAPI.INTEGRATIONS_RESOURCE}/apps`);
  }

  get_triggers() {
    return this.getTriggers();
  }

  getTriggerPayload(appSlug: string, triggerSlug: string) {
    return this.makeRequest("GET", `${PlusAPI.INTEGRATIONS_RESOURCE}/${appSlug}/${triggerSlug}/payload`);
  }

  get_trigger_payload(appSlug: string, triggerSlug: string) {
    return this.getTriggerPayload(appSlug, triggerSlug);
  }
}

export function createAuthenticatedPlusApi(options: Omit<PlusAPIOptions, "apiKey" | "api_key"> = {}): PlusAPI {
  return new PlusAPI({ ...options, apiKey: getAuthToken() });
}

export const create_authenticated_plus_api = createAuthenticatedPlusApi;

export type ToolCredentialOptions = {
  settings?: Settings;
  env?: NodeJS.ProcessEnv;
};

export function buildEnvWithToolRepositoryCredentials(
  repositoryHandle: string,
  options: ToolCredentialOptions = {},
): Record<string, string> {
  const handle = repositoryHandle.toUpperCase().replaceAll("-", "_");
  const settings = options.settings ?? new Settings();
  return {
    ...stringEnv(options.env ?? process.env),
    [`UV_INDEX_${handle}_USERNAME`]: settings.tool_repository_username ?? "",
    [`UV_INDEX_${handle}_PASSWORD`]: settings.tool_repository_password ?? "",
  };
}

export const build_env_with_tool_repository_credentials = buildEnvWithToolRepositoryCredentials;

export function buildEnvWithAllToolCredentials(options: ToolCredentialOptions & { pyprojectPath?: string; pyproject_path?: string } = {}): Record<string, string> {
  const env = stringEnv(options.env ?? process.env);
  const pyprojectPath = options.pyprojectPath ?? options.pyproject_path ?? join(process.cwd(), "pyproject.toml");
  for (const index of extractUvSourceIndexes(pyprojectPath)) {
    Object.assign(env, buildEnvWithToolRepositoryCredentials(index, options));
  }
  return env;
}

export const build_env_with_all_tool_credentials = buildEnvWithAllToolCredentials;

function stringEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  return Object.fromEntries(Object.entries(env).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

function extractUvSourceIndexes(pyprojectPath: string): string[] {
  if (!existsSync(pyprojectPath)) {
    return [];
  }
  try {
    const content = readFileSync(pyprojectPath, "utf8");
    const section = extractTomlSection(content, "tool.uv.sources");
    const indexes: string[] = [];
    for (const match of section.matchAll(/index\s*=\s*"([^"]+)"/g)) {
      const index = match[1];
      if (index) {
        indexes.push(index);
      }
    }
    return indexes;
  } catch {
    return [];
  }
}

function extractTomlSection(content: string, sectionName: string): string {
  const lines = content.split(/\r?\n/);
  const body: string[] = [];
  let inSection = false;
  for (const line of lines) {
    if (/^\s*\[/.test(line)) {
      if (inSection) {
        break;
      }
      inSection = line.trim() === `[${sectionName}]`;
      continue;
    }
    if (inSection) {
      body.push(line);
    }
  }
  return body.join("\n");
}
