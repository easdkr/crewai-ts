import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "llms-hooks-transport": "src/llms-hooks-transport.ts",
    "state-provider-core": "src/state-provider-core.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: false,
  clean: true,
  shims: true,
  platform: "node",
  external: ["node:sqlite"],
  target: "node22",
});
