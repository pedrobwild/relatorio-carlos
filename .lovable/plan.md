Plano estratégico para fechar gaps contra Procore/Autodesk Build/Sienge/Raken/Fieldwire. Todas as ondas são **staff-only**, aditivas, sem tocar em superfícies do cliente (`role=customer` → `/minhas-obras`, `/obra/:id/*`, componentes compartilhados). Health Score não será recriado.

Notação: cada onda descreve (1) o que já existe, (2) o que falta, (3) migrations aditivas mínimas, (4) fatiamento, (5) riscos.

---

## ONDA A — Avanço físico + Curva S

**Existe**
- `project_activities`: `weight`, `planned_start/end`, `actual_start/end`, `baseline_start/end`, `baseline_saved_at` (baseline por atividade já existe, mas só via colunas — sem snapshot histórico).
- `src/lib/progressCalc.ts` calcula progresso ponderado binário (0/100) por atividade concluída.
- Nenhum registro parcial de % físico; nenhuma tabela de medições históricas; nenhuma view/agregação semanal de curva S.

**Falta**
- Medições históricas de % físico por atividade (data, autor, %, observação).
- Snapshot completo de baseline do cronograma (para congelar planejado quando o cronograma for reajustado).
- Agregação semanal planejada × realizada (curva S).
- Página `/gestao/avanco-fisico` (seletor obra, gráfico curva S, tabela de medições, % ponderado por peso/duração).

**Migrations aditivas**
- `activity_progress_measurements` (id, activity_id fk, project_id fk denorm, measured_on date, progress_pct numeric(5,2) 0–100, notes, measured_by fk auth.users, created_at). Índice `(activity_id, measured_on desc)`.
- `schedule_baselines` (id, project_id fk, name, notes, created_by, created_at, is_current bool).
- `schedule_baseline_activities` (id, baseline_id fk, activity_id, description, planned_start, planned_end, weight, sort_order, parent_activity_id). Snapshot congelado.
- View/RPC `get_scurve_weekly(project_id, baseline_id?)` retornando `(week_start, planned_cum_pct, actual_cum_pct)` — cálculo baseado em distribuição linear do peso pelo range planejado/real (curva S física, não financeira).
- RLS: `is_staff(auth.uid()) AND has_project_access(...)` em todas; GRANT `authenticated` SELECT/INSERT/UPDATE/DELETE; `service_role` ALL. Sem anon.
- Adicionar coluna `current_progress_pct` em `project_activities` (cache do último measurement) — NÃO obrigatório; pode ser calculada em query.

**Fatiamento**
- **A1**: migrations (measurements + baselines) + hook `useActivityProgress` + botão "Registrar avanço" em `LookaheadRow` e (staff-only) na tela `/gestao/atividades`. Sem página nova.
- **A2**: RPC curva S + página `/gestao/avanco-fisico` (gráfico Recharts, tabela de medições, seletor de baseline).

**Riscos**
- Curva S com 200+ atividades × 30+ semanas → agregação em SQL (RPC), não no cliente. Índice em `(project_id, planned_start)` já existe.
- Consistência entre `weight` binário (progressCalc) e `progress_pct` (parcial): manter ambos, com regra clara de qual leitor usa qual (cliente continua vendo o binário; staff vê parcial).
- Mobile: gráfico com scroll horizontal + tabela em card list.

---

## ONDA B — Custos (Orçado × Comprometido × Realizado)

**Existe**
- `orcamentos` + `orcamento_items` + `orcamento_sections` (orçado, com BDI, category).
- `project_purchases`: `estimated_cost`, `actual_cost`, `paid_amount`, `paid_at`, `status` (pending→purchased→delivered→cancelled). Vínculo opcional com `orcamento_item_id` e `activity_id`.
- `project_payments` (parcelas do contrato do cliente — receita, não custo).
- EVM está implementado só como cálculo em memória em hooks de compras (não persistido).

**Falta**
- Definição canônica de "comprometido" (compras com status ∈ {approved, purchased, ordered, in_transit, delivered, sent_to_site} e `paid_at IS NULL`) e "realizado" (`paid_amount` acumulado até data).
- Categorização unificada custo — hoje `project_purchases.category` é livre; `orcamento_items.item_category` também. Precisamos de mapeamento.
- Forecast EAC = realizado + (orçado_restante ou média das últimas compras).
- Curva S financeira (planejada vem do desembolso previsto do orçamento distribuído pelo cronograma; realizado vem de `paid_at`).
- Página `/gestao/custos` com visão obra + drill category.

