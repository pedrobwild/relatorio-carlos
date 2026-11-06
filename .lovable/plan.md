# Modelos semanais, geração na Nova Obra e PDF Bewild do cronograma

## Estado confirmado
- `project_templates` está vazia e ainda não tem `schedule_model`.
- `internal_schedule_items` já tem `client_activity_id`, `etapa`, `notes` e `sort_order`. `project_customers.customer_phone` existe.
- O PDF atual fica em `src/lib/pdf/cronogramaPdf.ts` + `CronogramaPdfButton.tsx` (jsPDF). O layout dele será substituído, sem criar uma segunda exportação.
- Os logos em `src/assets` são `bwild-logo*.png`, ou seja, da marca antiga "Bwild". Vou criar `bewild-logo-blue.png` e `bewild-logo-white.png` como ponto de substituição, inicialmente cópias dos atuais. Você precisa me mandar os arquivos oficiais da Bewild.
- O fontsource não está instalado.

## Migrations (append-only, sem DROP)
1. `add_schedule_model_and_revision`:
   - `project_templates.schedule_model jsonb null` e `project_template_versions.schedule_model jsonb null`.
   - `projects.schedule_revision integer not null default 0`, `projects.schedule_exported_at timestamptz null`, `projects.schedule_exported_end date null` (servem para detectar mudança e escrever "a entrega passou de X para Y").
   - Sem tabela nova. As colunas herdam a RLS e os grants atuais.
2. `seed_weekly_templates`: insere os dois modelos do JSON (activities, custom_fields, schedule_model) e a versão 1 em `project_template_versions`. `created_by` = admin existente mais antigo (`user_roles` role=admin), com `ON CONFLICT`/`WHERE NOT EXISTS` por nome para ser idempotente.
3. Categoria "cronograma" em `files`/Documentos: confirmo a coluna/enum antes. Se for enum, faço `ALTER TYPE ... ADD VALUE`.

## Parte A · Template semanal
- `useProjectTemplates.ts`: `TemplateActivity` ganha `week?`, `weekEnd?`, `kind?: 'execucao'|'marco'`, `showIf?`, `note?`, `purchases?: unknown[]`, e entra o tipo `ScheduleModel`. Leitura e escrita passam a incluir `schedule_model`, inclusive no snapshot da versão.
- Novo `src/lib/schedule/showIf.ts`: parse e avaliação de `chave=Valor`, `chave!=Valor` e `&`, mais validação contra as chaves dos custom_fields. Tem testes.
- `TemplateFormDialog.tsx`: modo semanal com o toggle "Modelo semanal" e os campos semanas e prazo padrão. Atividades agrupadas por "Semana N", campos Semana, Até semana, Tipo, Condição (chave + igual/diferente + valor, montado dos custom_fields, com suporte a "&") e Nota. Dá para adicionar, editar, mover com setas ↑↓ e entre semanas, e apagar. Marcos com selo "Marco interno". Um erro de validação bloqueia o salvar. Novo subcomponente `templates/WeeklyActivitiesEditor.tsx`.
- `useTemplatesTabState.ts` / `types.ts`: importar e exportar preservam todos os campos, com passthrough de propriedades desconhecidas em `purchases` e no `schedule_model`, validado por Zod `.passthrough()`.
- `TemplatePreviewSheet` / `TemplateCard`: selo "Semanal · N semanas".

## Parte B · Geração na Nova Obra
- Novo módulo puro `src/lib/schedule/weeklySchedule.ts`, que usa só `businessDays.ts`:
  - `buildCalendarWeeks(start, count)`: S1 vai do início até sexta. Se tiver menos de 3 dias úteis, vai até a sexta seguinte. As demais vão de segunda a sexta. Feriado encurta a semana. Cada semana sai com o primeiro e o último dia útil e a contagem de dias úteis.
  - `contractEnd = addBusinessDays(start, prazo - 1)`.
  - `computeSlack(weeks, model, contractEnd)`: quantidade de semanas inteiras que cabem antes da última semana.
  - `generateWeeklyPlan(template, conditions, {start, prazo, useSlack})` devolve semanas, atividades filtradas e alertas (passa do contrato em N dias úteis; entrega em feriado ou fim de semana).
  - Testes Vitest com o caso de aceite completo (16/11/2026, 60 dias úteis, fim 15/02/2027, S1 com 4 dias úteis, folga de 1 semana, entrega 08 a 12/02 com 3 dias úteis, marcos da S2) e casos de borda (S1 curta, sem folga, alerta).
