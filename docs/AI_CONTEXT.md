# Portal BWild — Contexto para IA

Documento de onboarding para agentes de IA que forem trabalhar neste repositório. Complementa (não substitui) `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY_PATTERNS.md` e `docs/CONTRIBUTING.md`.

---

## 1. O que é o Portal BWild

Portal web SaaS de **gestão de obras de construção civil de alto padrão** operado pela BWild. Serve como fonte única de verdade para toda a jornada do cliente — do onboarding à entrega — integrando cronograma, orçamento, compras, formalizações, inspeções, relatórios semanais e comunicação.

- Produção: `https://portal-bwild.lovable.app`, `https://www.bwildworkflow.com`, `https://bwildworkflow.com`
- Preview: `https://id-preview--c9754542-d1f4-4007-9ead-4212e17bb44e.lovable.app`
- Idioma da UI e das mensagens: **Português do Brasil**.

## 2. Objetivos do sistema

1. **Transparência para o cliente final:** dashboard "Minhas Obras" onde o proprietário acompanha etapa atual, cronograma, pendências, faturas, documentos, formalizações e relatórios semanais.
2. **Operação eficiente para a equipe interna (staff):** painel `/gestao/painel-obras` como cockpit executivo com edição inline, KPIs, alertas de cronograma e priorização ("o que preciso fazer agora?" — ver `docs/COCKPIT_PATTERNS.md`).
3. **Rastreabilidade jurídica:** aprovações tácitas, formalizações e NCs geram eventos de domínio (triggers no banco) que sobrevivem a mudanças de UI.
4. **Automação com IA:** geração de cronograma, extração de orçamento em PDF, sync com ERP externo (Envision) e análises via `bwildAgent`.

## 3. Público-alvo

| Persona | Role(s) | Uso principal |
|---|---|---|
| **Cliente/Proprietário da obra** | `customer` | `/minhas-obras`, `/obra/:projectId/*` — acompanha, aprova documentos, paga, formaliza |
| **Engenheiro de obra** | `engineer` | Executa cronograma, registra diário, sobe fotos, abre NCs |
| **Gestor/Manager** | `manager`, `gestor` | Supervisiona portfólio, prioriza, aprova |
| **Suprimentos** | `suprimentos` | Compras, fornecedores, prestadores, agenda |
| **Financeiro** | `financeiro` | Faturas, boletos, PIX, prazos |
| **CS (Customer Success)** | `cs` | Tickets, operacional e analytics de relacionamento |
| **Arquitetura** | `arquitetura` | Projeto executivo, versões 3D, revisões |
| **Admin** | `admin` | Tudo + `/admin/health`, auditoria, feature flags |

`isStaff` = qualquer role diferente de `customer`. Roles são **múltiplas por usuário** (tabela `user_roles`) — nunca hardcodar checks; usar `useCan()` / `useCanFeature()` + matriz em `src/config/permissions.ts`.

## 4. Módulos principais

- **Jornada** (`/obra/:id/jornada`): etapas do projeto (onboarding → arquitetura → executivo → obra → entrega). Regras em `mem://features/journey/architecture-and-stage-logic`.
- **Cronograma** (Gantt): atividades com dependências, dias úteis (`src/lib/businessDays.ts` respeita feriados SP), geração por IA, edição drag-and-drop, alertas.
- **Orçamento**: importação de PDF via Edge Function `parse-budget-pdf`, visão embarcada em `/obra/:id/orcamento`.
- **Compras**: produtos vs prestadores, detecção de conflito de agenda, EVM, `compras_audit_log`.
- **Formalizações**: acordos e atas (rascunho → pendente → assinado), 1 cliente + 1 empresa, assinatura interna staff.
- **Documentos**: upload em bucket privado `project-documents`, categorias, comentários ancorados em PDF, versionamento, aprovação tácita (trigger `log_executive_tacit_approval`).
- **Pendências**: fonte única `pending_items`, prioridade por urgência (≤2 dias = urgente).
- **Financeiro**: faturas, saldo pendente, boletos com validação, PIX.
- **Inspeções e NCs**: captura mobile passo-a-passo, planos de ação por IA, fechamento por tech roles.
- **Relatórios Semanais**: geração assistida por IA em 4 passos, KPIs semânticos.
- **CS**: `/gestao/cs/operacional` (CRUD tickets) e `/gestao/cs/analytics` (dashboard).
- **Painel de Obras**: `/gestao/painel-obras` tabela executiva com 11 colunas, edição inline, badges, sticky header.
- **Notificações**: `NotificationBell` in-app, "requer ação" vs "acompanhar", realtime via Supabase.
- **Painel Admin**: `/admin/health`, auditoria, feature flags, clientes sem obra ativa.

