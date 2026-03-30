# Padrões de Segurança — Portal BWild

## Lição aprendida do Módulo de Vistorias

O módulo de Vistorias foi entregue com regras de negócio críticas somente no frontend. Este documento estabelece os padrões obrigatórios para novos módulos.

---

## Checklist antes de iniciar o frontend de qualquer módulo

### Banco de dados

- [ ] Policies SELECT adicionam `is_staff()` para dados sensíveis (não apenas `has_project_access()`)
- [ ] Policies INSERT têm `WITH CHECK (created_by = auth.uid())`
- [ ] Transições de estado sensíveis são feitas via RPC com `SECURITY DEFINER`
- [ ] RPCs validam: estado atual esperado, role do usuário, campos obrigatórios
- [ ] Status + histórico são escritos na mesma transação
- [ ] Campos de auditoria (`approved_by`, `resolved_by`, etc.) são preenchidos pelo banco (dentro da RPC)
- [ ] Índices criados em todas as FKs desde o início
- [ ] Triggers para `updated_at` automático
- [ ] Triggers para campos de autoria (`created_by = auth.uid()`)

### Frontend

- [ ] Permissões controladas via `useCan()` + `permissions.ts` (nunca hardcode de role)
- [ ] Tipos importados dos gerados pelo Supabase CLI (nunca interfaces manuais)
- [ ] Acesso a dados somente via repositories (nunca `supabase.from()` direto em componentes)
- [ ] Hooks separados por domínio (um hook por entidade, não um monolítico)

---

## Padrão para novos módulos com máquina de estados

Para qualquer módulo que tenha transições de estado (pedidos, cotações, aprovações):

1. Criar RPC `transition_{entity}_status` com `SECURITY DEFINER`
2. A RPC valida: `estado_atual → estado_novo`, role, campos obrigatórios
3. Bloquear `UPDATE` direto no campo `status` via policy
4. Frontend usa `supabase.rpc('transition_entity_status', params)`
5. **Nunca confiar validação de role somente no React**

### Exemplo de estrutura de RPC

```sql
CREATE OR REPLACE FUNCTION public.transition_{entity}_status(
  p_entity_id uuid,
  p_new_status text,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status text;
  v_actor_role text;
BEGIN
  -- 1. Lock row
  SELECT status INTO v_current_status
  FROM {entity_table}
  WHERE id = p_entity_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Entity not found';
  END IF;

  -- 2. Validate transition
  IF NOT is_valid_transition(v_current_status, p_new_status) THEN
    RAISE EXCEPTION 'Invalid transition: % → %', v_current_status, p_new_status;
  END IF;

  -- 3. Validate role
  SELECT role INTO v_actor_role
  FROM user_roles
  WHERE user_id = auth.uid();

  IF p_new_status IN ('approved', 'closed') AND v_actor_role NOT IN ('admin', 'manager') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  -- 4. Update status + audit fields in same transaction
  UPDATE {entity_table}
  SET status = p_new_status,
      updated_at = now()
  WHERE id = p_entity_id;

  -- 5. Insert history
  INSERT INTO {entity}_history (entity_id, old_status, new_status, actor_id, notes)
  VALUES (p_entity_id, v_current_status, p_new_status, auth.uid(), p_notes);
END;
$$;
```

---

## Para o Módulo de Compras especificamente

Antes de escrever qualquer componente React de Compras:

1. **Mapear todas as transições de estado**: Solicitação, Cotação, Pedido
2. **Identificar quais transições têm restrição de role**
3. **Criar todas as RPCs de transição** com validação no banco
4. **Definir quais papéis** (`suprimentos`, `financeiro`, `gestor`, `admin`, `manager`) têm acesso a cada ação
5. **Adicionar esses papéis à `permissions.ts`** antes de usar em componentes

### Máquinas de estado previstas

#### Solicitação de Compra

```
draft → pending_approval → approved → in_quotation → ordered → closed
                         → rejected
                         → cancelled
```

#### Cotação

```
draft → sent → received → selected → expired
                        → rejected
```

#### Pedido de Compra

```
draft → approved → sent_to_supplier → partially_delivered → delivered → closed
                                                           → cancelled
```

### Papéis e ações no Módulo de Compras

| Ação | suprimentos | financeiro | gestor | engineer | manager | admin |
|------|:-----------:|:----------:|:------:|:--------:|:-------:|:-----:|
| Criar solicitação | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Aprovar solicitação | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| Criar cotação | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ |
| Selecionar fornecedor | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| Aprovar pedido (alçada) | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Registrar entrega | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Registrar pagamento | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| Cancelar pedido | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

---

## Referências internas

- `src/config/permissions.ts` — Matriz Feature × Role
- `src/hooks/useCan.ts` — Hook de permissões no frontend
- `src/lib/permissionGuard.ts` — Guards de permissão puros
- `src/infra/repositories/` — Camada de acesso a dados
- `docs/ARCHITECTURE.md` — Arquitetura geral do projeto
