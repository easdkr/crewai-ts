import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    knowledge: "src/knowledge.ts",
    memory: "src/memory.ts",
    rag: "src/rag.ts",
  },
  format: ["esm", "cjs"],
  dts: false,
  sourcemap: false,
  clean: true,
  shims: true,
  platform: "node",
  target: "node22",
  external: ["@crewai-ts/core", "pdf-parse"],
});
