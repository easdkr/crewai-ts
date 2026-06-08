import { existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join } from "node:path";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createPublicKey,
  randomBytes,
  timingSafeEqual,
  verify,
  type PublicKeyInput,
} from "node:crypto";

export const ALGORITHMS = ["RS256"] as const;

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export type TokenManagerOptions = {
  filePath?: string;
  file_path?: string;
  storageDir?: string;
  storage_dir?: string;
};

type StoredTokenData = {
  access_token: string;
  expiration: string;
};

type Jwk = Record<string, unknown> & { kid?: string };

export class TokenManager {
  readonly filePath: string;
  readonly file_path: string;
  readonly storageDir: string;
  readonly storage_dir: string;
  private readonly key: Buffer;

  constructor(filePathOrOptions: string | TokenManagerOptions = "tokens.enc") {
    const options = typeof filePathOrOptions === "string" ? { filePath: filePathOrOptions } : filePathOrOptions;
    this.filePath = options.filePath ?? options.file_path ?? "tokens.enc";
    this.file_path = this.filePath;
    this.storageDir = options.storageDir ?? options.storage_dir ?? getSecureStoragePath();
    this.storage_dir = this.storageDir;
    mkdirSync(this.storageDir, { recursive: true, mode: 0o700 });
    this.key = this.getOrCreateKey();
  }

  saveTokens(accessToken: string, expiresAt: number): void {
    const data: StoredTokenData = {
      access_token: accessToken,
      expiration: new Date(expiresAt * 1000).toISOString(),
    };
    this.atomicWriteSecureFile(this.filePath, encryptJson(data, this.key));
  }

  save_tokens(accessToken: string, expiresAt: number): void {
    this.saveTokens(accessToken, expiresAt);
  }

  getToken(): string | null {
    const encrypted = this.readSecureFile(this.filePath);
    if (!encrypted) {
      return null;
    }
    const data = decryptJson(encrypted, this.key);
    const expiration = Date.parse(data.expiration);
    if (!Number.isFinite(expiration) || expiration <= Date.now()) {
      return null;
    }
    return data.access_token;
  }

  get_token(): string | null {
    return this.getToken();
  }

  clearTokens(): void {
    this.deleteSecureFile(this.filePath);
  }

  clear_tokens(): void {
    this.clearTokens();
  }

  private getOrCreateKey(): Buffer {
    const key = this.readSecureFile("secret.key");
    if (key && key.length === 32) {
      return key;
    }
    const newKey = randomBytes(32);
    if (this.atomicCreateSecureFile("secret.key", newKey)) {
      return newKey;
    }
    const retryKey = this.readSecureFile("secret.key");
    if (retryKey && retryKey.length === 32) {
      return retryKey;
    }
    throw new Error("Failed to create or read encryption key");
  }

  private atomicCreateSecureFile(filename: string, content: Buffer): boolean {
    const path = join(this.storageDir, filename);
    try {
      const fd = openSync(path, "wx", 0o600);
      writeFileSync(fd, content);
      return true;
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "EEXIST") {
        return false;
      }
      throw error;
    }
  }

  private atomicWriteSecureFile(filename: string, content: Buffer): void {
    const tempPath = join(this.storageDir, `.${filename}.${randomBytes(8).toString("hex")}`);
    const finalPath = join(this.storageDir, filename);
    writeFileSync(tempPath, content, { mode: 0o600 });
    renameSync(tempPath, finalPath);
  }

  private readSecureFile(filename: string): Buffer | null {
    const path = join(this.storageDir, filename);
    return existsSync(path) ? readFileSync(path) : null;
  }

  private deleteSecureFile(filename: string): void {
    rmSync(join(this.storageDir, filename), { force: true });
  }
}

export function getAuthToken(tokenManager: TokenManager = new TokenManager()): string {
  const accessToken = tokenManager.getToken();
  if (!accessToken) {
    throw new AuthError("No token found, make sure you are logged in");
  }
  return accessToken;
}

export const get_auth_token = getAuthToken;

export type Oauth2SettingsOptions = {
  provider: string;
  clientId?: string;
  client_id?: string;
  domain: string;
  audience?: string | null;
  extra?: Record<string, unknown>;
};

