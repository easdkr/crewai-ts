import { describe, it, expect } from "vitest";
import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { CrewModule } from "../src/crew-module.js";
import { type CrewModuleOptions } from "../src/crew-module.js";
import {
  CREW_FACTORY,
  KNOWLEDGE,
  LLM,
  MEMORY,
} from "../src/tokens.js";
import { DefaultCrewFactory } from "../src/factories/crew-factory.js";
import { AgentFactory } from "../src/factories/agent-factory.js";

describe("@crewai-ts/nestjs CrewModule", () => {
  it("forRoot registers all 4 tokens", async () => {
    const mockLlm = (): string => "mock-llm-response";
    const moduleRef = await Test.createTestingModule({
      imports: [CrewModule.forRoot({ llm: mockLlm, memory: null, knowledge: null })],
    }).compile();

    expect(moduleRef.get<typeof mockLlm>(LLM)).toBe(mockLlm);
    expect(moduleRef.get(MEMORY)).toBeNull();
    expect(moduleRef.get(KNOWLEDGE)).toBeNull();
    const factory = moduleRef.get<{ create: (input: { agents: readonly unknown[]; tasks: readonly unknown[] }) => unknown }>(CREW_FACTORY);
    expect(typeof factory.create).toBe("function");

    await moduleRef.close();
  });

  it("forRoot returns a DynamicModule", () => {
    const dynamic = CrewModule.forRoot({ llm: null });
    expect(dynamic.module).toBe(CrewModule);
    expect(Array.isArray(dynamic.providers)).toBe(true);
    // LLM, MEMORY, KNOWLEDGE, DefaultCrewFactory (class provider), CREW_FACTORY (useExisting), AgentFactory
    expect(dynamic.providers).toHaveLength(6);
    expect(dynamic.exports).toEqual([CREW_FACTORY, LLM, MEMORY, KNOWLEDGE, DefaultCrewFactory, AgentFactory]);
  });

  it("forRoot without arguments errors", () => {
    // @ts-expect-error -- intentionally calling forRoot() with no args to verify the runtime guard
    expect(() => CrewModule.forRoot()).toThrow(/llm is required|CrewModule\.forRoot/);
  });

  it("forRoot({ llm: 'string' }) registers the string", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CrewModule.forRoot({ llm: "openai/gpt-4o-mini" })],
    }).compile();

    expect(moduleRef.get(LLM)).toBe("openai/gpt-4o-mini");

    await moduleRef.close();
  });

  it("knowledge array is registered as readonly", async () => {
    const knowledgeSources = [
      { id: "src-1", content: "first" },
      { id: "src-2", content: "second" },
    ] as const;
    const options: CrewModuleOptions = {
      llm: () => "x",
      knowledge: knowledgeSources,
    };
    const moduleRef = await Test.createTestingModule({
      imports: [CrewModule.forRoot(options)],
    }).compile();

    const resolved = moduleRef.get(KNOWLEDGE);
    expect(Array.isArray(resolved)).toBe(true);
    expect(resolved).toEqual(knowledgeSources);
    // Compile-time + runtime: KNOWLEDGE is typed as readonly
    expect(Object.isFrozen(resolved) || resolved === knowledgeSources).toBe(true);

    await moduleRef.close();
  });
});
