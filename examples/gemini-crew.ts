import {
  Agent,
  Crew,
  CrewBase,
  Process,
  Task,
  afterKickoff,
  agent,
  beforeKickoff,
  crew,
  task,
  type CrewOutput,
  type InputValues,
} from "../dist/index.js";

const model = process.env.CREWAI_GEMINI_MODEL ?? "gemini-3.5-flash";

if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
  throw new Error("Set GEMINI_API_KEY or GOOGLE_API_KEY before running this demo.");
}

@CrewBase
class GeminiMarketBriefCrew {
  @beforeKickoff
  addDemoInputs(inputs: InputValues): InputValues {
    return {
      sector: "AI developer tools",
      audience: "engineering leads evaluating agent frameworks",
      model,
      ...inputs,
    };
  }

  @agent
  researcher(): Agent {
    return new Agent({
      role: "Gemini market researcher",
      goal: "Identify practical adoption signals for {sector}.",
      backstory: "You focus on concrete engineering workflows and avoid hype.",
      llm: model,
      verbose: false,
    });
  }

  @agent
  editor(): Agent {
    return new Agent({
      role: "Technical brief editor",
      goal: "Turn research into a concise executive-ready brief for {audience}.",
      backstory: "You keep conclusions short, specific, and testable.",
      llm: model,
      verbose: false,
    });
  }

  @task
  researchTask(): Task {
    return new Task({
      description: [
        "List three concrete adoption signals for {sector}.",
        "Mention that the analysis is produced through {model}.",
      ].join(" "),
      expectedOutput: "Three concise bullet points.",
      agent: this.researcher(),
    });
  }

  @task
  briefTask(): Task {
    return new Task({
      description: [
        "Using the prior research, write a compact decision brief for {audience}.",
        "Include one recommendation and include the exact model name {model}.",
      ].join(" "),
      expectedOutput: "A short brief with one recommendation and the model name.",
      agent: this.editor(),
      context: [this.researchTask()],
    });
  }

  @crew
  crew(): Crew {
    return new Crew({
      agents: [this.researcher(), this.editor()],
      tasks: [this.researchTask(), this.briefTask()],
      process: Process.sequential,
      verbose: false,
    });
  }

  @afterKickoff
  printSummary(output: CrewOutput): CrewOutput {
    console.log(`MODEL=${model}`);
    console.log(`RAW=${output.raw ?? String(output)}`);
    return output;
  }
}

await new GeminiMarketBriefCrew().crew().kickoff({
  inputs: {
    sector: process.env.CREWAI_DEMO_SECTOR ?? "AI developer tools",
  },
});
