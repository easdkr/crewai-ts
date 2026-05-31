import { I18N_DEFAULT, type I18N } from "./i18n.js";
import { Skill, formatSkillContext as formatLoadedSkillContext } from "./skills.js";

export type PromptComponent =
  | "role_playing"
  | "tools"
  | "no_tools"
  | "native_tools"
  | "task"
  | "native_task"
  | "task_no_tools";

export interface StandardPromptResultOptions {
  prompt?: string;
}

export class StandardPromptResult {
  readonly prompt: string;

  constructor(options: StandardPromptResultOptions = {}) {
    this.prompt = options.prompt ?? "";
  }

  get(key: string, defaultValue: unknown = null): unknown {
    return key in this ? (this as unknown as Record<string, unknown>)[key] : defaultValue;
  }

  item(key: string): unknown {
    return this.get(key);
  }

  __getitem__(key: string): unknown {
    if (!(key in this)) {
      throw new Error(`Key not found: ${key}`);
    }
    return this.item(key);
  }

  contains(key: string): boolean {
    return key in this && (this as unknown as Record<string, unknown>)[key] !== null;
  }

  __contains__(key: string): boolean {
    return this.contains(key);
  }
}

export interface SystemPromptResultOptions extends StandardPromptResultOptions {
  system?: string;
  user?: string;
}

export class SystemPromptResult extends StandardPromptResult {
  readonly system: string;
  readonly user: string;

  constructor(options: SystemPromptResultOptions = {}) {
    super(options);
    this.system = options.system ?? "";
    this.user = options.user ?? "";
  }
}

export interface PromptAgentLike {
  role: string;
  goal: string;
  backstory: string;
  skills?: readonly unknown[] | null;
}

export interface PromptsOptions {
  hasTools?: boolean;
  has_tools?: boolean;
  useNativeToolCalling?: boolean;
  use_native_tool_calling?: boolean;
  systemTemplate?: string | null;
  system_template?: string | null;
  promptTemplate?: string | null;
  prompt_template?: string | null;
  responseTemplate?: string | null;
  response_template?: string | null;
  useSystemPrompt?: boolean;
  use_system_prompt?: boolean;
  agent: PromptAgentLike;
  i18n?: I18N;
}

export class Prompts {
  readonly hasTools: boolean;
  readonly has_tools: boolean;
  readonly useNativeToolCalling: boolean;
  readonly use_native_tool_calling: boolean;
  readonly systemTemplate: string | null;
  readonly system_template: string | null;
  readonly promptTemplate: string | null;
  readonly prompt_template: string | null;
  readonly responseTemplate: string | null;
  readonly response_template: string | null;
  readonly useSystemPrompt: boolean;
  readonly use_system_prompt: boolean;
  readonly agent: PromptAgentLike;
  readonly i18n: I18N;

  constructor(options: PromptsOptions) {
    this.hasTools = options.hasTools ?? options.has_tools ?? false;
    this.has_tools = this.hasTools;
    this.useNativeToolCalling = options.useNativeToolCalling ?? options.use_native_tool_calling ?? false;
    this.use_native_tool_calling = this.useNativeToolCalling;
    this.systemTemplate = options.systemTemplate ?? options.system_template ?? null;
    this.system_template = this.systemTemplate;
    this.promptTemplate = options.promptTemplate ?? options.prompt_template ?? null;
    this.prompt_template = this.promptTemplate;
    this.responseTemplate = options.responseTemplate ?? options.response_template ?? null;
    this.response_template = this.responseTemplate;
    this.useSystemPrompt = options.useSystemPrompt ?? options.use_system_prompt ?? false;
    this.use_system_prompt = this.useSystemPrompt;
    this.agent = options.agent;
    this.i18n = options.i18n ?? I18N_DEFAULT;
  }

  taskExecution(): SystemPromptResult | StandardPromptResult {
    const slices: PromptComponent[] = ["role_playing"];
    if (this.hasTools) {
      if (!this.useNativeToolCalling) {
        slices.push("tools");
      }
    } else {
      slices.push("no_tools");
    }

    const system = this.buildPrompt(slices) + this.buildSkillBlock();
    const taskSlice = this.useNativeToolCalling ? "native_task" : this.hasTools ? "task" : "task_no_tools";
    slices.push(taskSlice);

    if (!this.systemTemplate && !this.promptTemplate && this.useSystemPrompt) {
      return new SystemPromptResult({
        system,
        user: this.buildPrompt([taskSlice]),
        prompt: this.buildPrompt(slices) + this.buildSkillBlock(),
      });
    }

    return new StandardPromptResult({
      prompt: this.buildPrompt(slices, this.systemTemplate, this.promptTemplate, this.responseTemplate)
        + this.buildSkillBlock(),
    });
  }

  task_execution(): SystemPromptResult | StandardPromptResult {
    return this.taskExecution();
  }

  private buildPrompt(
    components: readonly PromptComponent[],
    systemTemplate: string | null = null,
    promptTemplate: string | null = null,
    responseTemplate: string | null = null,
  ): string {
    let prompt: string;
    if (!systemTemplate || !promptTemplate) {
      prompt = components.map((component) => this.i18n.slice(component)).join("");
    } else {
      const systemParts = components
        .filter((component) => component !== "task")
        .map((component) => this.i18n.slice(component))
        .join("");
      const system = systemTemplate.replaceAll("{{ .System }}", systemParts);
      const user = promptTemplate.replaceAll("{{ .Prompt }}", this.i18n.slice("task"));
      if (responseTemplate) {
        const response = responseTemplate.split("{{ .Response }}")[0] ?? responseTemplate;
        prompt = `${system}\n${user}\n${response}`;
      } else {
        prompt = `${system}\n${user}`;
      }
    }

    return prompt
      .replaceAll("{goal}", this.agent.goal)
      .replaceAll("{role}", this.agent.role)
      .replaceAll("{backstory}", this.agent.backstory);
  }

  private buildSkillBlock(): string {
    const skills = this.agent.skills;
    if (!skills || skills.length === 0) {
      return "";
    }

    const sections = skills
      .map((skill) => formatPromptSkillContext(skill))
      .filter((section) => section.length > 0);
    return sections.length > 0 ? `\n\n<skills>\n${sections.join("\n\n")}\n</skills>` : "";
  }
}

function formatPromptSkillContext(skill: unknown): string {
  if (skill instanceof Skill) {
    return formatLoadedSkillContext(skill);
  }
  if (typeof skill === "string") {
    return skill;
  }
  if (!skill || typeof skill !== "object") {
    return "";
  }
  const record = skill as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name : null;
  const description = typeof record.description === "string" ? record.description : null;
  if (!name && !description) {
    return "";
  }
  return [
    name ? `<skill name="${escapeXml(name)}">` : "<skill>",
    description ?? "",
    "</skill>",
  ].join("\n");
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("\"", "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
