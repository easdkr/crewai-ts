import { registerRagFeatureHooks } from "@crewai-ts/core/feature-hooks";
import { Knowledge, defaultPDFTextExtractorAsync, type KnowledgeOptions } from "./knowledge.js";
import { Memory, MemoryScope, type MemorySlice, createMemoryTools } from "./memory.js";

export * from "./rag.js";
export * from "./knowledge.js";
export * from "./memory.js";

registerRagFeatureHooks({
  createMemory: (options) => new Memory(options),
  createKnowledge: (options) => new Knowledge(options as KnowledgeOptions),
  createMemoryTools: (memory) => createMemoryTools(memory as Memory | MemoryScope | MemorySlice),
  extractPDFText: (content) => defaultPDFTextExtractorAsync(Buffer.from(content)),
  isMemory: (value): value is Memory => value instanceof Memory,
  isMemoryScope: (value): value is MemoryScope => value instanceof MemoryScope,
  isKnowledge: (value): value is Knowledge => value instanceof Knowledge,
  bindMemoryView: (value, backing) => {
    if (!value || typeof value !== "object" || value instanceof Memory) {
      return;
    }
    const bind = (value as { bind?: unknown }).bind;
    if (typeof bind === "function") {
      bind.call(value, backing);
    }
  },
});
