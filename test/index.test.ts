import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  A2AClientConfig,
  A2AError,
  A2AErrorCode,
  A2AServerConfig,
  A2ATransport,
  A2AHTTPException,
  A2AAgentCardFetchedEvent,
  A2AConnectionErrorEvent,
  A2AContextCompletedEvent,
  A2ADelegationStartedEvent,
  A2AMessageSentEvent,
  A2AResponseReceivedEvent,
  A2ATransportNegotiatedEvent,
  A2ATaskState,
  APIKeyAuth,
  Agent,
  AgentExecutor,
  BaseAgent,
  AuthenticatedUser,
  AccumulatedToolArgs,
  BaseLLM,
  LLM,
  BaseTransport,
  ConfiguredLLM,
  BearerTokenAuth,
  CSVKnowledgeSource,
  CrewDoclingSource,
  ClientTransportConfig,
  CheckpointConfig,
  ConditionalTask,
  ConsoleFormatter,
  Crew,
  CrewOutput,
  CrewProject,
  CrewStreamingOutput,
  CrewTestCompletedEvent,
  CrewTestFailedEvent,
  CrewTestStartedEvent,
  CrewTrainCompletedEvent,
  CrewTrainFailedEvent,
  CrewTrainStartedEvent,
  CheckpointCompletedEvent,
  CheckpointFailedEvent,
  CheckpointForkCompletedEvent,
  CheckpointRestoreCompletedEvent,
  CheckpointStartedEvent,
  EventNode,
  EventRecord,
  Fingerprint,
  Flow,
  FlowCreatedEvent,
  FlowFinishedEvent,
  FlowInputReceivedEvent,
  FlowInputRequestedEvent,
  FlowPausedEvent,
  FlowPlotEvent,
  FlowStartedEvent,
  FlowStreamingOutput,
  FlowTrackable,
  GoalAchievedEarlyEvent,
  GRPCServerConfig,
  HTTPBasicAuth,
  HumanFeedbackPending,
  InvalidParamsError,
  InMemoryToolCache,
  JSONRPCServerConfig,
  AgentAction,
  AgentFinish,
  AgentEvaluationCompletedEvent,
  AgentEvaluationFailedEvent,
  AgentEvaluationStartedEvent,
  AgentExecutionCompletedEvent,
  AgentExecutionErrorEvent,
  AgentExecutionStartedEvent,
  AgentReasoningCompletedEvent,
  AgentReasoningFailedEvent,
  AgentReasoningStartedEvent,
  I18N,
  I18N_DEFAULT,
  JsonFlowPersistence,
  JsonProvider,
  LockedDictProxy,
  LockedListProxy,
  JSONKnowledgeSource,
  ExcelKnowledgeSource,
  KnowledgeStorage,
  KnowledgeQueryCompletedEvent,
  KnowledgeQueryFailedEvent,
  KnowledgeQueryStartedEvent,
  KnowledgeRetrievalCompletedEvent,
  KnowledgeRetrievalStartedEvent,
  KnowledgeSearchQueryFailedEvent,
  Knowledge,
  LiteAgent,
  LiteAgentExecutionCompletedEvent,
  LiteAgentExecutionErrorEvent,
  LiteAgentExecutionStartedEvent,
  LLMCallCompletedEvent,
  LLMCallFailedEvent,
  LLMCallStartedEvent,
  LLMCallType,
  CACHE_BREAKPOINT_KEY,
  CONTEXT_WINDOW_USAGE_RATIO,
  DEFAULT_CONTEXT_WINDOW_SIZE,
  DEFAULT_SUPPORTS_STOP_WORDS,
  LLMGuardrailCompletedEvent,
  LLMGuardrailStartedEvent,
  LLMStreamChunkEvent,
  LLMThinkingChunkEvent,
  OAuth2ClientCredentials,
  OIDCAuth,
  OutputFormat,
  PDFKnowledgeSource,
  MemoryQueryCompletedEvent,
  MemoryQueryFailedEvent,
  MemoryQueryStartedEvent,
  MemoryRetrievalCompletedEvent,
  MemoryRetrievalFailedEvent,
  MemoryRetrievalStartedEvent,
  MemorySaveCompletedEvent,
  MemorySaveFailedEvent,
  MemorySaveStartedEvent,
  MCPConnectionCompletedEvent,
  MCPConnectionStartedEvent,
  MCPConfigFetchFailedEvent,
  MCPClient,
  MCPToolExecutionFailedEvent,
  Telemetry,
  AgentLogsExecutionEvent,
  AgentLogsStartedEvent,
  analyzeForConsolidation,
  analyzeForSave,
  analyzeQuery,
  mark_cache_breakpoint,
  ConsolidationPlan,
  ExtractedMemories,
  extractMemoriesFromContent,
  LiteAgentOutput,
  Memory,
  MemoryAnalysis,
  MemoryRecord,
  MemorySlice,
  RememberTool,
  QueryAnalysis,
  MCPServerHTTP,
  MCPServerSSE,
  MCPServerStdio,
  METADATA,
  INSTRUCTIONS,
  RESOURCES,
  PlanningConfig,
  Process,
  persist,
  Prompts,
  RuntimeState,
  SecurityConfig,
  ServerTransportConfig,
  SQLiteFlowPersistence,
  SimpleTokenAuth,
  SkillActivatedEvent,
  SkillDiscoveryCompletedEvent,
  SkillDownloadCompletedEvent,
  SkillLoadFailedEvent,
  SigIntEvent,
  SignalType,
  StepObservationCompletedEvent,
  StepObservationStartedEvent,
  TLSConfig,
  Settings,
  SqliteProvider,
  StateProxy,
  KickoffTaskOutputsSQLiteStorage,
  CacheHandler,
  CrewStructuredTool,
  EnvVar,
  SourceHelper,
  StringKnowledgeSource,
  StreamChunk,
  StreamChunkType,
  StructuredTool,
  SemanticQualityEvaluator,
  Task,
  TaskEvaluator,
  TaskEvaluationEvent,
  TaskOutputStorageHandler,
  TaskOutput,
  ToolExecutionErrorEvent,
  ToolResult,
  ToolFilterContext,
  ToolUsageErrorEvent,
  ToolUsageFinishedEvent,
  ToolValidateInputErrorEvent,
  TextFileKnowledgeSource,
  ToolUsage,
  ToolUsageStartedEvent,
  ToolUsageLimitExceededError,
  TodoItem,
  ToolSelectionErrorEvent,
  ToolsHandler,
  GoalAlignmentEvaluator,
  EvaluationDisplayFormatter,
  create_evaluation_callbacks,
  ToolSelectionEvaluator,
  __version__,
  afterLlmCall,
  afterToolCall,
  afterKickoff,
  after_kickoff,
  agetAllFiles,
  beforeLlmCall,
  beforeToolCall,
  agent,
  agentOptionsFromConfig,
  and_,
  buildAncestorDict,
  buildFlowStructure,
  buildParentChildrenDict,
  beforeKickoff,
  before_kickoff,
  calculateExecutionPaths,
  calculateNodeLevels,
  callLLM,
  call_stop_override,
  callback,
  canonical_llm_provider,
  cacheHandler,
  cache_handler,
  countOutgoingEdges,
  crew,
  crewaiEventBus,
  createReadFileTool,
  clearAllGlobalHooks,
  context_window_size_for_model,
  create_llm,
  detectProvider,
  extract_provider,
  extractInputFilesFromInputs,
  flowConfig,
  getCurrentFlowId,
  getCurrentFlowMethodName,
  getCurrentFlowRequestId,
  getFlowMetadata,
  getPossibleReturnConstants,
  getChildIndex,
  getFlowStructure,
  getHumanFeedbackMetadata,
  get_current_call_id,
  getLLMUsageMetrics,
  humanFeedback,
  importAndValidateDefinition,
  interpolateOnly,
  listen,
  llm_call_context,
  llm,
  matches_provider_pattern,
  normalize_llm_env_key_name,
  or_,
  outputJson,
  output_json,
  outputPydantic,
  output_pydantic,
  resolve_llm_model_spec,
  router,
  resetEmissionSequence,
  strip_cache_breakpoint,
  clearLLMProviders,
  registerLLMProvider,
  sanitizeToolName,
  slugify,
  start,
  taskOptionsFromConfig,
  task,
  tool,
  validate_context_window_sizes,
  validate_model_in_constants,
  validate_structured_output,
  type AgentStep,
  type CrewAIEvent,
  type HumanInputProvider,
  type InputValues,
  type InputResponse,
  type MethodExecutionPausedEvent,
  type LLMCallOptions,
  type LLMMessage,
  type UsageMetrics,
  version,
  BaseEvent,
  Auth0Provider,
  AuthError,
  AttributeError,
  CCEnvEvent,
  ChatInputField,
  ChatInputs,
  CODEX_ENV_VARS,
  DatabaseError,
  DatabaseOperationError,
  DIVIDERS,
  DEFAULT_CREW_DESCRIPTION,
  DEFAULT_FILE_STORE_TTL,
  DEFAULT_INPUT_DESCRIPTION,
  DefaultEnvEvent,
  AgentEvaluationResult,
  AgentEvaluator,
  CrewEvaluator,
  CrewTrainingHandler,
  CrewTestResultEvent,
  Converter,
  ConverterError,
  asyncConvertToModel,
  EvaluationScore,
  Logger,
  HallucinationGuardrail,
  LLMGuardrail,
  LLMGuardrailResult,
  PRINTER,
  Printer,
  StandardGuardrailResult,
  StandardPromptResult,
  SystemPromptResult,
  addConstToOneOfVariants,
  aggregateRawOutputsFromTaskOutputs,
  aggregateRawOutputsFromTasks,
  buildRichFieldDescription,
  buildSystemMessage,
  BaseEmbeddingsProvider,
  BaseRAGStorage,
  ChromaDBClient,
  ChromaDBConfig,
  AnthropicCompletion,
  AzureCompletion,
  BedrockCompletion,
  GeminiCompletion,
  OpenAICompletion,
  ResponsesAPIResult,
  EntraIdProvider,
  KeycloakProvider,
  Oauth2Settings,
  OktaProvider,
  PlusAPI,
  ProviderFactory,
  buildEmbedder,
  buildEmbedderFromDict,
  buildEnvWithAllToolCredentials,
  buildEnvWithToolRepositoryCredentials,
  captureExecutionContext,
  convertToolsToOpenAISchema,
  convertToModel,
  convertOneOfToAnyOf,
  checkConversationalCrewsVersion,
  callableToString,
  clearEmbeddingProviderBuilders,
  clearCallableRegistry,
  clearFileStore,
  clearRagClientFactories,
  clearI18NCache,
  createToolFunction,
  createDynamicToolFilter,
  createErrorResponse,
  createFunctionTool,
  createStaticToolFilter,
  executeToolAndCheckFinality,
  aexecuteToolAndCheckFinality,
  createContentId,
  createRagClient,
  createTemporaryTokenStorage,
  dbStoragePath,
  DEFAULT_CLI_SETTINGS,
  flowStructure,
  getAuthToken,
  getCurrentParentId,
  getCurrentTaskId,
  getEnvContext,
  getAllFiles,
  getFiles,
  getI18N,
  getLastEventId,
  getPlatformIntegrationToken,
  getTaskFiles,
  getTriggeringEventId,
  fetchRequiredInputs,
  generateCrewChatInputs,
  generateCrewDescriptionWithAi,
  generateCrewToolSchema,
  generateInputDescriptionWithAi,
  handleUserInput,
  generateModelDescription,
  getToolNames,
  forceAdditionalPropertiesFalse,
  maybeCastOneToMany,
  normalizeBaseRecord,
  normalizeEmbeddings,
  normalizeRagConfig,
  platformContext,
  QdrantClient,
  QdrantConfig,
  QdrantEdgeStorage,
  RWLock,
  registerEmbeddingProviderBuilder,
  registerCallable,
  registerRagClientFactory,
  restoreEventScope,
  resolveRefs,
  runWithExecutionContext,
  runCrewTool,
  processGuardrail,
  processConfig,
  serializeGuardrailForJson,
  serializeGuardrailsForJson,
  setHallucinationGuardrailHook,
  setCurrentTaskId,
  setLastEventId,
  sanitizeToolParamsForAnthropicStrict,
  sanitizeToolParamsForBedrockStrict,
  sanitizeToolParamsForOpenAIStrict,
  triggeredByScope,
  updateUserData,
  hasUserDeclinedTracing,
  isTracingEnabled,
  loadUserData,
  crewJsonStringify,
  getProjectDescription,
  getProjectName,
  getProjectVersion,
  getCrewaiVersion,
  handlePartialJson,
  extractTaskSection,
  formatMessageForLLM,
  hasReachedMaxIterations,
  lock,
  parseToml,
  parseAgentOutput,
  readToml,
  requireModule,
  renderColoredText,
  renderTextDescriptionAndArgs,
  resetEnvContextForTesting,
  setSuppressConsoleOutput,
  shouldSuppressConsoleOutput,
  storeFiles,
  storeTaskFiles,
  suppressLogging,
  stringToCallable,
  toSerializable,
  toString,
  validateImportPath,
  validateModel,
  validateEmbeddings,
  LanceDBStorage,
  validateJwtToken,
  ensureAllPropertiesRequired,
  ensureTypeInSchemas,
  stripNullFromTypes,
  stripUnsupportedFormats,
  TokenManager,
  TokenCalcHandler,
  TrainingConverter,
  WorkosProvider,
  OutputParserError,
  OptionalDependencyError,
  LLMContextLengthExceededError,
  Skill,
  SkillCacheManager,
  SkillNotCachedError,
  SkillParseError,
  HTTPTransport,
  SSETransport,
  StaticToolFilter,
  StdioTransport,
  TransportType,
  isMCPServerConfig,
  isRetryableError,
  activateSkill,
  discoverSkills,
  formatSkillContext,
  loadResources,
  loadSkillMetadata,
  parseFrontmatter,
  parseRegistryRef,
  resolveRegistryRef,
  negotiateTransport,
  processTaskState,
  renderA2ATemplate,
  sendMessageAndGetTaskId,
  AVAILABLE_AGENTS_TEMPLATE,
  extractErrorMessage,
  extractTaskResultParts,
  TransportNegotiationError,
} from "../src/index.js";

type Decorator = (
  value: never,
  context: never,
) => unknown;

beforeEach(() => {
  crewaiEventBus.clear();
  clearCallableRegistry();
  restoreEventScope([]);
  setCurrentTaskId(null);
  setLastEventId(null);
  resetEmissionSequence();
  clearLLMProviders();
  clearFileStore();
  clearI18NCache();
  resetEnvContextForTesting();
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
  flowConfig.inputProvider = null;
  flowConfig.hitlProvider = null;
  clearAllGlobalHooks();
  clearEmbeddingProviderBuilders();
  clearRagClientFactories();
});

describe("package entrypoint", () => {
  it("exports the package version placeholder", () => {
    expect(version).toBe("0.0.0");
  });
});

describe("auth utilities", () => {
  it("stores encrypted tokens, returns only unexpired tokens, and clears them", () => {
    const storageDir = createTemporaryTokenStorage();
    try {
      const tokenManager = new TokenManager({ storageDir });
      tokenManager.save_tokens("access-token", Math.floor(Date.now() / 1000) + 60);

      expect(tokenManager.get_token()).toBe("access-token");
      expect(getAuthToken(tokenManager)).toBe("access-token");

      tokenManager.saveTokens("expired-token", Math.floor(Date.now() / 1000) - 60);
      expect(tokenManager.getToken()).toBeNull();
      expect(() => getAuthToken(tokenManager)).toThrow(AuthError);

      tokenManager.clear_tokens();
      expect(tokenManager.get_token()).toBeNull();
    } finally {
      rmSync(storageDir, { recursive: true, force: true });
    }
  });

  it("builds OAuth2 provider URLs and scopes compatible with upstream providers", () => {
    const auth0 = new Auth0Provider(new Oauth2Settings({
      provider: "auth0",
      client_id: "client",
      domain: "tenant.auth0.com",
      audience: "api",
    }));
    const workos = new WorkosProvider(new Oauth2Settings({
      provider: "workos",
      clientId: "client",
      domain: "login.example.com",
    }));
    const entra = new EntraIdProvider(new Oauth2Settings({
      provider: "entra_id",
      clientId: "client",
      domain: "tenant-id",
      audience: "api://app",
      extra: { scope: "offline_access api.read" },
    }));
    const okta = new OktaProvider(new Oauth2Settings({
      provider: "okta",
      clientId: "client",
      domain: "dev.okta.com",
      audience: "api",
      extra: { authorization_server_name: "default" },
    }));
    const keycloak = new KeycloakProvider(new Oauth2Settings({
      provider: "keycloak",
      clientId: "client",
      domain: "https://id.example.com",
      extra: { realm: "crew" },
    }));

    expect(auth0.get_authorize_url()).toBe("https://tenant.auth0.com/oauth/device/code");
    expect(workos.get_jwks_url()).toBe("https://login.example.com/oauth2/jwks");
    expect(entra.get_oauth_scopes()).toEqual(["openid", "profile", "email", "offline_access", "api.read"]);
    expect(okta.get_issuer()).toBe("https://dev.okta.com/oauth2/default");
    expect(keycloak.get_token_url()).toBe("https://id.example.com/realms/crew/protocol/openid-connect/token");
    expect(ProviderFactory.from_settings(auth0.settings)).toBeInstanceOf(Auth0Provider);
  });

  it("validates RS256 JWTs against JWKS and required claims", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const publicJwk = publicKey.export({ format: "jwk" });
    const now = Math.floor(Date.now() / 1000);
    const jwt = createTestJwt({
      header: { alg: "RS256", typ: "JWT", kid: "test-key" },
      payload: {
        exp: now + 60,
        iat: now,
        iss: "https://issuer.example.com",
        aud: "api",
        sub: "user-1",
      },
      privateKey,
    });
    const fetchImpl = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ keys: [{ ...publicJwk, kid: "test-key", alg: "RS256", use: "sig" }] }),
    } as Response));

    await expect(validateJwtToken({
      jwt_token: jwt,
      jwks_url: "https://issuer.example.com/.well-known/jwks.json",
      issuer: "https://issuer.example.com",
      audience: "api",
      fetch: fetchImpl,
    })).resolves.toMatchObject({ sub: "user-1" });

    await expect(validateJwtToken({
      jwtToken: jwt,
      jwksUrl: "https://issuer.example.com/.well-known/jwks.json",
      issuer: "https://issuer.example.com",
      audience: "other",
      fetch: fetchImpl,
    })).rejects.toThrow("Invalid token audience");
  });
});

describe("platform settings and user data", () => {
  it("loads settings from disk, merges constructor overrides, dumps, and clears user settings", () => {
    const dir = mkdtempSync(join(tmpdir(), "crewai-ts-settings-"));
    const configPath = join(dir, "settings.json");
    const tokenStorage = createTemporaryTokenStorage();
    try {
      writeFileSync(configPath, JSON.stringify({
        enterprise_base_url: "https://enterprise.example.com",
        tool_repository_username: "stored-user",
        oauth2_provider: "auth0",
        oauth2_extra: { tenant: "stored" },
      }), "utf8");
      const tokenManager = new TokenManager({ storageDir: tokenStorage });
      tokenManager.saveTokens("access-token", Math.floor(Date.now() / 1000) + 60);

      const settings = new Settings({
        configPath,
        tokenManager,
        tool_repository_username: "override-user",
        org_name: "Crew",
      });

      expect(settings.enterprise_base_url).toBe("https://enterprise.example.com");
      expect(settings.tool_repository_username).toBe("override-user");
      expect(settings.oauth2_provider).toBe("auth0");
      expect(settings.oauth2_extra).toEqual({ tenant: "stored" });

      settings.clear_user_settings();
      expect(settings.tool_repository_username).toBeNull();
      expect(settings.org_name).toBeNull();
      const persisted = JSON.parse(readFileSync(configPath, "utf8")) as { oauth2_provider?: string };
      expect(persisted.oauth2_provider).toBe("auth0");

      settings.reset();
      expect(settings.enterprise_base_url).toBe(DEFAULT_CLI_SETTINGS.enterprise_base_url);
      expect(settings.oauth2_provider).toBe(DEFAULT_CLI_SETTINGS.oauth2_provider);
      expect(tokenManager.getToken()).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(tokenStorage, { recursive: true, force: true });
    }
  });

  it("persists user data and applies tracing consent rules", () => {
    const previousDataDir = process.env.CREWAI_TS_DATA_DIR;
    const previousStorageDir = process.env.CREWAI_STORAGE_DIR;
    const previousTracingEnabled = process.env.CREWAI_TRACING_ENABLED;
    const dataDir = mkdtempSync(join(tmpdir(), "crewai-ts-user-data-"));
    process.env.CREWAI_TS_DATA_DIR = dataDir;
    process.env.CREWAI_STORAGE_DIR = "project-a";
    delete process.env.CREWAI_TRACING_ENABLED;
    try {
      expect(dbStoragePath()).toBe(join(dataDir, "project-a"));
      expect(loadUserData()).toEqual({});
      expect(isTracingEnabled()).toBe(true);

      updateUserData({ first_execution_done: true, trace_consent: false });

      expect(loadUserData()).toMatchObject({ first_execution_done: true, trace_consent: false });
      expect(hasUserDeclinedTracing()).toBe(true);
      expect(isTracingEnabled()).toBe(false);

      process.env.CREWAI_TRACING_ENABLED = "true";
      expect(isTracingEnabled()).toBe(true);
    } finally {
      if (previousDataDir === undefined) {
        delete process.env.CREWAI_TS_DATA_DIR;
      } else {
        process.env.CREWAI_TS_DATA_DIR = previousDataDir;
      }
      if (previousStorageDir === undefined) {
        delete process.env.CREWAI_STORAGE_DIR;
      } else {
        process.env.CREWAI_STORAGE_DIR = previousStorageDir;
      }
      if (previousTracingEnabled === undefined) {
        delete process.env.CREWAI_TRACING_ENABLED;
      } else {
        process.env.CREWAI_TRACING_ENABLED = previousTracingEnabled;
      }
      rmSync(dataDir, { recursive: true, force: true });
    }
  });
});

describe("Plus API and tool credentials", () => {
  it("builds Plus API headers and wraps endpoint requests", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = vi.fn((url: string | URL | Request, init?: RequestInit) => {
      const requestUrl = typeof url === "string" || url instanceof URL ? url.toString() : url.url;
      calls.push({ url: requestUrl, init: init ?? {} });
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    });
    const settings = new Settings({
      configPath: null,
      enterprise_base_url: "https://enterprise.example.com",
      org_uuid: "org-1",
    });
    const api = new PlusAPI({
      api_key: "token",
      settings,
      fetch: fetchImpl,
      version: "1.2.3",
    });

    await api.get_tool("org/tool");
    await api.publish_skill("org", "skill", "0.1.0", false, "desc", "encoded");
    await api.get_mcp_configs(["github", "slack"]);
    await api.finalize_trace_batch("trace-batch", {
      status: "completed",
      duration_ms: 12,
      final_event_count: 3,
    });

    expect(api.headers.Authorization).toBe("Bearer token");
    expect(api.headers["X-Crewai-Organization-Id"]).toBe("org-1");
    expect(api.headers["User-Agent"]).toBe("CrewAI-CLI/1.2.3");
    expect(calls[0]).toMatchObject({
      url: "https://enterprise.example.com/crewai_plus/api/v1/tools/org/tool",
      init: { method: "GET" },
    });
    expect(calls[1]?.url).toBe("https://enterprise.example.com/crewai_plus/api/v1/skills");
    const publishSkillBody = calls[1]?.init.body;
    expect(typeof publishSkillBody === "string" ? JSON.parse(publishSkillBody) : null).toMatchObject({ org: "org", name: "skill" });
    expect(calls[2]?.url).toBe("https://enterprise.example.com/crewai_plus/api/v1/integrations/mcp_configs?slugs=github%2Cslack");
    expect(calls[3]?.url).toBe("https://enterprise.example.com/crewai_plus/api/v1/tracing/batches/trace-batch/finalize");
  });

  it("injects tool repository credentials into uv index environment variables", () => {
    const dir = mkdtempSync(join(tmpdir(), "crewai-ts-pyproject-"));
    const pyprojectPath = join(dir, "pyproject.toml");
    try {
      writeFileSync(pyprojectPath, [
        "[tool.uv.sources]",
        "private_tool = { index = \"crew-tools\" }",
        "other_tool = { index = \"other-repo\" }",
        "",
        "[project]",
        "name = \"example\"",
      ].join("\n"), "utf8");
      const settings = new Settings({
        configPath: null,
        tool_repository_username: "user",
        tool_repository_password: "pass",
      });

      expect(buildEnvWithToolRepositoryCredentials("crew-tools", { settings, env: { PATH: "/bin" } })).toMatchObject({
        PATH: "/bin",
        UV_INDEX_CREW_TOOLS_USERNAME: "user",
        UV_INDEX_CREW_TOOLS_PASSWORD: "pass",
      });
      expect(buildEnvWithAllToolCredentials({ settings, env: {}, pyprojectPath })).toMatchObject({
        UV_INDEX_CREW_TOOLS_USERNAME: "user",
        UV_INDEX_CREW_TOOLS_PASSWORD: "pass",
        UV_INDEX_OTHER_REPO_USERNAME: "user",
        UV_INDEX_OTHER_REPO_PASSWORD: "pass",
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("serialization and project utilities", () => {
  it("serializes CrewAI objects, dates, sets, maps, bytes, and circular references", () => {
    const circular: { name: string; self?: unknown } = { name: "root" };
    circular.self = circular;
    const date = new Date("2026-05-28T00:00:00.000Z");
    const output = new TaskOutput({
      description: "Task",
      raw: "done",
      agent: "Researcher",
    });

    expect(toSerializable({
      date,
      set: new Set(["a", "b"]),
      map: new Map([[1, "one"]]),
      bytes: Buffer.from("CrewAI"),
      output,
      circular,
      hidden: "secret",
    }, { exclude: ["hidden"] })).toMatchObject({
      date: "2026-05-28T00:00:00.000Z",
      set: ["a", "b"],
      map: { "1": "one" },
      bytes: Buffer.from("CrewAI").toString("base64"),
      output: { raw: "done", agent: "Researcher" },
      circular: { name: "root", self: "<circular_ref:Object>" },
    });
    expect(toString(null)).toBeNull();
    expect(crewJsonStringify({ created: date, value: 1n })).toBe(JSON.stringify({
      created: "2026-05-28T00:00:00.000Z",
      value: "1",
    }));
  });

  it("supports Python-compatible task and crew output field aliases", () => {
    const output = new TaskOutput({
      description: "Summarize field alias compatibility for CrewAI task output",
      expected_output: "structured result",
      raw: "{\"summary\":\"done\"}",
      json_dict: { summary: "done" },
      agent: "Researcher",
      output_format: OutputFormat.JSON,
    });
    const crewOutput = new CrewOutput({
      json_dict: { summary: "done" },
      tasks_output: [output],
    });

    expect(output.expectedOutput).toBe("structured result");
    expect(output.jsonDict).toBe(output.json_dict);
    expect(output.outputFormat).toBe(OutputFormat.JSON);
    expect(output.output_format).toBe(OutputFormat.JSON);
    expect(output.json).toBe(JSON.stringify({ summary: "done" }));
    expect(output.toDict()).toEqual({ summary: "done" });
    expect(output.to_dict()).toEqual({ summary: "done" });
    expect(crewOutput.jsonDict).toBe(crewOutput.json_dict);
    expect(crewOutput.tasksOutput).toBe(crewOutput.tasks_output);
    expect(crewOutput.tokenUsage).toBe(crewOutput.token_usage);
    expect(crewOutput.to_dict()).toEqual({ summary: "done" });
  });

  it("round-trips registered callable callbacks and blocks untrusted dotted imports", async () => {
    const callback = (value: unknown) => `seen ${String(value)}`;
    registerCallable("demo.callbacks.callback", callback);

    expect(callableToString(callback)).toBe("demo.callbacks.callback");
    await expect(stringToCallable("demo.callbacks.callback")).resolves.toBe(callback);
    await expect(stringToCallable("node:process.exit")).rejects.toThrow("CREWAI_DESERIALIZE_CALLBACKS=1");
    await expect(stringToCallable(123)).rejects.toThrow("Expected a callable");
    expect(callableToString(() => "anonymous")).toBeNull();
  });

  it("parses pyproject TOML and reads CrewAI project metadata", () => {
    const dir = mkdtempSync(join(tmpdir(), "crewai-ts-project-utils-"));
    const pyprojectPath = join(dir, "pyproject.toml");
    try {
      writeFileSync(pyprojectPath, [
        "[project]",
        "name = \"demo-crew\"",
        "version = \"1.2.3\"",
        "description = \"Demo crew\"",
        "dependencies = [\"crewai>=1\", \"pydantic\"]",
        "",
        "[tool.uv.sources]",
        "private_tool = { index = \"crew-tools\" }",
      ].join("\n"), "utf8");

      expect(parseToml(readFileSync(pyprojectPath, "utf8"))).toMatchObject({
        project: {
          name: "demo-crew",
          version: "1.2.3",
          dependencies: ["crewai>=1", "pydantic"],
        },
        tool: {
          uv: {
            sources: {
              private_tool: { index: "crew-tools" },
            },
          },
        },
      });
      expect(readToml(pyprojectPath)).toMatchObject({ project: { name: "demo-crew" } });
      expect(getProjectName(pyprojectPath)).toBe("demo-crew");
      expect(getProjectVersion(pyprojectPath)).toBe("1.2.3");
      expect(getProjectDescription(pyprojectPath)).toBe("Demo crew");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("validates import paths and reports optional dependency errors like upstream", async () => {
    expect(await validateImportPath("node:path.join")).toBeTypeOf("function");
    expect(await importAndValidateDefinition("node:path.join")).toBeTypeOf("function");
    expect(await requireModule("node:path", { purpose: "path tests", attr: "join" })).toBeTypeOf("function");
    expect(getCrewaiVersion()).toBe(version);

    await expect(validateImportPath("missing")).rejects.toThrow(
      "import_path 'missing' must be of the form 'module.ClassName'",
    );
    await expect(importAndValidateDefinition("node:path.missingAttr")).rejects.toThrow(
      "Attribute 'missingAttr' not found in module 'node:path'",
    );
    await expect(requireModule("node:path", { purpose: "path tests", attr: "missingAttr" })).rejects.toBeInstanceOf(AttributeError);
    await expect(requireModule("definitely_missing_pkg", { purpose: "search tools" })).rejects.toBeInstanceOf(OptionalDependencyError);
    await expect(requireModule("definitely_missing_pkg", { purpose: "search tools" })).rejects.toThrow(
      "search tools requires the optional dependency 'definitely_missing_pkg'.\nInstall it with: uv add definitely_missing_pkg",
    );
  });
});

describe("environment, logging, and file store utilities", () => {
  it("emits environment context once with CrewAI upstream precedence", () => {
    const events: CrewAIEvent[] = [];
    crewaiEventBus.on("cc_env", (_source, event) => {
      events.push(event);
    });
    crewaiEventBus.on("codex_env", (_source, event) => {
      events.push(event);
    });
    crewaiEventBus.on("default_env", (_source, event) => {
      events.push(event);
    });

    getEnvContext({ CLAUDECODE: "1", CODEX_THREAD_ID: "thread" });
    getEnvContext({ CODEX_THREAD_ID: "thread" });

    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(CCEnvEvent);
    expect(events[0]?.type).toBe("cc_env");

    resetEnvContextForTesting();
    getEnvContext({ [CODEX_ENV_VARS[0]]: "1" });
    expect(events.at(-1)?.type).toBe("codex_env");

    resetEnvContextForTesting();
    getEnvContext({});
    expect(events.at(-1)).toBeInstanceOf(DefaultEnvEvent);
  });

  it("logs only in verbose mode with colored timestamped output", async () => {
    const messages: string[] = [];
    const logger = new Logger({
      verbose: true,
      default_color: "green",
      writer: (message) => messages.push(message),
    });

    new Logger({ writer: (message) => messages.push(message) }).log("info", "hidden");
    logger.log("info", "visible");

    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("[INFO]: ");
    expect(messages[0]).toContain("visible");
    expect(renderColoredText([{ text: "plain", color: "red" }], false)).toBe("plain");
    await expect(suppressLogging(() => "result")).resolves.toBe("result");
  });

  it("provides upstream-compatible printer suppression and database error helpers", () => {
    const printed: string[] = [];
    const printer = new Printer((message) => printed.push(message));

    printer.print("visible", "green", " ", "");
    expect(printed).toHaveLength(1);
    expect(printed[0]).toContain("visible");

    const previous = setSuppressConsoleOutput(true);
    try {
      expect(previous).toBe(false);
      expect(shouldSuppressConsoleOutput()).toBe(true);
      printer.print("hidden");
      PRINTER.print("");
    } finally {
      setSuppressConsoleOutput(previous);
    }
    expect(printed).toHaveLength(1);

    const original = new Error("disk full");
    const wrapped = new DatabaseOperationError("save failed", original);
    expect(wrapped.original_error).toBe(original);
    expect(DatabaseError.format_error(DatabaseError.SAVE_ERROR, original)).toBe("Error saving task outputs: disk full");
  });

  it("stores crew and task files with task-level overrides and TTL expiry", async () => {
    vi.useFakeTimers();
    storeFiles("crew-1", {
      shared: { source: "crew" },
      crewOnly: "crew-file",
    }, DEFAULT_FILE_STORE_TTL);
    storeTaskFiles("task-1", {
      shared: { source: "task" },
      taskOnly: "task-file",
    }, 1);

    expect(getFiles("crew-1")).toEqual({
      shared: { source: "crew" },
      crewOnly: "crew-file",
    });
    expect(getTaskFiles("task-1")).toEqual({
      shared: { source: "task" },
      taskOnly: "task-file",
    });

    expect(getAllFiles("crew-1", "task-1")).toEqual({
      shared: { source: "task" },
      crewOnly: "crew-file",
      taskOnly: "task-file",
    });

    vi.advanceTimersByTime(1001);
    expect(await agetAllFiles("crew-1", "task-1")).toEqual({
      shared: { source: "crew" },
      crewOnly: "crew-file",
    });
  });
});

describe("lock utilities", () => {
  it("allows concurrent readers while writers wait for exclusive access", async () => {
    const rwLock = new RWLock();
    const operations: string[] = [];
    let activeReaders = 0;
    let maxReaders = 0;

    await Promise.all([
      rwLock.r_locked(async () => {
        activeReaders += 1;
        maxReaders = Math.max(maxReaders, activeReaders);
        operations.push("r1:start");
        await delay(10);
        operations.push("r1:end");
        activeReaders -= 1;
      }),
      rwLock.r_locked(async () => {
        activeReaders += 1;
        maxReaders = Math.max(maxReaders, activeReaders);
        operations.push("r2:start");
        await delay(10);
        operations.push("r2:end");
        activeReaders -= 1;
      }),
      rwLock.w_locked(async () => {
        operations.push("w:start");
        expect(activeReaders).toBe(0);
        await delay(1);
        operations.push("w:end");
      }),
    ]);

    expect(maxReaders).toBe(2);
    expect(operations.indexOf("w:start")).toBeGreaterThan(operations.indexOf("r1:end"));
    expect(operations.indexOf("w:start")).toBeGreaterThan(operations.indexOf("r2:end"));
  });

  it("serializes named lock sections and releases after exceptions", async () => {
    const operations: string[] = [];

    await expect(Promise.all([
      lock("shared", async () => {
        operations.push("first:start");
        await delay(10);
        operations.push("first:end");
      }),
      lock("shared", async () => {
        operations.push("second:start");
        await delay(1);
        operations.push("second:end");
      }),
    ])).resolves.toEqual([undefined, undefined]);

    expect(operations).toEqual(["first:start", "first:end", "second:start", "second:end"]);

    await expect(lock("shared", () => {
      throw new Error("boom");
    })).rejects.toThrow("boom");
    await expect(lock("shared", () => "recovered")).resolves.toBe("recovered");
  });
});

describe("formatter and guardrail utilities", () => {
  it("aggregates raw task outputs with upstream dividers", () => {
    const first = new TaskOutput({
      description: "Research",
      expectedOutput: "Findings",
      raw: "alpha",
      agent: "Researcher",
    });
    const second = new TaskOutput({
      description: "Write",
      expectedOutput: "Report",
      raw: "beta",
      agent: "Writer",
    });
    const taskA = new Task({ description: "A", expectedOutput: "A", agent: null });
    const taskB = new Task({ description: "B", expectedOutput: "B", agent: null });
    taskA.output = first;
    taskB.output = second;

    expect(aggregateRawOutputsFromTaskOutputs([first, second])).toBe(`alpha${DIVIDERS}beta`);
    expect(aggregateRawOutputsFromTasks([taskA, taskB])).toBe(`alpha${DIVIDERS}beta`);
  });

  it("serializes guardrails for JSON checkpoints and normalizes guardrail results", () => {
    const warningSpy = vi.spyOn(process, "emitWarning").mockImplementation(() => undefined);
    const callable = (output: { raw: string }) => [true, `${output.raw} checked`] as const;
    const events: CrewAIEvent[] = [];
    crewaiEventBus.on("llm_guardrail_started", (_source, event) => {
      events.push(event);
    });
    crewaiEventBus.on("llm_guardrail_completed", (_source, event) => {
      events.push(event);
    });
    const output = new TaskOutput({
      description: "Check",
      expectedOutput: "Valid",
      raw: "answer",
      agent: "Reviewer",
    });

    expect(serializeGuardrailForJson("validate output")).toBe("validate output");
    expect(serializeGuardrailForJson(null)).toBeNull();
    expect(serializeGuardrailForJson(callable)).toBeNull();
    expect(serializeGuardrailsForJson(["check size", callable])).toEqual(["check size"]);
    expect(warningSpy).toHaveBeenCalled();

    const passed = StandardGuardrailResult.from_tuple([true, "clean"]);
    const failed = StandardGuardrailResult.fromTuple([false, "too short"]);
    expect(passed).toMatchObject({ success: true, result: "clean", error: null });
    expect(failed).toMatchObject({ success: false, result: null, error: "too short" });
    expect(processGuardrail(output, callable)).toMatchObject({
      success: true,
      result: "answer checked",
      error: null,
    });
    expect(events[0]).toBeInstanceOf(LLMGuardrailStartedEvent);
    expect((events[0] as LLMGuardrailStartedEvent).retry_count).toBe(0);
    expect(events[1]).toBeInstanceOf(LLMGuardrailCompletedEvent);
    expect((events[1] as LLMGuardrailCompletedEvent).result).toBe("answer checked");
    expect(() => new StandardGuardrailResult({ success: true, result: "ok", error: "bad" })).toThrow();
    warningSpy.mockRestore();
  });

  it("validates task output with an LLM guardrail and exposes a Task-compatible function", async () => {
    const prompts: string[] = [];
    const guardrail = new LLMGuardrail({
      description: "Must mention citations",
      llm: (messages) => {
        prompts.push(messages.map((message) => message.content).join("\n"));
        return "{\"valid\":false,\"feedback\":\"Missing citations\"}";
      },
    });
    const output = new TaskOutput({
      description: "Check",
      expectedOutput: "Valid",
      raw: "answer",
      agent: "Reviewer",
    });

    await expect(guardrail.validateOutput(output)).resolves.toBeInstanceOf(LLMGuardrailResult);
    await expect(guardrail.call(output)).resolves.toEqual([false, "Missing citations"]);
    await expect(guardrail.asGuardrail()(output)).resolves.toEqual([false, "Missing citations"]);
    expect(prompts[0]).toContain("Must mention citations");
    expect(prompts[0]).toContain("answer");
  });

  it("keeps HallucinationGuardrail as the upstream OSS no-op with an override hook", () => {
    const guardrail = new HallucinationGuardrail({
      llm: () => "unused",
      context: "Reference context",
      threshold: 8,
      toolResponse: "Tool evidence",
    });
    const output = new TaskOutput({
      description: "Check",
      expectedOutput: "Valid",
      raw: "grounded answer",
      agent: "Reviewer",
    });

    expect(guardrail.description).toBe("HallucinationGuardrail (no-op)");
    expect(guardrail.call(output)).toEqual([true, "grounded answer"]);
    setHallucinationGuardrailHook((instance, taskOutput) => [
      false,
      `${instance.description}: ${taskOutput.raw}`,
    ]);
    expect(guardrail.asGuardrail()(output)).toEqual([
      false,
      "HallucinationGuardrail (no-op): grounded answer",
    ]);
    setHallucinationGuardrailHook(null);
  });
});

describe("training utilities", () => {
  it("persists trained data and per-iteration training data", () => {
    const dir = mkdtempSync(join(tmpdir(), "crewai-ts-training-"));
    const filePath = join(dir, "training_data.pkl");
    try {
      const handler = new CrewTrainingHandler(filePath);
      handler.initialize_file();
      expect(handler.load()).toEqual({});

      handler.save_trained_data("agent1", { param1: 1, param2: 2 });
      expect(handler.load()).toEqual({ agent1: { param1: 1, param2: 2 } });

      handler.append(0, "agent1", { score: 1 });
      handler.append(1, "agent1", { score: 2 });
      expect(handler.load()).toEqual({
        agent1: {
          "0": { score: 1 },
          "1": { score: 2 },
          param1: 1,
          param2: 2,
        },
      });

      handler.clear();
      expect(handler.load()).toEqual({});
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("extracts training converter fields and parses list and numeric responses", () => {
    const calls: string[] = [];
    const converter = new TrainingConverter({
      text: "Sample text for evaluation",
      instructions: "Convert to JSON format",
      model: {
        string_field: { description: "A simple string field", type: "string" },
        list_field: { description: "A list of strings", type: "list" },
        number_field: { description: "A number field", type: "float" },
      },
      llm: {
        call(messages) {
          const prompt = messages[1]?.content ?? "";
          calls.push(prompt);
          if (prompt.includes("string_field")) {
            return "  test string value  ";
          }
          if (prompt.includes("list_field")) {
            return "- item1\n- item2\n* item3";
          }
          if (prompt.includes("number_field")) {
            return "The quality score is 8.5 out of 10";
          }
          return "unknown";
        },
      },
    });

    expect(converter.to_pydantic()).toEqual({
      string_field: "test string value",
      list_field: ["item1", "item2", "item3"],
      number_field: 8.5,
    });
    expect(calls).toHaveLength(3);
    expect(converter._process_field_value("[\"a\",\"b\"]", "list")).toEqual(["a", "b"]);
    expect(TrainingConverter._parse_float("none")).toBe(0);
    expect(TrainingConverter._strip_bullet("* Item")).toBe("Item");
  });
});

describe("schema utilities", () => {
  it("resolves local refs and protects circular definitions with a schema stub", () => {
    const resolved = resolveRefs({
      $ref: "#/$defs/Node",
      $defs: {
        Node: {
          type: "object",
          description: "Tree node",
          properties: {
            value: { type: "string" },
            child: { $ref: "#/$defs/Node" },
          },
        },
      },
    });

    expect(resolved).toEqual({
      type: "object",
      description: "Tree node",
      properties: {
        value: { type: "string" },
        child: { type: "object", description: "Tree node" },
      },
    });
  });

  it("normalizes strict JSON schemas recursively", () => {
    const schema = {
      type: "object",
      title: "SearchInput",
      properties: {
        query: { type: "string", title: "Query", minLength: 2, format: "email" },
        after: { anyOf: [{ type: "string", format: "date-time" }, { type: "null" }] },
        nested: {
          oneOf: [
            {
              type: "object",
              properties: {
                count: { type: ["integer", "null"], default: 1 },
              },
            },
            {},
          ],
        },
      },
      $defs: {
        Ignored: { type: "object" },
      },
    };

    expect(stripUnsupportedFormats(structuredClone(schema)).properties.query).not.toHaveProperty("format");
    expect(ensureTypeInSchemas({ anyOf: [{}] })).toEqual({ anyOf: [{ type: "object" }] });
    expect(convertOneOfToAnyOf({ oneOf: [{ type: "string" }] })).toEqual({ anyOf: [{ type: "string" }] });
    expect(stripNullFromTypes({ anyOf: [{ type: "string" }, { type: "null" }] })).toEqual({ type: "string" });

    const strict = sanitizeToolParamsForOpenAIStrict(schema);
    expect(strict).toEqual({
      type: "object",
      additionalProperties: false,
      required: ["query", "after", "nested"],
      properties: {
        query: { type: "string", minLength: 2 },
        after: { anyOf: [{ type: "string", format: "date-time" }, { type: "null" }] },
        nested: {
          anyOf: [
            {
              type: "object",
              additionalProperties: false,
              required: ["count"],
              properties: {
                count: { type: ["integer", "null"] },
              },
            },
            { type: "object", additionalProperties: false, required: [], properties: {} },
          ],
        },
      },
    });

    expect(ensureAllPropertiesRequired(forceAdditionalPropertiesFalse({ type: "object" }))).toEqual({
      type: "object",
      additionalProperties: false,
      properties: {},
      required: [],
    });
  });

  it("applies Anthropic and Bedrock strict schema rules", () => {
    const rootUnion = {
      anyOf: [
        {
          type: "object",
          properties: {
            q: { type: "string", pattern: "^[a-z]+$", minLength: 3, format: "uuid" },
          },
        },
        { type: "null" },
      ],
    };

    const anthropic = sanitizeToolParamsForAnthropicStrict(rootUnion);
    expect(anthropic).toEqual({
      type: "object",
      additionalProperties: false,
      required: ["q"],
      properties: {
        q: { type: "string" },
      },
    });
    expect(sanitizeToolParamsForBedrockStrict(rootUnion)).toEqual(anthropic);
  });

  it("supports discriminator helpers and model descriptions", () => {
    const schema = addConstToOneOfVariants({
      oneOf: [
        { title: "Cat", type: "object", properties: { kind: { type: "string" } } },
        { title: "Dog", type: "object", properties: { kind: { type: "string" } } },
      ],
      discriminator: {
        propertyName: "kind",
        mapping: { cat: "Cat", dog: "Dog" },
      },
    });
    expect(schema.oneOf).toEqual([
      { title: "Cat", type: "object", properties: { kind: { type: "string", const: "cat" } } },
      { title: "Dog", type: "object", properties: { kind: { type: "string", const: "dog" } } },
    ]);

    expect(
      buildRichFieldDescription({
        description: "Search query",
        format: "email",
        enum: ["exact", "fuzzy"],
        pattern: "^q",
        minimum: 1,
        maximum: 5,
        minLength: 2,
        maxLength: 20,
        examples: ["q:test", "q:prod", "q:dev", "q:ignored"],
      }),
    ).toBe(
      'Search query. Format: email. Allowed values: ["exact", "fuzzy"]. Pattern: ^q. Minimum: 1. Maximum: 5. Min length: 2. Max length: 20. Examples: "q:test", "q:prod", "q:dev"',
    );

    expect(
      generateModelDescription("SearchInput", {
        type: "object",
        properties: {
          q: { anyOf: [{ type: "string" }, { type: "null" }] },
        },
      }),
    ).toEqual({
      type: "json_schema",
      json_schema: {
        name: "SearchInput",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["q"],
          properties: {
            q: { type: "string" },
          },
        },
      },
    });
  });
});

describe("i18n and prompt utilities", () => {
  it("loads built-in prompt slices and caches prompt catalogs by file", () => {
    expect(new I18N().slice("task_no_tools")).toContain("Provide your complete response");
    expect(I18N_DEFAULT.slice("role_playing")).toContain("You are {role}");
    expect(I18N_DEFAULT.errors("wrong_tool_name")).toContain("doesn't exist");
    expect(I18N_DEFAULT.tools("delegate_work")).toContain("Delegate a specific task");
    expect(I18N_DEFAULT.tools("add_image")).toEqual({
      name: "Add image to content",
      description: "See image to understand its content, you can optionally ask a question about the image",
      default_action: "Please provide a detailed description of this image, including all visual elements, context, and any notable details you can observe.",
    });

    const dir = mkdtempSync(join(tmpdir(), "crewai-ts-i18n-"));
    const promptFile = join(dir, "prompts.json");
    try {
      writeFileSync(promptFile, JSON.stringify({
        slices: { role_playing: "Role {role}", no_tools: "", task_no_tools: "Task {input}" },
        errors: { wrong: "Wrong" },
        tools: { search: "Search" },
        memory: { query: "Query" },
      }));

      const first = getI18N(promptFile);
      const second = getI18N(promptFile);
      expect(first).toBe(second);
      expect(first.slice("role_playing")).toBe("Role {role}");
      expect(first.prompt_file).toBe(promptFile);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("generates upstream-compatible task execution prompts", () => {
    const agentLike = {
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
    };

    const noTools = new Prompts({ agent: agentLike }).taskExecution();
    expect(noTools).toBeInstanceOf(StandardPromptResult);
    expect(noTools.prompt).toContain("You are Researcher. Careful analyst");
    expect(noTools.prompt).toContain("Current Task: {input}");
    expect(noTools.prompt).toContain("Provide your complete response:");

    const tools = new Prompts({ agent: agentLike, hasTools: true }).task_execution();
    expect(tools.prompt).toContain("You ONLY have access to the following tools");
    expect(tools.prompt).toContain("Action Input:");

    const system = new Prompts({
      agent: agentLike,
      has_tools: true,
      use_system_prompt: true,
    }).taskExecution();
    expect(system).toBeInstanceOf(SystemPromptResult);
    expect(system.get("system")).toContain("You ONLY have access to the following tools");
    expect(system.get("user")).toContain("Current Task: {input}");

    const templated = new Prompts({
      agent: agentLike,
      hasTools: true,
      systemTemplate: "SYS {role}: {{ .System }}",
      promptTemplate: "USR {goal}: {{ .Prompt }}",
      responseTemplate: "RESP {{ .Response }}",
    }).taskExecution();
    expect(templated.prompt).toContain("SYS Researcher: You are Researcher");
    expect(templated.prompt).toContain("USR Find facts:");
    expect(templated.prompt).toContain("RESP ");
  });

  it("renders prompt skill blocks without relying on reflect metadata", () => {
    const result = new Prompts({
      agent: {
        role: "Researcher",
        goal: "Find facts",
        backstory: "Careful analyst",
        skills: [{ name: "Source review", description: "Inspect primary sources." }],
      },
    }).taskExecution();

    expect(result.prompt).toContain("<skills>");
    expect(result.prompt).toContain("<skill name=\"Source review\">");
    expect(result.prompt).toContain("Inspect primary sources.");
  });
});

describe("skills", () => {
  it("parses SKILL.md frontmatter and progressively loads instructions/resources", () => {
    const dir = mkdtempSync(join(tmpdir(), "crewai-ts-skills-"));
    const skillsDir = join(dir, "skills");
    const skillDir = join(skillsDir, "source-review");
    try {
      mkdirSync(join(skillDir, "references"), { recursive: true });
      mkdirSync(join(skillDir, "scripts"), { recursive: true });
      writeFileSync(join(skillDir, "SKILL.md"), [
        "---",
        "name: source-review",
        "description: Inspect primary sources.",
        "allowed-tools: search read-file",
        "version: 1.2.3",
        "---",
        "Use primary sources before summaries.",
      ].join("\n"));
      writeFileSync(join(skillDir, "references", "checklist.md"), "Checklist");
      writeFileSync(join(skillDir, "scripts", "collect.js"), "console.log('collect');");

      const [frontmatter, body] = parseFrontmatter(readFileSync(join(skillDir, "SKILL.md"), "utf8"));
      expect(frontmatter.name).toBe("source-review");
      expect(body).toBe("Use primary sources before summaries.");

      const discovered = discoverSkills(skillsDir);
      expect(discovered).toHaveLength(1);
      expect(discovered[0]).toBeInstanceOf(Skill);
      expect(discovered[0]?.disclosureLevel).toBe(METADATA);
      expect(discovered[0]?.frontmatter.allowedTools).toEqual(["search", "read-file"]);

      const activated = activateSkill(discovered[0] as Skill);
      expect(activated.disclosureLevel).toBe(INSTRUCTIONS);
      expect(activated.instructions).toContain("Use primary sources");

      const withResources = loadResources(activated);
      expect(withResources.disclosureLevel).toBe(RESOURCES);
      expect(withResources.resourceFiles).toEqual({
        references: ["checklist.md"],
        scripts: ["collect.js"],
      });
      expect(formatSkillContext(withResources)).toContain("### Available Resources");

      const prompt = new Prompts({
        agent: {
          role: "Researcher",
          goal: "Find facts",
          backstory: "Careful analyst",
          skills: [withResources],
        },
      }).taskExecution();
      expect(prompt.prompt).toContain("Use primary sources before summaries.");
      expect(prompt.prompt).toContain("- **references/**: checklist.md");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("validates skill names and directory names like upstream", () => {
    const dir = mkdtempSync(join(tmpdir(), "crewai-ts-skills-invalid-"));
    const skillDir = join(dir, "wrong-dir");
    try {
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(join(skillDir, "SKILL.md"), [
        "---",
        "name: declared-name",
        "description: Valid description.",
        "---",
        "Body",
      ].join("\n"));

      expect(() => loadSkillMetadata(skillDir)).toThrow("Directory name 'wrong-dir' does not match skill name 'declared-name'");
      expect(() => parseFrontmatter("name: missing delimiter")).toThrow(SkillParseError);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("resolves local and cached registry skills without network access", () => {
    const dir = mkdtempSync(join(tmpdir(), "crewai-ts-skill-registry-"));
    const localSkill = join(dir, "skills", "local-skill");
    const cachedSource = join(dir, "cached-source");
    const cacheRoot = join(dir, "cache");
    try {
      mkdirSync(localSkill, { recursive: true });
      writeFileSync(join(localSkill, "SKILL.md"), [
        "---",
        "name: local-skill",
        "description: Local skill.",
        "---",
        "Local instructions.",
      ].join("\n"));

      expect(parseRegistryRef("@org/local-skill")).toEqual(["org", "local-skill"]);
      const local = resolveRegistryRef("@org/local-skill", null, { cwd: dir, cacheRoot });
      expect(local.name).toBe("local-skill");
      expect(local.disclosureLevel).toBe(INSTRUCTIONS);

      mkdirSync(cachedSource, { recursive: true });
      writeFileSync(join(cachedSource, "SKILL.md"), [
        "---",
        "name: cached-skill",
        "description: Cached skill.",
        "---",
        "Cached instructions.",
      ].join("\n"));
      const cache = new SkillCacheManager(cacheRoot);
      cache.storeDirectory("org", "cached-skill", "0.1.0", cachedSource);

      const cached = resolveRegistryRef("@org/cached-skill", null, { cwd: dir, cacheRoot });
      expect(cached.instructions).toBe("Cached instructions.");
      expect(cache.listCached()).toMatchObject([{ org: "org", name: "cached-skill", version: "0.1.0" }]);
      expect(cache.invalidate("org", "cached-skill")).toBe(true);
      expect(() => resolveRegistryRef("@org/missing", null, { cwd: dir, cacheRoot })).toThrow(SkillNotCachedError);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("applies crew-level skills to agent execution prompts", async () => {
    const dir = mkdtempSync(join(tmpdir(), "crewai-ts-crew-skills-"));
    const skillsDir = join(dir, "skills");
    const skillDir = join(skillsDir, "source-review");
    try {
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(join(skillDir, "SKILL.md"), [
        "---",
        "name: source-review",
        "description: Inspect primary sources.",
        "---",
        "Inspect sources carefully before answering.",
        "",
      ].join("\n"));

      let systemPrompt = "";
      const agentInstance = new Agent({
        role: "Researcher",
        goal: "Find reliable answers",
        backstory: "Careful analyst",
        llm: (messages) => {
          systemPrompt = messages.find((message) => message.role === "system")?.content ?? "";
          return "done";
        },
      });
      const taskInstance = new Task({
        description: "Research CrewAI",
        expectedOutput: "A sourced answer",
        agent: agentInstance,
      });

      await new Crew({
        agents: [agentInstance],
        tasks: [taskInstance],
        skills: [skillsDir, { name: "inline-review", description: "Check inline evidence." }],
      }).kickoff();

      expect(agentInstance.skills.some((skill) => skill instanceof Skill && skill.name === "source-review")).toBe(true);
      expect(systemPrompt).toContain("<skills>");
      expect(systemPrompt).toContain("Inspect sources carefully before answering.");
      expect(systemPrompt).toContain("Check inline evidence.");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("exposes skill lifecycle events with upstream-compatible payload names", () => {
    const discovered = new SkillDiscoveryCompletedEvent({
      search_path: "/skills",
      skills_found: 2,
      skill_names: ["research", "writer"],
    });
    const activated = new SkillActivatedEvent({
      skill_name: "research",
      skill_path: "/skills/research",
    });
    const loadFailed = new SkillLoadFailedEvent({
      skill_name: "broken",
      error: new Error("invalid frontmatter"),
    });
    const downloaded = new SkillDownloadCompletedEvent({
      skill_name: "research",
      registry_ref: "@org/research",
      version: "1.0.0",
      cache_path: "/cache/org/research/1.0.0",
    });

    expect(discovered).toMatchObject({
      type: "skill_discovery_completed",
      sourceType: "skill",
      search_path: "/skills",
      skills_found: 2,
      skill_names: ["research", "writer"],
    });
    expect(activated).toMatchObject({
      type: "skill_activated",
      skill_name: "research",
      skill_path: "/skills/research",
      disclosure_level: 2,
    });
    expect(loadFailed).toMatchObject({ type: "skill_load_failed", error: "invalid frontmatter" });
    expect(downloaded).toMatchObject({
      type: "skill_download_completed",
      registry_ref: "@org/research",
      version: "1.0.0",
      cache_path: "/cache/org/research/1.0.0",
    });
  });
});

describe("mcp configuration", () => {
  it("exposes MCP lifecycle events with upstream-compatible payload names", () => {
    const agent = { id: "agent-1", role: "Researcher" };
    const started = new MCPConnectionStartedEvent({
      server_name: "filesystem",
      server_url: "stdio://filesystem",
      transport_type: "stdio",
      connect_timeout: 30,
      from_agent: agent,
    });
    const completed = new MCPConnectionCompletedEvent({
      server_name: "filesystem",
      started_at: new Date("2026-01-01T00:00:00.000Z"),
      completed_at: new Date("2026-01-01T00:00:01.000Z"),
      connection_duration_ms: 1000,
      is_reconnect: true,
    });
    const failedTool = new MCPToolExecutionFailedEvent({
      server_name: "filesystem",
      tool_name: "read_file",
      tool_args: { path: "/tmp/file" },
      error: new Error("permission denied"),
      error_type: "server_error",
    });
    const configFailed = new MCPConfigFetchFailedEvent({
      slug: "github",
      error: "not connected",
      error_type: "not_connected",
    });

    expect(started).toMatchObject({
      type: "mcp_connection_started",
      sourceType: "mcp",
      server_name: "filesystem",
      server_url: "stdio://filesystem",
      transport_type: "stdio",
      agent_id: "agent-1",
      agent_role: "Researcher",
      connect_timeout: 30,
      is_reconnect: false,
    });
    expect(completed).toMatchObject({
      type: "mcp_connection_completed",
      connection_duration_ms: 1000,
      is_reconnect: true,
    });
    expect(failedTool).toMatchObject({
      type: "mcp_tool_execution_failed",
      tool_name: "read_file",
      tool_args: { path: "/tmp/file" },
      error: "permission denied",
      error_type: "server_error",
    });
    expect(configFailed).toMatchObject({
      type: "mcp_config_fetch_failed",
      slug: "github",
      error: "not connected",
    });
  });

  it("filters MCP tools with static allow and block lists", () => {
    const filter = new StaticToolFilter({
      allowedToolNames: ["read_file", "write_file"],
      blockedToolNames: ["write_file"],
    });
    const filterFn = createStaticToolFilter(["read_file"], ["delete_file"]);

    expect(filter.filter({ name: "read_file" })).toBe(true);
    expect(filter.filter({ name: "write_file" })).toBe(false);
    expect(filter.filter({ name: "search" })).toBe(false);
    expect(filterFn({ name: "read_file" })).toBe(true);
    expect(filterFn({ name: "delete_file" })).toBe(false);
  });

  it("preserves dynamic tool filters and context aliases", () => {
    const context = new ToolFilterContext({
      agent: { role: "Code Reviewer" },
      server_name: "github",
      run_context: { branch: "main" },
    });
    const dynamic = createDynamicToolFilter((ctx, toolDefinition) => {
      return ctx.serverName === "github" && !String(toolDefinition.name).startsWith("danger_");
    });

    expect(context.serverName).toBe("github");
    expect(context.server_name).toBe("github");
    expect(context.runContext).toEqual({ branch: "main" });
    expect(dynamic(context, { name: "search_issues" })).toBe(true);
    expect(dynamic(context, { name: "danger_delete_repo" })).toBe(false);
  });

  it("models MCP server configs and transport types with SDK-backed transports", async () => {
    const toolFilter = createStaticToolFilter(["read_file"]);
    const stdio = new MCPServerStdio({
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem"],
      env: { ROOT: "/tmp" },
      tool_filter: toolFilter,
      cache_tools_list: true,
    });
    const http = new MCPServerHTTP({
      url: "https://api.example.com/mcp",
      headers: { Authorization: "Bearer token" },
    });
    const sse = new MCPServerSSE({
      url: "https://api.example.com/mcp/sse",
      cacheToolsList: true,
    });

    expect(stdio.args).toEqual(["-y", "@modelcontextprotocol/server-filesystem"]);
    expect(stdio.toolFilter).toBe(toolFilter);
    expect(stdio.cacheToolsList).toBe(true);
    expect(http.streamable).toBe(true);
    expect(sse.cache_tools_list).toBe(true);
    expect(isMCPServerConfig(stdio)).toBe(true);
    expect(isMCPServerConfig({ command: "npx" })).toBe(false);

    const stdioTransport = new StdioTransport(stdio);
    const httpTransport = new HTTPTransport(http);
    const nonStreamableHttp = new HTTPTransport("https://api.example.com/mcp", null, false);
    const sseTransport = new SSETransport(sse);

    expect(stdioTransport.transportType).toBe(TransportType.STDIO);
    expect(httpTransport.transportType).toBe(TransportType.STREAMABLE_HTTP);
    expect(nonStreamableHttp.transport_type).toBe(TransportType.HTTP);
    expect(sseTransport.transportType).toBe(TransportType.SSE);
    expect(stdioTransport.connected).toBe(false);
    expect(() => stdioTransport.readStream).toThrow("Transport not connected");

    class MockTransport extends BaseTransport {
      readonly starts: string[] = [];
      get transportType(): typeof TransportType.STDIO {
        return TransportType.STDIO;
      }

      protected createSdkTransport(): ReturnType<BaseTransport["getSdkTransport"]> {
        const transport = {
          start: () => {
            this.starts.push("start");
            return Promise.resolve();
          },
          send: () => Promise.resolve(),
          close: () => Promise.resolve(),
        };
        return transport;
      }
    }

    const mockTransport = new MockTransport();
    await expect(mockTransport.connect()).resolves.toBe(mockTransport);
    expect(mockTransport.connected).toBe(true);
    expect(mockTransport.readStream).toBe(mockTransport.writeStream);
    expect(mockTransport.starts).toEqual(["start"]);
    await mockTransport.disconnect();
    expect(mockTransport.connected).toBe(false);
  });

  it("emits MCP client connection lifecycle events on SDK connection failure", async () => {
    class HangingTransport extends BaseTransport {
      get transportType(): typeof TransportType.STDIO {
        return TransportType.STDIO;
      }

      protected createSdkTransport(): ReturnType<BaseTransport["getSdkTransport"]> {
        const transport = {
          start: () => Promise.resolve(),
          send: () => Promise.resolve(),
          close: () => Promise.resolve(),
        };
        return transport;
      }
    }

    const events: CrewAIEvent[] = [];
    crewaiEventBus.on("mcp_connection_started", (_source, event) => {
      events.push(event);
    });
    crewaiEventBus.on("mcp_connection_failed", (_source, event) => {
      events.push(event);
    });

    const client = new MCPClient(new HangingTransport(), {
      connectTimeout: 0.001,
      maxRetries: 1,
    });

    await expect(client.connect()).rejects.toThrow("Failed to connect to MCP server");
    expect(events.map((event) => event.type)).toEqual(["mcp_connection_started", "mcp_connection_failed"]);
    expect(events[0]).toMatchObject({
      type: "mcp_connection_started",
      connect_timeout: 0.001,
    });
    expect(events[1]).toMatchObject({
      type: "mcp_connection_failed",
      error_type: "timeout",
    });
  });
});

describe("orchestration lifecycle events", () => {
  it("exposes additional flow lifecycle fields and events", () => {
    const created = new FlowCreatedEvent({ flow_name: "ResearchFlow" });
    const plot = new FlowPlotEvent({ flowName: "ResearchFlow" });
    const paused = new FlowPausedEvent({
      flowName: "ResearchFlow",
      flow_id: "flow-1",
      method_name: "review",
      state: { step: 1 },
      message: "Approve?",
      emit: ["approved", "rejected"],
    });

    expect(created).toMatchObject({ type: "flow_created", flow_name: "ResearchFlow" });
    expect(plot).toMatchObject({ type: "flow_plot", flow_name: "ResearchFlow" });
    expect(paused).toMatchObject({
      type: "flow_paused",
      flowId: "flow-1",
      flow_id: "flow-1",
      methodName: "review",
      method_name: "review",
      state: { step: 1 },
      message: "Approve?",
      emit: ["approved", "rejected"],
    });
  });

  it("exposes checkpoint lifecycle events", () => {
    const started = new CheckpointStartedEvent({
      location: "/tmp/state.json",
      provider: "json",
      trigger: "flow_finished",
      branch: "main",
    });
    const completed = new CheckpointCompletedEvent({
      location: "/tmp/state.json",
      provider: "json",
      checkpoint_id: "cp-1",
      duration_ms: 7,
      parent_id: "cp-0",
    });
    const failed = new CheckpointFailedEvent({
      location: "/tmp/state.json",
      provider: "json",
      error: new Error("write failed"),
    });
    const forked = new CheckpointForkCompletedEvent({
      branch: "experiment",
      parent_branch: "main",
      parent_checkpoint_id: "cp-1",
    });
    const restored = new CheckpointRestoreCompletedEvent({
      location: "/tmp/state.json",
      provider: "json",
      checkpoint_id: "cp-1",
      branch: "main",
      duration_ms: 3,
    });

    expect(started).toMatchObject({
      type: "checkpoint_started",
      location: "/tmp/state.json",
      provider: "json",
      trigger: "flow_finished",
      branch: "main",
    });
    expect(completed).toMatchObject({
      type: "checkpoint_completed",
      checkpoint_id: "cp-1",
      duration_ms: 7,
      parent_id: "cp-0",
    });
    expect(failed).toMatchObject({ type: "checkpoint_failed", error: "write failed" });
    expect(forked).toMatchObject({
      type: "checkpoint_fork_completed",
      branch: "experiment",
      parent_branch: "main",
      parent_checkpoint_id: "cp-1",
    });
    expect(restored).toMatchObject({
      type: "checkpoint_restore_completed",
      checkpoint_id: "cp-1",
      branch: "main",
      duration_ms: 3,
    });
  });

  it("exposes observation, signal, and agent logging events", () => {
    const task = { id: "task-1", name: "Plan task" };
    const agent = { id: "agent-1", role: "Planner" };
    const observationStarted = new StepObservationStartedEvent({
      agent_role: "Planner",
      step_number: 1,
      step_description: "Search docs",
      from_task: task,
      from_agent: agent,
    });
    const observationCompleted = new StepObservationCompletedEvent({
      agent_role: "Planner",
      step_number: 1,
      key_information_learned: "Need TypeScript decorators",
      needs_full_replan: true,
      replan_reason: "new constraint",
      suggested_refinements: ["Use standard decorators"],
    });
    const goal = new GoalAchievedEarlyEvent({
      agent_role: "Planner",
      step_number: 2,
      steps_remaining: 3,
      steps_completed: 2,
    });
    const signal = new SigIntEvent({ reason: "user interrupt" });
    const logsStarted = new AgentLogsStartedEvent({
      agent_role: "Researcher",
      task_description: "Find docs",
      verbose: true,
    });
    const logsExecution = new AgentLogsExecutionEvent({
      agent_role: "Researcher",
      formatted_answer: { text: "done" },
    });

    expect(observationStarted).toMatchObject({
      type: "step_observation_started",
      sourceType: "agent",
      sourceFingerprint: "agent-1",
      agent_role: "Planner",
      step_number: 1,
      task_id: "task-1",
      agent_id: "agent-1",
    });
    expect(observationCompleted).toMatchObject({
      type: "step_observation_completed",
      key_information_learned: "Need TypeScript decorators",
      needs_full_replan: true,
      replan_reason: "new constraint",
      suggested_refinements: ["Use standard decorators"],
    });
    expect(goal).toMatchObject({ type: "goal_achieved_early", steps_remaining: 3, steps_completed: 2 });
    expect(signal).toMatchObject({
      type: "SIGINT",
      signal_number: SignalType.SIGINT,
      reason: "user interrupt",
    });
    expect(logsStarted).toMatchObject({
      type: "agent_logs_started",
      agent_role: "Researcher",
      task_description: "Find docs",
      verbose: true,
    });
    expect(logsExecution).toMatchObject({
      type: "agent_logs_execution",
      agent_role: "Researcher",
      formatted_answer: { text: "done" },
      verbose: false,
    });
  });
});

describe("crew tool and memory lifecycle events", () => {
  it("exposes crew train and test lifecycle events with crew fingerprint metadata", () => {
    const crew = {
      fingerprint: {
        uuid_str: "crew-fp",
        metadata: { project: "research" },
      },
    };
    const trainStarted = new CrewTrainStartedEvent({
      crew_name: "ResearchCrew",
      crew,
      n_iterations: 2,
      filename: "train.pkl",
      inputs: { topic: "decorators" },
    });
    const trainCompleted = new CrewTrainCompletedEvent({
      crewName: "ResearchCrew",
      crew,
      n_iterations: 2,
      filename: "train.pkl",
    });
    const trainFailed = new CrewTrainFailedEvent({
      crew,
      error: new Error("train failed"),
    });
    const testStarted = new CrewTestStartedEvent({
      crew,
      n_iterations: 3,
      eval_llm: "gpt-4.1",
      inputs: { topic: "decorators" },
    });
    const testCompleted = new CrewTestCompletedEvent({ crew });
    const testFailed = new CrewTestFailedEvent({ crew, error: "test failed" });

    expect(trainStarted).toMatchObject({
      type: "crew_train_started",
      sourceType: "crew",
      sourceFingerprint: "crew-fp",
      crew_name: "ResearchCrew",
      n_iterations: 2,
      filename: "train.pkl",
      inputs: { topic: "decorators" },
      fingerprint_metadata: { project: "research" },
    });
    expect(trainCompleted).toMatchObject({ type: "crew_train_completed", filename: "train.pkl" });
    expect(trainFailed).toMatchObject({ type: "crew_train_failed", error: "train failed" });
    expect(testStarted).toMatchObject({
      type: "crew_test_started",
      n_iterations: 3,
      eval_llm: "gpt-4.1",
    });
    expect(testCompleted).toMatchObject({ type: "crew_test_completed" });
    expect(testFailed).toMatchObject({ type: "crew_test_failed", error: "test failed" });
  });

  it("exposes tool selection and execution error events", () => {
    const agent = {
      fingerprint: {
        uuid_str: "agent-fp",
        metadata: { role: "research" },
      },
    };
    const selectionError = new ToolSelectionErrorEvent({
      toolName: "search",
      toolArgs: { query: "decorators" },
      toolClass: "SearchTool",
      error: new Error("tool not found"),
    });
    const executionError = new ToolExecutionErrorEvent({
      tool_name: "search",
      tool_args: { query: "decorators" },
      tool_class: function SearchTool() {
        return null;
      },
      agent,
      error: "timeout",
    });

    expect(selectionError).toMatchObject({
      type: "tool_selection_error",
      toolName: "search",
      toolArgs: { query: "decorators" },
      toolClass: "SearchTool",
      error: "tool not found",
    });
    expect(executionError).toMatchObject({
      type: "tool_execution_error",
      sourceType: "agent",
      sourceFingerprint: "agent-fp",
      tool_name: "search",
      tool_args: { query: "decorators" },
      error: "timeout",
      fingerprint_metadata: { role: "research" },
    });
  });

  it("exposes memory retrieval lifecycle events", () => {
    const started = new MemoryRetrievalStartedEvent({ task_id: "task-1" });
    const completed = new MemoryRetrievalCompletedEvent({
      task_id: "task-1",
      memory_content: "Relevant previous context",
      retrieval_time_ms: 12,
    });
    const failed = new MemoryRetrievalFailedEvent({
      task_id: "task-1",
      error: new Error("memory unavailable"),
    });

    expect(started).toMatchObject({ type: "memory_retrieval_started", task_id: "task-1" });
    expect(completed).toMatchObject({
      type: "memory_retrieval_completed",
      task_id: "task-1",
      memory_content: "Relevant previous context",
      retrieval_time_ms: 12,
    });
    expect(failed).toMatchObject({
      type: "memory_retrieval_failed",
      task_id: "task-1",
      error: "memory unavailable",
    });
  });

  it("exports memory query and save lifecycle event classes", () => {
    const queryStarted = new MemoryQueryStartedEvent({
      query: "decorators",
      limit: 3,
      scoreThreshold: 0.2,
    });
    const queryCompleted = new MemoryQueryCompletedEvent({
      query: "decorators",
      results: [{ id: "mem-1" }],
      limit: 3,
      scoreThreshold: 0.2,
      queryTimeMs: 5,
    });
    const queryFailed = new MemoryQueryFailedEvent({
      query: "decorators",
      limit: 3,
      error: new Error("query failed"),
    });
    const saveStarted = new MemorySaveStartedEvent({
      value: "Remember TS decorators",
      metadata: { topic: "decorators" },
      agentRole: "Researcher",
    });
    const saveCompleted = new MemorySaveCompletedEvent({
      value: "Remember TS decorators",
      saveTimeMs: 7,
    });
    const saveFailed = new MemorySaveFailedEvent({
      value: "Remember TS decorators",
      error: "save failed",
    });

    expect(queryStarted).toMatchObject({
      type: "memory_query_started",
      query: "decorators",
      limit: 3,
      scoreThreshold: 0.2,
    });
    expect(queryCompleted).toMatchObject({
      type: "memory_query_completed",
      results: [{ id: "mem-1" }],
      queryTimeMs: 5,
    });
    expect(queryFailed).toMatchObject({ type: "memory_query_failed", error: "query failed" });
    expect(saveStarted).toMatchObject({
      type: "memory_save_started",
      value: "Remember TS decorators",
      metadata: { topic: "decorators" },
      agentRole: "Researcher",
    });
    expect(saveCompleted).toMatchObject({
      type: "memory_save_completed",
      value: "Remember TS decorators",
      saveTimeMs: 7,
    });
    expect(saveFailed).toMatchObject({ type: "memory_save_failed", error: "save failed" });
  });
});

describe("agent and knowledge events", () => {
  it("exposes agent execution and evaluation events with upstream-compatible payload names", () => {
    const agent = {
      id: "agent-1",
      role: "Researcher",
      security_config: {
        fingerprint: {
          uuid_str: "fp-agent-1",
          metadata: { team: "research" },
        },
      },
    };
    const task = { id: "task-1", description: "Find sources" };
    const started = new AgentExecutionStartedEvent({
      agent,
      task,
      tools: [{ name: "search" }],
      task_prompt: "Find sources about decorators",
    });
    const completed = new AgentExecutionCompletedEvent({
      agent,
      task,
      output: "done",
    });
    const failed = new AgentExecutionErrorEvent({
      agent,
      task,
      error: new Error("execution failed"),
    });
    const evalStarted = new AgentEvaluationStartedEvent({
      agent_id: "agent-1",
      agent_role: "Researcher",
      task_id: "task-1",
      iteration: 1,
    });
    const evalCompleted = new AgentEvaluationCompletedEvent({
      agent_id: "agent-1",
      agent_role: "Researcher",
      task_id: "task-1",
      iteration: 1,
      metric_category: "quality",
      score: 0.9,
    });
    const evalFailed = new AgentEvaluationFailedEvent({
      agent_id: "agent-1",
      agent_role: "Researcher",
      iteration: 2,
      error: "bad metric",
    });

    expect(started).toMatchObject({
      type: "agent_execution_started",
      sourceType: "agent",
      sourceFingerprint: "fp-agent-1",
      task_prompt: "Find sources about decorators",
      fingerprint_metadata: { team: "research" },
    });
    expect(completed).toMatchObject({ type: "agent_execution_completed", output: "done" });
    expect(failed).toMatchObject({ type: "agent_execution_error", error: "execution failed" });
    expect(evalStarted).toMatchObject({
      type: "agent_evaluation_started",
      agent_id: "agent-1",
      agent_role: "Researcher",
      task_id: "task-1",
      iteration: 1,
    });
    expect(evalCompleted).toMatchObject({
      type: "agent_evaluation_completed",
      metric_category: "quality",
      score: 0.9,
    });
    expect(evalFailed).toMatchObject({
      type: "agent_evaluation_failed",
      task_id: null,
      error: "bad metric",
    });
  });

  it("exposes knowledge retrieval and query events with task and agent metadata", () => {
    const task = { id: "task-1", name: "Knowledge task" };
    const agent = { id: "agent-1", role: "Researcher" };
    const retrievalStarted = new KnowledgeRetrievalStartedEvent({ from_task: task, from_agent: agent });
    const retrievalCompleted = new KnowledgeRetrievalCompletedEvent({
      from_task: task,
      query: "standard decorators",
      retrieved_knowledge: "TS standard decorators do not support parameter decorators.",
    });
    const queryStarted = new KnowledgeQueryStartedEvent({
      task_prompt: "Explain decorator compatibility",
    });
    const queryCompleted = new KnowledgeQueryCompletedEvent({
      query: "decorator compatibility",
    });
    const queryFailed = new KnowledgeQueryFailedEvent({
      error: new Error("vector store unavailable"),
    });
    const searchFailed = new KnowledgeSearchQueryFailedEvent({
      query: "decorators",
      error: "embedding failed",
    });

    expect(retrievalStarted).toMatchObject({
      type: "knowledge_search_query_started",
      sourceType: "agent",
      sourceFingerprint: "agent-1",
      task_id: "task-1",
      task_name: "Knowledge task",
      agent_id: "agent-1",
      agent_role: "Researcher",
    });
    expect(retrievalCompleted).toMatchObject({
      type: "knowledge_search_query_completed",
      query: "standard decorators",
      retrieved_knowledge: "TS standard decorators do not support parameter decorators.",
    });
    expect(queryStarted).toMatchObject({
      type: "knowledge_query_started",
      task_prompt: "Explain decorator compatibility",
    });
    expect(queryCompleted).toMatchObject({ type: "knowledge_query_completed", query: "decorator compatibility" });
    expect(queryFailed).toMatchObject({ type: "knowledge_query_failed", error: "vector store unavailable" });
    expect(searchFailed).toMatchObject({ type: "knowledge_search_query_failed", query: "decorators", error: "embedding failed" });
  });
});

describe("llm events", () => {
  it("exposes LLM call and stream events with upstream-compatible payload names", () => {
    const task = { id: "task-1", name: "Task name", description: "Task description" };
    const agent = { id: "agent-1", role: "Researcher" };
    const started = new LLMCallStartedEvent({
      call_id: "call-1",
      model: "gpt-4.1",
      messages: [{ role: "user", content: "hi" }],
      tools: [{ type: "function", function: { name: "search" } }],
      available_functions: { search: () => "ok" },
      from_task: task,
      from_agent: agent,
    });
    const completed = new LLMCallCompletedEvent({
      call_id: "call-1",
      model: "gpt-4.1",
      response: { content: "done" },
      call_type: LLMCallType.LLM_CALL,
      usage: { total_tokens: 12 },
    });
    const failed = new LLMCallFailedEvent({
      call_id: "call-2",
      error: new Error("rate limited"),
    });
    const stream = new LLMStreamChunkEvent({
      call_id: "call-1",
      chunk: "partial",
      call_type: LLMCallType.TOOL_CALL,
      response_id: "resp-1",
      tool_call: {
        index: 0,
        id: "tool-1",
        type: "function",
        function: { name: "search", arguments: "{\"query\":\"x\"}" },
      },
    });
    const thinking = new LLMThinkingChunkEvent({
      call_id: "call-1",
      chunk: "reasoning",
      response_id: "resp-1",
    });

    expect(started).toMatchObject({
      type: "llm_call_started",
      sourceType: "agent",
      sourceFingerprint: "agent-1",
      call_id: "call-1",
      model: "gpt-4.1",
      task_id: "task-1",
      task_name: "Task name",
      agent_id: "agent-1",
      agent_role: "Researcher",
    });
    expect(completed).toMatchObject({
      type: "llm_call_completed",
      response: { content: "done" },
      call_type: "llm_call",
      usage: { total_tokens: 12 },
    });
    expect(failed).toMatchObject({ type: "llm_call_failed", error: "rate limited" });
    expect(stream).toMatchObject({
      type: "llm_stream_chunk",
      chunk: "partial",
      call_type: "tool_call",
      response_id: "resp-1",
      tool_call: { function: { name: "search" } },
    });
    expect(thinking).toMatchObject({
      type: "llm_thinking_chunk",
      chunk: "reasoning",
      response_id: "resp-1",
    });
  });

  it("accumulates streaming tool-call chunks by index", () => {
    const first = new AccumulatedToolArgs();
    first.accumulate({
      index: 0,
      id: "call-1",
      function: { name: "search", arguments: "{\"query\":" },
    });
    first.accumulate({
      index: 0,
      function: { arguments: "\"CrewAI\"}" },
    });
    const second = new AccumulatedToolArgs();
    second.accumulate({
      index: 1,
      id: "call-2",
      function: { name: "lookup", arguments: "{\"id\":\"42\"}" },
    });

    expect(first.toToolCall()).toEqual({
      id: "call-1",
      type: "function",
      index: 0,
      function: {
        name: "search",
        arguments: "{\"query\":\"CrewAI\"}",
      },
    });
    expect(AccumulatedToolArgs.toToolCalls({ 1: second, 0: first })).toEqual([
      first.toToolCall(),
      second.toToolCall(),
    ]);
    expect(AccumulatedToolArgs.fromStreamingChunks([
      { choices: [{ delta: { tool_calls: [{ index: 0, id: "call-3", function: { name: "summarize", arguments: "{\"topic\":" } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: "\"CrewAI\"}" } }] } }] },
    ])).toEqual([
      {
        id: "call-3",
        type: "function",
        index: 0,
        function: {
          name: "summarize",
          arguments: "{\"topic\":\"CrewAI\"}",
        },
      },
    ]);
  });

  it("exposes LLM guardrail events and normalizes function guardrails", () => {
    function validateOutput(): boolean {
      return true;
    }

    const started = new LLMGuardrailStartedEvent({
      guardrail: validateOutput,
      retry_count: 1,
    });
    const completed = new LLMGuardrailCompletedEvent({
      success: false,
      result: { valid: false },
      error: new Error("unsafe output"),
      retry_count: 2,
    });

    expect(started).toMatchObject({
      type: "llm_guardrail_started",
      guardrail_type: "function",
      guardrail_name: "validateOutput",
      retry_count: 1,
    });
    expect(String(started.guardrail)).toContain("validateOutput");
    expect(completed).toMatchObject({
      type: "llm_guardrail_completed",
      success: false,
      result: { valid: false },
      error: "unsafe output",
      retry_count: 2,
    });
  });
});

describe("a2a utilities", () => {
  it("exposes A2A lifecycle events with upstream-compatible payload names", () => {
    const task = { id: "task-local", name: "Local task", description: "fallback" };
    const agent = { id: "agent-local", role: "Researcher" };
    const started = new A2ADelegationStartedEvent({
      endpoint: "https://remote.example.com/a2a",
      task_description: "Research the market",
      from_task: task,
      from_agent: agent,
      agent_id: "remote-agent",
      context_id: "ctx-1",
      a2a_agent_name: "remote",
      agent_card: { name: "remote" },
      protocol_version: "0.3.0",
      provider: { organization: "Example" },
      skill_id: "research",
      metadata: { priority: "high" },
      extensions: ["urn:example:extension"],
    });
    const sent = new A2AMessageSentEvent({
      message: "hello",
      turn_number: 2,
      context_id: "ctx-1",
      message_id: "msg-1",
      is_multiturn: true,
      endpoint: "https://remote.example.com/a2a",
      from_agent: agent,
    });
    const response = new A2AResponseReceivedEvent({
      response: "done",
      turn_number: 2,
      status: A2ATaskState.completed,
      final: true,
    });
    const fetched = new A2AAgentCardFetchedEvent({
      endpoint: "https://remote.example.com/a2a",
      a2a_agent_name: "remote",
      cached: true,
      fetch_time_ms: 12,
    });
    const connectionError = new A2AConnectionErrorEvent({
      endpoint: "https://remote.example.com/a2a",
      error: new Error("connection refused"),
      error_type: "connection_refused",
      status_code: 503,
      operation: "send_message",
    });
    const contextCompleted = new A2AContextCompletedEvent({
      context_id: "ctx-1",
      total_tasks: 2,
      duration_seconds: 3.5,
    });

    expect(started).toMatchObject({
      type: "a2a_delegation_started",
      sourceType: "agent",
      sourceFingerprint: "agent-local",
      task_id: "task-local",
      task_name: "Local task",
      agent_role: "Researcher",
      agent_id: "remote-agent",
      endpoint: "https://remote.example.com/a2a",
      is_multiturn: false,
      turn_number: 1,
      metadata: { priority: "high" },
    });
    expect(started.fingerprint_metadata).toEqual({ agent_id: "agent-local", agent_role: "Researcher" });
    expect(sent).toMatchObject({
      type: "a2a_message_sent",
      agent_role: "Researcher",
      is_multiturn: true,
      turn_number: 2,
    });
    expect(response).toMatchObject({
      type: "a2a_response_received",
      response: "done",
      status: A2ATaskState.completed,
      final: true,
    });
    expect(fetched).toMatchObject({ cached: true, fetch_time_ms: 12 });
    expect(connectionError).toMatchObject({ error: "connection refused", error_type: "connection_refused" });
    expect(contextCompleted).toMatchObject({ context_id: "ctx-1", total_tasks: 2, duration_seconds: 3.5 });
  });

  it("routes A2A events through the typed event bus", () => {
    const events: A2ATransportNegotiatedEvent[] = [];
    crewaiEventBus.on("a2a_transport_negotiated", (_source, event) => {
      events.push(event);
    });

    crewaiEventBus.emit("test", new A2ATransportNegotiatedEvent({
      endpoint: "https://remote.example.com/a2a",
      negotiated_transport: A2ATransport.GRPC,
      negotiated_url: "https://remote.example.com/grpc",
      source: "client_preferred",
      client_supported_transports: [A2ATransport.JSONRPC, A2ATransport.GRPC],
      server_supported_transports: [A2ATransport.JSONRPC, A2ATransport.GRPC],
      server_preferred_transport: A2ATransport.JSONRPC,
      client_preferred_transport: A2ATransport.GRPC,
    }));

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "a2a_transport_negotiated",
      negotiated_transport: A2ATransport.GRPC,
      negotiated_url: "https://remote.example.com/grpc",
      source: "client_preferred",
    });
  });

  it("models A2A client and server transport configuration with aliases", () => {
    const transport = new ClientTransportConfig({
      supported: [A2ATransport.GRPC, A2ATransport.JSONRPC],
    });
    const client = new A2AClientConfig({
      endpoint: "https://remote.example.com/a2a",
      max_turns: 3,
      fail_fast: false,
      transport_protocol: A2ATransport.GRPC,
      supported_transports: [A2ATransport.GRPC, A2ATransport.HTTP_JSON],
      transport,
    });
    const server = new A2AServerConfig({
      host: "localhost",
      port: 9000,
      transport: new ServerTransportConfig({
        preferred: A2ATransport.GRPC,
        grpc: new GRPCServerConfig({ port: 50052, reflection_enabled: true }),
        jsonrpc: new JSONRPCServerConfig({ rpc_path: "/rpc" }),
      }),
    });

    expect(client.endpoint).toBe("https://remote.example.com/a2a");
    expect(client.maxTurns).toBe(3);
    expect(client.max_turns).toBe(3);
    expect(client.failFast).toBe(false);
    expect(client.transport.preferred).toBe(A2ATransport.GRPC);
    expect(client.transport.supported).toEqual([A2ATransport.GRPC, A2ATransport.HTTP_JSON]);
    expect(server.endpoint).toBe("http://localhost:9000");
    expect(server.transport.preferred).toBe(A2ATransport.GRPC);
    expect(server.transport.grpc?.reflection_enabled).toBe(true);
    expect(server.transport.jsonrpc.rpcPath).toBe("/rpc");
  });

  it("negotiates A2A transport by client preference, server preference, and fallback", () => {
    const agentCard = {
      name: "remote",
      url: "https://remote.example.com/a2a",
      preferred_transport: A2ATransport.JSONRPC,
      additional_interfaces: [
        { transport: A2ATransport.GRPC, url: "https://remote.example.com/grpc" },
        { transport: A2ATransport.HTTP_JSON, url: "https://remote.example.com/http" },
      ],
    };

    expect(negotiateTransport(agentCard, {
      client_supported_transports: [A2ATransport.JSONRPC, A2ATransport.GRPC],
      client_preferred_transport: A2ATransport.GRPC,
    })).toMatchObject({
      transport: A2ATransport.GRPC,
      url: "https://remote.example.com/grpc",
      source: "client_preferred",
    });
    expect(negotiateTransport(agentCard, {
      client_supported_transports: [A2ATransport.JSONRPC],
    })).toMatchObject({
      transport: A2ATransport.JSONRPC,
      url: "https://remote.example.com/a2a",
      source: "server_preferred",
    });
    expect(negotiateTransport(agentCard, {
      client_supported_transports: [A2ATransport.HTTP_JSON],
    })).toMatchObject({
      transport: A2ATransport.HTTP_JSON,
      url: "https://remote.example.com/http",
      source: "fallback",
    });
    expect(() => negotiateTransport(agentCard, {
      client_supported_transports: ["WEBSOCKET"],
    })).toThrow(TransportNegotiationError);
  });

  it("creates A2A JSON-RPC errors and renders templates", () => {
    const error = new InvalidParamsError({ param: "message", reason: "required" });
    expect(error.code).toBe(A2AErrorCode.INVALID_PARAMS);
    expect(error.toDict()).toEqual({
      code: A2AErrorCode.INVALID_PARAMS,
      message: "Invalid parameter 'message': required",
    });
    expect(new A2AError({ code: A2AErrorCode.TASK_TIMEOUT }).message).toBe("Task execution timed out");
    expect(createErrorResponse(A2AErrorCode.METHOD_NOT_FOUND, null, null, "req-1")).toEqual({
      jsonrpc: "2.0",
      error: {
        code: A2AErrorCode.METHOD_NOT_FOUND,
        message: "Method not found",
      },
      id: "req-1",
    });
    expect(isRetryableError(A2AErrorCode.RATE_LIMIT_EXCEEDED)).toBe(true);
    expect(renderA2ATemplate(AVAILABLE_AGENTS_TEMPLATE, {
      available_a2a_agents: "researcher",
    })).toContain("researcher");
  });

  it("applies A2A client auth schemes to headers and URLs", async () => {
    await expect(new BearerTokenAuth({ token: "token" }).applyAuth({ Accept: "application/json" }))
      .resolves.toEqual({ Accept: "application/json", Authorization: "Bearer token" });

    await expect(new HTTPBasicAuth({ username: "user", password: "pass" }).applyAuth())
      .resolves.toEqual({ Authorization: "Basic dXNlcjpwYXNz" });

    const headerKey = new APIKeyAuth({ api_key: "secret" });
    await expect(headerKey.apply_auth(null, {})).resolves.toEqual({ "X-API-Key": "secret" });

    const cookieKey = new APIKeyAuth({ apiKey: "cookie-secret", location: "cookie", name: "session" });
    await expect(cookieKey.applyAuth()).resolves.toEqual({ Cookie: "session=cookie-secret" });

    const queryKey = new APIKeyAuth({ apiKey: "query-secret", location: "query", name: "api_key" });
    expect(queryKey.applyToUrl("https://remote.example.com/a2a?x=1")).toBe("https://remote.example.com/a2a?x=1&api_key=query-secret");

    const tls = new TLSConfig({ client_cert_path: "/cert.pem", client_key_path: "/key.pem", ca_cert_path: "/ca.pem" });
    expect(tls.get_httpx_ssl_context()).toEqual({
      clientCertPath: "/cert.pem",
      clientKeyPath: "/key.pem",
      caCertPath: "/ca.pem",
    });
    expect(new TLSConfig({ verify: false }).getHttpxSslContext()).toBe(false);
  });

  it("fetches and caches OAuth2 client credentials tokens for A2A auth", async () => {
    const fetchImpl = vi.fn((url: string | URL | Request, init?: RequestInit) => {
      const requestUrl = url instanceof Request ? url.url : url.toString();
      const body = typeof init?.body === "string" ? init.body : "";
      expect(requestUrl).toBe("https://auth.example.com/token");
      expect(init?.method).toBe("POST");
      expect(body).toContain("grant_type=client_credentials");
      expect(body).toContain("scope=read%3Atools+write%3Atools");
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ access_token: "oauth-token", expires_in: 3600 }),
      } as Response);
    });
    const auth = new OAuth2ClientCredentials({
      token_url: "https://auth.example.com/token",
      client_id: "client",
      client_secret: "secret",
      scopes: ["read:tools", "write:tools"],
      fetch: fetchImpl,
    });

    await expect(auth.applyAuth({ Accept: "application/json" })).resolves.toEqual({
      Accept: "application/json",
      Authorization: "Bearer oauth-token",
    });
    await expect(auth.apply_auth(null, {})).resolves.toEqual({ Authorization: "Bearer oauth-token" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("authenticates A2A simple server tokens", async () => {
    const auth = new SimpleTokenAuth({ token: "expected" });
    await expect(auth.authenticate("expected")).resolves.toBeInstanceOf(AuthenticatedUser);
    await expect(auth.authenticate("expected")).resolves.toMatchObject({
      token: "expected",
      scheme: "simple_token",
    });
    await expect(auth.authenticate("wrong")).rejects.toMatchObject({
      statusCode: 401,
      detail: "Invalid or missing authentication credentials",
    });
    await expect(new SimpleTokenAuth().authenticate("anything")).rejects.toBeInstanceOf(A2AHTTPException);
  });

  it("authenticates A2A OIDC JWTs with JWKS validation", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const publicJwk = publicKey.export({ format: "jwk" });
    const now = Math.floor(Date.now() / 1000);
    const jwt = createTestJwt({
      header: { alg: "RS256", typ: "JWT", kid: "a2a-key" },
      payload: {
        exp: now + 60,
        iat: now,
        iss: "https://issuer.example.com",
        aud: "api",
        sub: "user-1",
      },
      privateKey,
    });
    const fetchImpl = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ keys: [{ ...publicJwk, kid: "a2a-key", alg: "RS256", use: "sig" }] }),
    } as Response));
    const auth = new OIDCAuth({
      issuer: "https://issuer.example.com/",
      audience: "api",
      fetch: fetchImpl,
    });

    await expect(auth.authenticate(jwt)).resolves.toMatchObject({
      token: jwt,
      scheme: "oidc",
      claims: { sub: "user-1" },
    });
    await expect(new OIDCAuth({
      issuer: "https://issuer.example.com",
      audience: "other",
      fetch: fetchImpl,
    }).authenticate(jwt)).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("extracts and processes A2A task state results structurally", () => {
    const completedTask = {
      id: "task-1",
      context_id: "ctx-1",
      status: {
        state: A2ATaskState.completed,
        message: {
          message_id: "msg-1",
          parts: [{ root: { kind: "text", text: "status result" } }],
        },
      },
      history: [
        { role: "agent", parts: [{ root: { kind: "text", text: "history result" } }] },
      ],
      artifacts: [
        { parts: [{ root: { kind: "text", text: "artifact result" } }] },
      ],
    };

    expect(extractTaskResultParts(completedTask)).toEqual(["status result", "artifact result"]);
    expect(processTaskState({
      a2a_task: completedTask,
      new_messages: [],
      agent_card: { name: "remote", url: "https://remote.example.com/a2a" },
      turn_number: 1,
      is_multiturn: false,
      agent_role: "Researcher",
    })).toMatchObject({
      status: A2ATaskState.completed,
      result: "status result artifact result",
      agent_card: { name: "remote", url: "https://remote.example.com/a2a" },
    });

    const inputRequired = {
      id: "task-2",
      context_id: "ctx-2",
      status: {
        state: A2ATaskState.input_required,
        message: {
          parts: [{ root: { kind: "text", text: "Need more detail" } }],
        },
      },
    };
    const inputResult = processTaskState({
      a2aTask: inputRequired,
      newMessages: [],
      agentCard: { name: "remote", url: "https://remote.example.com/a2a" },
    });
    expect(inputResult).toMatchObject({
      status: A2ATaskState.input_required,
      error: "Need more detail",
    });
    expect(inputResult?.history[0]?.role).toBe("agent");

    const pending = processTaskState({
      a2aTask: { status: { state: A2ATaskState.working } },
      newMessages: [],
      agentCard: { url: "https://remote.example.com/a2a" },
    });
    expect(pending).toBeNull();
  });

  it("returns task ids or immediate results from A2A send message streams", async () => {
    async function* messageStream() {
      await Promise.resolve();
      yield {
        role: "agent",
        message_id: "msg-1",
        parts: [{ root: { kind: "text", text: "immediate answer" } }],
      };
    }
    await expect(sendMessageAndGetTaskId({
      event_stream: messageStream(),
      new_messages: [],
      agent_card: { name: "remote", url: "https://remote.example.com/a2a" },
    })).resolves.toMatchObject({
      status: A2ATaskState.completed,
      result: "immediate answer",
    });

    async function* taskStream() {
      await Promise.resolve();
      yield [{ id: "task-3", status: { state: A2ATaskState.working } }, null] as const;
    }
    await expect(sendMessageAndGetTaskId({
      eventStream: taskStream(),
      newMessages: [],
      agentCard: { name: "remote", url: "https://remote.example.com/a2a" },
    })).resolves.toBe("task-3");

    expect(extractErrorMessage({
      status: { state: A2ATaskState.failed },
      history: [{ role: "agent", parts: [{ root: { kind: "text", text: "failed detail" } }] }],
    }, "default")).toBe("failed detail");
  });
});

describe("agent utility helpers", () => {
  it("converts tools to OpenAI strict function schemas with sanitized unique names", async () => {
    const search = new StructuredTool({
      name: "Search Tool",
      description: [
        "Tool Name: search_tool",
        "Tool Arguments: {}",
        "Tool Description: Search primary sources",
      ].join("\n"),
      argsSchema: {
        query: { type: "string", description: "Search query", required: true },
        limit: { type: "number", description: "Maximum results", default: 5 },
      },
      func: (args) => `searched ${String(args.query)}`,
    });
    const duplicate = new StructuredTool({
      name: "Search Tool",
      description: "Search again",
      argsSchema: {
        query: { type: "string", required: true },
      },
      func: () => "duplicate",
    });

    const [schemas, availableFunctions, mapping] = convertToolsToOpenAISchema([search, duplicate]);

    expect(getToolNames([search, duplicate])).toBe("search_tool, search_tool");
    expect(renderTextDescriptionAndArgs([search, duplicate])).toContain("Search primary sources");
    expect(Object.keys(availableFunctions)).toEqual(["search_tool", "search_tool_2"]);
    expect(mapping.search_tool).toBe(search);
    expect(mapping.search_tool_2).toBe(duplicate);
    expect(schemas[0]).toEqual({
      type: "function",
      function: {
        name: "search_tool",
        description: "Search primary sources",
        strict: true,
        parameters: {
          type: "object",
          additionalProperties: false,
          required: ["query", "limit"],
          properties: {
            query: { type: "string", description: "Search query" },
            limit: { type: "number", description: "Maximum results" },
          },
        },
      },
    });
    expect(await availableFunctions.search_tool?.({ query: "CrewAI" })).toBe("searched CrewAI");
  });

  it("formats LLM messages and extracts enriched task sections", () => {
    expect(formatMessageForLLM("hello\n\n", "assistant")).toEqual({ role: "assistant", content: "hello" });
    expect(hasReachedMaxIterations(3, 3)).toBe(true);
    expect(hasReachedMaxIterations(2, 3)).toBe(false);
    expect(extractTaskSection("Intro\n## Task\nResearch CrewAI\n---\n## Instructions\nUse sources")).toBe("Research CrewAI");
    expect(extractTaskSection("x".repeat(2005))).toBe(`${"x".repeat(2000)}\n... [truncated]`);
  });

  it("parses ReAct agent output and normalizes string tool calls", async () => {
    const parsedAction = parseAgentOutput([
      "Thought: I should search",
      "Action: **Search Tool**",
      "Action Input: {query: 'CrewAI', limit: 2}",
    ].join("\n"));
    expect(parsedAction).toBeInstanceOf(AgentAction);
    expect(parsedAction).toMatchObject({
      thought: "Thought: I should search",
      tool: "Search Tool",
      toolInput: JSON.stringify({ query: "CrewAI", limit: 2 }),
    });

    const parsedFinish = parseAgentOutput("Thought: done\nFinal Answer: Complete\n```");
    expect(parsedFinish).toBeInstanceOf(AgentFinish);
    expect(parsedFinish).toMatchObject({ output: "Complete" });
    expect(() => parseAgentOutput("Thought: I should search")).toThrow(OutputParserError);

    const seenArgs: Record<string, unknown>[] = [];
    const search = new StructuredTool({
      name: "Search Tool",
      description: "Search",
      argsSchema: {
        query: { type: "string", required: true },
      },
      func: (args) => {
        seenArgs.push(args);
        return "search result";
      },
    });
    let calls = 0;
    const agentInstance = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      tools: [search],
      llm: () => {
        calls += 1;
        return calls === 1
          ? "Thought: need data\nAction: Search Tool\nAction Input: {query: 'CrewAI'}"
          : "final answer";
      },
    });
    const output = await agentInstance.kickoff("Research CrewAI");

    expect(seenArgs).toEqual([{ query: "CrewAI" }]);
    expect(output).toBe("final answer");
  });
});

describe("evaluator utilities", () => {
  it("scores goal alignment and semantic quality evaluator responses", async () => {
    const messages: LLMMessage[][] = [];
    const llm = (input: readonly LLMMessage[]) => {
      messages.push([...input]);
      return JSON.stringify({ score: 8.25, feedback: "Directly satisfies the requested summary." });
    };
    const agentInstance = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      llm,
    });
    const taskInstance = new Task({
      description: "Summarize CrewAI",
      expectedOutput: "A concise summary",
      agent: agentInstance,
    });

    const goalResult = await new GoalAlignmentEvaluator(llm).evaluate(agentInstance, {}, "CrewAI summary", taskInstance);
    const semanticResult = await new SemanticQualityEvaluator(llm).evaluate(agentInstance, {}, "CrewAI summary", taskInstance);

    expect(goalResult).toMatchObject({
      score: 8.25,
      feedback: "Directly satisfies the requested summary.",
      rawResponse: "{\"score\":8.25,\"feedback\":\"Directly satisfies the requested summary.\"}",
      raw_response: "{\"score\":8.25,\"feedback\":\"Directly satisfies the requested summary.\"}",
    });
    expect(semanticResult).toMatchObject({
      score: 8.25,
      feedback: "Directly satisfies the requested summary.",
    });
    expect(messages[0]?.[0]?.content).toContain("goal alignment");
    expect(messages[0]?.[1]?.content).toContain("Expected output: A concise summary");
    expect(messages[1]?.[0]?.content).toContain("semantic quality");
  });

  it("aggregates agent evaluation results with display formatter parity", () => {
    const formatter = new EvaluationDisplayFormatter();
    const aggregated = formatter.aggregateAgentResults({
      agentId: "agent-1",
      agentRole: "Researcher",
      results: [
        new AgentEvaluationResult({
          agentId: "agent-1",
          taskId: "task-1",
          metrics: {
            goal_alignment: new EvaluationScore({ score: 8, feedback: "clear goal match" }),
            semantic_quality: new EvaluationScore({ score: 6, feedback: "usable but terse" }),
          },
        }),
        new AgentEvaluationResult({
          agentId: "agent-1",
          taskId: "task-2",
          metrics: {
            goal_alignment: new EvaluationScore({ score: 10, feedback: "fully covered" }),
            semantic_quality: new EvaluationScore({ score: null, feedback: "not applicable" }),
          },
        }),
      ],
    });

    expect(aggregated).toMatchObject({
      agentId: "agent-1",
      agentRole: "Researcher",
      taskCount: 2,
      taskResults: ["task-1", "task-2"],
      overallScore: 7.5,
    });
    expect(aggregated.metrics.get("goal_alignment")).toMatchObject({
      score: 9,
      feedback: "Feedback 1: clear goal match\n\nFeedback 2: fully covered",
    });
    expect(aggregated.metrics.get("semantic_quality")).toMatchObject({
      score: 6,
      feedback: "Feedback 1: usable but terse\n\nFeedback 2: not applicable",
    });
  });

  it("emits agent evaluation lifecycle events for metric evaluators", () => {
    const events: Array<AgentEvaluationStartedEvent | AgentEvaluationCompletedEvent | AgentEvaluationFailedEvent> = [];
    const offStarted = crewaiEventBus.on("agent_evaluation_started", (_source, event) => {
      events.push(event);
    });
    const offCompleted = crewaiEventBus.on("agent_evaluation_completed", (_source, event) => {
      events.push(event);
    });
    const offFailed = crewaiEventBus.on("agent_evaluation_failed", (_source, event) => {
      events.push(event);
    });
    const agentInstance = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      llm: () => "done",
    });
    const taskInstance = new Task({
      description: "Summarize CrewAI",
      expectedOutput: "A concise summary",
      agent: agentInstance,
    });

    try {
      const result = new AgentEvaluator([agentInstance], [new ToolSelectionEvaluator()]).evaluate({
        agent: agentInstance,
        task: taskInstance,
        executionTrace: { tool_uses: [{ tool: "search" }] },
        finalOutput: "CrewAI summary",
      });

      expect(result.metrics.get("tool_selection")).toMatchObject({ score: 5 });
      expect(events.map((event) => event.type)).toEqual([
        "agent_evaluation_started",
        "agent_evaluation_completed",
      ]);
      expect(events[0]).toMatchObject({
        agent_role: "Researcher",
        agent_id: "",
        task_id: taskInstance.id,
        iteration: 1,
      });
      expect((events[1] as AgentEvaluationCompletedEvent).metric_category).toBe("tool_selection");
    } finally {
      offStarted();
      offCompleted();
      offFailed();
    }
  });

  it("collects evaluation traces from event bus listener hooks", () => {
    const callback = create_evaluation_callbacks();
    const agent = { id: "agent-1", role: "Researcher", goal: "Find facts" };
    const task = { id: "task-1", description: "Summarize CrewAI" };

    crewaiEventBus.emit(null, new AgentExecutionStartedEvent({
      agent,
      task,
      tools: [{ name: "search" }],
      taskPrompt: "Summarize CrewAI",
    }));
    crewaiEventBus.emit(null, new LLMCallStartedEvent({
      messages: [{ role: "user", content: "Summarize CrewAI" }],
      tools: [{ name: "search" }],
      call_id: "call-1",
      model: "demo/model",
    }));
    crewaiEventBus.emit(null, new LLMCallCompletedEvent({
      messages: [{ role: "user", content: "Summarize CrewAI" }],
      response: { text: "Need search", usage: { total_tokens: 7 } },
      usage: { total_tokens: 7 },
      call_type: LLMCallType.LLM_CALL,
      call_id: "call-1",
      model: "demo/model",
    }));
    crewaiEventBus.emit(null, new ToolUsageFinishedEvent({
      toolName: "Search",
      toolArgs: { query: "CrewAI" },
      startedAt: new Date("2026-01-01T00:00:00.000Z"),
      output: "result",
    }));
    crewaiEventBus.emit(null, new ToolValidateInputErrorEvent({
      toolName: "Search",
      toolArgs: "{bad json",
      error: "invalid input",
    }));
    crewaiEventBus.emit(null, new AgentExecutionCompletedEvent({
      agent,
      task,
      output: "final summary",
    }));

    const trace = callback.get_trace("agent-1", "task-1");

    expect(trace).toMatchObject({
      agent_id: "agent-1",
      task_id: "task-1",
      final_output: "final summary",
    });
    expect(trace.tool_uses).toEqual([
      expect.objectContaining({
        tool: "Search",
        args: { query: "CrewAI" },
        result: "result",
        success: true,
      }),
      expect.objectContaining({
        tool: "Search",
        args: "{bad json",
        result: "invalid input",
        success: false,
        error: true,
        error_type: "validation_error",
      }),
    ]);
    expect(trace.llm_calls).toEqual([
      expect.objectContaining({
        messages: [{ role: "user", content: "Summarize CrewAI" }],
        response: { text: "Need search", usage: { total_tokens: 7 } },
        total_tokens: 7,
      }),
    ]);
  });

  it("evaluates task output into structured quality suggestions and emits events", async () => {
    const events: TaskEvaluationEvent[] = [];
    crewaiEventBus.on("task_evaluation", (_source, event) => {
      events.push(event);
    });
    const calls: LLMMessage[][] = [];
    const originalAgent = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      llm: (messages) => {
        calls.push([...messages]);
        return JSON.stringify({
          suggestions: ["Cite sources"],
          quality: 8.5,
          entities: [
            {
              name: "CrewAI",
              type: "project",
              description: "Agent framework",
              relationships: ["TypeScript port"],
            },
          ],
        });
      },
    });
    const taskInstance = new Task({
      description: "Summarize CrewAI",
      expectedOutput: "A concise summary",
      agent: originalAgent,
    });

    const result = await new TaskEvaluator(originalAgent).evaluate(taskInstance, "CrewAI summary");

    expect(result).toEqual({
      suggestions: ["Cite sources"],
      quality: 8.5,
      entities: [
        {
          name: "CrewAI",
          type: "project",
          description: "Agent framework",
          relationships: ["TypeScript port"],
        },
      ],
    });
    expect(calls[0]?.[0]?.content).toContain("Format your final answer according to the following OpenAPI schema");
    expect(calls[0]?.[1]?.content).toContain("Task Description:\nSummarize CrewAI");
    expect(events[0]?.evaluationType).toBe("task_evaluation");
  });

  it("evaluates training data and reports broken training records", async () => {
    const originalAgent = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      llm: () => JSON.stringify({
        suggestions: ["Use the human correction"],
        quality: 7,
        final_summary: "Apply feedback before finalizing.",
      }),
    });
    const evaluator = new TaskEvaluator({ original_agent: originalAgent });

    await expect(evaluator.evaluateTrainingData({
      researcher: {
        "0": {
          initial_output: "old",
          human_feedback: "add source",
          improved_output: "new with source",
        },
      },
    }, "researcher")).resolves.toMatchObject({
      suggestions: ["Use the human correction"],
      quality: 7,
      final_summary: "Apply feedback before finalizing.",
      finalSummary: "Apply feedback before finalizing.",
    });

    await expect(evaluator.evaluate_training_data({
      researcher: {
        "0": {
          initial_output: "old",
          improved_output: "new",
        },
      },
    }, "researcher")).rejects.toThrow("Missing fields (human_feedback)");
  });

  it("attaches crew evaluator callbacks and accumulates task scores", async () => {
    const events: CrewTestResultEvent[] = [];
    crewaiEventBus.on("crew_test_result", (_source, event) => {
      events.push(event);
    });
    const writer = new Agent({
      role: "Writer",
      goal: "Write reports",
      backstory: "Careful analyst",
      llm: () => "task output",
    });
    const taskInstance = new Task({
      description: "Write report",
      expectedOutput: "Report",
      agent: writer,
    });
    const crewInstance = new Crew({
      agents: [writer],
      tasks: [taskInstance],
      taskOutputStorageHandler: null,
    });
    const evaluator = new CrewEvaluator({
      crew: crewInstance,
      llm: () => JSON.stringify({ quality: 9.5 }),
    });

    await crewInstance.kickoff();

    expect(evaluator.tasksScores[0]).toEqual([9.5]);
    expect(events[0]).toBeInstanceOf(CrewTestResultEvent);
    expect(events[0]?.quality).toBe(9.5);
    expect(evaluator.printCrewEvaluationResult()).toContain("Task 1");
  });
});

describe("telemetry compatibility", () => {
  it("records task, tool, flow, and feature spans without network exporters", () => {
    const telemetry = new Telemetry();
    telemetry.clearSpans();
    const crew = {
      id: "crew-1",
      key: "crew-key",
      process: "sequential",
      memory: false,
      share_crew: true,
      agents: [{ id: "agent-1", key: "agent-key", role: "Researcher", goal: "Find facts", backstory: "Careful", tools: [] }],
      tasks: [],
    };
    const taskRecord = {
      id: "task-1",
      key: "task-key",
      description: "Summarize CrewAI",
      expectedOutput: "A summary",
      expected_output: "A summary",
      agent: { id: "agent-1", role: "Researcher", fingerprint: { uuid_str: "agent-fp" } },
      output: { raw: "final task output" },
      fingerprint: { uuid_str: "task-fp", created_at: new Date("2026-01-01T00:00:00.000Z"), metadata: { kind: "demo" } },
    };

    const executionSpan = telemetry.task_started(crew, taskRecord);
    telemetry.task_ended(executionSpan, taskRecord, crew);
    telemetry.tool_usage({ model: "demo-model" }, "Search Tool", 2, taskRecord.agent);
    telemetry.tool_usage_error({ model: "demo-model" }, taskRecord.agent, "Search Tool");
    telemetry.flow_creation_span("ResearchFlow");
    telemetry.flow_plotting_span("ResearchFlow", ["start", "finish"]);
    telemetry.flow_execution_span("ResearchFlow", ["start"]);
    telemetry.human_feedback_span("received", true, 2, true, "approved");
    telemetry.feature_usage_span("planning:creation");
    telemetry.template_installed_span("starter");

    const spans = telemetry.getSpans();

    expect(spans.map((span) => span.name)).toEqual([
      "Task Created",
      "Task Execution",
      "Tool Usage",
      "Tool Usage Error",
      "Flow Creation",
      "Flow Plotting",
      "Flow Execution",
      "Human Feedback",
      "Feature Usage",
      "Template Installed",
    ]);
    expect(spans[0]?.attributes).toMatchObject({
      crew_id: "crew-1",
      task_id: "task-1",
      task_fingerprint: "task-fp",
      agent_fingerprint: "agent-fp",
      formatted_description: "Summarize CrewAI",
    });
    expect(spans[1]?.attributes).toMatchObject({
      task_output: "final task output",
    });
    expect(spans[1]?.ended).toBe(true);
    expect(spans[2]?.attributes).toMatchObject({
      tool_name: "Search Tool",
      attempts: 2,
      llm: "demo-model",
      agent_role: "Researcher",
    });
    expect(spans[5]?.attributes.node_names).toBe("[\"start\",\"finish\"]");
    expect(spans[7]?.attributes).toMatchObject({
      event_type: "received",
      has_routing: true,
      num_outcomes: 2,
      feedback_provided: true,
      outcome: "approved",
    });
    expect(spans[8]?.attributes.feature).toBe("planning:creation");
    expect(spans[9]?.attributes.template_name).toBe("starter");
  });
});

describe("config and token counter utilities", () => {
  it("marks and strips provider-agnostic LLM cache breakpoints", () => {
    const original: LLMMessage = {
      role: "system",
      content: "Stable system prompt",
    };

    const marked = mark_cache_breakpoint(original);

    expect(marked).toEqual({
      role: "system",
      content: "Stable system prompt",
      cache_breakpoint: true,
    });
    expect(marked).not.toBe(original);
    expect(CACHE_BREAKPOINT_KEY).toBe("cache_breakpoint");

    strip_cache_breakpoint(marked);
    expect(marked).toEqual({
      role: "system",
      content: "Stable system prompt",
    });
  });

  it("merges config values only for model fields without explicit values", () => {
    const values = {
      role: null,
      goal: "explicit goal",
      nested: { existing: true },
      config: {
        role: "Researcher",
        goal: "from config",
        nested: { configured: true },
        ignored: "no model field",
      },
    };

    expect(processConfig(values, {
      modelFields: {
        role: true,
        goal: true,
        nested: true,
      },
    })).toEqual({
      role: "Researcher",
      goal: "explicit goal",
      nested: { existing: true },
    });
  });

  it("tracks token usage from litellm-style success callbacks", () => {
    const calls: Record<string, number> = {};
    const handler = new TokenCalcHandler({
      sum_successful_requests: (value) => {
        calls.successful = (calls.successful ?? 0) + value;
      },
      sum_prompt_tokens: (value) => {
        calls.prompt = (calls.prompt ?? 0) + value;
      },
      sum_completion_tokens: (value) => {
        calls.completion = (calls.completion ?? 0) + value;
      },
      sum_cached_prompt_tokens: (value) => {
        calls.cached = (calls.cached ?? 0) + value;
      },
    });

    handler.log_success_event({}, {
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        prompt_tokens_details: { cached_tokens: 3 },
      },
    }, 0, 1);

    expect(calls).toEqual({
      successful: 1,
      prompt: 10,
      completion: 5,
      cached: 3,
    });
    new TokenCalcHandler().logSuccessEvent({}, { usage: { prompt_tokens: 1 } }, 0, 1);
  });
});

describe("converter utilities", () => {
  const summaryModel = {
    name: "Summary",
    schema: {
      type: "object",
      properties: { summary: { type: "string" } },
      required: ["summary"],
    },
    modelValidate(value: unknown) {
      if (!value || typeof value !== "object" || typeof (value as { summary?: unknown }).summary !== "string") {
        throw new Error("summary is required");
      }
      return { summary: (value as { summary: string }).summary };
    },
  };

  it("validates full and partial JSON into structured model outputs", () => {
    expect(validateModel("{\"summary\":\"done\"}", summaryModel, false)).toEqual({ summary: "done" });
    expect(validateModel("{\"summary\":\"done\"}", summaryModel, true)).toEqual({ summary: "done" });
    expect(handlePartialJson("prefix {\"summary\":\"partial\"} suffix", summaryModel, true, null))
      .toEqual({ summary: "partial" });
    expect(convertToModel("{\"summary\":\"direct\"}", null, summaryModel)).toEqual({ summary: "direct" });
    expect(convertToModel("no json here", null, summaryModel)).toBe("no json here");
  });

  it("converts via LLM-backed Converter with retries", async () => {
    let calls = 0;
    const converter = new Converter({
      text: "summarize",
      model: summaryModel,
      instructions: "Return JSON",
      llm: {
        call(messages, options) {
          calls += 1;
          expect(messages[0]?.content).toBe("Return JSON");
          expect(options?.responseModel).toBe(summaryModel);
          if (calls === 1) {
            throw new Error("temporary");
          }
          return "{\"summary\":\"converted\"}";
        },
      },
      maxAttempts: 2,
    });

    await expect(converter.to_pydantic()).resolves.toEqual({ summary: "converted" });
    await expect(converter.to_json()).resolves.toBe("{\"summary\":\"converted\"}");
    expect(calls).toBe(3);

    const failing = new Converter({
      text: "bad",
      model: summaryModel,
      instructions: "Return JSON",
      llm: { call: () => "not json" },
      maxAttempts: 1,
    });
    await expect(failing.toPydantic()).rejects.toThrow(ConverterError);
  });

  it("falls back to agent LLM instructions for async partial JSON conversion", async () => {
    const seenTexts: string[] = [];
    const result = await asyncConvertToModel(
      "summary: converted through fallback",
      null,
      summaryModel,
      {
        llm: {
          call(messages, options) {
            seenTexts.push(messages[1]?.content ?? "");
            expect(options?.responseModel).toBe(summaryModel);
            return "{\"summary\":\"fallback converted\"}";
          },
        },
      },
    );

    expect(result).toEqual({ summary: "fallback converted" });
    expect(seenTexts).toEqual(["summary: converted through fallback"]);
  });
});

describe("crew chat utilities", () => {
  it("builds chat input models and OpenAI-compatible tool schemas", () => {
    const inputs = new ChatInputs({
      crew_name: "research_crew",
      crew_description: "Research topics",
      inputs: [
        new ChatInputField({ name: "topic", description: "Topic to research" }),
        { name: "audience", description: "Target audience" },
      ],
    });

    expect(inputs.crewName).toBe("research_crew");
    expect(inputs.crew_description).toBe("Research topics");
    expect(buildSystemMessage(inputs)).toContain("topic (desc: Topic to research)");
    expect(generateCrewToolSchema(inputs)).toEqual({
      type: "function",
      function: {
        name: "research_crew",
        description: "Research topics",
        parameters: {
          type: "object",
          properties: {
            topic: { type: "string", description: "Topic to research" },
            audience: { type: "string", description: "Target audience" },
          },
          required: ["topic", "audience"],
        },
      },
    });
  });

  it("discovers required crew chat inputs from task and agent placeholders", () => {
    const agentInstance = new Agent({
      role: "Researcher for {audience}",
      goal: "Explain {topic}",
      backstory: "Writes in {tone}",
    });
    const taskInstance = new Task({
      description: "Research {topic}",
      expectedOutput: "Report for {audience}",
      agent: agentInstance,
    });
    const crewInstance = new Crew({ agents: [agentInstance], tasks: [taskInstance] });

    expect([...crewInstance.fetch_inputs()].sort()).toEqual(["audience", "tone", "topic"]);
    expect([...fetchRequiredInputs(crewInstance)].sort()).toEqual(["audience", "tone", "topic"]);
  });

  it("generates static crew chat inputs without blocking on an LLM", async () => {
    const agentInstance = new Agent({
      role: "Researcher",
      goal: "Explain {topic}",
      backstory: "Careful analyst",
    });
    const taskInstance = new Task({
      description: "Research {topic}",
      expectedOutput: "A concise brief",
      agent: agentInstance,
    });
    const crewInstance = new Crew({ agents: [agentInstance], tasks: [taskInstance] });

    const inputs = await generateCrewChatInputs(
      crewInstance,
      "research_crew",
      () => {
        throw new Error("LLM should not be called.");
      },
      { generate_descriptions: false },
    );

    expect(inputs.crewName).toBe("research_crew");
    expect(inputs.crewDescription).toBe(DEFAULT_CREW_DESCRIPTION);
    expect(inputs.inputs).toEqual([
      new ChatInputField({ name: "topic", description: DEFAULT_INPUT_DESCRIPTION }),
    ]);
  });

  it("uses the chat LLM to describe crew chat inputs and falls back on LLM failures", async () => {
    const prompts: string[] = [];
    const agentInstance = new Agent({
      role: "Researcher",
      goal: "Explain {topic}",
      backstory: "Careful analyst",
    });
    const taskInstance = new Task({
      description: "Research {topic}",
      expectedOutput: "A concise brief",
      agent: agentInstance,
    });
    const crewInstance = new Crew({ agents: [agentInstance], tasks: [taskInstance] });
    const llm = (messages: readonly LLMMessage[]) => {
      prompts.push(messages.at(-1)?.content ?? "");
      return prompts.length === 1 ? "Research subject" : "Research concise briefs";
    };

    await expect(generateInputDescriptionWithAi("missing", crewInstance, llm)).rejects.toThrow("No context found");
    await expect(generateInputDescriptionWithAi("topic", crewInstance, () => {
      throw new Error("offline");
    })).resolves.toBe(DEFAULT_INPUT_DESCRIPTION);
    await expect(generateCrewDescriptionWithAi(crewInstance, () => {
      throw new Error("offline");
    })).resolves.toBe(DEFAULT_CREW_DESCRIPTION);

    const inputs = await generateCrewChatInputs(crewInstance, "research_crew", llm);

    expect(inputs.inputs[0]?.description).toBe("Research subject");
    expect(inputs.crewDescription).toBe("Research concise briefs");
    expect(prompts[0]).toContain("input 'topic'");
    expect(prompts[1]).toContain("crew's purpose");
  });

  it("runs crews from chat tool wrappers with serialized chat messages", async () => {
    const seenInputs: InputValues[] = [];
    const agentInstance = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      llm: (messages) => `done: ${messages.at(-1)?.content ?? ""}`,
    });
    const taskInstance = new Task({
      description: "Research {topic}",
      expectedOutput: "Answer",
      agent: agentInstance,
    });
    const crewInstance = new Crew({
      agents: [agentInstance],
      tasks: [taskInstance],
      chat_llm: "gpt-4o-mini",
      beforeKickoffCallbacks: [(inputs) => {
        seenInputs.push(inputs);
        return inputs;
      }],
    });
    const messages: LLMMessage[] = [{ role: "user", content: "topic is CrewAI" }];

    await expect(runCrewTool(crewInstance, messages, { topic: "CrewAI" })).resolves.toContain("Research CrewAI");
    await expect(createToolFunction(crewInstance, messages)({ topic: "TS" })).resolves.toContain("Research TS");
    expect(crewInstance.chatLlm).toBe("gpt-4o-mini");
    expect(seenInputs[0]?.crew_chat_messages).toBe(JSON.stringify(messages));
  });

  it("passes crew chat tool schema and functions through user input handling", async () => {
    const messages: LLMMessage[] = [];
    const toolSchema = generateCrewToolSchema(new ChatInputs({
      crew_name: "research_crew",
      crew_description: "Research topics",
      inputs: [new ChatInputField({ name: "topic", description: "Topic to research" })],
    }));
    const availableFunctions = {
      research_crew: () => "crew result",
    };
    const seenOptions: LLMCallOptions[] = [];

    await handleUserInput(
      "Please research CrewAI",
      {
        call: (_messages: readonly LLMMessage[], options?: LLMCallOptions) => {
          seenOptions.push(options ?? {});
          return "Calling the crew now.";
        },
      },
      messages,
      toolSchema,
      availableFunctions,
    );

    expect(seenOptions[0]?.tools).toEqual([toolSchema]);
    expect(seenOptions[0]?.availableFunctions).toBe(availableFunctions);
    expect(messages).toEqual([
      { role: "user", content: "Please research CrewAI" },
      { role: "assistant", content: "Calling the crew now." },
    ]);
  });

  it("checks conversational crew version compatibility", () => {
    expect(checkConversationalCrewsVersion("0.98.0")).toBe(true);
    expect(checkConversationalCrewsVersion("1.2.3")).toBe(true);
    expect(checkConversationalCrewsVersion("0.97.9")).toBe(false);
  });
});

describe("execution and event context", () => {
  it("captures task, platform, event, and triggering context across async boundaries", async () => {
    const previousTaskId = setCurrentTaskId("outer-task");
    setLastEventId("previous-event");

    const captured = await platformContext("platform-token", async () => {
      return await triggeredByScope("trigger-event", async () => {
        await Promise.resolve();
        return captureExecutionContext({ callback: true });
      });
    });

    expect(captured.currentTaskId).toBe("outer-task");
    expect(captured.lastEventId).toBe("previous-event");
    expect(captured.triggeringEventId).toBe("trigger-event");
    expect(captured.platformToken).toBe("platform-token");
    expect(captured.feedbackCallbackInfo).toEqual({ callback: true });
    expect(getPlatformIntegrationToken()).toBeNull();
    expect(getTriggeringEventId()).toBeNull();

    setCurrentTaskId(previousTaskId);
  });

  it("isolates execution contexts with runWithExecutionContext", async () => {
    setCurrentTaskId("default-task");

    const nested = await runWithExecutionContext({ currentTaskId: "isolated-task" }, async () => {
      await Promise.resolve();
      return getCurrentTaskId();
    });

    expect(nested).toBe("isolated-task");
    expect(getCurrentTaskId()).toBe("default-task");
  });

  it("links emitted events with parent, previous, triggering, and started event ids", async () => {
    const events: CrewAIEvent[] = [];
    const eventTypes = [
      "crew_kickoff_started",
      "task_started",
      "task_completed",
      "crew_kickoff_completed",
    ] as const;
    for (const eventType of eventTypes) {
      crewaiEventBus.on(eventType, (_source, event) => {
        events.push(event);
      });
    }

    const agentInstance = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      llm: () => "final answer",
    });
    const taskInstance = new Task({
      description: "Research",
      expectedOutput: "Answer",
      agent: agentInstance,
    });
    const lastEventInsideScope = await triggeredByScope("manual-trigger", async () => {
      await new Crew({ agents: [agentInstance], tasks: [taskInstance] }).kickoff();
      return getLastEventId();
    });

    const [crewStarted, taskStarted, taskCompleted, crewCompleted] = events;
    expect(crewStarted?.parentEventId).toBeNull();
    expect(crewStarted?.triggeredByEventId).toBe("manual-trigger");
    expect(taskStarted?.parentEventId).toBe(crewStarted?.eventId);
    expect(taskStarted?.previousEventId).toBe(crewStarted?.eventId);
    expect(taskCompleted?.parentEventId).toBe(taskStarted?.eventId);
    expect(taskCompleted?.startedEventId).toBe(taskStarted?.eventId);
    expect(crewCompleted?.parentEventId).toBe(crewStarted?.eventId);
    expect(crewCompleted?.startedEventId).toBe(crewStarted?.eventId);
    expect(lastEventInsideScope).toBe(crewCompleted?.eventId);
    expect(getCurrentParentId()).toBeNull();
    expect(getLastEventId()).toBeNull();
  });
});

type FakeDocument = {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
};

class FakeChromaCollection {
  readonly documents = new Map<string, FakeDocument>();

  upsert(options: { ids: readonly string[]; documents: readonly string[]; metadatas?: readonly Record<string, unknown>[] }): void {
    options.ids.forEach((id, index) => {
      this.documents.set(id, {
        id,
        content: options.documents[index] ?? "",
        metadata: options.metadatas?.[index] ?? {},
      });
    });
  }

  query(options: { query_texts: readonly string[]; n_results: number; where?: Record<string, unknown> | null }): {
    ids: string[][];
    documents: string[][];
    metadatas: Record<string, unknown>[][];
    distances: number[][];
  } {
    const query = options.query_texts[0] ?? "";
    const matches = [...this.documents.values()]
      .filter((document) => metadataMatches(document.metadata, options.where ?? null))
      .map((document) => ({ ...document, distance: document.content.toLowerCase().includes(query.toLowerCase()) ? 0 : 10 }))
      .sort((left, right) => left.distance - right.distance)
      .slice(0, options.n_results);
    return {
      ids: [matches.map((document) => document.id)],
      documents: [matches.map((document) => document.content)],
      metadatas: [matches.map((document) => document.metadata)],
      distances: [matches.map((document) => document.distance)],
    };
  }
}

class FakeChromaClient {
  readonly collections = new Map<string, FakeChromaCollection>();

  create_collection(options: { name: string }): FakeChromaCollection {
    if (this.collections.has(options.name)) {
      throw new Error(`Collection ${options.name} already exists`);
    }
    const collection = new FakeChromaCollection();
    this.collections.set(options.name, collection);
    return collection;
  }

  get_or_create_collection(options: { name: string }): FakeChromaCollection {
    const existing = this.collections.get(options.name);
    if (existing) {
      return existing;
    }
    const collection = new FakeChromaCollection();
    this.collections.set(options.name, collection);
    return collection;
  }

  delete_collection(options: { name: string }): void {
    this.collections.delete(options.name);
  }

  reset(): void {
    this.collections.clear();
  }
}

class FakeQdrantClient {
  readonly collections = new Map<string, Map<string, FakeDocument>>();

  collection_exists(collectionName: string): boolean {
    return this.collections.has(collectionName);
  }

  create_collection(options: { collection_name: string }): void {
    if (this.collections.has(options.collection_name)) {
      throw new Error(`Collection ${options.collection_name} already exists`);
    }
    this.collections.set(options.collection_name, new Map<string, FakeDocument>());
  }

  get_collection(collectionName: string): { name: string } {
    return { name: collectionName };
  }

  upsert(options: { collection_name: string; points: readonly { id: string; payload: FakeDocument }[] }): void {
    const collection = this.collections.get(options.collection_name);
    if (!collection) {
      throw new Error(`Collection ${options.collection_name} does not exist`);
    }
    for (const point of options.points) {
      collection.set(point.id, point.payload);
    }
  }

  query_points(options: { collection_name: string; query: string; limit: number; filter?: Record<string, unknown> | null }): {
    points: Array<{ id: string; payload: FakeDocument; score: number }>;
  } {
    const collection = this.collections.get(options.collection_name) ?? new Map<string, FakeDocument>();
    const points = [...collection.values()]
      .filter((document) => metadataMatches(document.metadata, options.filter ?? null))
      .map((document) => ({ id: document.id, payload: document, score: document.content.toLowerCase().includes(options.query.toLowerCase()) ? 1 : 0.25 }))
      .sort((left, right) => right.score - left.score)
      .slice(0, options.limit);
    return { points };
  }

  delete_collection(options: { collection_name: string }): void {
    this.collections.delete(options.collection_name);
  }

  get_collections(): { collections: Array<{ name: string }> } {
    return { collections: [...this.collections.keys()].map((name) => ({ name })) };
  }
}

function metadataMatches(metadata: Record<string, unknown>, filter: Record<string, unknown> | null): boolean {
  return !filter || Object.entries(filter).every(([key, value]) => metadata[key] === value);
}

describe("RAG configuration and factories", () => {
  it("normalizes ChromaDB and Qdrant config defaults with snake_case aliases", () => {
    const chroma = new ChromaDBConfig({
      score_threshold: 0.72,
      batch_size: 12,
      settings: { persist_directory: "/tmp/chroma-test", allow_reset: false },
    });
    const qdrant = new QdrantConfig({
      limit: 8,
      vectors_config: { size: 1536, distance: "Cosine" },
      options: { api_key: "secret", prefer_grpc: true },
    });

    expect(chroma.provider).toBe("chromadb");
    expect(chroma.scoreThreshold).toBe(0.72);
    expect(chroma.score_threshold).toBe(0.72);
    expect(chroma.batchSize).toBe(12);
    expect(chroma.settings.persistDirectory).toBe("/tmp/chroma-test");
    expect(chroma.settings.persist_directory).toBe("/tmp/chroma-test");
    expect(chroma.settings.allowReset).toBe(false);
    expect(qdrant.provider).toBe("qdrant");
    expect(qdrant.limit).toBe(8);
    expect(qdrant.vectorsConfig).toEqual({ size: 1536, distance: "Cosine" });
    expect(qdrant.options).toEqual({ api_key: "secret", prefer_grpc: true });
    expect(normalizeRagConfig({ provider: "chromadb", tenant: "tenant-a" }).provider).toBe("chromadb");
    expect(normalizeRagConfig({ provider: "qdrant", options: { path: "/tmp/qdrant" } }).provider).toBe("qdrant");
  });

  it("creates RAG clients through registered provider factories", () => {
    const seen: unknown[] = [];
    registerRagClientFactory("chromadb", (config) => {
      seen.push(config);
      return {
        search: (_collectionName: string, query: string) => [{ id: "doc-1", content: query, metadata: {}, score: 1 }],
      };
    });

    const client = createRagClient({ provider: "chromadb", database: "docs" });

    expect(seen[0]).toBeInstanceOf(ChromaDBConfig);
    const search = client.search as ((collectionName: string, query: string) => unknown) | undefined;
    expect(search?.("knowledge", "CrewAI")).toEqual([
      { id: "doc-1", content: "CrewAI", metadata: {}, score: 1 },
    ]);
    expect(() => createRagClient({ provider: "qdrant" })).toThrow("No RAG client factory registered");
  });

  it("normalizes RAG records with content-derived ids", () => {
    const normalized = normalizeBaseRecord({
      content: " CrewAI knowledge ",
      metadata: { source: "docs", priority: 1 },
    });

    expect(normalized).toEqual({
      docId: createContentId("CrewAI knowledge"),
      content: "CrewAI knowledge",
      metadata: { source: "docs", priority: 1 },
    });
    expect(normalizeBaseRecord({ doc_id: "manual", content: "text" }).docId).toBe("manual");
    expect(() => normalizeBaseRecord({ content: "   " })).toThrow("content cannot be empty");
  });

  it("initializes BaseRAGStorage agent names from crew roles", () => {
    class TestStorage extends BaseRAGStorage {
      protected sanitizeRole(role: string): string {
        return role.toLowerCase().replaceAll(/\s+/g, "_");
      }

      save(): void {}

      search(): unknown[] {
        return [];
      }

      reset(): void {}
    }

    const storage = new TestStorage({
      type: "short_term",
      allow_reset: false,
      crew: { agents: [{ role: "Lead Researcher" }, { role: "Fact Checker" }] },
    });

    expect(storage.allowReset).toBe(false);
    expect(storage.agents).toBe("lead_researcher_fact_checker");
  });

  it("wraps ChromaDB clients with collection lifecycle, upsert/search filters, and async aliases", async () => {
    const fake = new FakeChromaClient();
    const client = new ChromaDBClient(fake, (texts: readonly string[]) => texts.map((text) => [text.length]), 2, 0.5, 1);

    client.create_collection({ collection_name: "docs" });
    client.add_documents({
      collection_name: "docs",
      documents: [
        { doc_id: "a", content: "CrewAI storage parity", metadata: { topic: "storage" } },
        { doc_id: "b", content: "CrewAI provider parity", metadata: { topic: "provider" } },
      ],
    });
    client.add_documents({
      collection_name: "docs",
      documents: [{ doc_id: "a", content: "CrewAI storage parity updated", metadata: { topic: "storage" } }],
    });

    expect(client.search({
      collection_name: "docs",
      query: "storage",
      metadata_filter: { topic: "storage" },
    })).toEqual([
      { id: "a", content: "CrewAI storage parity updated", metadata: { topic: "storage" }, score: 1 },
    ]);

    await client.adelete_collection({ collection_name: "docs" });
    await client.aget_or_create_collection({ collection_name: "docs" });
    await client.aadd_documents({
      collection_name: "docs",
      documents: [{ content: "Async Chroma document", metadata: { mode: "async" } }],
    });

    expect(await client.asearch({
      collection_name: "docs",
      query: "Chroma",
      metadata_filter: { mode: "async" },
    })).toHaveLength(1);

    await client.areset();
    expect(fake.collections.size).toBe(0);
  });

  it("wraps Qdrant clients with collection lifecycle, upsert/search filters, and async aliases", async () => {
    const fake = new FakeQdrantClient();
    const client = new QdrantClient(fake, (text: string) => [text.length], 2, 0.5, 1);

    client.create_collection({ collection_name: "docs" });
    client.add_documents({
      collection_name: "docs",
      documents: [
        { doc_id: "a", content: "CrewAI storage parity", metadata: { topic: "storage" } },
        { doc_id: "b", content: "CrewAI provider parity", metadata: { topic: "provider" } },
      ],
    });
    client.add_documents({
      collection_name: "docs",
      documents: [{ doc_id: "a", content: "CrewAI storage parity updated", metadata: { topic: "storage" } }],
    });

    expect(client.search({
      collection_name: "docs",
      query: "storage",
      metadata_filter: { topic: "storage" },
    })).toEqual([
      { id: "a", content: "CrewAI storage parity updated", metadata: { topic: "storage" }, score: 1 },
    ]);

    await client.adelete_collection({ collection_name: "docs" });
    await client.acreate_collection({ collection_name: "docs" });
    await client.aadd_documents({
      collection_name: "docs",
      documents: [{ content: "Async Qdrant document", metadata: { mode: "async" } }],
    });

    expect(await client.asearch({
      collection_name: "docs",
      query: "Qdrant",
      metadata_filter: { mode: "async" },
    })).toHaveLength(1);

    await client.areset();
    expect(fake.collections.size).toBe(0);
  });

  it("saves and searches knowledge through the configured RAG client", async () => {
    const fake = new FakeChromaClient();
    const client = new ChromaDBClient(fake, (texts: readonly string[]) => texts.map((text) => [text.length]));
    const storage = new KnowledgeStorage({ client, collectionName: "docs" });

    storage.save(["CrewAI knowledge storage document"]);
    expect(storage.search(["knowledge"], 5, {}, 0.1)).toEqual([
      {
        id: createContentId("CrewAI knowledge storage document"),
        content: "CrewAI knowledge storage document",
        metadata: {},
        score: 1,
      },
    ]);

    await storage.asave(["Async knowledge document"]);
    expect(await storage.asearch(["Async"], 5, {}, 0.1)).toHaveLength(1);

    await storage.areset();
    expect(fake.collections.has("knowledge_docs")).toBe(false);
  });

  it("routes Knowledge through storage-backed sync and async upstream aliases", async () => {
    const fake = new FakeChromaClient();
    const client = new ChromaDBClient(fake, (texts: readonly string[]) => texts.map((text) => [text.length]));
    const storage = new KnowledgeStorage({ client, collectionName: "docs" });
    const knowledge = new Knowledge({
      sources: [new StringKnowledgeSource("CrewAI storage-backed knowledge")],
      storage,
    });

    expect(knowledge.query(["storage-backed"], { scoreThreshold: 0.1 })).toHaveLength(1);
    expect(await knowledge.aquery(["CrewAI"], { scoreThreshold: 0.1 })).toHaveLength(1);

    knowledge.reset();
    expect(knowledge.query(["CrewAI"], { scoreThreshold: 0.1 })).toEqual([]);

    await knowledge.aadd_sources();
    expect(await knowledge.aquery(["knowledge"], { scoreThreshold: 0.1 })).toHaveLength(1);

    await knowledge.areset();
    expect(await knowledge.aquery(["knowledge"], { scoreThreshold: 0.1 })).toEqual([]);
  });

  it("lets knowledge sources save themselves through upstream add aliases", async () => {
    const fake = new FakeChromaClient();
    const client = new ChromaDBClient(fake, (texts: readonly string[]) => texts.map((text) => [text.length]));
    const storage = new KnowledgeStorage({ client, collectionName: "source_docs" });
    const source = new StringKnowledgeSource({
      content: "CrewAI source add alias",
      storage,
    });

    source.add();
    expect(storage.search(["alias"], 5, {}, 0.1)).toHaveLength(1);

    storage.reset();
    await source.aadd();
    expect(await storage.asearch(["CrewAI"], 5, {}, 0.1)).toHaveLength(1);
    expect(source.get_embeddings()).toEqual([]);
  });

  it("normalizes and validates embedding vectors", () => {
    expect(normalizeEmbeddings([1, 2, 3])).toEqual([[1, 2, 3]]);
    expect(normalizeEmbeddings([[1, 2], [3, 4]])).toEqual([[1, 2], [3, 4]]);
    expect(validateEmbeddings([[0.1]])).toEqual([[0.1]]);
    expect(maybeCastOneToMany("one")).toEqual(["one"]);
    expect(maybeCastOneToMany(["one", "two"])).toEqual(["one", "two"]);
    expect(maybeCastOneToMany(null)).toBeNull();
    expect(() => normalizeEmbeddings([])).toThrow("at least one item");
    expect(() => validateEmbeddings([[Number.NaN]])).toThrow("numeric values");
  });

  it("updates memory storage access times and exposes maintenance hooks", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-31T00:00:00.000Z"));
    const storage = new LanceDBStorage();
    const record = new MemoryRecord({
      id: "memory-touch",
      content: "CrewAI storage maintenance",
      scope: "/memory/storage",
      categories: ["storage"],
      createdAt: "2026-05-30T00:00:00.000Z",
      lastAccessed: "2026-05-30T00:00:00.000Z",
      embedding: [1, 0],
    });
    storage.save(record);

    vi.setSystemTime(new Date("2026-05-31T00:10:00.000Z"));
    storage.touch_records(["missing", "memory-touch"]);

    const touched = storage.get_record("memory-touch");
    expect(touched?.createdAt.toISOString()).toBe("2026-05-30T00:00:00.000Z");
    expect(touched?.lastAccessed?.toISOString()).toBe("2026-05-31T00:10:00.000Z");

    vi.setSystemTime(new Date("2026-05-31T00:20:00.000Z"));
    storage.touchRecords(["memory-touch"]);
    expect(storage.getRecord("memory-touch")?.lastAccessed?.toISOString()).toBe("2026-05-31T00:20:00.000Z");

    expect(() => {
      storage.optimize();
    }).not.toThrow();
    expect(() => {
      storage.flush_to_central();
    }).not.toThrow();
    expect(() => {
      storage.flushToCentral();
    }).not.toThrow();
    expect(() => {
      storage.close();
    }).not.toThrow();
    await expect(storage.aclose()).resolves.toBeUndefined();
  });

  it("builds embedders from custom specs, providers, and registered provider builders", async () => {
    const custom = (input: readonly unknown[]) => input.map((value) => [String(value).length]);
    const customEmbedder = buildEmbedder({ provider: "custom", config: { embedding_callable: custom } });
    expect(await customEmbedder(["CrewAI", "TS"])).toEqual([[6], [2]]);

    const provider = new BaseEmbeddingsProvider({
      embeddingCallable: (input: readonly unknown[]) => input.map((value) => [String(value).length, 1]),
      model: "local",
    });
    expect(buildEmbedder(provider)(["abc"])).toEqual([[3, 1]]);

    registerEmbeddingProviderBuilder("openai", (spec) => {
      const config = spec.config as { model_name?: string } | undefined;
      return (input: readonly unknown[]) => input.map((value) => [
        String(value).length,
        config?.model_name === "text-embedding-3-small" ? 3 : 0,
      ]);
    });
    const registered = buildEmbedderFromDict({
      provider: "openai",
      config: { api_key: "sk-test", model_name: "text-embedding-3-small" },
    });
    expect(await registered(["CrewAI"])).toEqual([[6, 3]]);
    expect(() => buildEmbedderFromDict({ provider: "custom", config: {} })).toThrow("embedding_callable");
    expect(() => buildEmbedderFromDict({ provider: "ollama", config: { model_name: "nomic-embed-text" } })).toThrow("No embedding provider builder registered");
  });
});

describe("core crew runtime", () => {
  it("runs a sequential crew and returns the final task output", async () => {
    const researcher = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      llm: (messages) => `done: ${messages.at(-1)?.content ?? ""}`,
    });
    const task = new Task({
      description: "Research {topic}",
      expectedOutput: "A concise brief",
      agent: researcher,
    });
    const crewInstance = new Crew({ agents: [researcher], tasks: [task] });

    const output = await crewInstance.kickoff({ inputs: { topic: "CrewAI" } });

    expect(output.raw).toContain("Research CrewAI");
    expect(output.tasksOutput).toHaveLength(1);
    expect(output.tasksOutput[0]?.agent).toBe("Researcher");
  });

  it("supports CrewAI snake_case kickoff aliases", async () => {
    const agentInstance = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      llm: (messages) => `answer: ${messages.at(-1)?.content ?? ""}`,
    });
    const taskInstance = new Task({
      description: "Research {topic}",
      expectedOutput: "Answer",
      agent: agentInstance,
    });
    const crewInstance = new Crew({ agents: [agentInstance], tasks: [taskInstance] });

    const asyncOutput = await crewInstance.kickoff_async({ inputs: { topic: "CrewAI" } });
    const eachOutput = await crewInstance.kickoff_for_each({
      inputs: [{ topic: "A" }, { topic: "B" }],
    });
    const eachAsyncOutput = await crewInstance.kickoff_for_each_async({
      inputs: [{ topic: "C" }],
    });
    const nativeEachOutput = await crewInstance.akickoff_for_each({
      inputs: [{ topic: "D" }],
    });

    expect(asyncOutput.raw).toContain("Research CrewAI");
    expect(eachOutput.map((output) => output.raw)).toEqual([
      expect.stringContaining("Research A"),
      expect.stringContaining("Research B"),
    ]);
    expect(eachAsyncOutput[0]?.raw).toContain("Research C");
    expect(nativeEachOutput[0]?.raw).toContain("Research D");
  });

  it("exposes upstream Task lifecycle compatibility methods", async () => {
    const prompts: string[] = [];
    const agentInstance = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      llm: (messages) => {
        const content = messages.at(-1)?.content ?? "";
        prompts.push(content);
        return `done: ${content}`;
      },
    });
    const taskInstance = new Task({
      description: "Research {topic}",
      expectedOutput: "Brief about {topic}",
      outputFile: "reports/{topic}.txt",
      agent: agentInstance,
    });

    const originalKey = taskInstance.key;
    taskInstance.interpolate_inputs_and_add_conversation_history({
      topic: "CrewAI",
      crew_chat_messages: JSON.stringify([{ role: "user", content: "Use TS examples" }]),
    });

    expect(taskInstance.description).toContain("Research CrewAI");
    expect(taskInstance.description).toContain("User: Use TS examples");
    expect(taskInstance.expected_output).toBe("Brief about CrewAI");
    expect(taskInstance.output_file).toBe("reports/CrewAI.txt");
    expect(taskInstance.prompt()).toContain("Expected output: Brief about CrewAI");
    expect(taskInstance.key).toBe(originalKey);

    const output = await taskInstance.execute_sync(agentInstance, "extra context");

    expect(output.raw).toContain("Research CrewAI");
    expect(prompts[0]).toContain("Context:\nextra context");
    expect(taskInstance.execution_duration).toBeGreaterThanOrEqual(0);
    taskInstance.increment_tools_errors();
    taskInstance.increment_delegations("Coworker");
    expect(taskInstance.tools_errors).toBe(1);
    expect(taskInstance.delegations).toBe(1);
    expect(taskInstance.processed_by_agents.has("Coworker")).toBe(true);
    expect(taskInstance.copy([agentInstance], {})).toBeInstanceOf(Task);
  });

  it("exposes upstream AgentExecutor routing lifecycle methods", async () => {
    const agentInstance = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
    });
    const executor = new AgentExecutor({ agent: agentInstance, maxIter: 2 });
    executor.state.todos.items.push(new TodoItem({
      stepNumber: 1,
      description: "Collect facts",
    }));

    expect(executor.check_todos_available()).toBe("planning_disabled");
    expect(executor.get_ready_todos_method()).toBe("single_todo_ready");
    expect(executor.execute_todo_sequential()).toBe("step_executed");
    expect(executor.observe_step_result()).toBe("step_observed_medium");
    expect(executor.handle_step_observed_medium()).toBe("continue_plan");
    expect(executor.handle_continue_plan()).toBe("all_todos_complete");

    executor.state.current_answer = new AgentFinish({
      thought: "done",
      output: "final",
      text: "final",
    });
    expect(executor.route_by_answer_type()).toBe("agent_finished");
    expect(executor.finalize()).toBe("completed");
    expect(executor.state.is_finished).toBe(true);

    const invoked = executor.invoke({ input: "Summarize CrewAI" });
    expect(invoked).toEqual({ output: "Summarize CrewAI" });
    await expect(executor.ainvoke({ input: "Async CrewAI" })).resolves.toEqual({ output: "Async CrewAI" });
  });

  it("exposes upstream Agent and BaseAgent compatibility methods", async () => {
    const knowledge = new Knowledge({
      sources: [new StringKnowledgeSource("CrewAI agents can use knowledge.")],
    });
    const agentInstance = new Agent({
      role: "Researcher {topic}",
      goal: "Find facts about {topic}",
      backstory: "Careful analyst",
      knowledge,
      llm: (messages) => `answer: ${messages.at(-1)?.content ?? ""}`,
    });

    expect(agentInstance.key).toHaveLength(32);
    expect(agentInstance.planning_enabled).toBe(false);
    agentInstance.interpolate_inputs({ topic: "CrewAI" });
    expect(agentInstance.role).toBe("Researcher CrewAI");
    expect(agentInstance.goal).toBe("Find facts about CrewAI");
    expect(agentInstance.resolve_memory()).toBeNull();
    expect(agentInstance.get_delegation_tools()).toEqual([]);
    expect(agentInstance.get_platform_tools()).toEqual([]);
    expect(agentInstance.get_mcp_tools()).toEqual([]);
    expect(agentInstance.get_multimodal_tools()).toEqual([]);
    expect(agentInstance.get_code_execution_tools()).toEqual([]);
    expect(agentInstance.get_output_converter()).toBeNull();

    const output = await agentInstance.execute_task("Summarize CrewAI");
    expect(output).toContain("Summarize CrewAI");
    expect(agentInstance.last_messages.at(-1)?.content).toContain("Summarize CrewAI");

    const baseAgent = new BaseAgent({
      role: "Base",
      goal: "Run",
      backstory: "Compatibility",
      llm: () => "base output",
    });
    expect(baseAgent.get_role()).toBe("Base");
    expect(baseAgent.validate_tools()).toBe(baseAgent);
    expect(baseAgent.copy()).toBeInstanceOf(BaseAgent);
    await expect(baseAgent.aexecute_task("Base task")).resolves.toBe("base output");
  });

  it("exposes upstream Crew validation, knowledge, train, and test lifecycle methods", async () => {
    const events: string[] = [];
    crewaiEventBus.on("crew_train_started", () => { events.push("train-started"); });
    crewaiEventBus.on("crew_train_completed", () => { events.push("train-completed"); });
    crewaiEventBus.on("crew_test_started", () => { events.push("test-started"); });
    crewaiEventBus.on("crew_test_completed", () => { events.push("test-completed"); });
    const researcher = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      llm: (messages) => `done: ${messages.at(-1)?.content ?? ""}`,
    });
    const taskInstance = new Task({
      description: "Research {topic}",
      expectedOutput: "Brief",
      agent: researcher,
    });
    const crewInstance = new Crew({
      agents: [researcher],
      tasks: [taskInstance],
      knowledgeSources: [new StringKnowledgeSource("CrewAI supports collaborative agents.")],
      taskOutputStorageHandler: null,
    });
    const trainingFile = join(mkdtempSync(join(tmpdir(), "crewai-ts-train-")), "trained.json");

    expect(crewInstance.key).toHaveLength(32);
    expect(crewInstance.check_config()).toBe(crewInstance);
    expect(crewInstance.validate_tasks()).toBe(crewInstance);
    expect(crewInstance.query_knowledge(["collaborative"])?.[0]?.content).toContain("collaborative agents");
    await expect(crewInstance.aquery_knowledge(["CrewAI"])).resolves.toHaveLength(1);

    await crewInstance.train(1, trainingFile, { topic: "CrewAI" });
    const testResult = await crewInstance.test(1, () => JSON.stringify({ quality: 8 }), { topic: "CrewAI" });

    expect(readFileSync(trainingFile, "utf8")).toContain("\"iterations\": 1");
    expect(testResult).toContain("Task 1");
    expect(events).toEqual(expect.arrayContaining([
      "train-started",
      "train-completed",
      "test-started",
      "test-completed",
    ]));
  });

  it("accepts upstream snake_case Crew runtime fields", () => {
    const context = captureExecutionContext({ source: "checkpoint" });
    context.currentTaskId = "task-1";
    const usage = {
      totalTokens: 7,
      promptTokens: 3,
      cachedPromptTokens: 0,
      completionTokens: 4,
      reasoningTokens: 0,
      cacheCreationTokens: 0,
      successfulRequests: 1,
    };
    const crewInstance = new Crew({
      share_crew: true,
      prompt_file: "prompts.json",
      token_usage: usage,
      tracing: false,
      execution_context: context,
      checkpoint_inputs: { topic: "CrewAI" },
      checkpoint_train: true,
      checkpoint_kickoff_event_id: "kickoff-1",
    });

    expect(crewInstance.shareCrew).toBe(true);
    expect(crewInstance.share_crew).toBe(true);
    expect(crewInstance.promptFile).toBe("prompts.json");
    expect(crewInstance.prompt_file).toBe("prompts.json");
    expect(crewInstance.usageMetrics).toEqual(usage);
    expect(crewInstance.usage_metrics).toBe(crewInstance.usageMetrics);
    expect(crewInstance.tokenUsage).toBe(crewInstance.usageMetrics);
    expect(crewInstance.token_usage).toBe(crewInstance.usageMetrics);
    expect(crewInstance.tracing).toBe(false);
    expect(crewInstance.executionContext).toBe(context);
    expect(crewInstance.execution_context).toBe(context);
    expect(crewInstance.checkpointInputs).toEqual({ topic: "CrewAI" });
    expect(crewInstance.checkpoint_inputs).toEqual({ topic: "CrewAI" });
    expect(crewInstance.checkpointTrain).toBe(true);
    expect(crewInstance.checkpoint_train).toBe(true);
    expect(crewInstance.checkpointKickoffEventId).toBe("kickoff-1");
    expect(crewInstance.checkpoint_kickoff_event_id).toBe("kickoff-1");

    const copy = crewInstance.copy();
    expect(copy.share_crew).toBe(true);
    expect(copy.prompt_file).toBe("prompts.json");
    expect(copy.token_usage).toEqual(usage);
    expect(copy.execution_context).not.toBe(context);
    expect(copy.execution_context?.currentTaskId).toBe("task-1");
    expect(copy.checkpoint_inputs).toEqual({ topic: "CrewAI" });
  });

  it("uses previous task outputs as default context when context is unspecified", async () => {
    const prompts: string[] = [];
    const agentInstance = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      llm: (messages) => {
        const content = messages.at(-1)?.content ?? "";
        prompts.push(content);
        return prompts.length === 1 ? "first output" : "second output";
      },
    });
    const first = new Task({
      description: "First",
      expectedOutput: "First result",
      agent: agentInstance,
    });
    const second = new Task({
      description: "Second",
      expectedOutput: "Second result",
      agent: agentInstance,
    });

    await new Crew({ agents: [agentInstance], tasks: [first, second] }).kickoff();

    expect(prompts[1]).toContain("Context:\nfirst output");
  });

  it("does not use previous task outputs when context is explicitly empty", async () => {
    const prompts: string[] = [];
    const agentInstance = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      llm: (messages) => {
        const content = messages.at(-1)?.content ?? "";
        prompts.push(content);
        return prompts.length === 1 ? "first output" : "second output";
      },
    });
    const first = new Task({
      description: "First",
      expectedOutput: "First result",
      agent: agentInstance,
    });
    const second = new Task({
      description: "Second",
      expectedOutput: "Second result",
      agent: agentInstance,
      context: [],
    });

    await new Crew({ agents: [agentInstance], tasks: [first, second] }).kickoff();

    expect(prompts[1]).not.toContain("Context:");
  });

  it("preserves unspecified, null, empty, and list task contexts when copying crews", () => {
    const agentInstance = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
    });
    const unspecified = new Task({
      description: "unspecified",
      expectedOutput: "unspecified",
      agent: agentInstance,
    });
    const none = new Task({
      description: "none",
      expectedOutput: "none",
      agent: agentInstance,
      context: null,
    });
    const empty = new Task({
      description: "empty",
      expectedOutput: "empty",
      agent: agentInstance,
      context: [],
    });
    const explicit = new Task({
      description: "explicit",
      expectedOutput: "explicit",
      agent: agentInstance,
      context: [unspecified],
    });

    const copied = new Crew({
      agents: [agentInstance],
      tasks: [unspecified, none, empty, explicit],
    }).copy();

    expect(copied.tasks[0]?.context).toBeUndefined();
    expect(copied.tasks[1]?.context).toBeNull();
    expect(copied.tasks[2]?.context).toEqual([]);
    expect(copied.tasks[3]?.context).toEqual([copied.tasks[0]]);
  });

  it("preserves deprecated agent compatibility options when copying crews", () => {
    const agentInstance = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      allowCodeExecution: true,
      codeExecutionMode: "unsafe",
      respectContextWindow: false,
      multimodal: true,
    });

    const copied = new Crew({ agents: [agentInstance] }).copy();

    expect(copied.agents[0]?.allowCodeExecution).toBe(true);
    expect(copied.agents[0]?.codeExecutionMode).toBe("unsafe");
    expect(copied.agents[0]?.respectContextWindow).toBe(false);
    expect(copied.agents[0]?.multimodal).toBe(true);
  });

  it("runs kickoffForEach with isolated outputs and aggregated usage", async () => {
    const researcher = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      llm: (messages) => `done: ${messages.at(-1)?.content ?? ""}`,
    });
    const taskInstance = new Task({
      description: "Research {topic}",
      expectedOutput: "A concise brief",
      agent: researcher,
    });
    const crewInstance = new Crew({ agents: [researcher], tasks: [taskInstance] });

    const outputs = await crewInstance.kickoffForEach({
      inputs: [{ topic: "CrewAI" }, { topic: "TypeScript" }],
    });

    expect(outputs).toHaveLength(2);
    expect(outputs[0]?.raw).toContain("Research CrewAI");
    expect(outputs[1]?.raw).toContain("Research TypeScript");
    expect(outputs[0]?.tokenUsage.successfulRequests).toBe(1);
    expect(outputs[1]?.tokenUsage.successfulRequests).toBe(1);
    expect(crewInstance.usageMetrics.successfulRequests).toBe(2);
  });

  it("runs kickoffForEachAsync concurrently", async () => {
    const completed: string[] = [];
    const researcher = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      llm: async (messages) => {
        const content = messages.at(-1)?.content ?? "";
        await delay(content.includes("slow") ? 30 : 5);
        completed.push(content.includes("slow") ? "slow" : "fast");
        return content;
      },
    });
    const taskInstance = new Task({
      description: "Research {topic}",
      expectedOutput: "A concise brief",
      agent: researcher,
    });

    const outputs = await new Crew({ agents: [researcher], tasks: [taskInstance] }).kickoffForEachAsync({
      inputs: [{ topic: "slow" }, { topic: "fast" }],
    });

    expect(outputs.map((output) => output.raw)).toEqual([
      expect.stringContaining("Research slow"),
      expect.stringContaining("Research fast"),
    ]);
    expect(completed[0]).toBe("fast");
  });

  it("runs crew step callbacks for agent execution", async () => {
    const steps: AgentStep[] = [];
    const researcher = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      llm: () => "done",
    });
    const taskInstance = new Task({
      description: "Research",
      expectedOutput: "A concise brief",
      agent: researcher,
    });

    await new Crew({
      agents: [researcher],
      tasks: [taskInstance],
      stepCallback: (step) => {
        steps.push(step);
      },
    }).kickoff();

    expect(steps).toEqual([
      {
        type: "final",
        agentRole: "Researcher",
        iteration: 0,
        output: "done",
      },
    ]);
  });

  it("injects the current date into agent task prompts when enabled", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-02T03:04:05Z"));
    const prompts: string[] = [];
    const researcher = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      injectDate: true,
      dateFormat: "%d/%m/%Y",
      llm: (messages) => {
        prompts.push(messages.at(-1)?.content ?? "");
        return "done";
      },
    });
    const taskInstance = new Task({
      description: "Research",
      expectedOutput: "A concise brief",
      agent: researcher,
    });

    await new Crew({ agents: [researcher], tasks: [taskInstance] }).kickoff();

    expect(prompts[0]).toContain("Current Date: 02/01/2025");
    expect(taskInstance.description).toBe("Research");
  });

  it("retries agent task execution up to maxRetryLimit", async () => {
    let calls = 0;
    const researcher = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      maxRetryLimit: 1,
      llm: () => {
        calls += 1;
        if (calls === 1) {
          throw new Error("temporary model failure");
        }
        return "recovered";
      },
    });
    const taskInstance = new Task({
      description: "Research",
      expectedOutput: "A concise brief",
      agent: researcher,
    });

    const output = await new Crew({ agents: [researcher], tasks: [taskInstance] }).kickoff();

    expect(output.raw).toBe("recovered");
    expect(calls).toBe(2);
  });

  it("throws after agent maxRetryLimit is exhausted", async () => {
    let calls = 0;
    const researcher = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      maxRetryLimit: 1,
      llm: () => {
        calls += 1;
        throw new Error("permanent model failure");
      },
    });
    const taskInstance = new Task({
      description: "Research",
      expectedOutput: "A concise brief",
      agent: researcher,
    });

    await expect(new Crew({ agents: [researcher], tasks: [taskInstance] }).kickoff())
      .rejects
      .toThrow("permanent model failure");
    expect(calls).toBe(2);
  });

  it("fails task execution when maxExecutionTime is exceeded", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const researcher = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      maxExecutionTime: 1,
      llm: async () => {
        calls += 1;
        await delay(2_000);
        return "too late";
      },
    });
    const taskInstance = new Task({
      description: "Research",
      expectedOutput: "A concise brief",
      agent: researcher,
    });

    const kickoff = new Crew({ agents: [researcher], tasks: [taskInstance] }).kickoff();
    const expectation = expect(kickoff).rejects.toThrow("execution timed out after 1 seconds");
    await vi.advanceTimersByTimeAsync(1_000);

    await expectation;
    expect(calls).toBe(1);
  });

  it("can avoid system role messages when useSystemPrompt is false", async () => {
    const seenMessages: LLMMessage[][] = [];
    const researcher = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      useSystemPrompt: false,
      llm: (messages) => {
        seenMessages.push([...messages]);
        return "done";
      },
    });
    const taskInstance = new Task({
      description: "Research",
      expectedOutput: "A concise brief",
      agent: researcher,
    });

    await new Crew({ agents: [researcher], tasks: [taskInstance] }).kickoff();

    expect(seenMessages[0]).toHaveLength(1);
    expect(seenMessages[0]?.[0]?.role).toBe("user");
    expect(seenMessages[0]?.[0]?.content).toContain("Role: Researcher");
    expect(seenMessages[0]?.some((message) => message.role === "system")).toBe(false);
  });

  it("renders agent system, prompt, and response templates", async () => {
    const seenMessages: LLMMessage[][] = [];
    const researcher = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      systemTemplate: "SYS {role}: {{ .System }}",
      promptTemplate: "USR {goal}: {{ .Prompt }}",
      responseTemplate: "ASSISTANT PREFIX {{ .Response }}",
      llm: (messages) => {
        seenMessages.push([...messages]);
        return "done";
      },
    });
    const taskInstance = new Task({
      description: "Research",
      expectedOutput: "A concise brief",
      agent: researcher,
    });

    await new Crew({ agents: [researcher], tasks: [taskInstance] }).kickoff();

    expect(seenMessages[0]?.[0]?.content).toContain("SYS Researcher: Role: Researcher");
    expect(seenMessages[0]?.[1]?.content).toContain("USR Find facts: Task: Research");
    expect(seenMessages[0]?.[1]?.content).toContain("ASSISTANT PREFIX");
  });

  it("applies agent guardrail transformations to final output", async () => {
    const events: CrewAIEvent[] = [];
    crewaiEventBus.on("llm_guardrail_started", (_source, event) => {
      events.push(event);
    });
    crewaiEventBus.on("llm_guardrail_completed", (_source, event) => {
      events.push(event);
    });
    const researcher = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      llm: () => "raw answer",
      guardrail: (output) => [true, `${output} [checked]`],
    });
    const taskInstance = new Task({
      description: "Research",
      expectedOutput: "A concise brief",
      agent: researcher,
    });

    const output = await new Crew({ agents: [researcher], tasks: [taskInstance] }).kickoff();

    expect(output.raw).toBe("raw answer [checked]");
    expect(events[0]).toBeInstanceOf(LLMGuardrailStartedEvent);
    expect((events[0] as LLMGuardrailStartedEvent).from_agent).toBe(researcher);
    expect(events[1]).toBeInstanceOf(LLMGuardrailCompletedEvent);
    expect((events[1] as LLMGuardrailCompletedEvent).success).toBe(true);
    expect((events[1] as LLMGuardrailCompletedEvent).result).toBe("raw answer [checked]");
  });

  it("throws when agent guardrail retry limit is exhausted", async () => {
    let attempts = 0;
    const events: LLMGuardrailCompletedEvent[] = [];
    crewaiEventBus.on("llm_guardrail_completed", (_source, event) => {
      events.push(event);
    });
    const researcher = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      llm: () => "bad answer",
      guardrailMaxRetries: 2,
      guardrail: () => {
        attempts += 1;
        return { success: false, error: "not acceptable" };
      },
    });
    const taskInstance = new Task({
      description: "Research",
      expectedOutput: "A concise brief",
      agent: researcher,
    });

    await expect(new Crew({ agents: [researcher], tasks: [taskInstance] }).kickoff())
      .rejects
      .toThrow("Agent's guardrail failed validation after 2 retries");
    expect(attempts).toBe(3);
    expect(events).toHaveLength(3);
    expect(events.every((event) => !event.success)).toBe(true);
    expect(events[0]?.error).toBe("not acceptable");
  });

  it("runs crew taskCallback after each task and avoids duplicate task callback calls", async () => {
    const calls: string[] = [];
    const agentInstance = new Agent({
      role: "Worker",
      goal: "Run tasks",
      backstory: "Callback worker",
      llm: (messages) => messages.at(-1)?.content.includes("first") ? "first output" : "second output",
    });
    const sharedCallback = () => {
      calls.push("shared");
    };
    const first = new Task({
      description: "first",
      expectedOutput: "first",
      agent: agentInstance,
      callback: (output) => {
        calls.push(`task:${output.raw}`);
      },
    });
    const second = new Task({
      description: "second",
      expectedOutput: "second",
      agent: agentInstance,
      callback: sharedCallback,
    });

    await new Crew({
      agents: [agentInstance],
      tasks: [first, second],
      taskCallback: sharedCallback,
    }).kickoff();

    expect(calls).toEqual([
      "task:first output",
      "shared",
      "shared",
    ]);
  });

  it("writes task execution logs when outputLogFile is enabled", async () => {
    const directory = mkdtempSync(join(tmpdir(), "crewai-ts-logs-"));
    const logFile = join(directory, "logs.json");
    const agentInstance = new Agent({
      role: "Logger",
      goal: "Write logs",
      backstory: "Records task execution",
      llm: () => "logged output",
    });
    const taskInstance = new Task({
      name: "logging-task",
      description: "Log this task",
      expectedOutput: "A logged output",
      agent: agentInstance,
    });

    await new Crew({
      agents: [agentInstance],
      tasks: [taskInstance],
      outputLogFile: logFile,
    }).kickoff();

    const entries = JSON.parse(readFileSync(logFile, "utf8")) as Array<Record<string, unknown>>;
    expect(entries).toEqual([
      expect.objectContaining({
        taskName: "logging-task",
        task: "Log this task",
        agent: "Logger",
        status: "started",
      }),
      expect.objectContaining({
        taskName: "logging-task",
        task: "Log this task",
        agent: "Logger",
        status: "completed",
        output: "logged output",
      }),
    ]);
  });

  it("stores structured task execution logs and optional JSON files", async () => {
    const directory = mkdtempSync(join(tmpdir(), "crewai-ts-task-logs-"));
    const taskLogFile = join(directory, "task-0.json");
    const agentInstance = new Agent({
      role: "Logger",
      goal: "Write logs",
      backstory: "Records task execution",
      llm: () => "{\"summary\":\"done\"}",
    });
    const taskInstance = new Task({
      name: "execution-log-task",
      description: "Log {topic}",
      expectedOutput: "A structured log",
      agent: agentInstance,
      outputJson: true,
    });
    const crewInstance = new Crew({
      agents: [agentInstance],
      tasks: [taskInstance],
      taskExecutionOutputJsonFiles: [taskLogFile],
    });

    await crewInstance.kickoff({ inputs: { topic: "CrewAI" } });

    expect(crewInstance.executionLogs).toHaveLength(1);
    expect(crewInstance.executionLogs[0]).toMatchObject({
      task: {
        name: "execution-log-task",
        description: "Log {topic}",
        expectedOutput: "A structured log",
      },
      output: {
        description: "Log CrewAI",
        raw: "{\"summary\":\"done\"}",
        jsonDict: { summary: "done" },
        outputFormat: "json",
        agent: "Logger",
      },
      taskIndex: 0,
      inputs: { topic: "CrewAI" },
    });
    const persisted = JSON.parse(readFileSync(taskLogFile, "utf8")) as Record<string, unknown>;
    expect(persisted).toMatchObject({
      taskIndex: 0,
      inputs: { topic: "CrewAI" },
    });
  });

  it("disables BaseTool result caching when crew cache is false", async () => {
    let toolCalls = 0;
    const lookup = new StructuredTool({
      name: "lookup",
      description: "Lookup data",
      argsSchema: {
        q: { type: "string", required: true },
      },
      func: () => {
        toolCalls += 1;
        return `value ${String(toolCalls)}`;
      },
    });
    const agentInstance = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      tools: [lookup],
      llm: (messages) => {
        if (messages.at(-1)?.role === "tool") {
          return messages.at(-1)?.content ?? "";
        }
        return { toolName: "lookup", arguments: { q: "CrewAI" } };
      },
    });
    const tasks = [
      new Task({ description: "First", expectedOutput: "A lookup", agent: agentInstance }),
      new Task({ description: "Second", expectedOutput: "A lookup", agent: agentInstance }),
    ];

    await new Crew({
      agents: [agentInstance],
      tasks,
      cache: false,
    }).kickoff();

    expect(toolCalls).toBe(2);
  });

  it("adds delegation tools for sequential agents with allowDelegation", async () => {
    const usedTools: string[][] = [];
    const analyst = new Agent({
      role: "Analyst",
      goal: "Coordinate research",
      backstory: "Delegates work",
      allowDelegation: true,
      llm: (messages, { tools } = {}) => {
        usedTools.push(tools?.map((toolInstance) => toolInstance.name) ?? []);
        if (messages.at(-1)?.role === "tool") {
          return messages.at(-1)?.content ?? "";
        }
        return { toolName: "Delegate work to coworker", arguments: { coworker: "Writer", task: "Draft summary" } };
      },
      maxIter: 2,
    });
    const writer = new Agent({
      role: "Writer",
      goal: "Write clearly",
      backstory: "Writes summaries",
      llm: (messages) => `writer got: ${messages.at(-1)?.content ?? ""}`,
    });

    const output = await new Crew({
      agents: [analyst, writer],
      tasks: [
        new Task({
          description: "Coordinate",
          expectedOutput: "Delegated output",
          agent: analyst,
        }),
      ],
    }).kickoff();

    expect(usedTools[0]).toEqual(expect.arrayContaining([
      "delegate_work_to_coworker",
      "ask_question_to_coworker",
    ]));
    expect(output.raw).toContain("writer got: Draft summary");
  });

  it("preserves task tool override while adding delegation tools", async () => {
    const usedTools: string[][] = [];
    const agentTool = new StructuredTool({
      name: "agent tool",
      description: "Agent-level tool",
      func: () => "agent",
    });
    const taskTool = new StructuredTool({
      name: "task tool",
      description: "Task-level tool",
      func: () => "task",
    });
    const analyst = new Agent({
      role: "Analyst",
      goal: "Coordinate research",
      backstory: "Delegates work",
      tools: [agentTool],
      allowDelegation: true,
      llm: (messages, { tools } = {}) => {
        usedTools.push(tools?.map((toolInstance) => toolInstance.name) ?? []);
        return "done";
      },
    });
    const writer = new Agent({
      role: "Writer",
      goal: "Write clearly",
      backstory: "Writes summaries",
    });

    await new Crew({
      agents: [analyst, writer],
      tasks: [
        new Task({
          description: "Coordinate",
          expectedOutput: "Delegated output",
          agent: analyst,
          tools: [taskTool],
        }),
      ],
    }).kickoff();

    expect(usedTools[0]).toEqual(expect.arrayContaining([
      "task_tool",
      "delegate_work_to_coworker",
      "ask_question_to_coworker",
    ]));
    expect(usedTools[0]).not.toContain("agent_tool");
    expect(analyst.tools).toEqual([agentTool]);
  });

  it("shares crew maxRpm across agent LLM calls", async () => {
    const callTimes: number[] = [];
    const firstAgent = new Agent({
      role: "First",
      goal: "Run first",
      backstory: "Worker",
      llm: () => {
        callTimes.push(performance.now());
        return "first";
      },
    });
    const secondAgent = new Agent({
      role: "Second",
      goal: "Run second",
      backstory: "Worker",
      llm: () => {
        callTimes.push(performance.now());
        return "second";
      },
    });

    await new Crew({
      agents: [firstAgent, secondAgent],
      tasks: [
        new Task({ description: "first", expectedOutput: "first", agent: firstAgent }),
        new Task({ description: "second", expectedOutput: "second", agent: secondAgent }),
      ],
      maxRpm: 6000,
    }).kickoff();

    expect(callTimes).toHaveLength(2);
    expect((callTimes[1] ?? 0) - (callTimes[0] ?? 0)).toBeGreaterThanOrEqual(8);
  });
});

describe("agent planning", () => {
  it("creates a default bounded low-effort PlanningConfig for planning true", () => {
    const agentInstance = new Agent({
      role: "Planner",
      goal: "Plan",
      backstory: "Plans tasks",
      planning: true,
    });

    expect(agentInstance.planningEnabled).toBe(true);
    expect(agentInstance.planningConfig?.maxAttempts).toBe(1);
    expect(agentInstance.planningConfig?.reasoningEffort).toBe("low");
    expect(agentInstance.planningConfig?.maxSteps).toBe(20);
    expect(agentInstance.planningConfig?.maxReplans).toBe(3);
    expect(agentInstance.planningConfig?.maxStepIterations).toBe(15);
    expect(agentInstance.planningConfig?.stepTimeout).toBeNull();
  });

  it("accepts upstream snake_case Agent options in direct construction", async () => {
    const prompts: string[] = [];
    const steps: AgentStep[] = [];
    const executionContext = captureExecutionContext({ agent: "researcher" });
    executionContext.currentTaskId = "agent-task";
    const agentInstance = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      config: { source: "yaml" },
      llm: (messages) => {
        prompts.push(messages.map((message) => message.content).join("\n---\n"));
        return "draft";
      },
      crew: "crew-ref",
      function_calling_llm: null,
      knowledge_storage: { name: "memory-store" },
      knowledge_config: { results_limit: 3 },
      embedder: { provider: "openai", config: { model_name: "text-embedding-3-small" } },
      agent_knowledge_context: "Agent context",
      crew_knowledge_context: "Crew context",
      knowledge_search_query: "CrewAI facts",
      tools_results: [{ tool: "search", result: "ok" }],
      callbacks: [() => undefined],
      adapted_agent: true,
      apps: ["gmail/send_email"],
      mcps: ["notion#search"],
      a2a: { endpoint: "https://remote.example.com/a2a" },
      agent_executor: { name: "executor" },
      executor_class: "AgentExecutor",
      max_tokens: 100,
      from_repository: "researcher-template",
      allow_delegation: true,
      allow_code_execution: true,
      code_execution_mode: "unsafe",
      respect_context_window: false,
      max_iter: 3,
      max_retry_limit: 4,
      max_execution_time: 5,
      max_rpm: null,
      step_callback: (step) => {
        steps.push(step);
      },
      use_system_prompt: false,
      system_template: "SYS {role} {{ .System }}",
      prompt_template: "USR {{ .Prompt }}",
      response_template: "RESP {{ .Response }}",
      inject_date: true,
      date_format: "%Y/%m/%d",
      guardrail_max_retries: 1,
      reasoning: true,
      max_reasoning_attempts: 2,
      skills: [{ name: "source-review", description: "Check sources." }],
      guardrail: (output) => [true, `${output} checked`],
      execution_context: executionContext,
      checkpoint_kickoff_event_id: "agent-kickoff",
    });

    const output = await agentInstance.kickoff("Research CrewAI");

    expect(output).toBe("draft checked");
    expect(agentInstance.function_calling_llm).toBeNull();
    expect(agentInstance.config).toEqual({ source: "yaml" });
    expect(agentInstance.crew).toBe("crew-ref");
    expect(agentInstance.knowledge_storage).toEqual({ name: "memory-store" });
    expect(agentInstance.knowledge_config).toEqual({ results_limit: 3 });
    expect(agentInstance.embedder).toEqual({ provider: "openai", config: { model_name: "text-embedding-3-small" } });
    expect(agentInstance.agent_knowledge_context).toBe("Agent context");
    expect(agentInstance.crew_knowledge_context).toBe("Crew context");
    expect(agentInstance.knowledge_search_query).toBe("CrewAI facts");
    expect(agentInstance.tools_results).toEqual([{ tool: "search", result: "ok" }]);
    expect(agentInstance.callbacks).toHaveLength(1);
    expect(agentInstance.adapted_agent).toBe(true);
    expect(agentInstance.apps).toEqual(["gmail/send_email"]);
    expect(agentInstance.mcps).toEqual(["notion#search"]);
    expect(agentInstance.a2a).toEqual({ endpoint: "https://remote.example.com/a2a" });
    expect(agentInstance.agent_executor).toEqual({ name: "executor" });
    expect(agentInstance.executor_class).toBe("AgentExecutor");
    expect(agentInstance.max_tokens).toBe(100);
    expect(agentInstance.from_repository).toBe("researcher-template");
    expect(agentInstance.execution_context).toBe(executionContext);
    expect(agentInstance.checkpoint_kickoff_event_id).toBe("agent-kickoff");
    expect(agentInstance.allow_delegation).toBe(true);
    expect(agentInstance.allow_code_execution).toBe(true);
    expect(agentInstance.code_execution_mode).toBe("unsafe");
    expect(agentInstance.respect_context_window).toBe(false);
    expect(agentInstance.max_iter).toBe(3);
    expect(agentInstance.max_retry_limit).toBe(4);
    expect(agentInstance.max_execution_time).toBe(5);
    expect(agentInstance.max_rpm).toBeNull();
    expect(agentInstance.step_callback).toBeInstanceOf(Function);
    expect(agentInstance.use_system_prompt).toBe(false);
    expect(agentInstance.system_template).toContain("SYS");
    expect(agentInstance.prompt_template).toContain("USR");
    expect(agentInstance.response_template).toContain("RESP");
    expect(agentInstance.inject_date).toBe(true);
    expect(agentInstance.date_format).toBe("%Y/%m/%d");
    expect(agentInstance.guardrail_max_retries).toBe(1);
    expect(agentInstance.max_reasoning_attempts).toBe(2);
    expect(agentInstance.planning_config?.maxAttempts).toBe(2);
    expect(steps.at(-1)?.type).toBe("final");
    expect(prompts.at(-1)).toContain("SYS Researcher");
    expect(prompts.at(-1)).toContain("<skills>");
    expect(prompts.at(-1)).toContain("Current Date:");
    expect(prompts.at(-1)).toContain("Crew knowledge context:");
    expect(prompts.at(-1)).toContain("Agent knowledge context:");
    const copy = agentInstance.copy();
    expect(copy.agent_knowledge_context).toBe("Agent context");
    expect(copy.execution_context).not.toBe(executionContext);
    expect(copy.execution_context?.currentTaskId).toBe("agent-task");
  });

  it("uses PlanningConfig custom prompts and injects the generated plan into execution", async () => {
    const seen: string[] = [];
    const agentInstance = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      planningConfig: new PlanningConfig({
        maxSteps: 4,
        systemPrompt: "Planner for {role}",
        planPrompt: "Plan task: {description} with {tools} in {maxSteps} steps",
      }),
      llm: (messages) => {
        const content = messages.at(-1)?.content ?? "";
        seen.push(content);
        if (content.startsWith("Plan task:")) {
          return JSON.stringify({ plan: "Search first, then answer.", ready: true });
        }
        return content;
      },
    });

    const output = await agentInstance.kickoff("Research CrewAI");

    expect(seen[0]).toBe("Plan task: Research CrewAI with No tools available in 4 steps");
    expect(output).toContain("Planning:\nSearch first, then answer.");
    expect(agentInstance.getUsageMetrics().successfulRequests).toBe(2);
  });

  it("injects direct agent kickoff input files into the prompt", async () => {
    const prompts: string[] = [];
    const agentInstance = new Agent({
      role: "Reader",
      goal: "Read files",
      backstory: "Careful reader",
      llm: (messages) => {
        prompts.push(messages.at(-1)?.content ?? "");
        return "done";
      },
    });

    await agentInstance.kickoff("Summarize the notes", {
      input_files: {
        notes: {
          filename: "notes.md",
          content: "# Notes",
        },
      },
    });

    expect(prompts[0]).toContain("Summarize the notes");
    expect(prompts[0]).toContain("Input files (content already loaded in conversation):");
    expect(prompts[0]).toContain('"notes" (notes.md, text/markdown)');
    expect(prompts[0]).toContain("    # Notes");
  });

  it("supports Agent kickoff async aliases", async () => {
    const agentInstance = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      llm: (messages) => `done: ${messages.at(-1)?.content ?? ""}`,
    });

    await expect(agentInstance.kickoffAsync("First")).resolves.toContain("First");
    await expect(agentInstance.kickoff_async("Second")).resolves.toContain("Second");
    await expect(agentInstance.akickoff("Third")).resolves.toContain("Third");
  });

  it("accepts direct agent kickoff message lists and extracts message files", async () => {
    const prompts: string[] = [];
    const agentInstance = new Agent({
      role: "Reader",
      goal: "Read files",
      backstory: "Careful reader",
      llm: (messages) => {
        prompts.push(messages.at(-1)?.content ?? "");
        return "done";
      },
    });

    await agentInstance.kickoff([
      {
        role: "user",
        content: "Analyze the uploaded notes",
        files: {
          notes: {
            filename: "message.txt",
            content: "message file content",
          },
        },
      },
      {
        role: "assistant",
        content: "I will inspect them.",
      },
    ], {
      inputFiles: {
        notes: {
          filename: "option.txt",
          content: "option file content",
        },
      },
    });

    expect(prompts[0]).toContain("Analyze the uploaded notes\nI will inspect them.");
    expect(prompts[0]).toContain('"notes" (option.txt, text/plain)');
    expect(prompts[0]).toContain("    option file content");
    expect(prompts[0]).not.toContain("message file content");
  });

  it("keeps planning disabled by default and supports reasoning compatibility", () => {
    const disabled = new Agent({
      role: "Worker",
      goal: "Work",
      backstory: "No planning by default",
    });
    const reasoning = new Agent({
      role: "Worker",
      goal: "Work",
      backstory: "Legacy reasoning",
      reasoning: true,
      maxReasoningAttempts: 5,
    });

    expect(disabled.planningEnabled).toBe(false);
    expect(reasoning.planningEnabled).toBe(true);
    expect(reasoning.reasoning).toBe(true);
    expect(reasoning.maxReasoningAttempts).toBe(5);
    expect(reasoning.planningConfig?.maxAttempts).toBe(5);
  });

  it("runs reasoning before kickoff and refines until the plan is ready", async () => {
    const prompts: string[] = [];
    const events: CrewAIEvent[] = [];
    crewaiEventBus.on("agent_reasoning_started", (_, event) => {
      events.push(event);
    });
    crewaiEventBus.on("agent_reasoning_completed", (_, event) => {
      events.push(event);
    });

    const worker = new Agent({
      role: "Worker",
      goal: "Answer",
      backstory: "Plans first",
      reasoning: true,
      maxReasoningAttempts: 2,
      llm: (messages) => {
        const prompt = messages.at(-1)?.content ?? "";
        prompts.push(prompt);
        if (prompt.includes("Refine this execution plan")) {
          return JSON.stringify({ plan: "Use the verified answer.", ready: true, steps: [] });
        }
        if (prompt.includes("Create an execution plan")) {
          return JSON.stringify({ plan: "Need a better plan.", ready: false, steps: [] });
        }
        return prompt;
      },
    });

    const output = await worker.kickoff("Explain CrewAI");

    expect(output).toContain("Reasoning Plan:\nUse the verified answer.");
    expect(prompts.some((prompt) => prompt.includes("Refine this execution plan"))).toBe(true);
    expect(events.map((event) => event.type)).toEqual([
      "agent_reasoning_started",
      "agent_reasoning_completed",
      "agent_reasoning_started",
      "agent_reasoning_completed",
    ]);
    expect(events[1]).toBeInstanceOf(AgentReasoningCompletedEvent);
    expect((events[1] as AgentReasoningCompletedEvent).ready).toBe(false);
    expect((events[3] as AgentReasoningCompletedEvent).ready).toBe(true);
  });

  it("emits reasoning failure events when planning fails", async () => {
    const events: CrewAIEvent[] = [];
    crewaiEventBus.on("agent_reasoning_started", (_, event) => {
      events.push(event);
    });
    crewaiEventBus.on("agent_reasoning_failed", (_, event) => {
      events.push(event);
    });

    const worker = new Agent({
      role: "Worker",
      goal: "Answer",
      backstory: "Plans first",
      reasoning: true,
      llm: () => {
        throw new Error("planner unavailable");
      },
    });

    await expect(worker.kickoff("Explain CrewAI")).rejects.toThrow("planner unavailable");
    expect(events[0]).toBeInstanceOf(AgentReasoningStartedEvent);
    expect(events[1]).toBeInstanceOf(AgentReasoningFailedEvent);
    expect((events[1] as AgentReasoningFailedEvent).error).toBe("planner unavailable");
  });

  it("detects context window limit errors with upstream-compatible aliases", () => {
    expect(LLMContextLengthExceededError.isContextLimitError("maximum context length is 128k")).toBe(true);
    expect(LLMContextLengthExceededError.is_context_limit_error("all good")).toBe(false);

    const error = new LLMContextLengthExceededError("too many tokens");
    expect(error.originalErrorMessage).toBe("too many tokens");
    expect(error.original_error_message).toBe("too many tokens");
    expect(error.message).toContain("LLM context length exceeded. Original error: too many tokens");
  });
});

describe("standard decorators", () => {
  it("collects agents, tasks, and kickoff hooks without reflect metadata", async () => {
    class ResearchCrew {
      agents: Agent[] = [];
      tasks: Task[] = [];

      addDefaultTopic(inputs: Record<string, unknown>) {
        return { topic: "CrewAI", ...inputs };
      }

      appendMarker(output: CrewOutput) {
        return new CrewOutput({
          raw: `${output.raw} [after]`,
          tasksOutput: output.tasksOutput,
        });
      }

      researcher() {
        return new Agent({
          role: "Researcher",
          goal: "Find facts",
          backstory: "Careful analyst",
          llm: (messages) => `report: ${messages.at(-1)?.content ?? ""}`,
        });
      }

      researchTask() {
        return new Task({
          description: "Research {topic}",
          expectedOutput: "A concise brief",
          agent: this.researcher(),
        });
      }

      crew() {
        return new Crew({ process: Process.sequential });
      }
    }

    const initializers = [
      decorateMethod(ResearchCrew, "addDefaultTopic", beforeKickoff),
      decorateMethod(ResearchCrew, "appendMarker", afterKickoff),
      decorateMethod(ResearchCrew, "researcher", agent),
      decorateMethod(ResearchCrew, "researchTask", task),
      decorateMethod(ResearchCrew, "crew", crew),
    ];
    const instance = new ResearchCrew();
    initializers.forEach((initializer) => {
      initializer.call(instance);
    });

    const output = await instance.crew().kickoff();

    expect(output.raw).toContain("Research CrewAI");
    expect(output.raw).toContain("[after]");
    expect(instance.tasks[0]?.name).toBe("researchTask");
    expect(instance.crew().name).toBe("ResearchCrew");
    expect(before_kickoff).toBe(beforeKickoff);
    expect(after_kickoff).toBe(afterKickoff);
    expect(output_json).toBe(outputJson);
    expect(output_pydantic).toBe(outputPydantic);
    expect(cache_handler).toBe(cacheHandler);
  });
});

describe("top-level CrewAI exports", () => {
  it("provides upstream-style LLM and __version__ exports", () => {
    const llm = new LLM({ model: "gpt-4o-mini" });

    expect(LLM).toBe(ConfiguredLLM);
    expect(llm).toBeInstanceOf(ConfiguredLLM);
    expect(__version__).toBe("0.0.0");
  });
});

describe("flow runtime", () => {
  it("runs start and listener methods with shared state", async () => {
    class ResearchFlow extends Flow<{ topic?: string; events: string[] }> {
      constructor() {
        super({ initialState: { events: [] } });
      }

      begin(inputs: Record<string, unknown>) {
        this.state.topic = String(inputs.topic);
        this.state.events.push(`begin:${this.state.topic}`);
        return this.state.topic;
      }

      summarize(topic: string) {
        this.state.events.push(`summary:${topic}`);
        return `summary for ${topic}`;
      }
    }

    const initializers = [
      decorateMethod(ResearchFlow, "begin", start() as unknown as Decorator),
      decorateMethod(ResearchFlow, "summarize", listen("begin") as unknown as Decorator),
    ];
    const flow = new ResearchFlow();
    initializers.forEach((initializer) => {
      initializer.call(flow);
    });

    const output = await flow.kickoff({ inputs: { topic: "CrewAI" } });

    expect(output).toBe("summary for CrewAI");
    expect(flow.state.events).toEqual(["begin:CrewAI", "summary:CrewAI"]);
    expect(getFlowMetadata(flow).map((entry) => entry.kind)).toEqual(["start", "listen"]);
  });

  it("supports routers plus and/or flow conditions", async () => {
    class RoutingFlow extends Flow<{ events: string[] }> {
      constructor() {
        super({ initialState: { events: [] } });
      }

      first() {
        this.state.events.push("first");
        return "first-output";
      }

      second() {
        this.state.events.push("second");
        return "second-output";
      }

      route() {
        this.state.events.push("route");
        return "approved";
      }

      afterRoute(path: string) {
        this.state.events.push(`after:${path}`);
        return "done";
      }
    }

    const initializers = [
      decorateMethod(RoutingFlow, "first", start() as unknown as Decorator),
      decorateMethod(RoutingFlow, "second", start() as unknown as Decorator),
      decorateMethod(RoutingFlow, "route", router(and_("first", "second")) as unknown as Decorator),
      decorateMethod(RoutingFlow, "afterRoute", listen(or_("approved", "rejected")) as unknown as Decorator),
    ];
    const flow = new RoutingFlow();
    initializers.forEach((initializer) => {
      initializer.call(flow);
    });

    const output = await flow.kickoff();

    expect(output).toBe("done");
    expect(flow.state.events).toEqual(["first", "second", "route", "after:approved"]);
    expect(flow.methodOutputs).toEqual(["first-output", "second-output", "approved", "done"]);
    expect([...flow.completedMethods]).toEqual(["first", "second", "route", "afterRoute"]);
    expect(flow.methodExecutionCounts.get("route")).toBe(1);
    expect(flow.executionTrace.map((entry) => [entry.methodName, entry.kind, entry.routerPath])).toEqual([
      ["first", "start", null],
      ["second", "start", null],
      ["route", "router", "approved"],
      ["afterRoute", "listen", null],
    ]);
  });

  it("builds upstream-compatible flow visualization nodes, edges, and path counts", () => {
    class VisualFlow extends Flow {
      begin(topic = "CrewAI") {
        return topic;
      }

      route() {
        return "approved";
      }

      publish() {
        return "done";
      }
    }

    const initializers = [
      decorateMethod(VisualFlow, "begin", start() as unknown as Decorator),
      decorateMethod(VisualFlow, "route", router("begin") as unknown as Decorator),
      decorateMethod(VisualFlow, "publish", listen(or_("approved", "rejected")) as unknown as Decorator),
    ];
    const flow = new VisualFlow();
    initializers.forEach((initializer) => {
      initializer.call(flow);
    });

    const structure = buildFlowStructure(flow);

    expect(structure.start_methods).toEqual(["begin"]);
    expect(structure.router_methods).toEqual(["route"]);
    expect(structure.nodes.begin).toMatchObject({
      type: "start",
      class_name: "VisualFlow",
      method_signature: {
        operationId: "begin",
        parameters: { topic: {} },
      },
    });
    expect(structure.nodes.route).toMatchObject({
      type: "router",
      is_router: true,
      router_paths: ["approved", "rejected"],
      trigger_methods: ["begin"],
    });
    expect(structure.edges).toEqual([
      { source: "begin", target: "route", condition_type: "OR", is_router_path: false },
      { source: "route", target: "publish", condition_type: null, is_router_path: true, router_path_label: "approved" },
      { source: "route", target: "publish", condition_type: null, is_router_path: true, router_path_label: "rejected" },
    ]);
    expect(calculateExecutionPaths(structure)).toBe(2);
  });

  it("infers router paths from possible string return constants", () => {
    class InferredRouterFlow extends Flow {
      begin() {
        return "start";
      }

      route() {
        const fallback = "manual";
        const byStatus = { ok: "approved", no: "rejected" };
        return Math.random() > 0.5 ? byStatus.ok : fallback;
      }
    }

    const initializers = [
      decorateMethod(InferredRouterFlow, "begin", start() as unknown as Decorator),
      decorateMethod(InferredRouterFlow, "route", router("begin") as unknown as Decorator),
    ];
    const flow = new InferredRouterFlow();
    initializers.forEach((initializer) => {
      initializer.call(flow);
    });

    expect(getPossibleReturnConstants(function route() {
      const fallback = "manual";
      const byStatus = { ok: "approved", no: "rejected" };
      return Math.random() > 0.5 ? byStatus.ok : fallback;
    })).toEqual(["approved", "rejected", "manual"]);
    expect(buildFlowStructure(flow).nodes.route?.router_paths).toEqual(["approved", "rejected", "manual"]);
  });

  it("calculates flow graph levels, outgoing edges, ancestors, and child ordering", () => {
    class GraphFlow extends Flow {
      first() {
        return "first";
      }

      second() {
        return "second";
      }

      merge() {
        return "merged";
      }

      route() {
        return "approved";
      }

      publish() {
        return "published";
      }
    }

    const initializers = [
      decorateMethod(GraphFlow, "first", start() as unknown as Decorator),
      decorateMethod(GraphFlow, "second", start() as unknown as Decorator),
      decorateMethod(GraphFlow, "merge", listen(and_("first", "second")) as unknown as Decorator),
      decorateMethod(GraphFlow, "route", router("merge") as unknown as Decorator),
      decorateMethod(GraphFlow, "publish", listen("approved") as unknown as Decorator),
    ];
    const flow = new GraphFlow();
    initializers.forEach((initializer) => {
      initializer.call(flow);
    });
    const structure = buildFlowStructure(flow);

    expect(calculateNodeLevels(structure)).toEqual({
      first: 0,
      second: 0,
      merge: 1,
      route: 2,
      publish: 3,
    });
    expect(countOutgoingEdges(structure)).toEqual({
      first: 1,
      second: 1,
      merge: 1,
      route: 1,
      publish: 0,
    });
    const ancestors = buildAncestorDict(structure);
    expect([...ancestors.publish ?? []].sort()).toEqual(["first", "merge", "route", "second"]);
    expect(getChildIndex("first", "merge", buildParentChildrenDict(structure))).toBe(0);
    expect(buildParentChildrenDict(structure)).toMatchObject({
      first: ["merge"],
      second: ["merge"],
      merge: ["route"],
      route: ["publish"],
    });
  });

  it("passes flow input files to crews kicked off inside the flow", async () => {
    class CrewFlow extends Flow<{ sawInputFiles?: boolean }> {
      analyze() {
        this.state.sawInputFiles = "notes" in this.inputFiles;
        const agentInstance = new Agent({
          role: "Reader",
          goal: "Read files",
          backstory: "Careful reader",
          llm: (messages, options) => {
            if (!messages.some((message) => message.role === "tool")) {
              expect(options?.tools?.map((toolInstance) => toolInstance.name)).toContain("read_file");
              return { toolName: "read_file", arguments: { file_name: "notes" } };
            }
            return messages.at(-1)?.content ?? "";
          },
        });
        const taskInstance = new Task({
          description: "Read flow file",
          expectedOutput: "File content",
          agent: agentInstance,
        });
        return this.kickoffCrew(new Crew({ agents: [agentInstance], tasks: [taskInstance] }));
      }
    }

    const initializers = [
      decorateMethod(CrewFlow, "analyze", start() as unknown as Decorator),
    ];
    const flow = new CrewFlow();
    initializers.forEach((initializer) => {
      initializer.call(flow);
    });

    const output = await flow.kickoff({
      input_files: {
        notes: {
          filename: "notes.txt",
          content: "Flow notes",
        },
      },
    }) as CrewOutput;

    expect(output.raw).toBe("read_file result:\nFlow notes");
    expect(flow.state.sawInputFiles).toBe(true);
    expect(flow.inputFiles).toEqual({});
  });

  it("extracts structured input files from flow inputs", async () => {
    class ExtractFlow extends Flow<{ topic?: string; sawFile?: boolean }> {
      begin(inputs: Record<string, unknown>) {
        this.state.topic = String(inputs.topic);
        this.state.sawFile = "notes" in this.inputFiles;
        return this.inputFiles.notes;
      }
    }

    const initializers = [
      decorateMethod(ExtractFlow, "begin", start() as unknown as Decorator),
    ];
    const flow = new ExtractFlow();
    initializers.forEach((initializer) => {
      initializer.call(flow);
    });

    const output = await flow.kickoff({
      inputs: {
        topic: "CrewAI",
        notes: {
          filename: "notes.txt",
          content: "Flow notes",
        },
      },
    });

    expect(output).toEqual({ filename: "notes.txt", content: "Flow notes" });
    expect(flow.state.topic).toBe("CrewAI");
    expect(flow.state.sawFile).toBe(true);
    expect(flow.toExecutionData().inputs).toEqual({ topic: "CrewAI" });
  });

  it("asks for flow input through an input provider and records history", async () => {
    const messages: string[] = [];
    class AskFlow extends Flow<{ topic?: string }> {
      async gather() {
        const topic = await this.ask("Topic?", { metadata: { channel: "research" } });
        if (topic !== null) {
          this.state.topic = topic;
        }
        return topic;
      }
    }

    const flow = new AskFlow({
      inputProvider: {
        requestInput: (message, _flow, metadata) => {
          messages.push(`${message}:${String(metadata?.channel)}`);
          return {
            text: "CrewAI",
            metadata: { respondedBy: "tester" },
          } satisfies InputResponse;
        },
      },
    });
    decorateMethod(AskFlow, "gather", start() as unknown as Decorator).call(flow);

    const output = await flow.kickoff();

    expect(output).toBe("CrewAI");
    expect(messages).toEqual(["Topic?:research"]);
    expect(flow.state.topic).toBe("CrewAI");
    expect(flow.inputHistory).toHaveLength(1);
    expect(flow.inputHistory[0]).toMatchObject({
      message: "Topic?",
      response: "CrewAI",
      methodName: "gather",
      metadata: { channel: "research" },
      responseMetadata: { respondedBy: "tester" },
    });
  });

  it("uses global flowConfig input provider as fallback", async () => {
    class AskFlow extends Flow {
      gather() {
        return this.ask("Question?");
      }
    }

    flowConfig.inputProvider = {
      requestInput: () => "from global",
    };
    const flow = new AskFlow();
    decorateMethod(AskFlow, "gather", start() as unknown as Decorator).call(flow);

    await expect(flow.kickoff()).resolves.toBe("from global");
  });

  it("emits flow input request and receive events", async () => {
    const events: Array<FlowInputRequestedEvent | FlowInputReceivedEvent> = [];
    crewaiEventBus.on("flow_input_requested", (_source, event) => {
      events.push(event);
    });
    crewaiEventBus.on("flow_input_received", (_source, event) => {
      events.push(event);
    });
    class AskFlow extends Flow {
      gather() {
        return this.ask("Question?", { metadata: { userId: "u1" } });
      }
    }

    const flow = new AskFlow({
      name: "ask-flow",
      inputProvider: {
        requestInput: () => ({ text: "answer", metadata: { responder: "u2" } }),
      },
    });
    decorateMethod(AskFlow, "gather", start() as unknown as Decorator).call(flow);

    await flow.kickoff();

    expect(events.map((event) => event.type)).toEqual(["flow_input_requested", "flow_input_received"]);
    expect(events[0]).toMatchObject({
      flowName: "ask-flow",
      methodName: "gather",
      message: "Question?",
      metadata: { userId: "u1" },
    });
    expect(events[1]).toMatchObject({
      flowName: "ask-flow",
      methodName: "gather",
      message: "Question?",
      response: "answer",
      metadata: { userId: "u1" },
      responseMetadata: { responder: "u2" },
    });
  });

  it("returns null from ask when an async input provider times out or throws", async () => {
    class TimeoutFlow extends Flow {
      async gather() {
        return await this.ask("Slow?", { timeout: 0.01 });
      }
    }
    const timeoutFlow = new TimeoutFlow({
      inputProvider: {
        requestInput: async () => await new Promise<string>((resolve) => {
          setTimeout(() => {
            resolve("late");
          }, 100);
        }),
      },
    });
    decorateMethod(TimeoutFlow, "gather", start() as unknown as Decorator).call(timeoutFlow);

    await expect(timeoutFlow.kickoff()).resolves.toBeNull();
    expect(timeoutFlow.inputHistory[0]?.response).toBeNull();

    class ErrorFlow extends Flow {
      gather() {
        return this.ask("Broken?");
      }
    }
    const errorFlow = new ErrorFlow({
      inputProvider: {
        requestInput: () => {
          throw new Error("provider failed");
        },
      },
    });
    decorateMethod(ErrorFlow, "gather", start() as unknown as Decorator).call(errorFlow);

    await expect(errorFlow.kickoff()).resolves.toBeNull();
    expect(errorFlow.inputHistory[0]?.response).toBeNull();
  });

  it("collects human feedback for flow methods and exposes the result", async () => {
    const events: CrewAIEvent[] = [];
    crewaiEventBus.on("human_feedback_requested", (_source, event) => {
      events.push(event);
    });
    crewaiEventBus.on("human_feedback_received", (_source, event) => {
      events.push(event);
    });

    class ReviewFlow extends Flow {
      generate() {
        return "draft";
      }
    }

    const initializers = [
      decorateMethod(ReviewFlow, "generate", humanFeedback({
        message: "Review draft",
        metadata: { channel: "review" },
        provider: {
          requestFeedback: (context) => {
            expect(context.output).toBe("draft");
            expect(context.metadata).toEqual({ channel: "review" });
            return "looks good";
          },
        },
      }) as unknown as Decorator),
      decorateMethod(ReviewFlow, "generate", start() as unknown as Decorator),
    ];
    const flow = new ReviewFlow();
    initializers.forEach((initializer) => {
      initializer.call(flow);
    });

    const output = await flow.kickoff();

    expect(output).toMatchObject({
      output: "draft",
      feedback: "looks good",
      outcome: null,
      methodName: "generate",
      metadata: { channel: "review" },
    });
    expect(flow.lastHumanFeedback).toBe(output);
    expect(flow.humanFeedbackHistory).toHaveLength(1);
    expect(events.map((event) => event.type)).toEqual(["human_feedback_requested", "human_feedback_received"]);
    expect(events[0]).toMatchObject({
      flowName: "ReviewFlow",
      methodName: "generate",
      message: "Review draft",
      output: "draft",
    });
    expect(events[1]).toMatchObject({
      flowName: "ReviewFlow",
      methodName: "generate",
      feedback: "looks good",
      outcome: null,
    });
  });

  it("routes flow human feedback emit outcomes to listeners", async () => {
    class ReviewFlow extends Flow<{ events: string[] }> {
      constructor() {
        super({ initialState: { events: [] } });
      }

      generate() {
        this.state.events.push("generate");
        return "draft";
      }

      publish(feedback: unknown) {
        this.state.events.push(`publish:${this.lastHumanFeedback?.feedback ?? ""}`);
        return feedback;
      }

      revise() {
        this.state.events.push("revise");
        return "revise";
      }
    }

    const initializers = [
      decorateMethod(ReviewFlow, "generate", humanFeedback({
        message: "Approve?",
        emit: ["approved", "rejected"],
        provider: {
          requestFeedback: () => "please approved this",
        },
      }) as unknown as Decorator),
      decorateMethod(ReviewFlow, "generate", start() as unknown as Decorator),
      decorateMethod(ReviewFlow, "publish", listen("approved") as unknown as Decorator),
      decorateMethod(ReviewFlow, "revise", listen("rejected") as unknown as Decorator),
    ];
    const flow = new ReviewFlow();
    initializers.forEach((initializer) => {
      initializer.call(flow);
    });

    const output = await flow.kickoff();

    expect(output).toBe("approved");
    expect(flow.lastHumanFeedback).toMatchObject({
      output: "draft",
      feedback: "please approved this",
      outcome: "approved",
    });
    expect(flow.state.events).toEqual(["generate", "publish:please approved this"]);
    expect(flow.executionTrace.map((entry) => [entry.methodName, entry.routerPath])).toEqual([
      ["generate", "approved"],
      ["publish", null],
    ]);
  });

  it("includes human feedback metadata in flow structure", () => {
    class ReviewFlow extends Flow {
      generate() {
        return "draft";
      }

      publish() {
        return "published";
      }
    }

    const initializers = [
      decorateMethod(ReviewFlow, "generate", humanFeedback({
        message: "Review",
        emit: ["approved", "rejected"],
      }) as unknown as Decorator),
      decorateMethod(ReviewFlow, "generate", start() as unknown as Decorator),
      decorateMethod(ReviewFlow, "publish", listen("approved") as unknown as Decorator),
    ];
    const flow = new ReviewFlow();
    initializers.forEach((initializer) => {
      initializer.call(flow);
    });

    const structure = getFlowStructure(flow);
    const generate = structure.methods.find((method) => method.name === "generate");

    expect(generate).toMatchObject({
      type: "start_router",
      routerPaths: ["approved", "rejected"],
      hasHumanFeedback: true,
    });
    expect(getHumanFeedbackMetadata(flow).get("generate")).toMatchObject({
      message: "Review",
      emit: ["approved", "rejected"],
    });
    expect(structure.edges).toContainEqual({
      from: "approved",
      to: "publish",
      type: "route",
      conditionType: "OR",
      condition: "approved",
    });
  });

  it("preserves upstream human feedback config fields in metadata and pending context", async () => {
    class ReviewFlow extends Flow {
      review() {
        return "draft";
      }
    }

    const initializers = [
      decorateMethod(ReviewFlow, "review", humanFeedback({
        message: "Review",
        emit: ["approved", "rejected"],
        llm: { toConfigDict: () => ({ model: "gpt-4o-mini", temperature: 0 }) },
        learn: true,
        learnSource: "review-notes",
        learnStrict: true,
        provider: {
          requestFeedback: (context) => {
            expect(context.llm).toEqual({ model: "gpt-4o-mini", temperature: 0 });
            throw new HumanFeedbackPending({ context });
          },
        },
      }) as unknown as Decorator),
      decorateMethod(ReviewFlow, "review", start() as unknown as Decorator),
    ];
    const flow = new ReviewFlow();
    initializers.forEach((initializer) => {
      initializer.call(flow);
    });

    const pending = await flow.kickoff();

    expect(pending).toBeInstanceOf(HumanFeedbackPending);
    expect(getHumanFeedbackMetadata(flow).get("review")).toMatchObject({
      llm: { model: "gpt-4o-mini", temperature: 0 },
      learn: true,
      learnSource: "review-notes",
      learn_source: "review-notes",
      learnStrict: true,
      learn_strict: true,
    });
    expect((pending as HumanFeedbackPending).context).toMatchObject({
      llm: { model: "gpt-4o-mini", temperature: 0 },
    });
  });

  it("returns HumanFeedbackPending instead of failing when async feedback pauses a flow", async () => {
    const pausedEvents: Array<FlowPausedEvent | MethodExecutionPausedEvent> = [];
    crewaiEventBus.on("method_execution_paused", (_source, event) => {
      pausedEvents.push(event);
    });
    crewaiEventBus.on("flow_paused", (_source, event) => {
      pausedEvents.push(event);
    });
    crewaiEventBus.on("flow_failed", () => {
      throw new Error("pending feedback should not emit flow_failed");
    });
    crewaiEventBus.on("method_execution_failed", () => {
      throw new Error("pending feedback should not emit method_execution_failed");
    });

    class PauseFlow extends Flow<{ id: string; events: string[] }> {
      constructor() {
        super({ initialState: { id: "flow-1", events: [] } });
      }

      review() {
        this.state.events.push("review");
        return "draft";
      }

      publish() {
        this.state.events.push("publish");
        return "published";
      }
    }

    const initializers = [
      decorateMethod(PauseFlow, "review", humanFeedback({
        message: "Review draft",
        emit: ["approved"],
        provider: {
          requestFeedback: (context) => {
            throw new HumanFeedbackPending({
              context,
              callbackInfo: { ticketId: "T-1" },
            });
          },
        },
      }) as unknown as Decorator),
      decorateMethod(PauseFlow, "review", start() as unknown as Decorator),
      decorateMethod(PauseFlow, "publish", listen("approved") as unknown as Decorator),
    ];
    const flow = new PauseFlow();
    initializers.forEach((initializer) => {
      initializer.call(flow);
    });

    const output = await flow.kickoff();

    expect(output).toBeInstanceOf(HumanFeedbackPending);
    const pending = output as HumanFeedbackPending;
    expect(pending.context).toMatchObject({
      flowName: "PauseFlow",
      flowClass: "PauseFlow",
      flowId: "flow-1",
      methodName: "review",
      message: "Review draft",
      output: "draft",
      emit: ["approved"],
    });
    expect(pending.callbackInfo).toEqual({ ticketId: "T-1" });
    expect(flow.state.events).toEqual(["review"]);
    expect(flow.lastHumanFeedback).toBeNull();
    expect(pausedEvents.map((event) => event.type)).toEqual(["method_execution_paused", "flow_paused"]);
    expect(pausedEvents[0]).toMatchObject({
      flowName: "PauseFlow",
      methodName: "review",
      pending,
    });
    expect(pausedEvents[1]).toMatchObject({
      flowName: "PauseFlow",
      pending,
    });
  });

  it("resumes a paused human feedback flow and continues listeners", async () => {
    class ResumeFlow extends Flow<{ id: string; events: string[] }> {
      constructor() {
        super({ initialState: { id: "resume-flow", events: [] } });
      }

      review() {
        this.state.events.push("review");
        return "draft";
      }

      process(result: unknown) {
        this.state.events.push(`process:${this.lastHumanFeedback?.feedback ?? ""}`);
        return result;
      }
    }

    const initializers = [
      decorateMethod(ResumeFlow, "review", humanFeedback({
        message: "Review draft",
        provider: {
          requestFeedback: (context) => {
            throw new HumanFeedbackPending({ context });
          },
        },
      }) as unknown as Decorator),
      decorateMethod(ResumeFlow, "review", start() as unknown as Decorator),
      decorateMethod(ResumeFlow, "process", listen("review") as unknown as Decorator),
    ];
    const flow = new ResumeFlow();
    initializers.forEach((initializer) => {
      initializer.call(flow);
    });

    const paused = await flow.kickoff();

    expect(paused).toBeInstanceOf(HumanFeedbackPending);
    expect(flow.pendingFeedback).toMatchObject({
      flowId: "resume-flow",
      methodName: "review",
      output: "draft",
    });

    const output = await flow.resume("ship it");

    expect(output).toMatchObject({
      output: "draft",
      feedback: "ship it",
      outcome: null,
      methodName: "review",
    });
    expect(flow.pendingFeedback).toBeNull();
    expect(flow.lastHumanFeedback).toMatchObject({ feedback: "ship it" });
    expect(flow.state.events).toEqual(["review", "process:ship it"]);
    expect(flow.executionTrace.map((entry) => [entry.methodName, entry.input, entry.routerPath])).toEqual([
      ["review", "draft", null],
      ["process", expect.objectContaining({ feedback: "ship it" }), null],
    ]);
  });

  it("resumes human feedback router outcomes from pending state", async () => {
    class ResumeRoutingFlow extends Flow<{ events: string[] }> {
      constructor() {
        super({ initialState: { events: [] } });
      }

      review() {
        this.state.events.push("review");
        return "draft";
      }

      publish(outcome: string) {
        this.state.events.push(`publish:${outcome}`);
        return `published:${this.lastHumanFeedback?.feedback ?? ""}`;
      }
    }

    const initializers = [
      decorateMethod(ResumeRoutingFlow, "review", humanFeedback({
        message: "Approve?",
        emit: ["approved", "rejected"],
        defaultOutcome: "rejected",
        provider: {
          requestFeedback: (context) => {
            throw new HumanFeedbackPending({ context });
          },
        },
      }) as unknown as Decorator),
      decorateMethod(ResumeRoutingFlow, "review", start() as unknown as Decorator),
      decorateMethod(ResumeRoutingFlow, "publish", listen("approved") as unknown as Decorator),
    ];
    const flow = new ResumeRoutingFlow();
    initializers.forEach((initializer) => {
      initializer.call(flow);
    });

    await flow.kickoff();
    const output = await flow.resume("approved, looks good");

    expect(output).toBe("published:approved, looks good");
    expect(flow.lastHumanFeedback).toMatchObject({
      outcome: "approved",
      feedback: "approved, looks good",
    });
    expect(flow.state.events).toEqual(["review", "publish:approved"]);
    expect(flow.executionTrace.map((entry) => [entry.methodName, entry.output, entry.routerPath])).toEqual([
      ["review", "approved", "approved"],
      ["publish", "published:approved, looks good", null],
    ]);
  });

  it("rejects resume when no human feedback is pending", async () => {
    const flow = new Flow();

    await expect(flow.resume()).rejects.toThrow("Cannot resume flow without pending human feedback");
  });

  it("persists pending feedback and restores a flow with fromPending", async () => {
    const directory = mkdtempSync(join(tmpdir(), "crewai-ts-flow-persist-"));
    const persistence = new JsonFlowPersistence(directory);

    class PersistentFlow extends Flow<{ id: string; events: string[]; topic?: string }> {
      constructor() {
        super({
          initialState: { id: "persist-flow", events: [] },
          persistence,
        });
      }

      review(inputs: Record<string, unknown>) {
        this.state.topic = String(inputs.topic);
        this.state.events.push(`review:${this.state.topic}`);
        return "draft";
      }

      publish() {
        this.state.events.push(`publish:${this.lastHumanFeedback?.feedback ?? ""}`);
        return {
          topic: this.state.topic,
          feedback: this.lastHumanFeedback?.feedback,
        };
      }
    }

    const initializers = [
      decorateMethod(PersistentFlow, "review", humanFeedback({
        message: "Review draft",
        provider: {
          requestFeedback: (context) => {
            throw new HumanFeedbackPending({
              context,
              callbackInfo: { stored: true },
            });
          },
        },
      }) as unknown as Decorator),
      decorateMethod(PersistentFlow, "review", start() as unknown as Decorator),
      decorateMethod(PersistentFlow, "publish", listen("review") as unknown as Decorator),
    ];
    const flow = new PersistentFlow();
    initializers.forEach((initializer) => {
      initializer.call(flow);
    });

    const paused = await flow.kickoff({ inputs: { topic: "CrewAI" } });

    expect(paused).toBeInstanceOf(HumanFeedbackPending);
    await expect(persistence.loadPendingFeedback("persist-flow")).resolves.toMatchObject({
      state: {
        id: "persist-flow",
        topic: "CrewAI",
        events: ["review:CrewAI"],
      },
      context: {
        flowId: "persist-flow",
        methodName: "review",
        output: "draft",
      },
    });

    const restored = await PersistentFlow.from_pending("persist-flow", persistence);
    initializers.forEach((initializer) => {
      initializer.call(restored);
    });

    expect(restored.pendingFeedback).toMatchObject({
      flowId: "persist-flow",
      methodName: "review",
      output: "draft",
    });
    expect(restored.state).toMatchObject({
      id: "persist-flow",
      topic: "CrewAI",
      events: ["review:CrewAI"],
    });

    const output = await restored.resume("approved after reload");

    expect(output).toEqual({
      topic: "CrewAI",
      feedback: "approved after reload",
    });
    expect(restored.state.events).toEqual(["review:CrewAI", "publish:approved after reload"]);
    await expect(persistence.loadPendingFeedback("persist-flow")).resolves.toBeNull();
  });

  it("persists flow state and pending feedback with SQLiteFlowPersistence", async () => {
    const directory = mkdtempSync(join(tmpdir(), "crewai-ts-flow-sqlite-"));
    const persistence = new SQLiteFlowPersistence(join(directory, "flows.db"));

    class SQLitePersistentFlow extends Flow<{ id: string; events: string[]; topic?: string }> {
      constructor() {
        super({
          initialState: { id: "sqlite-flow", events: [] },
          persistence,
        });
      }

      review(inputs: Record<string, unknown>) {
        this.state.topic = String(inputs.topic);
        this.state.events.push(`review:${this.state.topic}`);
        return "draft";
      }

      publish() {
        this.state.events.push(`publish:${this.lastHumanFeedback?.feedback ?? ""}`);
        return this.state.events;
      }
    }

    const initializers = [
      decorateMethod(SQLitePersistentFlow, "review", humanFeedback({
        message: "Review draft",
        provider: {
          requestFeedback: (context) => {
            throw new HumanFeedbackPending({ context });
          },
        },
      }) as unknown as Decorator),
      decorateMethod(SQLitePersistentFlow, "review", start() as unknown as Decorator),
      decorateMethod(SQLitePersistentFlow, "publish", listen("review") as unknown as Decorator),
    ];
    const flow = new SQLitePersistentFlow();
    initializers.forEach((initializer) => {
      initializer.call(flow);
    });

    await expect(flow.kickoff({ inputs: { topic: "SQLite" } })).resolves.toBeInstanceOf(HumanFeedbackPending);
    await expect(persistence.loadState("sqlite-flow")).resolves.toMatchObject({
      id: "sqlite-flow",
      topic: "SQLite",
      events: ["review:SQLite"],
    });
    await expect(persistence.loadPendingFeedback("sqlite-flow")).resolves.toMatchObject({
      context: {
        flowId: "sqlite-flow",
        methodName: "review",
        output: "draft",
      },
    });

    const restored = await SQLitePersistentFlow.from_pending("sqlite-flow", persistence);
    initializers.forEach((initializer) => {
      initializer.call(restored);
    });

    await expect(restored.resume("approved")).resolves.toEqual(["review:SQLite", "publish:approved"]);
    await expect(persistence.loadPendingFeedback("sqlite-flow")).resolves.toBeNull();
    await expect(persistence.loadState("sqlite-flow")).resolves.toMatchObject({
      events: ["review:SQLite", "publish:approved"],
    });
  });

  it("supports upstream snake_case flow persistence methods for JSON and SQLite backends", async () => {
    const jsonDirectory = mkdtempSync(join(tmpdir(), "crewai-ts-flow-json-snake-"));
    const sqliteDirectory = mkdtempSync(join(tmpdir(), "crewai-ts-flow-sqlite-snake-"));
    const backends = [
      new JsonFlowPersistence(jsonDirectory),
      new SQLiteFlowPersistence(join(sqliteDirectory, "flows.db")),
    ];
    const context = {
      flowName: "SnakeFlow",
      flowClass: "SnakeFlow",
      flowId: "snake-flow",
      methodName: "review",
      output: "draft",
      message: "Review draft",
      requestedAt: new Date("2026-05-31T00:00:00.000Z"),
      emit: ["approved"],
      defaultOutcome: null,
      metadata: {},
    };

    for (const backend of backends) {
      expect(backend.persistence_type).toBeDefined();
      await backend.save_state("snake-flow", "begin", { id: "snake-flow", events: ["begin"] });
      await expect(backend.load_state("snake-flow")).resolves.toEqual({
        id: "snake-flow",
        events: ["begin"],
      });

      await backend.save_pending_feedback("snake-flow", context, {
        id: "snake-flow",
        events: ["begin", "review"],
      });
      await expect(backend.load_pending_feedback("snake-flow")).resolves.toMatchObject({
        state: { id: "snake-flow", events: ["begin", "review"] },
        context: {
          flowId: "snake-flow",
          methodName: "review",
          emit: ["approved"],
        },
      });
      await backend.clear_pending_feedback("snake-flow");
      await expect(backend.load_pending_feedback("snake-flow")).resolves.toBeNull();
    }
  });

  it("persists flow state after method completion and restores it with fromState", async () => {
    const directory = mkdtempSync(join(tmpdir(), "crewai-ts-flow-state-"));
    const persistence = new JsonFlowPersistence(directory);

    class PersistentStateFlow extends Flow<{ id: string; events: string[]; topic?: string; summary?: string }> {
      constructor() {
        super({
          initialState: { id: "state-flow", events: [] },
          persistence,
        });
      }

      begin(inputs: Record<string, unknown>) {
        this.state.topic = String(inputs.topic);
        this.state.events.push(`begin:${this.state.topic}`);
        return this.state.topic;
      }

      finish(topic: string) {
        this.state.summary = `summary:${topic}`;
        this.state.events.push(this.state.summary);
        return this.state.summary;
      }
    }

    const initializers = [
      decorateMethod(PersistentStateFlow, "begin", start() as unknown as Decorator),
      decorateMethod(PersistentStateFlow, "finish", listen("begin") as unknown as Decorator),
    ];
    const flow = new PersistentStateFlow();
    initializers.forEach((initializer) => {
      initializer.call(flow);
    });

    await flow.kickoff({ inputs: { topic: "CrewAI" } });

    await expect(persistence.loadState("state-flow")).resolves.toEqual({
      id: "state-flow",
      topic: "CrewAI",
      summary: "summary:CrewAI",
      events: ["begin:CrewAI", "summary:CrewAI"],
    });

    const restored = await PersistentStateFlow.from_state("state-flow", persistence);

    expect(restored.state).toEqual({
      id: "state-flow",
      topic: "CrewAI",
      summary: "summary:CrewAI",
      events: ["begin:CrewAI", "summary:CrewAI"],
    });
    await expect(PersistentStateFlow.from_state("missing", persistence))
      .rejects.toThrow("No persisted state found");
  });

  it("supports upstream-style @persist on a flow method", async () => {
    const directory = mkdtempSync(join(tmpdir(), "crewai-ts-flow-method-persist-"));
    const persistence = new JsonFlowPersistence(directory);

    class MethodPersistFlow extends Flow<{ id: string; events: string[]; topic?: string }> {
      constructor() {
        super({ initialState: { id: "method-persist-flow", events: [] } });
      }

      begin(inputs: Record<string, unknown>) {
        this.state.topic = String(inputs.topic);
        this.state.events.push(`begin:${this.state.topic}`);
        return this.state.topic;
      }
    }

    applyMethodDecorator(MethodPersistFlow, "begin", persist(persistence) as unknown as Decorator);
    const initializers = [
      decorateMethod(MethodPersistFlow, "begin", start() as unknown as Decorator),
    ];
    const flow = new MethodPersistFlow();
    initializers.forEach((initializer) => {
      initializer.call(flow);
    });

    await expect(flow.kickoff({ inputs: { topic: "CrewAI" } })).resolves.toBe("CrewAI");
    await expect(persistence.loadState("method-persist-flow")).resolves.toEqual({
      id: "method-persist-flow",
      topic: "CrewAI",
      events: ["begin:CrewAI"],
    });
  });

  it("supports upstream-style @persist on a flow class", async () => {
    const directory = mkdtempSync(join(tmpdir(), "crewai-ts-flow-class-persist-"));
    const persistence = new JsonFlowPersistence(directory);

    class ClassPersistFlow extends Flow<{ id: string; events: string[]; topic?: string; summary?: string }> {
      constructor() {
        super({ initialState: { id: "class-persist-flow", events: [] } });
      }

      begin(inputs: Record<string, unknown>) {
        this.state.topic = String(inputs.topic);
        this.state.events.push(`begin:${this.state.topic}`);
        return this.state.topic;
      }

      finish(topic: string) {
        this.state.summary = `summary:${topic}`;
        this.state.events.push(this.state.summary);
        return this.state.summary;
      }
    }

    const initializers = [
      decorateMethod(ClassPersistFlow, "begin", start() as unknown as Decorator),
      decorateMethod(ClassPersistFlow, "finish", listen("begin") as unknown as Decorator),
    ];
    const DecoratedClassPersistFlow = decorateClass(ClassPersistFlow, persist(persistence) as unknown as Decorator);
    const flow = new DecoratedClassPersistFlow();
    initializers.forEach((initializer) => {
      initializer.call(flow);
    });

    await expect(flow.kickoff({ inputs: { topic: "CrewAI" } })).resolves.toBe("summary:CrewAI");
    await expect(persistence.loadState("class-persist-flow")).resolves.toEqual({
      id: "class-persist-flow",
      topic: "CrewAI",
      summary: "summary:CrewAI",
      events: ["begin:CrewAI", "summary:CrewAI"],
    });
  });

  it("supports Flow kickoff and resume snake_case aliases", async () => {
    class AliasFlow extends Flow<{ events: string[] }> {
      constructor() {
        super({ initialState: { events: [] } });
      }

      begin() {
        this.state.events.push("begin");
        return "draft";
      }

      finish() {
        this.state.events.push(`finish:${this.lastHumanFeedback?.feedback ?? ""}`);
        return "finished";
      }
    }

    const initializers = [
      decorateMethod(AliasFlow, "begin", humanFeedback({
        message: "Review",
        provider: {
          requestFeedback: (context) => {
            throw new HumanFeedbackPending({ context });
          },
        },
      }) as unknown as Decorator),
      decorateMethod(AliasFlow, "begin", start() as unknown as Decorator),
      decorateMethod(AliasFlow, "finish", listen("begin") as unknown as Decorator),
    ];
    const flow = new AliasFlow();
    initializers.forEach((initializer) => {
      initializer.call(flow);
    });

    await expect(flow.kickoff_async()).resolves.toBeInstanceOf(HumanFeedbackPending);
    await expect(flow.resume_async("ok")).resolves.toBe("finished");
    expect(flow.state.events).toEqual(["begin", "finish:ok"]);
  });

  it("auto-configures flow memory and delegates remember, recall, and extract_memories", () => {
    class MemoryFlow extends Flow<{ id: string }> {
      constructor() {
        super({ initialState: { id: "memory-flow" }, name: "Memory Flow" });
      }
    }

    const flow = new MemoryFlow();
    const single = flow.remember("Flow remembers standard decorators", {
      categories: ["flow"],
      metadata: { source: "test" },
    });
    const batch = flow.remember([
      "Flow batch memory one",
      "Flow batch memory two",
    ], { categories: ["batch"] });

    expect(single).toBeInstanceOf(MemoryRecord);
    expect(batch).toEqual([]);
    expect(flow.recall("standard decorators", { scoreThreshold: null })[0]?.record.scope)
      .toBe("/flow/memory-flow");
    expect(flow.recall("batch", { categories: ["batch"], scoreThreshold: null })).toHaveLength(2);
    expect(flow.extract_memories("Remember this flow fact.")).toEqual(["Remember this flow fact."]);
  });

  it("uses explicitly configured flow memory and rejects memory helpers when disabled", () => {
    const memory = new Memory({ rootScope: "/custom" });
    const flow = new Flow({ memory });
    const disabled = new Flow({ memory: null });

    flow.remember("Custom flow memory");

    expect(memory.recall("custom", { scoreThreshold: null })[0]?.record.scope).toBe("/custom");
    expect(() => disabled.remember("no memory")).toThrow("No memory configured for this flow");
    expect(() => disabled.recall("no memory")).toThrow("No memory configured for this flow");
    expect(() => disabled.extract_memories("no memory")).toThrow("No memory configured for this flow");
  });

  it("runs conditional starts and repeated listeners from fresh triggers", async () => {
    class ConditionalStartFlow extends Flow<{ events: string[]; iteration: number }> {
      constructor() {
        super({
          initialState: { events: [], iteration: 0 },
          maxMethodCalls: 12,
        });
      }

      begin() {
        this.state.events.push("begin");
      }

      route() {
        this.state.iteration += 1;
        this.state.events.push(`route:${String(this.state.iteration)}`);
        return this.state.iteration < 3 ? "again" : "done";
      }

      repeatStart() {
        this.state.events.push(`repeat:${String(this.state.iteration)}`);
      }

      loopBack() {
        this.state.events.push(`loop:${String(this.state.iteration)}`);
      }
    }

    const initializers = [
      decorateMethod(ConditionalStartFlow, "begin", start() as unknown as Decorator),
      decorateMethod(ConditionalStartFlow, "route", router(or_("begin", "loopBack")) as unknown as Decorator),
      decorateMethod(ConditionalStartFlow, "repeatStart", start("again") as unknown as Decorator),
      decorateMethod(ConditionalStartFlow, "loopBack", listen("repeatStart") as unknown as Decorator),
    ];
    const flow = new ConditionalStartFlow();
    initializers.forEach((initializer) => {
      initializer.call(flow);
    });

    await flow.kickoff();

    expect(flow.state.events).toEqual([
      "begin",
      "route:1",
      "repeat:1",
      "loop:1",
      "route:2",
      "repeat:2",
      "loop:2",
      "route:3",
    ]);
    expect(flow.methodExecutionCounts.get("route")).toBe(3);
    expect(flow.methodExecutionCounts.get("repeatStart")).toBe(2);
  });

  it("resets runtime method tracking on each kickoff", async () => {
    class CountingFlow extends Flow<{ value: number }> {
      constructor() {
        super({ initialState: { value: 0 } });
      }

      begin(inputs: Record<string, unknown>) {
        this.state.value = Number(inputs.value);
        return this.state.value;
      }
    }

    const initializers = [
      decorateMethod(CountingFlow, "begin", start() as unknown as Decorator),
    ];
    const flow = new CountingFlow();
    initializers.forEach((initializer) => {
      initializer.call(flow);
    });

    await flow.kickoff({ inputs: { value: 1 } });
    await flow.kickoff({ inputs: { value: 2 } });

    expect(flow.methodOutputs).toEqual([2]);
    expect([...flow.completedMethods]).toEqual(["begin"]);
    expect(flow.executionTrace).toHaveLength(1);
  });

  it("serializes flow structure for visualization", () => {
    class StructureFlow extends Flow {
      begin() {
        return "ready";
      }

      decide() {
        return "approved";
      }

      approved() {
        return "done";
      }

      rejected() {
        return "stop";
      }
    }

    const initializers = [
      decorateMethod(StructureFlow, "begin", start() as unknown as Decorator),
      decorateMethod(StructureFlow, "decide", router("begin") as unknown as Decorator),
      decorateMethod(StructureFlow, "approved", listen(and_("approved", "begin")) as unknown as Decorator),
      decorateMethod(StructureFlow, "rejected", listen(or_("rejected")) as unknown as Decorator),
    ];
    const flow = new StructureFlow();
    initializers.forEach((initializer) => {
      initializer.call(flow);
    });

    const structure = getFlowStructure(flow);

    expect(structure.name).toBe("StructureFlow");
    expect(structure.startMethods).toEqual(["begin"]);
    expect(structure.routerMethods).toEqual(["decide"]);
    expect(structure.methods.find((method) => method.name === "approved")).toMatchObject({
      type: "listen",
      triggerMethods: ["approved", "begin"],
      conditionType: "AND",
    });
    expect(structure.methods.find((method) => method.name === "decide")?.routerPaths).toEqual(["rejected"]);
    expect(structure.edges).toContainEqual({
      from: "begin",
      to: "decide",
      type: "listen",
      conditionType: "OR",
      condition: null,
    });
    expect(structure.edges).toContainEqual({
      from: "rejected",
      to: "rejected",
      type: "route",
      conditionType: "OR",
      condition: "rejected",
    });
  });

  it("serializes upstream-compatible flow_structure metadata", () => {
    class SerializerFlow extends Flow<{ id: string; events: string[] }> {
      static description = "Serializer flow for Studio";

      constructor(topic = "CrewAI") {
        super({ initialState: { id: topic, events: [] } });
      }

      begin() {
        return "ready";
      }

      decide() {
        return "approved";
      }

      publish() {
        return new Crew();
      }
    }

    const initializers = [
      decorateMethod(SerializerFlow, "begin", start() as unknown as Decorator),
      decorateMethod(SerializerFlow, "decide", router("begin") as unknown as Decorator),
      decorateMethod(SerializerFlow, "publish", listen("approved") as unknown as Decorator),
    ];
    const flow = new SerializerFlow("flow-1");
    initializers.forEach((initializer) => {
      initializer.call(flow);
    });

    const serialized = flowStructure(flow);

    expect(serialized).toMatchObject({
      name: "SerializerFlow",
      description: "Serializer flow for Studio",
      inputs: ["topic"],
      state_schema: {
        fields: [
          { name: "id", type: "string", default: "flow-1" },
          { name: "events", type: "array", default: [] },
        ],
      },
    });
    expect(serialized.methods.find((method) => method.name === "decide")).toMatchObject({
      type: "router",
      trigger_methods: ["begin"],
      router_paths: ["approved"],
      has_human_feedback: false,
    });
    expect(serialized.methods.find((method) => method.name === "publish")).toMatchObject({
      type: "listen",
      has_crew: true,
    });
    expect(serialized.edges).toContainEqual({
      from_method: "decide",
      to_method: "publish",
      edge_type: "route",
      condition: "approved",
    });
  });

  it("propagates current flow context and captures it in FlowTrackable objects", async () => {
    class TrackedThing extends FlowTrackable {}

    class ContextFlow extends Flow<{ id: string; seen?: Record<string, unknown> }> {
      constructor() {
        super({ initialState: { id: "context-flow" } });
      }

      begin() {
        const tracked = new TrackedThing();
        this.state.seen = {
          flowRequestId: getCurrentFlowRequestId(),
          flowId: getCurrentFlowId(),
          methodName: getCurrentFlowMethodName(),
          trackedRequestId: tracked._request_id,
          trackedFlowId: tracked._flow_id,
        };
        return this.state.seen;
      }
    }

    const initializer = decorateMethod(ContextFlow, "begin", start() as unknown as Decorator);
    const flow = new ContextFlow();
    initializer.call(flow);

    const output = await flow.kickoff();

    expect(output).toMatchObject({
      flowId: "context-flow",
      methodName: "begin",
      trackedFlowId: "context-flow",
    });
    expect((output as Record<string, unknown>).flowRequestId).toEqual(expect.any(String));
    expect((output as Record<string, unknown>).trackedRequestId).toBe((output as Record<string, unknown>).flowRequestId);
    expect(getCurrentFlowRequestId()).toBeNull();
    expect(getCurrentFlowId()).toBeNull();
    expect(getCurrentFlowMethodName()).toBe("unknown");
  });

  it("exports and reloads flow execution data", async () => {
    class ExportableFlow extends Flow<{ id?: string; value: number; done?: boolean }> {
      constructor() {
        super({ initialState: { value: 0 } });
      }

      begin(inputs: Record<string, unknown>) {
        this.state.value = Number(inputs.value);
        return this.state.value;
      }

      finish(value: number) {
        this.state.done = true;
        return value * 2;
      }
    }

    const initializers = [
      decorateMethod(ExportableFlow, "begin", start() as unknown as Decorator),
      decorateMethod(ExportableFlow, "finish", listen("begin") as unknown as Decorator),
    ];
    const flow = new ExportableFlow();
    initializers.forEach((initializer) => {
      initializer.call(flow);
    });

    await flow.kickoff({ inputs: { id: "flow-1", value: 21 } });
    const executionData = flow.toExecutionData();

    expect(executionData.id).toBe("flow-1");
    expect(executionData.inputs).toEqual({ id: "flow-1", value: 21 });
    expect(executionData.completedMethods.map((method) => method.flowMethod.name)).toEqual(["begin", "finish"]);
    expect(executionData.executionMethods.map((method) => method.output)).toEqual([21, 42]);
    expect(executionData.finalState).toMatchObject({ id: "flow-1", value: 21, done: true });

    const restored = new ExportableFlow();
    initializers.forEach((initializer) => {
      initializer.call(restored);
    });
    restored.reload(executionData);

    expect(restored.state).toEqual(flow.state);
    expect(restored.methodOutputs).toEqual([21, 42]);
    expect([...restored.completedMethods]).toEqual(["begin", "finish"]);
    expect(restored.methodExecutionCounts.get("begin")).toBe(1);
    expect(restored.executionTrace.map((entry) => entry.methodName)).toEqual(["begin", "finish"]);
  });

  it("restores and forks flows from runtime checkpoints", async () => {
    class CheckpointFlow extends Flow<{ id: string; events: string[]; done?: boolean }> {
      constructor() {
        super({ initialState: { id: "flow-1", events: [] } });
      }

      begin() {
        this.state.events.push("begin");
        return "ready";
      }

      finish() {
        this.state.done = true;
        return "done";
      }
    }

    const initializers = [
      decorateMethod(CheckpointFlow, "begin", start() as unknown as Decorator),
      decorateMethod(CheckpointFlow, "finish", listen("begin") as unknown as Decorator),
    ];
    const flow = new CheckpointFlow();
    initializers.forEach((initializer) => {
      initializer.call(flow);
    });
    await flow.kickoff();
    const directory = mkdtempSync(join(tmpdir(), "crewai-ts-flow-checkpoint-"));
    const provider = new JsonProvider();
    const checkpointLocation = new RuntimeState({
      root: [flow],
      provider,
      branch: "main",
    }).checkpoint(directory);

    const restored = await CheckpointFlow.from_checkpoint(new CheckpointConfig({
      restore_from: checkpointLocation,
      provider,
    }));

    expect(restored).toBeInstanceOf(CheckpointFlow);
    expect(restored.state).toEqual({ id: "flow-1", events: ["begin"], done: true });
    expect(restored.methodOutputs).toEqual(["ready", "done"]);
    expect([...restored.completedMethods]).toEqual(["begin", "finish"]);
    expect(restored.methodExecutionCounts.get("finish")).toBe(1);
    expect(crewaiEventBus.runtime_state?.checkpoint_id).toBe(provider.extract_id(checkpointLocation));
    expect(crewaiEventBus.runtime_state?.root).toHaveLength(1);

    const forked = await CheckpointFlow.fork(new CheckpointConfig({
      restore_from: checkpointLocation,
      provider,
    }), "fork/manual");

    expect(forked.state.id).not.toBe("flow-1");
    expect(forked.state.events).toEqual(["begin"]);
    expect(forked.methodOutputs).toEqual(["ready", "done"]);
    expect(crewaiEventBus.runtime_state?.branch).toBe("fork/manual");
  });

  it("resumes kickoff from a checkpoint without replaying completed methods", async () => {
    class KickoffCheckpointFlow extends Flow<{ id: string; events: string[]; done?: boolean }> {
      static replayForbidden = false;

      constructor() {
        super({ initialState: { id: "flow-1", events: [] } });
      }

      begin() {
        if (KickoffCheckpointFlow.replayForbidden) {
          throw new Error("begin replayed");
        }
        this.state.events.push("begin");
        return "ready";
      }

      finish() {
        if (KickoffCheckpointFlow.replayForbidden) {
          throw new Error("finish replayed");
        }
        this.state.events.push("finish");
        this.state.done = true;
        return "done";
      }
    }

    const initializers = [
      decorateMethod(KickoffCheckpointFlow, "begin", start() as unknown as Decorator),
      decorateMethod(KickoffCheckpointFlow, "finish", listen("begin") as unknown as Decorator),
    ];
    const original = new KickoffCheckpointFlow();
    initializers.forEach((initializer) => {
      initializer.call(original);
    });
    await original.kickoff();
    const directory = mkdtempSync(join(tmpdir(), "crewai-ts-flow-kickoff-checkpoint-"));
    const provider = new JsonProvider();
    const checkpointLocation = new RuntimeState({
      root: [original],
      provider,
    }).checkpoint(directory);

    const resumed = new KickoffCheckpointFlow();
    initializers.forEach((initializer) => {
      initializer.call(resumed);
    });
    KickoffCheckpointFlow.replayForbidden = true;
    const output = await resumed.kickoff({
      from_checkpoint: new CheckpointConfig({
        restore_from: checkpointLocation,
        provider,
      }),
    });

    expect(output).toBe("done");
    expect(resumed.state).toEqual({ id: "flow-1", events: [] });
    const restored = await KickoffCheckpointFlow.from_checkpoint(new CheckpointConfig({
      restore_from: checkpointLocation,
      provider,
    }));
    expect(restored.state.events).toEqual(["begin", "finish"]);
  });

  it("mutates underlying state through locked flow proxies", () => {
    const listSource = ["a", "b"];
    const list = new LockedListProxy(listSource);

    expect([...list]).toEqual(["a", "b"]);
    expect(list.length).toBe(2);
    expect(list.includes("a")).toBe(true);
    list.push("c");
    list[1] = "B";
    expect(list.pop()).toBe("c");
    expect(listSource).toEqual(["a", "B"]);
    expect(list.toJSON()).toEqual(["a", "B"]);

    const dictSource = { count: 1, label: "old" };
    const dict = new LockedDictProxy(dictSource);
    dict.set("label", "new");
    dict.update({ extra: true });
    expect(dict.get("missing", "fallback")).toBe("fallback");
    expect(dict.has("extra")).toBe(true);
    expect([...dict.keys()]).toEqual(["count", "label", "extra"]);
    expect(dict.delete("count")).toBe(true);
    expect(dictSource).toEqual({ label: "new", extra: true });
    expect(dict.toJSON()).toEqual({ label: "new", extra: true });

    const state = { items: [1], meta: { a: 1 }, done: false };
    const proxy = new StateProxy(state);
    proxy.set("done", true);
    proxy.list("items").push(2);
    proxy.dict("meta").set("b", 2);

    expect(state).toEqual({ items: [1, 2], meta: { a: 1, b: 2 }, done: true });
    expect(proxy.model_dump()).toBe(state);
  });

  it("mirrors upstream collection helpers on locked flow proxies", () => {
    const listSource = ["b", "a", "b"];
    const list = new LockedListProxy(listSource) as LockedListProxy<string> & {
      append(item: string): void;
      insert(index: number, item: string): void;
      remove(item: string): void;
      index(value: string, start?: number, stop?: number): number;
      count(value: string): number;
      sort(options?: { reverse?: boolean }): void;
      reverse(): void;
      copy(): string[];
    };

    list.append("c");
    list.insert(1, "x");
    list.remove("b");
    expect(list.index("b")).toBe(2);
    expect(list.count("b")).toBe(1);
    list.sort();
    expect(list.copy()).toEqual(["a", "b", "c", "x"]);
    list.reverse();
    expect(listSource).toEqual(["x", "c", "b", "a"]);

    const dictSource = { a: 1, b: 2 };
    const dict = new LockedDictProxy(dictSource) as LockedDictProxy<Record<string, number>> & {
      pop(key: string, defaultValue?: number): number | undefined;
      setdefault(key: string, defaultValue: number): number;
      items(): IterableIterator<[string, number]>;
      copy(): Record<string, number>;
    };

    expect(dict.setdefault("c", 3)).toBe(3);
    expect(dict.setdefault("a", 9)).toBe(1);
    expect(dict.pop("b")).toBe(2);
    expect(dict.pop("missing", 4)).toBe(4);
    expect([...dict.items()]).toEqual([["a", 1], ["c", 3]]);
    expect(dict.copy()).toEqual({ a: 1, c: 3 });
    expect(dictSource).toEqual({ a: 1, c: 3 });
  });

  it("emits flow and method execution lifecycle events", async () => {
    class EventFlow extends Flow<{ value?: string }> {
      begin() {
        this.state.value = "started";
        return "begin-output";
      }

      finish(value: string) {
        this.state.value = value;
        return "done";
      }
    }

    const initializers = [
      decorateMethod(EventFlow, "begin", start() as unknown as Decorator),
      decorateMethod(EventFlow, "finish", listen("begin") as unknown as Decorator),
    ];
    const flow = new EventFlow();
    initializers.forEach((initializer) => {
      initializer.call(flow);
    });
    const events: CrewAIEvent[] = [];
    const eventTypes = [
      "flow_started",
      "method_execution_started",
      "method_execution_finished",
      "flow_finished",
    ] as const;
    const unsubscribe = eventTypes.map((eventType) =>
      crewaiEventBus.on(eventType, (_source, event) => {
        events.push(event);
      }),
    );

    await flow.kickoff();
    unsubscribe.forEach((off) => {
      off();
    });

    expect(events.map((event) => event.type)).toEqual([
      "flow_started",
      "method_execution_started",
      "method_execution_finished",
      "method_execution_started",
      "method_execution_finished",
      "flow_finished",
    ]);
    const finished = events.at(-1);
    expect(finished).toBeInstanceOf(FlowFinishedEvent);
    expect((finished as FlowFinishedEvent).result).toBe("done");
  });

  it("emits method and flow failure events", async () => {
    class FailedFlow extends Flow {
      begin() {
        throw new Error("boom");
      }
    }

    const initializers = [
      decorateMethod(FailedFlow, "begin", start() as unknown as Decorator),
    ];
    const flow = new FailedFlow();
    initializers.forEach((initializer) => {
      initializer.call(flow);
    });
    const events: CrewAIEvent[] = [];
    const unsubscribe = [
      crewaiEventBus.on("method_execution_failed", (_source, event) => {
        events.push(event);
      }),
      crewaiEventBus.on("flow_failed", (_source, event) => {
        events.push(event);
      }),
    ];

    await expect(flow.kickoff()).rejects.toThrow("boom");
    unsubscribe.forEach((off) => {
      off();
    });

    expect(events.map((event) => event.type)).toEqual(["method_execution_failed", "flow_failed"]);
    expect(events.map((event) => "error" in event ? event.error : null)).toEqual(["boom", "boom"]);
  });
});

describe("project config mapping", () => {
  it("loads YAML config and resolves decorated method references", async () => {
    const baseDirectory = mkdtempSync(join(tmpdir(), "crewai-ts-config-"));
    writeFileSync(
      join(baseDirectory, "agents.yaml"),
      [
        "researcher:",
        "  role: Researcher",
        "  goal: Find facts",
        "  backstory: Careful analyst",
        "  function_calling_llm: toolCallingModel",
        "  tools:",
        "    - searchTool",
        "  cache_handler: sharedCacheHandler",
        "  step_callback: recordStep",
        "  inject_date: true",
        "  date_format: \"%Y/%m/%d\"",
        "  max_retry_limit: 4",
        "  max_execution_time: 12",
        "  use_system_prompt: false",
        "  allow_code_execution: true",
        "  code_execution_mode: unsafe",
        "  respect_context_window: false",
        "  multimodal: true",
        "  system_template: \"SYS {{ .System }}\"",
        "  prompt_template: \"USR {{ .Prompt }}\"",
        "  response_template: \"RESP {{ .Response }}\"",
        "  guardrail: agentGuardrail",
        "  guardrail_max_retries: 5",
      ].join("\n"),
    );
    writeFileSync(
      join(baseDirectory, "tasks.yaml"),
      [
        "researchTask:",
        "  description: Research {topic}",
        "  expected_output: A concise brief",
        "  agent: researcher",
        "  callbacks:",
        "    - recordCallback",
        "  output_pydantic: structuredOutput",
        "  converter_cls: outputConverter",
        "  input_files:",
        "    notes:",
        "      filename: notes.txt",
        "      content: Config file content",
        "  allow_crewai_trigger_context: false",
        "  guardrails:",
        "    - appendGuardrail",
      ].join("\n"),
    );

    class ResearchCrew extends CrewProject {
      override baseDirectory = baseDirectory;
      override agentsConfig = "agents.yaml";
      override tasksConfig = "tasks.yaml";
      seenOutput = "";
      seenStep = "";
      sharedCache = new CacheHandler();

      searchTool() {
        return {
          name: "search",
          run: () => "tool result",
        };
      }

      recordCallback() {
        return (output: { raw: string }) => {
          this.seenOutput = output.raw;
        };
      }

      recordStep() {
        return (step: AgentStep) => {
          this.seenStep = step.output;
        };
      }

      sharedCacheHandler() {
        return this.sharedCache;
      }

      appendGuardrail() {
        return () => [true, "guarded output"] as const;
      }

      agentGuardrail() {
        return (output: string) => [true, output] as const;
      }

      outputConverter() {
        return (raw: string) => ({ summary: raw });
      }

      structuredOutput() {
        return (raw: string) => ({ structured: raw });
      }

      toolCallingModel() {
        return () => ({ toolName: "search", arguments: {} });
      }

      researcher() {
        return new Agent({
          ...agentOptionsFromConfig(this.agentConfig("researcher")),
          llm: (messages) => `report: ${messages.at(-1)?.content ?? ""}`,
        });
      }

      researchTask() {
        return new Task(taskOptionsFromConfig(this.taskConfig("researchTask")));
      }

      crew() {
        return new Crew({ process: Process.sequential });
      }
    }

    const initializers = [
      decorateMethod(ResearchCrew, "searchTool", tool),
      decorateMethod(ResearchCrew, "recordCallback", callback),
      decorateMethod(ResearchCrew, "recordStep", callback),
      decorateMethod(ResearchCrew, "sharedCacheHandler", cacheHandler),
      decorateMethod(ResearchCrew, "appendGuardrail", callback),
      decorateMethod(ResearchCrew, "agentGuardrail", callback),
      decorateMethod(ResearchCrew, "outputConverter", callback),
      decorateMethod(ResearchCrew, "structuredOutput", outputPydantic),
      decorateMethod(ResearchCrew, "toolCallingModel", llm),
      decorateMethod(ResearchCrew, "researcher", agent),
      decorateMethod(ResearchCrew, "researchTask", task),
      decorateMethod(ResearchCrew, "crew", crew),
    ];
    const instance = new ResearchCrew();
    initializers.forEach((initializer) => {
      initializer.call(instance);
    });
    const configuredAgent = instance.researcher();
    expect(configuredAgent.cacheHandler).toBe(instance.sharedCache);
    expect(configuredAgent.cache_handler).toBe(instance.sharedCache);
    expect(configuredAgent.toolsHandler.cache).toBe(instance.sharedCache);

    const output = await instance.crew().kickoff({
      inputs: { topic: "CrewAI" },
    });

    expect(output.raw).toBe("guarded output");
    expect(output.tasksOutput[0]?.agent).toBe("Researcher");
    expect(instance.researchTask().outputConverter).toEqual(expect.any(Function));
    expect(instance.researchTask().outputPydantic).toEqual(expect.any(Function));
    expect(instance.researchTask().inputFiles).toEqual({
      notes: {
        filename: "notes.txt",
        content: "Config file content",
      },
    });
    expect(instance.researchTask().allowCrewaiTriggerContext).toBe(false);
    expect(instance.researcher().injectDate).toBe(true);
    expect(instance.researcher().dateFormat).toBe("%Y/%m/%d");
    expect(instance.researcher().maxRetryLimit).toBe(4);
    expect(instance.researcher().maxExecutionTime).toBe(12);
    expect(instance.researcher().useSystemPrompt).toBe(false);
    expect(instance.researcher().allowCodeExecution).toBe(true);
    expect(instance.researcher().codeExecutionMode).toBe("unsafe");
    expect(instance.researcher().respectContextWindow).toBe(false);
    expect(instance.researcher().multimodal).toBe(true);
    expect(instance.researcher().systemTemplate).toBe("SYS {{ .System }}");
    expect(instance.researcher().promptTemplate).toBe("USR {{ .Prompt }}");
    expect(instance.researcher().responseTemplate).toBe("RESP {{ .Response }}");
    expect(instance.researcher().functionCallingLlm).toEqual(expect.any(Function));
    expect(instance.researcher().guardrail).toEqual(expect.any(Function));
    expect(instance.researcher().guardrailMaxRetries).toBe(5);
    expect(instance.seenOutput).toBe("guarded output");
    expect(instance.seenStep).toContain("tool result");
  });

  it("resolves outputJson decorator references in task config", () => {
    class JsonProject extends CrewProject {
      override tasksConfig = {
        jsonTask: {
          description: "Return data",
          expected_output: "Structured data",
          output_json: "jsonOutput",
        },
      };

      jsonOutput() {
        return (raw: string) => ({ value: raw });
      }
    }

    const initializers = [
      decorateMethod(JsonProject, "jsonOutput", outputJson),
    ];
    const instance = new JsonProject();
    initializers.forEach((initializer) => {
      initializer.call(instance);
    });

    const options = taskOptionsFromConfig(instance.taskConfig("jsonTask"));

    expect(options.outputJson).toBe(true);
    expect(options.outputConverter).toEqual(expect.any(Function));
  });

  it("preserves null context from task config as explicit no-context", () => {
    const options = taskOptionsFromConfig({
      description: "No context",
      expected_output: "No context output",
      context: null,
    });

    expect(options.context).toBeNull();
  });

  it("maps snake_case input_files from task config", () => {
    const options = taskOptionsFromConfig({
      description: "Read files",
      expected_output: "A file summary",
      input_files: {
        notes: {
          filename: "notes.txt",
          content: "Config notes",
        },
      },
    });

    expect(options.inputFiles).toEqual({
      notes: {
        filename: "notes.txt",
        content: "Config notes",
      },
    });
  });
});

describe("tools", () => {
  it("creates structured tools from plain functions with upstream-style tool helper", async () => {
    function add(a: unknown, b: unknown): number {
      return Number(a) + Number(b);
    }
    const addTool = createFunctionTool("add numbers", {
      description: "Add two numbers",
      resultAsAnswer: true,
    })(add);

    expect(addTool).toBeInstanceOf(StructuredTool);
    expect(addTool.name).toBe("add_numbers");
    expect(addTool.resultAsAnswer).toBe(true);
    expect(addTool.argsSchema).toMatchObject({
      a: { required: true },
      b: { required: true },
    });
    await expect(addTool.arun({ a: 2, b: 3 })).resolves.toBe(5);
  });

  it("validates structured tool args and enforces usage limits", async () => {
    const add = new StructuredTool({
      name: "add numbers",
      description: "Add two numbers",
      argsSchema: {
        a: { type: "number", required: true },
        b: { type: "number", required: true },
      },
      maxUsageCount: 1,
      func: ({ a, b }) => Number(a) + Number(b),
    });

    await expect(add.arun({ a: 2, b: 3 })).resolves.toBe(5);
    expect(() => add.run({ a: 1, b: 1 })).toThrow(ToolUsageLimitExceededError);
  });

  it("emits upstream-style ToolUsage error and finished events", () => {
    const seen: Array<ToolUsageErrorEvent | ToolUsageFinishedEvent> = [];
    crewaiEventBus.on("tool_usage_error", (_source, event) => {
      seen.push(event);
    });
    crewaiEventBus.on("tool_usage_finished", (_source, event) => {
      seen.push(event);
    });
    const usage = new ToolUsage({
      task: { id: "task-1", name: "", description: "Investigate", delegations: 2 },
      agent: { key: "agent-key", role: "Researcher" },
      fingerprint_context: { trace_id: "trace-1" },
    });
    const tool = { name: "Search Tool" };
    const calling = { tool_name: "Search Tool", arguments: { query: "CrewAI" } };
    const startedAt = Date.now() / 1000 - 1;

    usage.on_tool_error(tool, calling, new Error("failed lookup"));
    usage.on_tool_use_finished(tool, calling, true, startedAt, { result: "ok" });

    expect(seen[0]).toBeInstanceOf(ToolUsageErrorEvent);
    expect(seen[0]).toMatchObject({
      toolName: "search_tool",
      tool_name: "search_tool",
      toolArgs: { query: "CrewAI" },
      tool_args: { query: "CrewAI" },
      toolClass: "Object",
      tool_class: "Object",
      task_id: "task-1",
      task_name: "Investigate",
      run_attempts: 1,
      delegations: 2,
      agent_key: "agent-key",
      agent_role: "Researcher",
      trace_id: "trace-1",
    });
    expect((seen[0] as ToolUsageErrorEvent).error).toContain("failed lookup");
    expect(seen[1]).toBeInstanceOf(ToolUsageFinishedEvent);
    expect(seen[1]).toMatchObject({
      toolName: "search_tool",
      tool_name: "search_tool",
      fromCache: true,
      from_cache: true,
      output: { result: "ok" },
      task_id: "task-1",
      task_name: "Investigate",
    });
  });

  it("supports upstream structured tool invocation and snake_case aliases", async () => {
    function add(a: unknown, b: unknown): number {
      return Number(a) + Number(b);
    }
    const addTool = StructuredTool.from_function(
      add,
      "add numbers",
      "Add two numbers",
      true,
      {
        a: { type: "number", required: true },
        b: { type: "number", required: true },
      },
    );

    expect(addTool.args).toBe(addTool.argsSchema);
    expect(addTool.args_schema).toBe(addTool.argsSchema);
    expect(addTool.result_as_answer).toBe(true);
    expect(addTool.max_usage_count).toBeNull();
    expect(addTool.description_updated).toBe(false);
    expect(addTool.env_vars).toEqual([]);
    expect(addTool.invoke({ a: 2, b: 4 })).toBe(6);
    await expect(addTool.ainvoke(JSON.stringify({ a: 3, b: 4 }))).resolves.toBe(7);
    expect(addTool.current_usage_count).toBe(2);

    addTool.reset_usage_count();
    expect(addTool.currentUsageCount).toBe(0);
    expect(addTool.has_reached_max_usage_count()).toBe(false);
  });

  it("exposes upstream BaseTool metadata and LangChain conversion helpers", () => {
    const langchainTool = {
      name: "lookup docs",
      description: "Lookup documentation",
      func: ({ query }: { query: string }) => `found ${query}`,
    };
    const toolInstance = StructuredTool.from_langchain(langchainTool);

    expect(toolInstance).toBeInstanceOf(StructuredTool);
    expect(toolInstance.tool_type).toContain("StructuredTool");
    expect(toolInstance.invoke({ query: "CrewAI" })).toBe("found CrewAI");
    expect(StructuredTool.validate_max_usage_count(null)).toBeNull();
    expect(StructuredTool.validate_max_usage_count(2)).toBe(2);
    expect(() => StructuredTool.validate_max_usage_count(0)).toThrow("max_usage_count must be a positive integer");
    toolInstance.model_post_init();
  });

  it("exports upstream CrewStructuredTool and EnvVar runtime values", async () => {
    function multiply(a: unknown, b: unknown): number {
      return Number(a) * Number(b);
    }
    const envVar = new EnvVar({
      name: "SEARCH_API_KEY",
      description: "API key for search",
    });
    const multiplyTool = CrewStructuredTool.from_function(multiply, {
      name: "multiply numbers",
      description: "Multiply two numbers",
      return_direct: true,
      envVars: [envVar],
    });

    expect(CrewStructuredTool).toBe(StructuredTool);
    expect(multiplyTool).toBeInstanceOf(StructuredTool);
    expect(multiplyTool.name).toBe("multiply_numbers");
    expect(multiplyTool.result_as_answer).toBe(true);
    expect(multiplyTool.env_vars[0]).toBeInstanceOf(EnvVar);
    expect(multiplyTool.env_vars[0]).toMatchObject({
      name: "SEARCH_API_KEY",
      description: "API key for search",
      required: true,
      default: null,
    });
    await expect(multiplyTool.arun({ a: 3, b: 4 })).resolves.toBe(12);
  });

  it("caches structured tool results by normalized arguments", async () => {
    let calls = 0;
    const add = new StructuredTool({
      name: "add numbers",
      description: "Add two numbers",
      argsSchema: {
        a: { type: "number", required: true },
        b: { type: "number", required: true },
      },
      func: ({ a, b }) => {
        calls += 1;
        return Number(a) + Number(b);
      },
    });

    await expect(add.arun({ a: 2, b: 3 })).resolves.toBe(5);
    await expect(add.arun({ b: 3, a: 2 })).resolves.toBe(5);

    expect(calls).toBe(1);
    expect(add.currentUsageCount).toBe(1);
  });

  it("skips cache writes when cacheFunction returns false", async () => {
    let calls = 0;
    const toolInstance = new StructuredTool({
      name: "volatile",
      description: "Volatile result",
      cacheFunction: () => false,
      func: () => {
        calls += 1;
        return `call ${String(calls)}`;
      },
    });

    await expect(toolInstance.arun({ id: 1 })).resolves.toBe("call 1");
    await expect(toolInstance.arun({ id: 1 })).resolves.toBe("call 2");
    expect(calls).toBe(2);
  });

  it("can share a tool cache across tool instances", async () => {
    const cache = new InMemoryToolCache();
    let calls = 0;
    const first = new StructuredTool({
      name: "lookup",
      description: "Lookup",
      cache,
      func: () => {
        calls += 1;
        return "cached value";
      },
    });
    const second = new StructuredTool({
      name: "lookup",
      description: "Lookup",
      cache,
      func: () => {
        calls += 1;
        return "other value";
      },
    });

    await expect(first.arun({ q: "CrewAI" })).resolves.toBe("cached value");
    await expect(second.arun({ q: "CrewAI" })).resolves.toBe("cached value");
    expect(calls).toBe(1);
  });

  it("supports upstream-style cache and tools handlers", () => {
    const cache = new CacheHandler();
    const handler = new ToolsHandler({ cache });

    handler.on_tool_use({
      toolName: "Search Tool",
      arguments: { query: "CrewAI" },
    }, "search result");

    expect(handler.lastUsedTool).toEqual({
      toolName: "Search Tool",
      arguments: { query: "CrewAI" },
    });
    expect(handler.last_used_tool).toBe(handler.lastUsedTool);
    expect(cache.read("search_tool", JSON.stringify({ query: "CrewAI" }))).toBe("search result");

    handler.onToolUse({ toolName: "Hit Tool Cache", arguments: { query: "CrewAI" } }, "skip");
    expect(cache.read("hit_tool_cache", JSON.stringify({ query: "CrewAI" }))).toBeNull();

    const toolCache = cache.asToolCache();
    toolCache.write("lookup", "{\"id\":1}", "cached");
    expect(toolCache.read("lookup", "{\"id\":1}")).toEqual({ hit: true, value: "cached" });
    expect(toolCache.read("lookup", "{\"id\":2}")).toEqual({ hit: false });
  });

  it("executes agent actions and reports whether tool output is final", async () => {
    const cache = new CacheHandler();
    const handler = new ToolsHandler({ cache });
    const answer = new StructuredTool({
      name: "Final Answer Tool",
      description: "Answer directly",
      resultAsAnswer: true,
      argsSchema: {
        query: { type: "string", required: true },
      },
      func: ({ query }) => `answer:${String(query)}`,
    });
    const action = new AgentAction({
      thought: "Need a tool",
      tool: "Final Answer Tool",
      toolInput: "{\"query\":\"CrewAI\"}",
      text: "Thought: Need a tool\nAction: Final Answer Tool\nAction Input: {\"query\":\"CrewAI\"}",
    });

    const result = await executeToolAndCheckFinality(action, [answer], { toolsHandler: handler });

    expect(result).toBeInstanceOf(ToolResult);
    expect(result.result).toBe("answer:CrewAI");
    expect(result.resultAsAnswer).toBe(true);
    expect(result.result_as_answer).toBe(true);
    expect(handler.lastUsedTool?.toolName).toBe("final_answer_tool");
    expect(cache.read("final_answer_tool", JSON.stringify({ query: "CrewAI" }))).toBe("answer:CrewAI");
  });

  it("applies hooks for plain tools in upstream tool finality helper", async () => {
    const seen: string[] = [];
    beforeToolCall((context) => {
      seen.push(`before:${context.toolName}:${String(context.toolInput.topic)}`);
    });
    afterToolCall((context) => {
      seen.push(`after:${context.toolName}:${String(context.toolResult)}`);
      return `${String(context.toolResult)}!`;
    });
    const plainTool = {
      name: "plain lookup",
      description: "Lookup",
      run: (input?: string | Record<string, unknown>) => {
        const args = input && typeof input === "object" ? input : {};
        return `found:${String(args.topic)}`;
      },
    };
    const action = new AgentAction({
      thought: "Lookup",
      tool: "plain lookup",
      toolInput: "{\"topic\":\"CrewAI\"}",
      text: "Thought: Lookup\nAction: plain lookup\nAction Input: {\"topic\":\"CrewAI\"}",
    });

    const result = await aexecuteToolAndCheckFinality(action, [plainTool]);

    expect(result.result).toBe("found:CrewAI!");
    expect(result.resultAsAnswer).toBe(false);
    expect(seen).toEqual(["before:plain_lookup:CrewAI", "after:plain_lookup:found:CrewAI"]);
  });

  it("returns upstream-style wrong tool result without throwing", async () => {
    const result = await executeToolAndCheckFinality(new AgentAction({
      thought: "Use missing",
      tool: "missing",
      toolInput: "{}",
      text: "Thought: Use missing\nAction: missing\nAction Input: {}",
    }), []);

    expect(result.resultAsAnswer).toBe(false);
    expect(String(result.result)).toContain("You tried to use the tool missing");
  });

  it("feeds tool results back to the LLM before returning a final answer", async () => {
    const seenMessages: LLMMessage[][] = [];
    const search = new StructuredTool({
      name: "search",
      description: "Search for a topic",
      argsSchema: {
        query: { type: "string", required: true },
      },
      func: ({ query }) => `found ${String(query)}`,
    });
    const agent = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      tools: [search],
      llm: (messages) => {
        seenMessages.push([...messages]);
        if (!messages.some((message) => message.role === "tool")) {
          return { toolName: "search", arguments: { query: "CrewAI" } };
        }
        return `final: ${messages.at(-1)?.content ?? ""}`;
      },
    });

    await expect(agent.executeTask("Research CrewAI")).resolves.toContain("final: search result");
    expect(seenMessages).toHaveLength(2);
    expect(seenMessages[1]?.at(-1)).toEqual({
      role: "tool",
      content: "search result:\nfound CrewAI",
    });
  });

  it("creates a read_file tool for named input files", () => {
    const readFile = createReadFileTool({
      notes: {
        filename: "notes.txt",
        content: "Important notes",
      },
    });

    expect(readFile.run({ file_name: "notes" })).toBe("Important notes");
    expect(readFile.run({ file_name: "missing" })).toContain("Available files: notes");
  });

  it("extracts structured input files from plain inputs", () => {
    const extracted = extractInputFilesFromInputs({
      topic: "CrewAI",
      text: "docs/notes.md",
      notes: {
        filename: "notes.txt",
        content: "Important notes",
      },
      pathFile: {
        path: "docs/notes.md",
      },
    });

    expect(extracted.inputs).toEqual({ topic: "CrewAI", text: "docs/notes.md" });
    expect(extracted.inputFiles).toEqual({
      notes: {
        filename: "notes.txt",
        content: "Important notes",
      },
      pathFile: {
        path: "docs/notes.md",
      },
    });
  });

  it("automatically exposes direct agent input files through read_file", async () => {
    const agent = new Agent({
      role: "Reader",
      goal: "Read files",
      backstory: "Careful reader",
      llm: (messages, options) => {
        if (!messages.some((message) => message.role === "tool")) {
          expect(options?.tools?.map((toolInstance) => toolInstance.name)).toContain("read_file");
          return { toolName: "read_file", arguments: { file_name: "notes" } };
        }
        return `final: ${messages.at(-1)?.content ?? ""}`;
      },
    });

    await expect(agent.kickoff("Read notes", {
      inputFiles: {
        notes: {
          filename: "notes.txt",
          content: "Important notes",
        },
      },
    })).resolves.toContain("read_file result:\nImportant notes");
  });

  it("uses functionCallingLlm for tool selection and the main LLM for the final answer", async () => {
    const functionCalls: LLMMessage[][] = [];
    const mainCalls: LLMMessage[][] = [];
    const search = new StructuredTool({
      name: "search",
      description: "Search for a topic",
      argsSchema: {
        query: { type: "string", required: true },
      },
      func: ({ query }) => `found ${String(query)}`,
    });
    const agent = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      tools: [search],
      functionCallingLlm: (messages, options) => {
        functionCalls.push([...messages]);
        expect(options?.tools?.map((toolInstance) => toolInstance.name)).toEqual(["search"]);
        return { toolName: "search", arguments: { query: "CrewAI" } };
      },
      llm: (messages) => {
        mainCalls.push([...messages]);
        return `final from main: ${messages.at(-1)?.content ?? ""}`;
      },
    });

    await expect(agent.executeTask("Research CrewAI")).resolves.toContain("final from main: search result");

    expect(functionCalls).toHaveLength(1);
    expect(mainCalls).toHaveLength(1);
    expect(mainCalls[0]?.at(-1)).toEqual({
      role: "tool",
      content: "search result:\nfound CrewAI",
    });
  });

  it("passes crew-level functionCallingLlm to agents without one", async () => {
    const functionCalls: string[] = [];
    const mainCalls: string[] = [];
    const search = new StructuredTool({
      name: "search",
      description: "Search",
      func: () => "crew tool result",
    });
    const agent = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      tools: [search],
      llm: (messages) => {
        mainCalls.push(messages.at(-1)?.role ?? "");
        return messages.at(-1)?.content ?? "";
      },
    });
    const taskInstance = new Task({
      description: "Research",
      expectedOutput: "A report",
      agent,
    });

    const output = await new Crew({
      agents: [agent],
      tasks: [taskInstance],
      functionCallingLlm: () => {
        functionCalls.push("crew");
        return { toolName: "search", arguments: {} };
      },
    }).kickoff();

    expect(output.raw).toContain("crew tool result");
    expect(functionCalls).toEqual(["crew"]);
    expect(mainCalls).toEqual(["tool"]);
  });

  it("prefers agent-level functionCallingLlm over the crew-level one", async () => {
    const functionCalls: string[] = [];
    const search = new StructuredTool({
      name: "search",
      description: "Search",
      func: () => "agent-selected tool",
    });
    const agent = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      tools: [search],
      functionCallingLlm: () => {
        functionCalls.push("agent");
        return { toolName: "search", arguments: {} };
      },
      llm: (messages) => messages.at(-1)?.content ?? "",
    });

    const output = await new Crew({
      agents: [agent],
      tasks: [new Task({ description: "Research", expectedOutput: "A report", agent })],
      functionCallingLlm: () => {
        functionCalls.push("crew");
        return "crew final";
      },
    }).kickoff();

    expect(output.raw).toContain("agent-selected tool");
    expect(functionCalls).toEqual(["agent"]);
  });

  it("returns tool output directly for resultAsAnswer tools", async () => {
    const search = new StructuredTool({
      name: "search",
      description: "Search for a topic",
      resultAsAnswer: true,
      func: () => "direct tool answer",
    });
    const agent = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      tools: [search],
      llm: () => ({ toolName: "search", arguments: {} }),
    });

    await expect(agent.executeTask("Research CrewAI")).resolves.toBe("direct tool answer");
  });

  it("fails when tool use never reaches a final answer before maxIter", async () => {
    const search = new StructuredTool({
      name: "search",
      description: "Search for a topic",
      func: () => "found",
    });
    const agent = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      tools: [search],
      maxIter: 2,
      llm: () => ({ toolName: "search", arguments: {} }),
    });

    await expect(agent.executeTask("Research CrewAI")).rejects.toThrow("max iterations");
  });

  it("invokes agent step callbacks for tool and final steps", async () => {
    const steps: AgentStep[] = [];
    const search = new StructuredTool({
      name: "search",
      description: "Search for a topic",
      func: () => "found CrewAI",
    });
    const agentInstance = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      tools: [search],
      stepCallback: (step) => {
        steps.push(step);
      },
      llm: (messages) => messages.some((message) => message.role === "tool")
        ? "final answer"
        : { toolName: "search", arguments: { query: "CrewAI" } },
    });

    await expect(agentInstance.executeTask("Research CrewAI")).resolves.toBe("final answer");

    expect(steps).toEqual([
      {
        type: "tool",
        agentRole: "Researcher",
        iteration: 0,
        toolName: "search",
        toolArgs: { query: "CrewAI" },
        output: "found CrewAI",
        resultAsAnswer: false,
      },
      {
        type: "final",
        agentRole: "Researcher",
        iteration: 1,
        output: "final answer",
      },
    ]);
  });

  it("throttles iterative LLM calls with agent maxRpm", async () => {
    const callTimes: number[] = [];
    const search = new StructuredTool({
      name: "search",
      description: "Search",
      func: () => "tool result",
    });
    const agentInstance = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      tools: [search],
      maxRpm: 6000,
      llm: (messages) => {
        callTimes.push(performance.now());
        return messages.some((message) => message.role === "tool")
          ? "final"
          : { toolName: "search", arguments: {} };
      },
    });

    await expect(agentInstance.executeTask("Research")).resolves.toBe("final");

    expect(callTimes).toHaveLength(2);
    expect((callTimes[1] ?? 0) - (callTimes[0] ?? 0)).toBeGreaterThanOrEqual(8);
  });

  it("prefers task tools over agent tools during task execution", async () => {
    const agentTool = new StructuredTool({
      name: "source",
      description: "Agent-level source",
      func: () => "agent tool",
    });
    const taskTool = new StructuredTool({
      name: "source",
      description: "Task-level source",
      func: () => "task tool",
    });
    const agent = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      tools: [agentTool],
    });
    const taskInstance = new Task({
      description: "Research {topic}",
      expectedOutput: "A concise brief",
      agent,
      tools: [taskTool],
    });

    const output = await taskInstance.execute({ topic: "CrewAI" });

    expect(output.raw).toContain("task tool");
    expect(output.raw).not.toContain("agent tool");
  });
});

describe("LLM providers", () => {
  it("provides upstream BaseLLM defaults, stop handling, config, and token usage helpers", async () => {
    class DemoLLM extends BaseLLM {
      call(messages: readonly LLMMessage[]): string {
        this._track_token_usage_internal({
          prompt_tokens: 10,
          completion_tokens: 4,
          prompt_tokens_details: { cached_tokens: 3 },
          reasoning_tokens: 2,
          cache_creation_tokens: 1,
        });
        return this._apply_stop_words(messages.at(-1)?.content ?? "");
      }
    }
    const llm = new DemoLLM({
      model: "demo/model",
      stop_sequences: ["STOP"],
      api_key: "key",
      base_url: "https://example.test",
      additional_params: { top_p: 0.8 },
    });

    expect(llm.stop_sequences).toEqual(["STOP"]);
    expect(llm.supports_stop_words()).toBe(DEFAULT_SUPPORTS_STOP_WORDS);
    expect(llm.get_context_window_size()).toBe(DEFAULT_CONTEXT_WINDOW_SIZE);
    expect(llm.supports_multimodal()).toBe(false);
    expect(llm.format_text_content("hello")).toEqual({ type: "text", text: "hello" });
    expect(llm.get_file_uploader()).toBeNull();
    expect(llm.to_config_dict()).toMatchObject({
      model: "demo/model",
      api_key: "key",
      base_url: "https://example.test",
      provider: "openai",
      stop: ["STOP"],
      additional_params: { top_p: 0.8 },
    });

    await expect(callLLM(llm, [{ role: "user", content: "answer STOP trailing" }])).resolves.toBe("answer");
    expect(llm.get_token_usage_summary()).toEqual({
      totalTokens: 14,
      promptTokens: 10,
      cachedPromptTokens: 3,
      completionTokens: 4,
      reasoningTokens: 2,
      cacheCreationTokens: 1,
      successfulRequests: 1,
    });
    expect(getLLMUsageMetrics({
      call: () => "ok",
      get_token_usage_summary: () => ({
        total_tokens: 7,
        prompt_tokens: 5,
        completion_tokens: 2,
        successful_requests: 1,
      }),
    })).toMatchObject({
      totalTokens: 7,
      promptTokens: 5,
      completionTokens: 2,
      successfulRequests: 1,
    });
  });

  it("scopes LLM call ids and stop overrides without mutating the base LLM", async () => {
    const callIds: string[] = [];
    class StopAwareLLM extends BaseLLM {
      call(messages: readonly LLMMessage[]): string {
        callIds.push(get_current_call_id());
        return this._apply_stop_words(messages.at(-1)?.content ?? "");
      }
    }
    const llm = new StopAwareLLM({
      model: "demo/model",
      stop: ["BASE"],
    });

    let scopedCallId = "";
    await llm_call_context(async (callId) => {
      scopedCallId = callId;
      expect(get_current_call_id()).toBe(callId);
      await call_stop_override(llm, ["TEMP"], () => {
        expect(llm.stop_sequences).toEqual(["TEMP"]);
        expect(llm.stop).toEqual(["BASE"]);
        expect(llm._apply_stop_words("alpha TEMP beta BASE gamma")).toBe("alpha");
      });
      expect(llm.stop_sequences).toEqual(["BASE"]);
    });
    expect(scopedCallId).toMatch(/[0-9a-f-]{36}/);

    await expect(callLLM(llm, [{ role: "user", content: "answer BASE trailing" }])).resolves.toBe("answer");
    expect(callIds).toHaveLength(1);
    expect(callIds[0]).toMatch(/[0-9a-f-]{36}/);
  });

  it("validates structured LLM output from direct or embedded JSON", () => {
    const summaryModel = {
      name: "SummaryModel",
      model_validate(value: unknown) {
        if (!value || typeof value !== "object" || typeof (value as { summary?: unknown }).summary !== "string") {
          throw new Error("summary is required");
        }
        return { summary: (value as { summary: string }).summary };
      },
    };

    expect(validate_structured_output("prefix {\"summary\":\"done\"} suffix", summaryModel)).toEqual({
      summary: "done",
    });
    expect(BaseLLM._validate_structured_output("{\"summary\":\"direct\"}", summaryModel)).toEqual({
      summary: "direct",
    });
    expect(BaseLLM._extract_provider("anthropic/claude-sonnet-4")).toBe("anthropic");
    expect(extract_provider("gpt-4o")).toBe("openai");
    expect(() => validate_structured_output("no json here", summaryModel))
      .toThrow("Failed to parse response into SummaryModel");
  });

  it("emits upstream-style BaseLLM call and streaming events with scoped call ids", async () => {
    const events: CrewAIEvent[] = [];
    crewaiEventBus.on("llm_call_started", (_source, event) => {
      events.push(event);
    });
    crewaiEventBus.on("llm_stream_chunk", (_source, event) => {
      events.push(event);
    });
    crewaiEventBus.on("llm_thinking_chunk", (_source, event) => {
      events.push(event);
    });
    crewaiEventBus.on("llm_call_completed", (_source, event) => {
      events.push(event);
    });
    crewaiEventBus.on("llm_call_failed", (_source, event) => {
      events.push(event);
    });
    class EventLLM extends BaseLLM {
      call(): string {
        return "done";
      }
    }
    const llm = new EventLLM({ model: "demo/model" });

    await llm_call_context((callId) => {
      llm._emit_call_started_event({
        messages: [{ role: "user", content: "hello" }],
        tools: [{ name: "search" }],
        callbacks: ["callback"],
        available_functions: { search: "registered" },
      });
      llm._emit_stream_chunk_event({
        chunk: "partial",
        call_type: LLMCallType.LLM_CALL,
        response_id: "response-1",
      });
      llm._emit_thinking_chunk_event({
        chunk: "thinking",
        response_id: "response-1",
      });
      llm._emit_call_completed_event({
        response: "done",
        callType: LLMCallType.LLM_CALL,
        messages: "hello",
        usage: { total_tokens: 3 },
      });
      llm._emit_call_failed_event({ error: "boom" });

      expect(events.map((event) => "call_id" in event ? event.call_id : null)).toEqual([
        callId,
        callId,
        callId,
        callId,
        callId,
      ]);
    });

    expect(events[0]).toBeInstanceOf(LLMCallStartedEvent);
    expect((events[0] as LLMCallStartedEvent).model).toBe("demo/model");
    expect((events[0] as LLMCallStartedEvent).tools).toEqual([{ name: "search" }]);
    expect((events[1] as LLMStreamChunkEvent).chunk).toBe("partial");
    expect((events[2] as LLMThinkingChunkEvent).chunk).toBe("thinking");
    expect((events[3] as LLMCallCompletedEvent).usage).toEqual({ total_tokens: 3 });
    expect((events[4] as LLMCallFailedEvent).error).toBe("boom");
  });

  it("handles BaseLLM tool execution with tool usage and LLM completion events", async () => {
    const events: CrewAIEvent[] = [];
    crewaiEventBus.on("tool_usage_started", (_source, event) => {
      events.push(event);
    });
    crewaiEventBus.on("tool_usage_finished", (_source, event) => {
      events.push(event);
    });
    crewaiEventBus.on("tool_usage_error", (_source, event) => {
      events.push(event);
    });
    crewaiEventBus.on("llm_call_completed", (_source, event) => {
      events.push(event);
    });
    crewaiEventBus.on("llm_call_failed", (_source, event) => {
      events.push(event);
    });
    class ToolLLM extends BaseLLM {
      call(): string {
        return "done";
      }
    }
    const llm = new ToolLLM({ model: "demo/model" });

    await llm_call_context(async (callId) => {
      await expect(llm._handle_tool_execution({
        function_name: "lookup",
        function_args: { query: "CrewAI" },
        available_functions: {
          lookup: ({ query }) => ({ result: `found ${String(query)}` }),
        },
      })).resolves.toBe(JSON.stringify({ result: "found CrewAI" }));
      await expect(llm._handle_tool_execution({
        function_name: "explode",
        function_args: { query: "CrewAI" },
        available_functions: {
          explode: () => {
            throw new Error("failed lookup");
          },
        },
      })).resolves.toBeNull();

      expect((events[2] as LLMCallCompletedEvent).call_id).toBe(callId);
      expect((events[5] as LLMCallFailedEvent).call_id).toBe(callId);
    });

    expect(events[0]).toBeInstanceOf(ToolUsageStartedEvent);
    expect((events[0] as ToolUsageStartedEvent).toolName).toBe("lookup");
    expect(events[1]).toBeInstanceOf(ToolUsageFinishedEvent);
    expect((events[1] as ToolUsageFinishedEvent).output).toEqual({ result: "found CrewAI" });
    expect((events[2] as LLMCallCompletedEvent).call_type).toBe(LLMCallType.TOOL_CALL);
    expect(events[3]).toBeInstanceOf(ToolUsageStartedEvent);
    expect(events[4]).toBeInstanceOf(ToolUsageErrorEvent);
    expect((events[4] as ToolUsageErrorEvent).error).toContain("failed lookup");
    expect(events[5]).toBeInstanceOf(LLMCallFailedEvent);
  });

  it("formats BaseLLM messages without mutating cache breakpoints", () => {
    class MessageLLM extends BaseLLM {
      call(): string {
        return "done";
      }
    }
    const llm = new MessageLLM({ model: "demo/model" });
    const marked = mark_cache_breakpoint({
      role: "system" as const,
      content: "Stable prompt",
    });

    expect(llm._format_messages("hello")).toEqual([{ role: "user", content: "hello" }]);
    expect(llm._format_messages([marked])).toEqual([{ role: "system", content: "Stable prompt" }]);
    expect(marked.cache_breakpoint).toBe(true);
    expect(() => llm._format_messages([{ role: "user" }])).toThrow("must have 'role' and 'content' keys");
    expect(() => llm._format_messages([{ role: "user", content: "with file", files: { image: { filename: "image.png", content: "..." } } }]))
      .toThrow("does not support multimodal input");
  });

  it("formats multimodal message files and exposes provider file uploaders", () => {
    class VisionLLM extends BaseLLM {
      call(): string {
        return "done";
      }

      override supportsMultimodal(): boolean {
        return true;
      }
    }
    const inline = new VisionLLM({ model: "demo/vision" })._format_messages([{
      role: "user",
      content: "Inspect this file",
      files: {
        notes: { filename: "notes.txt", content: "CrewAI notes", contentType: "text/plain" },
      },
    }]);

    expect(inline[0]?.files).toBeUndefined();
    expect(inline[0]?.content).toEqual([
      { type: "text", text: "Inspect this file" },
      {
        type: "file",
        source: "inline",
        name: "notes",
        filename: "notes.txt",
        content_type: "text/plain",
        content: "CrewAI notes",
      },
    ]);

    const openai = new OpenAICompletion({ model: "gpt-4o", prefer_upload: true });
    const uploader = openai.get_file_uploader();
    const uploaded = openai._format_messages([{
      role: "user",
      content: "Inspect uploaded file",
      files: {
        notes: { filename: "notes.txt", content: "CrewAI notes", contentType: "text/plain" },
      },
    }]);

    expect(uploader).toMatchObject({ provider: "openai" });
    expect(uploaded[0]?.content).toEqual([
      { type: "text", text: "Inspect uploaded file" },
      {
        type: "file",
        source: "upload",
        name: "notes",
        filename: "notes.txt",
        file_id: "openai-file-1",
        content_type: "text/plain",
      },
    ]);
    expect(openai.get_file_uploader()?.uploads).toEqual([]);
    expect(new AnthropicCompletion({ model: "claude-3-5-sonnet-20241022" }).get_file_uploader()).toMatchObject({ provider: "anthropic" });
    expect(new GeminiCompletion({ model: "gemini-2.5-flash" }).get_file_uploader()).toMatchObject({ provider: "gemini" });
    expect(new BedrockCompletion({ model: "amazon.nova-pro-v1:0" }).get_file_uploader()).toMatchObject({ provider: "bedrock" });
  });

  it("uses upstream-style context window sizing and stop-word support rules", () => {
    class WindowLLM extends BaseLLM {
      call(): string {
        return "done";
      }
    }
    const gpt4o = new WindowLLM({ model: "gpt-4o-mini" });
    const custom = new WindowLLM({ model: "custom-model", context_window_size: 12345 });
    const gpt5 = new WindowLLM({ model: "gpt-5" });

    expect(gpt4o.get_context_window_size()).toBe(Math.trunc(200000 * CONTEXT_WINDOW_USAGE_RATIO));
    expect(context_window_size_for_model("gemini-1.5-pro")).toBe(Math.trunc(2097152 * CONTEXT_WINDOW_USAGE_RATIO));
    expect(context_window_size_for_model("unknown-model")).toBe(Math.trunc(DEFAULT_CONTEXT_WINDOW_SIZE * CONTEXT_WINDOW_USAGE_RATIO));
    expect(custom.get_context_window_size()).toBe(12345);
    expect(gpt5.supports_stop_words()).toBe(false);
    expect(() => {
      validate_context_window_sizes({ tiny: 10 });
    }).toThrow("Context window for tiny");
  });

  it("exposes function-calling and response-chain provider parity helpers", () => {
    class FallbackLLM extends BaseLLM {
      call(): string {
        return "done";
      }
    }

    const fallback = new FallbackLLM({ model: "unknown/model" });
    const openai = new OpenAICompletion({
      model: "gpt-4o-mini",
      previous_response_id: "resp-1",
      auto_chain_reasoning: true,
    });
    const o1 = new OpenAICompletion({ model: "o1-mini" });
    const azureOpenAI = new AzureCompletion({
      model: "gpt-4o",
      endpoint: "https://example.openai.azure.com/openai/deployments/gpt-4o",
      previous_response_id: "az-resp-1",
    });
    const azureExternal = new AzureCompletion({
      model: "mistral-large",
      endpoint: "https://models.inference.ai.azure.com",
    });

    expect(fallback.supports_function_calling()).toBe(true);
    expect(openai.supports_function_calling()).toBe(true);
    expect(o1.supports_function_calling()).toBe(false);
    expect(new AnthropicCompletion({ model: "claude-sonnet-4-5" }).supports_function_calling()).toBe(true);
    expect(new BedrockCompletion({ model: "anthropic.claude-3-5-sonnet-20241022-v2:0" }).supports_function_calling()).toBe(true);
    expect(azureOpenAI.supports_function_calling()).toBe(true);
    expect(azureExternal.supports_function_calling()).toBe(false);
    expect(azureOpenAI.supports_stop_words()).toBe(true);
    expect(new AzureCompletion({ model: "o3-mini" }).supports_stop_words()).toBe(false);

    expect(openai.last_response_id).toBe("resp-1");
    expect(openai.last_reasoning_items).toEqual([]);
    openai.reset_reasoning_chain();
    expect(openai.last_reasoning_items).toEqual([]);
    openai.reset_chain();
    expect(openai.last_response_id).toBeNull();
    expect(azureOpenAI.last_response_id).toBe("az-resp-1");
    azureOpenAI.reset_chain();
    expect(azureOpenAI.last_response_id).toBeNull();
  });

  it("prepares OpenAI chat and responses request parameters without SDK side effects", () => {
    const search = new StructuredTool({
      name: "search docs",
      description: "Search documentation",
      argsSchema: {
        query: { type: "string", description: "Search query" },
      },
      func: () => "result",
    });
    const chat = new OpenAICompletion({
      model: "gpt-4o",
      temperature: 0.2,
      top_p: 0.8,
      frequency_penalty: 0.1,
      presence_penalty: 0.2,
      max_tokens: 300,
      seed: 7,
      stream: true,
      response_format: { type: "json_object" },
      additional_params: { user: "tester", provider: "crewai-internal" },
    });

    expect((chat as unknown as {
      _prepare_completion_params(messages: LLMMessage[], tools?: StructuredTool[]): Record<string, unknown>;
    })._prepare_completion_params([{ role: "user", content: "Find CrewAI" }], [search])).toMatchObject({
      model: "gpt-4o",
      messages: [{ role: "user", content: "Find CrewAI" }],
      stream: true,
      stream_options: { include_usage: true },
      temperature: 0.2,
      top_p: 0.8,
      frequency_penalty: 0.1,
      presence_penalty: 0.2,
      max_tokens: 300,
      seed: 7,
      response_format: { type: "json_object" },
      user: "tester",
      tools: [{
        type: "function",
        function: {
          name: "search_docs",
          description: "Search documentation",
          strict: true,
          parameters: {
            type: "object",
            additionalProperties: false,
            properties: {
              query: { type: "string", description: "Search query" },
            },
            required: ["query"],
          },
        },
      }],
      tool_choice: "auto",
    });

    const responses = new OpenAICompletion({
      model: "gpt-4.1",
      api: "responses",
      instructions: "Follow policy",
      previous_response_id: "resp-prev",
      include: ["file_search_call.results"],
      builtin_tools: ["web_search", "file_search"],
      auto_chain_reasoning: true,
      max_completion_tokens: 256,
      reasoning_effort: "medium",
      store: false,
    });
    const responseParams = (responses as unknown as {
      _prepare_responses_params(messages: LLMMessage[], tools?: StructuredTool[]): Record<string, unknown>;
    })._prepare_responses_params([
      { role: "system", content: "Be concise" },
      { role: "user", content: "Find CrewAI" },
    ], [search]);

    expect(responseParams).toMatchObject({
      model: "gpt-4.1",
      input: [{ role: "user", content: "Find CrewAI" }],
      instructions: "Follow policy\n\nBe concise",
      previous_response_id: "resp-prev",
      include: ["file_search_call.results", "reasoning.encrypted_content"],
      store: false,
      max_output_tokens: 256,
      reasoning: { effort: "medium" },
      tools: [
        { type: "web_search_preview" },
        { type: "file_search" },
        {
          type: "function",
          name: "search_docs",
          description: "Search documentation",
          strict: true,
        },
      ],
    });
  });

  it("extracts OpenAI token usage from SDK response shapes", () => {
    const openai = new OpenAICompletion({ model: "gpt-4o" });

    expect((openai as unknown as {
      _extract_openai_token_usage(response: unknown): Record<string, number>;
    })._extract_openai_token_usage({
      usage: {
        prompt_tokens: 12,
        completion_tokens: 8,
        total_tokens: 20,
        prompt_tokens_details: { cached_tokens: 5 },
        completion_tokens_details: { reasoning_tokens: 3 },
      },
    })).toEqual({
      prompt_tokens: 12,
      completion_tokens: 8,
      total_tokens: 20,
      cached_prompt_tokens: 5,
      reasoning_tokens: 3,
    });

    expect((openai as unknown as {
      _extract_openai_token_usage(response: unknown): Record<string, number>;
    })._extract_openai_token_usage({})).toEqual({ total_tokens: 0 });
  });

  it("extracts OpenAI Responses API usage, function calls, and reasoning items", () => {
    const openai = new OpenAICompletion({ model: "gpt-4.1", api: "responses" });
    const reasoningItem = {
      type: "reasoning",
      id: "rs_1",
      status: "completed",
      summary: [{ type: "summary_text", text: "Need search" }],
      encrypted_content: "encrypted",
    };
    const response = {
      id: "resp_1",
      output_text: "Final answer",
      usage: {
        input_tokens: 11,
        output_tokens: 7,
        total_tokens: 18,
        input_tokens_details: { cached_tokens: 4 },
        output_tokens_details: { reasoning_tokens: 3 },
      },
      output: [
        reasoningItem,
        { type: "function_call", call_id: "call_1", name: "search_docs", arguments: "{\"query\":\"CrewAI\"}" },
      ],
    };

    expect((openai as unknown as {
      _extract_responses_token_usage(response: unknown): Record<string, number>;
    })._extract_responses_token_usage(response)).toEqual({
      prompt_tokens: 11,
      completion_tokens: 7,
      total_tokens: 18,
      cached_prompt_tokens: 4,
      reasoning_tokens: 3,
    });
    expect((openai as unknown as {
      _extract_function_calls_from_response(response: unknown): Record<string, unknown>[];
    })._extract_function_calls_from_response(response)).toEqual([
      { id: "call_1", name: "search_docs", arguments: "{\"query\":\"CrewAI\"}" },
    ]);
    expect((openai as unknown as {
      _extract_reasoning_items(response: unknown): unknown[];
    })._extract_reasoning_items(response)).toEqual([reasoningItem]);
  });

  it("extracts OpenAI Responses API built-in tool outputs", () => {
    const openai = new OpenAICompletion({ model: "gpt-4.1", api: "responses" });
    const parsed = (openai as unknown as {
      _extract_builtin_tool_outputs(response: unknown): ResponsesAPIResult;
    })._extract_builtin_tool_outputs({
      id: "resp_1",
      output_text: "Final answer",
      output: [
        { type: "web_search_call", id: "ws_1", status: "completed" },
        {
          type: "file_search_call",
          id: "fs_1",
          status: "completed",
          queries: ["CrewAI"],
          results: [{ file_id: "file_1", filename: "docs.md", text: "CrewAI docs", score: 0.8, attributes: { kind: "doc" } }],
        },
        {
          type: "code_interpreter_call",
          id: "ci_1",
          status: "completed",
          code: "print('hi')",
          container_id: "ctr_1",
          outputs: [{ type: "logs", logs: "hi\n" }, { type: "image", url: "https://example.test/plot.png" }],
        },
        {
          type: "computer_call",
          id: "cu_1",
          status: "completed",
          call_id: "comp_1",
          action: { type: "click", x: 10, y: 20 },
          pending_safety_checks: [{ id: "safe_1", code: "confirm", message: "Confirm action" }],
        },
        {
          type: "reasoning",
          id: "rs_1",
          status: "completed",
          summary: [{ type: "summary_text", text: "Need search" }],
          encrypted_content: "encrypted",
        },
        { type: "function_call", call_id: "call_1", name: "search_docs", arguments: "{\"query\":\"CrewAI\"}" },
      ],
    });

    expect(parsed).toBeInstanceOf(ResponsesAPIResult);
    expect(parsed.text).toBe("Final answer");
    expect(parsed.response_id).toBe("resp_1");
    expect(parsed.web_search_results).toEqual([{ id: "ws_1", status: "completed", type: "web_search_call" }]);
    expect(parsed.file_search_results).toEqual([{
      id: "fs_1",
      status: "completed",
      type: "file_search_call",
      queries: ["CrewAI"],
      results: [{ file_id: "file_1", filename: "docs.md", text: "CrewAI docs", score: 0.8, attributes: { kind: "doc" } }],
    }]);
    expect(parsed.code_interpreter_results).toEqual([{
      id: "ci_1",
      status: "completed",
      type: "code_interpreter_call",
      code: "print('hi')",
      container_id: "ctr_1",
      results: [{ type: "logs", logs: "hi\n" }, { type: "files", files: [{ url: "https://example.test/plot.png" }] }],
    }]);
    expect(parsed.computer_use_results).toEqual([{
      id: "cu_1",
      status: "completed",
      type: "computer_call",
      call_id: "comp_1",
      action: { type: "click", x: 10, y: 20 },
      pending_safety_checks: [{ id: "safe_1", code: "confirm", message: "Confirm action" }],
    }]);
    expect(parsed.reasoning_summaries).toEqual([{
      id: "rs_1",
      status: "completed",
      type: "reasoning",
      summary: [{ type: "summary_text", text: "Need search" }],
      encrypted_content: "encrypted",
    }]);
    expect(parsed.function_calls).toEqual([{ id: "call_1", name: "search_docs", arguments: "{\"query\":\"CrewAI\"}" }]);
  });

  it("accumulates OpenAI Responses API streaming events", () => {
    const openai = new OpenAICompletion({ model: "gpt-4.1", api: "responses", auto_chain: true, auto_chain_reasoning: true });
    const reasoningItem = { type: "reasoning", id: "rs_1", encrypted_content: "encrypted" };
    const completed = {
      id: "resp_done",
      usage: {
        input_tokens: 3,
        output_tokens: 2,
        total_tokens: 5,
        output_tokens_details: { reasoning_tokens: 1 },
      },
      output: [
        reasoningItem,
        { type: "function_call", call_id: "call_done", name: "lookup_docs", arguments: "{\"id\":\"intro\"}" },
      ],
    };

    const accumulated = (openai as unknown as {
      _accumulate_responses_stream_events(events: unknown[]): {
        text: string;
        response_id: string | null;
        function_calls: Record<string, unknown>[];
        usage: Record<string, number> | null;
        final_response: unknown;
        reasoning_items: unknown[];
      };
    })._accumulate_responses_stream_events([
      { type: "response.created", response: { id: "resp_stream" } },
      { type: "response.output_text.delta", delta: "Hel" },
      { type: "response.output_text.delta", delta: "lo" },
      { type: "response.function_call_arguments.delta", delta: "{\"id\":" },
      { type: "response.output_item.done", item: { type: "function_call", call_id: "call_1", name: "search_docs", arguments: "{\"query\":\"CrewAI\"}" } },
      { type: "response.completed", response: completed },
    ]);

    expect(accumulated).toEqual({
      text: "Hello",
      response_id: "resp_done",
      function_calls: [{ id: "call_1", name: "search_docs", arguments: "{\"query\":\"CrewAI\"}" }],
      usage: {
        prompt_tokens: 3,
        completion_tokens: 2,
        total_tokens: 5,
        reasoning_tokens: 1,
      },
      final_response: completed,
      reasoning_items: [reasoningItem],
    });
    expect(openai.last_response_id).toBe("resp_done");
    expect(openai.last_reasoning_items).toEqual([reasoningItem]);
  });

  it("prepares Azure completion request parameters with model extras and endpoint rules", () => {
    const search = new StructuredTool({
      name: "search docs",
      description: "Search documentation",
      argsSchema: {
        query: { type: "string", description: "Search query" },
      },
      func: () => "result",
    });
    const azureOpenAI = new AzureCompletion({
      model: "gpt-4o",
      endpoint: "https://example.openai.azure.com/openai/deployments/gpt-4o",
      temperature: 0.2,
      top_p: 0.8,
      frequency_penalty: 0.1,
      presence_penalty: 0.2,
      max_tokens: 300,
      stop: ["STOP"],
      stream: true,
      additional_params: {
        prompt_cache_key: "cache-key",
        drop_params: true,
        additional_drop_params: ["frequency_penalty"],
      },
    });

    const params = (azureOpenAI as unknown as {
      _prepare_completion_params(messages: LLMMessage[], tools?: StructuredTool[]): Record<string, unknown>;
    })._prepare_completion_params([{ role: "user", content: "Find CrewAI" }], [search]);

    expect(params).toMatchObject({
      messages: [{ role: "user", content: "Find CrewAI" }],
      stream: true,
      temperature: 0.2,
      top_p: 0.8,
      presence_penalty: 0.2,
      max_tokens: 300,
      stop: ["STOP"],
      model_extras: {
        stream_options: { include_usage: true },
        prompt_cache_key: "cache-key",
      },
      tools: [{
        type: "function",
        function: {
          name: "search_docs",
          description: "Search documentation",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Search query" },
            },
          },
        },
      }],
      tool_choice: "auto",
    });
    expect(params).not.toHaveProperty("model");
    expect(params).not.toHaveProperty("frequency_penalty");

    const external = new AzureCompletion({
      model: "mistral-large",
      endpoint: "https://models.inference.ai.azure.com",
      max_tokens: 100,
    });
    expect((external as unknown as {
      _prepare_completion_params(messages: LLMMessage[], tools?: StructuredTool[]): Record<string, unknown>;
    })._prepare_completion_params([{ role: "user", content: "Find CrewAI" }], [search])).toMatchObject({
      model: "mistral-large",
      messages: [{ role: "user", content: "Find CrewAI" }],
      max_tokens: 100,
    });
  });

  it("prepares Anthropic completion request parameters with thinking and tool search", () => {
    const search = new StructuredTool({
      name: "search docs",
      description: "Search documentation",
      argsSchema: {
        query: { type: "string", description: "Search query" },
      },
      func: () => "result",
    });
    const lookup = new StructuredTool({
      name: "lookup docs",
      description: "Lookup documentation",
      argsSchema: {
        id: { type: "string", description: "Document id" },
      },
      func: () => "result",
    });
    const anthropic = new AnthropicCompletion({
      model: "claude-sonnet-4-5",
      temperature: 0.3,
      top_p: 0.7,
      max_tokens: 2048,
      stop: ["STOP"],
      stream: true,
      thinking: { type: "enabled", budget_tokens: 1024 },
      tool_search: { type: "regex" },
    });

    const params = (anthropic as unknown as {
      _prepare_completion_params(
        messages: LLMMessage[],
        systemMessage?: string | null,
        tools?: StructuredTool[] | null,
        availableFunctions?: Record<string, unknown> | null,
      ): Record<string, unknown>;
    })._prepare_completion_params(
      [{ role: "user", content: "Find CrewAI" }],
      "System prompt",
      [search, lookup],
      { search_docs: search, lookup_docs: lookup },
    );

    expect(params).toMatchObject({
      model: "claude-sonnet-4-5",
      messages: [{ role: "user", content: "Find CrewAI" }],
      system: "System prompt",
      max_tokens: 2048,
      stream: true,
      temperature: 0.3,
      top_p: 0.7,
      stop_sequences: ["STOP"],
      thinking: { type: "enabled", budget_tokens: 1024 },
      tools: [
        { type: "tool_search_tool_regex_20251119", name: "tool_search_tool_regex" },
        {
          name: "search_docs",
          description: "Search documentation",
          defer_loading: true,
        },
        {
          name: "lookup_docs",
          description: "Lookup documentation",
          defer_loading: true,
        },
      ],
    });
    expect(params).not.toHaveProperty("tool_choice");

    const singleTool = new AnthropicCompletion({ model: "claude-3-5-sonnet-20241022" });
    expect((singleTool as unknown as {
      _prepare_completion_params(
        messages: LLMMessage[],
        systemMessage?: string | null,
        tools?: StructuredTool[] | null,
        availableFunctions?: Record<string, unknown> | null,
      ): Record<string, unknown>;
    })._prepare_completion_params(
      [{ role: "user", content: "Find CrewAI" }],
      null,
      [search],
      { search_docs: search },
    )).toMatchObject({
      tools: [{
        name: "search_docs",
        description: "Search documentation",
      }],
      tool_choice: { type: "tool", name: "search_docs" },
    });
  });

  it("extracts Anthropic token usage from SDK response shapes", () => {
    expect(AnthropicCompletion._extract_anthropic_token_usage({
      usage: {
        input_tokens: 14,
        output_tokens: 6,
        cache_read_input_tokens: 4,
        cache_creation_input_tokens: 3,
      },
    })).toEqual({
      input_tokens: 14,
      output_tokens: 6,
      total_tokens: 20,
      cached_prompt_tokens: 4,
      cache_creation_tokens: 3,
    });

    expect(AnthropicCompletion._extract_anthropic_token_usage({})).toEqual({ total_tokens: 0 });
  });

  it("extracts Anthropic tool uses and structured output from response content", () => {
    const response = {
      content: [
        { type: "text", text: "Need search" },
        { type: "tool_use", id: "tool-1", name: "search_docs", input: { query: "CrewAI" } },
        { type: "tool_use", id: "tool-2", name: "structured_output", input: { answer: "done", confidence: 0.93 } },
      ],
    };

    expect(AnthropicCompletion.extract_structured_output_from_response(response)).toEqual({
      answer: "done",
      confidence: 0.93,
    });
    expect(AnthropicCompletion.extract_tool_uses_from_response(response)).toEqual([
      {
        type: "tool_use",
        id: "tool-1",
        name: "search_docs",
        input: { query: "CrewAI" },
      },
    ]);
  });

  it("accumulates Anthropic streaming events", () => {
    const anthropic = new AnthropicCompletion({ model: "claude-3-5-sonnet-20241022" });
    const finalMessage = {
      id: "msg_final",
      usage: {
        input_tokens: 5,
        output_tokens: 4,
        cache_read_input_tokens: 2,
      },
      content: [
        { type: "thinking", thinking: "reasoning", signature: "sig" },
        { type: "text", text: "Hello world" },
      ],
    };

    const accumulated = (anthropic as unknown as {
      _accumulate_stream_events(events: unknown[], finalMessage?: unknown): {
        text: string;
        response_id: string | null;
        tool_calls: Record<string, unknown>[];
        usage: Record<string, number> | null;
        thinking_blocks: Record<string, unknown>[];
      };
    })._accumulate_stream_events([
      { type: "message_start", message: { id: "msg_1" } },
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Hel" } },
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "lo" } },
      { type: "content_block_start", index: 1, content_block: { type: "tool_use", id: "toolu_1", name: "search_docs" } },
      { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: "{\"query\":" } },
      { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: "\"CrewAI\"}" } },
    ], finalMessage);

    expect(accumulated).toEqual({
      text: "Hello",
      response_id: "msg_1",
      tool_calls: [{
        id: "toolu_1",
        type: "function",
        function: { name: "search_docs", arguments: "{\"query\":\"CrewAI\"}" },
        index: 1,
      }],
      usage: {
        input_tokens: 5,
        output_tokens: 4,
        total_tokens: 9,
        cached_prompt_tokens: 2,
        cache_creation_tokens: 0,
      },
      thinking_blocks: [{ type: "thinking", thinking: "reasoning", signature: "sig" }],
    });
    expect(anthropic.get_token_usage_summary()).toMatchObject({
      promptTokens: 5,
      completionTokens: 4,
      totalTokens: 9,
      cachedPromptTokens: 2,
      successfulRequests: 1,
    });
  });

  it("executes Anthropic tool uses into Claude tool result blocks", async () => {
    const anthropic = new AnthropicCompletion({ model: "claude-3-5-sonnet-20241022" });
    const availableFunctions = {
      search_docs: ({ query }: { query: string }) => ({ result: `found ${query}` }),
    };

    const results = await (anthropic as unknown as {
      _execute_tools_and_collect_results(
        toolUses: Array<Record<string, unknown>>,
        availableFunctions: Record<string, unknown>,
      ): Promise<Record<string, unknown>[]>;
    })._execute_tools_and_collect_results([
      { id: "toolu_1", name: "search_docs", input: { query: "CrewAI" } },
      { id: "toolu_2", name: "missing_tool", input: {} },
    ], availableFunctions);

    expect(results).toEqual([
      { type: "tool_result", tool_use_id: "toolu_1", content: "{\"result\":\"found CrewAI\"}" },
      { type: "tool_result", tool_use_id: "toolu_2", content: "Tool execution completed" },
    ]);
    await expect((anthropic as unknown as {
      _execute_first_tool(
        toolUses: Array<Record<string, unknown>>,
        availableFunctions: Record<string, unknown>,
      ): Promise<string | null>;
    })._execute_first_tool([
      { id: "toolu_1", name: "search_docs", input: { query: "CrewAI" } },
    ], availableFunctions)).resolves.toBe("{\"result\":\"found CrewAI\"}");
  });

  it("prepares Bedrock Converse request bodies with tools and provider fields", () => {
    const search = new StructuredTool({
      name: "search docs",
      description: "Search documentation",
      argsSchema: {
        query: { type: "string", description: "Search query" },
      },
      func: () => "result",
    });
    const bedrock = new BedrockCompletion({
      model: "anthropic.claude-3-5-sonnet-20241022-v2:0",
      temperature: 0.2,
      top_p: 0.8,
      top_k: 40,
      max_tokens: 300,
      stop: ["STOP"],
      stream: true,
      guardrail_config: { guardrailIdentifier: "guard", guardrailVersion: "1" },
      additional_model_request_fields: { thinking: { type: "enabled", budget_tokens: 1024 } },
      additional_model_response_field_paths: ["/stop_sequence"],
    });

    const prepared = (bedrock as unknown as {
      _prepare_converse_request_body(messages: LLMMessage[], tools?: StructuredTool[] | null): {
        messages: LLMMessage[];
        body: Record<string, unknown>;
        system_message?: string | null;
      };
    })._prepare_converse_request_body([
      { role: "system", content: "System prompt" },
      { role: "user", content: "Find CrewAI" },
    ], [search]);

    expect(prepared.messages).toEqual([{ role: "user", content: [{ text: "Find CrewAI" }] }]);
    expect(prepared.system_message).toBe("System prompt");
    expect(prepared.body).toMatchObject({
      inferenceConfig: {
        maxTokens: 300,
        temperature: 0.2,
        topP: 0.8,
        stopSequences: ["STOP"],
        topK: 40,
      },
      system: [{ text: "System prompt" }],
      toolConfig: {
        tools: [{
          toolSpec: {
            name: "search_docs",
            description: "Search documentation",
            inputSchema: {
              json: {
                type: "object",
                additionalProperties: false,
                properties: {
                  query: { type: "string", description: "Search query" },
                },
                required: ["query"],
              },
            },
          },
        }],
      },
      guardrailConfig: { guardrailIdentifier: "guard", guardrailVersion: "1" },
      additionalModelRequestFields: { thinking: { type: "enabled", budget_tokens: 1024 } },
      additionalModelResponseFieldPaths: ["/stop_sequence"],
    });
  });

  it("extracts and tracks Bedrock token usage from Converse responses", () => {
    const bedrock = new BedrockCompletion({ model: "anthropic.claude-3-5-sonnet-20241022-v2:0" });

    expect(BedrockCompletion.extract_bedrock_token_usage({
      inputTokens: 9,
      outputTokens: 4,
      totalTokens: 13,
      cacheReadInputTokenCount: 2,
    })).toEqual({
      prompt_tokens: 9,
      completion_tokens: 4,
      total_tokens: 13,
      cached_prompt_tokens: 2,
    });

    bedrock._track_token_usage_internal({
      inputTokens: 9,
      outputTokens: 4,
      totalTokens: 13,
      cacheReadInputTokens: 3,
    });

    expect(bedrock.get_token_usage_summary()).toMatchObject({
      promptTokens: 9,
      completionTokens: 4,
      totalTokens: 13,
      cachedPromptTokens: 3,
      successfulRequests: 1,
    });
  });

  it("extracts Bedrock tool uses and structured output from Converse responses", () => {
    const response = {
      output: {
        message: {
          content: [
            { text: "Need search" },
            { toolUse: { toolUseId: "tool-1", name: "search_docs", input: { query: "CrewAI" } } },
            { toolUse: { toolUseId: "tool-2", name: "structured_output", input: { answer: "done", confidence: 0.92 } } },
          ],
        },
      },
    };

    expect(BedrockCompletion.extract_structured_output_from_response(response)).toEqual({
      answer: "done",
      confidence: 0.92,
    });
    expect(BedrockCompletion.extract_tool_uses_from_response(response)).toEqual([
      {
        toolUseId: "tool-1",
        name: "search_docs",
        input: { query: "CrewAI" },
      },
    ]);
  });

  it("executes Bedrock tool uses into Converse follow-up messages", async () => {
    const bedrock = new BedrockCompletion({ model: "anthropic.claude-3-5-sonnet-20241022-v2:0" });
    const toolUse = { toolUseId: "tooluse-1", name: "search_docs", input: { query: "CrewAI" } };

    const prepared = await (bedrock as unknown as {
      _execute_tool_use_and_prepare_messages(
        messages: Record<string, unknown>[],
        toolUse: Record<string, unknown>,
        availableFunctions: Record<string, unknown>,
      ): Promise<{
        result: string | null;
        messages: Record<string, unknown>[];
      }>;
    })._execute_tool_use_and_prepare_messages(
      [{ role: "user", content: [{ text: "Find docs" }] }],
      toolUse,
      { search_docs: ({ query }: { query: string }) => ({ result: `found ${query}` }) },
    );

    expect(prepared).toEqual({
      result: "{\"result\":\"found CrewAI\"}",
      messages: [
        { role: "user", content: [{ text: "Find docs" }] },
        { role: "assistant", content: [{ toolUse }] },
        {
          role: "user",
          content: [{
            toolResult: {
              toolUseId: "tooluse-1",
              content: [{ text: "{\"result\":\"found CrewAI\"}" }],
            },
          }],
        },
      ],
    });
  });

  it("accumulates Bedrock Converse streaming events", () => {
    const bedrock = new BedrockCompletion({ model: "anthropic.claude-3-5-sonnet-20241022-v2:0" });

    const accumulated = (bedrock as unknown as {
      _accumulate_converse_stream_events(events: unknown[]): {
        text: string;
        tool_calls: Record<string, unknown>[];
        usage: Record<string, number> | null;
        stop_reason: string | null;
      };
    })._accumulate_converse_stream_events([
      { messageStart: { role: "assistant" } },
      { contentBlockDelta: { contentBlockIndex: 0, delta: { text: "Hel" } } },
      { contentBlockDelta: { contentBlockIndex: 0, delta: { text: "lo" } } },
      {
        contentBlockStart: {
          contentBlockIndex: 1,
          start: { toolUse: { toolUseId: "tooluse-1", name: "search_docs" } },
        },
      },
      { contentBlockDelta: { contentBlockIndex: 1, delta: { toolUse: { input: "{\"query\":" } } } },
      { contentBlockDelta: { contentBlockIndex: 1, delta: { toolUse: { input: "\"CrewAI\"}" } } } },
      { contentBlockStop: { contentBlockIndex: 1 } },
      { messageStop: { stopReason: "tool_use" } },
      {
        metadata: {
          usage: {
            inputTokens: 7,
            outputTokens: 5,
            totalTokens: 12,
            cacheReadInputTokenCount: 3,
          },
        },
      },
    ]);

    expect(accumulated).toEqual({
      text: "Hello",
      tool_calls: [{
        id: "tooluse-1",
        type: "function",
        function: { name: "search_docs", arguments: "{\"query\":\"CrewAI\"}" },
        index: 1,
      }],
      usage: {
        prompt_tokens: 7,
        completion_tokens: 5,
        total_tokens: 12,
        cached_prompt_tokens: 3,
      },
      stop_reason: "tool_use",
    });
    expect(bedrock.get_token_usage_summary()).toMatchObject({
      promptTokens: 7,
      completionTokens: 5,
      totalTokens: 12,
      cachedPromptTokens: 3,
      successfulRequests: 1,
    });
  });

  it("exposes Gemini completion provider parity helpers", () => {
    const gemini = new GeminiCompletion({
      model: "gemini-2.5-pro",
      api_key: "gemini-key",
      project: "demo-project",
      location: "europe-west1",
      top_p: 0.9,
      top_k: 40,
      max_output_tokens: 2048,
      safety_settings: [{ category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }],
    });

    expect(gemini.supports_function_calling()).toBe(true);
    expect(gemini.supports_stop_words()).toBe(true);
    expect(gemini.supports_multimodal()).toBe(true);
    expect(gemini.get_context_window_size()).toBe(Math.trunc(1048576 * CONTEXT_WINDOW_USAGE_RATIO));
    expect(gemini.format_text_content("hello")).toEqual({ text: "hello" });
    expect(gemini.to_config_dict()).toMatchObject({
      model: "gemini-2.5-pro",
      provider: "gemini",
      api_key: "gemini-key",
      project: "demo-project",
      location: "europe-west1",
      top_p: 0.9,
      top_k: 40,
      max_output_tokens: 2048,
      safety_settings: [{ category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }],
    });

    expect(GeminiCompletion.extract_token_usage({
      usage_metadata: {
        prompt_token_count: 10,
        candidates_token_count: 7,
        thoughts_token_count: 3,
        total_token_count: 20,
        cached_content_token_count: 2,
      },
    })).toEqual({
      prompt_token_count: 10,
      candidates_token_count: 7,
      completion_tokens: 10,
      total_token_count: 20,
      total_tokens: 20,
      cached_prompt_tokens: 2,
      reasoning_tokens: 3,
    });
    expect(GeminiCompletion.extract_text_from_response({
      candidates: [{
        content: {
          parts: [
            { text: "visible" },
            { text: "hidden", thought: true },
            { text: " text" },
          ],
        },
      }],
    })).toBe("visible text");
    expect(GeminiCompletion.add_property_ordering({
      type: "object",
      properties: {
        name: { type: "string" },
        nested: {
          type: "object",
          properties: { value: { type: "number" } },
        },
      },
    })).toEqual({
      type: "object",
      propertyOrdering: ["name", "nested"],
      properties: {
        name: { type: "string" },
        nested: {
          type: "object",
          propertyOrdering: ["value"],
          properties: { value: { type: "number" } },
        },
      },
    });
    expect(GeminiCompletion.convert_contents_to_dict([
      { role: "model", parts: [{ text: "assistant text" }] },
      { role: null, parts: [{ text: "user text" }] },
    ])).toEqual([
      { role: "assistant", content: "assistant text" },
      { role: "user", content: "user text" },
    ]);
  });

  it("accumulates Gemini streaming chunks", () => {
    const gemini = new GeminiCompletion({ model: "gemini-2.5-pro" });

    const accumulated = (gemini as unknown as {
      _accumulate_stream_chunks(chunks: unknown[]): {
        text: string;
        function_calls: Record<string, unknown>[];
        usage: Record<string, number> | null;
        thinking_text: string;
        response_id: string | null;
      };
    })._accumulate_stream_chunks([
      {
        response_id: "gemini-response-1",
        usage_metadata: {
          prompt_token_count: 10,
          candidates_token_count: 6,
          thoughts_token_count: 2,
          total_token_count: 18,
          cached_content_token_count: 3,
        },
        candidates: [{
          content: {
            parts: [
              { text: "Hel" },
              { text: "thinking", thought: true },
              { text: "lo" },
              { functionCall: { name: "search_docs", args: { query: "CrewAI" } } },
            ],
          },
        }],
      },
    ]);

    expect(accumulated).toEqual({
      text: "Hello",
      function_calls: [{
        id: "call_0",
        type: "function",
        function: { name: "search_docs", arguments: "{\"query\":\"CrewAI\"}" },
        args: { query: "CrewAI" },
        index: 0,
      }],
      usage: {
        prompt_token_count: 10,
        candidates_token_count: 6,
        completion_tokens: 8,
        total_token_count: 18,
        total_tokens: 18,
        cached_prompt_tokens: 3,
        reasoning_tokens: 2,
      },
      thinking_text: "thinking",
      response_id: "gemini-response-1",
    });
    expect(gemini.get_token_usage_summary()).toMatchObject({
      promptTokens: 10,
      completionTokens: 8,
      totalTokens: 18,
      cachedPromptTokens: 3,
      reasoningTokens: 2,
      successfulRequests: 1,
    });
  });

  it("prepares Gemini messages and generation config with tools", () => {
    const search = new StructuredTool({
      name: "search docs",
      description: "Search documentation",
      argsSchema: {
        query: { type: "string", description: "Search query" },
      },
      func: () => "result",
    });
    const responseModel = {
      model_json_schema: () => ({
        type: "object",
        properties: {
          answer: { type: "string" },
          confidence: { type: "number" },
        },
        required: ["answer"],
      }),
    };
    const gemini = new GeminiCompletion({
      model: "gemini-2.5-pro",
      temperature: 0.4,
      top_p: 0.9,
      top_k: 40,
      max_output_tokens: 512,
      stop: ["STOP"],
      safety_settings: [{ category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }],
      thinking_config: { include_thoughts: true },
    });

    const [contents, systemInstruction] = (gemini as unknown as {
      _format_messages_for_gemini(messages: Array<LLMMessage & Record<string, unknown>>): [Record<string, unknown>[], string | null];
    })._format_messages_for_gemini([
      { role: "system", content: "System prompt" },
      { role: "user", content: "Find CrewAI" },
      {
        role: "assistant",
        content: "Calling search",
        tool_calls: [{
          id: "call_1",
          function: { name: "search_docs", arguments: "{\"query\":\"CrewAI\"}" },
        }],
      },
      { role: "tool", content: "{\"result\":\"docs\"}", name: "search_docs", tool_call_id: "call_1" },
    ]);

    expect(systemInstruction).toBe("System prompt");
    expect(contents).toEqual([
      { role: "user", parts: [{ text: "Find CrewAI" }] },
      {
        role: "model",
        parts: [
          { text: "Calling search" },
          { functionCall: { name: "search_docs", args: { query: "CrewAI" } } },
        ],
      },
      { role: "user", parts: [{ functionResponse: { name: "search_docs", response: { result: "docs" } } }] },
    ]);

    const config = (gemini as unknown as {
      _prepare_generation_config(
        systemInstruction?: string | null,
        tools?: StructuredTool[] | null,
        responseModel?: unknown,
      ): Record<string, unknown>;
    })._prepare_generation_config(systemInstruction, [search], responseModel);

    expect(config).toMatchObject({
      system_instruction: { role: "user", parts: [{ text: "System prompt" }] },
      temperature: 0.4,
      top_p: 0.9,
      top_k: 40,
      max_output_tokens: 512,
      stop_sequences: ["STOP"],
      safety_settings: [{ category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }],
      thinking_config: { include_thoughts: true },
      tools: [
        {
          functionDeclarations: [{
            name: "search_docs",
            description: "Search documentation",
            parametersJsonSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                query: { type: "string", description: "Search query" },
              },
              required: ["query"],
            },
          }],
        },
        {
          functionDeclarations: [{
            name: "structured_output",
            parametersJsonSchema: {
              type: "object",
              propertyOrdering: ["answer", "confidence"],
            },
          }],
        },
      ],
    });
    expect(config).not.toHaveProperty("response_json_schema");
  });

  it("extracts Gemini function calls from response candidates", () => {
    const response = {
      candidates: [{
        content: {
          parts: [
            { text: "Need search" },
            { functionCall: { name: "search_docs", args: { query: "CrewAI" } } },
            { function_call: { name: "lookup_docs", args: { id: "intro" } } },
          ],
        },
      }],
    };

    expect(GeminiCompletion.extract_function_calls_from_response(response)).toEqual([
      {
        id: "call_0",
        type: "function",
        function: {
          name: "search_docs",
          arguments: "{\"query\":\"CrewAI\"}",
        },
        args: { query: "CrewAI" },
        index: 0,
      },
      {
        id: "call_1",
        type: "function",
        function: {
          name: "lookup_docs",
          arguments: "{\"id\":\"intro\"}",
        },
        args: { id: "intro" },
        index: 1,
      },
    ]);
  });

  it("processes Gemini response function calls with optional direct execution", async () => {
    const gemini = new GeminiCompletion({ model: "gemini-2.5-pro" });
    const response = {
      candidates: [{
        content: {
          parts: [
            { text: "Need search" },
            { functionCall: { name: "search_docs", args: { query: "CrewAI" } } },
          ],
        },
      }],
    };

    await expect((gemini as unknown as {
      _process_response_with_tools(
        response: unknown,
        contents: unknown[],
        availableFunctions?: Record<string, unknown> | null,
      ): Promise<unknown>;
    })._process_response_with_tools(response, [])).resolves.toEqual([
      { functionCall: { name: "search_docs", args: { query: "CrewAI" } } },
    ]);
    await expect((gemini as unknown as {
      _process_response_with_tools(
        response: unknown,
        contents: unknown[],
        availableFunctions?: Record<string, unknown> | null,
      ): Promise<unknown>;
    })._process_response_with_tools(response, [], {
      search_docs: ({ query }: { query: string }) => ({ result: `found ${query}` }),
    })).resolves.toBe("{\"result\":\"found CrewAI\"}");
  });

  it("extracts Gemini structured output pseudo-tool responses", () => {
    const response = {
      candidates: [{
        content: {
          parts: [
            { functionCall: { name: "search_docs", args: { query: "CrewAI" } } },
            { functionCall: { name: "structured_output", args: { answer: "done", confidence: 0.91 } } },
          ],
        },
      }],
    };

    expect(GeminiCompletion.extract_structured_output_from_response(response)).toEqual({
      answer: "done",
      confidence: 0.91,
    });
    expect(GeminiCompletion.extract_function_calls_from_response(response)).toEqual([
      {
        id: "call_0",
        type: "function",
        function: {
          name: "search_docs",
          arguments: "{\"query\":\"CrewAI\"}",
        },
        args: { query: "CrewAI" },
        index: 0,
      },
    ]);
  });

  it("creates configured LLM clients from strings, objects, clients, and environment fallback", async () => {
    const existing = {
      call: () => "existing",
    };
    expect(create_llm(existing)).toBe(existing);

    const fromString = create_llm("test/configured-model");
    expect(fromString).toBeInstanceOf(ConfiguredLLM);
    expect((fromString as ConfiguredLLM).to_config_dict()).toMatchObject({
      model: "test/configured-model",
    });

    const fromObject = create_llm({
      model_name: "test/object-model",
      temperature: 0.2,
      max_tokens: 100,
      api_base: "https://api.example.test",
    });
    expect((fromObject as ConfiguredLLM).to_config_dict()).toMatchObject({
      model: "test/object-model",
      temperature: 0.2,
      max_tokens: 100,
      api_base: "https://api.example.test",
    });

    const fromEnv = create_llm(null, {
      MODEL_NAME: "test/env-model",
      BASE_URL: "https://env.example.test",
    });
    expect((fromEnv as ConfiguredLLM).to_config_dict()).toMatchObject({
      model: "test/env-model",
      base_url: "https://env.example.test",
      api_base: "https://env.example.test",
    });

    const openaiEnv = create_llm(null, {
      OPENAI_MODEL_NAME: "gpt-4o",
      OPENAI_API_KEY: "openai-key",
      OPENAI_API_BASE: "https://openai.example.test",
    });
    expect((openaiEnv as ConfiguredLLM).to_config_dict()).toMatchObject({
      model: "gpt-4o",
      api_key: "openai-key",
      api_base: "https://openai.example.test",
    });

    const azureEnv = create_llm(null, {
      MODEL: "azure/my-deployment",
      AZURE_API_KEY: "azure-key",
      AZURE_API_BASE: "https://azure.example.test",
      AZURE_API_VERSION: "2024-02-15-preview",
    });
    expect((azureEnv as ConfiguredLLM).to_config_dict()).toMatchObject({
      model: "azure/my-deployment",
      api_key: "azure-key",
      api_base: "https://azure.example.test",
      additional_params: { api_version: "2024-02-15-preview" },
    });
    expect(normalize_llm_env_key_name("azure_api_base")).toBe("api_base");

    registerLLMProvider("test/configured-model", () => "delegated");
    await expect(fromString?.call([{ role: "user", content: "hello" }])).resolves.toBe("delegated");
  });

  it("resolves upstream-style native provider aliases, constants, and model patterns", () => {
    expect(canonical_llm_provider("claude")).toBe("anthropic");
    expect(canonical_llm_provider("google")).toBe("gemini");
    expect(canonical_llm_provider("aws")).toBe("bedrock");
    expect(validate_model_in_constants("gpt-4o", "openai")).toBe(true);
    expect(validate_model_in_constants("claude-opus-4-0", "anthropic")).toBe(true);
    expect(validate_model_in_constants("gemini-2.5-pro", "gemini")).toBe(true);
    expect(validate_model_in_constants("gpt-future-6", "openai")).toBe(true);
    expect(validate_model_in_constants("gemini-2.5-flash", "openai")).toBe(false);
    expect(matches_provider_pattern("qwen-plus", "dashscope")).toBe(true);
    expect(matches_provider_pattern("llama3.2", "ollama")).toBe(true);

    expect(BaseLLM._validate_model_in_constants("claude-future-5", "claude")).toBe(true);
    expect(BaseLLM._infer_provider_from_model("claude-opus-4-0")).toBe("anthropic");
    expect(BaseLLM.resolve_llm_model_spec("gemini/gemini-2.5-pro")).toEqual({
      provider: "gemini",
      model: "gemini-2.5-pro",
      originalModel: "gemini/gemini-2.5-pro",
      useNative: true,
    });

    expect(resolve_llm_model_spec("openai/gpt-future-6")).toEqual({
      provider: "openai",
      model: "gpt-future-6",
      originalModel: "openai/gpt-future-6",
      useNative: true,
    });
    expect(resolve_llm_model_spec("openai/gemini-2.5-flash")).toEqual({
      provider: "openai",
      model: "gemini-2.5-flash",
      originalModel: "openai/gemini-2.5-flash",
      useNative: false,
    });
    expect(resolve_llm_model_spec("groq/llama-3.3-70b")).toEqual({
      provider: "groq",
      model: "llama-3.3-70b",
      originalModel: "groq/llama-3.3-70b",
      useNative: false,
    });

    const claudeEnv = create_llm(null, {
      MODEL: "claude/claude-opus-4-0",
      ANTHROPIC_API_KEY: "anthropic-key",
    });
    expect((claudeEnv as ConfiguredLLM).to_config_dict()).toMatchObject({
      model: "claude/claude-opus-4-0",
      provider: "anthropic",
      api_key: "anthropic-key",
      is_litellm: false,
    });
  });

  it("calls object providers with tools and aggregates usage metrics", async () => {
    const calls: Array<{ messages: readonly LLMMessage[]; options: LLMCallOptions | undefined }> = [];
    const events: CrewAIEvent[] = [];
    crewaiEventBus.on("agent_execution_started", (_source, event) => {
      events.push(event);
    });
    crewaiEventBus.on("llm_call_started", (_source, event) => {
      events.push(event);
    });
    crewaiEventBus.on("llm_call_completed", (_source, event) => {
      events.push(event);
    });
    crewaiEventBus.on("agent_execution_completed", (_source, event) => {
      events.push(event);
    });
    let usage: UsageMetrics = {
      totalTokens: 0,
      promptTokens: 0,
      cachedPromptTokens: 0,
      completionTokens: 0,
      reasoningTokens: 0,
      cacheCreationTokens: 0,
      successfulRequests: 0,
    };
    const llm = {
      call(messages: readonly LLMMessage[], options?: LLMCallOptions) {
        calls.push({ messages, options });
        usage = {
          ...usage,
          totalTokens: usage.totalTokens + 12,
          promptTokens: usage.promptTokens + 8,
          completionTokens: usage.completionTokens + 4,
          successfulRequests: usage.successfulRequests + 1,
        };
        return "provider output";
      },
      getUsageMetrics() {
        return usage;
      },
    };
    const toolInstance = new StructuredTool({
      name: "search",
      description: "Search",
      func: () => "unused",
    });
    const agentInstance = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      tools: [toolInstance],
      llm,
    });
    const taskInstance = new Task({
      description: "Research",
      expectedOutput: "A concise brief",
      agent: agentInstance,
    });

    const output = await new Crew({ agents: [agentInstance], tasks: [taskInstance] }).kickoff();

    expect(output.raw).toBe("provider output");
    expect(calls[0]?.options?.tools).toEqual([toolInstance]);
    expect(agentInstance.getUsageMetrics()).toMatchObject({
      totalTokens: 12,
      promptTokens: 8,
      completionTokens: 4,
      successfulRequests: 1,
    });
    expect(output.tokenUsage).toMatchObject({
      totalTokens: 12,
      promptTokens: 8,
      completionTokens: 4,
      successfulRequests: 1,
    });
    expect(events.map((event) => event.type)).toEqual([
      "agent_execution_started",
      "llm_call_started",
      "llm_call_completed",
      "agent_execution_completed",
    ]);
    expect(events[0]).toBeInstanceOf(AgentExecutionStartedEvent);
    expect((events[0] as AgentExecutionStartedEvent).task).toBe(taskInstance);
    expect(events[1]).toBeInstanceOf(LLMCallStartedEvent);
    expect((events[1] as LLMCallStartedEvent).from_agent).toBe(agentInstance);
    expect((events[1] as LLMCallStartedEvent).from_task).toBe(taskInstance);
    expect(events[2]).toBeInstanceOf(LLMCallCompletedEvent);
    expect((events[2] as LLMCallCompletedEvent).call_type).toBe(LLMCallType.LLM_CALL);
    expect((events[2] as LLMCallCompletedEvent).usage).toMatchObject({
      totalTokens: 12,
      successfulRequests: 1,
    });
    expect(events[3]).toBeInstanceOf(AgentExecutionCompletedEvent);
    expect((events[3] as AgentExecutionCompletedEvent).output).toBe("provider output");
  });

  it("passes task response models to LLM providers", async () => {
    const responseModel = { type: "object", properties: { summary: { type: "string" } } };
    const seen: LLMCallOptions[] = [];
    const agentInstance = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      llm: (_messages, options) => {
        if (options) {
          seen.push(options);
        }
        return "{\"summary\":\"done\"}";
      },
    });
    const taskInstance = new Task({
      description: "Research",
      expectedOutput: "A structured summary",
      agent: agentInstance,
      responseModel,
      outputJson: true,
    });

    await taskInstance.execute();

    expect(seen[0]?.responseModel).toBe(responseModel);
  });

  it("converts raw task output through outputConverter before JSON export", async () => {
    const agentInstance = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      llm: () => "summary=done",
    });
    const taskInstance = new Task({
      description: "Research",
      expectedOutput: "A structured summary",
      agent: agentInstance,
      outputJson: true,
      outputConverter: (raw) => ({ summary: raw.split("=")[1] }),
    });

    const output = await taskInstance.execute();

    expect(output.raw).toBe("summary=done");
    expect(output.jsonDict).toEqual({ summary: "done" });
  });

  it("converts raw task output through outputConverter before pydantic export", async () => {
    const agentInstance = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      llm: () => "score=5",
    });
    const taskInstance = new Task({
      description: "Score",
      expectedOutput: "A structured score",
      agent: agentInstance,
      outputPydantic: (raw) => ({ raw }),
      outputConverter: (raw) => ({ score: Number(raw.split("=")[1]) }),
    });

    const output = await taskInstance.execute();

    expect(output.pydantic).toEqual({ score: 5 });
  });

  it("resolves string model names through the provider registry", async () => {
    registerLLMProvider("test/model", () => "registered output");
    const agentInstance = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      llm: "test/model",
    });

    await expect(agentInstance.executeTask("Research CrewAI"))
      .resolves.toBe("registered output");
    expect(agentInstance.getUsageMetrics().successfulRequests).toBe(1);
  });

  it("fails clearly when a string model has no registered provider", async () => {
    const agentInstance = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      llm: "missing/model",
    });

    await expect(agentInstance.executeTask("Research CrewAI"))
      .rejects.toThrow("No LLM provider registered");
  });
});

describe("task output files", () => {
  it("accepts upstream snake_case Task options for structured output files", async () => {
    const baseDirectory = mkdtempSync(join(tmpdir(), "crewai-ts-snake-task-"));
    const outputFile = join(baseDirectory, "{topic}", "result.json");
    const agentInstance = new Agent({
      role: "Writer",
      goal: "Write reports",
      backstory: "Careful writer",
      llm: () => "summary=done",
    });
    const taskInstance = new Task({
      description: "Write about {topic}",
      expected_output: "A JSON report",
      config: { source: "upstream" },
      prompt_context: "Existing context",
      agent: agentInstance,
      output_json: true,
      output_file: outputFile,
      create_directory: true,
      async_execution: false,
      human_input: false,
      allow_crewai_trigger_context: true,
      max_retries: 2,
      retry_count: 1,
      used_tools: 3,
      tools_errors: 1,
      delegations: 2,
      processed_by_agents: ["Writer"],
      start_time: "2026-05-28T00:00:00.000Z",
      end_time: "2026-05-28T00:00:01.000Z",
      checkpoint_original_description: "Original {topic}",
      checkpoint_original_expected_output: "Original output",
      checkpoint_original_output_file: "original.txt",
      guardrail_max_retries: 1,
      converter_cls: (raw) => ({ summary: raw.split("=")[1] }),
    });

    const output = await taskInstance.execute({ topic: "CrewAI" });

    expect(taskInstance.expected_output).toBe("A JSON report");
    expect(taskInstance.config).toEqual({ source: "upstream" });
    expect(taskInstance.prompt_context).toBeNull();
    expect(taskInstance.output_json).toBe(true);
    expect(taskInstance.output_file).toBe(outputFile);
    expect(taskInstance.create_directory).toBe(true);
    expect(taskInstance.async_execution).toBe(false);
    expect(taskInstance.human_input).toBe(false);
    expect(taskInstance.allow_crewai_trigger_context).toBe(true);
    expect(taskInstance.max_retries).toBe(2);
    expect(taskInstance.retry_count).toBe(1);
    expect(taskInstance.used_tools).toBe(3);
    expect(taskInstance.tools_errors).toBe(1);
    expect(taskInstance.delegations).toBe(2);
    expect([...taskInstance.processed_by_agents]).toEqual(["Writer"]);
    expect(taskInstance.start_time).toBeInstanceOf(Date);
    expect(taskInstance.end_time).toBeInstanceOf(Date);
    expect(taskInstance.checkpoint_original_description).toBe("Original {topic}");
    expect(taskInstance.checkpoint_original_expected_output).toBe("Original output");
    expect(taskInstance.checkpoint_original_output_file).toBe("original.txt");
    expect(taskInstance.guardrail_max_retries).toBe(1);
    expect(taskInstance.converter_cls).toBe(taskInstance.outputConverter);
    expect(output.json_dict).toEqual({ summary: "done" });
    expect(readFileSync(join(baseDirectory, "CrewAI", "result.json"), "utf8"))
      .toBe("{\n  \"summary\": \"done\"\n}");
  });

  it("writes interpolated raw task output files and creates directories", async () => {
    const baseDirectory = mkdtempSync(join(tmpdir(), "crewai-ts-output-"));
    const outputFile = join(baseDirectory, "{topic}", "result.txt");
    const agentInstance = new Agent({
      role: "Writer",
      goal: "Write reports",
      backstory: "Careful writer",
      llm: () => "final report",
    });
    const taskInstance = new Task({
      description: "Write about {topic}",
      expectedOutput: "A report",
      agent: agentInstance,
      outputFile,
    });

    await taskInstance.execute({ topic: "CrewAI" });

    expect(readFileSync(join(baseDirectory, "CrewAI", "result.txt"), "utf8"))
      .toBe("final report");
  });

  it("writes JSON task output as pretty JSON", async () => {
    const baseDirectory = mkdtempSync(join(tmpdir(), "crewai-ts-json-output-"));
    const outputFile = join(baseDirectory, "{name}.json");
    const agentInstance = new Agent({
      role: "Writer",
      goal: "Write reports",
      backstory: "Careful writer",
      llm: () => "{\"summary\":\"done\"}",
    });
    const taskInstance = new Task({
      description: "Write JSON",
      expectedOutput: "A JSON report",
      agent: agentInstance,
      outputJson: true,
      outputFile,
    });

    await taskInstance.execute({ name: "result" });

    expect(readFileSync(join(baseDirectory, "result.json"), "utf8")).toBe("{\n  \"summary\": \"done\"\n}");
  });

  it("rejects unsafe output file paths", () => {
    const agentInstance = new Agent({
      role: "Writer",
      goal: "Write reports",
      backstory: "Careful writer",
    });

    expect(() => new Task({
      description: "Write",
      expectedOutput: "A report",
      agent: agentInstance,
      outputFile: "../result.txt",
    })).toThrow("Path traversal");
  });
});

describe("task input files", () => {
  it("injects text input files into the task prompt", async () => {
    const baseDirectory = mkdtempSync(join(tmpdir(), "crewai-ts-input-"));
    const notesFile = join(baseDirectory, "notes.txt");
    writeFileSync(notesFile, "File notes");
    const prompts: string[] = [];
    const agentInstance = new Agent({
      role: "Reader",
      goal: "Read files",
      backstory: "Careful reader",
      llm: (messages) => {
        prompts.push(messages.at(-1)?.content ?? "");
        return "done";
      },
    });
    const taskInstance = new Task({
      description: "Summarize files",
      expectedOutput: "Summary",
      agent: agentInstance,
      inputFiles: {
        notes: notesFile,
        inline: {
          filename: "inline.md",
          contentType: "text/markdown",
          content: "# Inline notes",
        },
      },
    });

    await taskInstance.execute();

    expect(prompts[0]).toContain("Input files (content already loaded in conversation):");
    expect(prompts[0]).toContain('"notes" (notes.txt, text/plain)');
    expect(prompts[0]).toContain("    File notes");
    expect(prompts[0]).toContain('"inline" (inline.md, text/markdown)');
    expect(prompts[0]).toContain("    # Inline notes");
  });

  it("exposes task input files through read_file during task execution", async () => {
    const agentInstance = new Agent({
      role: "Reader",
      goal: "Read files",
      backstory: "Careful reader",
      llm: (messages, options) => {
        if (!messages.some((message) => message.role === "tool")) {
          expect(options?.tools?.map((toolInstance) => toolInstance.name)).toContain("read_file");
          return { toolName: "read_file", arguments: { file_name: "notes" } };
        }
        return messages.at(-1)?.content ?? "";
      },
    });
    const taskInstance = new Task({
      description: "Summarize files",
      expectedOutput: "Summary",
      agent: agentInstance,
      inputFiles: {
        notes: {
          filename: "notes.txt",
          content: "Task notes",
        },
      },
    });

    const output = await taskInstance.execute();

    expect(output.raw).toBe("read_file result:\nTask notes");
    expect(taskInstance.usedTools).toBe(1);
  });

  it("preserves task input files when copying crews", () => {
    const agentInstance = new Agent({
      role: "Reader",
      goal: "Read files",
      backstory: "Careful reader",
    });
    const taskInstance = new Task({
      description: "Read",
      expectedOutput: "Summary",
      agent: agentInstance,
      inputFiles: {
        notes: {
          filename: "notes.txt",
          content: "Important notes",
        },
      },
    });

    const copied = new Crew({ agents: [agentInstance], tasks: [taskInstance] }).copy();

    expect(copied.tasks[0]?.inputFiles).toEqual(taskInstance.inputFiles);
  });

  it("passes shared kickoff input files to tasks and lets task input files override them", async () => {
    const prompts: string[] = [];
    const agentInstance = new Agent({
      role: "Reader",
      goal: "Read files",
      backstory: "Careful reader",
      llm: (messages) => {
        prompts.push(messages.at(-1)?.content ?? "");
        return "done";
      },
    });
    const first = new Task({
      description: "Read shared",
      expectedOutput: "Shared summary",
      agent: agentInstance,
    });
    const second = new Task({
      description: "Read override",
      expectedOutput: "Override summary",
      agent: agentInstance,
      inputFiles: {
        shared: {
          filename: "task.txt",
          content: "task file content",
        },
      },
    });

    await new Crew({ agents: [agentInstance], tasks: [first, second] }).kickoff({
      input_files: {
        shared: {
          filename: "crew.txt",
          content: "crew file content",
        },
      },
    });

    expect(prompts[0]).toContain('"shared" (crew.txt, text/plain)');
    expect(prompts[0]).toContain("    crew file content");
    expect(prompts[1]).toContain('"shared" (task.txt, text/plain)');
    expect(prompts[1]).toContain("    task file content");
    expect(prompts[1]).not.toContain("crew file content");
  });

  it("extracts structured input files from crew kickoff inputs", async () => {
    const prompts: string[] = [];
    const agentInstance = new Agent({
      role: "Reader",
      goal: "Read files",
      backstory: "Careful reader",
      llm: (messages) => {
        prompts.push(messages.at(-1)?.content ?? "");
        return "done";
      },
    });
    const taskInstance = new Task({
      description: "Read {topic} {notes}",
      expectedOutput: "Summary",
      agent: agentInstance,
    });

    await new Crew({ agents: [agentInstance], tasks: [taskInstance] }).kickoff({
      inputs: {
        topic: "CrewAI",
        notes: {
          filename: "notes.txt",
          content: "Crew notes",
        },
      },
    });

    expect(prompts[0]).toContain("Task: Read CrewAI {notes}");
    expect(prompts[0]).toContain('"notes" (notes.txt, text/plain)');
    expect(prompts[0]).toContain("    Crew notes");
  });

  it("lets structured input files from inputs override explicit kickoff input files", async () => {
    const agentInstance = new Agent({
      role: "Reader",
      goal: "Read files",
      backstory: "Careful reader",
      llm: (messages, options) => {
        if (!messages.some((message) => message.role === "tool")) {
          expect(options?.tools?.map((toolInstance) => toolInstance.name)).toContain("read_file");
          return { toolName: "read_file", arguments: { file_name: "notes" } };
        }
        return messages.at(-1)?.content ?? "";
      },
    });
    const taskInstance = new Task({
      description: "Read extracted file",
      expectedOutput: "Summary",
      agent: agentInstance,
    });

    const output = await new Crew({ agents: [agentInstance], tasks: [taskInstance] }).kickoff({
      inputs: {
        notes: {
          filename: "inputs.txt",
          content: "inputs file content",
        },
      },
      inputFiles: {
        notes: {
          filename: "explicit.txt",
          content: "explicit file content",
        },
      },
    });

    expect(output.raw).toBe("read_file result:\ninputs file content");
  });

  it("shares kickoff input files across kickoffForEach executions", async () => {
    const prompts: string[] = [];
    const agentInstance = new Agent({
      role: "Reader",
      goal: "Read files",
      backstory: "Careful reader",
      llm: (messages) => {
        prompts.push(messages.at(-1)?.content ?? "");
        return "done";
      },
    });
    const taskInstance = new Task({
      description: "Read for {topic}",
      expectedOutput: "Summary",
      agent: agentInstance,
    });

    await new Crew({ agents: [agentInstance], tasks: [taskInstance] }).kickoffForEach({
      inputs: [{ topic: "A" }, { topic: "B" }],
      inputFiles: {
        notes: {
          filename: "notes.txt",
          content: "shared notes",
        },
      },
    });

    expect(prompts).toHaveLength(2);
    expect(prompts[0]).toContain("    shared notes");
    expect(prompts[1]).toContain("    shared notes");
  });
});

describe("task interpolation", () => {
  it("interpolates complex input values into task prompts and output metadata", async () => {
    const seenPrompts: string[] = [];
    const researcher = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      llm: (messages) => {
        const prompt = messages.at(-1)?.content ?? "";
        seenPrompts.push(prompt);
        return "done";
      },
    });
    const taskInstance = new Task({
      description: "Analyze {company}",
      expectedOutput: "Summarize {metrics}",
      agent: researcher,
    });

    const output = await taskInstance.execute({
      company: { name: "CrewAI", departments: ["research", "engineering"] },
      metrics: [1, 2, { active: true, optional: null }],
    });

    expect(seenPrompts[0]).toContain('Task: Analyze {"name":"CrewAI","departments":["research","engineering"]}');
    expect(seenPrompts[0]).toContain('Expected output: Summarize [1,2,{"active":true,"optional":null}]');
    expect(output.description).toBe('Analyze {"name":"CrewAI","departments":["research","engineering"]}');
    expect(output.expectedOutput).toBe('Summarize [1,2,{"active":true,"optional":null}]');
  });

  it("interpolates outputFile from inputs without mutating the original template", async () => {
    const baseDirectory = mkdtempSync(join(tmpdir(), "crewai-ts-interpolation-"));
    const taskInstance = new Task({
      description: "Write {topic}",
      expectedOutput: "Report for {topic}",
      agent: new Agent({
        role: "Writer",
        goal: "Write",
        backstory: "Writes reports",
        llm: () => "report",
      }),
      outputFile: join(baseDirectory, "{topic}", "report.txt"),
    });

    await taskInstance.execute({ topic: "AI" });
    await taskInstance.execute({ topic: "ML" });

    expect(readFileSync(join(baseDirectory, "AI", "report.txt"), "utf8")).toBe("report");
    expect(readFileSync(join(baseDirectory, "ML", "report.txt"), "utf8")).toBe("report");
    expect(taskInstance.outputFile).toBe(join(baseDirectory, "{topic}", "report.txt"));
  });

  it("validates unsupported interpolation values", () => {
    expect(interpolateOnly("Hello {name}", { name: "CrewAI" })).toBe("Hello CrewAI");
    expect(interpolateOnly("Value: {value}", { value: 42 })).toBe("Value: 42");
    expect(interpolateOnly("This {123} and {!var} should stay but {valid_var} changes", { valid_var: "ok" }))
      .toBe("This {123} and {!var} should stay but ok changes");
    expect(interpolateOnly(null, { name: "CrewAI" })).toBe("");
    expect(() => interpolateOnly("{missing}", {})).toThrow("Inputs dictionary cannot be empty");
    expect(() => interpolateOnly("{data}", { data: new Set(["x"]) })).toThrow("Unsupported type Set");
    expect(() => interpolateOnly("{data}", { data: { valid: 1, invalid: () => "x" } }))
      .toThrow("Unsupported type function");
  });

  it("sanitizes tool names and slugifies strings using upstream-compatible rules", () => {
    expect(sanitizeToolName("Read File Tool")).toBe("read_file_tool");
    expect(sanitizeToolName("XMLHTTPParser")).toBe("xmlhttp_parser");
    expect(sanitizeToolName("검색 Tool!")).toBe("tool");
    expect(sanitizeToolName("x".repeat(80))).toMatch(/^x{55}_[a-f0-9]{8}$/);
    expect(slugify("CrewAI: Hello World!", "-")).toBe("crewai-hello-world");
  });
});

describe("task guardrails", () => {
  it("runs multiple guardrails in order and uses their transformed output", async () => {
    const seen: string[] = [];
    const agentInstance = new Agent({
      role: "Writer",
      goal: "Write reports",
      backstory: "Careful writer",
      llm: () => "draft",
    });
    const taskInstance = new Task({
      description: "Write",
      expectedOutput: "A report",
      agent: agentInstance,
      guardrails: [
        (output) => {
          seen.push(output.raw);
          return [true, `${output.raw} with facts`];
        },
        (output) => {
          seen.push(output.raw);
          return { success: true, result: `${output.raw} final` };
        },
      ],
    });

    const output = await taskInstance.execute();

    expect(output.raw).toBe("draft with facts final");
    expect(seen).toEqual(["draft", "draft with facts"]);
  });

  it("retries the failing guardrail before continuing to the next one", async () => {
    let attempts = 0;
    const events: CrewAIEvent[] = [];
    crewaiEventBus.on("llm_guardrail_started", (_source, event) => {
      events.push(event);
    });
    crewaiEventBus.on("llm_guardrail_completed", (_source, event) => {
      events.push(event);
    });
    const agentInstance = new Agent({
      role: "Writer",
      goal: "Write reports",
      backstory: "Careful writer",
      llm: () => "draft",
    });
    const taskInstance = new Task({
      description: "Write",
      expectedOutput: "A report",
      agent: agentInstance,
      guardrailMaxRetries: 2,
      guardrails: [
        (output) => {
          attempts += 1;
          return attempts === 1
            ? [false, `${output.raw} fixed`]
            : [true, output.raw];
        },
        (output) => [true, `${output.raw} accepted`],
      ],
    });

    const output = await taskInstance.execute();

    expect(output.raw).toBe("draft fixed accepted");
    expect(attempts).toBe(2);
    expect(events.map((event) => event.type)).toEqual([
      "llm_guardrail_started",
      "llm_guardrail_completed",
      "llm_guardrail_started",
      "llm_guardrail_completed",
      "llm_guardrail_started",
      "llm_guardrail_completed",
    ]);
    expect(events[0]).toBeInstanceOf(LLMGuardrailStartedEvent);
    expect((events[0] as LLMGuardrailStartedEvent).retry_count).toBe(0);
    expect((events[1] as LLMGuardrailCompletedEvent).success).toBe(false);
    expect((events[1] as LLMGuardrailCompletedEvent).error).toBe("draft fixed");
    expect((events[3] as LLMGuardrailCompletedEvent).success).toBe(true);
    expect((events[5] as LLMGuardrailCompletedEvent).result).toBe("draft fixed accepted");
  });
});

describe("task execution tracking", () => {
  it("tracks prompt context, processed agents, and used tools", async () => {
    const search = new StructuredTool({
      name: "search",
      description: "Search",
      func: () => "tool result",
    });
    const agent = new Agent({
      role: "Researcher",
      goal: "Track",
      backstory: "Careful analyst",
      tools: [search],
      llm: (messages) => messages.some((message) => message.role === "tool")
        ? "final"
        : { toolName: "search", arguments: {} },
    });
    const contextTask = new Task({
      description: "Context",
      expectedOutput: "Context",
      agent,
    });
    contextTask.output = new TaskOutput({
      description: "Context",
      raw: "context raw output",
      agent: "Researcher",
    });
    const taskInstance = new Task({
      description: "Tracked task",
      expectedOutput: "Tracked",
      agent,
      context: [contextTask],
    });

    await taskInstance.execute();

    expect(taskInstance.promptContext).toBe("context raw output");
    expect(taskInstance.usedTools).toBe(1);
    expect(taskInstance.toolsErrors).toBe(0);
    expect(taskInstance.processedByAgents.has("Researcher")).toBe(true);
  });

  it("tracks delegation tool usage and coworker processing", async () => {
    const analyst = new Agent({
      role: "Analyst",
      goal: "Delegate",
      backstory: "Coordinates work",
      allowDelegation: true,
      llm: (messages) => messages.some((message) => message.role === "tool")
        ? "delegated"
        : { toolName: "Delegate_work_to_coworker", arguments: { coworker: "Writer", task: "Draft" } },
    });
    const writer = new Agent({
      role: "Writer",
      goal: "Write",
      backstory: "Writes clearly",
      llm: () => "writer result",
    });
    const taskInstance = new Task({
      description: "Coordinate",
      expectedOutput: "Delegated",
      agent: analyst,
    });

    await new Crew({
      agents: [analyst, writer],
      tasks: [taskInstance],
    }).kickoff();

    expect(taskInstance.usedTools).toBe(1);
    expect(taskInstance.delegations).toBe(1);
    expect(taskInstance.processedByAgents.has("Analyst")).toBe(true);
    expect(taskInstance.processedByAgents.has("Writer")).toBe(true);
  });

  it("tracks tool errors when tool validation fails", async () => {
    const needsQuery = new StructuredTool({
      name: "needs query",
      description: "Needs a query",
      argsSchema: {
        query: { type: "string", required: true },
      },
      func: () => "never",
    });
    const agent = new Agent({
      role: "Researcher",
      goal: "Track errors",
      backstory: "Careful analyst",
      tools: [needsQuery],
      llm: () => ({ toolName: "needs_query", arguments: {} }),
    });
    const taskInstance = new Task({
      description: "Use invalid tool",
      expectedOutput: "Error",
      agent,
    });

    await expect(taskInstance.execute()).rejects.toThrow("missing required argument");

    expect(taskInstance.toolsErrors).toBe(1);
    expect(taskInstance.usedTools).toBe(0);
  });
});

describe("crewai trigger payload context", () => {
  it("auto-injects crewai_trigger_payload into the first sequential task", async () => {
    const prompts: string[] = [];
    const agent = new Agent({
      role: "Researcher",
      goal: "Use trigger payload",
      backstory: "Careful analyst",
      llm: (messages) => {
        prompts.push(messages.at(-1)?.content ?? "");
        return "done";
      },
    });

    await new Crew({
      agents: [agent],
      tasks: [
        new Task({ description: "First", expectedOutput: "First", agent }),
        new Task({ description: "Second", expectedOutput: "Second", agent }),
      ],
    }).kickoff({ inputs: { crewai_trigger_payload: "Initial context data" } });

    expect(prompts[0]).toContain("Trigger Payload: Initial context data");
    expect(prompts[1]).not.toContain("Trigger Payload:");
  });

  it("does not auto-inject trigger payload when first task opts out", async () => {
    const prompts: string[] = [];
    const agent = new Agent({
      role: "Researcher",
      goal: "Use trigger payload",
      backstory: "Careful analyst",
      llm: (messages) => {
        prompts.push(messages.at(-1)?.content ?? "");
        return "done";
      },
    });

    await new Crew({
      agents: [agent],
      tasks: [
        new Task({
          description: "First",
          expectedOutput: "First",
          agent,
          allowCrewaiTriggerContext: false,
        }),
        new Task({
          description: "Second",
          expectedOutput: "Second",
          agent,
          allowCrewaiTriggerContext: true,
        }),
      ],
    }).kickoff({ inputs: { crewai_trigger_payload: { source: "webhook" } } });

    expect(prompts[0]).not.toContain("Trigger Payload:");
    expect(prompts[1]).toContain('Trigger Payload: {"source":"webhook"}');
  });
});

describe("human input", () => {
  it("requests feedback for humanInput tasks and reruns until accepted", async () => {
    const prompts: string[] = [];
    const feedbackRequests: string[] = [];
    const humanEventTypes: string[] = [];
    const provider: HumanInputProvider = {
      requestFeedback: ({ output }) => {
        feedbackRequests.push(output.raw);
        return feedbackRequests.length === 1 ? "Include the approval detail" : "";
      },
    };
    const reviewer = new Agent({
      role: "Reviewer",
      goal: "Review output",
      backstory: "Careful human-in-the-loop worker",
      llm: (messages) => {
        const prompt = messages.at(-1)?.content ?? "";
        prompts.push(prompt);
        return prompt.includes("Human feedback:")
          ? "revised with approval detail"
          : "draft";
      },
    });
    const taskInstance = new Task({
      description: "Write report",
      expectedOutput: "Reviewed report",
      agent: reviewer,
      humanInput: true,
    });
    crewaiEventBus.on("human_feedback_requested", (_, event) => {
      humanEventTypes.push(event.type);
    });
    crewaiEventBus.on("human_feedback_received", (_, event) => {
      humanEventTypes.push(event.type);
    });

    const output = await new Crew({
      agents: [reviewer],
      tasks: [taskInstance],
      humanInputProvider: provider,
    }).kickoff();

    expect(output.raw).toBe("revised with approval detail");
    expect(feedbackRequests).toEqual(["draft", "revised with approval detail"]);
    expect(prompts[1]).toContain("Human feedback:\nInclude the approval detail");
    expect(humanEventTypes).toContain("human_feedback_requested");
    expect(humanEventTypes).toContain("human_feedback_received");
  });

  it("accepts the first output when human feedback is empty", async () => {
    const provider: HumanInputProvider = {
      requestFeedback: () => "   ",
    };
    const reviewer = new Agent({
      role: "Reviewer",
      goal: "Review output",
      backstory: "Careful human-in-the-loop worker",
      llm: () => "accepted draft",
    });

    const output = await new Task({
      description: "Write report",
      expectedOutput: "Reviewed report",
      agent: reviewer,
      humanInput: true,
    }).execute({}, null, undefined, false, { humanInputProvider: provider });

    expect(output.raw).toBe("accepted draft");
    expect(reviewer.getUsageMetrics().successfulRequests).toBe(1);
  });
});

describe("async task execution", () => {
  it("collects pending async tasks before running the next sync task", async () => {
    const events: string[] = [];
    const agent = new Agent({
      role: "Worker",
      goal: "Run tasks",
      backstory: "Async capable",
      llm: async (messages) => {
        const prompt = messages.at(-1)?.content ?? "";
        if (prompt.includes("first")) {
          events.push("first:start");
          await delay(30);
          events.push("first:end");
          return "first output";
        }
        if (prompt.includes("second")) {
          events.push("second:start");
          await delay(5);
          events.push("second:end");
          return "second output";
        }
        events.push("sync:start");
        return "sync output";
      },
    });
    const first = new Task({
      description: "first",
      expectedOutput: "first",
      agent,
      asyncExecution: true,
    });
    const second = new Task({
      description: "second",
      expectedOutput: "second",
      agent,
      asyncExecution: true,
    });
    const sync = new Task({
      description: "sync",
      expectedOutput: "sync",
      agent,
      context: [],
    });

    const output = await new Crew({
      agents: [agent],
      tasks: [first, second, sync],
    }).kickoff();

    expect(output.tasksOutput.map((taskOutput) => taskOutput.raw)).toEqual([
      "first output",
      "second output",
      "sync output",
    ]);
    expect(events.indexOf("sync:start")).toBeGreaterThan(events.indexOf("first:end"));
    expect(events.indexOf("sync:start")).toBeGreaterThan(events.indexOf("second:end"));
  });

  it("rejects crews ending with more than one async task", async () => {
    const agent = new Agent({
      role: "Worker",
      goal: "Run tasks",
      backstory: "Async capable",
    });
    const first = new Task({
      description: "first",
      expectedOutput: "first",
      agent,
      asyncExecution: true,
    });
    const second = new Task({
      description: "second",
      expectedOutput: "second",
      agent,
      asyncExecution: true,
    });

    await expect(new Crew({ agents: [agent], tasks: [first, second] }).kickoff())
      .rejects.toThrow("at most one asynchronous task");
  });

  it("rejects context dependencies on future tasks", async () => {
    const agent = new Agent({
      role: "Worker",
      goal: "Run tasks",
      backstory: "Async capable",
    });
    const future = new Task({
      description: "future",
      expectedOutput: "future",
      agent,
    });
    const current = new Task({
      description: "current",
      expectedOutput: "current",
      agent,
      context: [future],
    });

    await expect(new Crew({ agents: [agent], tasks: [current, future] }).kickoff())
      .rejects.toThrow("future task");
  });
});

describe("conditional tasks", () => {
  it("skips a conditional task based on the previous task output and records an empty output", async () => {
    const calls: string[] = [];
    const researcher = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      llm: (messages) => {
        const content = messages.at(-1)?.content ?? "";
        calls.push(content);
        return content.includes("initial") ? "skip follow-up" : "conditional ran";
      },
    });
    const initial = new Task({
      description: "initial",
      expectedOutput: "initial",
      agent: researcher,
    });
    const conditional = new ConditionalTask({
      description: "conditional",
      expectedOutput: "conditional",
      agent: researcher,
      condition: (output) => !output.raw.includes("skip"),
    });

    const output = await new Crew({ agents: [researcher], tasks: [initial, conditional] }).kickoff();

    expect(output.raw).toBe("");
    expect(output.tasksOutput).toHaveLength(2);
    expect(output.tasksOutput[1]?.raw).toBe("");
    expect(calls).toHaveLength(1);
  });

  it("supports Python-compatible conditional task method aliases", async () => {
    const researcher = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      llm: () => "done",
    });
    const previousOutput = new TaskOutput({
      description: "Previous",
      raw: "ready",
      agent: "Researcher",
    });
    const conditional = new ConditionalTask({
      description: "conditional",
      expectedOutput: "conditional",
      agent: researcher,
      condition: (output) => output.raw === "ready",
    });

    await expect(conditional.should_execute(previousOutput)).resolves.toBe(true);
    const skipped = conditional.get_skipped_task_output();
    expect(skipped.raw).toBe("");
    expect(skipped.agent).toBe("Researcher");
    expect(skipped.output_format).toBe(OutputFormat.RAW);
  });

  it("flushes pending async outputs before evaluating a conditional task", async () => {
    const researcher = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      llm: async (messages) => {
        const content = messages.at(-1)?.content ?? "";
        await delay(content.includes("async") ? 5 : 1);
        return content.includes("async") ? "async result" : "sync result";
      },
    });
    const syncTask = new Task({
      description: "sync",
      expectedOutput: "sync",
      agent: researcher,
    });
    const asyncTask = new Task({
      description: "async",
      expectedOutput: "async",
      agent: researcher,
      asyncExecution: true,
    });
    const seen: string[] = [];
    const conditional = new ConditionalTask({
      description: "conditional",
      expectedOutput: "conditional",
      agent: researcher,
      context: [],
      condition: (output) => {
        seen.push(output.raw);
        return true;
      },
    });

    const output = await new Crew({ agents: [researcher], tasks: [syncTask, asyncTask, conditional] }).kickoff();

    expect(seen).toEqual(["async result"]);
    expect(output.tasksOutput.map((taskOutput) => taskOutput.raw)).toEqual([
      "sync result",
      "async result",
      "sync result",
    ]);
  });

  it("validates conditional task placement and async execution constraints", async () => {
    const researcher = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      llm: () => "done",
    });
    const conditional = new ConditionalTask({
      description: "conditional",
      expectedOutput: "conditional",
      agent: researcher,
      condition: () => true,
    });
    const normal = new Task({
      description: "normal",
      expectedOutput: "normal",
      agent: researcher,
    });

    await expect(new Crew({ agents: [researcher], tasks: [conditional] }).kickoff())
      .rejects.toThrow("Crew must include at least one non-conditional task");
    await expect(new Crew({ agents: [researcher], tasks: [conditional, normal] }).kickoff())
      .rejects.toThrow("The first task cannot be a ConditionalTask");
    await expect(new Crew({
      agents: [researcher],
      tasks: [normal, new ConditionalTask({
        description: "async conditional",
        expectedOutput: "async conditional",
        agent: researcher,
        asyncExecution: true,
        condition: () => true,
      })],
    }).kickoff()).rejects.toThrow("ConditionalTask cannot be executed asynchronously");
  });
});

describe("crew planning", () => {
  it("uses a planning LLM to add per-task plans to execution prompts", async () => {
    const prompts: string[] = [];
    const plannerCalls: string[] = [];
    const plannerLlm = (messages: LLMMessage[]) => {
      plannerCalls.push(messages.at(-1)?.content ?? "");
      return JSON.stringify({
        list_of_plans_per_task: [
          {
            task_number: 1,
            task: "Research",
            plan: "Use the search tool first, then summarize.",
          },
        ],
      });
    };
    const researcher = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      llm: (messages) => {
        const prompt = messages.at(-1)?.content ?? "";
        prompts.push(prompt);
        return prompt;
      },
    });
    const taskInstance = new Task({
      description: "Research {topic}",
      expectedOutput: "A concise brief",
      agent: researcher,
    });

    const output = await new Crew({
      agents: [researcher],
      tasks: [taskInstance],
      planning: true,
      planningLlm: plannerLlm,
    }).kickoff({ inputs: { topic: "CrewAI" } });

    expect(plannerCalls[0]).toContain("Task Number 1 - Research {topic}");
    expect(output.raw).toContain("Planning:\nUse the search tool first, then summarize.");
    expect(prompts[0]?.match(/Use the search tool first/g)).toHaveLength(1);
    expect(output.tokenUsage.successfulRequests).toBe(2);
  });

  it("replaces planning instructions on repeated kickoffs instead of accumulating them", async () => {
    let planNumber = 0;
    const prompts: string[] = [];
    const researcher = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      llm: (messages) => {
        const prompt = messages.at(-1)?.content ?? "";
        prompts.push(prompt);
        return prompt;
      },
    });
    const crewInstance = new Crew({
      agents: [researcher],
      tasks: [new Task({
        description: "Research",
        expectedOutput: "A concise brief",
        agent: researcher,
      })],
      planning: true,
      planningLlm: () => JSON.stringify({
        listOfPlansPerTask: [
          {
            taskNumber: 1,
            task: "Research",
            plan: `Plan ${String(++planNumber)}`,
          },
        ],
      }),
    });

    await crewInstance.kickoff();
    await crewInstance.kickoff();

    expect(prompts[0]).toContain("Plan 1");
    expect(prompts[1]).not.toContain("Plan 1");
    expect(prompts[1]).toContain("Plan 2");
  });
});

describe("events", () => {
  it("exposes the upstream ConsoleFormatter lifecycle surface", () => {
    const formatter = new ConsoleFormatter({ verbose: true });
    const printed: unknown[][] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      printed.push(args);
    };
    try {
      formatter.handle_crew_started("Crew", "crew-1");
      formatter.handle_task_started("task-1", "Task");
      formatter.handle_tool_usage_started("search", { query: "CrewAI" });
      formatter.handle_tool_usage_finished("search", "result");
      formatter.handle_a2a_message_sent("hello", 1, "User");
      formatter.handle_a2a_response_received("world", 1, "completed", "Agent");
      formatter.handle_mcp_connection_failed("server", "http://localhost", "sse", "boom", "Error");
      formatter.handle_llm_stream_chunk("partial", LLMCallType.LLM_CALL);
      formatter.handle_llm_stream_completed();
    } finally {
      console.log = originalLog;
    }

    expect(printed.length).toBeGreaterThan(0);
    expect(formatter.current_a2a_turn_count).toBe(0);
    expect(typeof formatter.handle_memory_save_completed).toBe("function");
    expect(typeof formatter.handle_goal_achieved_early).toBe("function");
    expect(typeof formatter.handle_a2a_polling_status).toBe("function");
  });

  it("emits crew, task, and tool lifecycle events in execution order", async () => {
    const seen: string[] = [];
    const offHandlers = [
      crewaiEventBus.on("crew_kickoff_started", (_source, event) => {
        seen.push(`${String(event.emissionSequence)}:${event.type}`);
      }),
      crewaiEventBus.on("task_started", (_source, event) => {
        seen.push(`${String(event.emissionSequence)}:${event.type}:${event.taskDescription}`);
      }),
      crewaiEventBus.on("agent_execution_started", (_source, event) => {
        seen.push(`${String(event.emissionSequence)}:${event.type}:${event.taskPrompt}`);
      }),
      crewaiEventBus.on("tool_usage_started", (_source, event) => {
        seen.push(`${String(event.emissionSequence)}:${event.type}:${event.toolName}`);
      }),
      crewaiEventBus.on("tool_usage_finished", (_source, event) => {
        seen.push(`${String(event.emissionSequence)}:${event.type}:${String(event.output)}`);
      }),
      crewaiEventBus.on("agent_execution_completed", (_source, event) => {
        seen.push(`${String(event.emissionSequence)}:${event.type}:${event.output}`);
      }),
      crewaiEventBus.on("task_completed", (_source, event) => {
        seen.push(`${String(event.emissionSequence)}:${event.type}:${event.output.raw}`);
      }),
      crewaiEventBus.on("crew_kickoff_completed", (_source, event) => {
        seen.push(`${String(event.emissionSequence)}:${event.type}:${event.output.raw}`);
      }),
    ];
    const search = new StructuredTool({
      name: "search",
      description: "Search for a topic",
      func: () => "tool output",
    });
    const agent = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      tools: [search],
    });
    const taskInstance = new Task({
      description: "Research {topic}",
      expectedOutput: "A concise brief",
      agent,
    });

    const output = await new Crew({ agents: [agent], tasks: [taskInstance] }).kickoff({
      inputs: { topic: "CrewAI" },
    });

    offHandlers.forEach((off) => {
      off();
    });
    expect(output.raw).toContain("tool output");
    expect(seen.map((entry) => entry.split(":")[1])).toEqual([
      "crew_kickoff_started",
      "task_started",
      "agent_execution_started",
      "tool_usage_started",
      "tool_usage_finished",
      "agent_execution_completed",
      "task_completed",
      "crew_kickoff_completed",
    ]);
    expect(seen[0]?.startsWith("1:")).toBe(true);
    expect(seen.at(-1)?.startsWith("8:")).toBe(true);
  });

  it("emits failure events for tool validation and task/crew failures", async () => {
    const seen: string[] = [];
    crewaiEventBus.on("tool_validate_input_error", (_source, event) => {
      seen.push(`${event.type}:${event.toolName}`);
    });
    crewaiEventBus.on("task_failed", (_source, event) => {
      seen.push(`${event.type}:${event.taskDescription}`);
    });
    crewaiEventBus.on("crew_kickoff_failed", (_source, event) => {
      seen.push(`${event.type}:${event.error}`);
    });
    const toolInstance = new StructuredTool({
      name: "needs query",
      description: "Requires query",
      argsSchema: {
        query: { type: "string", required: true },
      },
      func: () => "never",
    });
    const agent = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      tools: [toolInstance],
      llm: () => ({ toolName: "needs_query", arguments: {} }),
    });
    const taskInstance = new Task({
      description: "Research",
      expectedOutput: "A concise brief",
      agent,
    });

    await expect(new Crew({ agents: [agent], tasks: [taskInstance] }).kickoff())
      .rejects.toThrow("missing required argument");

    expect(seen).toEqual([
      "tool_validate_input_error:needs_query",
      "task_failed:Research",
      "crew_kickoff_failed:Tool 'needs_query' missing required argument 'query'.",
    ]);
  });
});

describe("memory", () => {
  it.each([
    ["QdrantEdgeStorage", () => new QdrantEdgeStorage({ vectorDim: 3 })],
    ["LanceDBStorage", () => new LanceDBStorage({ vectorDim: 3 })],
  ])("%s implements storage lifecycle, filters, scope helpers, and async aliases", async (_name, createStorage) => {
    const storage = createStorage();
    const oldRecord = new MemoryRecord({
      id: "old",
      content: "Old storage note",
      scope: "/crew/research",
      categories: ["storage"],
      metadata: { source: "docs", status: "old" },
      createdAt: "2026-05-01T00:00:00.000Z",
      embedding: [1, 0, 0],
    });
    const currentRecord = new MemoryRecord({
      id: "current",
      content: "Current storage note",
      scope: "/crew/research/agent",
      categories: ["storage", "rag"],
      metadata: { source: "docs", status: "current" },
      createdAt: "2026-05-02T00:00:00.000Z",
      embedding: [0.9, 0.1, 0],
    });
    const otherRecord = new MemoryRecord({
      id: "other",
      content: "Other provider note",
      scope: "/crew/provider",
      categories: ["provider"],
      metadata: { source: "api", status: "current" },
      createdAt: "2026-05-03T00:00:00.000Z",
      embedding: [0, 1, 0],
    });

    storage.save([oldRecord, currentRecord, otherRecord]);

    expect(storage.search([1, 0, 0], "/crew/research", ["rag"], { status: "current" }, 5, 0)[0]?.[0].id)
      .toBe("current");
    expect(storage.get_record("current")?.content).toBe("Current storage note");
    expect(storage.list_records("/crew", 2, 0).map((record) => record.id)).toEqual(["other", "current"]);
    expect(storage.list_scopes("/crew")).toEqual(["/crew/provider", "/crew/research"]);
    expect(storage.list_categories("/crew/research")).toEqual({ rag: 1, storage: 2 });
    expect(storage.count("/crew/research")).toBe(2);
    expect(storage.get_scope_info("/crew/research")).toMatchObject({
      path: "/crew/research",
      recordCount: 2,
      categories: ["rag", "storage"],
      childScopes: ["/crew/research/agent"],
    });

    storage.update(new MemoryRecord({
      id: "current",
      content: "Updated current storage note",
      scope: "/crew/research/agent",
      categories: ["storage"],
      metadata: { source: "docs", status: "updated" },
      createdAt: "2026-05-04T00:00:00.000Z",
      embedding: [1, 0, 0],
    }));

    expect(storage.get_record("current")?.metadata).toEqual({ source: "docs", status: "updated" });
    expect(storage.delete(undefined, undefined, undefined, new Date("2026-05-02T00:00:00.000Z"))).toBe(1);
    expect(await storage.asearch([1, 0, 0], "/crew/research", ["storage"], { status: "updated" }, 5, 0))
      .toHaveLength(1);
    await storage.adelete("/crew/research", ["storage"], ["current"]);
    expect(storage.count()).toBe(1);
    await storage.asave([currentRecord]);
    expect(storage.count()).toBe(2);
    storage.reset("/crew/research");
    expect(storage.count()).toBe(1);
    storage.reset();
    expect(storage.count()).toBe(0);
  });

  it("analyzes memory content, recall queries, saves, and consolidation with safe fallbacks", async () => {
    const llm = (messages: readonly LLMMessage[], options?: LLMCallOptions) => {
      if (options?.responseModel === QueryAnalysis) {
        return JSON.stringify({
          keywords: ["decorators"],
          suggested_scopes: ["/project"],
          complexity: "simple",
          recall_queries: ["standard decorators"],
          time_filter: null,
        });
      }
      if (options?.responseModel === MemoryAnalysis) {
        return JSON.stringify({
          suggested_scope: "/project",
          categories: ["architecture"],
          importance: 0.8,
          extracted_metadata: { entities: ["Nest"], dates: [], topics: ["decorators"] },
        });
      }
      if (options?.responseModel === ConsolidationPlan) {
        return JSON.stringify({
          actions: [{ action: "update", record_id: "r1", new_content: "updated", reason: "newer" }],
          insert_new: false,
          insert_reason: "merged",
        });
      }
      expect(messages.at(-1)?.content).toContain("Extract memory statements");
      return JSON.stringify({ memories: ["CrewAI TS uses standard decorators"] });
    };

    await expect(extractMemoriesFromContent("CrewAI TS uses standard decorators", llm))
      .resolves.toEqual(["CrewAI TS uses standard decorators"]);
    await expect(analyzeQuery("How do decorators work?", ["/project"], null, llm))
      .resolves.toMatchObject({ recallQueries: ["standard decorators"], suggestedScopes: ["/project"] });
    await expect(analyzeForSave("Nest decorator decision", ["/project"], ["architecture"], llm))
      .resolves.toMatchObject({ suggestedScope: "/project", importance: 0.8 });
    await expect(analyzeForConsolidation("new", [{
      id: "r1",
      content: "old",
      scope: "/project",
      categories: [],
      metadata: {},
      importance: 0.5,
      source: null,
      private: false,
      createdAt: new Date("2026-05-28T00:00:00.000Z"),
    }], llm)).resolves.toMatchObject({ insertNew: false });

    await expect(extractMemoriesFromContent("fallback content", () => {
      throw new Error("llm unavailable");
    })).resolves.toEqual(["fallback content"]);
  });

  it("automatically appends relevant crew memories to task prompts", async () => {
    const memory = new Memory();
    memory.remember("Nest should consume crewai-ts as a normal TypeScript library", {
      categories: ["nest"],
      importance: 0.9,
    });
    const prompts: string[] = [];
    const agent = new Agent({
      role: "Researcher",
      goal: "Use memory",
      backstory: "Careful analyst",
      llm: (messages) => {
        prompts.push(messages.at(-1)?.content ?? "");
        return messages.at(-1)?.content ?? "";
      },
    });

    const output = await new Crew({
      agents: [agent],
      tasks: [
        new Task({
          description: "Explain Nest library integration",
          expectedOutput: "Relevant guidance",
          agent,
        }),
      ],
      memory,
    }).kickoff();

    expect(output.raw).toContain("# Memories from past conversations:");
    expect(output.raw).toContain("Nest should consume crewai-ts as a normal TypeScript library");
    expect(prompts[0]).toContain("Relevant memories:");
  });

  it("saves completed agent results to agent memory", async () => {
    const memory = new Memory();
    const agent = new Agent({
      role: "Researcher",
      goal: "Remember outputs",
      backstory: "Careful analyst",
      memory,
      llm: () => "Use standard decorators without reflect metadata.",
    });

    await agent.executeTask("Summarize the decorator decision");

    const match = memory.recall("reflect metadata standard decorators")[0];
    expect(match?.record.content).toContain("Input: Summarize the decorator decision");
    expect(match?.record.content).toContain("Agent: Researcher");
    expect(match?.record.content).toContain("Use standard decorators without reflect metadata.");
  });

  it("injects memory tools into crew tasks and recalls saved records", async () => {
    const memory = new Memory();
    memory.remember("CrewAI supports sequential crews", {
      categories: ["crewai"],
      importance: 0.9,
    });
    const agent = new Agent({
      role: "Researcher",
      goal: "Use memory",
      backstory: "Careful analyst",
      llm: (messages) => messages.some((message) => message.role === "tool")
        ? `final answer:\n${messages.at(-1)?.content ?? ""}`
        : { toolName: "Search_memory", arguments: { queries: ["sequential crews"] } },
    });
    const taskInstance = new Task({
      description: "Recall CrewAI facts",
      expectedOutput: "Relevant memories",
      agent,
    });

    const output = await new Crew({
      agents: [agent],
      tasks: [taskInstance],
      memory,
    }).kickoff();

    expect(output.raw).toContain("CrewAI supports sequential crews");
  });

  it("lets agents save to crew memory and emits memory events", async () => {
    const memory = new Memory();
    const seen: string[] = [];
    crewaiEventBus.on("memory_save_started", (_source, event) => {
      seen.push(`${event.type}:${event.value ?? ""}`);
    });
    crewaiEventBus.on("memory_save_completed", (_source, event) => {
      seen.push(`${event.type}:${event.value}`);
    });
    const agent = new Agent({
      role: "Researcher",
      goal: "Use memory",
      backstory: "Careful analyst",
      llm: (messages) => messages.some((message) => message.role === "tool")
        ? (messages.at(-1)?.content ?? "").replace(/^save_to_memory result:\n/, "")
        : { toolName: "Save_to_memory", arguments: { contents: ["Prefer standard decorators"] } },
    });
    const taskInstance = new Task({
      description: "Remember decorator decision",
      expectedOutput: "Saved",
      agent,
    });

    const output = await new Crew({
      agents: [agent],
      tasks: [taskInstance],
      memory,
    }).kickoff();

    expect(output.raw).toBe("Saved to memory (scope=/, importance=0.5).");
    expect(memory.recall("decorators")[0]?.record.content).toBe("Prefer standard decorators");
    expect(seen).toEqual([
      "memory_save_started:Prefer standard decorators",
      "memory_save_completed:Prefer standard decorators",
    ]);
  });

  it("supports upstream-style memory scopes, slices, info, categories, and trees", () => {
    const memory = new Memory();
    memory.remember("Alpha project uses standard decorators", {
      scope: "/projects/alpha",
      categories: ["decorators", "nest"],
    });
    memory.remember("Beta project uses MCP tools", {
      scope: "/projects/beta",
      categories: ["mcp"],
    });
    memory.scope("/projects/alpha").remember("Alpha avoids reflect metadata", {
      categories: ["decorators"],
    });

    const alpha = memory.scope("/projects/alpha");
    expect(alpha.recall("reflect metadata", { scoreThreshold: null })).toHaveLength(2);
    expect(alpha.info()).toMatchObject({
      totalRecords: 2,
      total_records: 2,
      readOnly: false,
    });
    expect(alpha.list_scopes()).toEqual(["/projects/alpha"]);

    const slice = memory.slice(["/projects/alpha", "/projects/beta"]);
    expect(slice).toBeInstanceOf(MemorySlice);
    expect(slice.recall("tools decorators", { scoreThreshold: null })).toHaveLength(3);
    expect(slice.info(true).categories).toMatchObject({
      decorators: { count: 2, scopes: ["/projects/alpha"] },
      mcp: { count: 1, scopes: ["/projects/beta"] },
    });

    expect(memory.listCategories()).toEqual({ decorators: 2, mcp: 1, nest: 1 });
    expect(memory.list_scopes()).toEqual(["/projects/alpha", "/projects/beta"]);
    expect(memory.tree(true).children.projects?.children.alpha?.count).toBe(2);
  });

  it("mirrors upstream scoped memory subpaths, categories, trees, and read-only slices", () => {
    const memory = new Memory();
    const alpha = memory.scope("/projects/alpha");
    alpha.remember("Alpha parent memory", { categories: ["planning"] });
    alpha.remember("Alpha child memory", {
      scope: "notes",
      categories: ["notes"],
    });
    memory.scope("/projects/beta").remember("Beta memory", { categories: ["planning"] });

    expect(alpha.recall("child", { scope: "notes", scoreThreshold: null })[0]?.record.scope)
      .toBe("/projects/alpha/notes");
    expect(alpha.list_categories()).toEqual({ notes: 1, planning: 1 });
    expect(alpha.tree(true).children.projects?.children.alpha?.children.notes?.count).toBe(1);
    expect(alpha.tree("notes", 0)).toBe("/projects/alpha/notes (1 records)");

    const readOnlySlice = memory.slice(["/projects/alpha"]);
    expect(readOnlySlice.readOnly).toBe(true);
    expect(readOnlySlice.remember("No-op slice write")).toBeNull();
    expect(memory.allRecords().some((record) => record.content === "No-op slice write")).toBe(false);

    const writableSlice = memory.slice(["/projects/alpha"], { readOnly: false });
    expect(writableSlice.remember("Writable slice memory", { categories: ["slice"] })?.scope)
      .toBe("/projects/alpha");
    expect(writableSlice.list_categories()).toEqual({ notes: 1, planning: 1, slice: 1 });
  });

  it("queues remember_many writes until recall or drain_writes applies the read barrier", () => {
    const memory = new Memory();
    const seen: string[] = [];
    crewaiEventBus.on("memory_save_started", (_source, event) => {
      seen.push(`${event.type}:${event.value ?? ""}`);
    });
    crewaiEventBus.on("memory_save_completed", (_source, event) => {
      seen.push(`${event.type}:${event.value}`);
    });

    expect(memory.remember_many(["Queued alpha memory", "Queued beta memory"], {
      categories: ["batch"],
    })).toEqual([]);
    expect(memory.allRecords()).toHaveLength(0);

    expect(memory.recall("alpha", { scoreThreshold: null })[0]?.record.content).toBe("Queued alpha memory");
    expect(memory.allRecords()).toHaveLength(2);
    expect(seen).toEqual([
      "memory_save_started:2 memories (background)",
      "memory_save_completed:2 memories saved",
    ]);

    expect(memory.rememberMany(["Queued gamma memory"], { categories: ["batch"] })).toEqual([]);
    expect(memory.allRecords()).toHaveLength(2);
    memory.drain_writes();
    expect(memory.allRecords().map((record) => record.content)).toContain("Queued gamma memory");
  });

  it("deduplicates duplicate items inside a background memory batch", () => {
    const memory = new Memory();
    const seen: string[] = [];
    crewaiEventBus.on("memory_save_completed", (_source, event) => {
      seen.push(event.value);
    });

    expect(memory.remember_many([
      "CrewAI batch dedup memory",
      "CrewAI batch dedup memory",
      "CrewAI distinct batch memory",
    ], { categories: ["batch"] })).toEqual([]);
    memory.drain_writes();

    expect(memory.allRecords().map((record) => record.content)).toEqual([
      "CrewAI batch dedup memory",
      "CrewAI distinct batch memory",
    ]);
    expect(seen).toEqual(["2 memories saved"]);
  });

  it("uses upstream remember tool responses for single and background batch saves", () => {
    const memory = new Memory();
    const toolInstance = new RememberTool({ memory });

    expect(toolInstance.run({ contents: ["Single memory"] })).toMatch(/^Saved to memory \(scope=\/, importance=0\.5\)\.$/);
    expect(memory.allRecords()).toHaveLength(1);

    expect(toolInstance.run({ contents: ["Batch memory A", "Batch memory B"] }))
      .toBe("Saving 2 items to memory in background.");
    expect(memory.allRecords()).toHaveLength(1);
    memory.drain_writes();
    expect(memory.allRecords().map((record) => record.content)).toEqual([
      "Single memory",
      "Batch memory A",
      "Batch memory B",
    ]);
  });

  it("exposes upstream async memory aliases and paginated record listing", async () => {
    const memory = new Memory({ rootScope: "/root" });
    const first = await memory.aremember("Async first memory", {
      scope: "/alpha",
      categories: ["async"],
      metadata: { order: 1 },
    });
    expect(first?.scope).toBe("/root/alpha");

    await expect(memory.aremember_many([
      "Async second memory",
      "Async third memory",
    ], { scope: "/alpha", categories: ["async"] })).resolves.toEqual([]);
    expect(memory.list_records("/alpha")).toHaveLength(1);

    const recalled = await memory.arecall("third", { scope: "/alpha", categories: ["async"], scoreThreshold: null });
    expect(recalled[0]?.record.content).toBe("Async third memory");

    expect(memory.list_records("/alpha").map((record) => record.content)).toEqual([
      "Async third memory",
      "Async second memory",
      "Async first memory",
    ]);
    expect(memory.listRecords("/alpha", 1, 1)[0]?.content).toBe("Async second memory");
    await expect(memory.aextract_memories("  Async extracted memory  ")).resolves.toEqual(["Async extracted memory"]);
  });

  it("updates memory records by id with upstream partial fields", () => {
    const memory = new Memory({ rootScope: "/root" });
    const record = memory.remember("Original memory", {
      scope: "/alpha",
      categories: ["old"],
      metadata: { source: "draft" },
      importance: 0.3,
    });

    const updated = memory.update(record?.id ?? "", {
      content: "Updated memory",
      scope: "/beta",
      categories: ["new"],
      metadata: { source: "final" },
      importance: 0.9,
    });

    expect(updated).toMatchObject({
      id: record?.id,
      content: "Updated memory",
      scope: "/root/beta",
      categories: ["new"],
      metadata: { source: "final" },
      importance: 0.9,
    });
    expect(updated?.createdAt).toEqual(record?.createdAt);
    expect(updated?.lastAccessed?.getTime()).toBeGreaterThanOrEqual(record?.lastAccessed?.getTime() ?? 0);
    expect(memory.get_record(record?.id ?? "")?.content).toBe("Updated memory");
    expect(() => memory.update("missing-record", { content: "Nope" })).toThrow("Record not found: missing-record");
  });

  it("resets only the root scope when memory has an upstream root_scope", () => {
    const memory = new Memory({ rootScope: "/root" });
    memory.remember("Root memory", { scope: "/alpha" });
    memory.update(new MemoryRecord({
      id: "external",
      content: "External memory",
      scope: "/external",
    }));

    memory.reset();

    expect(memory.allRecords().map((record) => record.content)).toEqual(["External memory"]);
    expect(memory.list_records()).toEqual([]);
    expect(memory.list_records("/external")).toEqual([]);
  });

  it("accepts upstream path arguments for root-scoped memory listing helpers", () => {
    const memory = new Memory({ rootScope: "/root" });
    memory.remember("Alpha parent", { scope: "/projects/alpha", categories: ["planning"] });
    memory.remember("Alpha child", { scope: "/projects/alpha/notes", categories: ["notes"] });
    memory.remember("Beta parent", { scope: "/projects/beta", categories: ["planning"] });

    expect(memory.list_scopes("/projects")).toEqual([
      "/root/projects/alpha",
      "/root/projects/beta",
    ]);
    expect(memory.list_categories("/projects/alpha")).toEqual({ notes: 1, planning: 1 });
    expect(memory.info("/projects/alpha")).toMatchObject({
      path: "/root/projects/alpha",
      recordCount: 2,
      categories: ["notes", "planning"],
      childScopes: ["/root/projects/alpha/notes"],
    });
  });

  it("accepts upstream path arguments for memory slices", () => {
    const memory = new Memory();
    memory.remember("Alpha parent", { scope: "/projects/alpha", categories: ["planning"] });
    memory.remember("Alpha note", { scope: "/projects/alpha/notes", categories: ["notes"] });
    memory.remember("Beta parent", { scope: "/projects/beta", categories: ["planning"] });
    memory.remember("Beta note", { scope: "/projects/beta/notes", categories: ["notes"] });

    const slice = memory.slice(["/projects/alpha", "/projects/beta"]);

    expect(slice.list_scopes("/")).toEqual([
      "/projects/alpha/notes",
      "/projects/beta/notes",
    ]);
    expect(slice.list_categories("/notes")).toEqual({ notes: 2 });
    expect(slice.info("/notes")).toMatchObject({
      path: "/notes",
      recordCount: 2,
      categories: ["notes"],
      childScopes: [],
    });
  });

  it("returns upstream formatted memory trees for path arguments", () => {
    const memory = new Memory({ rootScope: "/root" });
    memory.remember("Alpha parent", { scope: "/projects/alpha" });
    memory.remember("Alpha child", { scope: "/projects/alpha/notes" });
    memory.remember("Beta parent", { scope: "/projects/beta" });

    expect(memory.tree("/projects", 1)).toBe([
      "/root/projects (3 records)",
      "  /root/projects/alpha (2 records)",
      "  /root/projects/beta (1 records)",
    ].join("\n"));
    expect(memory.tree(true).children.root?.children.projects?.children.alpha?.count).toBe(2);
  });

  it("uses configured memory LLM for async extraction and falls back safely", async () => {
    const seen: string[] = [];
    const memory = new Memory({
      llm: (messages, options) => {
        seen.push(`${options?.responseModel === ExtractedMemories ? "true" : "false"}:${messages.at(-1)?.content ?? ""}`);
        return JSON.stringify({ memories: ["First durable fact", "Second durable fact"] });
      },
    });

    await expect(memory.aextract_memories("first. second.")).resolves.toEqual([
      "First durable fact",
      "Second durable fact",
    ]);
    expect(seen[0]).toContain("true:Content:\nfirst. second.");

    const fallback = new Memory({
      llm: () => {
        throw new Error("offline");
      },
    });
    await expect(fallback.aextract_memories("  fallback fact  ")).resolves.toEqual(["fallback fact"]);
    expect(fallback.extract_memories("  sync fallback fact  ")).toEqual(["sync fallback fact"]);
  });

  it("uses configured memory LLM to analyze async saves when fields are missing", async () => {
    const seen: string[] = [];
    const memory = new Memory({
      rootScope: "/crew",
      llm: (messages, options) => {
        seen.push(`${options?.responseModel === MemoryAnalysis ? "analysis" : "other"}:${messages.at(-1)?.content ?? ""}`);
        return JSON.stringify({
          suggested_scope: "/research",
          categories: ["architecture", "memory"],
          importance: 0.85,
          extracted_metadata: { entities: ["CrewAI"], dates: ["2026-05-31"], topics: ["save analysis"] },
        });
      },
    });

    const record = await memory.aremember("Infer this memory metadata", {
      metadata: { source: "test" },
    });

    expect(record).toMatchObject({
      content: "Infer this memory metadata",
      scope: "/crew/research",
      categories: ["architecture", "memory"],
      importance: 0.85,
      metadata: {
        source: "test",
        entities: ["CrewAI"],
        dates: ["2026-05-31"],
        topics: ["save analysis"],
      },
    });
    expect(seen[0]).toContain("analysis:Analyze this memory before saving.");

    const explicit = await memory.aremember("Keep explicit fields", {
      scope: "/explicit",
      categories: ["manual"],
      importance: 0.4,
    });
    expect(explicit).toMatchObject({
      scope: "/crew/explicit",
      categories: ["manual"],
      importance: 0.4,
    });
    expect(seen).toHaveLength(1);
  });

  it("honors upstream snake_case memory constructor configuration", async () => {
    const seen: string[] = [];
    const memory = new Memory({
      root_scope: "/crew",
      consolidation_limit: 1,
      llm: (messages, options) => {
        seen.push(options?.responseModel === ConsolidationPlan ? "consolidation" : "analysis");
        expect(messages.at(-1)?.content).toContain("id=existing-memory-a");
        expect(messages.at(-1)?.content).not.toContain("id=existing-memory-b");
        return JSON.stringify({
          actions: [],
          insert_new: true,
        });
      },
    });
    memory.update(new MemoryRecord({
      id: "existing-memory-a",
      content: "CrewAI memory constructor config",
      scope: "/crew/research",
      categories: ["architecture"],
      importance: 0.7,
    }));
    memory.update(new MemoryRecord({
      id: "existing-memory-b",
      content: "CrewAI memory constructor config",
      scope: "/crew/research",
      categories: ["architecture"],
      importance: 0.7,
    }));

    const record = await memory.aremember("CrewAI memory constructor config", {
      scope: "/research",
      categories: ["architecture"],
      importance: 0.8,
    });

    expect(record).toMatchObject({
      content: "CrewAI memory constructor config",
      scope: "/crew/research",
    });
    expect(memory.allRecords()).toHaveLength(3);
    expect(seen).toEqual(["consolidation"]);
  });

  it("uses configured memory LLM consolidation plans to update similar records", async () => {
    const seen: string[] = [];
    const memory = new Memory({
      rootScope: "/crew",
      llm: (messages, options) => {
        seen.push(options?.responseModel === ConsolidationPlan ? "consolidation" : "analysis");
        if (options?.responseModel === ConsolidationPlan) {
          expect(messages.at(-1)?.content).toContain("Existing records:");
          return JSON.stringify({
            actions: [{
              action: "update",
              record_id: "existing-memory",
              new_content: "CrewAI memory keeps standard decorators and avoids reflect metadata",
              reason: "merge newer detail",
            }],
            insert_new: false,
            insert_reason: "merged with existing",
          });
        }
        return JSON.stringify({
          suggested_scope: "/research",
          categories: ["architecture"],
          importance: 0.9,
          extracted_metadata: { entities: [], dates: [], topics: [] },
        });
      },
    });
    memory.update(new MemoryRecord({
      id: "existing-memory",
      content: "CrewAI memory keeps standard decorators",
      scope: "/crew/research",
      categories: ["architecture"],
      importance: 0.7,
      createdAt: "2026-05-30T00:00:00.000Z",
    }));

    const record = await memory.aremember("CrewAI memory keeps standard decorators", {
      scope: "/research",
      categories: ["architecture"],
      importance: 0.8,
    });

    expect(record).toMatchObject({
      id: "existing-memory",
      content: "CrewAI memory keeps standard decorators and avoids reflect metadata",
      scope: "/crew/research",
      categories: ["architecture"],
      importance: 0.7,
    });
    expect(memory.allRecords()).toHaveLength(1);
    expect(memory.get_record("existing-memory")?.content).toBe("CrewAI memory keeps standard decorators and avoids reflect metadata");
    expect(seen).toEqual(["consolidation"]);
  });

  it("deduplicates consolidation actions so the first action for each record wins", async () => {
    const memory = new Memory({
      rootScope: "/crew",
      llm: (_messages, options) => {
        if (options?.responseModel === ConsolidationPlan) {
          return JSON.stringify({
            actions: [
              {
                action: "update",
                record_id: "record-a",
                new_content: "CrewAI memory action A first update",
                reason: "first action should win",
              },
              {
                action: "update",
                record_id: "record-a",
                new_content: "CrewAI memory action A second update",
                reason: "duplicate should be ignored",
              },
              {
                action: "delete",
                record_id: "record-b",
                reason: "first delete should win",
              },
              {
                action: "update",
                record_id: "record-b",
                new_content: "CrewAI memory action B resurrected",
                reason: "duplicate after delete should be ignored",
              },
            ],
            insert_new: false,
          });
        }
        return JSON.stringify({
          suggested_scope: "/research",
          categories: ["architecture"],
          importance: 0.9,
          extracted_metadata: { entities: [], dates: [], topics: [] },
        });
      },
    });
    memory.update(new MemoryRecord({
      id: "record-a",
      content: "CrewAI memory action shared facts",
      scope: "/crew/research",
      categories: ["architecture"],
      importance: 0.7,
    }));
    memory.update(new MemoryRecord({
      id: "record-b",
      content: "CrewAI memory action shared facts",
      scope: "/crew/research",
      categories: ["architecture"],
      importance: 0.7,
    }));

    const record = await memory.aremember("CrewAI memory action shared facts", {
      scope: "/research",
      categories: ["architecture"],
      importance: 0.8,
    });

    expect(record).toMatchObject({
      id: "record-a",
      content: "CrewAI memory action A first update",
    });
    expect(memory.get_record("record-a")?.content).toBe("CrewAI memory action A first update");
    expect(memory.get_record("record-b")).toBeNull();
    expect(memory.allRecords()).toHaveLength(1);
  });

  it("uses configured memory LLM save analysis for async batch saves", async () => {
    const seen: string[] = [];
    const memory = new Memory({
      rootScope: "/crew",
      llm: (_messages, options) => {
        seen.push(options?.responseModel === MemoryAnalysis ? "analysis" : "other");
        return JSON.stringify({
          suggested_scope: "/batch",
          categories: ["batch-analysis"],
          importance: 0.75,
          extracted_metadata: { entities: ["Batch"], dates: [], topics: ["memory"] },
        });
      },
    });

    await expect(memory.aremember_many([
      "Batch analyzed memory one",
      "Batch analyzed memory two",
    ], { metadata: { source: "test" } })).resolves.toEqual([]);
    expect(memory.allRecords()).toHaveLength(0);

    expect(memory.recall("Batch analyzed", { scope: "/batch", categories: ["batch-analysis"], scoreThreshold: null }))
      .toHaveLength(2);
    expect(memory.list_records("/batch").map((record) => ({
      scope: record.scope,
      categories: record.categories,
      importance: record.importance,
      metadata: record.metadata,
    }))).toEqual([
      {
        scope: "/crew/batch",
        categories: ["batch-analysis"],
        importance: 0.75,
        metadata: { source: "test", entities: ["Batch"], dates: [], topics: ["memory"] },
      },
      {
        scope: "/crew/batch",
        categories: ["batch-analysis"],
        importance: 0.75,
        metadata: { source: "test", entities: ["Batch"], dates: [], topics: ["memory"] },
      },
    ]);
    expect(seen).toEqual(["analysis", "analysis"]);
  });
});

describe("knowledge", () => {
  it("appends relevant crew knowledge source content to task prompts", async () => {
    const prompts: string[] = [];
    const events: CrewAIEvent[] = [];
    crewaiEventBus.on("knowledge_search_query_started", (_source, event) => {
      events.push(event);
    });
    crewaiEventBus.on("knowledge_query_started", (_source, event) => {
      events.push(event);
    });
    crewaiEventBus.on("knowledge_query_completed", (_source, event) => {
      events.push(event);
    });
    crewaiEventBus.on("knowledge_search_query_completed", (_source, event) => {
      events.push(event);
    });
    const agent = new Agent({
      role: "Researcher",
      goal: "Use knowledge",
      backstory: "Careful analyst",
      llm: (messages) => {
        prompts.push(messages.at(-1)?.content ?? "");
        return messages.at(-1)?.content ?? "";
      },
    });

    const output = await new Crew({
      agents: [agent],
      tasks: [
        new Task({
          description: "Explain Nest integration",
          expectedOutput: "Integration guidance",
          agent,
        }),
      ],
      knowledgeSources: [
        new StringKnowledgeSource("Nest should instantiate ResearchCrew inside a service or provider factory."),
      ],
    }).kickoff();

    expect(output.raw).toContain("Additional Information:");
    expect(output.raw).toContain("Nest should instantiate ResearchCrew inside a service or provider factory.");
    expect(prompts[0]).toContain("Additional Information:");
    expect(events.map((event) => event.type)).toEqual([
      "knowledge_search_query_started",
      "knowledge_query_started",
      "knowledge_query_completed",
      "knowledge_search_query_completed",
    ]);
    expect(events[0]).toBeInstanceOf(KnowledgeRetrievalStartedEvent);
    expect(events[1]).toBeInstanceOf(KnowledgeQueryStartedEvent);
    expect((events[1] as KnowledgeQueryStartedEvent).from_agent).toBe(agent);
    expect(events[2]).toBeInstanceOf(KnowledgeQueryCompletedEvent);
    expect(events[3]).toBeInstanceOf(KnowledgeRetrievalCompletedEvent);
    expect((events[3] as KnowledgeRetrievalCompletedEvent).retrieved_knowledge).toContain(
      "Nest should instantiate ResearchCrew inside a service or provider factory.",
    );
  });

  it("combines agent knowledge and crew knowledge during task execution", async () => {
    const agentKnowledge = new Knowledge({
      sources: [new StringKnowledgeSource("Agent knowledge prefers standard decorators.")],
    });
    const seenPrompts: string[] = [];
    const agent = new Agent({
      role: "Researcher",
      goal: "Use knowledge",
      backstory: "Careful analyst",
      knowledge: agentKnowledge,
      llm: (messages) => {
        seenPrompts.push(messages.at(-1)?.content ?? "");
        return "done";
      },
    });

    await new Crew({
      agents: [agent],
      tasks: [
        new Task({
          description: "Summarize decorator knowledge",
          expectedOutput: "Summary",
          agent,
        }),
      ],
      knowledge: new Knowledge({
        sources: [new StringKnowledgeSource("Crew knowledge keeps Nest DI separate.")],
      }),
    }).kickoff();

    expect(seenPrompts[0]).toContain("Agent knowledge prefers standard decorators.");
    expect(seenPrompts[0]).toContain("Crew knowledge keeps Nest DI separate.");
  });

  it("loads text, JSON, and CSV files as knowledge sources", async () => {
    const baseDirectory = mkdtempSync(join(tmpdir(), "crewai-ts-knowledge-"));
    const textPath = join(baseDirectory, "notes.txt");
    const jsonPath = join(baseDirectory, "facts.json");
    const csvPath = join(baseDirectory, "table.csv");
    writeFileSync(textPath, "Text source says CrewAI supports crews.", "utf8");
    writeFileSync(jsonPath, JSON.stringify({ nest: { mode: "library consumption" } }), "utf8");
    writeFileSync(csvPath, "topic,detail\nDecorators,\"standard, no reflect metadata\"\n", "utf8");

    const prompts: string[] = [];
    const agent = new Agent({
      role: "Researcher",
      goal: "Use file knowledge",
      backstory: "Careful analyst",
      llm: (messages) => {
        prompts.push(messages.at(-1)?.content ?? "");
        return messages.at(-1)?.content ?? "";
      },
    });

    const output = await new Crew({
      agents: [agent],
      tasks: [
        new Task({
          description: "Summarize CrewAI Nest Decorators knowledge",
          expectedOutput: "Summary",
          agent,
        }),
      ],
      knowledgeSources: [
        new TextFileKnowledgeSource(textPath),
        new JSONKnowledgeSource(jsonPath),
        new CSVKnowledgeSource(csvPath),
      ],
    }).kickoff();

    expect(output.raw).toContain("Text source says CrewAI supports crews.");
    expect(output.raw).toContain("library consumption");
    expect(output.raw).toContain("standard, no reflect metadata");
    expect(prompts[0]).toContain("Additional Information:");
  });

  it("selects PDF and Excel knowledge sources with optional host extractors", () => {
    const baseDirectory = mkdtempSync(join(tmpdir(), "crewai-ts-knowledge-sources-"));
    const pdfPath = join(baseDirectory, "notes.pdf");
    const xlsxPath = join(baseDirectory, "facts.xlsx");
    writeFileSync(pdfPath, "fake pdf bytes", "utf8");
    writeFileSync(xlsxPath, "fake excel bytes", "utf8");

    const pdfSource = new PDFKnowledgeSource({
      file_path: pdfPath,
      extractor: (filePath, bytes) => `PDF ${filePath} ${bytes.toString("utf8")}`,
    });
    const excelSource = new ExcelKnowledgeSource({
      file_paths: [xlsxPath],
      extractor: () => ({
        Sheet1: [
          ["topic", "detail"],
          ["Decorators", "standard"],
        ],
      }),
    });

    expect(SourceHelper.is_supported_file(pdfPath)).toBe(true);
    expect(SourceHelper.get_source(pdfPath)).toBeInstanceOf(PDFKnowledgeSource);
    expect(pdfSource.chunks()[0]).toContain("fake pdf bytes");
    expect(excelSource.chunks()[0]).toContain("Sheet: Sheet1");
    expect(excelSource.chunks()[0]).toContain("Decorators standard");
    expect(() => new CrewDoclingSource(pdfPath)).toThrow("CrewDoclingSource requires");
    expect(() => SourceHelper.getSource("notes.md")).toThrow("Unsupported file type");
  });

  it("resets crew and agent knowledge through resetMemories", () => {
    const agentKnowledge = new Knowledge({
      sources: [new StringKnowledgeSource("Agent knowledge prefers standard decorators.")],
    });
    const crewKnowledge = new Knowledge({
      sources: [new StringKnowledgeSource("Crew knowledge keeps Nest DI separate.")],
    });
    const agent = new Agent({
      role: "Researcher",
      goal: "Use knowledge",
      backstory: "Careful analyst",
      knowledge: agentKnowledge,
    });
    const crewInstance = new Crew({
      agents: [agent],
      knowledge: crewKnowledge,
    });

    crewInstance.resetMemories("knowledge");

    expect(agentKnowledge.query("decorators", { scoreThreshold: null })).toEqual([]);
    expect(crewKnowledge.query("Nest", { scoreThreshold: null })).toEqual([]);
  });

  it("resets only agent knowledge with agent_knowledge", () => {
    const agentKnowledge = new Knowledge({
      sources: [new StringKnowledgeSource("Agent knowledge prefers standard decorators.")],
    });
    const crewKnowledge = new Knowledge({
      sources: [new StringKnowledgeSource("Crew knowledge keeps Nest DI separate.")],
    });
    const agent = new Agent({
      role: "Researcher",
      goal: "Use knowledge",
      backstory: "Careful analyst",
      knowledge: agentKnowledge,
    });

    new Crew({
      agents: [agent],
      knowledge: crewKnowledge,
    }).reset_memories("agent_knowledge");

    expect(agentKnowledge.query("decorators", { scoreThreshold: null })).toEqual([]);
    expect(crewKnowledge.query("Nest", { scoreThreshold: null })).toHaveLength(1);
  });

  it("throws when resetting knowledge systems that are not initialized", () => {
    const crewInstance = new Crew();

    expect(() => {
      crewInstance.resetMemories("knowledge");
    }).toThrow("Crew Knowledge and Agent Knowledge memory system is not initialized");
    expect(() => {
      crewInstance.resetMemories("agent_knowledge");
    }).toThrow("Agent Knowledge memory system is not initialized");
  });
});

describe("crew memory reset", () => {
  it("resets crew memory and supports legacy memory command names", () => {
    const memory = new Memory();
    memory.remember("CrewAI supports reset.");
    const crewInstance = new Crew({ memory });

    crewInstance.resetMemories("long");

    expect(memory.recall("reset", { scoreThreshold: null })).toEqual([]);
  });

  it("resets kickoff outputs separately", async () => {
    const agent = new Agent({
      role: "Researcher",
      goal: "Write",
      backstory: "Careful analyst",
      llm: () => "done",
    });
    const taskInstance = new Task({
      description: "Write",
      expectedOutput: "Done",
      agent,
    });
    const crewInstance = new Crew({
      agents: [agent],
      tasks: [taskInstance],
    });

    await crewInstance.kickoff();
    expect(crewInstance.executionLogs).toHaveLength(1);
    expect(taskInstance.output?.raw).toBe("done");

    crewInstance.resetMemories("kickoff_outputs");

    expect(crewInstance.executionLogs).toEqual([]);
    expect(taskInstance.output).toBeNull();
  });
});

describe("crew replay", () => {
  it("persists kickoff task outputs through the storage handler and updates replayed rows", async () => {
    const dir = mkdtempSync(join(tmpdir(), "crewai-ts-task-output-storage-"));
    const storagePath = join(dir, "outputs.db");
    try {
      const handler = new TaskOutputStorageHandler(new KickoffTaskOutputsSQLiteStorage(storagePath));
      let calls = 0;
      const agent = new Agent({
        role: "Researcher",
        goal: "Write",
        backstory: "Careful analyst",
        llm: () => {
          calls += 1;
          return `output ${String(calls)}`;
        },
      });
      const first = new Task({ name: "first", description: "First", expectedOutput: "First", agent });
      const second = new Task({ name: "second", description: "Second", expectedOutput: "Second", agent });
      const crewInstance = new Crew({
        agents: [agent],
        tasks: [first, second],
        taskOutputStorageHandler: handler,
      });

      await crewInstance.kickoff({ inputs: { topic: "original" } });
      expect(handler.load()?.map((record) => record.output.raw)).toEqual(["output 1", "output 2"]);

      await crewInstance.replay("second", { topic: "replayed" });
      const records = handler.load();
      expect(records?.[0]).toMatchObject({
        task_id: first.id,
        task_index: 0,
        inputs: { topic: "original" },
        was_replayed: false,
      });
      expect(records?.[1]).toMatchObject({
        task_id: second.id,
        task_index: 1,
        inputs: { topic: "replayed" },
        was_replayed: true,
      });
      expect(records?.[1]?.output.raw).toBe("output 3");

      crewInstance.resetMemories("kickoff_outputs");
      expect(handler.load()).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("replays from a task id using previous task outputs as context", async () => {
    let firstCalls = 0;
    let secondCalls = 0;
    const agent = new Agent({
      role: "Researcher",
      goal: "Write",
      backstory: "Careful analyst",
      llm: (messages) => {
        const prompt = messages.at(-1)?.content ?? "";
        if (prompt.includes("Task: First")) {
          firstCalls += 1;
          return "first output";
        }
        secondCalls += 1;
        return `second sees ${prompt}`;
      },
    });
    const first = new Task({
      name: "first-task",
      description: "First",
      expectedOutput: "First output",
      agent,
    });
    const second = new Task({
      name: "second-task",
      description: "Second",
      expectedOutput: "Second output",
      agent,
    });
    const crewInstance = new Crew({
      agents: [agent],
      tasks: [first, second],
    });

    await crewInstance.kickoff({ inputs: { topic: "original" } });
    const replayed = await crewInstance.replay(second.id, { topic: "replayed" });

    expect(firstCalls).toBe(1);
    expect(secondCalls).toBe(2);
    expect(replayed.raw).toContain("Context:\nfirst output");
    expect(replayed.raw).toContain("topic: replayed");
    expect(crewInstance.executionLogs[1]?.inputs).toEqual({ topic: "replayed" });
  });

  it("supports replay by task name and index", async () => {
    let calls = 0;
    const agent = new Agent({
      role: "Researcher",
      goal: "Write",
      backstory: "Careful analyst",
      llm: () => {
        calls += 1;
        return `call ${String(calls)}`;
      },
    });
    const first = new Task({ name: "first", description: "First", expectedOutput: "First", agent });
    const second = new Task({ name: "second", description: "Second", expectedOutput: "Second", agent });
    const crewInstance = new Crew({ agents: [agent], tasks: [first, second] });

    await crewInstance.kickoff();
    await crewInstance.replay("second");
    const output = await crewInstance.replay(1);

    expect(output.raw).toBe("call 4");
    expect(first.output?.raw).toBe("call 1");
    expect(second.output?.raw).toBe("call 4");
  });

  it("throws when replay task reference is not part of the crew", async () => {
    const crewInstance = new Crew({
      tasks: [
        new Task({
          description: "Task",
          expectedOutput: "Output",
          agent: new Agent({ role: "A", goal: "G", backstory: "B" }),
        }),
      ],
    });

    await expect(crewInstance.replay("missing")).rejects.toThrow("not found");
  });
});

describe("hierarchical process", () => {
  it("requires a manager agent or manager LLM", async () => {
    const researcher = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
    });
    const taskInstance = new Task({
      description: "Research CrewAI",
      expectedOutput: "A concise brief",
      agent: researcher,
    });

    await expect(new Crew({
      agents: [researcher],
      tasks: [taskInstance],
      process: Process.hierarchical,
    }).kickoff()).rejects.toThrow("managerLlm");
  });

  it("uses a manager LLM and coworker delegation tool to complete tasks", async () => {
    const researcher = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      llm: (messages) => `research result: ${messages.at(-1)?.content ?? ""}`,
    });
    const taskInstance = new Task({
      description: "Research {topic}",
      expectedOutput: "A concise brief",
      agent: researcher,
    });
    const managerCalls: string[] = [];

    const output = await new Crew({
      agents: [researcher],
      tasks: [taskInstance],
      process: Process.hierarchical,
      managerLlm: (messages) => {
        managerCalls.push(messages.at(-1)?.content ?? "");
        if (messages.some((message) => message.role === "tool")) {
          return `manager final: ${messages.at(-1)?.content ?? ""}`;
        }
        return {
          toolName: "Delegate_work_to_coworker",
          arguments: {
            coworker: "Researcher",
            task: "Research CrewAI deeply",
            context: "Need concise facts",
          },
        };
      },
    }).kickoff({ inputs: { topic: "CrewAI" } });

    expect(output.raw).toContain("research result");
    expect(output.raw).toContain("Research CrewAI deeply");
    expect(output.tasksOutput[0]?.agent).toBe("Crew Manager");
    expect(managerCalls[0]).toContain("Research CrewAI");
  });

  it("rejects manager agents that are included in regular agents", async () => {
    const manager = new Agent({
      role: "Manager",
      goal: "Coordinate",
      backstory: "Manager",
    });
    const taskInstance = new Task({
      description: "Research",
      expectedOutput: "A concise brief",
      agent: manager,
    });

    await expect(new Crew({
      agents: [manager],
      tasks: [taskInstance],
      process: Process.hierarchical,
      managerAgent: manager,
    }).kickoff()).rejects.toThrow("Manager agent should not be included");
  });
});

describe("security fingerprints", () => {
  it("creates random and deterministic fingerprints with serializable metadata", () => {
    const random = new Fingerprint({ metadata: { version: "1.0" } });
    const seeded = Fingerprint.generate("test-seed", { version: "1.0" });
    const seededAgain = Fingerprint.generate("test-seed");

    expect(random.uuid_str).toMatch(/^[0-9a-f-]{36}$/);
    expect(random.created_at).toBeInstanceOf(Date);
    expect(seeded.uuid_str).toBe(seededAgain.uuidStr);
    expect(seeded.uuid_str).toBe(Fingerprint._generate_uuid("test-seed"));
    expect(String(seeded)).toBe(seeded.uuid_str);

    const restored = Fingerprint.from_dict(seeded.to_dict());
    expect(restored.uuid_str).toBe(seeded.uuid_str);
    expect(restored.metadata).toEqual({ version: "1.0" });
  });

  it("validates fingerprint metadata and security config coercion", () => {
    expect(() => new Fingerprint({ metadata: { nested: { too: { deep: true } } } }))
      .toThrow("Metadata can only be nested one level deep");
    expect(() => Fingerprint.generate("   ")).toThrow("Seed cannot be empty");

    const fromSeed = new SecurityConfig({ fingerprint: "agent-seed" });
    const fromDict = SecurityConfig.from_dict(fromSeed.to_dict());

    expect(fromDict.fingerprint.uuid_str).toBe(fromSeed.fingerprint.uuid_str);
    expect(new SecurityConfig({ fingerprint: null }).fingerprint).toBeInstanceOf(Fingerprint);
  });

  it("adds security config and fingerprints to agents, crews, and tasks", () => {
    const securityConfig = new SecurityConfig();
    securityConfig.fingerprint.metadata = { version: "1.0", environment: "test" };
    const agentInstance = new Agent({
      role: "Secure Agent",
      goal: "Track identity",
      backstory: "Auditable",
      securityConfig,
    });
    const taskInstance = new Task({
      description: "Track task",
      expectedOutput: "Tracked",
      agent: agentInstance,
      security_config: securityConfig,
    });
    const crewInstance = new Crew({
      agents: [agentInstance],
      tasks: [taskInstance],
      securityConfig,
    });

    expect(agentInstance.security_config).toBe(securityConfig);
    expect(agentInstance.fingerprint.metadata).toEqual({ version: "1.0", environment: "test" });
    expect(taskInstance.securityConfig).toBe(securityConfig);
    expect(crewInstance.fingerprint).toBe(securityConfig.fingerprint);
  });

  it("preserves security metadata but regenerates fingerprints when copying", () => {
    const securityConfig = new SecurityConfig();
    securityConfig.fingerprint.metadata = { version: "1.0", environment: "copy" };
    const agentInstance = new Agent({
      role: "Secure Agent",
      goal: "Track identity",
      backstory: "Auditable",
      securityConfig,
    });
    const taskInstance = new Task({
      description: "Track task",
      expectedOutput: "Tracked",
      agent: agentInstance,
    });
    const crewInstance = new Crew({
      agents: [agentInstance],
      tasks: [taskInstance],
      securityConfig,
    });

    const copiedAgent = agentInstance.copy();
    const copiedCrew = crewInstance.copy();

    expect(copiedAgent.fingerprint.metadata).toEqual({ version: "1.0", environment: "copy" });
    expect(copiedCrew.fingerprint.metadata).toEqual({ version: "1.0", environment: "copy" });
    expect(copiedAgent.fingerprint.uuid_str).not.toBe(agentInstance.fingerprint.uuid_str);
    expect(copiedCrew.fingerprint.uuid_str).not.toBe(crewInstance.fingerprint.uuid_str);
  });
});

describe("checkpoint state providers", () => {
  it("uses CrewAI-compatible checkpoint config defaults and aliases", () => {
    const defaults = new CheckpointConfig();
    const all = new CheckpointConfig({ on_events: ["*"], max_checkpoints: 3, restore_from: "/tmp/cp.json" });

    expect(defaults.location).toBe("./.checkpoints");
    expect(defaults.on_events).toEqual(["task_completed"]);
    expect(defaults.trigger_all).toBe(false);
    expect(defaults.trigger_events.has("task_completed")).toBe(true);
    expect(all.triggerAll).toBe(true);
    expect(all.maxCheckpoints).toBe(3);
    expect(all.restoreFrom).toBe("/tmp/cp.json");
    expect(detectProvider("/tmp/checkpoint.json")).toBeInstanceOf(JsonProvider);
  });

  it("writes JSON checkpoints under branch directories and encodes parent ids", async () => {
    const directory = mkdtempSync(join(tmpdir(), "crewai-ts-checkpoint-"));
    const provider = new JsonProvider();

    const first = provider.checkpoint("{\"step\":1}", directory, { branch: "main" });
    const firstId = provider.extract_id(first);
    const second = provider.checkpoint("{\"step\":2}", directory, {
      branch: "main",
      parent_id: firstId,
    });
    const fork = await provider.acheckpoint("{\"fork\":true}", directory, { branch: "fork/exp1" });

    expect(first).toContain("/main/");
    expect(first).toContain("_p-none.json");
    expect(second).toContain(`_p-${firstId}.json`);
    expect(fork).toContain("/fork/exp1/");
    expect(await provider.from_checkpoint(first)).toBe("{\"step\":1}");
    expect(await provider.afrom_checkpoint(fork)).toBe("{\"fork\":true}");
  });

  it("prunes JSON checkpoints branch-locally and rejects traversal", async () => {
    const directory = mkdtempSync(join(tmpdir(), "crewai-ts-checkpoint-prune-"));
    const provider = new JsonProvider();

    for (let index = 0; index < 3; index += 1) {
      provider.checkpoint(`{"main":${String(index)}}`, directory, { branch: "main" });
    }
    for (let index = 0; index < 2; index += 1) {
      provider.checkpoint(`{"fork":${String(index)}}`, directory, { branch: "fork/a" });
    }

    await expect(provider.prune(directory, 1, { branch: "main" })).resolves.toBe(2);
    await expect(readdir(join(directory, "main"))).resolves.toHaveLength(1);
    await expect(readdir(join(directory, "fork", "a"))).resolves.toHaveLength(2);
    expect(() => provider.checkpoint("{}", directory, { branch: "../../etc" })).toThrow("escapes checkpoint directory");
    await expect(provider.prune(directory, 1, { branch: "../../etc" })).rejects.toThrow("escapes checkpoint directory");
  });

  it("attaches checkpoint configs to agents, crews, and flows", () => {
    const agent = new Agent({
      role: "Checkpoint Agent",
      goal: "checkpoint",
      backstory: "checkpoint",
      checkpoint: true,
    });
    const crew = new Crew({ agents: [agent], tasks: [], checkpoint: { onEvents: ["crew_kickoff_completed"] } });
    const flow = new Flow({ checkpoint: false });

    expect(agent.checkpoint).toBeInstanceOf(CheckpointConfig);
    expect((crew.checkpoint as CheckpointConfig).trigger_events.has("crew_kickoff_completed")).toBe(true);
    expect(flow.checkpoint).toBe(false);
  });

  it("stores SQLite checkpoints with branch and parent metadata", async () => {
    const directory = mkdtempSync(join(tmpdir(), "crewai-ts-sqlite-checkpoint-"));
    const provider = new SqliteProvider();
    const db = join(directory, "cp.db");

    const first = provider.checkpoint("{\"step\":1}", db, { branch: "exp", parent_id: "parent-1" });
    const firstId = provider.extract_id(first);
    const second = await provider.acheckpoint("{\"step\":2}", db, { branch: "exp", parentId: firstId });

    expect(first).toBe(`${db}#${firstId}`);
    expect(provider.extractId(second)).not.toBe(firstId);
    expect(provider.from_checkpoint(first)).toBe("{\"step\":1}");
    await expect(provider.afrom_checkpoint(second)).resolves.toBe("{\"step\":2}");
    expect(detectProvider(first)).toBeInstanceOf(SqliteProvider);
  });

  it("prunes SQLite checkpoints branch-locally and normalizes config locations", () => {
    const directory = mkdtempSync(join(tmpdir(), "crewai-ts-sqlite-prune-"));
    const provider = new SqliteProvider();
    const db = join(directory, "cp.db");

    for (let index = 0; index < 3; index += 1) {
      provider.checkpoint(`{"main":${String(index)}}`, db, { branch: "main" });
    }
    for (let index = 0; index < 2; index += 1) {
      provider.checkpoint(`{"fork":${String(index)}}`, db, { branch: "fork/a" });
    }

    expect(provider.prune(db, 1, { branch: "main" })).toBe(2);
    expect(provider.prune(db, 10, { branch: "fork/a" })).toBe(0);
    expect(new CheckpointConfig({ location: join(directory, "checkpoints"), provider }).location)
      .toBe(join(directory, "checkpoints.db"));
  });
});

describe("event record", () => {
  it("adds event nodes and wires parent, trigger, sequence, and started edges", () => {
    const record = new EventRecord();
    const root = new BaseEvent({ type: "crew_kickoff_started" });
    const child = new BaseEvent({
      type: "task_started",
      parentEventId: root.eventId,
      previousEventId: root.eventId,
    });
    const triggered = new BaseEvent({
      type: "tool_usage_started",
      triggeredByEventId: child.eventId,
      previousEventId: child.eventId,
      startedEventId: root.eventId,
    });

    const rootNode = record.add(root);
    const childNode = record.add(child);
    const triggeredNode = record.add(triggered);

    expect(rootNode).toBeInstanceOf(EventNode);
    expect(record.size).toBe(3);
    expect(record.get(root.eventId)).toBe(rootNode);
    expect(childNode.neighbors("parent")).toEqual([root.eventId]);
    expect(rootNode.neighbors("child")).toEqual([child.eventId]);
    expect(childNode.neighbors("next")).toEqual([triggered.eventId]);
    expect(triggeredNode.neighbors("triggered_by")).toEqual([child.eventId]);
    expect(rootNode.neighbors("completed_by")).toEqual([triggered.eventId]);
  });

  it("returns roots, descendants, snapshots, and supports clear", () => {
    const record = new EventRecord();
    const root = new BaseEvent({ type: "crew_kickoff_started" });
    const childA = new BaseEvent({ type: "task_started", parentEventId: root.eventId });
    const childB = new BaseEvent({ type: "task_completed", parentEventId: root.eventId });
    const unrelated = new BaseEvent({ type: "flow_started" });

    record.add(root);
    record.add(childA);
    record.add(childB);
    record.add(unrelated);

    expect(record.roots().map((node) => node.event.eventId)).toEqual([root.eventId, unrelated.eventId]);
    expect(record.descendants(root.eventId).map((node) => node.event.eventId)).toEqual([childA.eventId, childB.eventId]);
    expect(record.all_nodes()).toHaveLength(4);
    expect(record.has(childA.eventId)).toBe(true);
    expect(JSON.stringify(record)).toContain("crew_kickoff_started");

    record.clear();

    expect(record.size).toBe(0);
    expect(record.get(root.eventId)).toBeNull();
  });
});

describe("runtime state", () => {
  it("serializes entities, event records, and lineage fields", () => {
    const record = new EventRecord();
    const event = new BaseEvent({ type: "crew_kickoff_started" });
    record.add(event);
    const agent = new Agent({
      role: "Runtime Agent",
      goal: "Serialize",
      backstory: "Serializable",
    });
    const state = new RuntimeState({
      root: [agent],
      eventRecord: record,
      parentId: "parent456",
      branch: "experiment",
    });

    const dumped = JSON.parse(state.to_json()) as Record<string, unknown>;

    expect(dumped.crewai_version).toBe("0.0.0");
    expect(dumped.parent_id).toBe("parent456");
    expect(dumped.branch).toBe("experiment");
    expect(dumped.entities).toEqual([
      expect.objectContaining({ type: "Agent", role: "Runtime Agent" }),
    ]);
    expect(JSON.stringify(dumped.event_record)).toContain(event.eventId);
  });

  it("chains JSON checkpoint lineage and restores checkpoint ids", async () => {
    const directory = mkdtempSync(join(tmpdir(), "crewai-ts-runtime-state-"));
    const provider = new JsonProvider();
    const state = new RuntimeState({
      root: [{ type: "mock" }],
      provider,
    });

    const first = state.checkpoint(directory);
    const firstId = state.checkpoint_id;
    const second = await state.acheckpoint(directory);
    const secondId = state.checkpointId;

    expect(firstId).toBe(provider.extract_id(first));
    expect(secondId).toBe(provider.extract_id(second));
    expect(firstId).not.toBe(secondId);
    expect(state.parent_id).toBe(secondId);

    const secondPayload = JSON.parse(await provider.from_checkpoint(second)) as Record<string, unknown>;
    expect(secondPayload.parent_id).toBe(firstId);

    const restored = await RuntimeState.from_checkpoint(new CheckpointConfig({
      restore_from: second,
      provider,
    }));
    const asyncRestored = await RuntimeState.afrom_checkpoint(new CheckpointConfig({
      restore_from: second,
      provider,
    }));
    expect(restored.checkpoint_id).toBe(secondId);
    expect(restored.parent_id).toBe(secondId);
    expect(asyncRestored.checkpoint_id).toBe(secondId);
    expect(asyncRestored.parent_id).toBe(secondId);
  });

  it("forks runtime state branches with explicit and generated names", () => {
    const state = new RuntimeState();

    expect(state.fork("my-experiment")).toBe("my-experiment");
    state.checkpointId = "20260409T120000_abc12345";
    state.checkpoint_id = state.checkpointId;

    const generated = state.fork();

    expect(generated).toMatch(/^fork\/20260409T120000_abc12345_[0-9a-f]{6}$/);
  });

  it("wires runtime state through the event bus and records emitted events", () => {
    const state = new RuntimeState();
    const seen: RuntimeState[] = [];
    crewaiEventBus.set_runtime_state(state);
    crewaiEventBus.on("flow_started", (_source, _event, runtimeState) => {
      seen.push(runtimeState as RuntimeState);
    });

    const event = new FlowStartedEvent({ flowName: "CheckpointFlow", inputs: { topic: "CrewAI" } });
    crewaiEventBus.emit("source", event);

    expect(crewaiEventBus.runtime_state).toBe(state);
    expect(seen).toEqual([state]);
    expect(state.event_record.get(event.eventId)?.event).toBe(event);
  });
});

describe("global hooks", () => {
  it("runs before and after LLM hooks around agent LLM calls", async () => {
    beforeLlmCall((context) => {
      const userMessage = context.messages.find((message) => message.role === "user");
      if (userMessage) {
        userMessage.content = `${userMessage.content}\nHooked input`;
      }
      expect((context.agent as Agent).role).toBe("Hooked Agent");
      return true;
    });
    afterLlmCall((context) => {
      expect(context.response).toContain("SECRET");
      return typeof context.response === "string"
        ? context.response.replace("SECRET", "[redacted]")
        : null;
    });
    const agentInstance = new Agent({
      role: "Hooked Agent",
      goal: "Use hooks",
      backstory: "Hook aware",
      llm: (messages) => `result: ${messages.at(-1)?.content ?? ""} SECRET`,
    });

    const output = await agentInstance.kickoff("Research CrewAI");

    expect(output).toContain("Hooked input");
    expect(output).toContain("[redacted]");
    expect(output).not.toContain("SECRET");
  });

  it("can block LLM calls from before hooks", async () => {
    beforeLlmCall(() => false);
    const agentInstance = new Agent({
      role: "Blocked Agent",
      goal: "Use hooks",
      backstory: "Hook aware",
      llm: () => "should not run",
    });

    await expect(agentInstance.kickoff("Research CrewAI")).rejects.toThrow("LLM call blocked");
  });

  it("runs before and after tool hooks around tool execution", async () => {
    beforeToolCall((context) => {
      expect(context.tool_name).toBe("search_web");
      context.tool_input.query = "hooked query";
      return null;
    });
    afterToolCall((context) => `${String(context.tool_result)} [checked]`);
    const search = new StructuredTool({
      name: "search web",
      description: "Search",
      argsSchema: {
        query: { type: "string", required: true },
      },
      func: ({ query }) => `found ${String(query)}`,
    });

    const output = await search.arun({ query: "original" });

    expect(output).toBe("found hooked query [checked]");
  });

  it("clears registered hooks and returns counts", () => {
    beforeLlmCall(() => true);
    afterLlmCall(() => null);
    beforeToolCall(() => true);
    afterToolCall(() => null);

    expect(clearAllGlobalHooks()).toEqual({
      llm_hooks: [1, 1],
      tool_hooks: [1, 1],
      total: [2, 2],
    });
  });
});

describe("lite agent", () => {
  it("runs direct messages and returns a LiteAgentOutput with metrics and messages", async () => {
    const agent = new LiteAgent({
      role: "Research Assistant",
      goal: "Answer directly",
      backstory: "Careful analyst",
      llm: (messages) => `lite answer: ${messages.at(-1)?.content ?? ""}`,
    });

    const output = await agent.kickoff("What is CrewAI?");

    expect(output).toBeInstanceOf(LiteAgentOutput);
    expect(output.raw).toContain("What is CrewAI?");
    expect(output.agentRole).toBe("Research Assistant");
    expect(output.agent_role).toBe("Research Assistant");
    expect(output.messages).toEqual([{ role: "user", content: "What is CrewAI?" }]);
    expect(output.usageMetrics?.successfulRequests).toBe(1);
    expect(output.usage_metrics?.totalTokens).toBeGreaterThan(0);
    expect(String(output)).toContain("lite answer");
    expect(agent.messages).toHaveLength(1);
  });

  it("supports tools, guardrails, structured output parsing, and snake_case aliases", async () => {
    const guardrailEvents: CrewAIEvent[] = [];
    crewaiEventBus.on("llm_guardrail_started", (_source, event) => {
      guardrailEvents.push(event);
    });
    crewaiEventBus.on("llm_guardrail_completed", (_source, event) => {
      guardrailEvents.push(event);
    });
    const search = new StructuredTool({
      name: "search_web",
      description: "Search the web",
      argsSchema: {
        query: { type: "string", required: true },
      },
      func: ({ query }) => `found ${String(query)}`,
    });
    const agent = new LiteAgent({
      role: "Tool User",
      goal: "Use tools",
      backstory: "Uses tools when useful",
      tools: [search],
      max_iterations: 3,
      guardrail_max_retries: 1,
      llm: (messages) => {
        if (messages.some((message) => message.role === "tool")) {
          return "{\"summary\":\"tool complete\",\"confidence\":99}";
        }
        return {
          toolName: "search_web",
          arguments: { query: "CrewAI" },
        };
      },
      guardrail: (output) => [true, output],
    });

    const output = await agent.kickoff_async("Research CrewAI", {
      response_format: { summary: "string", confidence: "number" },
    });

    expect(agent.max_iterations).toBe(3);
    expect(output.raw).toContain("tool complete");
    expect(output.pydantic).toEqual({ summary: "tool complete", confidence: 99 });
    expect(output.to_dict()).toEqual({ summary: "tool complete", confidence: 99 });
    expect(agent.tools_results[0]?.tool_name).toBe("search_web");
    expect(agent.iterations).toBeGreaterThan(0);
    expect(guardrailEvents[0]).toBeInstanceOf(LLMGuardrailStartedEvent);
    expect((guardrailEvents[0] as LLMGuardrailStartedEvent).from_agent).toBe(agent);
    expect(guardrailEvents[1]).toBeInstanceOf(LLMGuardrailCompletedEvent);
    expect((guardrailEvents[1] as LLMGuardrailCompletedEvent).success).toBe(true);
  });

  it("emits lite agent execution events", async () => {
    const events: CrewAIEvent[] = [];
    crewaiEventBus.on("lite_agent_execution_started", (_source, event) => {
      events.push(event);
    });
    crewaiEventBus.on("lite_agent_execution_completed", (_source, event) => {
      events.push(event);
    });
    const agent = new LiteAgent({
      role: "Event Agent",
      goal: "Emit events",
      backstory: "Eventful",
      llm: () => "done",
    });

    await agent.kickoff("Run");

    expect(events[0]).toBeInstanceOf(LiteAgentExecutionStartedEvent);
    expect(events[1]).toBeInstanceOf(LiteAgentExecutionCompletedEvent);
    expect((events[0] as LiteAgentExecutionStartedEvent).agent_info.role).toBe("Event Agent");
    expect((events[1] as LiteAgentExecutionCompletedEvent).output.raw).toBe("done");
  });

  it("emits lite agent error events", async () => {
    const events: CrewAIEvent[] = [];
    crewaiEventBus.on("lite_agent_execution_error", (_source, event) => {
      events.push(event);
    });
    const agent = new LiteAgent({
      role: "Failing Agent",
      goal: "Fail",
      backstory: "Fails",
      llm: () => {
        throw new Error("lite boom");
      },
    });

    await expect(agent.akickoff("Run")).rejects.toThrow("lite boom");

    expect(events[0]).toBeInstanceOf(LiteAgentExecutionErrorEvent);
    expect((events[0] as LiteAgentExecutionErrorEvent).error).toBe("lite boom");
  });

  it("summarizes LiteAgentOutput todos with CrewAI-compatible aliases", () => {
    const output = new LiteAgentOutput({
      raw: "done",
      agent_role: "Planner",
      todos: [
        { step_number: 1, description: "Research", status: "completed", result: "ok" },
        { stepNumber: 2, description: "Write", status: "failed", result: "missing" },
      ],
      replan_count: 1,
      last_replan_reason: "failed step",
    });

    expect(output.had_plan).toBe(true);
    expect(output.completed_todos).toHaveLength(1);
    expect(output.failedTodos).toHaveLength(1);
    expect(output.replanCount).toBe(1);
    expect(output.lastReplanReason).toBe("failed step");
  });
});

describe("streaming output", () => {
  it("normalizes stream chunks with CrewAI-compatible aliases", () => {
    const toolCall = {
      tool_id: "call-1",
      tool_name: "search",
      arguments: "{\"query\":\"CrewAI\"}",
      index: 0,
    };
    const chunk = new StreamChunk({
      content: "searching",
      chunk_type: StreamChunkType.TOOL_CALL,
      task_name: "Research",
      agent_role: "Researcher",
      tool_call: toolCall,
    });

    expect(chunk.chunkType).toBe(StreamChunkType.TOOL_CALL);
    expect(chunk.chunk_type).toBe(StreamChunkType.TOOL_CALL);
    expect(chunk.taskName).toBe("Research");
    expect(chunk.task_name).toBe("Research");
    expect(chunk.agentRole).toBe("Researcher");
    expect(chunk.agent_role).toBe("Researcher");
    expect(chunk.toolCall).toBe(toolCall);
    expect(chunk.tool_call).toBe(toolCall);
    expect(String(chunk)).toBe("searching");
  });

  it("returns a CrewStreamingOutput when a crew is configured for streaming", async () => {
    const researcher = new Agent({
      role: "Researcher",
      goal: "Find facts",
      backstory: "Careful analyst",
      llm: () => "stream final",
    });
    const taskInstance = new Task({
      description: "Research",
      expectedOutput: "Answer",
      agent: researcher,
    });
    const crewInstance = new Crew({
      agents: [researcher],
      tasks: [taskInstance],
      stream: true,
    });

    const streaming = await crewInstance.kickoff() as unknown as CrewStreamingOutput;

    expect(streaming).toBeInstanceOf(CrewStreamingOutput);
    expect(() => streaming.result).toThrow("Streaming has not completed");

    const chunks: StreamChunk[] = [];
    for await (const chunk of streaming) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.content).toContain("stream final");
    expect(chunks[0]?.taskName).toBe("Research");
    expect(streaming.is_completed).toBe(true);
    expect(streaming.get_full_text()).toContain("stream final");
    expect(streaming.result.raw).toContain("stream final");
    expect([...streaming].map((chunk) => chunk.content)).toEqual(["stream final"]);
  });

  it("returns a FlowStreamingOutput when a flow is configured for streaming", async () => {
    class StreamingFlow extends Flow {
      constructor() {
        super({ stream: true });
      }

      begin() {
        return "flow final";
      }
    }

    const flow = new StreamingFlow();
    decorateMethod(StreamingFlow, "begin", start() as unknown as Decorator).call(flow);

    const streaming = await flow.kickoff() as FlowStreamingOutput;

    expect(streaming).toBeInstanceOf(FlowStreamingOutput);
    expect(() => streaming.result).toThrow("Streaming has not completed");

    const chunks: StreamChunk[] = [];
    for await (const chunk of streaming) {
      chunks.push(chunk);
    }

    expect(chunks.map((chunk) => chunk.content)).toEqual(["flow final"]);
    expect(streaming.result).toBe("flow final");
    expect(streaming.isCompleted).toBe(true);
  });

  it("supports direct streaming outputs with null results", async () => {
    const streaming = new FlowStreamingOutput(() => Promise.resolve(null));

    const chunks: StreamChunk[] = [];
    for await (const chunk of streaming) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([]);
    expect(streaming.result).toBeNull();
    expect(streaming.is_completed).toBe(true);
  });
});

function decorateMethod<T extends object>(
  constructor: new () => T,
  name: keyof T & string,
  decorator: Decorator,
): (this: T) => void {
  const initializers: Array<(this: T) => void> = [];
  type TestMethod = (this: T, ...args: unknown[]) => unknown;
  const prototype = constructor.prototype as Record<string, unknown>;
  const original = prototype[name] as TestMethod;
  const applyDecorator = decorator as unknown as (
    value: TestMethod,
    context: ClassMethodDecoratorContext<T, TestMethod>,
  ) => TestMethod | undefined;
  const replacement = applyDecorator(original, {
    kind: "method",
    name,
    static: false,
    private: false,
    access: {
      has: (object: T) => name in object,
      get: (object: T) => (object as Record<string, unknown>)[name] as TestMethod,
    },
    addInitializer: (init: (this: T) => void) => {
      initializers.push(init);
    },
    metadata: undefined,
  });

  if (replacement !== undefined) {
    Object.defineProperty(constructor.prototype, name, {
      configurable: true,
      writable: true,
      value: replacement,
    });
  }

  const initializer = initializers[0];
  if (!initializer) {
    throw new Error(`Decorator '${name}' did not register an initializer.`);
  }
  return initializer;
}

function applyMethodDecorator<T extends object>(
  constructor: new () => T,
  name: keyof T & string,
  decorator: Decorator,
): Array<(this: T) => void> {
  const initializers: Array<(this: T) => void> = [];
  type TestMethod = (this: T, ...args: unknown[]) => unknown;
  const prototype = constructor.prototype as Record<string, unknown>;
  const original = prototype[name] as TestMethod;
  const applyDecorator = decorator as unknown as (
    value: TestMethod,
    context: ClassMethodDecoratorContext<T, TestMethod>,
  ) => TestMethod | undefined;
  const replacement = applyDecorator(original, {
    kind: "method",
    name,
    static: false,
    private: false,
    access: {
      has: (object: T) => name in object,
      get: (object: T) => (object as Record<string, unknown>)[name] as TestMethod,
    },
    addInitializer: (init: (this: T) => void) => {
      initializers.push(init);
    },
    metadata: undefined,
  });

  if (replacement !== undefined) {
    Object.defineProperty(constructor.prototype, name, {
      configurable: true,
      writable: true,
      value: replacement,
    });
  }

  return initializers;
}

function decorateClass<T extends new () => object>(
  constructor: T,
  decorator: Decorator,
): T {
  const applyDecorator = decorator as unknown as (
    value: T,
    context: ClassDecoratorContext<T>,
  ) => T | undefined;
  return applyDecorator(constructor, {
    kind: "class",
    name: constructor.name,
    addInitializer: () => {},
    metadata: undefined,
  }) ?? constructor;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function createTestJwt(options: {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  privateKey: KeyObject;
}): string {
  const encodedHeader = base64url(JSON.stringify(options.header));
  const encodedPayload = base64url(JSON.stringify(options.payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = sign("RSA-SHA256", Buffer.from(signingInput), options.privateKey);
  return `${signingInput}.${base64url(signature)}`;
}

function base64url(value: string | Buffer): string {
  const buffer = typeof value === "string" ? Buffer.from(value) : value;
  return buffer.toString("base64url");
}
