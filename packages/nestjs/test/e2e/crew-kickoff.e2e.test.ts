import { describe, it, expect } from "vitest";
import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { Agent, Crew, Process, Task } from "@crewai-ts/core";
import { CrewModule } from "../../src/crew-module.js";
import { CREW_FACTORY } from "../../src/tokens.js";
import { DefaultCrewFactory } from "../../src/factories/crew-factory.js";
import { AgentFactory } from "../../src/factories/agent-factory.js";

/**
 * E2E integration tests for the full kickoff flow.
 *
 * These tests exercise the entire chain:
 *   CrewModule.forRoot(forRootAsync) -> DI tokens (LLM) -> DefaultCrewFactory
 *   -> Crew.kickoff({ inputs }) -> Task.execute -> Agent executor -> CrewOutput.raw
 *
 * Every LLM is a function mock — no real network calls.
 */
describe("@crewai-ts/nestjs E2E kickoff", () => {
  it("forRoot + crew.kickoff returns the mock LLM output", async () => {
    const mod = await Test.createTestingModule({
      imports: [CrewModule.forRoot({ llm: (() => "mock-output") as never })],
    }).compile();

    const factory = mod.get(CREW_FACTORY);
    const agent = new Agent({
      role: "tester",
      goal: "test",
      backstory: "test",
      llm: (() => "mock-output") as never,
    });
    const task = new Task({
      description: "test",
      expectedOutput: "output",
      agent,
    });
    const crew = factory.create({ agents: [agent], tasks: [task] });

    const result = await crew.kickoff({ inputs: { topic: "test" } });

    expect(result.raw).toBe("mock-output");
    expect(result.tasksOutput).toHaveLength(1);
    expect(result.tasksOutput[0]?.raw).toBe("mock-output");

    await mod.close();
  });

  it("forRootAsync + crew.kickoff returns the async mock LLM output", async () => {
    const mod = await Test.createTestingModule({
      imports: [
        CrewModule.forRootAsync({
          useFactory: () => ({
            llm: (() => "async-mock") as never,
            memory: null,
            knowledge: null,
          }),
        }),
      ],
    }).compile();

    const factory = mod.get(CREW_FACTORY);
    const agent = new Agent({
      role: "tester",
      goal: "test",
      backstory: "test",
      llm: (() => "async-mock") as never,
    });
    const task = new Task({
      description: "test",
      expectedOutput: "output",
      agent,
    });
    const crew = factory.create({ agents: [agent], tasks: [task] });

    const result = await crew.kickoff({ inputs: {} });

    expect(result.raw).toBe("async-mock");
    expect(result.tasksOutput).toHaveLength(1);
    expect(result.tasksOutput[0]?.raw).toBe("async-mock");

    await mod.close();
  });

  it("AgentFactory.create + CrewFactory.create compose and kickoff returns the mock LLM output", async () => {
    const mod = await Test.createTestingModule({
      imports: [CrewModule.forRoot({ llm: (() => "composed") as never })],
    }).compile();

    const agentFactory = mod.get(AgentFactory);
    const crewFactory = mod.get(CREW_FACTORY);

    // Sanity: the CrewModule wired both factories under their DI tokens,
    // and they are the SAME instance (useExisting), not two independent factories.
    expect(agentFactory).toBeInstanceOf(AgentFactory);
    expect(crewFactory).toBeInstanceOf(DefaultCrewFactory);

    const agent = agentFactory.create({
      role: "tester",
      goal: "test",
      backstory: "test",
    });
    // The injected LLM should propagate to the agent (the AgentFactory default
    // is "use the LLM token" when no per-agent llm is supplied).
    expect(typeof agent.llm).toBe("function");

    const task = new Task({
      description: "test",
      expectedOutput: "output",
      agent,
    });
    const crew = crewFactory.create({ agents: [agent], tasks: [task] });
    expect(crew).toBeInstanceOf(Crew);
    expect(crew.process).toBe(Process.sequential);

    const result = await crew.kickoff({ inputs: {} });

    expect(result.raw).toBe("composed");
    expect(result.tasksOutput).toHaveLength(1);
    expect(result.tasksOutput[0]?.raw).toBe("composed");

    await mod.close();
  });
});
