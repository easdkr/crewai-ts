import type { InputFiles } from "./input-files.js";

export type UtilityLLMMessage = {
  role: "user" | "assistant" | "system" | "tool";
  content: string | Array<Record<string, unknown>> | null;
  tool_call_id?: string;
  name?: string;
  tool_calls?: Array<Record<string, unknown>>;
  raw_tool_call_parts?: unknown[];
  files?: InputFiles;
};
