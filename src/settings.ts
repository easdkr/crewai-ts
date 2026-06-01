import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, join } from "node:path";

import { TokenManager } from "./auth.js";

export const CREWAI_TRAINED_AGENTS_FILE_ENV = "CREWAI_TRAINED_AGENTS_FILE";
export const TRAINING_DATA_FILE = "training_data.pkl";
export const TRAINED_AGENTS_DATA_FILE = "trained_agents_data.pkl";
export const KNOWLEDGE_DIRECTORY = "knowledge";
export const MAX_FILE_NAME_LENGTH = 255;
export const EMITTER_COLOR = "bold_blue";
export const CC_ENV_VAR = "CLAUDECODE";
export const CODEX_ENV_VARS = [
  "CODEX_CI",
  "CODEX_MANAGED_BY_NPM",
  "CODEX_SANDBOX",
  "CODEX_SANDBOX_NETWORK_DISABLED",
  "CODEX_THREAD_ID",
] as const;
export const CURSOR_ENV_VARS = [
  "CURSOR_AGENT",
  "CURSOR_EXTENSION_HOST_ROLE",
  "CURSOR_SANDBOX",
  "CURSOR_TRACE_ID",
  "CURSOR_WORKSPACE_LABEL",
] as const;

export class _NotSpecified {
  toString(): string {
    return "NOT_SPECIFIED";
  }

  toJSON(): string {
    return "NOT_SPECIFIED";
  }

  static __get_pydantic_core_schema__(): {
    type: "plain-validator";
    validator: (value: unknown) => _NotSpecified;
    serialization: { type: "plain-serializer"; serializer: () => string };
  } {
    return {
      type: "plain-validator",
      validator: (value: unknown) => {
        if (value instanceof _NotSpecified || value === "NOT_SPECIFIED") {
          return NOT_SPECIFIED;
        }
        const typeName = value === null ? "null" : Array.isArray(value) ? "Array" : typeof value === "object" ? value.constructor.name : typeof value;
        throw new Error(`Expected NOT_SPECIFIED sentinel, got ${typeName}`);
      },
      serialization: { type: "plain-serializer", serializer: () => "NOT_SPECIFIED" },
    };
  }
}

export const NotSpecified = _NotSpecified;
export const NOT_SPECIFIED = new _NotSpecified();

export const DEFAULT_CREWAI_ENTERPRISE_URL = "https://app.crewai.com";
export const CREWAI_ENTERPRISE_DEFAULT_OAUTH2_PROVIDER = "workos";
export const CREWAI_ENTERPRISE_DEFAULT_OAUTH2_AUDIENCE = "client_01JNJQWBJ4SPFN3SWJM5T7BDG8";
export const CREWAI_ENTERPRISE_DEFAULT_OAUTH2_CLIENT_ID = "client_01JYT06R59SP0NXYGD994NFXXX";
export const CREWAI_ENTERPRISE_DEFAULT_OAUTH2_DOMAIN = "login.crewai.com";

export const DEFAULT_CONFIG_PATH = join(homedir(), ".config", "crewai", "settings.json");

export const USER_SETTINGS_KEYS = [
  "tool_repository_username",
  "tool_repository_password",
  "org_name",
  "org_uuid",
] as const;

export const CLI_SETTINGS_KEYS = [
  "enterprise_base_url",
  "oauth2_provider",
  "oauth2_audience",
  "oauth2_client_id",
  "oauth2_domain",
  "oauth2_extra",
] as const;

export const DEFAULT_CLI_SETTINGS = {
  enterprise_base_url: DEFAULT_CREWAI_ENTERPRISE_URL,
  oauth2_provider: CREWAI_ENTERPRISE_DEFAULT_OAUTH2_PROVIDER,
  oauth2_audience: CREWAI_ENTERPRISE_DEFAULT_OAUTH2_AUDIENCE,
  oauth2_client_id: CREWAI_ENTERPRISE_DEFAULT_OAUTH2_CLIENT_ID,
  oauth2_domain: CREWAI_ENTERPRISE_DEFAULT_OAUTH2_DOMAIN,
  oauth2_extra: {},
} as const;