export class Oauth2Settings {
  readonly provider: string;
  readonly clientId: string;
  readonly client_id: string;
  readonly domain: string;
  readonly audience: string | null;
  readonly extra: Record<string, unknown>;

  constructor(options: Oauth2SettingsOptions) {
    const clientId = options.clientId ?? options.client_id;
    if (!clientId) {
      throw new Error("Oauth2Settings requires clientId.");
    }
    this.provider = options.provider;
    this.clientId = clientId;
    this.client_id = clientId;
    this.domain = options.domain;
    this.audience = options.audience ?? null;
    this.extra = { ...(options.extra ?? {}) };
  }

  static fromSettings(settings: Oauth2SettingsOptions): Oauth2Settings {
    return new Oauth2Settings(settings);
  }

  static from_settings(settings: Oauth2SettingsOptions): Oauth2Settings {
    return Oauth2Settings.fromSettings(settings);
  }
}

export abstract class BaseProvider {
  readonly settings: Oauth2Settings;

  constructor(settings: Oauth2Settings) {
    this.settings = settings;
  }

  abstract getAuthorizeUrl(): string;
  abstract getTokenUrl(): string;
  abstract getJwksUrl(): string;
  abstract getIssuer(): string;
  abstract getAudience(): string;
  abstract getClientId(): string;

  get_authorize_url(): string {
    return this.getAuthorizeUrl();
  }

  get_token_url(): string {
    return this.getTokenUrl();
  }

  get_jwks_url(): string {
    return this.getJwksUrl();
  }

  get_issuer(): string {
    return this.getIssuer();
  }

  get_audience(): string {
    return this.getAudience();
  }

  get_client_id(): string {
    return this.getClientId();
  }

  getRequiredFields(): readonly string[] {
    return [];
  }

  get_required_fields(): readonly string[] {
    return this.getRequiredFields();
  }

  getOauthScopes(): readonly string[] {
    return ["openid", "profile", "email"];
  }

  get_oauth_scopes(): readonly string[] {
    return this.getOauthScopes();
  }
}

export class Auth0Provider extends BaseProvider {
  getAuthorizeUrl(): string {
    return `https://${this.domain()}/oauth/device/code`;
  }

  getTokenUrl(): string {
    return `https://${this.domain()}/oauth/token`;
  }

  getJwksUrl(): string {
    return `https://${this.domain()}/.well-known/jwks.json`;
  }

  getIssuer(): string {
    return `https://${this.domain()}/`;
  }

  getAudience(): string {
    return required(this.settings.audience, "Audience");
  }

  getClientId(): string {
    return this.settings.clientId;
  }

  private domain(): string {
    return required(this.settings.domain, "Domain");
  }
}

export class WorkosProvider extends BaseProvider {
  getAuthorizeUrl(): string {
    return `https://${this.domain()}/oauth2/device_authorization`;
  }

  getTokenUrl(): string {
    return `https://${this.domain()}/oauth2/token`;
  }

  getJwksUrl(): string {
    return `https://${this.domain()}/oauth2/jwks`;
  }

  getIssuer(): string {
    return `https://${this.domain()}`;
  }

  getAudience(): string {
    return this.settings.audience ?? "";
  }

  getClientId(): string {
    return this.settings.clientId;
  }

  private domain(): string {
    return required(this.settings.domain, "Domain");
  }
}

export class EntraIdProvider extends BaseProvider {
  getAuthorizeUrl(): string {
    return `${this.baseUrl()}/oauth2/v2.0/devicecode`;
  }

  getTokenUrl(): string {
    return `${this.baseUrl()}/oauth2/v2.0/token`;
  }

  getJwksUrl(): string {
    return `${this.baseUrl()}/discovery/v2.0/keys`;
  }

  getIssuer(): string {
    return `${this.baseUrl()}/v2.0`;
  }

  getAudience(): string {
    return required(this.settings.audience, "Audience");
  }

  getClientId(): string {
    return this.settings.clientId;
  }

  getOauthScopes(): readonly string[] {
    return [...super.getOauthScopes(), ...stringFromUnknown(this.settings.extra.scope).split(/\s+/).filter(Boolean)];
  }

  getRequiredFields(): readonly string[] {
    return ["scope"];
  }

  private baseUrl(): string {
    return `https://login.microsoftonline.com/${this.settings.domain}`;
  }
}

