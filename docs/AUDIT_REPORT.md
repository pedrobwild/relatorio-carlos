# Auditoria de Qualidade — Portal BWild

**Data**: 2026-02-21 (Atualização completa)  
**Auditor**: Lovable AI (Engenheiro Sênior Full-Stack)  
**Escopo**: Repositório completo (código, CI, docs, testes, segurança)

---

## Resumo Executivo

O projeto segue uma arquitetura bem definida (Repositories → Hooks → UI, TanStack Query, ErrorBoundary, RLS em todas as tabelas). Porém existem **inconsistências operacionais** entre package.json, CI e documentação, além de **violações de arquitetura** (18 arquivos acessam Supabase diretamente) e **type safety fraco** (`strict: false`).

### Pontos Fortes ✅

- Arquitetura em camadas documentada (ARCHITECTURE.md, CONTRIBUTING.md)
- RLS ativo em todas as tabelas
- DOMPurify em todos os `dangerouslySetInnerHTML` (sem XSS)
- ErrorBoundary global com captureError contextual
- Code splitting com lazy loading em 28 rotas
- Domain Events para rastreabilidade
- Audit trail automático via triggers
- Edge Functions com módulos compartilhados (_shared/)
- Testes E2E cobrindo fluxos críticos (10 specs Playwright)

---

## Top 10 Riscos / Inconsistências

| # | Risco | Severidade | Categoria |
|---|-------|-----------|-----------|
| 1 | **Scripts npm faltantes** (`typecheck`, `test`, `smoke`, `test:e2e`, `seed`) — `npm test` falha | P0 | CI/DX |
| 2 | **18 componentes/páginas acessam `supabase` direto** (violação da camada Repositories) | P1 | Arquitetura |
| 3 | **`strict: false` e `noImplicitAny: false`** no tsconfig — anula type safety | P1 | Type Safety |
| 4 | **535 usos de `as any`** em 26 arquivos (maioria em hooks p/ tabelas fora do types gerado) | P2 | Type Safety |
| 5 | **`@playwright/test` em dependencies** em vez de devDependencies | P1 | Build |
| 6 | **`useAuth.ts` constrói chave localStorage manualmente** (L140) — depende de naming interno do SDK | P2 | Segurança/Fragilidade |
| 7 | **`noFallthroughCasesInSwitch: false`** — permite bugs silenciosos em switch | P2 | Type Safety |
| 8 | **Hooks legados** com useState/useEffect direto em vez de TanStack Query | P2 | Performance/DX |
| 9 | **Páginas possivelmente não usadas** (Suporte.tsx, Demo.tsx) | P2 | Manutenibilidade |
| 10 | **Edge Functions duplicam `corsHeaders`** localmente em vez de importar `_shared/cors.ts` | P2 | Consistência |

---

## Baseline Status

### Infraestrutura de Qualidade

| Comando | Existe em package.json? | CI usa? | Status |
|---------|------------------------|---------|--------|
| `npm run lint` | ✅ | ✅ `npm run lint` | Funciona |
| `npm run build` | ✅ | ✅ `npm run build` | Funciona |
| `npm run typecheck` | ❌ | ⚠️ Usa `npx tsc -b` | CI OK, npm script falta |
| `npm run test` | ❌ | ⚠️ Usa `npx vitest run` | CI OK, npm script falta |
| `npm run smoke` | ❌ | N/A | Não existe |
| `npm run test:e2e` | ❌ | ⚠️ Usa `npx playwright test` | CI OK, npm script falta |
| `npm run seed` | ❌ | N/A | Não existe |

> **Nota**: O CI funciona porque usa `npx` diretamente. A falta de scripts npm afeta apenas a DX local.
> Scripts npm não podem ser adicionados diretamente (package.json é read-only neste ambiente).

### Resultados de Testes (Baseline)

| Suite | Status | Notas |
|-------|--------|-------|
| Vitest unit tests | ⚠️ Não executável via `npm test` | Funciona com `npx vitest run` |
| Playwright E2E | ✅ | 10 specs, smoke subset no CI |
| Build | ✅ | Sem erros |
| Lint (ESLint) | ✅ | Warnings existem (console, any) |

### Aderência à Arquitetura

| Padrão | Aderência | Detalhes |
|--------|-----------|---------|
| Repositories pattern | ~70% | 18 arquivos violam (12 componentes + 6 páginas) |
| TanStack Query | ~65% | Hooks legados com useState/useEffect restantes |
| ErrorBoundary | ✅ 100% | Em todas as rotas e componentes críticos |
| RLS | ✅ 100% | Todas as tabelas |
| DOMPurify + sanitização | ✅ 100% | 9 usos, todos com DOMPurify |
| Semantic CSS tokens | ~90% | Poucos hardcoded colors restantes |
| Mobile-first | ✅ | Pull-to-refresh, responsive shells |

