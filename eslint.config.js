import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      
      // TypeScript strict rules
      "@typescript-eslint/no-unused-vars": ["warn", { 
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        ignoreRestSiblings: true 
      }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-non-null-assertion": "warn",
      
      // Import organization
      "no-duplicate-imports": "error",
      
      // Code quality
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "prefer-const": "error",
      "no-var": "error",
      
      // React best practices
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    /**
     * Z-INDEX GUARD — proíbe overrides arbitrários de z-index
     * (ex.: `z-[9999]`, `z-[200]`, `z-50`) em componentes overlay
     * (Dialog, Sheet, Drawer, Select, Popover, Dropdown, ContextMenu,
     * HoverCard, Tooltip, Menubar, AlertDialog, Toast).
     *
     * A escala vive em `tailwind.config.ts` como tokens semânticos
     * (`z-modal`, `z-popover`, `z-alert`, ...). Use SEMPRE os tokens.
     *
     * Esta regra NÃO se aplica a `src/components/ui/*` (definição base).
     */
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/components/ui/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "JSXAttribute[name.name='className'] Literal[value=/\\bz-(?:\\[|0\\b|10\\b|20\\b|30\\b|40\\b|50\\b)/]",
          message:
            "Não use z-index numérico em consumidores. Use os tokens semânticos da escala (z-modal, z-popover, z-alert, etc.) definidos em tailwind.config.ts. Veja docs/SECURITY_PATTERNS.md ou o cabeçalho de src/index.css.",
        },
        {
          selector:
            "JSXAttribute[name.name='className'] TemplateElement[value.raw=/\\bz-(?:\\[|0\\b|10\\b|20\\b|30\\b|40\\b|50\\b)/]",
          message:
            "Não use z-index numérico em consumidores. Use os tokens semânticos da escala (z-modal, z-popover, z-alert, etc.) definidos em tailwind.config.ts.",
        },
      ],
    },
  },
);

