import type { Database } from "@/integrations/supabase/types";

export type FormalizationPublicRow =
  Database["public"]["Views"]["formalizations_public_customer"]["Row"];

const now = new Date();
const iso = (d: Date) => d.toISOString();

const daysAgo = (n: number) => {
  const d = new Date(now);
  d.setDate(d.getDate() - n);
  return d;
};

const fakeHash = (seed: string) =>
  (seed.repeat(64).slice(0, 64) as string).replace(/[^a-f0-9]/gi, "a");

// Generate deterministic UUID from seed (for demo data consistency)
const seedUuid = (prefix: string, formalizationId: string) => {
  // Create a valid UUID v4 format using the formalization ID's first 8 chars
  const base = formalizationId.substring(0, 8).replace(/[^a-f0-9]/gi, "0");
  const prefixCode =
    prefix === "customer"
      ? "c000"
      : prefix === "company"
        ? "d000"
        : prefix === "ack-c"
          ? "e000"
          : prefix === "ack-d"
            ? "f000"
            : prefix === "evt"
              ? "a000"
              : "b000";
  return `${base}-${prefixCode}-4000-8000-000000000000`;
};

// Helper to create party objects
const createParties = (
  formalizationId: string,
  customerSigned: boolean,
  companySigned: boolean,
  customerMustSign: boolean = true,
) => [
  {
    id: seedUuid("customer", formalizationId),
    formalization_id: formalizationId,
    party_type: "customer",
    display_name: "Pedro Alves",
    email: "pedro.alves@email.com",
    role_label: "Cliente",
    must_sign: customerMustSign,
    user_id: null,
    created_at: iso(daysAgo(10)),
  },
  {
    id: seedUuid("company", formalizationId),
    formalization_id: formalizationId,
    party_type: "company",
    display_name: "Lucas Mendes",
    email: "lucas@bwild.com.br",
    role_label: "Engenheiro Responsável",
    must_sign: true,
    user_id: null,
    created_at: iso(daysAgo(10)),
  },
];

// Helper to create acknowledgements
const createAcknowledgements = (
  formalizationId: string,
  customerSigned: boolean,
  companySigned: boolean,
  customerDaysAgo: number = 5,
  companyDaysAgo: number = 5,
) => {
  const acks: Array<Record<string, unknown>> = [];
  if (customerSigned) {
    acks.push({
      id: seedUuid("ack-c", formalizationId),
      formalization_id: formalizationId,
      party_id: seedUuid("customer", formalizationId),
      acknowledged: true,
      acknowledged_at: iso(daysAgo(customerDaysAgo)),
      acknowledged_by_user_id: null,
      acknowledged_by_email: "pedro.alves@email.com",
      signature_text: "Li e estou ciente do conteúdo desta formalização.",
      signature_hash: fakeHash(`ack-customer-${formalizationId}`),
      ip_address: "187.45.123.89",
      user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)",
      created_at: iso(daysAgo(customerDaysAgo)),
    });
  }
  if (companySigned) {
    acks.push({
      id: seedUuid("ack-d", formalizationId),
      formalization_id: formalizationId,
      party_id: seedUuid("company", formalizationId),
      acknowledged: true,
      acknowledged_at: iso(daysAgo(companyDaysAgo)),
      acknowledged_by_user_id: null,
      acknowledged_by_email: "lucas@bwild.com.br",
      signature_text: "Li e estou ciente do conteúdo desta formalização.",
      signature_hash: fakeHash(`ack-company-${formalizationId}`),
      ip_address: "189.12.45.67",
      user_agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      created_at: iso(daysAgo(companyDaysAgo)),
    });
  }
  return acks.length > 0 ? acks : null;
};

// Helper to create events
const createEvents = (
  formalizationId: string,
  status: string,
  lockedDaysAgo: number | null,
) => {
  const base = formalizationId.substring(0, 8).replace(/[^a-f0-9]/gi, "0");
  const events = [
    {
      id: `${base}-0001-4000-8000-000000000000`,
      formalization_id: formalizationId,
      event_type: "created",
      actor_user_id: null,
      meta: {},
      created_at: iso(daysAgo(15)),
    },
  ];

  if (status !== "draft") {
    events.push({
      id: `${base}-0002-4000-8000-000000000000`,
      formalization_id: formalizationId,
      event_type: "sent_for_signature",
      actor_user_id: null,
      meta: {},
      created_at: iso(daysAgo(lockedDaysAgo ?? 10)),
    });
  }

  if (lockedDaysAgo !== null) {
    events.push({
      id: `${base}-0003-4000-8000-000000000000`,
      formalization_id: formalizationId,
      event_type: "locked",
      actor_user_id: null,
      meta: { locked_hash: fakeHash(formalizationId) },
      created_at: iso(daysAgo(lockedDaysAgo)),
    });
  }

  return events;
};

