import { readFileSync } from "node:fs";

export type PromptKind =
  | "slices"
  | "errors"
  | "tools"
  | "reasoning"
  | "planning"
  | "hierarchical_manager_agent"
  | "memory";

export type PromptLeaf = string | Record<string, string>;
export type PromptCatalog = Record<string, Record<string, PromptLeaf>>;

const defaultPrompts = {
  hierarchical_manager_agent: {
    role: "Crew Manager",
    goal: "Manage the team to complete the task in the best way possible.",
    backstory: [
      "You are a seasoned manager with a knack for getting the best out of your team.",
      "You are also known for your ability to delegate work to the right people, and to ask the right questions to get the best out of your team.",
      "Even though you don't perform tasks by yourself, you have a lot of experience in the field, which allows you to properly evaluate the work of your team members.",
    ].join("\n"),
  },
  slices: {
    observation: "\nObservation:",
    task: "\nCurrent Task: {input}\n\nBegin! This is VERY important to you, use the tools available and give your best Final Answer, your job depends on it!\n\nThought:",
    memory: "\n\n# Memories from past conversations:\n{memory}\n\nIMPORTANT: The memories above are an automatic selection and may be INCOMPLETE. If the task involves counting, listing, or summing items (e.g. 'how many', 'total', 'list all'), you MUST use the Search memory tool with several different queries before answering -- do NOT rely solely on the memories shown above. Enumerate each distinct item you find before giving a final count.",
    role_playing: "You are {role}. {backstory}\nYour personal goal is: {goal}",
    tools: "\nYou ONLY have access to the following tools, and should NEVER make up tools that are not listed here:\n\n{tools}\n\nIMPORTANT: Use the following format in your response:\n\n```\nThought: you should always think about what to do\nAction: the action to take, only one name of [{tool_names}], just the name, exactly as it's written.\nAction Input: the input to the action, just a simple JSON object, enclosed in curly braces, using \" to wrap keys and values.\nObservation: the result of the action\n```\n\nOnce all necessary information is gathered, return the following format:\n\n```\nThought: I now know the final answer\nFinal Answer: the final answer to the original input question\n```",
    no_tools: "",
    task_no_tools: "\nCurrent Task: {input}\n\nProvide your complete response:",
    native_tools: "",
    native_task: "\nCurrent Task: {input}",
    post_tool_reasoning: "Analyze the tool result. If requirements are met, provide the Final Answer. Otherwise, call the next tool. Deliver only the answer without meta-commentary.",
    format: "Decide if you need a tool or can provide the final answer. Use one at a time.\nTo use a tool, use:\nThought: [reasoning]\nAction: [name from {tool_names}]\nAction Input: [JSON object]\n\nTo provide the final answer, use:\nThought: [reasoning]\nFinal Answer: [complete response]",
    final_answer_format: "If you don't need to use any more tools, you must give your best complete final answer, make sure it satisfies the expected criteria, use the EXACT format below:\n\n```\nThought: I now can give a great answer\nFinal Answer: my best complete final answer to the task.\n\n```",
    task_with_context: "{task}\n\nThis is the context you're working with:\n{context}",
    expected_output: "\nThis is the expected criteria for your final answer: {expected_output}\nyou MUST return the actual complete content as the final answer, not a summary.",
    human_feedback: "You got human feedback on your work, re-evaluate it and give a new Final Answer when ready.\n {human_feedback}",
    formatted_task_instructions: "Format your final answer according to the following OpenAPI schema: {output_format}\n\nIMPORTANT: Preserve the original content exactly as-is. Do NOT rewrite, paraphrase, or modify the meaning of the content. Only structure it to match the schema format.\n\nDo not include the OpenAPI schema in the final output. Ensure the final output does not include any code block markers like ```json or ```python.",
    conversation_history_instruction: "You are a member of a crew collaborating to achieve a common goal. Your task is a specific action that contributes to this larger objective. For additional context, please review the conversation history between you and the user that led to the initiation of this crew. Use any relevant information or feedback from the conversation to inform your task execution and ensure your response aligns with both the immediate task and the crew's overall goals.",
    feedback_instructions: "User feedback: {feedback}\nInstructions: Use this feedback to enhance the next output iteration.\nNote: Do not respond or add commentary.",
    lite_agent_system_prompt_with_tools: "You are {role}. {backstory}\nYour personal goal is: {goal}\n\nYou ONLY have access to the following tools, and should NEVER make up tools that are not listed here:\n\n{tools}\n\nIMPORTANT: Use the following format in your response:\n\n```\nThought: you should always think about what to do\nAction: the action to take, only one name of [{tool_names}], just the name, exactly as it's written.\nAction Input: the input to the action, just a simple JSON object, enclosed in curly braces, using \" to wrap keys and values.\nObservation: the result of the action\n```\n\nOnce all necessary information is gathered, return the following format:\n\n```\nThought: I now know the final answer\nFinal Answer: the final answer to the original input question\n```",
    lite_agent_system_prompt_without_tools: "You are {role}. {backstory}\nYour personal goal is: {goal}\n\nTo give my best complete final answer to the task respond using the exact following format:\n\nThought: I now can give a great answer\nFinal Answer: Your final answer must be the great and the most complete as possible, it must be outcome described.\n\nI MUST use these formats, my job depends on it!",
    lite_agent_response_format: "Format your final answer according to the following OpenAPI schema: {response_format}\n\nIMPORTANT: Preserve the original content exactly as-is. Do NOT rewrite, paraphrase, or modify the meaning of the content. Only structure it to match the schema format.\n\nDo not include the OpenAPI schema in the final output. Ensure the final output does not include any code block markers like ```json or ```python.",
    knowledge_search_query: "The original query is: {task_prompt}.",
    knowledge_search_query_system_prompt: "Your goal is to rewrite the user query so that it is optimized for retrieval from a vector database. Consider how the query will be used to find relevant documents, and aim to make it more specific and context-aware. \n\n Do not include any other text than the rewritten query, especially any preamble or postamble and only add expected output format if its relevant to the rewritten query. \n\n Focus on the key words of the intended task and to retrieve the most relevant information. \n\n There will be some extra context provided that might need to be removed such as expected_output formats structured_outputs and other instructions.",
    human_feedback_collapse: "Based on the following human feedback, determine which outcome best matches their intent.\n\nFeedback: {feedback}\n\nPossible outcomes: {outcomes}\n\nRespond with ONLY one of the exact outcome values listed above, nothing else.",
  },
  errors: {
    force_final_answer_error: "You can't keep going, here is the best final answer you generated:\n\n {formatted_answer}",
    force_final_answer: "Now it's time you MUST give your absolute best final answer. You'll ignore all previous instructions, stop using any tools, and just return your absolute BEST Final answer.",
    agent_tool_unexisting_coworker: "\nError executing tool. coworker mentioned not found, it must be one of the following options:\n{coworkers}\n",
    task_repeated_usage: "I tried reusing the same input, I must stop using this action input. I'll try something else instead.\n\n",
    tool_usage_error: "I encountered an error: {error}",
    tool_arguments_error: "Error: the Action Input is not a valid key, value dictionary.",
    wrong_tool_name: "You tried to use the tool {tool}, but it doesn't exist. You must use one of the following tools, use one at time: {tools}.",
    tool_usage_exception: "I encountered an error while trying to use the tool. This was the error: {error}.\n Tool {tool} accepts these inputs: {tool_inputs}",
    agent_tool_execution_error: "Error executing task with agent '{agent_role}'. Error: {error}",
    validation_error: "### Previous attempt failed validation: {guardrail_result_error}\n\n\n### Previous result:\n{task_output}\n\n\nTry again, making sure to address the validation error.",
  },
  tools: {
    delegate_work: "Delegate a specific task to one of the following coworkers: {coworkers}\nThe input to this tool should be the coworker, the task you want them to do, and ALL necessary context to execute the task, they know nothing about the task, so share absolutely everything you know, don't reference things but instead explain them.",
    ask_question: "Ask a specific question to one of the following coworkers: {coworkers}\nThe input to this tool should be the coworker, the question you have for them, and ALL necessary context to ask the question properly, they know nothing about the question, so share absolutely everything you know, don't reference things but instead explain them.",
    add_image: {
      name: "Add image to content",
      description: "See image to understand its content, you can optionally ask a question about the image",
      default_action: "Please provide a detailed description of this image, including all visual elements, context, and any notable details you can observe.",
    },
    recall_memory: "Search through the team's shared memory for relevant information. Pass one or more queries to search for multiple things at once. Use this when you need to find facts, decisions, preferences, or past results that may have been stored previously. IMPORTANT: For questions that require counting, summing, or listing items across multiple conversations (e.g. 'how many X', 'total Y', 'list all Z'), you MUST search multiple times with different phrasings to ensure you find ALL relevant items before giving a final count or total. Do not rely on a single search -- items may be described differently across conversations.",
    save_to_memory: "Store one or more important facts, decisions, observations, or lessons in memory so they can be recalled later by you or other agents. Pass multiple items at once when you have several things worth remembering.",
  },
  memory: {
    query_system: "You analyze a query for searching memory.\nGiven the query and available scopes, output:\n1. keywords: Key entities or keywords that can be used to filter by category.\n2. suggested_scopes: Which available scopes are most relevant (empty for all).\n3. complexity: 'simple' or 'complex'.\n4. recall_queries: 1-3 short, targeted search phrases distilled from the query. Each should be a concise phrase optimized for semantic vector search. If the query is already short and focused, return it as-is in a single-item list. For long task descriptions, extract the distinct things worth searching for.\n5. time_filter: If the query references a time period (like 'last week', 'yesterday', 'in January'), return an ISO 8601 date string for the earliest relevant date (e.g. '2026-02-01'). Return null if no time constraint is implied.",
    extract_memories_user: "Content:\n{content}\n\nExtract memory statements as described. Return structured output.",
    query_user: "Query: {query}\n\nAvailable scopes: {available_scopes}\n{scope_desc}\n\nReturn the analysis as structured output.",
  },
  reasoning: {
    initial_plan: "You are {role}. Create a focused execution plan using only the essential steps needed.",
    refine_plan: "You are {role}. Refine your plan to address the specific gap while keeping it minimal.",
  },
  planning: {
    system_prompt: "You are a strategic planning assistant. Create concrete, executable plans where every step produces a verifiable result.",
    create_plan_prompt: "Create an execution plan for the following task:\n\n## Task\n{description}\n\n## Expected Output\n{expected_output}\n\n## Available Tools\n{tools}\n\n## Planning Principles\nFocus on CONCRETE, EXECUTABLE steps. Each step must clearly state WHAT ACTION to take and HOW to verify it succeeded. The number of steps should match the task complexity. Hard limit: {max_steps} steps.\n\n## Rules:\n- Each step must have a clear DONE criterion\n- Do NOT group unrelated actions: if steps can fail independently, keep them separate\n- NO standalone \"thinking\" or \"planning\" steps -- act, don't just observe\n- The last step must produce the required output\n\nAfter your plan, state READY or NOT READY.",
  },
} satisfies PromptCatalog;