## 5. Stack técnica

- **Frontend**: React 18 + TypeScript + Vite (SWC, HMR desativado propositalmente). Tailwind v3 + shadcn/ui + Radix. TanStack Query com **persister em localStorage** (24h, invalidada por `QUERY_CACHE_VERSION` em `src/lib/queryPersister.ts`). React Router v6. Zod para schemas. Amplitude para telemetria (com consentimento LGPD).
- **Backend (Lovable Cloud)**: Supabase (Postgres + Auth + Storage + Edge Functions). RLS mandatório. `SECURITY DEFINER` para RPCs sensíveis. `pg_net` para HTTP async. Migrations append-only em `supabase/migrations/`.
- **Integrações externas**: ERP **Envision** (sync bidirecional, chave `INTEGRATION_API_KEY`), Gemini Flash e Lovable AI Gateway (chat, extração, análise).
- **Testes**: Vitest (unit, jsdom) + Playwright (e2e + a11y). CI GitHub Actions com sharding.
- **Deploy**: Lovable. Env vars `VITE_SUPABASE_*` injetadas pela plataforma.

## 6. Regras arquiteturais inegociáveis

1. **Nunca chame `supabase.from()` em componentes.** Use `src/infra/repositories/*` (`documentsRepo`, `projectsRepo`, `filesRepo`, etc.). Edge Functions via `invokeFunction`/`invokeFunctionRaw` em `src/infra/edgeFunctions.ts`.
2. **Query keys centralizadas** em `src/lib/queryKeys.ts`. Nunca inventar chave ad-hoc.
3. **Multi-tenant:** toda query/aba MUST filtrar por `projectId` e incluir `userId`. Cross-tenant leak = bug crítico.
4. **RLS + GRANT em toda tabela nova em `public`**. Sem GRANT, PostgREST retorna permission denied — não basta RLS.
5. **Roles em tabela separada** (`user_roles`) + função `has_role()` `SECURITY DEFINER`. Jamais na tabela de profile.
6. **DB additive-only** (soft delete via `deleted_at`; nunca DROP em migration de produção sem migração de dados).
7. **Datas**: `businessDays.ts` para prazos, `parseLocal` para strings `YYYY-MM-DD` (evita bug de fuso).
8. **Design tokens semânticos apenas** (`bg-background`, `text-foreground`, `bg-muted/40` para readonly, cores semânticas para status). Nunca hex/`text-white` hardcoded em componentes de app.
9. **Z-index semântico**: ESLint bloqueia `z-*` custom em `*Content` de overlays. Adicionar novo token em `tailwind.config.ts`.
10. **Sem `console.log`** (ESLint proíbe). Usar `errorLogger`, `devLogger`, `errorMonitoring`.
11. **Mobile-first**: `ResponsivePageShell`, `--bottom-nav-offset`, `env(keyboard-inset-height)`, touch target ≥ 44px, gutters `px-safe-4/6/8` (não combinar com `pl-safe`).
12. **Realtime**: canais Supabase MUST ter tópico único por instância (`${topic}-${useId()}`) para evitar `cannot add postgres_changes callbacks after subscribe()`. Ver histórico de incidentes.
13. **Health Score**: REMOVIDO — não recriar.
14. **Ao deletar**: `AlertDialog` obrigatório. `mutateAsync` + `await` antes de fechar modal.

## 7. Segurança e privacidade

- Senha mínima 8 chars; HIBP habilitado.
- Sem sign-up anônimo. Sem auto-confirm de email por padrão.
- Google OAuth default; `redirect_uri` sempre same-origin.
- Storage privado, downloads por signed URL (~1h). MIME validado no servidor.
- Deleção de arquivos restrita a staff.
- LGPD: banner de consentimento controla init do Amplitude (analytics + session replay).
- Guarda contra soft-delete da última obra ativa de um cliente (`soft_delete_project(p_project_id, p_force)`).

