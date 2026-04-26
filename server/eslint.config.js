import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["node_modules"],
  },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      globals: {
        ...globals.node,
        fetch: "readonly",
      },
    },
    rules: {
      "no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
];
