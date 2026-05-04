import { useState, useRef, useCallback } from'react';
import { useNavigate } from'react-router-dom';
import { ArrowLeft, Sparkles, Loader2, Copy, Check, RefreshCw } from'lucide-react';
import { Button } from'@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from'@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from'@/components/ui/select';
import { Textarea } from'@/components/ui/textarea';
import { Badge } from'@/components/ui/badge';
import { toast } from'sonner';
import ReactMarkdown from'react-markdown';
import bwildLogo from'@/assets/bwild-logo-dark.png';
import { getAccessToken } from'@/infra/edgeFunctions';

const AREAS = [
 {
 value:'jornada',
 label:'Jornada do Projeto',
 description:'Timeline, etapas, checklist do cliente',
 systemContext:`Funcionalidades EXISTENTES na Jornada do Projeto (/obra/:id/jornada):
- Timeline vertical com etapas ordenáveis (journey_stages): status (pending/in_progress/completed/blocked/waiting_client), datas propostas e confirmadas, ícone, descrição, microcopy, warning_text, revision_text
- Cada etapa tem: checklist de to-dos (journey_todos) com owner"cliente" ou"equipe", fotos (journey_stage_photos), mensagens/chat (journey_stage_messages), registros (journey_stage_records com categorias)
- CTA configurável por etapa (cta_text, cta_url, cta_visible)
- Dependências textuais entre etapas (dependencies_text)
- Campo"waiting_since" para medir tempo de espera do cliente
- Hero banner configurável (journey_hero: título, subtítulo, badge)
- CSM (Customer Success Manager) card com foto, contato, descrição (journey_csm)
- Footer personalizável (journey_footer)
- Equipe do projeto (journey_team_members) com foto, cargo, contexto de etapa
- Sistema de agendamento de reuniões (journey_meeting_availability + journey_meeting_slots) vinculado a etapas
- Log de alterações de datas (journey_stage_date_log)
- Perfis: cliente vê timeline simplificada; staff pode editar etapas, datas, status, to-dos`
 },
 {
 value:'financeiro',
 label:'Financeiro',
 description:'Pagamentos, boletos, parcelas',
 systemContext:`Funcionalidades EXISTENTES no Financeiro (/obra/:id/financeiro):
- Tabela de parcelas/pagamentos vinculada ao projeto
- Status de pagamento (pendente, pago, vencido)
- Valores e datas de vencimento
- Pendências financeiras aparecem como pending_items com type"payment" ou"approval"
- Notificações automáticas: payment_due e payment_overdue
- Cliente vê seus boletos e status; staff gerencia parcelas
- Integração com o sistema de pendências para cobranças automáticas`
 },
 {
 value:'pendencias',
 label:'Pendências',
 description:'Decisões, aprovações, prazos do cliente',
 systemContext:`Funcionalidades EXISTENTES nas Pendências (/obra/:id/pendencias):
- Tabela pending_items com tipos: decision, approval, payment, document, information, signature
- Status: open, in_progress, resolved, cancelled
- Campos: título, descrição, due_date, impacto, opções (JSON), action_url
- Resolução: resolved_by, resolved_at, resolution_notes, resolution_payload
- Vinculado a customer_org_id e project_id
- Reference tracking (reference_type + reference_id) para vincular a outras entidades
- Notificação automática: pending_item_created
- Cliente vê suas pendências abertas; staff cria e gerencia`
 },
 {
 value:'formalizacoes',
 label:'Formalizações',
 description:'Contratos, aditivos, assinaturas digitais',
 systemContext:`Funcionalidades EXISTENTES nas Formalizações (/obra/:id/formalizacoes):
- Tipos: contract, amendment, budget, specification, minutes, other
- Status: draft, pending_signatures, active, superseded, cancelled
- Corpo em Markdown (body_md) com dados estruturados (JSON data)
- Versionamento completo (formalization_versions): número da versão, snapshot do conteúdo
- Partes envolvidas (formalization_parties): tipo (company/customer/witness), must_sign, role_label
- Assinaturas/acknowledgements: hash de assinatura, texto, IP, user_agent, data
- Anexos (formalization_attachments): upload de PDFs e documentos
- Links de evidência (formalization_evidence_links): tipos photo, video, document, link
- Eventos/auditoria (formalization_events): created, sent, viewed, signed, etc.
- Hash chain para integridade (locked_hash, prev_hash)
- Verificação pública de assinatura via /verificar/:hash
- Staff cria e gerencia; cliente visualiza, assina e baixa
- Criação via formulário em /obra/:id/formalizacoes/nova
- Detalhe individual em /obra/:id/formalizacoes/:id`
 },
 {
 value:'documentos',
 label:'Documentos',
 description:'Projeto 3D, Executivo, uploads, versões',
 systemContext:`Funcionalidades EXISTENTES nos Documentos:
1. Projeto 3D (/obra/:id/projeto-3d):
 - Versionamento (project_3d_versions): version_number, stage_key, created_by
 - Imagens por versão (project_3d_images): storage_path, sort_order
 - Comentários posicionais (project_3d_comments): x_percent, y_percent para marcações na imagem
 - Solicitação de revisão (revision_requested_at/by)
 
2. Executivo (/obra/:id/executivo):
 - Visualização de projetos executivos

3. Documentos genéricos (/obra/:id/documentos):
 - Sistema de arquivos (files table): bucket, storage_path, mime_type, size_bytes
 - Categorias, tags (JSON), descrição
 - Visibilidade: public, private, org_only
 - Status: active, archived, deleted (soft delete)
 - Metadados: checksum, retention_days, expires_at
 - Vinculação a entidades (entity_type + entity_id)
 
4. Gestão de Arquivos (/gestao/arquivos):
 - Listagem e organização de arquivos do projeto para staff`
 },
 {
 value:'cronograma',
 label:'Cronograma',
 description:'Gantt, atividades, marcos, progresso',
 systemContext:`Funcionalidades EXISTENTES no Cronograma (/obra/:id/cronograma - SOMENTE STAFF):
- Cronogramas (cronogramas table): data_inicio, data_fim_prevista, observações
- Atividades (atividades table): título, descrição, etapa, status (pendente/em_andamento/concluida/cancelada/bloqueada)
- Datas previstas e reais (início e fim) para cada atividade
- Prioridade: baixa, media, alta, critica
- Responsável vinculado a user (responsavel_user_id)
- Dependências entre atividades (array de IDs)
- Marcos (marcos table): nome, data_prevista, data_real, status (pendente/atingido/atrasado)
- Geração automática de cronograma via IA a partir de orçamentos (PDF/Excel/CSV)
- Calendário de compras (/gestao/calendario-compras) para gestão de suprimentos
- Compras (/obra/:id/compras) para itens de compra do projeto`
 },
 {
 value:'relatorio',
 label:'Relatório Semanal',
 description:'KPIs, fotos, resumo executivo',
 systemContext:`Funcionalidades EXISTENTES no Relatório Semanal (/obra/:id/relatorio):
- Relatório semanal com dados estruturados (WeeklyReportData)
- Resumo executivo (executiveSummary) em HTML
- Galeria de fotos da semana
- KPIs: progresso geral, atividades concluídas, pendências abertas
- Tarefas da próxima semana (lookaheadTasks)
- Riscos e problemas (risksAndIssues)
- Decisões pendentes do cliente (clientDecisions)
- Geração automática via IA (AIReportGenerator): analisa atividades, etapas, chats e pendências
- Staff edita e publica; cliente visualiza relatório publicado
- Notificação: report_published`
 },
 {
 value:'gestao',
 label:'Gestão de Obras',
 description:'Dashboard, listagem, criação de obras',
 systemContext:`Funcionalidades EXISTENTES na Gestão de Obras (SOMENTE STAFF):
- Listagem de obras (/gestao): cards e tabela com toggle de visualização. Em mobile, exibe automaticamente cards empilhados
- Cards e tabela exibem: nome, unidade, cliente, m² e tipo de locação (dados secundários em cinza), badge de status, barra de progresso, health score, indicadores de pendências/formalizações/documentos
- Filtros por status (ativa/pausada/concluída/cancelada) e busca por nome
- Health Score automático (0-100) com 4 dimensões: Cronograma (40%), Pendências (25%), Formalizações (20%), Documentos (15%)
- Criação de nova obra (/gestao/nova-obra): stepper 4 etapas com microcopy educativo (ex:"Valores que comporão o gráfico de saúde financeira") e StickySummary lateral
- Campo"Tipo de Locação" como Select padronizado e ViaCEP para autopreenchimento
- Edição de obra (/gestao/obra/:id): feedback de permissões com tooltips ("Sua permissão é apenas de visualização"), botões disabled para viewers, exclusão restrita a admin
- Dashboard com sumário (project_dashboard_summary view): pending_count, overdue_count, unsigned_formalizations, pending_documents, progress_percentage
- Sistema de convites com tooltips descritivos por role (owner/viewer/editor/admin)
- Clientes veem /minhas-obras com status traduzido (Em andamento, Concluído, Pausado) e empty state educativo
- Templates de projeto com versionamento e campos customizáveis
- Feature flags para controle de funcionalidades`
 },
 {
 value:'navegacao',
 label:'Navegação Geral',
 description:'Header, menus, rotas, mobile',
 systemContext:`Funcionalidades EXISTENTES na Navegação:
- AppHeader com logo, NotificationBell, perfil e logout (botão admin removido do header, movido para dropdown do UserMenu)
- UserMenu dropdown com: email, badge de role, link"Minhas Obras","Configurações" (admin only), logout
- ProjectSlimHeader com breadcrumb, badge colorido de status da obra (Em andamento/Pausada/Concluída/Cancelada) e seletor de projeto agrupado por status com busca
- Seletor preserva sub-rota ao trocar de obra e exibe badges de pendências por projeto
- Navegação por abas dentro do projeto: Jornada, Contrato, Projeto 3D, Executivo, Financeiro, Pendências, Documentos, Formalizações, Cronograma, Compras
- Rotas protegidas: ProtectedRoute (com skeleton loading), StaffRoute, AdminRoute, CustomerRoute
- Roles via user_roles: admin, manager, engineer, gestor, suprimentos, financeiro, customer
- Centro de notificações com filtros"Precisa de Atenção" /"Apenas Informativo", badge pulsante APENAS para ações bloqueantes (payment_overdue, formalization_pending)
- Notificações com boost contextual baseado na rota atual (ex: financeiro → payment_due)
- Redirecionamento automático baseado em role (/ → /gestao para staff, /minhas-obras para cliente)
- Admin panel (/admin): configurações, auditoria, health check, UX insights
- Bottom navigation mobile para clientes (MobileBottomNav): Jornada, Financeiro, Pendências, Avisos
- Busca global (GlobalSearchDialog) no ProjectSlimHeader`
 },
 {
 value:'onboarding',
 label:'Onboarding do Cliente',
 description:'Primeiro acesso, boas-vindas, orientações',
 systemContext:`Funcionalidades EXISTENTES no Onboarding:
- Convite por email com token (invitations table): role, project_role, metadata
- Página de autenticação (/auth): login e cadastro com email/senha
- Confirmação de email obrigatória (não há auto-confirm)
- Após login, redirecionamento baseado em role
- Journey hero configurável com badge, título e subtítulo de boas-vindas
- CSM card na jornada com foto e contato do responsável
- NÃO existe: tour guiado, wizard de primeiro acesso, FAQ integrado, vídeo de boas-vindas, checklist de onboarding`
 },
];

