import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    auth: "src/auth.ts",
    llm: "src/llm.ts",
    "schema-utils": "src/schema-utils.ts",
    types: "src/types.ts",
    events: "src/events.ts",
    tools: "src/tools.ts",
    "feature-hooks": "src/feature-hooks.ts",
    "experimental-conversational": "src/experimental-conversational.ts",
    "llms-hooks-transport": "src/llms-hooks-transport.ts",
    "state-provider-core": "src/state-provider-core.ts",
  },
  format: ["esm", "cjs"],
  dts: false,
  sourcemap: false,
  clean: true,
  shims: true,
  platform: "node",
  external: ["node:sqlite", "pdf-parse"],
  target: "node22",
});
