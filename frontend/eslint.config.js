import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "coverage", "public", "**/*.js", "**/*.d.ts"] },

  // Regras JS base
  js.configs.recommended,

  // TypeScript
  ...tseslint.configs.recommended,

  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
    },
    rules: {
      // Proibir any explícito (conforme CLAUDE.md)
      "@typescript-eslint/no-explicit-any": "error",

      // Exigir type-only imports quando possível
      "@typescript-eslint/consistent-type-imports": ["warn", { prefer: "type-imports" }],

      // Evitar variáveis não utilizadas (exceto args prefixados com _)
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],

      // Não usar non-null assertion sem necessidade
      "@typescript-eslint/no-non-null-assertion": "warn",
    },
  },

  {
    files: ["*.config.ts", "vite.config.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  }
);
