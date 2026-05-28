import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "state-provider-core": "src/state-provider-core.ts",
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  platform: "node",
  external: ["node:sqlite"],
  target: "node22",
});
