# Audit Changelog — Portal BWild

**Última atualização**: 2026-02-21

---

## Rodada 1 (2026-02-21) — Fase 0 + Fase 1

### 1. CI: Corrigir typecheck fantasma (P0)

**Arquivo**: `.github/workflows/ci.yml`  
**O que mudou**: `npm run typecheck` → `npx tsc -b`  
**Por quê**: O script `typecheck` não existe no package.json.  
**Como testar**: CI build job deve passar sem erro no step "Run type check".

### 2. Docs: Alinhar QA.md com comandos reais (P0)

**Arquivo**: `docs/QA.md`  
**O que mudou**: Substituídos `npm run <script-inexistente>` por `npx` diretos. Nota de aviso adicionada.  
**Por quê**: Docs referenciavam 6 scripts inexistentes.  
**Como testar**: Executar cada comando documentado.

### 3. Docs: Alinhar SMOKE_TESTS.md (P0)

**Arquivo**: `docs/SMOKE_TESTS.md`  
**O que mudou**: Substituído `npm run smoke` por sequência explícita de comandos.  
**Por quê**: Script `smoke` não existe.  
**Como testar**: Seguir os passos documentados.

### 4. Docs: Alinhar RELEASE_CHECKLIST.md (P0)

**Arquivo**: `docs/RELEASE_CHECKLIST.md`  
**O que mudou**: Comandos de typecheck e testes atualizados para `npx`.  
**Como testar**: Verificar cada comando listado é executável.

### 5. Segurança: Remover leitura de localStorage em errorMonitoring (P0)

**Arquivo**: `src/lib/errorMonitoring.ts`  
**O que mudou**: Removida leitura de `sb-auth-token` do localStorage. Context agora recebe userId/role do caller.  
**Por quê**: Chave incorreta e depender de internals do SDK é frágil.  
**Como testar**: `captureError(new Error('test'), { feature: 'general' })` — deve logar sem userId/role.

### 6. Bug: Corrigir detecção de ambiente em telemetry.ts (P0)

**Arquivo**: `src/lib/telemetry.ts`  
**O que mudou**: `process.env.NODE_ENV` → `import.meta.env.DEV`  
**Por quê**: Projetos Vite não definem `process.env.NODE_ENV`.  
**Como testar**: Logs de telemetria devem aparecer apenas em DEV.

### 7. Dead Code: Remover debugAuthNav.ts (P1)

**Arquivo**: `src/lib/debugAuthNav.ts` (deletado)  
**Por quê**: Sem importações. Duplicado com `debugAuth.ts`.

### 8. Dead Code: Remover useProjects.ts legado (P1)

**Arquivo**: `src/hooks/useProjects.ts` (deletado)  
**Por quê**: Deprecated, sem importações. Substituído por `useProjectsQuery.ts`.

---

## Rodada 2 (2026-02-21) — Atualização Completa

### 9. Type Safety: Habilitar noFallthroughCasesInSwitch (P1)

**Arquivo**: `tsconfig.app.json`  
**O que mudou**: `noFallthroughCasesInSwitch: false` → `noFallthroughCasesInSwitch: true`  
**Por quê**: Permite que o compilador detecte bugs silenciosos em switch/case sem break/return. Verificado que todos os 180 switch statements no codebase já usam return em cada case — zero risco de regressão.  
**Como testar**: `npx tsc -b` deve passar sem erros novos.

### 10. Docs: Alinhar ARCHITECTURE.md com comandos reais (P0)

**Arquivo**: `docs/ARCHITECTURE.md`  
**O que mudou**: Seção "Executar Testes" atualizada de `npm run test` para comandos `npx` reais (`npx vitest run`, `npx tsc -b`, `npx playwright test`).  
**Por quê**: Consistência com os demais docs. O script `npm run test` não existe no package.json.  
**Como testar**: Executar cada comando listado.

### 11. Docs: Atualizar AUDIT_REPORT.md (Fase 0 completa)

**Arquivo**: `docs/AUDIT_REPORT.md`  
**O que mudou**: Relatório completo atualizado com inventário fresco, baseline status, top 10 riscos, achados por categoria (Qualidade, Type Safety, Segurança, Performance, Testes), lista priorizada e plano de execução em 3 ondas.  
**Por quê**: Entregável obrigatório da auditoria.

---

## Itens Documentados para Implementação Futura

### P1 (Próxima Rodada)

| Item | Esforço | Risco | Detalhes |
|------|---------|-------|---------|
| Mover `@playwright/test` para devDependencies | Baixo | Nenhum | Requer package.json |
| Migrar 18 arquivos que acessam supabase direto para Repositories | Médio | Baixo | 12 componentes + 6 páginas |
| Adicionar scripts npm (`typecheck`, `test`, `smoke`, etc.) | Baixo | Nenhum | Requer package.json |

### P2 (Backlog)

| Item | Esforço | Risco | Detalhes |
|------|---------|-------|---------|
| Habilitar `strict: true` no tsconfig | Alto | Médio | Muitos erros de tipo implícito |
| Reduzir 535 `as any` | Alto | Baixo | Maioria em hooks/testes |
| Consolidar helpers duplicados (status icons) | Médio | Nenhum | Formalizacoes, Suporte, FormalizacoesContent |
| Consolidar corsHeaders em Edge Functions | Baixo | Nenhum | 10+ funções duplicam |
| Refatorar useAuth.ts localStorage cleanup (L140-147) | Baixo | Médio | Fallback intencional |
| Migrar hooks legados para TanStack Query | Alto | Médio | ~35% dos hooks |