export class KeycloakProvider extends BaseProvider {
  getAuthorizeUrl(): string {
    return `${this.baseUrl()}/realms/${String(this.settings.extra.realm)}/protocol/openid-connect/auth/device`;
  }

  getTokenUrl(): string {
    return `${this.baseUrl()}/realms/${String(this.settings.extra.realm)}/protocol/openid-connect/token`;
  }

  getJwksUrl(): string {
    return `${this.baseUrl()}/realms/${String(this.settings.extra.realm)}/protocol/openid-connect/certs`;
  }

  getIssuer(): string {
    return `${this.baseUrl()}/realms/${String(this.settings.extra.realm)}`;
  }

  getAudience(): string {
    return this.settings.audience ?? "no-audience-provided";
  }

  getClientId(): string {
    return this.settings.clientId;
  }

  getRequiredFields(): readonly string[] {
    return ["realm"];
  }

  private baseUrl(): string {
    return `https://${this.settings.domain.replace(/^https?:\/\//, "")}`;
  }
}

export class OktaProvider extends BaseProvider {
  getAuthorizeUrl(): string {
    return `${this.baseUrl()}/v1/device/authorize`;
  }

  getTokenUrl(): string {
    return `${this.baseUrl()}/v1/token`;
  }

  getJwksUrl(): string {
    return `${this.baseUrl()}/v1/keys`;
  }

  getIssuer(): string {
    return this.baseUrl().replace(/\/oauth2$/, "");
  }

  getAudience(): string {
    return required(this.settings.audience, "Audience");
  }

  getClientId(): string {
    return this.settings.clientId;
  }

  getRequiredFields(): readonly string[] {
    return ["authorization_server_name", "using_org_auth_server"];
  }

  private baseUrl(): string {
    return this.settings.extra.using_org_auth_server
      ? `https://${this.settings.domain}/oauth2`
      : `https://${this.settings.domain}/oauth2/${stringFromUnknown(this.settings.extra.authorization_server_name, "default")}`;
  }
}

export type ProviderConstructor = new (settings: Oauth2Settings) => BaseProvider;

const providerRegistry = new Map<string, ProviderConstructor>([
  ["auth0", Auth0Provider],
  ["workos", WorkosProvider],
  ["entra_id", EntraIdProvider],
  ["okta", OktaProvider],
  ["keycloak", KeycloakProvider],
]);

export const ProviderFactory = {
  register(provider: string, providerClass: ProviderConstructor): void {
    providerRegistry.set(provider.toLowerCase(), providerClass);
  },

  fromSettings(settings: Oauth2Settings): BaseProvider {
    const providerClass = providerRegistry.get(settings.provider.toLowerCase());
    if (!providerClass) {
      throw new Error(`Unsupported OAuth2 provider: ${settings.provider}`);
    }
    return new providerClass(settings);
  },

  from_settings(settings: Oauth2Settings): BaseProvider {
    return ProviderFactory.fromSettings(settings);
  },
};

export type DeviceCodeData = {
  device_code: string;
  user_code: string;
  verification_uri?: string;
  verification_uri_complete?: string;
  interval?: number;
};

export type TokenResponseData = {
  access_token?: string;
  error?: string;
  error_description?: string;
  [key: string]: unknown;
};

export type AuthenticationCommandOptions = {
  tokenManager?: TokenManager;
  token_manager?: TokenManager;
  oauth2Provider?: BaseProvider;
  oauth2_provider?: BaseProvider;
  fetch?: typeof fetch;
  openBrowser?: (url: string) => unknown;
  open_browser?: (url: string) => unknown;
  maxAttempts?: number;
  max_attempts?: number;
};

export class AuthenticationCommand {
  readonly tokenManager: TokenManager;
  readonly token_manager: TokenManager;
  readonly oauth2Provider: BaseProvider;
  readonly oauth2_provider: BaseProvider;
  private readonly fetchImpl: typeof fetch;
  private readonly openBrowser: (url: string) => unknown;
  private readonly maxAttempts: number;

