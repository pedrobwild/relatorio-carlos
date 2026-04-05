# Portal BWild — Guia Completo de Configuração

## Visão Geral

Este guia descreve todos os arquivos e passos necessários para configurar o **Portal BWild** para receber dados do **Envision Build Guide** via integração bidirecional.

---

## 📁 Arquivos Gerados

| # | Arquivo | Destino no Portal BWild | Função |
|---|---------|------------------------|--------|
| 1 | `portal-bwild-project-columns.sql` | Executar no banco de dados | Cria colunas de integração na tabela `projects` + trigger de validação |
| 2 | `portal-bwild-sync-project-inbound.ts` | `supabase/functions/sync-project-inbound/index.ts` | Edge Function para receber projetos (contrato_fechado) |
| 3 | `portal-bwild-sync-supplier-inbound.ts` | `supabase/functions/sync-supplier-inbound/index.ts` | Edge Function para receber fornecedores |

---

## 🔧 Passo a Passo

### Passo 1 — Executar a migração SQL

Execute o arquivo `portal-bwild-project-columns.sql` no banco de dados do Portal BWild. Ele adiciona:

- Colunas `external_id` e `external_system` na tabela `projects`
- Campos de dados do projeto: `client_name`, `client_phone`, `client_email`, `address`, `neighborhood`, `city`, `property_type`, `area_sqm`, `estimated_weeks`, `budget_value`, `consultant_name`, `consultant_email`
- Trigger `trg_validate_project_fields` que valida `name` e `client_name` antes de INSERT/UPDATE
- Índice único em `(external_id, external_system)` para evitar duplicatas

```bash
psql $DATABASE_URL -f portal-bwild-project-columns.sql
```

### Passo 2 — Criar a tabela `fornecedores` (se não existir)

A edge function `sync-supplier-inbound` espera uma tabela `fornecedores` com as colunas:

```sql
CREATE TABLE IF NOT EXISTS fornecedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo text DEFAULT 'produtos',
  cnpj_cpf text,
  razao_social text,
  categoria text,
  email text,
  telefone text,
  endereco text,
  cidade text,
  estado text,
  site text,
  condicoes_pagamento text,
  prazo_entrega_dias integer,
  nota numeric,
  observacoes text,
  produtos_servicos text,
  external_id uuid,
  external_system text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(external_id, external_system)
);
```

### Passo 3 — Criar a tabela `integration_sync_log` (se não existir)

```sql
CREATE TABLE IF NOT EXISTS integration_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system text NOT NULL,
  target_system text NOT NULL,
  entity_type text NOT NULL,
  source_id uuid NOT NULL,
  target_id uuid,
  sync_status text DEFAULT 'pending',
  attempts integer DEFAULT 0,
  error_message text,
  payload jsonb,
  created_at timestamptz DEFAULT now(),
  synced_at timestamptz
);
```

### Passo 4 — Configurar o secret de autenticação

No Portal BWild, o secret já está configurado:

| Nome | Valor | Descrição |
|------|-------|-----------|
| `INTEGRATION_API_KEY` | *(mesma chave compartilhada entre os dois sistemas)* | Chave para autenticar chamadas de integração |

### Passo 5 — Deploy das Edge Functions

Copie os arquivos para a estrutura de functions do projeto Portal BWild:

```bash
# Projetos
mkdir -p supabase/functions/sync-project-inbound
cp portal-bwild-sync-project-inbound.ts supabase/functions/sync-project-inbound/index.ts

# Fornecedores
mkdir -p supabase/functions/sync-supplier-inbound
cp portal-bwild-sync-supplier-inbound.ts supabase/functions/sync-supplier-inbound/index.ts

# Deploy
supabase functions deploy sync-project-inbound --no-verify-jwt
supabase functions deploy sync-supplier-inbound --no-verify-jwt
```

### Passo 6 — Configurar o Envision (já feito)

No projeto Envision, os seguintes secrets já estão configurados:

| Secret | Função |
|--------|--------|
| `PORTAL_BWILD_SUPABASE_URL` | URL do Supabase do Portal BWild |
| `PORTAL_BWILD_SERVICE_ROLE_KEY` | *(legado, não mais usado)* |
| `INTEGRATION_INBOUND_KEY` | Chave compartilhada enviada como `x-integration-key` |

---

## 🔄 Fluxo de Dados

### Projetos (Envision → Portal)
```
Budget muda para "contrato_fechado"
  → Trigger DB chama sync-project-outbound
    → POST para Portal BWild /functions/v1/sync-project-inbound
      → Valida x-integration-key
      → Upsert na tabela projects (por external_id)
      → Log em integration_sync_log
```

### Fornecedores (Envision → Portal)
```
Supplier criado/atualizado no Envision
  → Trigger DB chama sync-supplier-outbound
    → POST para Portal BWild /functions/v1/sync-supplier-inbound
      → Valida x-integration-key
      → Upsert na tabela fornecedores (por external_id)
      → Log em integration_sync_log
```

---

## 🧪 Testar a Integração

### Teste do sync-project-inbound
```bash
curl -X POST https://<PORTAL_BWILD_URL>/functions/v1/sync-project-inbound \
  -H "Content-Type: application/json" \
  -H "x-integration-key: <SUA_CHAVE>" \
  -d '{
    "source_id": "00000000-0000-0000-0000-000000000001",
    "name": "Projeto Teste",
    "client_name": "João da Silva",
    "client_phone": "11999999999",
    "neighborhood": "Brooklin",
    "city": "São Paulo",
    "area_sqm": "120",
    "estimated_weeks": 8
  }'
```

### Teste do sync-supplier-inbound
```bash
curl -X POST https://<PORTAL_BWILD_URL>/functions/v1/sync-supplier-inbound \
  -H "Content-Type: application/json" \
  -H "x-integration-key: <SUA_CHAVE>" \
  -d '{
    "source_id": "00000000-0000-0000-0000-000000000002",
    "nome": "Fornecedor Teste",
    "tipo": "produtos",
    "categoria": "Hidráulica",
    "email": "contato@teste.com"
  }'
```

---

## ✅ Checklist Final

- [ ] SQL de migração executado (tabela `projects` com colunas de integração)
- [ ] Tabela `fornecedores` criada
- [ ] Tabela `integration_sync_log` criada
- [x] Secret `INTEGRATION_API_KEY` configurado no Portal BWild
- [ ] Edge function `sync-project-inbound` deployada
- [ ] Edge function `sync-supplier-inbound` deployada
- [ ] Teste com curl do sync-project-inbound ✓
- [ ] Teste com curl do sync-supplier-inbound ✓
- [ ] Teste end-to-end: mudar budget para contrato_fechado no Envision e verificar no Portal
