import { describe, it, expect } from "vitest";
import "reflect-metadata";
import { Module } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { CrewModule, type CrewModuleOptions } from "../src/crew-module.js";
import {
  CREW_FACTORY,
  KNOWLEDGE,
  LLM,
  MEMORY,
} from "../src/tokens.js";

describe("@crewai-ts/nestjs CrewModule.forRootAsync", () => {
  it("forRootAsync with useFactory resolves async deps", async () => {
    const asyncLlm = async (): Promise<string> => "async-llm";

    const moduleRef = await Test.createTestingModule({
      imports: [
        CrewModule.forRootAsync({
          useFactory: (): CrewModuleOptions => ({
            llm: asyncLlm,
            memory: null,
            knowledge: null,
          }),
        }),
      ],
    }).compile();

    expect(moduleRef.get(LLM)).toBe(asyncLlm);
    expect(moduleRef.get(MEMORY)).toBeNull();
    expect(moduleRef.get(KNOWLEDGE)).toBeNull();
    const factory = moduleRef.get<{ create: (input: { agents: readonly unknown[]; tasks: readonly unknown[] }) => unknown }>(CREW_FACTORY);
    expect(typeof factory.create).toBe("function");

    await moduleRef.close();
  });

  it("forRootAsync injects other providers", async () => {
    const CONFIG = "CONFIG";
    const defaultLlm = (): string => "from-config";

    @Module({
      providers: [{ provide: CONFIG, useValue: { defaultLlm } }],
      exports: [CONFIG],
    })
    class ConfigModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule,
        CrewModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: (config: { defaultLlm: () => string }): CrewModuleOptions => ({
            llm: config.defaultLlm,
            memory: null,
            knowledge: null,
          }),
          inject: [CONFIG],
        }),
      ],
    }).compile();

    const resolvedLlm = moduleRef.get<() => string>(LLM);
    expect(resolvedLlm).toBe(defaultLlm);
    expect(resolvedLlm()).toBe("from-config");

    await moduleRef.close();
  });

  it("forRootAsync supports imports", async () => {
    const LOGGER = "LOGGER";
    const log = (msg: string): string => `log:${msg}`;

    @Module({
      providers: [{ provide: LOGGER, useValue: { log } }],
      exports: [LOGGER],
    })
    class LoggerModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [
        LoggerModule,
        CrewModule.forRootAsync({
          imports: [LoggerModule],
          inject: [LOGGER],
          useFactory: (): CrewModuleOptions => ({
            llm: (): string => "logged-llm",
            memory: null,
            knowledge: null,
          }),
        }),
      ],
    }).compile();

    expect((moduleRef.get<() => string>(LLM))()).toBe("logged-llm");
    expect(moduleRef.get<{ log: (msg: string) => string }>(LOGGER).log("hi")).toBe("log:hi");

    await moduleRef.close();
  });

  it("forRootAsync without useFactory throws", () => {
    expect(() =>
      // @ts-expect-error -- intentionally omitting useFactory to verify the runtime guard
      CrewModule.forRootAsync({}),
    ).toThrow(/useFactory/);
  });

  it("forRootAsync without useFactory OR useClass throws (same guard)", () => {
    expect(() =>
      // @ts-expect-error -- intentionally omitting useFactory to verify the runtime guard
      CrewModule.forRootAsync({}),
    ).toThrow(/useFactory/);
  });
});
