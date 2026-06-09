import { describe, expect, it, vi } from "vitest";

import type { LLMMessage } from "@crewai-ts/core/types";
import { SnowflakeCompletion } from "../src/index.js";

describe("SnowflakeCompletion", () => {
  it("normalizes account URLs and tokens", () => {
    expect(SnowflakeCompletion._normalize_snowflake_base_url("org-account.snowflakecomputing.com"))
      .toBe("https://org-account.snowflakecomputing.com/api/v2/cortex/v1");
    expect(SnowflakeCompletion._base_url_from_account_identifier("org-account"))
      .toBe("https://org-account.snowflakecomputing.com/api/v2/cortex/v1");
    expect(SnowflakeCompletion._resolve_token("pat/token")).toBe("token");
    expect(() => SnowflakeCompletion._normalize_snowflake_base_url("https://host/api/v2/cortex/other"))
      .toThrow("Snowflake base URL");
  });

  it("formats Claude tool-call conversations for Cortex", () => {
    const snowflake = new SnowflakeCompletion({
      model: "claude-3-5-sonnet",
      api_key: "token",
      account_identifier: "org-account",
    });
    const formatted = snowflake.formatMessages([
      {
        role: "assistant",
        content: "Calling tool",
        tool_calls: ["{'id': 'tool-1', 'function': {'name': 'lookup'}}"],
      } as LLMMessage & Record<string, unknown>,
      {
        role: "tool",
        content: [{ toolResult: { toolUseId: "tool-1", content: [{ text: "found" }] } }],
      } as unknown as LLMMessage,
    ]);

    expect(formatted).toEqual([{ role: "user", content: "Tool results from previous tool calls:\n- tool: found" }]);
  });

  it("calls Snowflake Cortex through fetch and tracks usage", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: "snowflake ok" } }],
        usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
      }),
    } as Response);

    try {
      const snowflake = new SnowflakeCompletion({
        model: "openai-gpt-4.1",
        api_key: "pat/token",
        account_identifier: "org-account",
      });

      await expect(snowflake.call([{ role: "user", content: "hello" }])).resolves.toBe("snowflake ok");
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://org-account.snowflakecomputing.com/api/v2/cortex/v1/chat/completions");
      expect(init.method).toBe("POST");
      expect(init.headers).toMatchObject({
        Authorization: "Bearer token",
        "Content-Type": "application/json",
      });
      expect(snowflake.get_token_usage_summary()).toMatchObject({
        promptTokens: 3,
        completionTokens: 2,
        totalTokens: 5,
        successfulRequests: 1,
      });
    } finally {
      fetchMock.mockRestore();
    }
  });
});