export const formalizacoesSeedData: FormalizationPublicRow[] = [
  {
    id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    customer_org_id: null,
    project_id: null,
    unit_id: null,
    type: "budget_item_swap",
    title: "Troca de Revestimento Banheiro",
    summary:
      "Substituição do porcelanato previsto por mármore Carrara conforme solicitação do cliente.",
    body_md:
      "## Troca de Item de Orçamento\n\n**Item Original:** Porcelanato Portinari 60x60 Acetinado\n**Valor Original:** R$ 8.500,00\n\n**Item Substituto:** Mármore Carrara Polido\n**Valor Substituto:** R$ 15.200,00\n\n### Diferença de Valor\n- Acréscimo: **R$ 6.700,00**\n\n### Prazo de Impacto\n- Prazo adicional estimado: **5 dias úteis**.",
    data: {
      originalItem: "Porcelanato Portinari 60x60",
      originalValue: 8500,
      newItem: "Mármore Carrara Polido",
      newValue: 15200,
      difference: 6700,
    } as any,
    status: "pending_signatures",
    created_at: iso(daysAgo(7)),
    updated_at: iso(daysAgo(1)),
    last_activity_at: iso(daysAgo(1)),
    locked_at: iso(daysAgo(2)),
    locked_hash: fakeHash("a1b2c3"),
    acknowledgements: createAcknowledgements(
      "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      false,
      false,
    ) as any,
    attachments: null,
    events: createEvents(
      "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "pending_signatures",
      2,
    ) as any,
    evidence_links: null,
    parties: createParties(
      "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      false,
      false,
    ) as any,
    parties_signed: 0,
    parties_total: 2,
  },
  {
    id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    customer_org_id: null,
    project_id: null,
    unit_id: null,
    type: "meeting_minutes",
    title: "Ata de Reunião - Definição de Acabamentos",
    summary:
      "Registro das decisões tomadas na reunião de 05/12/2025 sobre acabamentos finais.",
    body_md:
      "## Ata de Reunião\n\n**Data:** 05/12/2025\n**Horário:** 14:00 - 15:30\n\n### Participantes\n- Pedro Alves (Cliente)\n- Lucas Mendes (Engenheiro Bwild)\n- Mariana Costa (Arquiteta)\n\n### Decisões\n1. **Pintura:** Branco Neve (Suvinil) em todos os ambientes\n2. **Metais:** Deca Aspen (cromado) para banheiros e cozinha\n3. **Iluminação:** Spots embutidos na sala e pendentes sobre a mesa de jantar\n\n### Próximos Passos\n- Confirmar disponibilidade de estoque dos metais escolhidos\n- Agendar visita para definição de pontos de iluminação",
    data: { meetingDate: "2025-12-05", decisions: 3 } as any,
    status: "signed",
    created_at: iso(daysAgo(12)),
    updated_at: iso(daysAgo(10)),
    last_activity_at: iso(daysAgo(10)),
    locked_at: iso(daysAgo(10)),
    locked_hash: fakeHash("b2c3d4"),
    acknowledgements: createAcknowledgements(
      "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      true,
      true,
      10,
      10,
    ) as any,
    attachments: null,
    events: createEvents(
      "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "signed",
      10,
    ) as any,
    evidence_links: null,
    parties: createParties(
      "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      true,
      true,
    ) as any,
    parties_signed: 2,
    parties_total: 2,
  },
  {
    id: "c3d4e5f6-a7b8-9012-cdef-123456789012",
    customer_org_id: null,
    project_id: null,
    unit_id: null,
    type: "exception_custody",
    title: "Termo de Guarda - Chaves do Imóvel",
    summary:
      "Registro de entrega temporária das chaves ao cliente para visita com designer.",
    body_md:
      "## Termo de Guarda de Exceção\n\n**Data de Entrega:** 10/12/2025\n**Previsão de Devolução:** 12/12/2025\n\n### Itens Entregues\n- 3 (três) cópias de chave da porta principal\n- 1 (um) controle de acesso ao edifício\n\n### Finalidade\nAcesso ao imóvel para visita técnica com designer de interiores para projeto de mobiliário.\n\n### Responsabilidades\nO cliente se responsabiliza pela guarda e conservação dos itens durante o período de posse.",
    data: { itemType: "keys", quantity: 3 } as any,
    status: "draft",
    created_at: iso(daysAgo(3)),
    updated_at: iso(daysAgo(3)),
    last_activity_at: iso(daysAgo(3)),
    locked_at: null,
    locked_hash: null,
    acknowledgements: null,
    attachments: null,
    events: createEvents(
      "c3d4e5f6-a7b8-9012-cdef-123456789012",
      "draft",
      null,
    ) as any,
    evidence_links: null,
    parties: createParties(
      "c3d4e5f6-a7b8-9012-cdef-123456789012",
      false,
      false,
    ) as any,
    parties_signed: 0,
    parties_total: 2,
  },
  {
    id: "d4e5f6a7-b8c9-0123-def0-234567890123",
    customer_org_id: null,
    project_id: null,
    unit_id: null,
    type: "scope_change",
    title: "Alteração de Escopo - Closet Adicional",
    summary:
      "Inclusão de closet planejado no segundo dormitório conforme nova solicitação.",
    body_md:
      "## Alteração de Escopo\n\n### Descrição\nInclusão de closet planejado no segundo dormitório, conforme solicitação do cliente em reunião de 25/11/2025.\n\n### Especificações\n- Closet linear de 2,50m de largura\n- 2 módulos com portas de correr em MDF branco\n- Iluminação LED interna\n- Gavetas com corrediças telescópicas\n\n### Impacto Financeiro\n- Valor adicional: **R$ 12.800,00**\n\n### Impacto no Prazo\n- Prazo adicional: **8 dias úteis**\n- Nova data prevista de entrega: 22/09/2025",
    data: { additionalCost: 12800, additionalDays: 8 } as any,
    status: "pending_signatures",
    created_at: iso(daysAgo(20)),
    updated_at: iso(daysAgo(5)),
    last_activity_at: iso(daysAgo(5)),
    locked_at: iso(daysAgo(6)),
    locked_hash: fakeHash("d4e5f6"),
    acknowledgements: createAcknowledgements(
      "d4e5f6a7-b8c9-0123-def0-234567890123",
      false,
      true,
      0,
      5,
    ) as any,
    attachments: null,
    events: createEvents(
      "d4e5f6a7-b8c9-0123-def0-234567890123",
      "pending_signatures",
      6,
    ) as any,
    evidence_links: null,
    parties: createParties(
      "d4e5f6a7-b8c9-0123-def0-234567890123",
      false,
      true,
    ) as any,
    parties_signed: 1,
    parties_total: 2,
  },
  {
    id: "e5f6a7b8-c9d0-1234-ef01-345678901234",
    customer_org_id: null,
    project_id: null,
    unit_id: null,
    type: "general",
    title: "Autorização para Instalação de Ar-Condicionado",
    summary:
      "Autorização do cliente para execução de infraestrutura de ar-condicionado.",
    body_md:
      "## Autorização Geral\n\nO cliente **Pedro Alves** autoriza a execução de infraestrutura para instalação de ar-condicionado split nos seguintes ambientes:\n\n### Ambientes\n1. Sala de estar/jantar\n2. Suíte master\n3. Dormitório 2\n\n### Especificações Técnicas\n- Tubulação de cobre isolada\n- Dreno com caimento adequado\n- Ponto elétrico exclusivo 220V para cada unidade\n\n### Garantia\n- **2 anos** para a infraestrutura executada pela Bwild\n- Instalação dos equipamentos por conta do cliente",
    data: {
      subject: "Infraestrutura ar-condicionado",
      warranty: "2 anos",
    } as any,
    status: "signed",
    created_at: iso(daysAgo(30)),
    updated_at: iso(daysAgo(28)),
    last_activity_at: iso(daysAgo(28)),
    locked_at: iso(daysAgo(28)),
    locked_hash: fakeHash("e5f6a7"),
    acknowledgements: createAcknowledgements(
      "e5f6a7b8-c9d0-1234-ef01-345678901234",
      true,
      true,
      28,
      28,
    ) as any,
    attachments: null,
    events: createEvents(
      "e5f6a7b8-c9d0-1234-ef01-345678901234",
      "signed",
      28,
    ) as any,
    evidence_links: null,
    parties: createParties(
      "e5f6a7b8-c9d0-1234-ef01-345678901234",
      true,
      true,
    ) as any,
    parties_signed: 2,
    parties_total: 2,
  },
  {
    id: "f6a7b8c9-d0e1-2345-f012-456789012345",
    customer_org_id: null,
    project_id: null,
    unit_id: null,
    type: "exception_custody",
    title: "Uso Antecipado da Unidade – 12 a 15/08",
    summary:
      "Cliente utilizará a unidade antes da entrega oficial, com acréscimo de 3 dias no prazo de entrega.",
    body_md:
      "## Termo de Uso Antecipado da Unidade\n\nO cliente **Pedro Alves**, titular da unidade **Hub Brooklyn – 502**, solicita e declara ciência das condições abaixo:\n\n### Período de Uso\n- **Data de início:** 12/08/2025\n- **Data de término:** 15/08/2025\n- **Duração total:** 3 (três) dias\n\n### Condições Acordadas\n\n1. **Acréscimo no prazo de entrega:** Em razão do uso antecipado, serão acrescidos **3 (três) dias úteis** à data de entrega final prevista em contrato.\n\n2. **Isenção de responsabilidade:** A Bwild **não se responsabiliza** por quaisquer danos, avarias, furtos ou ocorrências durante o período de uso antecipado, ficando o cliente como único responsável pela guarda e conservação do imóvel e seus componentes.\n\n3. **Estado do imóvel:** O cliente declara estar ciente de que o imóvel ainda se encontra em fase de acabamento e que poderá haver atividades de obra remanescentes após o período de uso.\n\n4. **Consumo:** Eventuais consumos de água, luz e gás durante o período serão de responsabilidade do cliente.\n\n---\n\nEste termo formaliza a ciência mútua das condições acordadas.",
    data: {
      periodo: { inicio: "2025-08-12", fim: "2025-08-15", dias: 3 },
      acrescimo_prazo_dias: 3,
      motivo: "Hospedagem do cliente antes da entrega oficial",
    } as any,
    status: "pending_signatures",
    created_at: iso(daysAgo(1)),
    updated_at: iso(daysAgo(1)),
    last_activity_at: iso(daysAgo(1)),
    locked_at: iso(daysAgo(1)),
    locked_hash: fakeHash("f6a7b8"),
    acknowledgements: createAcknowledgements(
      "f6a7b8c9-d0e1-2345-f012-456789012345",
      false,
      true,
      0,
      1,
    ) as any,
    attachments: null,
    events: createEvents(
      "f6a7b8c9-d0e1-2345-f012-456789012345",
      "pending_signatures",
      1,
    ) as any,
    evidence_links: null,
    parties: createParties(
      "f6a7b8c9-d0e1-2345-f012-456789012345",
      false,
      true,
    ) as any,
    parties_signed: 1,
    parties_total: 2,
  },
  {
    id: "g7b8c9d0-e1f2-3456-0123-567890123456",
    customer_org_id: null,
    project_id: null,
    unit_id: null,
    type: "general",
    title: "Aprovação Tácita – Projeto Executivo",
    summary:
      "Registro formal de aprovação tácita do Projeto Executivo conforme cláusula 10.4 do contrato.",
    body_md: `## Registro de Aprovação Tácita

### Documento
**Projeto Executivo** – Hub Brooklyn 502

### Fundamentação Contratual
Conforme **Cláusula 10.4** do Contrato de Prestação de Serviços de Reforma:

> *"O Cliente terá prazo de 5 (cinco) dias úteis, contados do recebimento do Projeto Executivo, para manifestar-se por escrito sobre eventuais objeções ou solicitações de alteração. Decorrido o prazo sem manifestação, o projeto será considerado tacitamente aprovado."*

### Cronologia
- **Data de envio do projeto:** 17/06/2025
- **Prazo para manifestação:** 24/06/2025 (5 dias úteis)
- **Data de aprovação tácita:** 25/06/2025

### Declaração
Declaro que o Projeto Executivo foi devidamente enviado ao cliente **Pedro Alves** na data indicada, por meio do Portal do Cliente, e que não houve manifestação dentro do prazo contratual estipulado.

Desta forma, em conformidade com a cláusula contratual supracitada, o documento encontra-se **tacitamente aprovado**, tendo validade para todos os fins de execução da obra.

### Observações
- Este registro tem caráter unilateral e não requer assinatura do cliente
- A aprovação tácita possui mesma validade jurídica da aprovação expressa
- O cliente foi notificado sobre a aprovação tácita em 25/06/2025`,
    data: {
      documentType: "Projeto Executivo",
      clausulaContratual: "10.4",
      dataEnvio: "2025-06-17",
      prazoManifestacao: "2025-06-24",
      dataAprovacao: "2025-06-25",
      tipoAprovacao: "tacita",
    } as any,
    status: "signed",
    created_at: "2025-06-25T10:00:00.000Z",
    updated_at: "2025-06-25T10:00:00.000Z",
    last_activity_at: "2025-06-25T10:00:00.000Z",
    locked_at: "2025-06-25T10:00:00.000Z",
    locked_hash: fakeHash("g7b8c9"),
    acknowledgements: [
      {
        id: seedUuid("ack-d", "g7b8c9d0-e1f2-3456-0123-567890123456"),
        formalization_id: "g7b8c9d0-e1f2-3456-0123-567890123456",
        party_id: seedUuid("company", "g7b8c9d0-e1f2-3456-0123-567890123456"),
        acknowledged: true,
        acknowledged_at: "2025-06-25T10:00:00.000Z",
        acknowledged_by_user_id: null,
        acknowledged_by_email: "lucas@bwild.com.br",
        signature_text:
          "Registro e atesto a aprovação tácita do Projeto Executivo conforme cláusula 10.4 do contrato.",
        signature_hash: fakeHash("ack-company-g7b8c9d0"),
        ip_address: "189.12.45.67",
        user_agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        created_at: "2025-06-25T10:00:00.000Z",
      },
    ] as any,
    attachments: null,
    events: [
      {
        id: "07b8c9d0-0001-4000-8000-000000000000",
        formalization_id: "g7b8c9d0-e1f2-3456-0123-567890123456",
        event_type: "created",
        actor_user_id: null,
        meta: {},
        created_at: "2025-06-25T09:30:00.000Z",
      },
      {
        id: "07b8c9d0-0002-4000-8000-000000000000",
        formalization_id: "g7b8c9d0-e1f2-3456-0123-567890123456",
        event_type: "sent_for_signature",
        actor_user_id: null,
        meta: {},
        created_at: "2025-06-25T09:45:00.000Z",
      },
      {
        id: "07b8c9d0-0003-4000-8000-000000000000",
        formalization_id: "g7b8c9d0-e1f2-3456-0123-567890123456",
        event_type: "locked",
        actor_user_id: null,
        meta: { locked_hash: fakeHash("g7b8c9") },
        created_at: "2025-06-25T10:00:00.000Z",
      },
    ] as any,
    evidence_links: null,
    parties: [
      {
        id: seedUuid("customer", "g7b8c9d0-e1f2-3456-0123-567890123456"),
        formalization_id: "g7b8c9d0-e1f2-3456-0123-567890123456",
        party_type: "customer",
        display_name: "Pedro Alves",
        email: "pedro.alves@email.com",
        role_label: "Cliente (notificado)",
        must_sign: false, // Não requer assinatura - aprovação tácita
        user_id: null,
        created_at: "2025-06-25T09:30:00.000Z",
      },
      {
        id: seedUuid("company", "g7b8c9d0-e1f2-3456-0123-567890123456"),
        formalization_id: "g7b8c9d0-e1f2-3456-0123-567890123456",
        party_type: "company",
        display_name: "Lucas Mendes",
        email: "lucas@bwild.com.br",
        role_label: "Engenheiro Responsável",
        must_sign: true,
        user_id: null,
        created_at: "2025-06-25T09:30:00.000Z",
      },
    ] as any,
    parties_signed: 1,
    parties_total: 1, // Apenas 1 parte precisa assinar (company)
  },
];

export function getFormalizacaoSeedById(id: string) {
  return formalizacoesSeedData.find((f) => f.id === id) ?? null;
}