---

## Achados por Categoria

### A) Qualidade / Consistência

| Achado | Prioridade | Esforço | Risco |
|--------|-----------|---------|-------|
| 18 arquivos acessam supabase direto (violação Repositories) | P1 | Médio | Baixo |
| Suporte.tsx duplica lógica de Formalizacoes.tsx (getStatusIcon, getTypeIcon) | ✅ Resolvido | — | — |
| FormalizacoesContent.tsx duplica mesmos helpers | ✅ Resolvido | — | — |
| Docs referenciam scripts npm inexistentes (nota de aviso presente) | P1 | Baixo | Nenhum |

#### Componentes que violam Repositories (acessam `supabase` direto)

**✅ Migrados (7):**
- `ProjectCardSummary.tsx` → `journeyRepo`
- `JourneyCSMSection.tsx` → `journeyRepo`
- `DigitalSignatureLog.tsx` → `formalizationsRepo`
- `FormalizacaoEvidence.tsx` → `formalizationsRepo`
- `FilesCleanupCard.tsx` → `invokeFunction`
- `DocumentUpload.tsx` → `invokeFunctionRaw`
- `DocumentVersionUpload.tsx` → `invokeFunctionRaw`

**📋 Pendentes - Componentes (5):**
- `CreateTestFormalizacao.tsx`, `ObrasTab.tsx`, `UsersTab.tsx`
- `DuplicateProjectModal.tsx`, `VersionsListModal.tsx`

**📋 Pendentes - Páginas (5):**
- `EditarObra.tsx`, `FormalizacaoNova.tsx`, `FormalizacaoDetalhe.tsx`
- `VerificarAssinatura.tsx`, `NovaObra.tsx`

**✅ Aceito (usa supabase.auth diretamente):**
- `Auth.tsx`

### B) Type Safety & Robustez

| Achado | Prioridade | Esforço | Risco |
|--------|-----------|---------|-------|
| `strict: false` + `noImplicitAny: false` no tsconfig | P1 | Alto | Médio |
| 535 `as any` em 26 arquivos | P2 | Alto | Baixo |
| `noFallthroughCasesInSwitch: false` | P2 | Baixo | Nenhum |
| Hooks como `useStageRecords` usam `as any` para tabelas fora do types gerado | P2 | Médio | Baixo |

### C) Segurança

| Achado | Status | Notas |
|--------|--------|-------|
| dangerouslySetInnerHTML + DOMPurify | ✅ OK | 9 usos, todos sanitizados |
| CORS `*` em Edge Functions | ✅ OK | Padrão correto para funções atrás de auth |
| errorMonitoring não lê localStorage | ✅ Fixado | Auditoria anterior corrigiu |
| `useAuth.ts` localStorage cleanup manual (L140-147) | ⚠️ P2 | Intencional como fallback, mas frágil |
| Edge Functions usam _shared/auth.ts para validação | ✅ OK | Padrão centralizado |
| Buckets públicos (weekly-reports, project-documents) | ✅ Documentado | RLS protege escrita |

### D) Performance & UX

| Achado | Prioridade | Notas |
|--------|-----------|-------|
| useDocuments staleTime=2min, refetchOnWindowFocus=true | ✅ OK | Recentemente otimizado |
| QueryPersister com cache 24h | ✅ OK | Com buster de versão |
| Code splitting em todas as rotas | ✅ OK | 28 rotas com lazy loading |
| TabDiscardDetector para mobile | ✅ OK | Previne perda de sessão |

### E) Testes e Confiabilidade

| Achado | Prioridade | Notas |
|--------|-----------|-------|
| 10 specs E2E com data-testid estáveis | ✅ OK | Cobertura de fluxos críticos |
| Smoke tests manuais documentados (SMOKE_TESTS.md) | ✅ OK | 10 passos, ~15min |
| Unit tests em hooks, componentes, lib, config, repositories | ✅ OK | Via vitest |
| Script `npm test` inexistente | P0 | Funciona com `npx vitest run` |

---

## Lista Priorizada

### P0 — Quebra CI / DX

| Item | Esforço | Status |
|------|---------|--------|
| Scripts npm faltantes (typecheck, test, etc.) | Baixo | ⚠️ Requer edição do package.json |
| Docs alinhados com comandos reais | Baixo | ✅ Já feito (notas de npx) |
| CI funcional | N/A | ✅ Usa npx diretamente |

### P1 — Hardening

