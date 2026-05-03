# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Portal BWild** — gestão de obras com autenticação por roles, documentos, formalizações, cronograma e relatórios semanais.

Stack: React 18 + TypeScript + Vite (SWC) · Tailwind + shadcn/ui · TanStack Query (with localStorage persister) · React Router v6 · Supabase (Postgres + Auth + Storage + Edge Functions) · Zod · Vitest · Playwright. Path alias `@/` → `src/`. Deploys via Lovable; Supabase env vars are injected by the platform.

## Commands

```bash
npm run dev          # Vite dev server on :8080 (HMR is disabled — see vite.config.ts)
npm run build        # Production build
npm run build:dev    # Development-mode build
npm run lint         # ESLint (typescript-eslint + react-hooks + custom z-index rule)
npm run typecheck    # tsc -b --noEmit
npm run test         # Vitest run (unit, jsdom, src/**/*.{test,spec}.tsx)
npm run test:e2e     # Playwright (tests/e2e — needs PLAYWRIGHT_BASE_URL)

npx vitest run path/to/file.test.ts     # single unit test file
npx vitest run -t "name"                # filter by test name
npx playwright test smoke.spec.ts       # CI-equivalent smoke
npx playwright test --ui                # debug UI
```

CI (`.github/workflows/ci.yml`) runs `lint → tsc -b → vitest run → build` on every PR; Playwright smoke runs only on push to `main`.

Auth debug in browser console: `localStorage.setItem('debug_auth', '1')` (logs prefixed `[DBG-AUTH]`, `[DBG-NAV]`, `[DBG-VIS]`).

## Architecture

### Data access — repository pattern (mandatory)

**Never call `supabase.from()` directly from components.** Use the repositories in `src/infra/repositories/`. Each repository wraps queries with `executeQuery` / `executeListQuery` (`base.repository.ts`) and returns `{ data, error }` — callers must check `result.error` before using `result.data`.

```ts
import { documentsRepo, projectsRepo, filesRepo } from '@/infra/repositories';

const result = await projectsRepo.getStaffProjects();
if (result.error) { /* handle */ return; }
```

Edge Functions are invoked via `invokeFunction` / `invokeFunctionRaw` from `src/infra/edgeFunctions.ts` (not `supabase.functions.invoke` directly). The Supabase client is exported from `src/integrations/supabase/client.ts` and re-exported by `@/infra/supabase`. Generated DB types live in `src/integrations/supabase/types.ts` — import these instead of hand-writing interfaces.

### TanStack Query

- `queryClient` (`src/lib/queryClient.ts`) wires global error handling: it translates Supabase/Postgres/RLS/network errors to PT-BR messages via `getUserFriendlyMessage`, auto-signs-out on JWT errors, and retries network errors up to 3× with exponential backoff. Mutations show a "Reconectando…" toast on retries.
- Per-domain `staleTime`/`gcTime` are configured in `QUERY_TIMING` and matched by query-key prefix.
- The whole client is wrapped by `PersistQueryClientProvider` (24h cache, busted by `QUERY_CACHE_VERSION`); it falls back to `QueryClientProvider` when localStorage is unavailable.
- **All query keys live in `src/lib/queryKeys.ts`.** Don't invent ad-hoc keys — extend the structured tree there so invalidation helpers (`invalidateProjectQueries`, etc.) keep working.

Some hooks are still legacy `useState/useEffect` (e.g. `useDocuments`); the modern pattern is the `*Query` hooks (`useDocumentsQuery`, `useProjectsQuery`, `useFilesQuery`, `useOptimizedQueries`). Prefer TanStack Query for new code.

### Auth, roles, permissions

Three layers, all of which must agree:

1. **`useUserRole`** (`src/hooks/useUserRole.ts`) — fetches roles from the `user_roles` table, caches by user id. A user can have **multiple roles**; `roles` is an array. `AppRole` = `customer | engineer | manager | admin | gestor | suprimentos | financeiro | cs | arquitetura`. `isStaff` is true for any non-customer role.
2. **Route guards** (`src/components/ProtectedRoute.tsx`): `ProtectedRoute`, `StaffRoute`, `ManagerRoute`, `CustomerRoute`, `AdminRoute`. Show a skeleton while loading — never redirect during loading.
3. **Feature permissions** — declared in `src/config/permissions.ts` as a `Feature × AppRole` matrix. **Never hardcode role checks in components**; use `useCan().can('documents:upload')` (or `useCanFeature(...)`).

