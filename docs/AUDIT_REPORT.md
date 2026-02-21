# Auditoria de Qualidade — Portal BWild

**Data**: 2026-02-21  
**Auditor**: Lovable AI (Engenheiro Sênior Full-Stack)  
**Escopo**: Repositório completo (código, CI, docs, testes, segurança)

---

## Resumo Executivo

O projeto é bem estruturado (camada Repositories, TanStack Query, ErrorBoundary, RLS) e segue boas práticas de arquitetura. Porém existem **inconsistências operacionais críticas** entre package.json, CI e documentação que impedem um pipeline de qualidade confiável.

---

## Top 10 Riscos / Inconsistências

| # | Risco | Severidade | Categoria |
|---|-------|-----------|-----------|
| 1 | **CI chama `npm run typecheck` que não existe** em package.json | P0 | CI/DX |
| 2 | **Docs referenciam 6 scripts inexistentes** (`test`, `typecheck`, `smoke`, `test:e2e`, `test:e2e:ui`, `seed`) | P0 | Docs/DX |
| 3 | **`strict: false` e `noImplicitAny: false`** no tsconfig.app.json — anula type safety | P1 | Type Safety |
| 4 | **`@playwright/test` em dependencies** em vez de devDependencies — infla bundle de produção | P1 | Build |
| 5 | **Componentes acessam `supabase` diretamente** em vez de usar repositories (violação da arquitetura documentada) | P1 | Arquitetura |
| 6 | **`noFallthroughCasesInSwitch: false`** — permite bugs silenciosos em switch/case | P2 | Type Safety |
| 7 | **Hooks legados** com useState/useEffect direto em vez de TanStack Query | P2 | Performance/DX |
| 8 | **Sem script `test` no package.json** — `npm test` falha | P0 | CI/DX |
| 9 | **Dead code** potencial (páginas Suporte, Demo, componentes não referenciados) | P2 | Manutenibilidade |
| 10 | **`no-console` warn** mas muitos `console.info/log` em produção code | P2 | Qualidade |

---

## Baseline Status

### Infraestrutura de Qualidade

| Comando | Status | Notas |
|---------|--------|-------|
| `npm run lint` | ✅ Existe | Funciona (eslint flat config) |
| `npm run build` | ✅ Existe | Funciona |
| `npm run typecheck` | ❌ **NÃO EXISTE** | CI depende dele — falha silenciosa |
| `npm run test` | ❌ **NÃO EXISTE** | Vitest instalado mas sem script |
| `npm run smoke` | ❌ **NÃO EXISTE** | Docs e checklist referenciam |
| `npm run test:e2e` | ❌ **NÃO EXISTE** | Docs referenciam |
| `npm run test:e2e:ui` | ❌ **NÃO EXISTE** | Docs referenciam |
| `npm run seed` | ❌ **NÃO EXISTE** | Docs referenciam |
| CI Build job | ⚠️ Quebrado | `npm run typecheck` vai falhar |
| CI E2E job | ✅ OK | Usa `npx playwright test` diretamente |

### Arquitetura (Aderência aos Padrões Documentados)

| Padrão | Aderência | Notas |
|--------|-----------|-------|
| Repositories pattern | ~70% | Vários hooks/componentes acessam supabase direto |
| TanStack Query | ~60% | Hooks legados com useState/useEffect |
| ErrorBoundary | ✅ | Bem implementado nas rotas |
| RLS | ✅ | Todas as tabelas com RLS |
| Semantic tokens | ~90% | Poucos hardcoded colors restantes |
| Mobile-first | ✅ | Otimizações recentes aplicadas |

---

## Lista Priorizada

### P0 — Quebra CI / DX (Fase 1)

| Item | Esforço | Risco |
|------|---------|-------|
| Adicionar scripts faltantes ao package.json | Baixo | Nenhum |
| Alinhar docs (QA.md, SMOKE_TESTS.md, RELEASE_CHECKLIST.md) com scripts reais | Baixo | Nenhum |

### P1 — Hardening (Fase 2)

| Item | Esforço | Risco |
|------|---------|-------|
| Habilitar `strict: true` gradualmente no tsconfig | Alto | Médio (muitos erros) |
| Mover @playwright/test para devDependencies | Baixo | Nenhum |
| Migrar acessos diretos ao supabase para repositories | Médio | Baixo |
| Revisar sanitização HTML (DOMPurify usage) | Baixo | Nenhum |

### P2 — Refactors Seguros (Fase 3)

| Item | Esforço | Risco |
|------|---------|-------|
| Migrar hooks legados para TanStack Query | Alto | Médio |
| Remover dead code / páginas não usadas | Médio | Baixo |
| Consolidar helpers repetidos | Médio | Baixo |
| Habilitar `noFallthroughCasesInSwitch` | Baixo | Baixo |

---

## Plano de Execução

### Onda 1 — Quick Wins (P0) ✅ Concluída

1. ~~Alinhar CI com comandos reais~~ ✅
2. ~~Alinhar documentação com scripts reais~~ ✅
3. ~~Validar que CI passa com os novos scripts~~ ✅

### Onda 2 — Auditoria Técnica (P0/P1) ✅ Concluída

1. ~~Remover dead code: `debugAuthNav.ts` (sem importações)~~ ✅
2. ~~Remover hook legado: `useProjects.ts` (deprecated, sem consumidores)~~ ✅
3. ~~Corrigir segurança: `errorMonitoring.ts` lia chave localStorage incorreta (`sb-auth-token`)~~ ✅
4. ~~Corrigir bug: `telemetry.ts` usava `process.env.NODE_ENV` em vez de `import.meta.env.DEV`~~ ✅

#### Achados documentados (P1/P2 — não implementados):

| Achado | Prioridade | Detalhes |
|--------|-----------|---------|
| 535 usos de `as any` em 26 arquivos | P2 | Maioria em testes ou casts Supabase p/ tabelas fora do types gerado |
| Edge functions duplicam `corsHeaders` localmente | P2 | Devem importar de `_shared/cors.ts` |
| `useAuth.ts` constrói chave localStorage manualmente (L140) | P2 | Frágil — depende de naming interno do SDK |
| `useDocuments.ts` acessa supabase diretamente | P1 | Deveria usar documents.repository |
| Todas `dangerouslySetInnerHTML` usam DOMPurify ✅ | — | Sem vulnerabilidades XSS encontradas |
| CORS `*` nas Edge Functions | — | Padrão correto p/ funções atrás de auth |

### Onda 3 — Refactors Seguros (P2) — Backlog

1. Migração gradual de hooks para TanStack Query
2. Consolidar corsHeaders nas Edge Functions
3. Habilitar `strict: true` gradualmente
4. Documentar "do/don't" no CONTRIBUTING.md

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
docs/                   # 5 documentos de qualidade
```

### Entrypoints

- `src/main.tsx` → `src/App.tsx` (router com lazy loading)
- 28 rotas com code splitting
- 4 tipos de guards: ProtectedRoute, StaffRoute, CustomerRoute, AdminRoute

### Padrões Adotados

- **Repositories**: `src/infra/repositories/` (documentsRepo, projectsRepo, filesRepo, etc.)
- **Hooks**: TanStack Query + hooks legados com useState
- **Error Monitoring**: `src/lib/errorMonitoring.ts` (captureError, createFeatureErrorCapture)
- **Audit Trail**: Tabela `auditoria` com trigger automático
- **RBAC**: Via `users_profile.perfil` + `user_roles` + functions SQL
- **Domain Events**: Tabela `domain_events` para rastreabilidade
