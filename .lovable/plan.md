
# Plano — Painel interno staff (Ondas 1 e 2)

## A) Auditoria contra o código real

1. **Diário de Obra / RDO já existe.** Tabela `public.project_daily_logs` (+ `project_daily_log_services`, `project_daily_log_service_tasks`, `project_daily_log_actions`, `project_daily_log_workers`), hooks `useProjectDailyLog`, `useDailyLogActions`, `useDailyLogServiceTasks`. Não precisamos criar RDO — só (eventualmente) expor melhor. Não faz parte destas ondas.

2. **`pending_items` NÃO tem responsável individual.** Colunas: `project_id`, `customer_org_id`, `type`, `title`, `due_date`, `status`, `resolved_by`, etc. Não há `assigned_to`/`responsible_user_id`. Consequência: a seção "Pendências" da Minha Semana **não pode** ser "pendências onde eu sou responsável"; será **"pendências das obras onde sou membro/engenheiro"** (via `project_members` + `projects.engineer_id`), agrupadas por prazo. Deixo isso explícito no header da seção ("Pendências das minhas obras") para não iludir o usuário.

3. **Cronograma tem responsável e dependências.** `project_activities.responsible_user_id` (uuid) e `planned_end` (date). `atividades` (tabela legada, ainda usada em algumas telas) tem `responsavel_user_id` + `dependencias uuid[]`. Para Minha Semana e Lookahead vamos usar `project_activities` (é a fonte moderna). Dependências: `project_activities` **não** tem coluna de dependência hoje (só `atividades` tem). Portanto o flag "dependência bloqueada" do Lookahead vira **opcional/best-effort** — proponho **remover do escopo da Onda 2** e manter só os flags "sem responsável" e "atrasada" (que são triviais e confiáveis). Registro isso como risco confirmado.

4. **Painel de Obras já tem os filtros necessários** e persiste densidade/ordenação em localStorage. Filtros existentes no state: `filterEtapa`, `filterStatuses` (Set), `filterRelacionamento`, `filterResponsavel`, período (via `usePainelPeriodActivities`), busca. **Não há visões salvas nem faixa de contadores no topo hoje** (só chips de filtro inline). A faixa de exceções encaixa acima da toolbar de filtros (abaixo do header/tabs de fase), e cada contador aplica um preset via os setters já existentes — sem nova query pesada.

5. **CS tickets têm atribuição por usuário**: `cs_tickets.responsible_user_id` (uuid). ✓

6. **Formalizações**: `formalizations.status` existe mas o "aguardando assinatura interna" é derivado de `formalization_parties` (party do lado empresa sem assinatura). O hook `useFormalizacoes` + repo já expõe esse estado (mem: assinatura pela equipe interna). Vamos consumir o hook existente e filtrar `pendingCompanySignature` (ou equivalente) no cliente, sem query nova.

## B) Riscos e RLS

- **RLS staff-wide**: Minha Semana e Lookahead precisam **listar entre obras**. `project_activities`, `non_conformities`, `cs_tickets`, `pending_items`, `formalizations` já têm policies que permitem staff via `is_staff()`/`has_project_access`. Nenhuma migration de policy necessária — todas as leituras são cobertas pelos repos existentes. Confirmar com um `SELECT count(*)` durante implementação.
- **Sem novas mutations**: Minha Semana é 100% read-only; Lookahead reutiliza `useProjectActivities` update (que já tem RLS validado). Zero superfície nova de ataque.
- **Zero impacto no cliente**: nada em `/minhas-obras`, `/obra/:projectId/*`, `/auth`, `/vitrine`. Novas rotas todas sob `StaffRoute` em `/gestao/*`. Nenhum componente compartilhado com o cliente será modificado — hooks agregadores novos consomem repos existentes.
- **Performance**: agregar 6 fontes por usuário pode gerar 6 queries paralelas por página. Mitigação: TanStack Query com `staleTime` de 60s, keys estáveis, e `enabled: isStaff`.
- **Pendências sem owner** (risco confirmado no item A2): comunicado no rótulo da seção.
- **Dependência bloqueada no Lookahead** (risco confirmado em A3): removido do escopo.

## C) Plano de implementação

### Onda 1 — cabe em uma mensagem

**Novos arquivos**
- `src/pages/gestao/MinhaSemana.tsx` — página, agrupada por Atrasado / Hoje / Esta semana / Próximas, usando `businessDays.ts`. Read-only, cada item com `Link` para a origem (`/gestao/obra/:id/…`, `/gestao/nao-conformidades`, `/gestao/cs/operacional`, `/formalizacoes/:id`).
- `src/hooks/useMinhaSemana.ts` — hook agregador. Faz em paralelo, filtrando por `user.id`:
  - atividades: `project_activities` where `responsible_user_id = me` e `planned_end` até +14 dias ou `< today`;
  - NCs: `non_conformities` where `responsible_user_id = me AND status <> 'closed'`;
  - CS: `cs_tickets` where `responsible_user_id = me AND status <> 'closed'`;
  - formalizações: reusa `useFormalizacoes` e filtra "aguardando assinatura interna" das obras onde sou membro;
  - alertas de cronograma: reusa `useScheduleAlerts` filtrado por minhas obras;
  - pendências: `pending_items` das obras onde sou membro/engenheiro (com aviso "Pendências das minhas obras" — ver A2).
  Retorna `{ atrasado, hoje, semana, proximas, isLoading, error }`.
