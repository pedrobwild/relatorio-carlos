/**
 * Comentário interno a partir de um relato do diário.
 *
 * Não cria um segundo lugar de comentários: vira uma observação interna da
 * obra (só equipe), com uma primeira linha dizendo de qual dia e etapa do
 * diário ela fala. As marcações seguem o caminho de sempre.
 */
export const COMENTARIO_DIARIO_MAX = 3800;

export interface ContextoDoRelato {
  /** yyyy-MM-dd do relato. */
  dia: string;
  etapa: string;
}

function diaMes(iso: string): string {
  const [, m, d] = iso.split("-");
  return d && m ? `${d}/${m}` : iso;
}

/** "Diário de 24/11 · Pintura" */
export function referenciaDoRelato(c: ContextoDoRelato): string {
  return `Diário de ${diaMes(c.dia)} · ${c.etapa.trim()}`;
}

/** Texto final da observação: referência na 1ª linha, comentário abaixo. */
export function corpoDoComentario(c: ContextoDoRelato, texto: string): string {
  return `${referenciaDoRelato(c)}\n${texto.trim()}`;
}

export function comentarioValido(texto: string): boolean {
  const t = texto.trim();
  return t.length > 0 && t.length <= COMENTARIO_DIARIO_MAX;
}
