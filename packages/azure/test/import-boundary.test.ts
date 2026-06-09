import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { ConfiguredLLM, createLLM } from "@crewai-ts/core/llm";
import { AzureCompletion, registerAzureProvider } from "../src/index.js";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const azurePackage = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

describe("@crewai-ts/azure import boundary", () => {
  it("exposes Azure without optional feature dependencies", () => {
    const allDependencies = {
      ...azurePackage.dependencies,
      ...azurePackage.peerDependencies,
      ...azurePackage.optionalDependencies,
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

  it("can instantiate and register the Azure provider", () => {
    const before = createLLM("azure/gpt-4o");
    expect(before).toBeInstanceOf(ConfiguredLLM);

    registerAzureProvider();

    const registered = createLLM({
      model: "azure/gpt-4o",
      api_key: "azure-key",
      endpoint: "https://example.openai.azure.com/openai/deployments/gpt-4o",
    });

    expect(registered).toBeInstanceOf(AzureCompletion);
    expect((registered as AzureCompletion).provider).toBe("azure");
    expect((registered as AzureCompletion).model).toBe("gpt-4o");
  });
});
