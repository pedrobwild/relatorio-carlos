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
    acknowledgements: null,
    attachments: null,
    events: null,
    evidence_links: null,
    parties: null,
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
    summary: "Registro das decisões tomadas na reunião de 05/12/2025 sobre acabamentos finais.",
    body_md:
      "## Ata de Reunião\n\n**Data:** 05/12/2025\n**Horário:** 14:00 - 15:30\n\n### Decisões\n1. Pintura: Branco Neve (Suvinil)\n2. Metais: Deca Aspen (cromado)\n3. Iluminação: Spots embutidos e pendentes na sala",
    data: { meetingDate: "2025-12-05", decisions: 3 } as any,
    status: "signed",
    created_at: iso(daysAgo(12)),
    updated_at: iso(daysAgo(10)),
    last_activity_at: iso(daysAgo(10)),
    locked_at: iso(daysAgo(10)),
    locked_hash: fakeHash("b2c3d4"),
    acknowledgements: null,
    attachments: null,
    events: null,
    evidence_links: null,
    parties: null,
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
    summary: "Registro de entrega temporária das chaves ao cliente para visita com designer.",
    body_md:
      "## Termo de Guarda de Exceção\n\n**Data de Entrega:** 10/12/2025\n**Previsão de Devolução:** 12/12/2025\n\n### Finalidade\nAcesso ao imóvel para visita técnica com designer de interiores.",
    data: { itemType: "keys", quantity: 3 } as any,
    status: "draft",
    created_at: iso(daysAgo(3)),
    updated_at: iso(daysAgo(3)),
    last_activity_at: iso(daysAgo(3)),
    locked_at: null,
    locked_hash: null,
    acknowledgements: null,
    attachments: null,
    events: null,
    evidence_links: null,
    parties: null,
    parties_signed: null,
    parties_total: null,
  },
  {
    id: "d4e5f6a7-b8c9-0123-def0-234567890123",
    customer_org_id: null,
    project_id: null,
    unit_id: null,
    type: "scope_change",
    title: "Alteração de Escopo - Closet Adicional",
    summary: "Inclusão de closet planejado no segundo dormitório conforme nova solicitação.",
    body_md:
      "## Alteração de Escopo\n\n### Descrição\nInclusão de closet planejado no segundo dormitório.\n\n### Impacto\n- Valor adicional: **R$ 12.800,00**\n- Prazo adicional: **8 dias úteis**",
    data: { additionalCost: 12800, additionalDays: 8 } as any,
    status: "pending_signatures",
    created_at: iso(daysAgo(20)),
    updated_at: iso(daysAgo(5)),
    last_activity_at: iso(daysAgo(5)),
    locked_at: iso(daysAgo(6)),
    locked_hash: fakeHash("d4e5f6"),
    acknowledgements: null,
    attachments: null,
    events: null,
    evidence_links: null,
    parties: null,
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
    summary: "Autorização do cliente para execução de infraestrutura de ar-condicionado.",
    body_md:
      "## Autorização Geral\n\nCliente autoriza execução de infraestrutura para split em 3 ambientes.\n\n**Garantia:** 2 anos para a infraestrutura executada.",
    data: { subject: "Infraestrutura ar-condicionado", warranty: "2 anos" } as any,
    status: "signed",
    created_at: iso(daysAgo(30)),
    updated_at: iso(daysAgo(28)),
    last_activity_at: iso(daysAgo(28)),
    locked_at: iso(daysAgo(28)),
    locked_hash: fakeHash("e5f6a7"),
    acknowledgements: null,
    attachments: null,
    events: null,
    evidence_links: null,
    parties: null,
    parties_signed: 2,
    parties_total: 2,
  },
];

export function getFormalizacaoSeedById(id: string) {
  return formalizacoesSeedData.find((f) => f.id === id) ?? null;
}
