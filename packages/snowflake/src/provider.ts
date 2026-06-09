import { registerLLMProviderFactory, stripCacheBreakpoint, type LLMCallOptions, type LLMMessageInput, type LLMResponse } from "@crewai-ts/core/llm";
import type { LLMMessage, Tool } from "@crewai-ts/core/types";
import { OpenAICompletion, type OpenAICompletionOptions } from "@crewai-ts/openai";

export const SNOWFLAKE_CORTEX_PATH = "/api/v2/cortex/v1";
export const SNOWFLAKE_TOKEN_ENV_VARS = Object.freeze([
  "SNOWFLAKE_PAT",
  "SNOWFLAKE_TOKEN",
  "SNOWFLAKE_JWT",
] as const);

const LLM_ROLES = new Set(["system", "user", "assistant", "tool"]);

export type SnowflakeCompletionOptions = OpenAICompletionOptions & {
  account_url?: string | null;
  accountUrl?: string | null;
  account_identifier?: string | null;
  accountIdentifier?: string | null;
  account?: string | null;
  snowflake_account?: string | null;
  snowflakeAccount?: string | null;
  database?: string | null;
  schema_name?: string | null;
  schemaName?: string | null;
  warehouse?: string | null;
  role?: string | null;
};

export class SnowflakeCompletion extends OpenAICompletion {
  readonly accountUrl: string;
  readonly account_url: string;
  readonly accountIdentifier: string | null;
  readonly account_identifier: string | null;
  readonly database: string | null;
  readonly schemaName: string | null;
  readonly schema_name: string | null;
  readonly warehouse: string | null;
  readonly role: string | null;

  constructor(options: SnowflakeCompletionOptions = { model: "claude-3-5-sonnet" }) {
    if (options.api && options.api !== "completions") {
      throw new Error("Snowflake Cortex native provider supports only the Chat Completions API");
    }
    const apiKey = SnowflakeCompletion.resolveToken(options.apiKey ?? options.api_key ?? null);
    const accountUrl = SnowflakeCompletion.resolveBaseUrl(options);
    super({
      ...options,
      provider: "snowflake",
      api: "completions",
      apiKey,
      api_key: apiKey,
      baseUrl: accountUrl,
      base_url: accountUrl,
    });
    this.accountUrl = accountUrl;
    this.account_url = accountUrl;
    this.accountIdentifier = options.accountIdentifier
      ?? options.account_identifier
      ?? options.account
      ?? options.snowflakeAccount
      ?? options.snowflake_account
      ?? null;
    this.account_identifier = this.accountIdentifier;
    this.database = options.database ?? null;
    this.schemaName = options.schemaName ?? options.schema_name ?? null;
    this.schema_name = this.schemaName;
    this.warehouse = options.warehouse ?? null;
    this.role = options.role ?? null;
  }

  static normalizeSnowflakeBaseUrl(value: string): string {
    let baseUrl = value.trim().replace(/\/+$/u, "");
    if (baseUrl.length === 0) {
      throw new Error("Snowflake account URL cannot be empty");
    }
    if (!baseUrl.includes("://")) {
      baseUrl = `https://${baseUrl}`;
    }
    if (baseUrl.endsWith(SNOWFLAKE_CORTEX_PATH)) {
      return baseUrl;
    }
    if (baseUrl.includes("/api/v2/cortex")) {
      throw new Error(
        `Snowflake base URL must be the account URL or Cortex API root ending in ${SNOWFLAKE_CORTEX_PATH}; do not include endpoint paths.`,
      );
    }
    return `${baseUrl}${SNOWFLAKE_CORTEX_PATH}`;
  }

  static _normalize_snowflake_base_url(value: string): string {
    return SnowflakeCompletion.normalizeSnowflakeBaseUrl(value);
  }

  static baseUrlFromAccountIdentifier(accountIdentifier: string): string {
    const account = accountIdentifier.trim();
    if (account.length === 0) {
      throw new Error("Snowflake account identifier cannot be empty");
    }
    return SnowflakeCompletion.normalizeSnowflakeBaseUrl(`${account}.snowflakecomputing.com`);
  }

