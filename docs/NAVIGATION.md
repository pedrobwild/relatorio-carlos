# Navegação — arquitetura

Documenta a árvore única de chrome do Portal BWild. Toda página em `src/pages/`
deve renderizar dentro de um único `AppShell`. Não criar shells novos nem
duplicar headers/sidebars dentro de páginas.

## AppShell — entrada única

`src/components/layout/AppShell.tsx` é a porta de entrada. Recebe `variant` e
delega à implementação concreta:

```
AppShell variant="project"   →  ProjectShell  (rotas /obra/:projectId/*)
AppShell variant="portfolio" →  GestaoShell   (rotas /gestao/*)
AppShell variant="public"    →  AppHeader     (rotas /auth, /recuperar-senha,
                                                /redefinir-senha, /verificar/*)
```

Em `src/App.tsx` as rotas usam `AppShell` diretamente. `ProjectShell` e
`GestaoShell` permanecem como detalhes de implementação — não importar fora do
AppShell.

## Variantes

### `project`

Rota: `/obra/:projectId/*`. Engloba `ProjectProvider` + `AppShell variant="project"`.

```
┌──────────────────────────────────────────────┐
│ ProjectMobileHeader  (mobile, sticky)        │
│ ┌──────────┬───────────────────────────────┐ │
│ │ Project  │  ProjectSlimHeader (desktop)  │ │
│ │ Sidebar  │ ─────────────────────────────  │ │
│ │ (3 grps) │  <main id="main-content">      │ │
│ │          │     {children}                 │ │
│ │          │  </main>                       │ │
│ └──────────┴───────────────────────────────┘ │
│ MobileBottomNav  (mobile only)               │
│ FloatingApprovalBanner                       │
└──────────────────────────────────────────────┘
```

Cliente: sem sidebar, recebe apenas mobile header + bottom nav + banner.

### `portfolio`

Rota: `/gestao/*`. Sidebar de portfólio + header com busca global, sino e menu.

### `public`

Rotas não autenticadas. Renderiza `AppHeader` legacy com logo/login.

## Sidebar do projeto — 3 grupos canônicos

`ProjectSidebar` é organizada em **três grupos**, na ordem de leitura:

1. **Obra** — visão de cima da obra: dashboard, jornada, panorama, cronograma.
2. **Documentação** — contratos, projeto 3D, executivo, documentos, formalizações.
3. **Operação** — dia-a-dia: compras, vistorias, NCs, atividades, assessor,
   pendências, financeiro, dados do cliente, orçamento.

Itens marcados `staffOnly` ou `disabledInProjectPhase` são filtrados em runtime.
Para clientes, o grupo "Documentação" é colapsável (`clientCollapsible`).

## Breadcrumbs

`useObraBreadcrumbs()` (em `src/hooks/useObraBreadcrumbs.ts`) deriva os
breadcrumbs do path atual + nome do projeto + role. `PageHeader` chama o hook
automaticamente quando a prop `breadcrumbs` não é passada — pages não precisam
calcular nada. Para esconder, passar `breadcrumbs={[]}` explicitamente.

Padrão por escopo:

| Escopo                | Crumbs                                                     |
|-----------------------|-----------------------------------------------------------|
| `/gestao/*`           | Gestão → seção                                            |
| `/obra/:id/*`         | Painel de Obras / Minhas obras → Obra → seção             |
| Outras                | (vazio)                                                   |

Labels de seção vêm de `src/content/navigationLabels.ts` (`breadcrumb` map).

## O que não usar

- **`ProjectSubNav`** — removida. Era um sub-nav horizontal vestigial; foi
  consolidada na sidebar.
- **`MobileHeader` inline em `Index.tsx`** — removido. `ProjectMobileHeader`
  do `ProjectShell` é a fonte única.
- **`AppHeader` legacy fora de rotas públicas** — restrita ao `variant="public"`.
- **`<Card>`/`<Badge>` shadcn em pages** — usar `SectionCard`/`StatusBadge`.

## Adicionando uma rota nova

1. Decidir variante: `project` (escopo de uma obra), `portfolio` (gestão geral)
   ou `public` (não autenticada).
2. Em `src/App.tsx`, envolver com `<AppShell variant="...">`. Para rotas de obra,
   usar o wrapper `ProjectPage` (já cuida do provider).
3. Dentro da page, usar `<PageHeader title="..." />` — breadcrumbs aparecem
   automaticamente.
4. Se precisar de aba/sub-navegação dentro do conteúdo, usar `Tabs` do shadcn,
   não criar nova barra de navegação.