export class I18N {
  readonly promptFile: string | null;
  readonly prompt_file: string | null;
  private readonly prompts: PromptCatalog;

  constructor(options: { promptFile?: string | null; prompt_file?: string | null; prompts?: PromptCatalog } = {}) {
    this.promptFile = options.promptFile ?? options.prompt_file ?? null;
    this.prompt_file = this.promptFile;
    this.prompts = options.prompts ?? (this.promptFile ? loadPromptCatalog(this.promptFile) : defaultPrompts);
  }

  slice(slice: string): string {
    return this.retrieveString("slices", slice);
  }

  errors(error: string): string {
    return this.retrieveString("errors", error);
  }

  tools(tool: string): PromptLeaf {
    return this.retrieve("tools", tool);
  }

  memory(key: string): string {
    return this.retrieveString("memory", key);
  }

  retrieve(kind: PromptKind, key: string): PromptLeaf {
    const prompt = this.prompts[kind]?.[key];
    if (prompt === undefined) {
      throw new Error(`Prompt for '${kind}':'${key}'  not found.`);
    }
    return prompt;
  }

  private retrieveString(kind: PromptKind, key: string): string {
    const prompt = this.retrieve(kind, key);
    if (typeof prompt !== "string") {
      throw new Error(`Prompt for '${kind}':'${key}' is not a string.`);
    }
    return prompt;
  }
}

