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

## Elevação · radius · z-index

- **Elevação**: `elevation-{xs,sm,md,lg,xl}` (`src/index.css`). Default em
  `SectionCard` é `elevation-xs`. Evite `shadow-sm/md/lg` solto.
- **Radius**: `rounded-{sm,md,lg}` mapeiam a `--radius` (10px). Default de
  cards é `rounded-lg`; `rounded-xl/2xl` requer justificativa (hero, modal).
- **Z-index**: nunca sobrescrever `z-*` em `*Content` de Dialog / Sheet /
  Drawer / Popover etc. Use tokens (`z-modal`, `z-popover`, `z-alert`) de
  `tailwind.config.ts`.
