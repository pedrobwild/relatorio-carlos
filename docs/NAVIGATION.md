# Navigation Architecture

> Bloco 2 — single shell, three variants, automatic breadcrumbs.

This document describes how navigation chrome is composed in Portal BWild after
the Bloco 2 refactor. Use it to decide where new routes live and which shell
variant to wrap them in.

## Decision tree

```
                            ┌────────────────────────┐
                            │   <AppShell variant>   │
                            └───────────┬────────────┘
              ┌─────────────────────────┼─────────────────────────┐
              ▼                         ▼                         ▼
       variant="project"        variant="portfolio"        variant="public"
        (per-obra routes)         (/gestao/* routes)        (/auth, etc.)
              │                         │                         │
   ┌──────────┴──────────┐              │                         │
   ▼                     ▼              ▼                         ▼
isStaff = true     isStaff = false   GestaoSidebar          children only.
─ ProjectSidebar   ─ ProjectMobile-  + GestaoBottomNav      AppHeader is
─ ProjectSlim-       Header          + slim portfolio         the canonical
  Header           ─ MobileBottom-     header (sticky)         chrome on
─ MobileBottom-      Nav             + ShellBreadcrumbs        these routes.
  Nav              ─ FloatingApp-    + AssistantFab
─ FloatingApp-       rovalBanner
  rovalBanner      ─ ShellBread-
─ ShellBread-        crumbs
  crumbs           (no sidebar)
```

## When to use each variant

| Route pattern              | Variant       | Wrapper used in `App.tsx`               |
| -------------------------- | ------------- | --------------------------------------- |
| `/auth`, `/recuperar-…`    | _none_ /      | route renders the page directly;        |
| `/redefinir-…`,            | rendered      | `AppHeader` shows itself when the URL   |
| `/verificar/:hash`         | by AppHeader  | matches `PUBLIC_HEADER_ROUTES`.         |
| `/obra/:projectId/*`       | `project`     | `<ProjectPage>` (wraps `ProjectProvider`|
|                            |               | + `<AppShell variant="project">`)       |
| `/gestao/*`                | `portfolio`   | `<PortfolioPage>` (wraps `<AppShell     |
|                            |               | variant="portfolio">`)                  |
| `/minhas-obras`,           | _none_        | uses `<AppHeader forceRender>` for      |
| `/arquivos`,               |               | now. New customer-facing pages should   |
| legacy `Home`              |               | move into a shell variant when ready.   |

## Project shell — internal layout

The project shell decides between staff and client compositions based on
`useUserRole().isStaff`:

* **Staff** — gets the desktop sidebar (`ProjectSidebar`) plus
  `ProjectSlimHeader` (desktop) and `ProjectMobileHeader` (mobile). The bottom
  nav is `MobileBottomNav` which exposes 4 quick links + a "Mais" sheet that
  surfaces the entire navigation tree.
* **Client** — no sidebar; only `ProjectMobileHeader`, the `ShellBreadcrumbs`
  strip and `MobileBottomNav` (3 items + Avisos, no "Mais"). Both compositions
  render `FloatingApprovalBanner` so urgent approvals stay visible.

`ProjectSidebar` was reorganized into **3 canonical groups**:

| Group           | Items                                                              |
| --------------- | ------------------------------------------------------------------ |
| **Obra**        | dashboard · jornada · obra (relatorio)                             |
| **Documentação**| contrato · projeto3D · executivo · documentos · formalizações      |
| **Operação**    | cronograma · compras · vistorias · não-conformidades · atividades · pendências · financeiro · dados do cliente |

Groups are separated by a thin `border-t border-border-subtle` line — the
repeated gray label header was dropped to reduce visual noise.

## Breadcrumbs

`useObraBreadcrumbs()` derives a canonical trail from the URL + role:

* `/obra/:id/<section>` → `[Painel de Obras / Minhas Obras, Project Name, Section]`
* `/gestao/<...segments>` → `[Gestão, …segment labels]`

The trail is rendered by `<ShellBreadcrumbs>`, which `AppShell` mounts under
the slim header for both `project` and `portfolio` variants. Pages no longer
have to declare their own breadcrumbs to satisfy the "100% pages show
breadcrumb" rule — they get one for free from the shell.

Pages may still pass a richer trail to `<PageHeader breadcrumbs={…}>`; that
component continues to honour the prop (used for pages with custom hierarchy
such as Pendências sub-views).

## Bottom nav badge

`useHiddenSectionsBadge(visibleNavTos)` sums pending counts that aren't
represented in the main bottom-nav bar. The number renders on the "Mais"
button as a destructive badge with a screen-reader-friendly `aria-live`
announcement so badge changes are heard, not just seen.

## Removed components

* `src/components/layout/ProjectShell.tsx` (subsumed by `AppShell`)
* `src/components/layout/GestaoShell.tsx` (subsumed by `AppShell`)
* `src/components/layout/ProjectSubNav.tsx` (redundant once the sidebar +
  breadcrumb bar handle navigation; the page-level imports were also stripped)
* Inline `MobileHeader` defined inside `src/pages/Index.tsx` — the slim header
  in the project shell covers this case for clients.

## Adding a new route

1. Add the lazy import to `src/App.tsx`.
2. Pick the right wrapper:
   * obra-scoped page → `<ProjectPage>{withSuspense(<MyPage />)}</ProjectPage>`
   * `/gestao/*` page → `<PortfolioPage>{withSuspense(<MyPage />)}</PortfolioPage>`
   * public auth flow → render the page directly; ensure the URL is in
     `PUBLIC_HEADER_ROUTES` if you want `AppHeader` to show.
3. If the new section needs a sidebar entry, extend `ProjectSidebar` /
   `GestaoSidebar` and add the breadcrumb label in
   `src/constants/navigationLabels.ts` so `useObraBreadcrumbs` can render it.
4. **Do not** add a hand-rolled header inside the page — that brings back the
   "header duplication" class of bugs Bloco 2 fixed.
