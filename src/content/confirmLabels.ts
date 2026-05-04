/**
 * Copy de confirmação destrutiva.
 *
 * Cada confirmação descreve a CONSEQUÊNCIA concreta — quantidade afetada,
 * irreversibilidade. Nunca apenas "Tem certeza?".
 *
 * Use sempre via `<AlertDialog>` ou `<Dialog>` do design system.
 * Nunca `alert()` / `confirm()` nativos.
 *
 * Ver `docs/TOM_DE_VOZ.md`.
 */

export interface ConfirmCopy {
  title: string;
  /**
   * Descrição com placeholders no formato {nome}. Use `formatConfirm`
   * para preencher.
   */
  description: string;
  /** Texto do botão destrutivo. Verbo no imperativo. */
  confirmCta: string;
  /** Texto do botão de cancelamento (opcional, default "Cancelar"). */
  cancelCta?: string;
}

export const confirmLabels = {
  excluirObra: {
    title: "Excluir obra?",
    description:
      "Excluir esta obra remove {medicoes} medições, {compras} compras e {documentos} documentos vinculados. Não dá pra desfazer.",
    confirmCta: "Excluir obra",
  },
  arquivarObra: {
    title: "Arquivar obra?",
    description:
      "A obra sai do painel ativo. Você ainda pode consultar histórico e restaurar depois.",
    confirmCta: "Arquivar",
  },
  excluirRdo: {
    title: "Apagar este RDO?",
    description:
      "Apagar este RDO apaga as {fotos} fotos do dia e os {atividades} apontamentos. Sem volta.",
    confirmCta: "Apagar RDO",
  },
  excluirMedicao: {
    title: "Excluir medição?",
    description:
      "A cobrança vinculada à medição será cancelada. Não dá pra desfazer.",
    confirmCta: "Excluir medição",
  },
  cancelarCompra: {
    title: "Cancelar compra?",
    description:
      "O fornecedor é notificado e o pedido é encerrado. Recebimentos parciais permanecem registrados.",
    confirmCta: "Cancelar compra",
  },
  cancelarFormalizacao: {
    title: "Cancelar formalização?",
    description:
      "O cliente é notificado por e-mail. Esta ação fica registrada no histórico.",
    confirmCta: "Cancelar formalização",
  },
  excluirDocumento: {
    title: "Excluir documento?",
    description:
      "O arquivo vai pra lixeira por 30 dias e depois é apagado de vez.",
    confirmCta: "Excluir documento",
  },
  removerUsuario: {
    title: "Remover acesso de {nome}?",
    description:
      "{nome} perde acesso à obra imediatamente. Você pode convidar de novo depois.",
    confirmCta: "Remover acesso",
  },
  sairSemSalvar: {
    title: "Sair sem salvar?",
    description:
      "As alterações ainda não foram salvas. Se sair agora, você perde o que foi preenchido.",
    confirmCta: "Sair sem salvar",
    cancelCta: "Continuar editando",
  },
  resetarConfiguracoes: {
    title: "Restaurar padrões?",
    description:
      "Suas configurações personalizadas voltam ao padrão BWild. Não dá pra desfazer.",
    confirmCta: "Restaurar padrões",
  },
} as const satisfies Record<string, ConfirmCopy>;

export type ConfirmKey = keyof typeof confirmLabels;

/**
 * Substitui placeholders {chave} pelos valores recebidos.
 * Mantém o placeholder se a chave estiver ausente — facilita debug.
 */
export function formatConfirm(
  key: ConfirmKey,
  values: Record<string, string | number> = {},
): ConfirmCopy {
  const copy = confirmLabels[key] as ConfirmCopy;
  const fill = (s: string) =>
    s.replace(/\{(\w+)\}/g, (_, k) =>
      values[k] !== undefined ? String(values[k]) : `{${k}}`,
    );
  return {
    title: fill(copy.title),
    description: fill(copy.description),
    confirmCta: copy.confirmCta,
    cancelCta: copy.cancelCta ?? "Cancelar",
  };
}