export default function AdminUxInsights() {
 const navigate = useNavigate();
 const [selectedArea, setSelectedArea] = useState('');
 const [context, setContext] = useState('');
 const [result, setResult] = useState('');
 const [isLoading, setIsLoading] = useState(false);
 const [copied, setCopied] = useState(false);
 const abortRef = useRef<AbortController | null>(null);

 const generate = useCallback(async () => {
 if (!selectedArea) {
 toast.error('Selecione uma área para análise');
 return;
 }

 const areaObj = AREAS.find(a => a.value === selectedArea);

 setIsLoading(true);
 setResult('');

 abortRef.current = new AbortController();

 try {
 const token = await getAccessToken();
 if (!token) throw new Error('Sessão expirada');

 const resp = await fetch(
`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ux-insights`,
 {
 method:'POST',
 headers: {
'Content-Type':'application/json',
 Authorization:`Bearer ${token}`,
 apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
 },
 body: JSON.stringify({
 area: areaObj?.label ?? selectedArea,
 context: context.trim() || undefined,
 systemContext: areaObj?.systemContext || undefined,
 }),
 signal: abortRef.current.signal,
 }
 );

 if (!resp.ok) {
 const err = await resp.json().catch(() => ({ error:'Erro desconhecido' }));
 throw new Error(err.error ||`Erro ${resp.status}`);
 }

 if (!resp.body) throw new Error('Sem resposta de stream');

 const reader = resp.body.getReader();
 const decoder = new TextDecoder();
 let textBuffer ='';
 let accumulated ='';

 while (true) {
 const { done, value } = await reader.read();
 if (done) break;
 textBuffer += decoder.decode(value, { stream: true });

 let newlineIndex: number;
 while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
 let line = textBuffer.slice(0, newlineIndex);
 textBuffer = textBuffer.slice(newlineIndex + 1);
 if (line.endsWith('\r')) line = line.slice(0, -1);
 if (line.startsWith(':') || line.trim() ==='') continue;
 if (!line.startsWith('data:')) continue;
 const jsonStr = line.slice(6).trim();
 if (jsonStr ==='[DONE]') break;

 try {
 const parsed = JSON.parse(jsonStr);
 const content = parsed.choices?.[0]?.delta?.content;
 if (content) {
 accumulated += content;
 setResult(accumulated);
 }
 } catch {
 textBuffer = line +'\n' + textBuffer;
 break;
 }
 }
 }

 // Final flush
 if (textBuffer.trim()) {
 for (let raw of textBuffer.split('\n')) {
 if (!raw) continue;
 if (raw.endsWith('\r')) raw = raw.slice(0, -1);
 if (raw.startsWith(':') || raw.trim() ==='') continue;
 if (!raw.startsWith('data:')) continue;
 const jsonStr = raw.slice(6).trim();
 if (jsonStr ==='[DONE]') continue;
 try {
 const parsed = JSON.parse(jsonStr);
 const content = parsed.choices?.[0]?.delta?.content;
 if (content) {
 accumulated += content;
 setResult(accumulated);
 }
 } catch { /* ignore */ }
 }
 }
 } catch (err: any) {
 if (err.name ==='AbortError') return;
 toast.error(err.message ||'Erro ao gerar sugestões');
 } finally {
 setIsLoading(false);
 }
 }, [selectedArea, context]);

 const handleCopy = useCallback(() => {
 navigator.clipboard.writeText(result);
 setCopied(true);
 toast.success('Copiado para a área de transferência');
 setTimeout(() => setCopied(false), 2000);
 }, [result]);

 const handleCancel = useCallback(() => {
 abortRef.current?.abort();
 setIsLoading(false);
 }, []);

 return (
 <div className="min-h-screen bg-background">
 <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
 <div className="max-w-4xl mx-auto px-4 py-3">
 <div className="flex items-center gap-3">
 <Button
 variant="ghost"
 size="icon"
 onClick={() => navigate('/admin')}
 className="shrink-0"
 aria-label="Voltar"
 >
 <ArrowLeft className="h-5 w-5" />
 </Button>
 <img src={bwildLogo} alt="Bwild" className="h-8" />
 <div>
 <h1 className="text-h3 font-bold flex items-center gap-2">
 <Sparkles className="h-5 w-5 text-primary" />
 UX Insights com IA
 </h1>
 <p className="text-tiny text-muted-foreground">
 Sugestões de melhorias de hierarquia, copywriting e UX
 </p>
 </div>
 </div>
 </div>
 </header>

 <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
 {/* Input Section */}
 <Card>
 <CardHeader>
 <CardTitle className="text-base">Configurar Análise</CardTitle>
 <CardDescription>
 Selecione a área do portal e adicione contexto opcional para sugestões mais direcionadas.
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="space-y-2">
 <label className="text-sm font-medium">Área do Portal</label>
 <Select value={selectedArea} onValueChange={setSelectedArea}>
 <SelectTrigger>
 <SelectValue placeholder="Selecione uma área..." />
 </SelectTrigger>
 <SelectContent>
 {AREAS.map(area => (
 <SelectItem key={area.value} value={area.value}>
 <div className="flex flex-col items-start">
 <span>{area.label}</span>
 <span className="text-xs text-muted-foreground">{area.description}</span>
 </div>
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-2">
 <label className="text-sm font-medium">Contexto adicional (opcional)</label>
 <Textarea
 placeholder="Ex: Os clientes estão tendo dificuldade para encontrar os boletos pendentes..."
 value={context}
 onChange={(e) => setContext(e.target.value)}
 rows={3}
 />
 </div>

 <div className="flex gap-2">
 <Button
 onClick={generate}
 disabled={isLoading || !selectedArea}
 className="gap-2"
 >
 {isLoading ? (
 <>
 <Loader2 className="h-4 w-4 animate-spin" />
 Gerando...
 </>
 ) : (
 <>
 <Sparkles className="h-4 w-4" />
 Gerar Sugestões
 </>
 )}
 </Button>
 {isLoading && (
 <Button variant="outline" onClick={handleCancel}>
 Cancelar
 </Button>
 )}
 </div>
 </CardContent>
 </Card>

 {/* Result Section */}
 {(result || isLoading) && (
 <Card>
 <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
 <div className="flex items-center gap-2">
 <CardTitle className="text-base">Sugestões de UX</CardTitle>
 {isLoading && (
 <Badge variant="secondary" className="gap-1">
 <Loader2 className="h-3 w-3 animate-spin" />
 Gerando
 </Badge>
 )}
 </div>
 {result && !isLoading && (
 <div className="flex gap-2">
 <Button variant="outline" size="sm" onClick={generate} className="gap-1">
 <RefreshCw className="h-3.5 w-3.5" />
 Regenerar
 </Button>
 <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1">
 {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
 {copied ?'Copiado' :'Copiar'}
 </Button>
 </div>
 )}
 </CardHeader>
 <CardContent>
 <div className="prose prose-sm max-w-none">
 <ReactMarkdown>{result ||'...'}</ReactMarkdown>
 </div>
 </CardContent>
 </Card>
 )}
 </main>
 </div>
 );
}
