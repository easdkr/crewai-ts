import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createLLM } from "@crewai-ts/core/llm";
import { GEMINI_MODELS, GeminiCompletion, registerGeminiProvider } from "../src/index.js";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const geminiPackage = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

describe("@crewai-ts/gemini import boundary", () => {
  it("exposes Gemini without optional feature dependencies", () => {
    const allDependencies = {
      ...geminiPackage.dependencies,
      ...geminiPackage.peerDependencies,
      ...geminiPackage.optionalDependencies,
    };

    expect(allDependencies).toHaveProperty("@crewai-ts/core");
    expect(allDependencies).not.toHaveProperty("pdf-parse");
    expect(allDependencies).not.toHaveProperty("@modelcontextprotocol/sdk");
    expect(allDependencies).not.toHaveProperty("@crewai-ts/rag");
    expect(allDependencies).not.toHaveProperty("@crewai-ts/mcp");
    expect(allDependencies).not.toHaveProperty("@crewai-ts/a2a");
    expect(allDependencies).not.toHaveProperty("@crewai-ts/flow");
  });

  it("can instantiate and register the Gemini provider", () => {
    registerGeminiProvider();

    const llm = new GeminiCompletion({ model: "gemini-2.5-flash", api_key: "test-key" });
    const registered = createLLM("gemini/gemini-2.5-flash");
    const googleAlias = createLLM("google/gemini-2.0-flash-001");

    expect(llm.provider).toBe("gemini");
    expect(llm.model).toBe("gemini-2.5-flash");
    expect(llm.supportsFunctionCalling()).toBe(true);
    expect(registered).toBeInstanceOf(GeminiCompletion);
    expect(googleAlias).toBeInstanceOf(GeminiCompletion);
    expect((googleAlias as GeminiCompletion).model).toBe("gemini-2.0-flash-001");
    expect((googleAlias as GeminiCompletion).provider).toBe("gemini");
    expect(GEMINI_MODELS).toContain("gemini-2.5-flash");
    expect(GEMINI_MODELS).toContain("gemini-1.5-pro");
    expect(GEMINI_MODELS).toContain("learnlm-2.0-flash-experimental");
  });
});
