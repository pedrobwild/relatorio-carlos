# Audit Changelog — Portal BWild

**Data**: 2026-02-21

---

## Mudanças Aplicadas

### 1. CI: Corrigir typecheck fantasma (P0)

**Arquivo**: `.github/workflows/ci.yml`  
**O que mudou**: `npm run typecheck` → `npx tsc -b`  
**Por quê**: O script `typecheck` não existe no `package.json`. O CI falharia silenciosamente ou quebraria ao tentar executá-lo. `npx tsc -b` executa o TypeScript compiler diretamente usando os tsconfig references do projeto.  
**Como testar**: Verificar que o CI build job passa sem erro no step "Run type check".

### 2. Docs: Alinhar QA.md com comandos reais (P0)

**Arquivo**: `docs/QA.md`  
**O que mudou**: Substituídos todos os `npm run <script-inexistente>` por comandos `npx` equivalentes que funcionam. Adicionada nota explicando que os scripts npm podem ser adicionados futuramente. Atualizada a estrutura de testes para refletir os arquivos reais.  
**Por quê**: Docs referenciavam 6 scripts que não existem no package.json, causando confusão para desenvolvedores.  
**Como testar**: Executar cada comando documentado e verificar que funciona.

### 3. Docs: Alinhar SMOKE_TESTS.md (P0)

**Arquivo**: `docs/SMOKE_TESTS.md`  
**O que mudou**: Substituído `npm run smoke` por sequência explícita de comandos (`npm run lint` + `npx tsc -b` + `npx vitest run` + `npm run build` + `npx playwright test smoke.spec.ts`).  
**Por quê**: O script `smoke` não existe. Documentar os passos individuais garante que qualquer dev consiga executar o pipeline localmente.  
**Como testar**: Seguir os passos documentados em ordem.

### 4. Docs: Alinhar RELEASE_CHECKLIST.md (P0)

**Arquivo**: `docs/RELEASE_CHECKLIST.md`  
**O que mudou**: Comandos de typecheck e testes atualizados para usar `npx` diretamente.  
**Por quê**: Consistência com os demais docs e com o que realmente funciona.  
**Como testar**: Verificar que cada comando listado no checklist é executável.

### 5. Docs: Criar AUDIT_REPORT.md (Fase 0)

**Arquivo**: `docs/AUDIT_REPORT.md`  
**O que mudou**: Novo arquivo com inventário completo do projeto, baseline status, top 10 riscos, lista priorizada (P0/P1/P2) e plano de execução em 3 ondas.  
**Por quê**: Entregável obrigatório da Fase 0 da auditoria.  
**Como testar**: N/A (documentação).

---

## Itens Documentados para Implementação Futura (P1/P2)

| Item | Prioridade | Detalhes |
|------|-----------|---------|
| Adicionar scripts `typecheck`, `test`, `smoke`, `test:e2e`, `seed` ao package.json | P1 | Requer edição direta do package.json |
| Habilitar `strict: true` no tsconfig gradualmente | P1 | Alto impacto, requer fix de muitos erros |
| Mover `@playwright/test` para devDependencies | P1 | Reduz bundle de produção |
| Migrar acessos diretos ao supabase para repositories | P1 | Aderência à arquitetura documentada |
| Migrar hooks legados para TanStack Query | P2 | Refactor gradual |
| Remover dead code | P2 | Análise de uso necessária |
| Habilitar `noFallthroughCasesInSwitch` | P2 | Baixo risco |
