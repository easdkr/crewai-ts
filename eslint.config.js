import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.eslint.json",
        tsconfigRootDir: "/Users/june/workspace/personal/crewai-ts",
      },
    },
  },
  {
    ignores: ["dist", "node_modules", "coverage", "examples"],
  },
);