  static _base_url_from_account_identifier(accountIdentifier: string): string {
    return SnowflakeCompletion.baseUrlFromAccountIdentifier(accountIdentifier);
  }

  static resolveToken(apiKey: string | null | undefined): string {
    let token = apiKey ?? null;
    if (!token) {
      for (const envVar of SNOWFLAKE_TOKEN_ENV_VARS) {
        token = process.env[envVar] ?? null;
        if (token) {
          break;
        }
      }
    }
    if (!token) {
      throw new Error("Snowflake token is required. Set SNOWFLAKE_PAT, SNOWFLAKE_TOKEN, or SNOWFLAKE_JWT, or pass api_key.");
    }
    return token.startsWith("pat/") ? token.slice(4) : token;
  }

  static _resolve_token(apiKey: string | null | undefined): string {
    return SnowflakeCompletion.resolveToken(apiKey);
  }

  static resolveBaseUrl(data: SnowflakeCompletionOptions): string {
    const explicitBaseUrl = data.baseUrl ?? data.base_url ?? data.apiBase ?? data.api_base ?? null;
    if (explicitBaseUrl) {
      return SnowflakeCompletion.normalizeSnowflakeBaseUrl(explicitBaseUrl);
    }
    const accountUrl = data.accountUrl ?? data.account_url ?? process.env.SNOWFLAKE_ACCOUNT_URL ?? null;
    if (accountUrl) {
      return SnowflakeCompletion.normalizeSnowflakeBaseUrl(accountUrl);
    }
    const accountIdentifier = data.accountIdentifier
      ?? data.account_identifier
      ?? data.account
      ?? data.snowflakeAccount
      ?? data.snowflake_account
      ?? process.env.SNOWFLAKE_ACCOUNT
      ?? process.env.SNOWFLAKE_ACCOUNT_ID
      ?? process.env.SNOWFLAKE_ACCOUNT_IDENTIFIER
      ?? null;
    if (accountIdentifier) {
      return SnowflakeCompletion.baseUrlFromAccountIdentifier(accountIdentifier);
    }
    throw new Error(
      "Snowflake account URL is required. Set SNOWFLAKE_ACCOUNT_URL or SNOWFLAKE_ACCOUNT, or pass account_url/base_url/account_identifier.",
    );
  }

  static _resolve_base_url(data: SnowflakeCompletionOptions): string {
    return SnowflakeCompletion.resolveBaseUrl(data);
  }

  override formatMessages(messages: LLMMessageInput): LLMMessage[] {
    let formattedMessages = SnowflakeCompletion.hasProviderContentBlocks(messages)
      ? SnowflakeCompletion.formatProviderContentBlockMessages(messages)
      : super.formatMessages(messages);
    if (!this.isClaudeModel()) {
      return formattedMessages;
    }
    formattedMessages = SnowflakeCompletion.normalizeStringifiedToolCalls(formattedMessages);
    formattedMessages = SnowflakeCompletion.removeIncompleteClaudeToolUses(formattedMessages);
    return SnowflakeCompletion.ensureClaudeConversationEndsWithUser(formattedMessages);
  }

  override _format_messages(messages: LLMMessageInput): LLMMessage[] {
    return this.formatMessages(messages);
  }

  static hasProviderContentBlocks(messages: LLMMessageInput): boolean {
    return Array.isArray(messages) && messages.some((message) => !Array.isArray(message) && Array.isArray(readObject(message).content));
  }

  static formatProviderContentBlockMessages(messages: LLMMessageInput): LLMMessage[] {
    if (typeof messages === "string") {
      return [{ role: "user", content: messages }];
    }
    return messages.map((message, index) => {
      if (Array.isArray(message)) {
        throw new Error(`Message at index ${String(index)} must be a dictionary.`);
      }
      if (!LLM_ROLES.has(String(message.role)) || (typeof message.content !== "string" && !Array.isArray(message.content))) {
        throw new Error(`Message at index ${String(index)} must have 'role' and 'content' keys.`);
      }
      const copy = { ...message };
      stripCacheBreakpoint(copy);
      return copy as LLMMessage;
    });
  }

