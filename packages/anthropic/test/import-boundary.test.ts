import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { ConfiguredLLM, createLLM } from "@crewai-ts/core/llm";
import {
  AnthropicCompletion,
  registerAnthropicProvider,
} from "../src/index.js";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const anthropicPackage = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

describe("@crewai-ts/anthropic import boundary", () => {
  it("exposes Anthropic without optional feature dependencies", () => {
    const allDependencies = {
      ...anthropicPackage.dependencies,
      ...anthropicPackage.peerDependencies,
      ...anthropicPackage.optionalDependencies,
    };

    expect(allDependencies).toHaveProperty("@crewai-ts/core");
    expect(allDependencies).not.toHaveProperty("@crewai-ts/openai");
    expect(allDependencies).not.toHaveProperty("@crewai-ts/bedrock");
    expect(allDependencies).not.toHaveProperty("@crewai-ts/gemini");
    expect(allDependencies).not.toHaveProperty("pdf-parse");
    expect(allDependencies).not.toHaveProperty("@modelcontextprotocol/sdk");
    expect(allDependencies).not.toHaveProperty("@crewai-ts/rag");
    expect(allDependencies).not.toHaveProperty("@crewai-ts/mcp");
    expect(allDependencies).not.toHaveProperty("@crewai-ts/a2a");
    expect(allDependencies).not.toHaveProperty("@crewai-ts/flow");
  });

  it("can instantiate and register Anthropic providers", () => {
    const before = createLLM("anthropic/claude-3-5-sonnet-20241022");
    expect(before).toBeInstanceOf(ConfiguredLLM);

    registerAnthropicProvider();

    const anthropic = createLLM("anthropic/claude-3-5-sonnet-20241022");
    const claudeAlias = createLLM("claude/claude-3-haiku-20240307");

    expect(anthropic).toBeInstanceOf(AnthropicCompletion);
    expect((anthropic as AnthropicCompletion).provider).toBe("anthropic");
    expect((anthropic as AnthropicCompletion).model).toBe("claude-3-5-sonnet-20241022");
    expect(claudeAlias).toBeInstanceOf(AnthropicCompletion);
    expect((claudeAlias as AnthropicCompletion).provider).toBe("anthropic");
    expect((claudeAlias as AnthropicCompletion).model).toBe("claude-3-haiku-20240307");
  });
});
