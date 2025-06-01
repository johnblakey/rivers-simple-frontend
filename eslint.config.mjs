import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";


export default defineConfig([
  // Apply ESLint's recommended JavaScript rules.
  // This replaces the previous less standard first entry.
  js.configs.recommended,

  // Configure global variables for the browser environment.
  { files: ["**/*.{js,mjs,cjs,ts,mts,cts}"], languageOptions: { globals: globals.browser } },

  // Apply TypeScript ESLint's recommended configurations.
  // Spreading the array is the standard way to include these.
  ...tseslint.configs.recommended,

  // Customization for @typescript-eslint/no-unused-vars
  // This allows underscore-prefixed arguments (and vars) to be ignored.
  {
    files: ["**/*.{ts,mts,cts,tsx}"], // Target TypeScript files (added tsx for common usage)
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error', // or 'warn'
        {
          argsIgnorePattern: '^_',        // Ignore arguments starting with _
          varsIgnorePattern: '^_',        // Ignore variables starting with _
          caughtErrorsIgnorePattern: '^_', // Ignore caught error variables starting with _
        },
      ],
    },
  },

  // Configuration for ignored files and directories.
  {
    ignores: [
      "dist/",
      "node_modules/",
    ],
  },
]);