  isClaudeModel(): boolean {
    const model = this.model.toLowerCase();
    return model.startsWith("claude-") || model.startsWith("anthropic.");
  }

  _is_claude_model(): boolean {
    return this.isClaudeModel();
  }

  static normalizeStringifiedToolCalls(messages: readonly LLMMessage[]): LLMMessage[] {
    return messages.map((message) => {
      const toolCalls = readObject(message).tool_calls;
      if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
        return { ...message };
      }
      let changed = false;
      const normalizedToolCalls: unknown[] = [];
      for (const toolCall of toolCalls) {
        if (typeof toolCall !== "string") {
          normalizedToolCalls.push(toolCall);
          continue;
        }
        const parsed = parsePythonishObjectLiteral(toolCall);
        if (parsed !== null) {
          changed = true;
          normalizedToolCalls.push(parsed);
          continue;
        }
        normalizedToolCalls.push(toolCall);
      }
      return changed
        ? { ...message, tool_calls: normalizedToolCalls } as LLMMessage
        : { ...message };
    });
  }

  static _normalize_stringified_tool_calls(messages: readonly LLMMessage[]): LLMMessage[] {
    return SnowflakeCompletion.normalizeStringifiedToolCalls(messages);
  }

  static removeIncompleteClaudeToolUses(messages: readonly LLMMessage[]): LLMMessage[] {
    const sanitized: LLMMessage[] = [];
    let index = 0;

    while (index < messages.length) {
      const message = messages[index] as LLMMessage & Record<string, unknown>;
      const expectedIds = SnowflakeCompletion.extractClaudeToolUseIds(message);
      if (message.role !== "assistant" || expectedIds.size === 0) {
        sanitized.push({ ...message });
        index += 1;
        continue;
      }

      const toolResultIds = new Set<string>();
      let lookahead = index + 1;
      while (lookahead < messages.length && SnowflakeCompletion.isToolResultMessage(messages[lookahead] as LLMMessage & Record<string, unknown>)) {
        for (const id of SnowflakeCompletion.extractClaudeToolResultIds(messages[lookahead] as LLMMessage & Record<string, unknown>)) {
          toolResultIds.add(id);
        }
        lookahead += 1;
      }

      if ([...expectedIds].every((id) => toolResultIds.has(id))) {
        const summary = SnowflakeCompletion.summarizeToolResults(messages.slice(index + 1, lookahead), expectedIds);
        if (summary) {
          sanitized.push({ role: "user", content: summary });
        }
      }

      index = lookahead;
    }

    return sanitized;
  }

  static _remove_incomplete_claude_tool_uses(messages: readonly LLMMessage[]): LLMMessage[] {
    return SnowflakeCompletion.removeIncompleteClaudeToolUses(messages);
  }

  static summarizeToolResults(messages: readonly LLMMessage[], expectedIds: Set<string>): string {
    const summaries: string[] = [];
    for (const message of messages) {
      const resultIds = SnowflakeCompletion.extractClaudeToolResultIds(message);
      if (![...resultIds].some((id) => expectedIds.has(id))) {
        continue;
      }
      const name = scalarToString(readObject(message).name) ?? "tool";
      const content = readObject(message).content;
      if (typeof content === "string") {
        summaries.push(`${name}: ${content}`);
      } else if (Array.isArray(content)) {
        const extractedText = SnowflakeCompletion.extractToolResultText(content, expectedIds);
        summaries.push(`${name}: ${extractedText || String(content)}`);
      }
    }
    return summaries.length === 0
      ? ""
      : `Tool results from previous tool calls:\n${summaries.map((summary) => `- ${summary}`).join("\n")}`;
  }

  static _summarize_tool_results(messages: readonly LLMMessage[], expectedIds: Set<string>): string {
    return SnowflakeCompletion.summarizeToolResults(messages, expectedIds);
  }

  static extractToolResultText(content: readonly unknown[], expectedIds: Set<string> | null = null): string {
    const texts: string[] = [];
    for (const item of content) {
      const toolResult = readObject(readObject(item).toolResult);
      const toolUseId = scalarToString(toolResult.toolUseId);
      if (expectedIds && (toolUseId === null || !expectedIds.has(toolUseId))) {
        continue;
      }
      const resultContent = toolResult.content;
      if (!Array.isArray(resultContent)) {
        continue;
      }
      for (const inner of resultContent) {
        const text = scalarToString(readObject(inner).text);
        if (text !== null) {
          texts.push(text);
        }
      }
    }
    return texts.join(" ");
  }

  static _extract_tool_result_text(content: readonly unknown[]): string {
    return SnowflakeCompletion.extractToolResultText(content);
  }

  static extractClaudeToolUseIds(message: LLMMessage & Record<string, unknown>): Set<string> {
    const ids = new Set<string>();
    const toolCalls = message.tool_calls;
    if (Array.isArray(toolCalls)) {
      for (const toolCall of toolCalls) {
        const id = scalarToString(readObject(toolCall).id);
        if (id !== null) {
          ids.add(id);
        }
      }
    }
    const content = message.content;
    if (Array.isArray(content)) {
      for (const block of content) {
        const toolUseId = scalarToString(readObject(readObject(block).toolUse).toolUseId);
        if (toolUseId !== null) {
          ids.add(toolUseId);
        }
      }
    }
    return ids;
  }

  static _extract_claude_tool_use_ids(message: LLMMessage & Record<string, unknown>): Set<string> {
    return SnowflakeCompletion.extractClaudeToolUseIds(message);
  }

  static extractClaudeToolResultIds(message: LLMMessage & Record<string, unknown>): Set<string> {
    const ids = new Set<string>();
    const toolCallId = scalarToString(message.tool_call_id);
    if (toolCallId !== null) {
      ids.add(toolCallId);
    }
    const content = message.content;
    if (Array.isArray(content)) {
      for (const block of content) {
        const toolUseId = scalarToString(readObject(readObject(block).toolResult).toolUseId);
        if (toolUseId !== null) {
          ids.add(toolUseId);
        }
      }
    }
    return ids;
  }

  static _extract_claude_tool_result_ids(message: LLMMessage & Record<string, unknown>): Set<string> {
    return SnowflakeCompletion.extractClaudeToolResultIds(message);
  }

  static isToolResultMessage(message: LLMMessage & Record<string, unknown>): boolean {
    return message.role === "tool" || SnowflakeCompletion.extractClaudeToolResultIds(message).size > 0;
  }

  static _is_tool_result_message(message: LLMMessage & Record<string, unknown>): boolean {
    return SnowflakeCompletion.isToolResultMessage(message);
  }

  static ensureClaudeConversationEndsWithUser(messages: readonly LLMMessage[]): LLMMessage[] {
    if (messages.length === 0) {
      return [{ role: "user", content: "Hello" }];
    }
    let normalizedMessages = [...messages];
    const lastMessage = normalizedMessages.at(-1) as (LLMMessage & Record<string, unknown>) | undefined;
    if (lastMessage?.role === "assistant" && !lastMessage.tool_calls) {
      normalizedMessages = normalizedMessages.slice(0, -1);
    }
    if (normalizedMessages.length === 0) {
      return [{ role: "user", content: "Hello" }];
    }
    if (normalizedMessages.at(-1)?.role === "user") {
      return normalizedMessages.map((message) => ({ ...message }));
    }
    return [
      ...normalizedMessages.map((message) => ({ ...message })),
      { role: "user", content: "Please continue and provide your final answer." },
    ];
  }

  static _ensure_claude_conversation_ends_with_user(messages: readonly LLMMessage[]): LLMMessage[] {
    return SnowflakeCompletion.ensureClaudeConversationEndsWithUser(messages);
  }

  override prepareCompletionParams(messages: readonly LLMMessage[], tools: readonly Tool[] | null = null): Record<string, unknown> {
    const params = super.prepareCompletionParams(messages, tools);
    if (this.isClaudeModel() && "max_tokens" in params) {
      params.max_completion_tokens = params.max_tokens;
      delete params.max_tokens;
    }
    return params;
  }

  override _prepare_completion_params(messages: readonly LLMMessage[], tools: readonly Tool[] | null = null): Record<string, unknown> {
    return this.prepareCompletionParams(messages, tools);
  }

  getSyncClient(env: NodeJS.ProcessEnv = process.env): Record<string, unknown> {
    void env;
    const endpoint = `${this.accountUrl.replace(/\/+$/u, "")}/chat/completions`;
    const token = this.api_key ?? "";
    return {
      chat: {
        completions: {
          create: async (params: Record<string, unknown>) => {
            const response = await fetch(endpoint, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(params),
              ...(this.timeout === null ? {} : { signal: AbortSignal.timeout(this.timeout * 1000) }),
            });
            if (!response.ok) {
              throw new Error(`Snowflake completion request failed with status ${String(response.status)}.`);
            }
            return await response.json();
          },
        },
      },
    };
  }

  _get_sync_client(env: NodeJS.ProcessEnv = process.env): Record<string, unknown> {
    return this.getSyncClient(env);
  }

  override async call(messages: readonly LLMMessage[], options?: LLMCallOptions): Promise<LLMResponse> {
    const tools = options?.tools as readonly Tool[] | undefined;
    const params = this.prepareCompletionParams(this.formatMessages(messages), tools ?? null);
    const client = this._get_sync_client();
    const completions = readObject(readObject(readObject(client).chat).completions);
    const create = completions.create;
    if (!isCompletionCreate(create)) {
      throw new Error("Snowflake OpenAI-compatible client is missing chat.completions.create.");
    }
    const response = await create(params);
    this.trackTokenUsageInternal(this.extractOpenAITokenUsage(response));

    const choices = readObject(response).choices;
    const firstChoice = Array.isArray(choices) ? readObject(choices[0]) : {};
    const content = readObject(firstChoice.message).content;
    return typeof content === "string" ? content : "";
  }

  override supportsFunctionCalling(): boolean {
    const model = this.model.toLowerCase();
    return model.startsWith("openai-") || model.startsWith("claude-") || model.startsWith("anthropic.");
  }

  override supports_function_calling(): boolean {
    return this.supportsFunctionCalling();
  }

  override supportsMultimodal(): boolean {
    const model = this.model.toLowerCase();
    return model.startsWith("openai-") || model.startsWith("claude-") || model.startsWith("anthropic.");
  }

  override supports_multimodal(): boolean {
    return this.supportsMultimodal();
  }

  override toConfigDict(): Record<string, unknown> {
    return {
      ...super.toConfigDict(),
      account_url: this.accountUrl,
      account_identifier: this.accountIdentifier,
      database: this.database,
      schema_name: this.schemaName,
      warehouse: this.warehouse,
      role: this.role,
    };
  }

  override to_config_dict(): Record<string, unknown> {
    return this.toConfigDict();
  }
}

export function registerSnowflakeProvider(): void {
  registerLLMProviderFactory("snowflake", (options) => new SnowflakeCompletion(options as SnowflakeCompletionOptions));
}

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function scalarToString(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

function parsePythonishObjectLiteral(value: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    // Fall through to a narrow Python dict-literal compatibility parser.
  }
  try {
    const normalized = value
      .replace(/\bNone\b/gu, "null")
      .replace(/\bTrue\b/gu, "true")
      .replace(/\bFalse\b/gu, "false")
      .replace(/'((?:\\.|[^'\\])*)'/gu, (_match, inner: string) => JSON.stringify(inner.replace(/\\'/gu, "'")));
    const parsed: unknown = JSON.parse(normalized);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function isCompletionCreate(value: unknown): value is (params: Record<string, unknown>) => unknown {
  return typeof value === "function";
}
