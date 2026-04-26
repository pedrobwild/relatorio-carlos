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
     * Z-INDEX GUARD — proíbe sobrescrever `z-*` em componentes overlay
     * (Dialog, Sheet, Drawer, Select, Popover, Dropdown, ContextMenu,
     * HoverCard, Tooltip, Menubar, AlertDialog).
     *
     * A escala vive em `tailwind.config.ts` como tokens semânticos
     * (`z-modal`, `z-popover`, `z-alert`, ...). Esses componentes já
     * carregam o token correto internamente — sobrescrever quebra a
     * hierarquia e causa bugs como "popup atrás do modal".
     *
     * Não se aplica a `src/components/ui/*` (definição base da escala).
     */
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/components/ui/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "JSXOpeningElement[name.name=/^(Dialog|Sheet|Drawer|Popover|Select|DropdownMenu|ContextMenu|HoverCard|Tooltip|Menubar|AlertDialog)Content$/] JSXAttribute[name.name='className'] Literal[value=/\\bz-/]",
          message:
            "Não sobrescreva z-index em componentes overlay. Use os tokens semânticos da escala (z-modal, z-popover, z-alert) definidos em tailwind.config.ts. Se precisar de um nível novo, adicione um token na escala.",
        },
      ],
    },
  },
);