## 8. Estrutura de pastas relevante

```
src/
├── components/{ui,admin,formalizacao,report,cockpit,...}
├── config/{permissions,mobileNav,flags,env}
├── contexts/ProjectContext.tsx        # projeto ativo por :projectId
├── hooks/                              # useX; TanStack Query preferencial
├── infra/
│   ├── repositories/                   # ÚNICA porta para o banco
│   ├── supabase/                       # re-export do client
│   └── edgeFunctions.ts
├── integrations/supabase/{client,types}.ts  # AUTO-GEN, não editar
├── lib/                                # utilidades puras
├── pages/                              # rotas (lazy)
└── content/                            # microcopy PT-BR centralizado
supabase/{migrations,functions,tests,config.toml}
docs/                                   # ler antes de mexer em cada área
```

## 9. Fluxos críticos

- **Login cliente:** `useLinkCustomerOnLogin` (`ensureCustomerProjectLink`) vincula por e-mail normalizado (`lower(btrim())`). `ProjectContext` faz re-link forçado + retry antes de emitir "Projeto não encontrado".
- **Roteamento por role:** `AuthRedirect` na raiz. Staff → `/gestao/painel-obras`, Cliente → `/minhas-obras`, Admin → `/admin`.
- **Projeto embarcado:** todas as rotas `/obra/:projectId/*` passam por `ProjectPage` (ErrorBoundary + ProjectProvider + ProjectShell).
- **Recuperação de crash:** `ErrorBoundary` global oferece "Limpar e recarregar" (`hardReset.ts`). `chunkReload.ts` intercepta `ChunkLoadError` e força 1 reload com bypass (guard 60s).

## 10. Comandos essenciais

```bash
npm run dev          # :8080
npm run build
npm run lint
npm run typecheck    # tsc -b --noEmit
npm run test         # Vitest
npm run test:e2e     # Playwright (precisa PLAYWRIGHT_BASE_URL)
```

Debug de auth no console do browser: `localStorage.setItem('debug_auth','1')`.

## 11. Convenções de comunicação

- Toda mensagem para usuário final em **PT-BR**, tom claro e humano (ver `docs/TOM_DE_VOZ.md`).
- Cores semânticas: **vermelho** = atrasado/crítico; **laranja** = aguardando assinatura; **amarelo** = alerta cliente (nunca vermelho no dashboard do cliente).
- Empty states usam `EmptyState` de `src/components/ui/states.tsx`.
- Confirmações destrutivas usam `AlertDialog` + microcopy de `src/content/confirmLabels.ts`.

## 12. Memória do projeto

O agente Lovable mantém regras persistentes em `mem://index.md` (sempre em contexto). Antes de qualquer mudança relevante, ler a entrada de memória correspondente ao domínio (ex.: `mem://features/schedule/*`, `mem://architecture/*`). Nunca reintroduzir features marcadas em `mem://constraints/*`.

## 13. Onde procurar quando travar

| Dúvida | Onde |
|---|---|
| "Onde fica o padrão X?" | `docs/ARCHITECTURE.md`, `CLAUDE.md` |
| "Posso mexer nessa RPC?" | `docs/SECURITY_PATTERNS.md` |
| "Como escrevo esse microcopy?" | `docs/TOM_DE_VOZ.md`, `src/content/` |
| "Quais tokens de cor/spacing?" | `docs/DESIGN_TOKENS.md`, `src/index.css`, `tailwind.config.ts` |
| "O que testar antes de subir?" | `docs/SMOKE_TESTS.md`, `docs/RELEASE_CHECKLIST.md` |
| "Como o cliente navega?" | `docs/NAVIGATION.md` |
| "Integração com ERP?" | `docs/envision-integration-reference.md` |

---

**Regra de ouro:** quando a operação tem implicação jurídica ou financeira (tácita, formalização, NC, exclusão de obra, pagamento), **a fonte da verdade é o banco (trigger/RPC `SECURITY DEFINER`)**, não o frontend. Componentes apenas refletem o que o Postgres já registrou.