  constructor(options: AuthenticationCommandOptions = {}) {
    this.tokenManager = options.tokenManager ?? options.token_manager ?? new TokenManager();
    this.token_manager = this.tokenManager;
    this.oauth2Provider = options.oauth2Provider ?? options.oauth2_provider ?? ProviderFactory.fromSettings(defaultOauth2Settings());
    this.oauth2_provider = this.oauth2Provider;
    this.fetchImpl = options.fetch ?? fetch;
    this.openBrowser = options.openBrowser ?? options.open_browser ?? (() => undefined);
    this.maxAttempts = options.maxAttempts ?? options.max_attempts ?? 10;
  }

  async login(): Promise<void> {
    const deviceCodeData = await this.getDeviceCode();
    this.displayAuthInstructions(deviceCodeData);
    await this.pollForToken(deviceCodeData);
  }

  private async getDeviceCode(): Promise<DeviceCodeData> {
    const response = await this.fetchImpl(this.oauth2Provider.getAuthorizeUrl(), {
      method: "POST",
      body: formBody({
        client_id: this.oauth2Provider.getClientId(),
        scope: this.oauth2Provider.getOauthScopes().join(" "),
        audience: this.oauth2Provider.getAudience(),
      }),
    });
    if (!response.ok) {
      throw new Error(`Failed to get device code: ${String(response.status)}`);
    }
    return await response.json() as DeviceCodeData;
  }

  private displayAuthInstructions(deviceCodeData: DeviceCodeData): void {
    const verificationUri = deviceCodeData.verification_uri_complete ?? deviceCodeData.verification_uri ?? "";
    if (verificationUri) {
      this.openBrowser(verificationUri);
    }
  }

  private async pollForToken(deviceCodeData: DeviceCodeData): Promise<void> {
    const tokenPayload = {
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      device_code: deviceCodeData.device_code,
      client_id: this.oauth2Provider.getClientId(),
    };
    for (let attempt = 0; attempt < this.maxAttempts; attempt += 1) {
      const response = await this.fetchImpl(this.oauth2Provider.getTokenUrl(), {
        method: "POST",
        body: formBody(tokenPayload),
      });
      const tokenData = await response.json() as TokenResponseData;
      if (response.ok && tokenData.access_token) {
        await this.validateAndSaveToken(tokenData.access_token);
        return;
      }
      if (tokenData.error !== "authorization_pending" && tokenData.error !== "slow_down") {
        throw new Error(tokenData.error_description ?? tokenData.error ?? "OAuth2 token polling failed");
      }
      await sleep((deviceCodeData.interval ?? 1) * 1000);
    }
    throw new Error("Timeout: Failed to get the token. Please try again.");
  }

  private async validateAndSaveToken(jwtToken: string): Promise<void> {
    const decoded = await validateJwtToken({
      jwtToken,
      jwksUrl: this.oauth2Provider.getJwksUrl(),
      issuer: this.oauth2Provider.getIssuer(),
      audience: this.oauth2Provider.getAudience(),
      fetch: this.fetchImpl,
    });
    const expiresAt = Number(decoded.exp ?? 0);
    this.tokenManager.saveTokens(jwtToken, expiresAt);
  }
}

export type ValidateJwtTokenOptions = {
  jwtToken?: string;
  jwt_token?: string;
  jwksUrl?: string;
  jwks_url?: string;
  issuer: string;
  audience: string;
  fetch?: typeof fetch;
  leewaySeconds?: number;
  leeway_seconds?: number;
};

export async function validateJwtToken(options: ValidateJwtTokenOptions): Promise<Record<string, unknown>> {
  const jwtToken = options.jwtToken ?? options.jwt_token;
  const jwksUrl = options.jwksUrl ?? options.jwks_url;
  if (!jwtToken) {
    throw new Error("jwtToken is required.");
  }
  if (!jwksUrl) {
    throw new Error("jwksUrl is required.");
  }
  const [encodedHeader, encodedPayload, encodedSignature] = jwtToken.split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new Error("Invalid token: expected a JWS compact token.");
  }
  const header = parseJwtPart(encodedHeader);
  const payload = parseJwtPart(encodedPayload);
  if (header.alg !== "RS256") {
    throw new Error(`Invalid token algorithm: ${String(header.alg)}`);
  }
  const jwksResponse = await (options.fetch ?? fetch)(jwksUrl);
  if (!jwksResponse.ok) {
    throw new Error(`JWKS or key processing error: ${String(jwksResponse.status)}`);
  }
  const jwks = await jwksResponse.json() as { keys?: readonly Jwk[] };
  const key = jwks.keys?.find((candidate) => candidate.kid === header.kid) ?? jwks.keys?.[0];
  if (!key) {
    throw new Error("JWKS or key processing error: no matching key found");
  }
  const publicKey = createPublicKey({ key, format: "jwk" } as unknown as PublicKeyInput);
  const valid = verify(
    "RSA-SHA256",
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    publicKey,
    base64urlDecode(encodedSignature),
  );
  if (!valid) {
    throw new Error("Invalid token: signature verification failed");
  }
  validateJwtClaims(payload, options.issuer, options.audience, options.leewaySeconds ?? options.leeway_seconds ?? 10);
  return payload;
}

