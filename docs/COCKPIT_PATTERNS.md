# Cockpit Patterns

Padrões para páginas operacionais densas no Portal BWild — `PainelObras`,
`Cronograma`, `Compras`, `Calendarios`. Pensados para o Bloco 4 (issue #21):
páginas que **decidem**, não apenas exibem.

A página é um **cockpit operacional**: o usuário precisa olhar e saber o que
fazer em segundos. Tudo aqui é trade-off entre densidade e clareza.

---

## 1. Tabela densa (`DataTable`)

- Use `<DataTable>` de `@/components/ui-premium`. Nunca recrie tabelas com
  `<table>` ad-hoc.
- Densidade default: `compact`. Mude para `comfortable` apenas se houver
  texto multi-linha real na linha.
- Colunas opcionais devem ser controláveis via `useTablePreferences` —
  estado persiste por usuário.
- A primeira coluna é sempre o identificador legível (nome da obra, item,
  atividade); a última é a coluna de ações ou um chevron para abrir o side
  panel.
- Para listas > 50 linhas: virtualizar com `@tanstack/react-virtual`.
  Meta: render < 200ms para 100 linhas.

## 2. Header sticky com filtros + chips

- `PageToolbar` no topo (sticky, `top-0` dentro do shell).
- Filtros em popovers compactos, **não** em uma side bar fixa.
- Filtros aplicados aparecem como `<FilterPill>` removíveis abaixo do
  toolbar — facilita "tirar 1 filtro" sem reabrir o popover.
- Busca textual à esquerda, segments/tabs à direita.

## 3. Side panel em vez de expansão inline

- **Nunca** expanda linhas em tabelas longas. O scroll perde contexto.
- Clique numa linha → abre `<Sheet side="right">` com largura
  `lg:w-[640px]` (mobile: `w-full`).
- O side panel mantém a tabela visível e o usuário pode pular entre
  linhas sem fechar.

## 4. Ações em massa

- Checkbox por linha + checkbox no header (com estado tri: vazio / parcial /
  total).
- Quando há seleção, aparece uma **bulk bar** flutuante no rodapé com:
  - Contagem de itens selecionados
  - Ações comuns (mudar status, reatribuir, exportar CSV)
  - Botão de desfazer seleção
- Cada ação roda como `useMutation` em batch — mostre toast com sucesso
  parcial se algumas linhas falharem.

## 5. Saved views

- Use `useSavedViews(userId)` (em `src/pages/PainelObras/useSavedViews.ts`).
- Persiste em `localStorage` na chave `painelObras.views.<userId>`.
- Tabs no topo da página: defaults builtin + custom.
- Defaults builtin para PainelObras: "Todas", "Críticas", "Entregando este
  mês", "Aguardando cliente". Builtin views não podem ser renomeadas nem
  deletadas — `builtin: true` no `SavedView`.
- A view "ativa" também pode persistir (`painelObras.activeView.<userId>`)
  para reabrir na mesma sessão.

## 6. Estado da atividade derivado de datas

- Use `getActivityState(activity, now)` de `@/lib/scheduleState`. Estados:
  - `not_started` → "Não iniciada" / `neutral`
  - `in_progress` → "Em andamento" / `info`
  - `completed`   → "Concluída"   / `success`
  - `delayed`     → "Atrasada"    / `danger`
- Renderize com `<StatusBadge tone={result.tone}>{result.label}</StatusBadge>`.
- Para cálculos avançados (progresso, dias de atraso) continue usando
  `computeEffectiveStatus` em `@/lib/activityStatus`.

## 7. Soma de pesos visível

- `<WeightProgress total={sum} />` no toolbar do Cronograma.
- 100% → verde; 95–99% ou 101–105% → amarelo; fora disso → vermelho.
- Tooltip explica a consequência (curva S distorcida).

## 8. Risco de lead-time (Compras)

- Use `getLeadTimeRisk(purchase, supplier, now)` de `@/lib/purchaseRisk`.
- Retorna `{ level, tone, label, message, orderByDate, slackDays }`.
- Renderize como `<StatusBadge tone={r.tone}>{r.label}</StatusBadge>` com
  `r.message` no tooltip.
- Bloqueie transição para `ordered` se a compra não estiver vinculada a
  uma etapa do cronograma — modal de confirmação explicando o risco de
  retrabalho.

## 9. Predecessoras com mini-Gantt

- `<PredecessorMiniGantt predecessors={...} current={...} />` em
  `@/components/cronograma`. SVG estático ~200×40px, sem libs externas.
- Mostra barras das predecessoras + barra atual no mesmo eixo temporal.
- Substitui campos textuais "ID, ID, ID" por contexto visual real.

## 10. Mobile

- Tabelas viram `MobileListItem` em `<DataTable>` modo lista.
- Side panels viram `<Drawer>` (vaul) bottom-up.
- Bulk bar fica no fundo da tela como uma barra sticky simples.
- Padrão de referência: `CronogramaMobileView`.

---

## Onde encontrar (Bloco 4)

| Pattern               | Local                                                      |
| --------------------- | ---------------------------------------------------------- |
| `getActivityState`    | `src/lib/scheduleState.ts`                                 |
| `getLeadTimeRisk`     | `src/lib/purchaseRisk.ts`                                  |
| `useSavedViews`       | `src/pages/PainelObras/useSavedViews.ts`                   |
| `WeightProgress`      | `src/components/cronograma/WeightProgress.tsx`             |
| `PredecessorMiniGantt`| `src/components/cronograma/PredecessorMiniGantt.tsx`       |
| `<DataTable>`         | `src/components/ui-premium/DataTable.tsx`                  |
| `<FilterPill>`        | `src/components/ui-premium/FilterPill.tsx`                 |
| `useTablePreferences` | `src/components/ui-premium/useTablePreferences.ts`         |

## Restrições obrigatórias

- Sem cores literais. Use tokens semânticos definidos em `src/index.css` /
  `tailwind.config.ts` (ex.: `bg-success/10`, `text-destructive`).
- Sem `Card`/`Badge` legacy. Use `<SectionCard>` / `<StatusBadge>`.
- Sem `supabase.from()` direto em pages — vá pelos repositories em
  `src/infra/repositories`.
- Logging só com `console.warn`/`console.error` — ESLint bloqueia o resto.
