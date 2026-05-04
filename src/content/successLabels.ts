/**
 * Copy de sucesso (toasts, banners de confirmação leve).
 *
 * Sem ponto de exclamação. Direto na ação, no objeto.
 * Ver `docs/TOM_DE_VOZ.md`.
 */

export const successLabels = {
  saved: "Alterações salvas",
  created: "Registro criado",
  updated: "Atualizado",
  deleted: "Removido",
  archived: "Arquivado",
  restored: "Restaurado",
  duplicated: "Duplicado",

  uploadDone: "Arquivo enviado",
  uploadMultiDone: "Arquivos enviados",
  fileRemoved: "Arquivo removido",

  obraCreated: "Obra cadastrada",
  obraUpdated: "Obra atualizada",
  obraArchived: "Obra arquivada",

  rdoCreated: "RDO lançado",
  rdoUpdated: "RDO atualizado",

  medicaoRegistered: "Medição registrada",
  medicaoApproved: "Medição aprovada",

  compraCreated: "Compra registrada",
  compraApproved: "Compra aprovada",
  compraReceived: "Recebimento confirmado",

  formalizacaoSent: "Formalização enviada",
  formalizacaoApproved: "Aprovação registrada",

  inviteSent: "Convite enviado",
  inviteAccepted: "Convite aceito",

  documentSent: "Documento enviado",

  paymentRegistered: "Pagamento registrado",

  emailSent: "E-mail enviado",
  copiedToClipboard: "Copiado",
} as const;

export type SuccessKey = keyof typeof successLabels;
