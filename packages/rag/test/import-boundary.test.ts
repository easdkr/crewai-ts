import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createRegisteredMemory, createRegisteredMemoryTools } from "@crewai-ts/core/feature-hooks";

import {
  Knowledge,
  Memory,
  PDFKnowledgeSource,
  createRagClient,
  registerRagClientFactory,
  unregisterRagClientFactory,
} from "../src/index.js";

type PackageJson = {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const packageJson = JSON.parse(
  readFileSync(join(import.meta.dirname, "..", "package.json"), "utf8"),
) as PackageJson;

describe("@crewai-ts/rag import boundary", () => {
  it("owns RAG/PDF dependencies without pulling provider or protocol packages", () => {
    const allDependencies = {
      ...packageJson.dependencies,
      ...packageJson.peerDependencies,
    };

    expect(allDependencies).toHaveProperty("@crewai-ts/core");
    expect(allDependencies).toHaveProperty("pdf-parse");
    expect(allDependencies).not.toHaveProperty("@modelcontextprotocol/sdk");
    expect(allDependencies).not.toHaveProperty("@crewai-ts/mcp");
    expect(allDependencies).not.toHaveProperty("@crewai-ts/gemini");
    expect(allDependencies).not.toHaveProperty("@crewai-ts/openai");
    expect(allDependencies).not.toHaveProperty("@crewai-ts/anthropic");
    expect(allDependencies).not.toHaveProperty("@crewai-ts/bedrock");
    expect(allDependencies).not.toHaveProperty("@crewai-ts/azure");
  });

  it("exports knowledge, memory, and RAG factories", () => {
    expect(Knowledge).toBeTypeOf("function");
    expect(Memory).toBeTypeOf("function");
    expect(PDFKnowledgeSource).toBeTypeOf("function");
    expect(createRagClient).toBeTypeOf("function");
  });

  it("registers memory hooks with core when the package is imported", () => {
    const memory = createRegisteredMemory();
    expect(memory).toBeInstanceOf(Memory);
    expect(createRegisteredMemoryTools(memory as Memory)).toHaveLength(2);
  });

  it("creates RAG clients through package-owned factories", () => {
    registerRagClientFactory("chromadb", (config) => ({
      provider: "chromadb",
      config,
      save: () => undefined,
      asave: async () => undefined,
      search: () => [],
      asearch: async () => [],
    }));
    try {
      const client = createRagClient({ provider: "chromadb", database: "docs" }) as {
        provider: string;
        config: Record<string, unknown>;
      };
      expect(client.provider).toBe("chromadb");
      expect(client.config).toMatchObject({ database: "docs" });
    } finally {
      unregisterRagClientFactory("chromadb");
    }
  });
});
