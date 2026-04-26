# Cockpit Patterns

Padrões consolidados durante o Bloco 4 (issue #21) para páginas operacionais
densas — Painel de Obras, Cronograma, Compras, Calendário e registros de
campo. Adote estes padrões em novas features para manter coerência visual e
de comportamento.

---

## 1. Tabela densa estilo Linear/Airtable

Usada em `pages/PainelObras/PainelTable.tsx` e `pages/Cronograma/CronogramaTable.tsx`.

- Colunas prioritárias **fixas à esquerda** com `sticky left-0` e fundo
  herdado (`bg-card group-hover:bg-accent/40`) — preserva contexto ao
  rolar horizontalmente.
- Header em `bg-surface-sunken` com `[&_th]:text-[11px]
  [&_th]:uppercase [&_th]:tracking-[0.04em]` para densidade.
- Edição inline: cada célula editável usa o utilitário `editableCell`
  (`hover:bg-accent/60` + `focus-visible:ring-2`). Evite abrir
  modais para edits triviais (status, etapa, datas).
- Drag & drop nativo (HTML5) — sem dnd-kit. Estado:
  `draggedIndex`, `dragOverIndex`, e classes `opacity-55` /
  `ring-1 ring-inset ring-primary/30`.
- Loading: skeleton da tabela inteira; empty: `EmptyState` em
  `<SectionCard>` (não cards genéricos).

### Quando NÃO usar
- Listas com < 10 linhas ou de leitura ocasional → use cards.
- Mobile primário → veja padrão de mobile cards no Cronograma.

---

## 2. Side panel em vez de expansão inline

`pages/PainelObras/PainelDetailSheet.tsx` substituiu o `ObraExpandedRow`
inline por um `<Sheet side="right">`.

- Largura: `lg:w-[640px]` (e `w-full sm:max-w-none`).
- Preserva scroll da tabela — gestor não perde a linha clicada.
- Header curto com badge de status + atalho "Abrir página completa".
- Conteúdo principal em `flex-1 overflow-y-auto` para listas longas.
- Não duplique a página da obra dentro do panel — mostre só o que
  precisa de glance (ex.: `DailyLogInline`).

---

## 3. Saved views com persistência por usuário

`pages/PainelObras/useSavedViews.ts` é a referência canônica.

- Chave de storage: `painelObras.views.<userId>` (escopada por
  usuário, evita vazamento entre logins).
- Builtin views (Todas, Críticas, Entregando este mês, Aguardando
  cliente) ficam no código com `builtin: true` e **não** são removíveis.
- Custom views são `{ id, name, filters, columns? }` e armazenadas em
  array. Operações: `upsertView`, `removeView`, `resetCustom`.
- Hidrata no mount e re-hidrata quando `userId` muda.
- Parsing seguro: try/catch + filter de schema. Storage corrompido
  cai para lista vazia em vez de quebrar a página.

```ts
const { views, upsertView, removeView } = useSavedViews(user?.id ?? null);
```

---

## 4. Bulk actions

`pages/PainelObras/PainelBulkBar.tsx` mostra o padrão.

- Barra **flutuante** (`fixed inset-x-0 bottom-4 z-40 pointer-events-none`)
  só aparece quando há seleção (`if (selectedCount === 0) return null`).
- Animação: `animate-in fade-in slide-in-from-bottom-2 duration-150`.
- Ações em massa via `useMutation`: `Promise.all(ids.map(id => apply(id, patch)))`
  + único `toast.success` no fim.
- Sempre tenha "Exportar CSV" — gestor adora.
- "Limpar seleção" (X) à direita.
- O hook `usePainelSelection(visibleIds)` cuida de auto-cleanup
  quando filtros mudam.

---

## 5. Filtros sticky com chips removíveis

`pages/PainelObras/PainelFilters.tsx`.

- Toolbar com `sticky top-0 z-30` + `bg-background/85 backdrop-blur` —
  filtros ficam acessíveis ao rolar.
- `<Select>` para cada eixo + botão "Limpar" só quando há filtro ativo.
- **Chips abaixo** — listam só filtros aplicados, cada um remove apenas
  o eixo respectivo (não tudo). Padrão visual:
  `bg-primary/10 text-primary border border-primary/20`.
- Contador `{filtered} / {total} obras` à direita.

---

## 6. Status semântico via `StatusBadge` + `getActivityState`

Não use cores literais (`bg-green-500`). Use:

- `<StatusBadge tone={...}>` (do design system premium) com tons
  semânticos: `neutral | info | success | warning | danger | muted`.
- Mapeamentos em `src/lib/statusTones.ts`.
- Para atividades de cronograma: `getActivityState(activity)` em
  `src/lib/scheduleState.ts` retorna `{ state, label, tone, isAutoDelayed,
  delayDays }` — derivado das datas, sem persistir estado redundante.

---

## 7. Risco de lead time em compras

`src/lib/purchaseRisk.ts` expõe `getLeadTimeRisk(purchase, supplier?, now?)`:

- Retorna `{ risk, tone, shortLabel, message, orderByDate, slackDays }`.
- Use `shortLabel` em badges densos (kanban, tabela). Use `message`
  no tooltip.
- Status terminais (`delivered`, `sent_to_site`, `cancelled`) viram
  `risk: 'closed'` com tom `muted` — não aparecem como risco vermelho
  em listagens "encerradas".

---

## 8. Kanban com drag nativo

`pages/compras/PurchasesKanban.tsx`.

- Sem dnd-kit — `draggable={true}` + `onDragStart/Over/Drop`.
- Estado mínimo: `draggedId` e `dragOverColumn`.
- Coluna vazia mostra placeholder "Arraste cards para esta coluna".
- Ao soltar, dispara `onStatusChange(id, columnStatus)` — quem decide
  se a transição é permitida (ex.: `useOrderedConfirm`) é o consumidor.
- Aceita teclado: `role="button"` + `tabIndex` + Enter/Space no card.

---

## 9. Confirmação para transições de risco

`pages/compras/useOrderedConfirm.ts`.

- Pattern: hook que **encapsula a guarda** + dialog props.
- O guardado intercepta a chamada original. Se a condição de risco
  ocorrer (ex.: ir para "ordered" sem `activity_id`), abre o
  AlertDialog. Caso contrário, executa imediatamente.
- A página renderiza `<OrderedConfirmDialog {...dialogProps} />` uma
  vez e o passa para Lista e Kanban — ambos compartilham a mesma
  guarda.

---

## 10. Field Records — registro de evento de campo

`src/components/field-records/`.

Composição em torno de `<FieldRecordDialog kind={'nc'|'inspection'|'activity'}>`:

- Primitivos: `SeverityField`, `AssigneeField`, `LocationField`,
  `MediaUploader` (galeria + câmera traseira via `capture="environment"`).
- Slot `extraFields` para campos específicos do kind (categoria NC,
  template de vistoria, vínculo com atividade).
- `enabledFields` para esconder seções que não fazem sentido.
- O dialog **não persiste** — `onSubmit(values)` devolve os dados; o
  consumidor escreve na sua tabela do Supabase.
- Para casos especialistas (state machine, row editor, AI assist) é
  legítimo manter dialog dedicado — o objetivo é compartilhar
  primitivos, não forçar todo dialog num único componente.

---

## 11. ProjectCalendar entity-agnostic

`src/components/calendar/ProjectCalendar.tsx`.

- API: `<ProjectCalendar entities toEvent renderEvent legend onEventClick view>`.
- Views built-in: `month` e `agenda`.
- Layout puro em `projectCalendarLayout.ts` (`buildMonthWeeks`,
  `buildWeekLanes`, `eventsOnDay`) — testado isoladamente.
- Para casos com regras de domínio profundas (etapa anterior atrasada,
  replanejamento, business days), o `CalendarMonthGrid` específico
  segue ativo. Nova feature: prefira `ProjectCalendar`.

---

## 12. Migrações incrementais

Não force "big bang" em refatorações que cruzam dezenas de arquivos.

- Foundation primeiro: hooks puros + componentes pequenos (`scheduleState`,
  `purchaseRisk`, `field-records/*`).
- Migre **um consumidor real** como prova (ex.: `CreateNcDialog` →
  `SeverityField`/`AssigneeField`). Confirma que a abstração serve.
- Documente o que **não** foi migrado e por quê (state machine,
  row editor, AI panel = dialog especialista, mantém).
- Tests unitários cobrindo lib puras + 1 integration por hook
  (vitest + jsdom).