export const READONLY_SETTINGS_KEYS = ["org_name", "org_uuid"] as const;
export const HIDDEN_SETTINGS_KEYS = [
  "config_path",
  "tool_repository_username",
  "tool_repository_password",
] as const;

export type SettingsData = {
  enterprise_base_url?: string | null;
  tool_repository_username?: string | null;
  tool_repository_password?: string | null;
  org_name?: string | null;
  org_uuid?: string | null;
  oauth2_provider?: string;
  oauth2_audience?: string | null;
  oauth2_client_id?: string;
  oauth2_domain?: string;
  oauth2_extra?: Record<string, unknown>;
};

export type SettingsOptions = SettingsData & {
  configPath?: string | null;
  config_path?: string | null;
  tokenManager?: TokenManager;
  token_manager?: TokenManager;
};

export class Settings {
  enterprise_base_url: string | null;
  tool_repository_username: string | null;
  tool_repository_password: string | null;
  org_name: string | null;
  org_uuid: string | null;
  readonly config_path: string;
  readonly configPath: string;
  oauth2_provider: string;
  oauth2_audience: string | null;
  oauth2_client_id: string;
  oauth2_domain: string;
  oauth2_extra: Record<string, unknown>;
  private readonly tokenManager: TokenManager | null;

  constructor(options: SettingsOptions = {}) {
    const requestedPath = options.configPath ?? options.config_path;
    const configPath = requestedPath === null ? null : requestedPath ?? getWritableConfigPath();
    const fileData = configPath ? readJsonObject(configPath) : {};
    const merged = { ...fileData, ...stripSettingsOptions(options) };

    this.enterprise_base_url = readNullableString(merged.enterprise_base_url, DEFAULT_CLI_SETTINGS.enterprise_base_url);
    this.tool_repository_username = readNullableString(merged.tool_repository_username, null);
    this.tool_repository_password = readNullableString(merged.tool_repository_password, null);
    this.org_name = readNullableString(merged.org_name, null);
    this.org_uuid = readNullableString(merged.org_uuid, null);
    this.config_path = configPath ?? "/dev/null";
    this.configPath = this.config_path;
    this.oauth2_provider = readString(merged.oauth2_provider, DEFAULT_CLI_SETTINGS.oauth2_provider);
    this.oauth2_audience = readNullableString(merged.oauth2_audience, DEFAULT_CLI_SETTINGS.oauth2_audience);
    this.oauth2_client_id = readString(merged.oauth2_client_id, DEFAULT_CLI_SETTINGS.oauth2_client_id);
    this.oauth2_domain = readString(merged.oauth2_domain, DEFAULT_CLI_SETTINGS.oauth2_domain);
    this.oauth2_extra = isRecord(merged.oauth2_extra) ? { ...merged.oauth2_extra } : {};
    this.tokenManager = options.tokenManager ?? options.token_manager ?? null;
  }

  clearUserSettings(): void {
    this.resetUserSettings();
    this.dump();
  }

  clear_user_settings(): void {
    this.clearUserSettings();
  }

  reset(): void {
    this.resetUserSettings();
    this.resetCliSettings();
    this.clearAuthTokens();
    this.dump();
  }

  dump(): void {
    if (this.config_path === "/dev/null") {
      return;
    }
    try {
      mkdirSync(dirname(this.config_path), { recursive: true });
      const existingData = readJsonObject(this.config_path);
      const updated = { ...existingData, ...this.toJSON() };
      writeFileSync(this.config_path, `${JSON.stringify(updated, null, 4)}\n`, "utf8");
    } catch {
      // Match upstream: settings persistence failures are intentionally non-fatal.
    }
  }

  toJSON(): SettingsData {
    return {
      enterprise_base_url: this.enterprise_base_url,
      tool_repository_username: this.tool_repository_username,
      tool_repository_password: this.tool_repository_password,
      org_name: this.org_name,
      org_uuid: this.org_uuid,
      oauth2_provider: this.oauth2_provider,
      oauth2_audience: this.oauth2_audience,
      oauth2_client_id: this.oauth2_client_id,
      oauth2_domain: this.oauth2_domain,
      oauth2_extra: { ...this.oauth2_extra },
    };
  }

