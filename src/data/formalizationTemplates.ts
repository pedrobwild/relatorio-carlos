/**
 * Pre-filled body templates for formalization types.
 * Used in FormalizacaoNova to populate the body_md field.
 */

import type { FormalizationType } from "@/types/formalization";

export interface FormalizationTemplate {
  type: FormalizationType;
  title: string;
  summary: string;
  body_md: string;
}

export const formalizationTemplates: Partial<
  Record<FormalizationType, FormalizationTemplate>
> = {
  budget_item_swap: {
    type: "budget_item_swap",
    title: "Troca de Item de Orçamento",
    summary:
      "Substituição de item previsto no orçamento original por alternativa equivalente.",
    body_md: `## Troca de Item de Orçamento

### Item Original
- **Descrição:** [Descrever o item original]
- **Código/Referência:** [Código do item]
- **Valor unitário:** R$ [valor]

### Item Substituto
- **Descrição:** [Descrever o novo item]
- **Código/Referência:** [Código do novo item]
- **Valor unitário:** R$ [valor]

### Justificativa
[Explicar o motivo da troca: indisponibilidade, custo-benefício, preferência do cliente, etc.]

### Impacto no Orçamento
- **Diferença de valor:** R$ [valor] ([acréscimo/redução])
- **Impacto no cronograma:** [Nenhum / Atraso de X dias]

### Condições
- O novo item mantém as mesmas especificações técnicas mínimas exigidas pelo projeto.
- A troca não altera a garantia sobre os demais itens da obra.
`,
  },
  meeting_minutes: {
    type: "meeting_minutes",
    title: "Ata de Reunião",
    summary: "Registro de decisões e encaminhamentos da reunião.",
    body_md: `## Ata de Reunião

### Informações Gerais
- **Data:** [DD/MM/AAAA]
- **Horário:** [HH:MM] às [HH:MM]
- **Local/Meio:** [Presencial / Videochamada]

### Participantes
| Nome | Função |
|------|--------|
| [Nome] | [Função] |
| [Nome] | [Função] |

### Pauta
1. [Tópico 1]
2. [Tópico 2]
3. [Tópico 3]

### Decisões
- [ ] [Decisão 1 — Responsável: Nome — Prazo: DD/MM]
- [ ] [Decisão 2 — Responsável: Nome — Prazo: DD/MM]

### Pendências Anteriores
- [Pendência 1 — Status: Resolvida / Em andamento]

### Observações
[Notas adicionais ou registros importantes]

### Próxima Reunião
- **Data prevista:** [DD/MM/AAAA]
- **Pauta preliminar:** [Tópicos a serem abordados]
`,
  },
  exception_custody: {
    type: "exception_custody",
    title: "Termo de Custódia",
    summary: "Registro de custódia temporária de item ou material.",
    body_md: `## Termo de Custódia de Exceção

### Identificação do Item
- **Descrição:** [Descrever o item sob custódia]
- **Quantidade:** [Qtd]
- **Estado de conservação:** [Novo / Usado / Com avarias]

### Responsável pela Custódia
- **Nome:** [Nome do responsável]
- **Função:** [Função]
- **Período:** [DD/MM/AAAA] a [DD/MM/AAAA]

### Local de Armazenamento
- **Endereço/Local:** [Descrever o local]
- **Condições:** [Coberto / Climatizado / Aberto]

### Justificativa
[Explicar por que o item está sob custódia temporária e não foi instalado/utilizado]

### Condições de Devolução
- O item deve ser devolvido nas mesmas condições registradas acima.
- Qualquer dano ocorrido durante a custódia é de responsabilidade do custodiante.

### Registro Fotográfico
[Anexar fotos do item no momento da entrega para custódia]
`,
  },
  scope_change: {
    type: "scope_change",
    title: "Alteração de Escopo",
    summary: "Registro de alteração no escopo original do projeto.",
    body_md: `## Alteração de Escopo

### Descrição da Alteração
[Descrever detalhadamente a mudança solicitada]

### Escopo Original
[Descrever o que estava previsto originalmente]

### Novo Escopo
[Descrever o que será executado após a alteração]

### Justificativa
[Motivo da alteração: solicitação do cliente, necessidade técnica, etc.]

### Impactos
- **Prazo:** [Sem impacto / Acréscimo de X dias úteis]
- **Custo:** [Sem impacto / Acréscimo de R$ X,XX]
- **Qualidade/Especificações:** [Sem impacto / Alteração em...]

### Condições
- Esta alteração entra em vigor após a assinatura de ambas as partes.
- Valores adicionais serão cobrados conforme tabela de aditivos contratuais.
- O novo prazo estimado passa a ser [DD/MM/AAAA].
`,
  },
};
