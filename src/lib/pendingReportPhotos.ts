/**
 * Fotos tiradas fora do relatório (hub da obra, gaveta Registrar) a caminho
 * do relatório da semana.
 *
 * O celular só abre a câmera em resposta a um toque, então a foto é tirada
 * onde a pessoa tocou e fica aqui, em memória, até a tela do relatório abrir
 * e entregá-la ao editor (que guarda os bytes na fila offline e envia).
 * Vale só para a navegação seguinte: recarregar a página descarta.
 */
let pending: { projectId: string; files: File[] } | null = null;

export function stashReportPhotos(projectId: string, files: readonly File[]) {
  if (files.length === 0) return;
  const previous = pending?.projectId === projectId ? pending.files : [];
  pending = { projectId, files: [...previous, ...files] };
}

/** Entrega (uma única vez) as fotos guardadas para esta obra. */
export function takeReportPhotos(projectId: string): File[] {
  if (!pending || pending.projectId !== projectId) return [];
  const files = pending.files;
  pending = null;
  return files;
}
