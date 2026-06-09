import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createLLM } from "@crewai-ts/core/llm";
import {
  OpenAICompatibleCompletion,
  OpenAICompletion,
  OPENAI_COMPATIBLE_PROVIDERS,
  registerOpenAIProvider,
} from "../src/index.js";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const openaiPackage = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

describe("@crewai-ts/openai import boundary", () => {
  it("exposes OpenAI without optional feature dependencies", () => {
    const allDependencies = {
      ...openaiPackage.dependencies,
      ...openaiPackage.peerDependencies,
      ...openaiPackage.optionalDependencies,
    };

    expect(allDependencies).toHaveProperty("@crewai-ts/core");
    expect(allDependencies).not.toHaveProperty("pdf-parse");
    expect(allDependencies).not.toHaveProperty("@modelcontextprotocol/sdk");
    expect(allDependencies).not.toHaveProperty("@crewai-ts/rag");
    expect(allDependencies).not.toHaveProperty("@crewai-ts/mcp");
    expect(allDependencies).not.toHaveProperty("@crewai-ts/a2a");
    expect(allDependencies).not.toHaveProperty("@crewai-ts/flow");
    expect(allDependencies).not.toHaveProperty("@crewai-ts/gemini");
  });

  it("can instantiate and register OpenAI providers", () => {
    registerOpenAIProvider();

    const openai = createLLM("gpt-4o");
    const openRouter = createLLM({ model: "openrouter/openai/gpt-4o", api_key: "test-key" });

    expect(openai).toBeInstanceOf(OpenAICompletion);
    expect((openai as OpenAICompletion).provider).toBe("openai");
    expect((openai as OpenAICompletion).model).toBe("gpt-4o");
    expect(openRouter).toBeInstanceOf(OpenAICompatibleCompletion);
    expect((openRouter as OpenAICompatibleCompletion).provider).toBe("openrouter");
    expect(OPENAI_COMPATIBLE_PROVIDERS).toHaveProperty("openrouter");
  });
});
