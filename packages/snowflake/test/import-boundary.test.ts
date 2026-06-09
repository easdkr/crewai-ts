import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { ConfiguredLLM, createLLM } from "@crewai-ts/core/llm";
import {
  SNOWFLAKE_CORTEX_PATH,
  SNOWFLAKE_TOKEN_ENV_VARS,
  SnowflakeCompletion,
  registerSnowflakeProvider,
} from "../src/index.js";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const snowflakePackage = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

describe("@crewai-ts/snowflake import boundary", () => {
  it("exposes Snowflake without optional feature dependencies", () => {
    const allDependencies = {
      ...snowflakePackage.dependencies,
      ...snowflakePackage.peerDependencies,
      ...snowflakePackage.optionalDependencies,
    };

    expect(allDependencies).toHaveProperty("@crewai-ts/core");
    expect(allDependencies).toHaveProperty("@crewai-ts/openai");
    expect(allDependencies).not.toHaveProperty("pdf-parse");
    expect(allDependencies).not.toHaveProperty("@modelcontextprotocol/sdk");
    expect(allDependencies).not.toHaveProperty("@crewai-ts/rag");
    expect(allDependencies).not.toHaveProperty("@crewai-ts/mcp");
    expect(allDependencies).not.toHaveProperty("@crewai-ts/a2a");
    expect(allDependencies).not.toHaveProperty("@crewai-ts/flow");
    expect(allDependencies).not.toHaveProperty("@crewai-ts/gemini");
  });

  it("can instantiate and register the Snowflake provider", () => {
    const previousPat = process.env.SNOWFLAKE_PAT;
    const previousAccount = process.env.SNOWFLAKE_ACCOUNT_IDENTIFIER;
    const before = createLLM("snowflake/claude-3-5-sonnet");
    expect(before).toBeInstanceOf(ConfiguredLLM);

    try {
      process.env.SNOWFLAKE_PAT = "pat/test-token";
      process.env.SNOWFLAKE_ACCOUNT_IDENTIFIER = "org-account";
      registerSnowflakeProvider();

      const llm = new SnowflakeCompletion({
        model: "claude-3-5-sonnet",
        api_key: "pat/test-token",
        account_identifier: "org-account",
        database: "APP_DB",
        schema_name: "PUBLIC",
        warehouse: "COMPUTE_WH",
        role: "APP_ROLE",
      });
      const registered = createLLM("snowflake/claude-3-5-sonnet");

      expect(SNOWFLAKE_CORTEX_PATH).toBe("/api/v2/cortex/v1");
      expect(SNOWFLAKE_TOKEN_ENV_VARS).toEqual(["SNOWFLAKE_PAT", "SNOWFLAKE_TOKEN", "SNOWFLAKE_JWT"]);
      expect(llm.provider).toBe("snowflake");
      expect(llm.api_key).toBe("test-token");
      expect(llm.account_url).toBe("https://org-account.snowflakecomputing.com/api/v2/cortex/v1");
      expect(llm.to_config_dict()).toMatchObject({
        provider: "snowflake",
        model: "claude-3-5-sonnet",
        account_url: "https://org-account.snowflakecomputing.com/api/v2/cortex/v1",
        account_identifier: "org-account",
        database: "APP_DB",
        schema_name: "PUBLIC",
        warehouse: "COMPUTE_WH",
        role: "APP_ROLE",
      });
      expect(registered).toBeInstanceOf(SnowflakeCompletion);
      expect((registered as SnowflakeCompletion).model).toBe("claude-3-5-sonnet");
    } finally {
      if (previousPat === undefined) delete process.env.SNOWFLAKE_PAT;
      else process.env.SNOWFLAKE_PAT = previousPat;
      if (previousAccount === undefined) delete process.env.SNOWFLAKE_ACCOUNT_IDENTIFIER;
      else process.env.SNOWFLAKE_ACCOUNT_IDENTIFIER = previousAccount;
    }
  });
});
