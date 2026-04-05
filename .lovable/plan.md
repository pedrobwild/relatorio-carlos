
## Diagnóstico

### Problemas identificados:

1. **Bottom padding inconsistente**: `pb-20`, `pb-24`, `pb-16`, `pb-14` espalhados em ~15 arquivos. Os shells (GestaoShell=`pb-16`, ProjectShell=`pb-14`) já aplicam padding, mas páginas filhas TAMBÉM adicionam (`pb-20`, `pb-24`), causando duplo padding.

2. **Safe-area ad-hoc**: `pb-safe` usado em 12 arquivos, mas é classe customizada sem definição clara. Bottom navs usam `pb-safe` mas as páginas não compensam consistentemente.

3. **ResponsivePageShell subutilizado**: Existe mas quase nenhuma página usa — cada página reimplementa `max-w-X mx-auto px-4 sm:px-6 md:px-8`.

4. **useIsMobile() vs CSS**: 8 componentes usam o hook JS, outros usam `md:hidden`/`block md:hidden`. Sem padrão claro de quando usar qual.

5. **Shells com padding inconsistente**: GestaoShell usa `pb-16 md:pb-0`, ProjectShell usa `pb-14 md:pb-0` — deveriam ser iguais.

6. **Sem utilitários de keyboard avoidance**: Formulários em páginas como NovaObra têm sticky CTAs mas sem tratamento de teclado virtual.

7. **Estados (empty/error/loading) não reutilizáveis**: Existem em PortfolioStates.tsx mas são específicos do portfólio, não genéricos.

8. **Touch targets inconsistentes**: Alguns botões/links têm 44px, outros não.

---

## Plano de implementação (por impacto):

### 1. Utilitários CSS globais para safe-area e bottom-nav (~index.css)
- Definir `--bottom-nav-height: 56px` (h-14) como token
- Criar classes utilitárias: `pb-bottom-nav`, `bottom-bottom-nav`, `mb-bottom-nav`
- Padronizar `pb-safe` com fallback correto

### 2. Normalizar shells (GestaoShell + ProjectShell)
- Unificar bottom padding para `pb-[var(--bottom-nav-offset)] md:pb-0`
- Remover paddings duplicados das páginas filhas

### 3. Melhorar ResponsivePageShell como padrão canônico
- Adicionar prop `stickyFooter` para CTAs sticky
- Adicionar suporte a `bottomNavOffset` automático
- Exportar como padrão recomendado

### 4. Criar estados genéricos reutilizáveis
- `EmptyState`, `ErrorState`, `LoadingSkeleton` genéricos em `src/components/ui/`
- Com props para ícone, título, descrição, ação

### 5. Utilitário de keyboard avoidance
- CSS `@supports` com `env(keyboard-inset-height)` + classe `keyboard-aware`

### 6. Normalizar touch targets
- Classe utilitária `touch-target` (min 44x44) no design system

---

**Arquivos a criar/editar:**
- `src/index.css` — tokens e utilitários
- `src/components/mobile/ResponsivePageShell.tsx` — melhorias
- `src/components/layout/GestaoShell.tsx` — normalizar padding
- `src/components/layout/ProjectShell.tsx` — normalizar padding
- `src/components/ui/states.tsx` — estados genéricos (novo)
- `src/components/portfolio/PortfolioPage.tsx` — remover pb-20 ad-hoc

**Não tocar:** desktop layout, sidebar, rotas, lógica de negócio.
