/**
 * Endereço do Painel de Obras antigo.
 *
 * `/gestao/painel-obras` abre o Painel reformulado; estas suítes cobrem a
 * tabela antiga (data-testid `painel-obras-*`), que continua disponível com
 * `?painel=antigo`. O parâmetro é ignorado por versões publicadas anteriores
 * à reformulação, então o endereço vale antes e depois de publicar.
 */
export const PAINEL_ANTIGO = '/gestao/painel-obras?painel=antigo';