const i18nCache = new Map<string, I18N>();

export function getI18N(promptFile: string | null = null): I18N {
  const key = promptFile ?? "__default__";
  const cached = i18nCache.get(key);
  if (cached) {
    return cached;
  }
  const i18n = new I18N({ promptFile });
  i18nCache.set(key, i18n);
  return i18n;
}

export function clearI18NCache(): void {
  i18nCache.clear();
}

function loadPromptCatalog(promptFile: string): PromptCatalog {
  try {
    const parsed: unknown = JSON.parse(readFileSync(promptFile, "utf8"));
    if (!isPromptCatalog(parsed)) {
      throw new Error("Prompt catalog must be an object of prompt groups.");
    }
    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Error decoding JSON from the prompts file.", { cause: error });
    }
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new Error(`Prompt file '${promptFile}' not found.`, { cause: error });
    }
    throw error;
  }
}

function isPromptCatalog(value: unknown): value is PromptCatalog {
  if (!isRecord(value)) {
    return false;
  }
  return Object.values(value).every((group) => {
    return isRecord(group) && Object.values(group).every((entry) => {
      return typeof entry === "string" || (isRecord(entry) && Object.values(entry).every((leaf) => typeof leaf === "string"));
    });
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const I18N_DEFAULT = getI18N();
export const get_i18n = getI18N;
export const clear_i18n_cache = clearI18NCache;
