import type { Task } from "./task.js";
import type { TaskOutput } from "./outputs.js";

export const DIVIDERS = "\n\n----------\n\n";

export function aggregateRawOutputsFromTaskOutputs(taskOutputs: readonly TaskOutput[]): string {
  return taskOutputs.map((output) => output.raw).join(DIVIDERS);
}

export const aggregate_raw_outputs_from_task_outputs = aggregateRawOutputsFromTaskOutputs;

export function aggregateRawOutputsFromTasks(tasks: readonly Task[] | null | undefined): string {
  const taskOutputs = (tasks ?? [])
    .map((task) => task.output)
    .filter((output): output is TaskOutput => output !== null);
  return aggregateRawOutputsFromTaskOutputs(taskOutputs);
}

export const aggregate_raw_outputs_from_tasks = aggregateRawOutputsFromTasks;
