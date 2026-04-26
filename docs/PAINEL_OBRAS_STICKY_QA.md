# QA — Coluna sticky "Cliente / Obra" no Painel de Obras

Checklist visual e de comportamento para garantir que a coluna sticky
**Cliente / Obra** continue truncando corretamente e não cause
sobreposição com as colunas adjacentes (Status, Etapa, etc.) ao expandir
linhas, em mobile e desktop.

> Página: `/gestao/painel-obras` (componente `src/pages/PainelObras.tsx`)
> Largura fixa esperada: `w-[240px] min-w-[240px] max-w-[240px]`

---

## Pré-requisitos

- Login como Staff (admin/manager/engineer)
- Pelo menos 1 obra cadastrada com:
  - **Nome de cliente longo** (≥ 30 caracteres, ex.: "Construtora Empreendimentos Imobiliários Ltda")
  - **Nome de obra longo** (≥ 25 caracteres)
  - Status, etapa e responsável preenchidos
- Idealmente, 3+ linhas para validar comportamento ao expandir múltiplas

---

## 1. Desktop (≥ 1280px)

### 1.1 Estado inicial (linhas recolhidas)
- [ ] Coluna **Cliente / Obra** ocupa exatamente 240px (medir com DevTools)
- [ ] Nome do cliente longo é truncado com reticências (`…`) — NÃO quebra linha
- [ ] Nome da obra longo é truncado com reticências
- [ ] Coluna **Status** aparece imediatamente à direita, sem sobreposição
- [ ] Header **Status** está totalmente visível (não aparece como `.`)
- [ ] Coluna **Etapa** mantém seu min-width e está legível
- [ ] Sombra/borda direita (`border-r`) da coluna sticky está visível ao rolar horizontalmente

### 1.2 Linha expandida (1 linha)
- [ ] Clicar no chevron expande a linha sem alterar a largura da coluna sticky
- [ ] Conteúdo da linha expandida (DailyLogInline) NÃO empurra/expande a coluna Cliente
- [ ] Truncamento do nome do cliente continua funcionando
- [ ] Status e Etapa permanecem na mesma posição visual

### 1.3 Múltiplas linhas expandidas
- [ ] Expandir 2-3 linhas simultaneamente
- [ ] Nenhuma das colunas (sticky ou não) muda de largura
- [ ] Scroll vertical funciona normalmente
- [ ] Header sticky (`top-0`) permanece visível ao rolar

### 1.4 Scroll horizontal
- [ ] Rolar horizontalmente a tabela
- [ ] Coluna Cliente/Obra permanece fixa à esquerda (`sticky left-0`)
- [ ] Coluna Ações permanece fixa à direita (`sticky right-0`)
- [ ] Conteúdo do meio rola por baixo das colunas sticky (z-index correto)
- [ ] Linhas expandidas acompanham o scroll horizontal sem vazar

---

## 2. Mobile (375px e 414px)

> Use o seletor de viewport do preview ou DevTools (iPhone SE / iPhone 12)

### 2.1 Estado inicial
- [ ] Tabela apresenta scroll horizontal (não há overflow visual)
- [ ] Coluna Cliente/Obra mantém 240px e fica fixa à esquerda
- [ ] Nome do cliente longo é truncado — sem sobreposição com Status
- [ ] Badges de status estão totalmente visíveis (não cortados pela sticky)

### 2.2 Linha expandida no mobile
- [ ] Conteúdo expandido (DailyLogInline) ocupa 1 coluna sem cortes
- [ ] Largura da coluna Cliente continua 240px após expandir
- [ ] Skeleton/shimmer durante carregamento não causa layout shift
- [ ] Ao fechar a linha, a coluna volta ao estado anterior sem "pulo"

### 2.3 Touch / scroll
- [ ] Scroll horizontal por gesto funciona suavemente
- [ ] Coluna sticky não "treme" durante o scroll
- [ ] Tap no chevron expande a linha (área de toque ≥ 24x24px)

---

## 3. Edge cases

- [ ] Cliente sem nome (vazio) — renderiza placeholder `—` sem quebrar layout
- [ ] Obra sem etapa atual — não colapsa coluna Etapa
- [ ] Filtros aplicados resultando em 0 linhas — empty state ocupa largura total
- [ ] Trocar de filtro com linhas expandidas — estado é resetado limpo

---

## 4. Verificação automatizada (opcional)

Veja `tests/e2e/painel-obras-sticky.spec.ts` para validação automatizada
de truncamento e largura fixa em viewports mobile e desktop.

```bash
npx playwright test painel-obras-sticky.spec.ts
```

---

## Sinais de regressão

Se qualquer item abaixo aparecer, há regressão:

- ❌ Header "Status" aparecendo como `.` ou cortado
- ❌ Badge "Em dia" sobrepondo o nome do cliente
- ❌ Coluna Cliente/Obra com largura > 240px após expandir linha
- ❌ Nome de cliente quebrando em 2 linhas em vez de truncar
- ❌ Conteúdo expandido vazando para fora da linha
- ❌ Scroll horizontal "engasgando" ou coluna sticky perdendo posição
