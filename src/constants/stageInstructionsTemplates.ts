/**
 * Default rich-text templates for stage instructions in the Journey.
 * Keyed by the derived page_key (stage name → lowercase, spaces→underscores, no accents).
 * Used as initial content when no instruction has been saved yet.
 */

import { PROJETO_3D_INSTRUCTIONS_TEMPLATE } from './projeto3dInstructionsTemplate';

const MEDICAO_TECNICA_TEMPLATE = `
<p><strong>Medição Técnica – O que acontece nesta etapa</strong></p>
<br/>
<p>Nesta fase, nossa equipe de engenharia realizará uma <strong>medição detalhada do ambiente</strong>, garantindo que todas as dimensões estejam corretas para a execução do projeto.</p>
<br/>
<p>Unimos:</p>
<p style="padding-left: 20px;">Medições físicas no local</p>
<p style="padding-left: 20px;">Conferência de níveis, prumos e esquadros</p>
<p style="padding-left: 20px;">Verificação de pontos elétricos, hidráulicos e estruturais</p>
<p style="padding-left: 20px;">Compatibilização com o Projeto 3D aprovado</p>
<br/>
<p>O objetivo é assegurar que o <strong>Projeto Executivo seja desenvolvido com máxima precisão</strong>, evitando retrabalhos e imprevistos na obra.</p>
<br/>
<p>🔑 O que é necessário para realizar a medição</p>
<br/>
<p>Para que a medição aconteça, é importante que:</p>
<p style="padding-left: 20px;">✅ O imóvel esteja com <strong>acesso liberado (chaves disponíveis)</strong></p>
<p style="padding-left: 20px;">✅ A unidade esteja <strong>sem restrições de entrada</strong></p>
<p style="padding-left: 20px;">✅ A ligação de energia esteja ativa, se necessário</p>
<p style="padding-left: 20px;">✅ Caso seja apartamento, que a construtora/liberação esteja formalizada</p>
<br/>
<p>⚠️ Importante: A medição só pode ser realizada após a entrega das chaves pela construtora.</p>
<br/>
<p>Após a medição:</p>
<p style="padding-left: 20px;">Consolidamos as informações técnicas</p>
<p style="padding-left: 20px;">Ajustamos eventuais divergências dimensionais</p>
<p style="padding-left: 20px;">Iniciamos o desenvolvimento do <strong>Projeto Executivo</strong></p>
<br/>
<p>Você será notificado quando esta etapa for concluída.</p>
`.trim();

/**
 * Build the "Liberação da Obra" template dynamically,
 * injecting the previous stage's confirmed_end date.
 */
export function buildLiberacaoTemplate(previousStageConfirmedEnd: string | null): string {
  const dateStr = previousStageConfirmedEnd
    ? new Date(previousStageConfirmedEnd).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '[data a definir]';

  return `
<p><strong>Liberação da Obra – O que acontece nesta etapa</strong></p>
<br/>
<p>Estamos quase lá! Agora que seu projeto executivo foi aprovado, no dia <strong>${dateStr}</strong>, realizaremos os trâmites para liberação da sua obra.</p>
<br/>
<p><strong>Etapas:</strong></p>
<br/>
<p><strong>1) Emissão da ART:</strong></p>
<p style="padding-left: 20px;">Seu Projeto Executivo será submetido ao CREA para recebermos o documento oficial que atesta nossa capacidade técnica de execução da obra.</p>
<p style="padding-left: 20px;">📅 <strong>Prazo para emissão:</strong> 2 dias úteis após aprovação do executivo</p>
<br/>
<p><strong>2) Aprovação do Condomínio:</strong></p>
<p style="padding-left: 20px;">Enviaremos a ART e o Projeto Executivo para seu condomínio emitir o atestado que nos permite executar e iniciar sua reforma.</p>
<p style="padding-left: 20px;">📅 <strong>Prazo para submissão da documentação:</strong> 1 dia útil após recebimento da ART</p>
<br/>
<p>⚠️ <strong>Atenção:</strong> Cada condomínio possui um prazo específico de análise e aprovação da documentação, etapa que não podemos controlar. Contudo, acompanharemos o processo de perto e cobraremos o retorno com agilidade.</p>
<br/>
<p>Assim que recebermos o comunicado de liberação da sua obra, no dia seguinte se inicia o período de <strong>5 dias úteis de mobilização da equipe técnica</strong>, que antecede a data oficial de início do cronograma da obra.</p>
`.trim();
}

const PROJETO_EXECUTIVO_TEMPLATE = `
<p><strong>Projeto Executivo – O que acontece nesta etapa</strong></p>
<br/>
<p>Nesta fase, nossa equipe de engenharia desenvolve o <strong>Projeto Executivo completo</strong>, que é o conjunto de documentos técnicos necessários para a execução da sua obra com precisão e segurança.</p>
<br/>
<p><strong>O que está incluso:</strong></p>
<p style="padding-left: 20px;">📐 Plantas detalhadas com dimensões exatas</p>
<p style="padding-left: 20px;">⚡ Projeto elétrico e hidráulico</p>
<p style="padding-left: 20px;">🧱 Especificações de materiais e acabamentos</p>
<p style="padding-left: 20px;">📋 Detalhamento de marcenaria e mobiliário sob medida</p>
<br/>
<p><strong>Como acompanhar e revisar:</strong></p>
<p style="padding-left: 20px;">1. Clique em <strong>"Visualizar"</strong> para acessar os PDFs do projeto</p>
<p style="padding-left: 20px;">2. Navegue pelas páginas e adicione <strong>comentários</strong> nos pontos que desejar ajustar</p>
<p style="padding-left: 20px;">3. Nossa equipe analisará seu feedback e enviará uma versão revisada</p>
<br/>
<p>⚠️ <strong>Importante:</strong> A aprovação do Projeto Executivo é necessária para prosseguirmos com a emissão da ART e a liberação da obra.</p>
`.trim();

/** Map of page_key → default HTML template (static templates only) */
export const STAGE_INSTRUCTIONS_DEFAULTS: Record<string, string> = {
  projeto_3d: PROJETO_3D_INSTRUCTIONS_TEMPLATE,
  medicao_tecnica: MEDICAO_TECNICA_TEMPLATE,
  projeto_executivo: PROJETO_EXECUTIVO_TEMPLATE,
};
