import { describe, it, expect } from "vitest";
import { CREW_FACTORY, LLM, MEMORY, KNOWLEDGE } from "../src/tokens.js";
import type {
  CrewFactoryToken,
  LLMToken,
  MemoryToken,
  KnowledgeToken,
} from "../src/tokens.js";

describe("@crewai-ts/nestjs tokens", () => {
  it("CREW_FACTORY is a symbol with the expected name", () => {
    expect(typeof CREW_FACTORY).toBe("symbol");
    expect(CREW_FACTORY.toString()).toContain("crewai-ts/CREW_FACTORY");
    // compile-time: token TYPE alias is assignable from the runtime symbol
    const token: CrewFactoryToken = CREW_FACTORY;
    expect(token).toBe(CREW_FACTORY);
  });

  it("LLM is a symbol with the expected name", () => {
    expect(typeof LLM).toBe("symbol");
    expect(LLM.toString()).toContain("crewai-ts/LLM");
    const token: LLMToken = LLM;
    expect(token).toBe(LLM);
  });

  it("MEMORY is a symbol with the expected name", () => {
    expect(typeof MEMORY).toBe("symbol");
    expect(MEMORY.toString()).toContain("crewai-ts/MEMORY");
    const token: MemoryToken = MEMORY;
    expect(token).toBe(MEMORY);
  });

  it("KNOWLEDGE is a symbol with the expected name", () => {
    expect(typeof KNOWLEDGE).toBe("symbol");
    expect(KNOWLEDGE.toString()).toContain("crewai-ts/KNOWLEDGE");
    const token: KnowledgeToken = KNOWLEDGE;
    expect(token).toBe(KNOWLEDGE);
  });
});