- `ScheduleCard.tsx` + novo `WeeklySchedulePreview.tsx`: a frase "Cabem N semanas de folga para repasses e atrasos" com toggle (ligado por padrão). Lista de semanas com datas e dias úteis: tabela no desktop, cards no mobile (`lg:hidden` / `hidden lg:block`). Dá para renomear, mover e remover atividades. Marcos com selo "interno". Botão "Exportar PDF" da prévia.
- `TemplateSelectorCard.tsx`: guarda o template semanal e as condições no estado do formulário (`types.ts`).
- `useNovaObraSubmit.ts`: alertas antes de cadastrar (AlertDialog de confirmação quando passa do contrato). Depois:
  - `project_activities`: uma linha por semana, com `etapa="Semana N"`, descrição = atividades de execução que começam na semana unidas por " / " (folga = "Folga para repasses e atrasos"), datas no primeiro e no último dia útil, e pesos iguais somando 100 (a última semana absorve o arredondamento).
  - `internal_schedule_items`: uma linha por atividade e marco, com o `client_activity_id` da semana, e `notes` com a nota e o tipo.
  - Incrementa `usage_count` e `last_used_at` pela RPC `increment_template_usage`, que já existe.
  - Tudo pelos repositories (`projectsRepo`, um repo de cronograma interno e `templatesRepo`).

## Parte C · PDF Bewild
- Reescrevo `src/lib/pdf/cronogramaPdf.ts` em jsPDF, A4 retrato, com as fontes Playfair Display (600/700) e Poppins (400/500/600) embutidas a partir de `@fontsource` (TTF em base64 via `addFileToVFS`). Paleta pelas cores informadas, num arquivo de constantes próprio do PDF. É a exceção documentada aos tokens, porque o PDF não usa CSS.
  - 1 Capa · 2 Barras por semana (folga em tom neutro, feriados marcados, entrega destacada) · 3 "O que acontece em cada semana" (sem marcos nem fornecedores, sem travessão) · 4 Acompanhamento com as observações padrão e rodapé com a logo branca sobre azul.
  - O antigo modo "Planejado x realizado" é substituído por este layout único, que mostra as datas planejadas da revisão atual.
  - Nome do arquivo: `Cronograma-Bewild-<empreendimento>-<unidade>-R<n>.pdf` (sanitizado).
- `CronogramaPdfButton.tsx`: "Exportar PDF" + "Enviar por WhatsApp", com estado de carregamento e alvo de 44px. Fica na página Cronograma e na prévia da Nova Obra. Quando a obra não tem cronograma, aparece mensagem clara.
- Revisão: se as datas de `project_activities` mudaram depois de `schedule_exported_at` (comparando o fim atual com `schedule_exported_end`), o staff vê "Nova revisão". Ela incrementa `schedule_revision` e a capa escreve "a entrega prevista passou de X para Y". O cliente só exporta a revisão atual.
- WhatsApp (`SendScheduleWhatsAppDialog.tsx`): gera o PDF, salva com `filesRepo.uploadFile` (categoria cronograma) e registra em Documentos da obra. Cria uma URL assinada de 7 dias. No celular com `navigator.share({files})` disponível, oferece o compartilhamento nativo primeiro. Depois abre `wa.me` com a mensagem pedida. O telefone vem de `project_customers.customer_phone`; se faltar, um campo no diálogo pede o número. Toast com "Abrir PDF" e "Copiar link". A ação "Enviar por WhatsApp" é só para staff, porque o cliente não envia para si mesmo; me corrija se quiser para ele também.
- Microcopy em `src/content/cronogramaPdf.ts`, sem a palavra "setup", com as grafias Bewild / Bwild Workflow.

## Detalhes técnicos
- Dependências novas: `@fontsource/playfair-display` e `@fontsource/poppins`. Se só trouxerem woff2, baixo os TTF das mesmas famílias para `src/assets/fonts/`.
- Query keys novas em `src/lib/queryKeys.ts` (revisão do cronograma).
- Permissão nova `schedule:send_whatsapp` e `schedule:new_revision` (staff) em `src/config/permissions.ts`.
- Testes: `showIf.test.ts`, `weeklySchedule.test.ts` (aceite), ajuste em `cronogramaPdf.test.ts` (nome do arquivo e conteúdo das páginas sem marcos).
- Validação: vitest, tsc e conferência visual das 4 páginas do PDF gerado.

## Fora desta etapa
Compras geradas, aviso a suprimentos, valor orçado, aplicar modelo em obra já cadastrada.