| Item | Esforço | Risco |
|------|---------|-------|
| Habilitar `noFallthroughCasesInSwitch: true` | Baixo | Nenhum |
| Mover @playwright/test para devDependencies | Baixo | Nenhum |
| Migrar acessos diretos ao supabase para repositories (18 arquivos) | Médio | Baixo |
| Habilitar `strict: true` gradualmente | Alto | Médio |

### P2 — Refactors Seguros (Backlog)

| Item | Esforço | Risco |
|------|---------|-------|
| Reduzir 535 `as any` | Alto | Baixo |
| Consolidar helpers duplicados (status icons, type labels) | Médio | Nenhum |
| Consolidar corsHeaders em Edge Functions | Baixo | Nenhum |
| Migrar hooks legados para TanStack Query | Alto | Médio |
| Refatorar useAuth.ts localStorage cleanup | Baixo | Médio |

---

## Plano de Execução

### Onda 1 — Quick Wins (P0) ✅ Concluída

1. ✅ CI alinhado (usa `npx` diretamente)
2. ✅ Docs com notas sobre comandos npx
3. ✅ Dead code removido (debugAuthNav.ts, useProjects.ts)
4. ✅ errorMonitoring localStorage fix
5. ✅ telemetry.ts environment detection fix

### Onda 2 — Hardening (P1) ✅ Aplicada

1. ✅ `noFallthroughCasesInSwitch: true` no tsconfig
2. ⚠️ Mover @playwright/test para devDependencies (requer package.json)
3. 📋 Migrar 18 arquivos para usar Repositories (documentado, não implementado — risco médio)

### Onda 3 — Refactors Seguros (P2) — Parcialmente Aplicada

1. ✅ Consolidar helpers duplicados (status icons em Formalizacoes, Suporte, FormalizacoesContent) → `src/lib/formalizationHelpers.tsx`
2. ✅ Consolidar corsHeaders em Edge Functions → todas importam de `_shared/cors.ts`
3. 📋 Habilitar `strict: true` gradualmente
4. 📋 Reduzir `as any` (começar pelos hooks, depois componentes)

---

## Mapa do Projeto

### Pastas Principais

```
src/
├── components/          # ~130 componentes React
│   ├── ui/             # shadcn base components (~50)
│   ├── admin/          # Painel administrativo
│   ├── formalizacao/   # Formalização digital
│   ├── journey/        # Jornada do projeto (~30 componentes)
│   ├── report/         # Relatórios semanais
│   ├── tabs/           # Conteúdo de abas
│   ├── mobile/         # Wrappers mobile-first
│   ├── header/         # KPIs e status
│   └── layout/         # Layout base
├── hooks/              # ~40 custom hooks
├── infra/repositories/ # Data access layer (5 repos)
├── lib/                # ~20 utilitários
├── pages/              # ~25 páginas
├── contexts/           # ProjectContext
├── config/             # env, flags, permissions
├── types/              # Tipos compartilhados
└── test/               # Setup e mocks

supabase/
├── functions/          # 14 Edge Functions
│   └── _shared/        # Módulos compartilhados (cors, auth, errorLogger)
└── migrations/         # Migrações SQL

tests/e2e/              # 10 specs Playwright
docs/                   # 6 documentos de qualidade
```

### Entrypoints

- `src/main.tsx` → `src/App.tsx` (router com lazy loading)
- 28 rotas com code splitting
- 4 tipos de guards: ProtectedRoute, StaffRoute, CustomerRoute, AdminRoute

### Padrões Adotados

- **Repositories**: `src/infra/repositories/` (documentsRepo, projectsRepo, filesRepo, auditoriaRepo, diagnosticsRepo)
- **Hooks**: TanStack Query + hooks legados com useState
- **Error Monitoring**: `src/lib/errorMonitoring.ts` (captureError, createFeatureErrorCapture)
- **Dev Logger**: `src/lib/devLogger.ts` (scoped, DEV-only)
- **Audit Trail**: Tabela `auditoria` com trigger automático
- **Domain Events**: Tabela `domain_events` para rastreabilidade
- **RBAC**: Via `profiles.role` + `project_members` + functions SQL
- **Telemetry**: `src/lib/telemetry.ts` (track events, optional DB persist)

### Divergências Identificadas

| Fonte | Comando | Real? |
|-------|---------|-------|
| docs/QA.md | `npm run test` | ❌ (nota de aviso presente) |
| docs/SMOKE_TESTS.md | `npm run smoke` | ❌ (nota de aviso presente) |
| docs/ARCHITECTURE.md | `npm run test` | ❌ (referência no texto) |
| CI (ci.yml) | `npx tsc -b`, `npx vitest run` | ✅ Correto |
| package.json | Apenas `dev`, `build`, `build:dev`, `lint`, `preview` | ✅ |
