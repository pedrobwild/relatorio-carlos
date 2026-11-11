import type { SyntheticEvent } from "react";

/**
 * `onError` para miniaturas: esconde a imagem que não carregou (link
 * assinado vencido, arquivo removido) para aparecer o fundo do contêiner em
 * vez do ícone de imagem quebrada do navegador. O `alt` continua disponível
 * para leitores de tela.
 */
export function hideBrokenImage(event: SyntheticEvent<HTMLImageElement>) {
  const img = event.currentTarget;
  img.style.visibility = "hidden";
  img.dataset.broken = "true";
}
