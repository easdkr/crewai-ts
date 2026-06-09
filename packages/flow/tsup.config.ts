import { defineConfig } from "tsup";

const shared = {
  dts: false,
  sourcemap: false,
  clean: true,
  shims: true,
  platform: "node" as const,
  target: "node22",
  external: ["@crewai-ts/core", "@crewai-ts/rag", "node:sqlite", "yaml"],
};

export default defineConfig([{
  entry: {
    index: "src/index.ts",
    flow: "src/flow.ts",
    "flow-conversation": "src/flow-conversation.ts",
    "flow-definition": "src/flow-definition.ts",
    "input-provider": "src/input-provider.ts",
    "flow-persistence": "src/flow-persistence.ts",
    "flow-visualization": "src/flow-visualization.ts",
  },
  format: ["esm", "cjs"],
  ...shared,
}, {
  entry: {
    "flow/dsl/_conditions": "src/flow/dsl/_conditions.ts",
    "flow/dsl/_human_feedback": "src/flow/dsl/_human_feedback.ts",
    "flow/dsl/_listen": "src/flow/dsl/_listen.ts",
    "flow/dsl/_router": "src/flow/dsl/_router.ts",
    "flow/dsl/_start": "src/flow/dsl/_start.ts",
    "flow/dsl/_types": "src/flow/dsl/_types.ts",
    "flow/dsl/_utils": "src/flow/dsl/_utils.ts",
  },
  format: ["esm"],
  ...shared,
  clean: false,
}]);