  private resetUserSettings(): void {
    this.tool_repository_username = null;
    this.tool_repository_password = null;
    this.org_name = null;
    this.org_uuid = null;
  }

  private resetCliSettings(): void {
    this.enterprise_base_url = DEFAULT_CLI_SETTINGS.enterprise_base_url;
    this.oauth2_provider = DEFAULT_CLI_SETTINGS.oauth2_provider;
    this.oauth2_audience = DEFAULT_CLI_SETTINGS.oauth2_audience;
    this.oauth2_client_id = DEFAULT_CLI_SETTINGS.oauth2_client_id;
    this.oauth2_domain = DEFAULT_CLI_SETTINGS.oauth2_domain;
    this.oauth2_extra = {};
  }

  private clearAuthTokens(): void {
    (this.tokenManager ?? new TokenManager()).clearTokens();
  }
}

export function getWritableConfigPath(): string | null {
  const fallbackPaths = [
    DEFAULT_CONFIG_PATH,
    join(tmpdir(), "crewai_settings.json"),
    join(process.cwd(), "crewai_settings.json"),
  ];
  for (const configPath of fallbackPaths) {
    try {
      mkdirSync(dirname(configPath), { recursive: true });
      const testPath = join(dirname(configPath), ".crewai_write_test");
      writeFileSync(testPath, "test", "utf8");
      rmSync(testPath, { force: true });
      return configPath;
    } catch {
      continue;
    }
  }
  return null;
}

export const get_writable_config_path = getWritableConfigPath;

export function getProjectDirectoryName(): string {
  return process.env.CREWAI_STORAGE_DIR ?? basename(process.cwd());
}

export const get_project_directory_name = getProjectDirectoryName;

export function dbStoragePath(): string {
  const base = process.env.CREWAI_TS_DATA_DIR ?? join(homedir(), ".local", "share");
  const path = join(base, getProjectDirectoryName());
  mkdirSync(path, { recursive: true });
  return path;
}

export const db_storage_path = dbStoragePath;

export type UserData = Record<string, unknown>;

export function userDataFile(): string {
  const base = dbStoragePath();
  mkdirSync(base, { recursive: true });
  return join(base, ".crewai_user.json");
}

export const user_data_file = userDataFile;

export function loadUserData(): UserData {
  return readJsonObject(userDataFile());
}

export const load_user_data = loadUserData;

export function saveUserData(data: UserData): void {
  try {
    writeFileSync(userDataFile(), JSON.stringify(data, null, 2), "utf8");
  } catch {
    // Match upstream: user-data persistence failures are non-fatal.
  }
}

export const save_user_data = saveUserData;

export function updateUserData(updates: UserData): void {
  const data = loadUserData();
  saveUserData({ ...data, ...updates });
}

export const update_user_data = updateUserData;

export function hasUserDeclinedTracing(): boolean {
  const data = loadUserData();
  return data.first_execution_done === true && data.trace_consent === false;
}

export const has_user_declined_tracing = hasUserDeclinedTracing;

export function isTracingEnabled(): boolean {
  const env = process.env.CREWAI_TRACING_ENABLED?.toLowerCase();
  if (env === "true" || env === "1") {
    return true;
  }
  if (env === "false" || env === "0") {
    return false;
  }
  if (hasUserDeclinedTracing()) {
    return false;
  }
  return loadUserData().trace_consent !== false;
}

export const is_tracing_enabled = isTracingEnabled;

function stripSettingsOptions(options: SettingsOptions): SettingsData {
  const {
    configPath: _configPath,
    config_path: _config_path,
    tokenManager: _tokenManager,
    token_manager: _token_manager,
    ...data
  } = options;
  void _configPath;
  void _config_path;
  void _tokenManager;
  void _token_manager;
  return data;
}

function readJsonObject(path: string): Record<string, unknown> {
  if (!existsSync(path)) {
    return {};
  }
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function readNullableString(value: unknown, fallback: string | null): string | null {
  return value === null || typeof value === "string" ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function dirname(path: string): string {
  const index = path.lastIndexOf("/");
  return index <= 0 ? "." : path.slice(0, index);
}
