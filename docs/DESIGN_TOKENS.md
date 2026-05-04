# Design Tokens — Portal BWild

Tokens vivem em `src/index.css` (HSL) e `tailwind.config.ts`. Componentes
em `@/components/ui-premium` e `@/components/typography` os consomem —
fora dessas pastas, **não** use cor literal, tamanho de texto solto ou
primitivo legado. ESLint sinaliza (severidade `warn`, ver `eslint.config.js`).

## Cores

| Token              | Uso                                  |
|--------------------|--------------------------------------|
| `primary`          | CTA principal (BWild blue)           |
| `background` / `foreground` | Canvas / texto principal    |
| `muted` / `muted-foreground` | Estados sem ação / secundário |
| `border` / `border-subtle` | Divisórias / linhas internas |
| `success`          | OK, concluído, em dia                |
| `info`             | Em andamento, aguardando             |
| `warning`          | Atenção, urgente                     |
| `destructive`      | Erro, atrasado, crítico              |

Mapeamento literal → token (ESLint enforça):

| Literal Tailwind | Token         |
|------------------|---------------|
| `*-rose-*`       | `destructive` |
| `*-amber-*`      | `warning`     |
| `*-emerald-*`    | `success`     |
| `*-sky-*`        | `info`        |

```diff
- <div className="bg-rose-500/10 text-rose-600 border-rose-500/20">
+ <div className="bg-destructive/10 text-destructive border-destructive/20">
```

## Tipografia

Use `<Heading>` / `<Text>` de `@/components/typography`. Não use
`text-2xl..text-7xl` solto.

| Componente                  | Mobile / Desktop | Uso                |
|-----------------------------|------------------|--------------------|
| `<Heading level="page">`    | 16 / 18 px bold  | Título de página   |
| `<Heading level="section">` | 16 / 18 px semi  | Seção              |
| `<Heading level="card">`    | 14 / 15 px semi  | Label de card      |
| `<Heading level="value">`   | 20 / 24 px bold  | KPI numérico       |
| `<Text variant="body">`     | 14 / 15 px       | Corpo              |
| `<Text variant="caption">`  | 13 / 14 px muted | Legenda            |
| `<Text variant="meta">`     | 11 / 12 px muted | Timestamp / micro  |

```diff
- <h1 className="text-h1 text-3xl md:text-5xl">Portal do Cliente</h1>
+ <Heading level="page">Portal do Cliente</Heading>
```

## Componentes premium

| Substituir                      | Por                                       |
|---------------------------------|-------------------------------------------|
| `@/components/ui/card` (Card)   | `SectionCard` (`@/components/ui-premium`) |
| `@/components/ui/badge` (Badge) | `StatusBadge` (`@/components/ui-premium`) |

```diff
- <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600">Ativo</Badge>
+ <StatusBadge tone="success">Ativo</StatusBadge>
```

## Status tones

Mapeamento centralizado em `src/lib/statusTone.ts` (PainelStatus) e
`src/lib/statusTones.ts` (orçamento, severidade, fornecedor, etc.).

| Domínio        | Status        | Tone        |
|----------------|---------------|-------------|
| PainelStatus   | `Aguardando`  | `info`      |
| PainelStatus   | `Em dia`      | `success`   |
| PainelStatus   | `Atrasado`    | `danger`    |
| PainelStatus   | `Paralisada`  | `muted`     |
| Severidade     | low / medium / high / critical | neutral / info / warning / danger |
| Prioridade     | low / normal / high / urgent   | muted / neutral / warning / danger |

```ts
import { getStatusTone } from '@/lib/statusTone';
import { StatusBadge } from '@/components/ui-premium';

<StatusBadge tone={getStatusTone(obra.status)}>{obra.status}</StatusBadge>;
```

## Ícones (lucide)

| Tamanho | Classe              | Uso                    |
|---------|---------------------|------------------------|
| 14 px   | `w-3.5 h-3.5`       | Inline em texto        |
| 16 px   | `w-4 h-4`           | Botões, badges         |
| 18 px   | `w-[18px] h-[18px]` | Sidebar, abas          |
| 20 px   | `w-5 h-5`           | KPIs, cabeçalhos       |
| 24 px   | `w-6 h-6`           | Empty state hero       |

## Elevação · radius

- **Elevação**: `elevation-{xs,sm,md,lg,xl}` (`src/index.css`). Default em
  `SectionCard` é `elevation-xs`. Evite `shadow-sm/md/lg` solto.
