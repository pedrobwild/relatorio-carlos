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

/** Map of page_key → default HTML template */
export const STAGE_INSTRUCTIONS_DEFAULTS: Record<string, string> = {
  projeto_3d: PROJETO_3D_INSTRUCTIONS_TEMPLATE,
  medicao_tecnica: MEDICAO_TECNICA_TEMPLATE,
};
