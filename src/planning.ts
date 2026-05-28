import { Agent } from "./agent.js";
import type { Task } from "./task.js";
import type { LLM, Tool } from "./types.js";

export type PlanPerTaskOptions = {
  taskNumber?: number;
  task_number?: number;
  task: string;
  plan: string;
};

export type PlanPerTask = {
  taskNumber: number;
  task_number: number;
  task: string;
  plan: string;
};

export const PlanPerTask = class PlanPerTask {
  readonly taskNumber: number;
  readonly task_number: number;
  readonly task: string;
  readonly plan: string;

  constructor(options: PlanPerTaskOptions) {
    const taskNumber = options.taskNumber ?? options.task_number;
    if (typeof taskNumber !== "number" || !Number.isInteger(taskNumber) || taskNumber < 1) {
      throw new Error("PlanPerTask taskNumber must be a positive integer.");
    }
    this.taskNumber = taskNumber;
    this.task_number = taskNumber;
    this.task = options.task;
    this.plan = options.plan;
  }
};

export type PlannerTaskOutput = {
  listOfPlansPerTask: readonly PlanPerTask[];
  list_of_plans_per_task: readonly PlanPerTask[];
};

export const PlannerTaskPydanticOutput = class PlannerTaskPydanticOutput {
  readonly listOfPlansPerTask: readonly PlanPerTask[];
  readonly list_of_plans_per_task: readonly PlanPerTask[];

  constructor(options: { listOfPlansPerTask?: readonly (PlanPerTask | PlanPerTaskOptions)[]; list_of_plans_per_task?: readonly (PlanPerTask | PlanPerTaskOptions)[] }) {
    this.listOfPlansPerTask = (options.listOfPlansPerTask ?? options.list_of_plans_per_task ?? [])
      .map((item) => item instanceof PlanPerTask ? item : new PlanPerTask(item));
    this.list_of_plans_per_task = this.listOfPlansPerTask;
  }
};
export type PlannerTaskPydanticOutput = InstanceType<typeof PlannerTaskPydanticOutput>;

export type CrewPlannerOptions = {
  tasks: readonly Task[];
  planningAgentLlm?: LLM | string | null;
};

export class CrewPlanner {
  readonly tasks: readonly Task[];
  readonly planningAgentLlm: LLM | string | null;
  private planningAgent: Agent | null = null;

  constructor(options: CrewPlannerOptions) {
    this.tasks = options.tasks;
    this.planningAgentLlm = options.planningAgentLlm ?? "gpt-4o-mini";
  }

  async handleCrewPlanning(): Promise<PlannerTaskOutput> {
    const planningAgent = this.createPlanningAgent();
    const raw = await planningAgent.executeTask(this.createPlannerPrompt());
    return parsePlannerTaskOutput(raw);
  }

  getUsageMetrics() {
    return this.planningAgent?.getUsageMetrics();
  }

  private createPlanningAgent(): Agent {
    this.planningAgent = new Agent({
      role: "Task Execution Planner",
      goal: "Create a detailed step-by-step plan from the tasks, tools, and agent goals.",
      backstory: "Planner agent for crew planning.",
      llm: this.planningAgentLlm,
    });
    return this.planningAgent;
  }

  private createPlannerPrompt(): string {
    return [
      `Based on these tasks summary: ${this.createTasksSummary()}`,
      "Create the most descriptive plan based on the tasks descriptions, tools available, and agents' goals.",
      "Return JSON with listOfPlansPerTask, where each item has taskNumber, task, and plan.",
    ].join("\n\n");
  }

  private createTasksSummary(): string {
    return this.tasks.map((task, index) => [
      `Task Number ${String(index + 1)} - ${task.description}`,
      `"task_description": ${task.description}`,
      `"task_expected_output": ${task.expectedOutput}`,
      `"agent": ${task.agent?.role ?? "None"}`,
      `"agent_goal": ${task.agent?.goal ?? "None"}`,
      `"task_tools": ${renderToolNames(task.tools)}`,
      `"agent_tools": ${renderToolNames(task.agent?.tools ?? [])}`,
    ].join("\n")).join("\n\n");
  }
}

export function parsePlannerTaskOutput(raw: string): PlannerTaskOutput {
  const parsed: unknown = JSON.parse(raw);
  const records = isRecord(parsed)
    ? parsed.listOfPlansPerTask ?? parsed.list_of_plans_per_task
    : parsed;
  if (!Array.isArray(records)) {
    throw new Error("Failed to get the Planning output.");
  }
  return {
    listOfPlansPerTask: records.map((record) => normalizePlanPerTask(record)),
    list_of_plans_per_task: records.map((record) => normalizePlanPerTask(record)),
  };
}

function normalizePlanPerTask(value: unknown): PlanPerTask {
  if (!isRecord(value)) {
    throw new Error("Planning output contains an invalid task plan.");
  }
  const taskNumber = value.taskNumber ?? value.task_number;
  if (typeof taskNumber !== "number" || !Number.isInteger(taskNumber) || taskNumber < 1) {
    throw new Error("Planning output taskNumber must be a positive integer.");
  }
  const task = value.task;
  const plan = value.plan;
  if (typeof task !== "string" || typeof plan !== "string") {
    throw new Error("Planning output task and plan must be strings.");
  }
  return new PlanPerTask({ taskNumber, task, plan });
}

function renderToolNames(tools: readonly Tool[]): string {
  return tools.length > 0
    ? `[${tools.map((tool) => tool.name).join(", ")}]`
    : "[]";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