For state-machine modules (purchases, formalizations, NCs, inspections), validation must live in the database via `SECURITY DEFINER` RPCs — see `docs/SECURITY_PATTERNS.md`. Frontend role checks are advisory only.

### Routing & layout shells

`src/App.tsx` defines all routes with `React.lazy`/`Suspense`. Three high-level zones:

- **Public**: `/auth`, `/recuperar-senha`, `/redefinir-senha`, `/verificar/:hash`.
- **Staff (`/gestao/*`)**: wrapped in `<GestaoShell>`. The legacy `/gestao` redirects to `/gestao/painel-obras`.
- **Customer**: `/minhas-obras` (CustomerRoute).
- **Project-scoped (`/obra/:projectId/*`)**: wrapped in `<ProjectPage>` = `ErrorBoundary` + `ProjectProvider` + `<ProjectShell>`. `useProject()` reads the active project; `ProjectContext` re-fetches when `:projectId` changes and clears stale state immediately.
- Root `/` mounts `AuthRedirect`, which routes by role.

### Tailwind / design tokens

Always use semantic tokens, never raw colors: `bg-background`, `text-foreground`, `border-border`, etc. (definitions in `src/index.css` + `tailwind.config.ts`). For overlays (`Dialog`, `Sheet`, `Drawer`, `Popover`, `Select`, `DropdownMenu`, `ContextMenu`, `HoverCard`, `Tooltip`, `Menubar`, `AlertDialog`), there is an **ESLint rule** that blocks overriding `z-*` on `*Content`. The semantic z-scale (`z-modal`, `z-popover`, `z-alert`, …) is defined in `tailwind.config.ts` and safelisted; if a new layer is needed, add a token there. The rule does not apply inside `src/components/ui/**`, which owns the base scale.

### Files / Storage

The `files` table provides a unified, RLS-protected metadata layer (paths `/{org_id}/{project_id}/{yyyy}/{mm}/{uuid}_{filename}`, lifecycle `active → archived → deleted`, SHA-256 dedup). Upload via `filesRepo.uploadFile(...)` and validate with `filesRepo.validateFile(file)`. Storage buckets are private — downloads use signed URLs (≈1h TTL).

### Supabase backend

`supabase/migrations/` is append-only (timestamped SQL). `supabase/functions/` holds Edge Functions; per-function JWT enforcement is configured in `supabase/config.toml` (e.g. `verify-signature`, `get-client-ip`, `signature-certificate`, several `*-inbound` integrations are public). Shared edge utilities live in `supabase/functions/_shared/`.

## Conventions

- **Imports**: always `@/...`; never reach into `src/integrations/supabase` from a component (go through `@/infra/repositories` or `@/infra/edgeFunctions`).
- **No `console.log`** — ESLint allows `console.warn` / `console.error` only. Logging helpers: `src/lib/errorLogger.ts`, `src/lib/devLogger.ts`, `src/lib/errorMonitoring.ts` (`captureError`, `createFeatureErrorCapture('feature')`).
- **Naming**: hooks `useX`, repositories `xRepo` (namespaced via `export * as`), components/types PascalCase.
- **PT-BR** is the user-facing language for messages, toasts, and most code comments.
- **Tests**: Vitest setup (`src/test/setup.ts`) polyfills `matchMedia`, `ResizeObserver`, `IntersectionObserver`, and Radix's pointer-capture / `scrollIntoView` in jsdom — needed for shadcn/Radix tests. Unit tests live alongside code in `__tests__/` folders.

## Reference docs

For deeper context, consult these (don't duplicate their content here):

- `docs/ARCHITECTURE.md` — full architecture overview
- `docs/CONTRIBUTING.md` — feature scaffolding, repo + hook + container template
- `docs/SECURITY_PATTERNS.md` — RLS / RPC patterns (mandatory reading before touching state machines)
- `docs/SMOKE_TESTS.md` — pre-deploy checklist
- `docs/RELEASE_CHECKLIST.md` — release gate
