# Design Tokens — Portal BWild

Referência única para tokens de design do Portal BWild. Todos os tokens vivem
em `src/index.css` (variáveis HSL) e `tailwind.config.ts` (mapeamento Tailwind).
Componentes do design system (`@/components/ui-premium` e
`@/components/typography`) consomem estes tokens — **nunca** use cor literal,
tamanho de texto solto ou primitivo legado fora dessas pastas.

> **Bloco 3 (issue #20)** — este documento é o produto de centralização do
> Design System. ESLint enforça as regras correspondentes (severidade
> temporária `warn`, ver `eslint.config.js`).

---

## 1. Cores semânticas

Use sempre o token semântico — nunca a cor literal Tailwind. Cores literais
quebram dark mode e diluem a paleta primária BWild blue.

| Token            | Light HSL          | Dark HSL           | Uso                                      |
|------------------|--------------------|--------------------|------------------------------------------|
| `primary`        | `204 100% 25%`     | `204 80% 35%`      | CTA principal, BWild blue dominante      |
| `accent`         | `204 50% 95%`      | `204 40% 25%`      | Hover/selected sutil                     |
| `background`     | `220 20% 98.5%`    | `220 14% 10%`      | Canvas da página                         |
| `foreground`     | `222 25% 11%`      | `220 14% 96%`      | Texto principal                          |
| `muted`          | `220 16% 95.5%`    | `220 14% 20%`      | Estados sem ação                         |
| `muted-foreground` | `220 12% 38%`    | `220 9% 55%`       | Texto secundário                         |
| `border`         | `220 14% 88%`      | —                  | Divisórias padrão                        |
| `border-subtle`  | `220 16% 92%`      | —                  | Linhas internas (table rows)             |
| `success`        | `152 65% 32%`      | `160 84% 45%`      | OK, concluído, em dia                    |
| `info`           | `211 90% 38%`      | `204 80% 45%`      | Em andamento, aguardando                 |
| `warning`        | `32 92% 42%`       | (escala dark)      | Atenção, urgente, aguardando cliente     |
| `destructive`    | `0 72% 48%`        | (escala dark)      | Erro, atrasado, recusado, crítico        |

### Mapeamento `cor literal → token semântico`

ESLint sinaliza qualquer ocorrência fora de `src/components/ui/**`,
`src/components/ui-premium/**` e `src/components/typography/**`.

| Literal Tailwind   | Token semântico | Quando usar                       |
|--------------------|-----------------|-----------------------------------|
| `*-rose-*`         | `destructive`   | erro, bloqueio, atraso            |
| `*-amber-*`        | `warning`       | atenção, urgente                  |
| `*-emerald-*`      | `success`       | ok, concluído, em dia             |
| `*-sky-*`          | `info`          | em andamento, informativo         |

Exemplos:

```diff
- <div className="bg-rose-500/10 text-rose-600 border-rose-500/20">
+ <div className="bg-destructive/10 text-destructive border-destructive/20">

- <div className="bg-emerald-500/10 text-emerald-700 border-emerald-300/50">
+ <div className="bg-success/10 text-success border-success/30">
```

---

## 2. Tipografia

Toda hierarquia de texto vive na escala `src/index.css` e é exposta pelos
componentes em `@/components/typography`. **Não** use `text-2xl..text-7xl`
solto — ESLint sinaliza.

| Componente         | Token CSS                | Tamanho mobile | Tamanho desktop | Weight     | Uso                            |
|--------------------|--------------------------|----------------|-----------------|------------|--------------------------------|
| `<Heading level="page">`    | `text-page-title`  | 16px           | 18px            | bold       | Título de página               |
| `<Heading level="section">` | `text-section-title` | 16px         | 18px            | semibold   | Seção / subseção               |
| `<Heading level="card">`    | `text-card-label`  | 14px           | 15px            | semibold   | Label de card                  |
| `<Heading level="value">`   | `text-card-value`  | 20px           | 24px            | bold (tab) | Valor numérico (KPI)           |
| `<Text variant="body">`     | `text-body`        | 14px           | 15px            | regular    | Corpo padrão                   |
| `<Text variant="caption">`  | `text-caption`     | 13px           | 14px            | regular    | Legenda / texto secundário     |
| `<Text variant="meta">`     | `text-meta`        | 11px           | 12px            | regular    | Timestamp, badges, microcopy   |

Aliases legados (`text-h1`, `text-h2`, `text-h3`) ainda existem em
`src/index.css` por compatibilidade — não os use em código novo.

```diff
- <h1 className="text-h1 text-3xl md:text-5xl tracking-tight">Portal do Cliente</h1>
+ <Heading level="page" className="tracking-tight">Portal do Cliente</Heading>
```

---

## 3. Componentes do design system

Substitutos canônicos para primitivos shadcn — bloqueados via
`no-restricted-imports` (severidade `warn`).

| Substituir                          | Por                                       | Razão                              |
|-------------------------------------|-------------------------------------------|------------------------------------|
| `@/components/ui/card` (Card)       | `SectionCard` de `@/components/ui-premium` | Superfície consistente (border-subtle + elevation-xs + radius-lg + header padronizado) |
| `@/components/ui/badge` (Badge)     | `StatusBadge` de `@/components/ui-premium` | Tom semântico (`tone`) + dot + tamanhos calibrados |
| `<h1 className="text-3xl ...">`     | `<Heading level="page">`                   | Escala única                       |
| `bg-rose-500/10`                    | `bg-destructive/10`                        | Token semântico                    |

Exemplo `Badge → StatusBadge`:

```diff
- <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600">Ativo</Badge>
+ <StatusBadge tone="success">Ativo</StatusBadge>
```

---

## 4. Status tones (mapeamento de domínio)

Centralizado em `src/lib/statusTone.ts` (PainelStatus) e
`src/lib/statusTones.ts` (orçamento, severidade, fornecedor, etc.).

| Domínio        | Status                | Tone        |
|----------------|-----------------------|-------------|
| PainelStatus   | `Aguardando`          | `info`      |
| PainelStatus   | `Em dia`              | `success`   |
| PainelStatus   | `Atrasado`            | `danger`    |
| PainelStatus   | `Paralisada`          | `muted`     |
| Severidade     | `low`                 | `neutral`   |
| Severidade     | `medium`              | `info`      |
| Severidade     | `high`                | `warning`   |
| Severidade     | `critical`            | `danger`    |
| Prioridade     | `low`                 | `muted`     |
| Prioridade     | `normal`              | `neutral`   |
| Prioridade     | `high`                | `warning`   |
| Prioridade     | `urgent`              | `danger`    |

```ts
import { getStatusTone } from '@/lib/statusTone';
import { StatusBadge } from '@/components/ui-premium';

<StatusBadge tone={getStatusTone(obra.status)}>{obra.status}</StatusBadge>;
```

---

## 5. Ícones (lucide-react)

Padronizar tamanho conforme contexto.

| Tamanho | Classe Tailwind  | Uso                                 |
|---------|------------------|-------------------------------------|
| 14px    | `w-3.5 h-3.5`    | Inline em texto, dots de tabela     |
| 16px    | `w-4 h-4`        | Botões, badges, inputs              |
| 18px    | `w-[18px] h-[18px]` | Sidebar, abas                    |
| 20px    | `w-5 h-5`        | KPIs, cabeçalhos de seção           |
| 24px    | `w-6 h-6`        | Empty state hero, avatares grandes  |

Não use 12px (`w-3`) exceto em microbadges. Tamanhos pares ímpares (`w-7`,
`w-9`) requerem justificativa visual.

---

## 6. Elevação (sombras)

Escala centralizada em `src/index.css` como `elevation-{xs,sm,md,lg,xl}`.
**Evite** `shadow-sm/md/lg` solto — use `elevation-*` para herdar a curva
unificada.

| Token          | CSS                                      | Uso                                  |
|----------------|------------------------------------------|--------------------------------------|
| `elevation-xs` | `var(--shadow-xs)` — 1px subtle line     | Cards de seção (default)             |
| `elevation-sm` | `var(--shadow-sm)`                       | Inputs, popovers leves               |
| `elevation-md` | `var(--shadow-md)`                       | Dropdowns, hovers                    |
| `elevation-lg` | `var(--shadow-lg)`                       | Modais, sheets                       |
| `elevation-xl` | `var(--shadow-xl)`                       | Modais críticos, hero overlays       |

---

## 7. Radius

Tokens em `src/index.css`. Tailwind expõe via `rounded-{sm,md,lg}`.

| Token          | CSS              | Uso                                       |
|----------------|------------------|-------------------------------------------|
| `radius-sm`    | `0.375rem` (6px) | Pills internos, microbadges               |
| `radius-md`    | `0.5rem` (8px)   | Inputs, botões padrão                     |
| `radius`       | `0.625rem` (10px)| **Default** — cards, sections, dialogs    |
| `radius-lg`    | `0.875rem` (14px)| Hero cards, banners                       |
| `radius-xl`    | `1.125rem` (18px)| Modais grandes, painéis hero              |

> Regra: **`rounded-xl/2xl` ad-hoc requer justificativa.** O default de cards
> deve ser `rounded-lg` (= `var(--radius)`), não `rounded-xl`.

---

## 8. Z-index (overlays)

Nunca sobrescrever `z-*` em `*Content` de Dialog/Sheet/Drawer/Popover/etc.
Tokens em `tailwind.config.ts`: `z-modal`, `z-popover`, `z-alert`, etc.
ESLint enforça via `no-restricted-syntax`.

---

## 9. Backlog de migração (Bloco 3)

Status no momento desta versão do doc:

- ESLint: regras `warn` ativas — promover a `error` quando os contadores
  abaixo zerarem.
- `bg|text|border-{rose,amber,emerald,sky}-*`: ainda há uso em ~60 arquivos.
- `@/components/ui/card`: ainda importado em ~120 arquivos.
- `@/components/ui/badge`: ainda importado em ~140 arquivos.
- `text-{2,3,4,5,6,7}xl`: ainda em ~80 ocorrências fora de
  `@/components/typography` e `@/components/ui`.

Cada PR de migração deve:

1. Cobrir uma sub-pasta (`src/pages/`, `src/components/admin/`, etc.).
2. Reduzir os contadores acima.
3. Não introduzir novas violações (ESLint sinaliza).
4. Atualizar este doc se a tabela mudar.

Quando os contadores chegarem a zero, abrir um PR final que:

- Promove `no-restricted-imports` e `no-restricted-syntax` de `warn` → `error`.
- Remove os aliases legados (`text-h1/h2/h3`) de `src/index.css`.
- Adiciona o teste de regressão visual com Playwright nas 10 rotas-chave.