- `src/components/gestao/minha-semana/InboxSection.tsx`, `InboxItem.tsx` — apresentacionais.
- `src/hooks/usePainelExcecoes.ts` — deriva 4–6 contadores a partir dos dados já carregados pelo `usePainelObras`, `useAllNonConformities`, `useFormalizacoes`, `useProjectPayments` agregado, `useScheduleAlerts`.
- `src/components/gestao/painel/ExceptionsBar.tsx` — faixa clicável de contadores no topo do Painel.
- `src/hooks/usePainelSavedViews.ts` — leitura/gravação em `localStorage` (`painel-obras:views:v1`), com defaults `"Minhas obras"` e `"Em atraso"` computados a partir dos filtros existentes.
- `src/components/gestao/painel/SavedViewsBar.tsx` — chips/abas nomeadas, com "Salvar visão atual" e "Excluir".
- `src/lib/queryKeys.ts` — adicionar namespaces `minhaSemana`, `painelExcecoes`.

**Arquivos alterados**
- `src/pages/PainelObras.tsx` — injetar `<ExceptionsBar />` e `<SavedViewsBar />` acima da toolbar existente. Contadores chamam os setters de filtro já presentes. Sem mudar layout do cliente (essa página é 100% staff).
- `src/App.tsx` — nova rota `/gestao/minha-semana` sob `<StaffRoute>` (lazy).
- `src/components/layout/GestaoSidebar.tsx` — novo item "Minha semana" no topo do grupo.

**Garantia de isolamento do cliente**
- Nenhum arquivo em `src/pages/Index.tsx`, `src/pages/MinhasObras.tsx`, abas do projeto do cliente, `AuthRedirect`, `CustomerRoute` é tocado.
- Hooks novos vivem em `src/hooks/useMinhaSemana*` e `src/hooks/usePainel*` — sem re-export em barrels do cliente.
- Não modificar `useNotifications`, `useProjectActivities` API — só consumir.

### Onda 2 — cabe em uma mensagem

**Novos arquivos**
- `src/pages/gestao/Lookahead.tsx` — janela 14–21 dias (toggle), agrupamento por semana ISO, filtros por obra (multi) e responsável (multi).
- `src/hooks/useLookaheadActivities.ts` — busca `project_activities` na janela para todas as obras acessíveis pelo staff (usa repo/queries existentes), retorna agregação por semana.
- `src/components/gestao/lookahead/LookaheadTable.tsx`, `LookaheadRow.tsx` — flags "sem responsável" e "atrasada" (dependência bloqueada removida — ver A3). Ações rápidas: atribuir responsável (Popover com `useStaffUsers`), registrar avanço (`actual_start`/`actual_end`) — reutilizam mutation existente de `useProjectActivities`.

**Arquivos alterados**
- `src/App.tsx` — rota `/gestao/lookahead` sob `<StaffRoute>`.
- `src/components/layout/GestaoSidebar.tsx` — item "Lookahead" logo abaixo de "Minha semana".
- `src/lib/queryKeys.ts` — namespace `lookahead`.

**Não tocar**: `src/pages/Cronograma.tsx`, `src/components/schedule/*`, `/obra/:id/cronograma`.

## D) Migrations

**Nenhuma das ondas exige migration.** Todos os campos necessários já existem no schema.

- Visões salvas do Painel (item 3): implementadas **sem migration**, em `localStorage` por usuário/navegador (`painel-obras:views:v1`). Trade-off aceito: não sincroniza entre dispositivos. Se no futuro quisermos sync cross-device, criamos `user_saved_views` (user_id, scope, name, filters jsonb) — fica fora do escopo agora.
- Faixa de exceções: derivada em memória dos hooks existentes, zero query nova.
- Minha Semana: só leitura via repos existentes.
- Lookahead: só leitura + reuso de mutation existente.

## Ajustes de escopo confirmados (para aprovar junto)

1. Seção "Pendências" da Minha Semana rotulada como **"Pendências das minhas obras"** — porque `pending_items` não tem responsável individual.
2. Flag "dependência bloqueada" **removida do Lookahead** — `project_activities` não tem dependências no schema; adicionar depois só se migrarmos essa informação.
3. Visões salvas em **`localStorage`** (sem migration). Ok manter assim?
