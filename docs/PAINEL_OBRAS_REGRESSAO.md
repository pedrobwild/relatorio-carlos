# QA — Regressão do Painel de Obras (cabeçalhos e ações)

Checklist para validar que ajustes na toolbar, no cabeçalho da tabela
e nas ações por linha do **Painel de Obras** (`/gestao/painel-obras`)
não introduzem quebras de layout, perda de funcionalidade ou regressões
visuais em nenhum breakpoint.

> Página: `src/pages/PainelObras.tsx`
> Companheiros: `docs/PAINEL_OBRAS_STICKY_QA.md`,
> `tests/e2e/painel-obras-sticky.spec.ts`

---

## Pré-requisitos

- Login como Staff (admin/manager/engineer)
- ≥ 3 obras cadastradas com nomes longos, status, etapa e responsáveis variados
- Pelo menos 1 obra com etapa vazia, 1 com responsável vazio e 1 com atraso > 0

---

## 1. Toolbar (linha única densa)

### 1.1 Densidade e alinhamento
- [ ] Toolbar permanece em **linha única** em ≥ 1024px sem wrap
- [ ] Altura dos controles é uniforme (`h-8`/`h-9`); nenhum chip "salta"
- [ ] Divisores verticais aparecem entre grupos (search · filtros · view · ações)
- [ ] Ícones e labels alinham verticalmente (sem deslocamento de baseline)

### 1.2 Search
- [ ] Input ocupa largura confortável (≥ 220px) sem empurrar os filtros
- [ ] Botão "X" aparece apenas quando há texto e limpa a busca ao clicar
- [ ] Foco mostra ring visível e não corta a borda

### 1.3 Filtros
- [ ] Cada chip mostra valor ativo inline (ex.: "Status: 2", "Resp: Nome")
- [ ] Estilo ativo (`border-primary/40 bg-primary/5`) aparece quando há valor
- [ ] Popover de Status alinha à esquerda, sem cortar fora da viewport
- [ ] Selects de Etapa/Relacionamento/Responsável abrem por cima sem corte
- [ ] Contador agregado em "Limpar (N)" reflete soma correta dos filtros
- [ ] Clicar "Limpar" zera todos os filtros e a busca; chips voltam ao neutro

### 1.4 View switcher e densidade
- [ ] Segmented control (Tabela · Board · Kanban) destaca o ativo
- [ ] Toggle de densidade (ícone) alterna padding e altura sem layout shift
- [ ] Trocar de view preserva filtros, busca e ordenação

---

## 2. Cabeçalho da tabela

### 2.1 Sem quebra de linha
- [ ] Todos os headers permanecem em **linha única** (`whitespace-nowrap`)
- [ ] Nenhuma coluna mostra `…` ou caractere isolado (ex.: ".") como label
- [ ] Setas de ordenação ficam coladas ao label, sem wrap

### 2.2 Sticky e scroll
- [ ] Header permanece fixo no topo durante scroll vertical
- [ ] Coluna **Cliente / Obra** (1ª) fica fixa à esquerda em scroll horizontal
- [ ] Coluna **Ações** (última) fica fixa à direita em scroll horizontal
- [ ] Borda direita da sticky-left aparece (separação visual ao rolar)
- [ ] Z-index correto: conteúdo do meio passa por trás das colunas sticky

### 2.3 Larguras responsivas
- [ ] **Desktop ≥ 1280px**: tabela cabe sem scroll horizontal forçado
- [ ] **Tablet 768–1024px**: scroll horizontal aparece sem cortar headers
- [ ] **Mobile < 768px**: cards substituem tabela (vide
      `MobilePainelView`); tabela fica oculta
- [ ] Padding `px-2` em < sm e `px-3` em ≥ sm aplica corretamente
- [ ] Min-widths reduzidos em mobile não fazem header sobrepor outro

### 2.4 Ordenação
- [ ] Clicar em "Início Of.", "Entrega Of.", "Início Real", "Entrega Real",
      "Responsável" e "Atraso" alterna asc → desc → reset
- [ ] Indicador visual (seta) atualiza imediatamente
- [ ] Ordenação persiste ao trocar de view (Tabela ↔ Board ↔ Kanban)
- [ ] Ordenar por "Atraso" coloca obras sem data ao final

---

## 3. Ações por linha

### 3.1 Coluna Ações (sticky-right)
- [ ] Botões/menu de ação não cortam ao rolar horizontalmente
- [ ] Largura `w-12` (mobile) / `w-16` (≥ sm) é suficiente para o ícone
- [ ] Hover/focus no botão não vaza para fora da célula sticky

### 3.2 Expandir linha (chevron)
- [ ] Click expande sem alterar largura da coluna sticky-left (240/200px)
- [ ] `aria-expanded` e `data-expanded` refletem o estado
- [ ] `DailyLogInline` renderiza dentro do `colSpan` total, sem vazar
- [ ] Múltiplas linhas expandidas simultaneamente continuam estáveis

### 3.3 Edição inline
- [ ] Status, Etapa, Relacionamento e Responsável abrem popover/select
      e salvam via `onUpdate` (toast de sucesso)
- [ ] DateCell em "Início Of."/"Entrega Of." pede confirmação (`AlertDialog`)
      antes de gravar
- [ ] Erros de mutation mostram toast e revertem a UI

### 3.4 Excluir
- [ ] Ação "Excluir" abre `AlertDialog` com confirmação destrutiva
- [ ] Cancelar fecha sem alterar nada
- [ ] Confirmar remove a linha após sucesso do servidor (await mutation)

---

## 4. Estados (loading, vazio, erro)

- [ ] Loading: `TableSkeleton` aparece com mesmas larguras das colunas reais
- [ ] Vazio (sem obras): `EmptyState` com CTA visível e ação funcional
- [ ] Vazio com filtros: empty state oferece "Limpar filtros"
- [ ] Erro de fetch: `ErrorState` com botão de retry

---

## 5. Acessibilidade

- [ ] Tab navega por search → chips → view → densidade → linhas → ações
- [ ] Foco visível (ring) em todos os controles interativos
- [ ] Headers ordenáveis têm `aria-sort` correto (asc/desc/none)
- [ ] Botões só com ícone têm `aria-label` descritivo
- [ ] Contraste de chips ativos atende WCAG AA

---

## 6. Performance

- [ ] Trocar densidade ou view não causa flash/layout shift visível
- [ ] Filtrar/ordenar com 50+ obras responde em < 300ms
- [ ] Scroll horizontal/vertical não engasga (60fps em desktop)

---

## Sinais de regressão

❌ Header com texto cortado, quebrado em 2 linhas ou mostrando "."
❌ Coluna sticky perdendo posição ao rolar ou alterando largura ao expandir
❌ Chip de filtro sem estado ativo visual quando há valor selecionado
❌ Toolbar quebrando em 2 linhas em ≥ 1024px sem necessidade
❌ Botão "Limpar" não zerando todos os filtros + busca
❌ Ordenação não persistindo entre views
❌ Ação destrutiva sem `AlertDialog` de confirmação
❌ Tabela aparecendo em mobile (deveria ser `MobilePainelView`)
