import { Agent, Crew, Process, Task } from "../dist/index.js";

const model = process.env.CREWAI_GEMINI_MODEL ?? "gemini-3.5-flash";

if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
  throw new Error("Set GEMINI_API_KEY or GOOGLE_API_KEY before running this demo.");
}

const analyst = new Agent({
  role: "Gemini demo analyst",
  goal: "Confirm the crewai-ts Gemini integration works from a packaged build.",
  backstory: "You write compact, deterministic smoke-test summaries.",
  llm: model,
  verbose: false,
});

const task = new Task({
  description: [
    "Reply with one short sentence confirming this crewai-ts demo ran through Gemini.",
    "Include the exact model name: {model}.",
  ].join(" "),
  expectedOutput: "One short confirmation sentence that includes the model name.",
  agent: analyst,
});

const crew = new Crew({
  agents: [analyst],
  tasks: [task],
  process: Process.sequential,
  verbose: false,
});

const result = await crew.kickoff({ inputs: { model } });

console.log(`MODEL=${model}`);
console.log(`RAW=${result.raw ?? String(result)}`);