**Migrations aditivas**
- `cost_categories` (id, code, name, parent_id, sort_order) — taxonomia master. Popular com seed inicial (Mão de obra, Materiais, Serviços terceiros, Locação, Administrativo, etc.).
- Adicionar `cost_category_id uuid` em `project_purchases` e `orcamento_items` (nullable, FK). Não remover `category` texto.
- `project_cost_forecasts` (id, project_id, snapshot_date, orcado_total, comprometido_total, realizado_total, eac, notes, created_by) — snapshot para histórico do forecast.
- RPC `get_cost_summary(project_id)` retornando por categoria: `{orcado, comprometido, realizado, saldo, eac}`.
- RPC `get_scurve_financial_weekly(project_id)` retornando `(week_start, planned_cum_brl, actual_cum_brl)`.
- RLS staff + `has_project_access`. GRANT authenticated/service_role.

**Fatiamento**
- **B1**: taxonomia + migrations + RPC `get_cost_summary` + página `/gestao/custos` (cards + tabela por categoria, filtro obra).
- **B2**: forecast EAC + curva S financeira + histórico de snapshots (agendável via pg_cron semanal — reaproveita infra da Onda F).

**Riscos**
- Categoria hoje é texto livre → migration de dados requer heurística; deixar `cost_category_id` nullable e mostrar "Sem categoria" quando ausente. Não bloquear release.
- Duplicar informação em `project_cost_forecasts` vs cálculo on-the-fly: snapshot serve para histórico do gráfico ao longo do tempo.
- Colisão com telas de compras existentes: `/gestao/custos` é view somente-leitura agregada; edição continua nas telas atuais.

---

## ONDA C — RDO de primeira linha

**Existe**
- `project_daily_logs` (1 por obra/dia, notes, unique constraint), `project_daily_log_services`, `project_daily_log_workers`, `project_daily_log_actions`, `project_daily_log_service_tasks`.
- Hook `useProjectDailyLog` faz snapshot-replace.
- Tudo dentro do contexto `/obra/:id` (embutido no DailyLogInline). Não há página global staff nem export.

