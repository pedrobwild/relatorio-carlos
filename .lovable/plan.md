
## Agente IA de Monitoramento de Sincronização

### Arquitetura

```
Sync falha → Trigger DB → Edge Function "sync-monitor-agent"
  → Analisa erro com IA (Lovable AI / Gemini Flash)
  → Corrige payload automaticamente
  → Reenvia para a Edge Function correta
  → Registra resultado na integration_sync_log
  → Cria notificação para admins
```

### Componentes

#### 1. Trigger no Banco (tempo real)
- Trigger na tabela `integration_sync_log` que dispara quando `sync_status = 'failed'`
- Chama a edge function `sync-monitor-agent` via `pg_net`

#### 2. Edge Function `sync-monitor-agent`
- Recebe o registro falhado (payload, error_message, entity_type)
- Envia para Lovable AI (Gemini Flash) com prompt especializado:
  - Analisa o `error_message` e o `payload`
  - Identifica a causa (coluna inexistente, valor inválido, tipo incorreto, campo obrigatório ausente)
  - Gera o payload corrigido
- Reenvia o payload corrigido para a edge function correspondente (`sync-supplier-inbound` ou `sync-project-inbound`)
- Atualiza o `integration_sync_log` com:
  - `sync_status: 'auto_corrected'` ou `'retry_failed'`
  - `error_message` atualizada com o diagnóstico da IA
  - Incrementa `attempts`
- Cria notificação para admins informando a correção

#### 3. Dashboard de Monitoramento (painel admin)
- Nova aba "Integrações" em `/admin/sistema`
- Cards com métricas: total sincronizados, falhados, corrigidos automaticamente
- Tabela de logs com filtros por status, entidade, sistema
- Detalhes de cada sync com payload original vs corrigido

#### 4. Limites de segurança
- Máximo 3 tentativas automáticas por registro
- Se a IA não conseguir corrigir, marca como `'needs_manual_review'`
- Notificação urgente para admins em caso de falhas repetidas

### Fluxo detalhado

1. Envision envia dados → `sync-supplier-inbound` ou `sync-project-inbound`
2. Se falhar → registro na `integration_sync_log` com `status = 'failed'`
3. Trigger detecta → chama `sync-monitor-agent`
4. IA analisa o erro e payload
5. IA gera payload corrigido
6. Reenvio automático para a function correta
7. Se sucesso → `status = 'auto_corrected'`
8. Se falhar novamente → incrementa attempts, se < 3 volta ao passo 4
9. Se esgotou tentativas → `status = 'needs_manual_review'` + notificação

### Tecnologias
- **IA**: Lovable AI Gateway (google/gemini-3-flash-preview)
- **Trigger**: pg_net para chamada assíncrona
- **Notificações**: Sistema de notificações existente