- **Radius**: `rounded-{sm,md,lg}` mapeiam a `--radius` (10px). Default de
  cards é `rounded-lg`; `rounded-xl/2xl` requer justificativa (hero, modal).

## Z-index

Escala em `tailwind.config.ts` → `theme.extend.zIndex`. Nunca sobrescrever
`z-*` em `*Content` de Dialog / Sheet / Drawer / Popover etc. — ESLint
sinaliza.

| Token              | Valor | Camada                          |
|--------------------|-------|---------------------------------|
| `z-base`           | 0     | Fluxo normal                    |
| `z-sticky`         | 10    | Headers/colunas sticky de tabela |
| `z-raised`         | 20    | Hover, badges destacados        |
| `z-docked`         | 30    | Cantos sticky de tabela         |
| `z-shell`          | 40    | Sidebar, app shell              |
| `z-header`         | 50    | Top bar fixa                    |
| `z-modal`          | 100   | Backdrop de modal               |
| `z-modal-content`  | 101   | Conteúdo do modal               |
| `z-popover`        | 200   | Popover, dropdown, select       |
| `z-toast`          | 250   | Toast notifications             |
| `z-alert`          | 300   | Backdrop de alert dialog        |
| `z-alert-content`  | 301   | Conteúdo do alert dialog        |
| `z-max`            | 2147483647 | Escape hatch (raro)        |

## Animação

Definidas em `tailwind.config.ts` → `theme.extend.animation`. Todas usam
`ease-out` (curva padrão BWild) e duração entre 200–500ms.

| Classe                  | Duração | Uso                              |
|-------------------------|---------|----------------------------------|
| `animate-fade-in`       | 400ms   | Entrada padrão (opacity + Y)     |
| `animate-fade-in-up`    | 500ms   | Entrada hero (Y maior)           |
| `animate-fade-in-scale` | 400ms   | Entrada de cards / dialogs       |
| `animate-slide-in-right`/ `-left` | 400ms | Painéis laterais leves      |
| `animate-slide-in-from-right`/ `-left` | 250ms | Drawers / sheets       |
| `animate-shimmer`       | 1.6s ∞  | Skeletons (com `bg-[length:200%_100%]`) |
| `animate-accordion-down`/ `-up` | 200ms | Radix Accordion              |

Diretrizes:

- Entrada de página/seção: `animate-fade-in` ou `-fade-in-up`.
- Drawer/sheet: `-slide-in-from-{right,left}` (curva mais rápida, 250ms).
- Skeleton: `animate-shimmer` no container com gradiente.
- Não introduza novas durações sem token — adicione em `theme.extend.animation`.

## Espaçamento

Use a escala padrão do Tailwind (`p-{0..96}`, `gap-{0..96}`) — múltiplos
de `0.25rem` (4px). Sem overrides no `tailwind.config.ts`.

Convenções por contexto:

| Contexto                  | Espaçamento padrão       |
|---------------------------|--------------------------|
| `SectionCard` interno     | `p-5 md:p-6` (20/24px)   |
| Header de página          | `py-4` + `gap-3`         |
| Stack vertical de cards   | `space-y-4` ou `gap-4`   |
| Inline (icon + label)     | `gap-1.5` ou `gap-2`     |
| Form fields verticalmente | `space-y-4`              |

`px-1.5`/`py-0.5` (6px / 2px) só em microbadges. Para `MetricCard` /
`PageHeader` etc., respeite o padding interno do componente — não embrulhe
em outro `p-*`.

## Breakpoints

Padrões Tailwind (mobile-first). `2xl` foi customizado para 1400px em
`theme.container.screens` (afeta apenas `container`, não `2xl:` em geral).

| Token  | min-width | Uso                              |
|--------|-----------|----------------------------------|
| `sm:`  | 640 px    | Phone landscape / tablet pequeno |
| `md:`  | 768 px    | Tablet / breakpoint principal    |
| `lg:`  | 1024 px   | Laptop                           |
| `xl:`  | 1280 px   | Desktop                          |
| `2xl:` | 1536 px   | Wide / `container` em 1400 px    |

Diretrizes:

- Componentes nascem mobile-first; aplique variantes só onde a UI muda.
- Toolbars e tabelas geralmente alternam em `md:` (768).
- Layouts de duas colunas ativam em `lg:` (1024).
- Não use `sm:` para "pequena diferença" — confunde com mobile portrait.
