// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "**/coverage/**"] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: [
          "./packages/core/tsconfig.eslint.json",
          "./packages/core/tsconfig.json",
          "./packages/nestjs/tsconfig.json",
          "./packages/cli/tsconfig.json",
        ],
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.node },
    },
    rules: {
      // Lock in: no console.log in prod, no any, etc.
      // Note: `no-console` lives in base ESLint (typescript-eslint v8 dropped
      // its @typescript-eslint/no-console rule — see
      // https://typescript-eslint.io/troubleshooting/typed-linting/faqs
      // for the v8 recommended pattern). Use the base rule name.
      "@typescript-eslint/no-explicit-any": "error",
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
);
