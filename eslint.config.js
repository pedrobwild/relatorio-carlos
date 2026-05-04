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
    // DESIGN SYSTEM + Z-INDEX GUARDS (Bloco 3 — issue #20).
    //
    // Aplicados a `src/...{ts,tsx}` exceto fonte do design system
    // (`components/ui`, `components/ui-premium`, `components/typography`),
    // que precisam usar os primitivos crus para definir a escala.
    //
    // 1. `no-restricted-imports` — bloqueia imports legados:
    //    - `@/components/ui/card`  → use `SectionCard`  de `@/components/ui-premium`.
    //    - `@/components/ui/badge` → use `StatusBadge` de `@/components/ui-premium`.
    //
    // 2. `no-restricted-syntax` — três conjuntos de selectors:
    //    a) Z-index em overlays (Dialog/Sheet/Drawer/Select/Popover/Dropdown
    //       /ContextMenu/HoverCard/Tooltip/Menubar/AlertDialog): nunca
    //       sobrescrever `z-` direto — use tokens (`z-modal`, `z-popover`,
    //       `z-alert`) de `tailwind.config.ts`. Quebra hierarquia e gera
    //       "popup atrás do modal".
    //    b) Cores literais Tailwind (rose/amber/emerald/sky em qualquer
    //       prefixo bg/text/border/ring/...): usar tokens semânticos
    //       (destructive / warning / success / info) — quebra dark mode e
    //       branding BWild blue.
    //    c) Tamanhos de texto soltos (`text-2xl..text-7xl`): usar
    //       `<Heading level=...>` de `@/components/typography` para preservar
    //       a escala oficial.
    //
    // Severidade = `warn` (temporário): o codebase tem ~400 violações de cor
    // literal e ~250 imports legados acumulados. Subir para `error` deve ser
    // feito em PR dedicado após os codemods completos. O selector de z-index
    // historicamente era `error` (commit anterior); foi rebaixado a `warn`
    // para coexistir num único rule entry — o flat config do ESLint sobrescreve
    // `no-restricted-syntax` por last-wins quando declarado em blocos
    // separados. Restaurar para `error` junto com os demais selectors quando
    // a migração completar.
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "src/components/ui/**",
      "src/components/ui-premium/**",
      "src/components/typography/**",
    ],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          patterns: [
            {
              group: ["@/components/ui/card"],
              message:
                "Use SectionCard de @/components/ui-premium em vez de Card legacy. Ver docs/DESIGN_TOKENS.md.",
            },
            {
              group: ["@/components/ui/badge"],
              message:
                "Use StatusBadge de @/components/ui-premium em vez de Badge legacy (passe `tone` semântico). Ver docs/DESIGN_TOKENS.md.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "warn",
        {
          selector:
            "JSXOpeningElement[name.name=/^(Dialog|Sheet|Drawer|Popover|Select|DropdownMenu|ContextMenu|HoverCard|Tooltip|Menubar|AlertDialog)Content$/] JSXAttribute[name.name='className'] Literal[value=/\\bz-/]",
          message:
            "Não sobrescreva z-index em componentes overlay. Use os tokens semânticos da escala (z-modal, z-popover, z-alert) definidos em tailwind.config.ts. Se precisar de um nível novo, adicione um token na escala.",
        },
        {
          // Cores literais Tailwind (rose/amber/emerald/sky) em qualquer string.
          // Cobre className, cn(), tw``, cva, etc. `\b` final aceita a fronteira
          // independentemente do sufixo de opacidade (`/10`, `/20`, ...) — `/`
          // é caractere não-palavra e gera word boundary.
          selector:
            "Literal[value=/\\b(bg|text|border|ring|from|to|via|fill|stroke|divide|outline|decoration|placeholder|caret|accent|shadow)-(rose|amber|emerald|sky)-(50|100|200|300|400|500|600|700|800|900|950)\\b/]",
          message:
            "Cor literal Tailwind proibida — use tokens semânticos: rose→destructive, amber→warning, emerald→success, sky→info. Ver docs/DESIGN_TOKENS.md.",
        },
        {
          selector:
            "TemplateElement[value.raw=/\\b(bg|text|border|ring|from|to|via|fill|stroke|divide|outline|decoration|placeholder|caret|accent|shadow)-(rose|amber|emerald|sky)-(50|100|200|300|400|500|600|700|800|900|950)\\b/]",
          message:
            "Cor literal Tailwind proibida — use tokens semânticos: rose→destructive, amber→warning, emerald→success, sky→info. Ver docs/DESIGN_TOKENS.md.",
        },
        {
          selector:
            "Literal[value=/\\btext-(2|3|4|5|6|7)xl\\b/]",
          message:
            "Tamanho de texto solto proibido — use <Heading level=...> de @/components/typography. Ver docs/DESIGN_TOKENS.md.",
        },
        {
          selector:
            "TemplateElement[value.raw=/\\btext-(2|3|4|5|6|7)xl\\b/]",
          message:
            "Tamanho de texto solto proibido — use <Heading level=...> de @/components/typography. Ver docs/DESIGN_TOKENS.md.",
        },
      ],
    },
  },
);

