import { describe, expect, it } from "vitest";

import { convertToolsToOpenAISchema } from "../src/agent-utils.js";
import { BaseTool, StructuredTool, functionTool, type ToolArgsSchema } from "../src/tools.js";

const githubArgsSchema = {
  owner: { type: "string", required: true },
  repo: { type: "string", required: true },
  pullNumber: { type: "number", required: true },
} satisfies ToolArgsSchema;

const githubInput = {
  owner: "easdkr",
  repo: "crewai-ts",
  pullNumber: 42,
};

type ObjectArgCall = {
  args: Record<string, unknown>;
  owner: string;
  repo: string;
  pullNumber: number;
};

type ObjectArgRecorder = (
  args: Record<string, unknown>,
  owner: string,
  repo: string,
  pullNumber: number,
) => ObjectArgCall;

type ObjectArgToolFunction = (args: Record<string, unknown>) => Promise<ObjectArgCall>;

function makeMinifiedObjectArgToolFunction(
  parameterName: "args" | "t",
  record: ObjectArgRecorder,
): ObjectArgToolFunction {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const factory = Function(
    "record",
    "owner",
    "repo",
    "pullNumber",
    `return async ${parameterName}=>record(${parameterName}, owner, repo, pullNumber);`,
  ) as (
    record: ObjectArgRecorder,
    owner: string,
    repo: string,
    pullNumber: number,
  ) => ObjectArgToolFunction;
  return factory(record, "lexical-owner", "lexical-repo", 999);
}

type PositionalGithubToolFunction = (
  owner: unknown,
  repo: unknown,
  pullNumber: unknown,
) => Promise<string>;

function makeMinifiedPositionalGithubToolFunction(calls: unknown[][]): PositionalGithubToolFunction {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const factory = Function(
    "calls",
    "return async(a,b,c)=>{ calls.push([a,b,c]); return `${a}/${b}/${c}`; };",
  ) as (calls: unknown[][]) => PositionalGithubToolFunction;
  return factory(calls);
}

describe("StructuredTool function parameter handling", () => {
  it("does not infer parameters from a minified arrow function body call", () => {
    const func = makeMinifiedObjectArgToolFunction("args", (args, owner, repo, pullNumber) => ({
      args,
      owner,
      repo,
      pullNumber,
    }));

    expect(StructuredTool._create_schema_from_function("get_github_pr", func)).toEqual({
      args: { type: "unknown", required: true },
    });
  });

  it("passes the parsed args object to minified and non-minified single-arg StructuredTool functions", async () => {
    const minifiedCalls: ObjectArgCall[] = [];
    const minifiedTool = new StructuredTool({
      name: "get_github_pr",
      description: "Get a GitHub PR",
      argsSchema: githubArgsSchema,
      func: makeMinifiedObjectArgToolFunction("t", (args, owner, repo, pullNumber) => {
        const call = { args, owner, repo, pullNumber };
        minifiedCalls.push(call);
        return call;
      }),
    });

    const nonMinifiedCalls: Record<string, unknown>[] = [];
    const nonMinifiedTool = new StructuredTool({
      name: "get_github_pr_non_minified",
      description: "Get a GitHub PR",
      argsSchema: githubArgsSchema,
      func: (args: Record<string, unknown>) => {
        nonMinifiedCalls.push(args);
        return args;
      },
    });

    await expect(minifiedTool.invoke(githubInput)).resolves.toMatchObject({
      args: githubInput,
      owner: "lexical-owner",
      repo: "lexical-repo",
      pullNumber: 999,
    });
    await expect(Promise.resolve(nonMinifiedTool.invoke(githubInput))).resolves.toEqual(githubInput);

    expect(minifiedCalls[0]?.args).toEqual(githubInput);
    expect(nonMinifiedCalls).toEqual([githubInput]);
  });

  it("uses explicit argsSchema key order for minified and non-minified positional fromFunction tools", async () => {
    const minifiedCalls: unknown[][] = [];
    const minifiedTool = StructuredTool.fromFunction(
      makeMinifiedPositionalGithubToolFunction(minifiedCalls),
      {
        name: "get_github_pr_minified",
        description: "Get a GitHub PR",
        argsSchema: githubArgsSchema,
      },
    );

    const nonMinifiedCalls: unknown[][] = [];
    const nonMinifiedTool = StructuredTool.fromFunction(
      (owner: unknown, repo: unknown, pullNumber: unknown) => {
        nonMinifiedCalls.push([owner, repo, pullNumber]);
        return `${String(owner)}/${String(repo)}/${String(pullNumber)}`;
      },
      {
        name: "get_github_pr_non_minified",
        description: "Get a GitHub PR",
        argsSchema: githubArgsSchema,
      },
    );

    await expect(minifiedTool.invoke(githubInput)).resolves.toBe("easdkr/crewai-ts/42");
    await expect(Promise.resolve(nonMinifiedTool.invoke(githubInput))).resolves.toBe("easdkr/crewai-ts/42");

    expect(minifiedCalls).toEqual([["easdkr", "crewai-ts", 42]]);
    expect(nonMinifiedCalls).toEqual([["easdkr", "crewai-ts", 42]]);
  });

  it("uses explicit argsSchema key order for functionTool positional functions", async () => {
    const calls: unknown[][] = [];
    const makeTool = functionTool({
      name: "get_github_pr",
      description: "Get a GitHub PR",
      argsSchema: githubArgsSchema,
    });
    const tool = makeTool(makeMinifiedPositionalGithubToolFunction(calls));

    await expect(tool.invoke(githubInput)).resolves.toBe("easdkr/crewai-ts/42");
    expect(calls).toEqual([["easdkr", "crewai-ts", 42]]);
  });

  it("keeps schema-less non-minified positional inference", async () => {
    function combine(owner: unknown, repo: unknown): string {
      return `${String(owner)}/${String(repo)}`;
    }

    const tool = StructuredTool.fromFunction(combine, {
      name: "combine",
      description: "Combine owner and repo",
    });

    expect(tool.argsSchema).toEqual({
      owner: { type: "unknown", required: true },
      repo: { type: "unknown", required: true },
    });
    await expect(Promise.resolve(tool.invoke({ owner: "easdkr", repo: "crewai-ts" }))).resolves.toBe("easdkr/crewai-ts");
  });
});

