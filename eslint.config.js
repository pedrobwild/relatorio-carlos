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
     * SUPABASE GUARD — proíbe importar o client direto fora da camada de infra.
     *
     * Toda chamada ao Supabase deve passar por `@/infra/repositories/*` ou
     * `@/infra/edgeFunctions` (vide docs/ARCHITECTURE.md). Importar
     * `@/integrations/supabase/client` em pages/components duplica lógica
     * de erro/loading e fura RLS quando alguém esquece um filtro.
     *
     * Exceções: a própria camada `src/infra/**`, o queryClient
     * (que precisa fazer `signOut` em erros de auth) e o `lib/prefetch.ts`
     * (que move queries inline para repositories incrementalmente).
     */
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "src/infra/**",
      "src/integrations/supabase/**",
      "src/lib/queryClient.ts",
      "src/lib/prefetch.ts",
      "src/**/__tests__/**",
      "src/**/*.test.{ts,tsx}",
      "src/test/**",
    ],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          patterns: [
            {
              group: ["@/integrations/supabase/client", "@/integrations/supabase"],
              message:
                "Não importe o Supabase direto. Use os repositories em @/infra/repositories ou edge functions em @/infra/edgeFunctions.",
            },
          ],
        },
      ],
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

