import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
  },
  format: ["esm", "cjs"],
  dts: false,
  sourcemap: false,
  clean: true,
  target: "node22",
  platform: "node",
  splitting: false,
  external: ["@crewai-ts/core", "@crewai-ts/openai"],
});
