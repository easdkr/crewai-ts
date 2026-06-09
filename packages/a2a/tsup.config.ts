import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    a2a: "src/a2a.ts",
    a2ui: "src/a2ui.ts",
  },
  format: ["esm", "cjs"],
  dts: false,
  sourcemap: false,
  clean: true,
  shims: true,
  platform: "node",
  target: "node22",
  external: ["@crewai-ts/core"],
});