export const validate_jwt_token = validateJwtToken;

function defaultOauth2Settings(): Oauth2Settings {
  return new Oauth2Settings({
    provider: process.env.CREWAI_OAUTH2_PROVIDER ?? "workos",
    clientId: process.env.CREWAI_OAUTH2_CLIENT_ID ?? "crewai-cli",
    domain: process.env.CREWAI_OAUTH2_DOMAIN ?? "login.crewai.com",
    audience: process.env.CREWAI_OAUTH2_AUDIENCE ?? null,
  });
}

function getSecureStoragePath(): string {
  if (process.env.CREWAI_TS_CREDENTIALS_DIR) {
    return process.env.CREWAI_TS_CREDENTIALS_DIR;
  }
  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    return join(process.env.LOCALAPPDATA, "crewai", "credentials");
  }
  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Application Support", "crewai", "credentials");
  }
  return join(homedir(), ".local", "share", "crewai", "credentials");
}

export function createTemporaryTokenStorage(): string {
  return mkdtempSync(join(tmpdir(), "crewai-ts-token-"));
}

function encryptJson(value: StoredTokenData, key: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from("v1:"), iv, tag, ciphertext]);
}

function decryptJson(encrypted: Buffer, key: Buffer): StoredTokenData {
  const prefix = encrypted.subarray(0, 3).toString();
  if (prefix !== "v1:") {
    throw new Error("Unsupported token file format.");
  }
  const iv = encrypted.subarray(3, 15);
  const tag = encrypted.subarray(15, 31);
  const ciphertext = encrypted.subarray(31);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")) as StoredTokenData;
}

function formBody(data: Record<string, string>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(data)) {
    params.set(key, value);
  }
  return params;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parseJwtPart(part: string): Record<string, unknown> {
  return JSON.parse(base64urlDecode(part).toString("utf8")) as Record<string, unknown>;
}

function base64urlDecode(value: string): Buffer {
  return Buffer.from(value.replaceAll("-", "+").replaceAll("_", "/"), "base64");
}

function validateJwtClaims(payload: Record<string, unknown>, issuer: string, audience: string, leewaySeconds: number): void {
  const now = Math.floor(Date.now() / 1000);
  for (const claim of ["exp", "iat", "iss", "aud", "sub"]) {
    if (!(claim in payload)) {
      throw new Error(`Token is missing required claims: ${claim}`);
    }
  }
  if (Number(payload.exp) + leewaySeconds <= now) {
    throw new Error("Token has expired.");
  }
  if (Number(payload.nbf ?? 0) - leewaySeconds > now) {
    throw new Error("Invalid token: not before claim is in the future");
  }
  if (Number(payload.iat) - leewaySeconds > now) {
    throw new Error("Invalid token: issued at claim is in the future");
  }
  if (payload.iss !== issuer) {
    throw new Error(`Invalid token issuer. Got: '${String(payload.iss)}'. Expected: '${issuer}'`);
  }
  const audiences = Array.isArray(payload.aud) ? payload.aud.map(String) : [String(payload.aud)];
  if (!audiences.includes(audience)) {
    throw new Error(`Invalid token audience. Got: '${audiences.join(",")}'. Expected: '${audience}'`);
  }
}

function required(value: string | null | undefined, name: string): string {
  if (!value) {
    throw new Error(`${name} is required. Please set it in the configuration.`);
  }
  return value;
}

function stringFromUnknown(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function constantTimeEquals(left: string, right: string): boolean {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}
