import { Agent } from "./agent.js";
import { Task } from "./task.js";
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
  planning_agent_llm?: LLM | string | null;
};

export class CrewPlanner {
  readonly tasks: readonly Task[];
  readonly planningAgentLlm: LLM | string | null;
  readonly planning_agent_llm: LLM | string | null;
  private planningAgent: Agent | null = null;

  constructor(options: CrewPlannerOptions);
  constructor(tasks: readonly Task[], planningAgentLlm?: LLM | string | null);
  constructor(
    optionsOrTasks: CrewPlannerOptions | readonly Task[],
    planningAgentLlm?: LLM | string | null,
  ) {
    if (isTaskList(optionsOrTasks)) {
      this.tasks = optionsOrTasks;
      this.planningAgentLlm = planningAgentLlm ?? "gpt-4o-mini";
      this.planning_agent_llm = this.planningAgentLlm;
      return;
    }
    this.tasks = optionsOrTasks.tasks;
    this.planningAgentLlm = optionsOrTasks.planningAgentLlm ?? optionsOrTasks.planning_agent_llm ?? "gpt-4o-mini";
    this.planning_agent_llm = this.planningAgentLlm;
  }

  async handleCrewPlanning(): Promise<PlannerTaskOutput> {
    return this._handle_crew_planning();
  }

  async _handle_crew_planning(): Promise<PlannerTaskOutput> {
    const planningAgent = this._create_planning_agent();
    const tasksSummary = this._create_tasks_summary();
    const plannerTask = CrewPlanner._create_planner_task(planningAgent, tasksSummary);
    const result = await plannerTask.executeSync();
    if (result.pydantic instanceof PlannerTaskPydanticOutput) {
      return result.pydantic;
    }
    return parsePlannerTaskOutput(result.raw);
  }

  getUsageMetrics() {
    return this.planningAgent?.getUsageMetrics();
  }

  createPlanningAgent(): Agent {
    return this._create_planning_agent();
  }

  _create_planning_agent(): Agent {
    this.planningAgent = new Agent({
      role: "Task Execution Planner",
      goal: "Your goal is to create an extremely detailed, step-by-step plan based on the tasks and tools available to each agent so that they can perform the tasks in an exemplary manner",
      backstory: "Planner agent for crew planning",
      llm: this.planningAgentLlm,
    });
    return this.planningAgent;
  }

  static _create_planner_task(planningAgent: Agent, tasksSummary: string): Task {
    return new Task({
      description: `Based on these tasks summary: ${tasksSummary} \n Create the most descriptive plan based on the tasks descriptions, tools available, and agents' goals for them to execute their goals with perfection.`,
      expectedOutput: "Step by step plan on how the agents can execute their tasks using the available tools with mastery",
      agent: planningAgent,
      outputPydantic: (raw) => new PlannerTaskPydanticOutput(parsePlannerTaskOutput(raw)),
    });
  }

  static _get_agent_knowledge(task: Task): string[] {
    const agentRecord = task.agent as unknown as { knowledge_sources?: unknown; knowledgeSources?: unknown } | null | undefined;
    const directSources = agentRecord?.knowledge_sources ?? agentRecord?.knowledgeSources;
    const sources = Array.isArray(directSources) && directSources.length > 0
      ? directSources
      : task.agent?.knowledge?.sources ?? [];
    return sources.map((source) => {
      const content = (source as { content?: unknown }).content;
      if (typeof content === "string") {
        return content;
      }
      if (typeof source === "string") {
        return source;
      }
      return JSON.stringify(source);
    });
  }

  createTasksSummary(): string {
    return this._create_tasks_summary();
  }

  _create_tasks_summary(): string {
    return this.tasks.map((task, index) => [
      `Task Number ${String(index + 1)} - ${task.description}`,
      `"task_description": ${task.description}`,
      `"task_expected_output": ${task.expectedOutput}`,
      `"agent": ${task.agent?.role ?? "None"}`,
      `"agent_goal": ${task.agent?.goal ?? "None"}`,
      `"task_tools": ${renderTaskToolNames(task.tools)}`,
      `"agent_tools": ${renderAgentToolNames(task.agent?.tools ?? [])}`,
      ...renderAgentKnowledge(CrewPlanner._get_agent_knowledge(task)),
    ].join("\n")).join("\n\n");
  }
}

function isTaskList(value: CrewPlannerOptions | readonly Task[]): value is readonly Task[] {
  return Array.isArray(value);
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

function renderTaskToolNames(tools: readonly Tool[]): string {
  return tools.length > 0
    ? `[${tools.map((tool) => tool.name).join(", ")}]`
    : "[]";
}

function renderAgentToolNames(tools: readonly Tool[]): string {
  return tools.length > 0
    ? `[${tools.map((tool) => tool.name).join(", ")}]`
    : "\"agent has no tools\"";
}

function renderAgentKnowledge(knowledge: readonly string[]): string[] {
  if (knowledge.length === 0 || String(knowledge) === "None") {
    return [];
  }
  return [`"agent_knowledge": "[\\"${knowledge[0] ?? ""}\\"]"`];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
