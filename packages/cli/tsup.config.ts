import { defineConfig } from "tsup";
export default defineConfig({
  entry: {
    index: "src/index.ts",
    argv: "src/argv.ts",
    "validate-project": "src/validate-project.ts",
    spawn: "src/spawn.ts",
  },
  format: ["esm", "cjs"],
  dts: false,
  sourcemap: false,
  clean: true,
  shims: true,
  platform: "node",
  target: "node22",
  banner: { js: "#!/usr/bin/env node" },
});
