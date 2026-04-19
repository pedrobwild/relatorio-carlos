# Envision — Atualização do `sync-project-outbound` para enviar bloco `client`

## Contexto

O CRM do Envision evoluiu (migrations `20260419171641` e `20260419173141`) e agora a tabela `clients` armazena dados ricos do cliente e do imóvel separadamente do `budget`:

- `nationality`, `marital_status`, `profession`, `rg`
- Endereço residencial: `address`, `address_complement`, `state`, `zip_code`
- Endereço do imóvel: `property_address`, `property_address_complement`, `property_bairro`, `property_city`, `property_state`, `property_zip_code`
- Imóvel: `property_metragem`, `property_empreendimento`, `property_floor_plan_url`

O Portal BWild (`sync-project-inbound`) **já está pronto para receber esses dados** num bloco `client`. Falta o `sync-project-outbound` do Envision incluí-los no payload.

## O que mudar no Envision

No arquivo `supabase/functions/sync-project-outbound/index.ts`, dentro de `syncSingleProject`, **logo após buscar o `budget`**, busque também o `client` vinculado e adicione o objeto ao payload enviado para o Portal.

### 1. Após buscar o budget, busque o client

```ts
// --- Fetch the rich client record (CRM data) ---
let clientData: any = null;
if (budget.client_id) {
  const { data: c } = await localDb
    .from("clients")
    .select(`
      id, name, email, phone, cpf, rg,
      nationality, marital_status, profession,
      address, address_complement, state, zip_code,
      property_address, property_address_complement,
      property_bairro, property_city, property_state, property_zip_code,
      property_metragem, property_empreendimento, property_floor_plan_url,
      city, bairro
    `)
    .eq("id", budget.client_id)
    .maybeSingle();
  clientData = c;
}
```

### 2. Adicione `client` ao `outboundBody`

Onde hoje você tem:

```ts
const outboundBody = {
  project: projectPayload,
  budget: budgetBreakdown,
  source_id: budgetId,
};
```

Substitua por:

```ts
const outboundBody = {
  project: projectPayload,
  budget: budgetBreakdown,
  client: clientData ? {
    name: clientData.name,
    email: clientData.email,
    phone: clientData.phone,
    cpf: clientData.cpf,
    rg: clientData.rg,
    nationality: clientData.nationality,
    marital_status: clientData.marital_status,
    profession: clientData.profession,
    // Residencial
    address: clientData.address,
    address_complement: clientData.address_complement,
    city: clientData.city,
    state: clientData.state,
    zip_code: clientData.zip_code,
    // Imóvel
    property_address: clientData.property_address,
    property_address_complement: clientData.property_address_complement,
    property_bairro: clientData.property_bairro,
    property_city: clientData.property_city,
    property_state: clientData.property_state,
    property_zip_code: clientData.property_zip_code,
    property_metragem: clientData.property_metragem,
    property_empreendimento: clientData.property_empreendimento,
    property_floor_plan_url: clientData.property_floor_plan_url,
  } : null,
  source_id: budgetId,
};
```

### 3. Deploy

```bash
supabase functions deploy sync-project-outbound --no-verify-jwt
```

## Como o Portal trata o bloco `client`

| Campo do `client` | Destino no Portal BWild |
|---|---|
| `cpf`, `rg`, `nationality`, `marital_status`, `profession` | `project_customers` (cpf, rg, nacionalidade, estado_civil, profissao) |
| `address` + `address_complement` + `zip_code` | `project_customers.endereco_residencial` (concatenado) |
| `city`, `state` | `project_customers.cidade`, `project_customers.estado` |
| `property_empreendimento` | `project_studio_info.nome_do_empreendimento` |
| `property_address` | `project_studio_info.endereco_completo` |
| `property_address_complement` | `project_studio_info.complemento` |
| `property_bairro` | `project_studio_info.bairro` |
| `property_city` | `project_studio_info.cidade` |
| `property_zip_code` | `project_studio_info.cep` |
| `property_metragem` (string) | `project_studio_info.tamanho_imovel_m2` (parseado p/ número) |
| `property_floor_plan_url` | Baixado e salvo em **Documentos → Plano de Reforma** (categoria `plano_reforma`) |

## Comportamento de prioridade

O Portal usa **`client.property_*` quando disponível**, caindo de volta para os campos do `project` (vindos do `budget`) quando o bloco `client` for `null` ou um campo estiver vazio. Isso mantém retrocompatibilidade total — se você não atualizar o Envision agora, nada quebra.

Após o seed inicial, a IA do Portal continua extraindo o contrato PDF para preencher campos restantes — mas só atualiza o que está vazio (não sobrescreve dados vindos do CRM).
