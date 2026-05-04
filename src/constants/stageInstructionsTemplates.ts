/**
 * Default rich-text templates for stage instructions in the Journey.
 * Keyed by the derived page_key (stage name → lowercase, spaces→underscores, no accents).
 * Used as initial content when no instruction has been saved yet.
 */

import { PROJETO_3D_INSTRUCTIONS_TEMPLATE } from "./projeto3dInstructionsTemplate";

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

const MOBILIZACAO_TEMPLATE = `
<p><strong>Mobilização – O que acontece nesta etapa</strong></p>
<br/>
<p>Obra aprovado pelo condomínio! Agora entramos na <strong>mobilização da equipe técnica</strong>.</p>
<br/>
<p><strong>O que acontece aqui:</strong></p>
<br/>
<p style="padding-left: 20px;">📋 Em até <strong>2 dias úteis</strong>, você terá acesso ao cronograma de obra em um novo ambiente de acompanhamento das próximas etapas.</p>
<br/>
<p style="padding-left: 20px;">🛠️ Em até <strong>5 dias úteis</strong>, mobilizamos o time e preparamos tudo para o início (equipe, acessos, logística e alinhamentos).</p>
<br/>
<p>O <strong>Engenheiro responsável</strong> pela gestão da sua reforma entrará em contato para alguns alinhamentos iniciais e solicitar a liberação de nossos prestadores em sua unidade.</p>
<br/>
<p>⚠️ <strong>Atenção:</strong> quando chegar a data de início, passa a contar oficialmente 1º dia útil do cronograma, e o prazo total de entrega seguirá o que foi definido em contrato.</p>
`.trim();

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
  mobilizacao: MOBILIZACAO_TEMPLATE,
};