describe("OpenAI strict tool schema conversion", () => {
  it("emits nullable required properties for optional args and strips optional nullish runner values", async () => {
    class CloneRepoTool extends BaseTool {
      calls: Record<string, unknown>[] = [];

      constructor() {
        super({
          name: "clone_repo",
          description: "clone",
          argsSchema: {
            repo: { type: "string", required: true },
            owner: { type: "string", required: false },
            branch: { type: "string", required: false },
            searchPath: { type: ["string", "null"], required: false },
          },
        });
      }

      protected _run(args: Record<string, unknown>): Record<string, unknown> {
        this.calls.push(args);
        return args;
      }
    }

    const tool = new CloneRepoTool();
    const [schemas, availableFunctions] = convertToolsToOpenAISchema([tool]);

    expect(schemas[0]?.function.parameters).toEqual({
      type: "object",
      additionalProperties: false,
      properties: {
        repo: { type: "string", additionalProperties: false },
        owner: { type: ["string", "null"], additionalProperties: false },
        branch: { type: ["string", "null"], additionalProperties: false },
        searchPath: { type: ["string", "null"], additionalProperties: false },
      },
      required: ["repo", "owner", "branch", "searchPath"],
    });

    await expect(Promise.resolve(availableFunctions.clone_repo?.({
      repo: "crewai-ts",
      owner: null,
      branch: "",
      searchPath: undefined,
    }))).resolves.toEqual({ repo: "crewai-ts" });
    expect(tool.calls).toEqual([{ repo: "crewai-ts" }]);
  });

  it("preserves null unions and strict object shape for JSON schema input", () => {
    const tool = new StructuredTool({
      name: "clone_repo",
      description: "clone",
      argsSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          repo: { type: "string" },
          branch: { type: ["string", "null"], additionalProperties: false },
        },
        required: ["repo", "branch"],
      } as unknown as ToolArgsSchema,
      func: (args) => args,
    });

    const [schemas] = convertToolsToOpenAISchema([tool]);

    expect(schemas[0]?.function.parameters).toEqual({
      type: "object",
      additionalProperties: false,
      properties: {
        repo: { type: "string" },
        branch: { type: ["string", "null"], additionalProperties: false },
      },
      required: ["repo", "branch"],
    });
  });
});