**Falta**
- Página global `/gestao/diario` (lista cross-obra por período, filtros).
- Página por obra dedicada dentro do shell staff (fora da tab atual embutida) — opcional, pode ficar em `/obra/:id/diario` se ainda for staff-only (verificar: hoje o tab está em superfície mista; **manter separado em `/gestao/obra/:id/diario` para não tocar cliente**). ⚠️ Ver "Riscos".
- Clima: nenhuma integração. Manual + opção de auto-preencher via [Open-Meteo](https://open-meteo.com) (gratuito, sem chave, permitido comercial) usando `projects.address`/`lat/lng` — verificar se `projects` tem coords; senão, entrada manual.
- Fotos e ocorrências/impedimentos hoje moram parcialmente em `project_daily_log_actions` (pendências) — sem tabela de "ocorrência" nem galeria de fotos ligada ao RDO.
- Export PDF do RDO com identidade da empresa.
- Card "RDO de hoje" na Minha Semana.

**Migrations aditivas**
- Colunas em `project_daily_logs`: `weather_condition text`, `weather_temp_min numeric`, `weather_temp_max numeric`, `weather_source text` ('manual'|'auto'), `worked_hours numeric`, `submitted_at timestamptz`, `submitted_by uuid`.
- `project_daily_log_photos` (id, daily_log_id fk, file_path, caption, taken_at, uploaded_by, position). RLS staff.
- `project_daily_log_occurrences` (id, daily_log_id fk, type text ∈ {impedimento, ocorrencia, seguranca, visita, outro}, severity text, description, resolved bool, resolved_at, resolved_by, created_by, created_at). RLS staff.
- Bucket storage `daily-log-photos` (privado, staff-only via signed URLs) ou reusar `project-documents`.
- GRANTs padrão staff + service_role.

**Fatiamento**
- **C1**: migrations + página `/gestao/diario` (lista/filtros/detalhe) + fotos + ocorrências + card na Minha Semana.
- **C2**: clima automático (Open-Meteo via edge function `weather-lookup`) + export PDF (`generate-rdo-pdf` edge function, tema empresa).

**Riscos**
- ⚠️ **Colisão cliente**: preciso confirmar que `DailyLogInline` NÃO é renderizado em rota acessível a customer. Aparentemente hoje só `/obra/:id/painel-obras` e afins são staff — validar antes de C1. Se estiver em rota customer, criar variante `StaffDailyLog` separada.
- Storage: fotos podem ser grandes; validar limite via `filesRepo`. Compressão client-side no upload mobile.
- PDF pesado: usar edge function assíncrona.
- Open-Meteo sem chave; latência aceitável, sem custo. Sem PII.

---

## ONDA D — Qualidade (Templates + Punch list + Verificação dupla)

**Existe**
- `inspection_templates` (category, description, sort_order) — flat, catálogo global. **Não** existe agrupamento por template reutilizável.
- `inspections` + `inspection_items` (result: pending/conforme/nc, photo_paths, notes).
- `non_conformities` já tem `resolved_at/by`, `verified_at/by`, `approved_at/by`, `reopen_count`, `estimated_cost`, `actual_cost`, `evidence_photos_before/after`. **Dupla verificação executado → verificado JÁ EXISTE em coluna, falta UI/regra de transição.**
- Regra de fechamento por tech roles: já em memória (`useUserRole.isTech`).

**Falta**
- Tabela de templates reutilizáveis (agrupar N itens sob 1 template nomeado, com escopo por ambiente/categoria/etapa).
- Vincular inspeção a template (metadata + versão).
- Punch list de entrega por ambiente: hoje `inspections` é genérica; precisamos de sinalizador `inspection_type='punch_list'` (já é campo texto livre) e vínculo com "ambiente" — obra não tem tabela de ambientes explícita; propor `project_rooms`.
- UI clara de dupla verificação (executor marca resolved → verificador marca verified → coordenador aprova/reprova).

**Migrations aditivas**
- Renomear conceito: manter `inspection_templates` legado (catálogo de itens) e adicionar:
  - `inspection_template_groups` (id, name, description, category, is_active, created_by, created_at, updated_at).
  - `inspection_template_group_items` (id, group_id fk, description, sort_order, expected_result text, notes).
- Coluna `template_group_id uuid` em `inspections` (nullable FK).
- `project_rooms` (id, project_id fk, name, floor, area_m2, sort_order). Popular via wizard já existente ou manual.
- Coluna `room_id uuid` em `inspections` (nullable FK) — usado quando `inspection_type='punch_list'`.
- Enum ou coluna `verification_stage` em `non_conformities` ∈ {aguardando_execucao, executado, verificado, aprovado, reprovado} — derivada de resolved/verified/approved timestamps; opcional (pode ser view calculada).
- RLS + GRANT staff.

**Fatiamento**
- **D1**: template groups + CRUD staff `/gestao/qualidade/templates` + escolher template ao criar inspeção. Sem punch list ainda.
- **D2**: `project_rooms` + punch list (`/gestao/qualidade/punch-list` ou `/obra/:id/punch-list` staff) + UI de dupla verificação em NCs (banner de estágio + ações contextuais por role).

**Riscos**
- Migration de `inspection_templates` legado: manter compat retro; novas inspeções usam grupos, antigas continuam funcionando.
- Punch list em obra em fase de entrega — evitar colisão com "checkin de vistoria" da jornada do cliente (jornada é cliente-facing; punch list é staff).

---

## ONDA E — Suprimentos ponta a ponta

**Existe**
- `project_purchases` (com status já contemplando `pending→approved→ordered→in_transit→delivered`), `fornecedores`, `fornecedor_precos` (preços por fornecedor), `supplier_categories`.
- Nenhuma "requisição" formal; nenhuma "cotação comparada"; recebimento é implícito (status delivered + `actual_delivery_date`), sem parcial.

**Falta**
- Fluxo requisição → cotação → pedido → recebimento parcial/total.
- Tabelas separadas para requisição e cotação (não sobrecarregar `project_purchases` que já é o "pedido").

**Migrations aditivas**
- `material_requisitions` (id, project_id fk, activity_id fk nullable, requested_by, requested_at, needed_by date, status ∈ {rascunho, aberta, cotando, aprovada, pedido_emitido, cancelada}, notes, priority text).
- `material_requisition_items` (id, requisition_id fk, item_name, description, quantity, unit, cost_category_id fk nullable, notes, sort_order).
- `purchase_quotations` (id, requisition_id fk, fornecedor_id fk, quoted_at, valid_until, total, freight, payment_terms, delivery_days, notes, status ∈ {rascunho, recebida, escolhida, descartada}, attachment_path).
- `purchase_quotation_items` (id, quotation_id fk, requisition_item_id fk, unit_price, quantity_available, subtotal).
- `project_purchases`: adicionar `requisition_id uuid`, `quotation_id uuid` (FKs SET NULL). Já tem status compatível.
- `purchase_receipts` (id, purchase_id fk, received_at, received_by, quantity_received numeric, quantity_pending numeric, notes, evidence_photo_paths text[], is_final bool). Permite recebimentos múltiplos parciais.
- RLS staff + `has_project_access`. GRANT authenticated/service_role.

**Fatiamento**
- **E1**: requisição + cotação comparada (`/gestao/suprimentos/requisicoes` + tela de cotações side-by-side gerando pedido). Sem recebimento parcial.
- **E2**: recebimento parcial (`purchase_receipts` + UI mobile "receber material" com foto e checklist) + integração com agenda existente de compras (badge de "aguardando entrega").

**Riscos**
- Colisão com fluxo atual de compras (staff cria pedido direto). Manter dois caminhos: "requisição formal" (novo) e "compra rápida" (existente, para casos simples).
- Complexidade UX cotação comparada: começar simples (tabela de fornecedores × itens com destaque do menor preço/melhor prazo).
- Estoque: `stock_movements`/`stock_balances` já existem — recebimento pode gerar entrada; deixar como stretch em E2.

---

## ONDA F — Relatório executivo interno automático

**Existe**
- `weekly_reports` (relatório semanal enviado ao cliente — cliente-facing, NÃO tocar).
- `useDomainEvents`, `useMinhaSemana` — agregadores prontos.
- pg_cron + pg_net + edge functions habilitados.

**Falta**
- Relatório interno separado do cliente (métricas gerenciais, custos, NCs, RDOs).
- Job agendado.
- Página `/gestao/relatorios-internos`.
- Export PDF.

**Migrations aditivas**
- `internal_weekly_reports` (id, project_id fk, week_start date, week_end date, generated_at, generated_by nullable [null = auto], status ∈ {draft, published}, payload jsonb — snapshot completo, pdf_path text, notes text). Unique `(project_id, week_start)`.
- Edge function `generate-internal-report` (recebe project_id + week_start, monta payload agregando: avanço físico [RPC A2], custos [RPC B1], RDOs [count + destaque de ocorrências], NCs abertas/fechadas, lookahead próxima semana, curva S snapshot). Grava PDF em `internal-reports` bucket.
- Cron via `supabase--insert`: toda segunda 06:00 América/São_Paulo, para cada obra `active`, chamar edge function.
- RLS staff + `has_project_access`. GRANT authenticated/service_role.

**Fatiamento**
- **F1**: tabela + edge function + página `/gestao/relatorios-internos` (lista, visualização inline JSON→cards). Sem PDF ainda.
- **F2**: PDF (template com identidade) + cron agendado + notificação in-app.

**Riscos**
- Depende das ondas A, B, C, D (agregadores). Executar F ao final.
- Payload jsonb pode ficar grande — comprimir ou armazenar só o essencial + regenerar sob demanda.
- pg_cron chamando N obras: paralelismo controlado (loop no SQL do cron, ou fila com `net.http_post`).

---

## Ordem recomendada de execução

**A → C → D → B → E → F** (não A→F).

Racional:
- **A primeiro**: fecha o buraco mais crítico (medição de avanço físico é fundação para curva S, custos EVM e relatórios).
- **C em segundo**: RDO é uso diário do time; retorno imediato de adoção e alimenta dados para F.
- **D em terceiro**: qualidade destrava operação de entrega; usa base já rica de NCs.
- **B em quarto**: custos precisa que compras estejam bem taxonomizadas — dá tempo de arrumar categorização enquanto A/C/D rodam.
- **E em quinto**: suprimentos formal é o maior escopo estrutural; melhor com custos (B) já operando para categorização.
- **F por último**: consolida tudo. Sem A/B/C/D fechados, o relatório fica vazio.

---

## Guardrails confirmados (todas as ondas)

- ❌ Zero mudança em rotas/componentes do `role=customer` (`/minhas-obras`, `/obra/:id/{jornada,contrato,projeto-3d,executivo,financeiro,pendencias,documentos,formalizacoes,cronograma}`, `/vitrine`, `/auth`).
- ✅ Migrations aditivas apenas (sem DROP/ALTER destrutivo). Soft-delete via `deleted_at` onde couber.
- ✅ RLS obrigatório: `is_staff(auth.uid()) AND has_project_access(auth.uid(), project_id)` + GRANT `authenticated`/`service_role` (nunca `anon`).
- ✅ Query keys em `src/lib/queryKeys.ts` (novos namespaces: `avancoFisico`, `custos`, `diario`, `qualidade`, `suprimentos`, `relatoriosInternos`).
- ✅ Repositórios em `src/infra/repositories/` — nada de `supabase.from()` em componente.
- ✅ Tokens semânticos, mobile-first (`ResponsivePageShell`, ≥44px touch, `px-safe-*`).
- ✅ Sem `console.log`; usar `errorLogger`/`devLogger`.
- ✅ Health Score permanece removido.
- ✅ Cada onda cabe em UMA mensagem de implementação após o fatiamento A1/A2, C1/C2, D1/D2, E1/E2, F1/F2. Ondas B1/B2 idem. Total: 11 mensagens de execução.

Quer que eu comece por **A1** (medições de avanço físico + baseline snapshot)?
- Módulo Diário de Obra retirado por decisão do gestor em 23/07/2026 — não reintroduzir sem pedido explícito
