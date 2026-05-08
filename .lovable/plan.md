# Controle de migração PII em `projects`

Um card no **Admin → Sistema** que mostra o estado atual da PII duplicada em `projects` (`client_name`, `client_email`, `client_phone`) e permite executar a correção em duas etapas controladas por você. Nada acontece em background — só quando você clicar.

## O que o card mostra

```text
┌─ Migração PII em projects ─────────────────────────────┐
│ Status:                                                │
│   • Colunas legadas: presentes (3) | removidas         │
│   • Obras com PII em projects: 2                       │
│   • Obras já migradas para project_customers: 75       │
│   • Divergências (projects ≠ project_customers): 0     │
│                                                        │
│ [ Rodar backfill ]   [ Remover colunas (irreversível) ]│
└────────────────────────────────────────────────────────┘
```

Botões ficam desabilitados quando não fazem sentido (ex.: "Remover colunas" só habilita se backfill estiver completo e divergências = 0; some quando colunas já foram removidas).

## Etapas

**1. Backfill** — copia `projects.client_*` para `project_customers` quando faltar (UPSERT por `project_id`). Idempotente, pode ser rodado várias vezes. Mostra quantas linhas foram criadas/atualizadas.

**2. Remover colunas** — `ALTER TABLE public.projects DROP COLUMN client_name, client_email, client_phone`. Exige `AlertDialog` com aviso explícito de que é irreversível e de que código que ainda lê essas colunas vai quebrar.

## Pré-requisito explicitado no card

Antes de remover as colunas, o código abaixo precisa ser ajustado para ler/escrever em `project_customers`. O card lista isso como checklist visível para você não esquecer:

- `supabase/functions/sync-project-inbound/index.ts`
- `supabase/functions/parse-budget-pdf/index.ts`
- `supabase/functions/seed-demo-project/index.ts`
- `supabase/functions/sync-monitor-agent/index.ts`
- `src/hooks/useWeekActivities.ts`
- `src/hooks/usePurchasesByCreationRange.ts`
- `src/pages/nova-obra/useEditProjectLoader.ts`
- `src/pages/CalendarioObras.tsx`

Esta etapa **não** é automatizada por este controle — o card só dispara o DB. Você decide quando o código está pronto.

## Detalhes técnicos

### Migration (nova, additive)

Cria 3 funções `SECURITY DEFINER` restritas a `is_admin_v2()`:

- `pii_projects_status()` → `jsonb` com `{columns_present, with_pii_in_projects, in_project_customers, divergences}`. Detecta presença das colunas via `information_schema.columns`.
- `pii_projects_backfill()` → `jsonb` com `{inserted, updated}`. UPSERT em `project_customers` quando `projects.client_*` tiver dado e `project_customers` não.
- `pii_projects_drop_legacy_columns()` → `void`. Faz `EXECUTE` do `ALTER TABLE ... DROP COLUMN IF EXISTS` para as 3 colunas. Aborta se backfill não foi feito (count > 0 de pendentes).

Todas com `RAISE EXCEPTION` se chamadas por não-admin.

### Frontend

Novo componente `src/components/admin/PiiMigrationCard.tsx` (mesmo padrão de `FilesCleanupCard`):
- `useQuery` chamando `supabase.rpc('pii_projects_status')`, `staleTime: 30s`.
- Dois `useMutation` para backfill e drop, com `AlertDialog` de confirmação no drop.
- Badges semânticos para o status (verde quando colunas removidas, âmbar quando há pendência).

Adicionado em `src/pages/Admin.tsx` na aba `sistema`, acima do `IntegrationMonitorCard`.

### O que NÃO entra agora

- Nenhuma alteração nos 7 arquivos que ainda leem `client_*` de `projects`. Você roda o controle só depois que esse código for migrado (ou aceita que cliente e calendário/relatórios percam o nome do cliente até ajustar).
- Nenhuma RLS nova; as 3 funções são o único caminho.
