import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Link2, History, Download, Shield, CheckCircle2, Clock, AlertTriangle, Loader2, Users, Send, UserPlus, Share2, ExternalLink, GitBranch, Trash2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useFormalizacao, useAcknowledge, useSendForSignature, useDeleteFormalizacao, useUpdateFormalizacao } from '@/hooks/useFormalizacoes';
import { useUserRole } from '@/hooks/useUserRole';
import { useToast } from '@/hooks/use-toast';
import { invokeFunction } from '@/infra/edgeFunctions';
import bwildLogo from '@/assets/bwild-logo-dark.png';
import ReactMarkdown from 'react-markdown';
import DOMPurify from 'dompurify';
import { RichTextEditorModal } from '@/components/report/RichTextEditorModal';
import { useProjectNavigation } from '@/hooks/useProjectNavigation';
import { patchPortalViewState } from '@/lib/portalViewState';
import { useAuth } from '@/hooks/useAuth';
import { 
  FORMALIZATION_TYPE_LABELS, 
  FORMALIZATION_STATUS_LABELS,
  FORMALIZATION_EVENT_TYPE_LABELS,
  type FormalizationType,
  type FormalizationStatus,
  type FormalizationEventType 
} from '@/types/formalization';
import { FormalizacaoEvidence } from '@/components/formalizacao/FormalizacaoEvidence';
import { DigitalSignatureLog } from '@/components/formalizacao/DigitalSignatureLog';
import { VersionHistory } from '@/components/formalizacao/VersionHistory';
const getStatusBadgeVariant = (status: FormalizationStatus): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case 'signed':
      return 'default';
    case 'pending_signatures':
      return 'secondary';
    case 'voided':
      return 'destructive';
    default:
      return 'outline';
  }
};

const formatDate = (dateString: string | null) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatShortHash = (hash: string | null) => {
  if (!hash) return '';
  return hash.substring(0, 8) + '...' + hash.substring(hash.length - 8);
};

// Check if this is seed/demo data (not actual database data)
// Seed data has null customer_org_id and specific ID patterns
const isSeedData = (formalization: any) => {
  if (!formalization) return false;
  // Seed data has null customer_org_id
  if (formalization.customer_org_id === null) return true;
  // Also check for non-hex characters in ID (like 'g' at start)
  const id = formalization.id;
  if (id && /[g-z]/i.test(id.substring(0, 8))) return true;
  return false;
};

export default function FormalizacaoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { paths, projectId } = useProjectNavigation();

  const goBackToList = useCallback(() => {
    if (projectId) {
      patchPortalViewState(`portal_${projectId}`, { activeTab: 'formalizacoes' });
      navigate(`/obra/${projectId}`);
    } else {
      navigate(paths?.formalizacoes || '/formalizacoes');
    }
  }, [projectId, navigate, paths]);
  const { toast } = useToast();
  const { user } = useAuth();
  const { isAdmin, isStaff } = useUserRole();
  const [activeTab, setActiveTab] = useState('conteudo');
  const [acknowledged, setAcknowledged] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [sendingForSignature, setSendingForSignature] = useState(false);
  const [editingContent, setEditingContent] = useState(false);

  const { data: formalizacao, isLoading, refetch } = useFormalizacao(id);
  const acknowledge = useAcknowledge();
  const sendForSignature = useSendForSignature();
  const deleteFormalizacao = useDeleteFormalizacao();
  const updateFormalizacao = useUpdateFormalizacao();

  const isDemo = isSeedData(formalizacao);

  const parties = (formalizacao?.parties as any[] | null) || [];
  const acknowledgements = (formalizacao?.acknowledgements as any[] | null) || [];
  const events = (formalizacao?.events as any[] | null) || [];

  const isDraft = formalizacao?.status === 'draft';
  const hasParties = parties.length >= 2;

  const pendingParties = parties.filter(
    (p) => p.must_sign && !acknowledgements.some((a) => a.party_id === p.id)
  );

  // Prefer a direct binding (user_id/email). If none exists, staff can sign for pending company parties.
  const pendingPartyByBinding = pendingParties.find((p) => {
    if (!user) return false;

    const userIdMatch = p.user_id && p.user_id === user.id;
    const emailMatch =
      p.email && user.email && p.email.toLowerCase() === user.email.toLowerCase();

    return userIdMatch || emailMatch;
  });

  // Staff can sign company parties even without direct binding
  const pendingCompanyPartyForStaff = isStaff
    ? pendingParties.find((p) => p.party_type === 'company')
    : null;

  const pendingPartyForUser = pendingPartyByBinding || pendingCompanyPartyForStaff;

  const handleSendForSignature = async () => {
    if (!id || !isDraft) return;

    if (isDemo) {
      toast({
        title: 'Dados de demonstração',
        description: 'Esta funcionalidade não está disponível para dados de exemplo.',
      });
      return;
    }

    setSendingForSignature(true);
    try {
      await sendForSignature.mutateAsync(id);
      toast({
        title: 'Enviado para assinatura',
        description: 'A formalização foi travada e enviada para coleta de assinaturas.',
      });
      refetch();
    } catch (error) {
      console.error('Error sending for signature:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível enviar para assinatura. Verifique se há partes cadastradas.',
        variant: 'destructive',
      });
    } finally {
      setSendingForSignature(false);
    }
  };

  const handleAcknowledge = async () => {
    if (!pendingPartyForUser || !id) return;

    if (!user) {
      toast({
        title: 'Faça login',
        description: 'Entre no portal para registrar sua assinatura.',
        variant: 'destructive',
      });
      navigate('/auth');
      return;
    }

    // Assinaturas só são permitidas após o envio (documento travado)
    if (formalizacao?.status !== 'pending_signatures') {
      toast({
        title: 'Assinatura indisponível',
        description: 'Se estiver em rascunho, envie para assinatura antes de registrar ciência.',
        variant: 'destructive',
      });
      return;
    }

    if (isDemo) {
      toast({
        title: 'Dados de demonstração',
        description: 'A assinatura não está disponível para dados de exemplo.',
      });
      return;
    }

    try {
      await acknowledge.mutateAsync({
        formalizationId: id,
        partyId: pendingPartyForUser.id,
        signatureText: 'Li e estou ciente do conteúdo desta formalização.',
      });

      toast({
        title: 'Ciência registrada',
        description: 'Sua ciência foi registrada com sucesso.',
      });
    } catch (error) {
      console.error('Error acknowledging:', error);

      const errorMessage = (error as any)?.message ?? '';
      const isRls =
        typeof errorMessage === 'string' && errorMessage.includes('row-level security');

      toast({
        title: 'Erro',
        description: isRls
          ? 'Você só pode assinar como a parte vinculada ao seu usuário/e-mail.'
          : 'Não foi possível registrar sua ciência. Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  const handleDownloadPdf = async () => {
    if (!id) return;

    if (isDemo) {
      toast({
        title: 'Dados de demonstração',
        description: 'O download de PDF não está disponível para dados de exemplo.',
      });
      return;
    }

    setDownloadingPdf(true);
    try {
      const { data, error } = await invokeFunction('formalization-pdf', { formalization_id: id });

      if (error) throw error;

      // Create blob and download
      const blob = new Blob([data as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `formalizacao-${id.substring(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'PDF gerado',
        description: 'O download do PDF foi iniciado.',
      });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível gerar o PDF. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-primary/20" />
            <div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground">Carregando formalização...</p>
        </div>
      </div>
    );
  }

  if (!formalizacao) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-sm mx-4">
          <CardContent className="p-8 text-center">
            <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <FileText className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h2 className="font-semibold text-lg mb-2">Não encontrada</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Esta formalização não existe ou você não tem acesso.
            </p>
            <Button onClick={goBackToList} className="w-full">
              Voltar para lista
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 sm:pb-6">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b">
        <div className="mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={goBackToList}
                aria-label="Voltar para lista"
                className="rounded-full min-h-[44px] min-w-[44px] h-11 w-11 shrink-0 hover:bg-primary/10"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <img src={bwildLogo} alt="Bwild" className="h-8 w-auto shrink-0" />
              <span className="text-muted-foreground/30 hidden sm:inline">|</span>
              <span className="text-sm font-medium truncate hidden sm:inline">
                {formalizacao.title}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                aria-label="Baixar PDF"
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
                className="min-h-[44px] h-11"
              >
                {downloadingPdf ? (
                  <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 sm:mr-2" />
                )}
                <span className="hidden sm:inline">
                  {downloadingPdf ? 'Gerando...' : 'PDF'}
                </span>
              </Button>
              
              {isAdmin && formalizacao.status !== 'signed' && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="min-h-[44px] h-11 w-11 text-destructive hover:text-destructive hover:bg-destructive/10"
                      disabled={deleteFormalizacao.isPending}
                    >
                      {deleteFormalizacao.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir formalização</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja excluir esta formalização? Esta ação é irreversível e removerá permanentemente o documento e todo o histórico associado.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={async () => {
                          if (!id) return;
                          try {
                            await deleteFormalizacao.mutateAsync(id);
                            toast({
                              title: 'Formalização excluída',
                              description: 'O documento foi removido permanentemente.',
                            });
                            navigate('/formalizacoes');
                          } catch (error) {
                            console.error('Error deleting formalization:', error);
                            toast({
                              title: 'Erro ao excluir',
                              description: 'Não foi possível excluir a formalização. Tente novamente.',
                              variant: 'destructive',
                            });
                          }
                        }}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Excluir permanentemente
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto px-4 py-6 max-w-4xl space-y-6">
        {/* Document header */}
        <Card>
          <CardContent className="p-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant={getStatusBadgeVariant(formalizacao.status as FormalizationStatus)}>
                  {FORMALIZATION_STATUS_LABELS[formalizacao.status as FormalizationStatus]}
                </Badge>
                <Badge variant="outline">
                  {FORMALIZATION_TYPE_LABELS[formalizacao.type as FormalizationType]}
                </Badge>
              </div>
              <h1 className="text-xl font-semibold">{formalizacao.title}</h1>
            </div>
          </CardContent>
        </Card>

        {/* Draft action block - Send for signature */}
        {isDraft && (
          <Card className="border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/20">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                <div className="flex-1 space-y-4">
                  <div>
                    <h3 className="font-medium text-blue-900 dark:text-blue-100">
                      Rascunho
                    </h3>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      Este documento ainda está em rascunho e pode ser editado. Para coletar assinaturas, envie-o para as partes envolvidas.
                    </p>
                  </div>

                  {!hasParties && (
                    <div className="flex items-center gap-2 p-3 bg-blue-100/50 dark:bg-blue-900/30 rounded-md">
                      <UserPlus className="h-4 w-4 text-blue-600" />
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        Adicione as partes envolvidas antes de enviar para assinatura.
                      </p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button
                      onClick={handleSendForSignature}
                      disabled={!hasParties || sendingForSignature}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {sendingForSignature ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      {sendingForSignature ? 'Enviando...' : 'Enviar para assinatura'}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 min-h-[44px] h-11">
            <TabsTrigger value="conteudo" className="gap-1.5 text-sm">
              <FileText className="h-4 w-4" />
              <span className="hidden xs:inline">Conteúdo</span>
            </TabsTrigger>
            <TabsTrigger value="evidencias" className="gap-1.5 text-sm">
              <Link2 className="h-4 w-4" />
              <span className="hidden xs:inline">Evidências</span>
            </TabsTrigger>
            <TabsTrigger value="auditoria" className="gap-1.5 text-sm">
              <History className="h-4 w-4" />
              <span className="hidden xs:inline">Auditoria</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="conteudo" className="mt-4 space-y-4">
            {/* Content */}
            <Card>
              <CardContent className="p-6">
                {isAdmin && acknowledgements.length === 0 && (
                  <div className="flex justify-end mb-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingContent(true)}
                      className="gap-1.5"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Editar conteúdo
                    </Button>
                  </div>
                )}
                {(() => {
                  const content = formalizacao.body_md || '';
                  const isHtml = /<[a-z][\s\S]*>/i.test(content);
                  if (isHtml) {
                    return (
                      <div
                        className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-foreground prose-headings:font-bold prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-p:text-muted-foreground prose-p:leading-relaxed prose-strong:text-foreground prose-li:text-muted-foreground prose-hr:border-border prose-hr:my-6 [&>*+*]:mt-4 [&>h1]:mt-0 [&>h2]:mt-6 [&>h3]:mt-5 [&>p]:mt-2 text-justify"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }}
                      />
                    );
                  }
                  return (
                    <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-foreground prose-headings:font-bold prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-p:text-muted-foreground prose-p:leading-relaxed prose-strong:text-foreground prose-li:text-muted-foreground prose-hr:border-border prose-hr:my-6 [&>*+*]:mt-4 [&>h1]:mt-0 [&>h2]:mt-6 [&>h3]:mt-5 [&>p]:mt-2 text-justify">
                      <ReactMarkdown>{content}</ReactMarkdown>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Rich Text Editor Modal */}
            <RichTextEditorModal
              open={editingContent}
              onOpenChange={setEditingContent}
              value={formalizacao.body_md || ''}
              title="Editar conteúdo da formalização"
              onSave={async (html) => {
                if (!id) return;
                try {
                  await updateFormalizacao.mutateAsync({
                    id,
                    data: { body_md: html },
                  });
                  toast({
                    title: 'Conteúdo atualizado',
                    description: 'O conteúdo da formalização foi salvo com sucesso.',
                  });
                  refetch();
                } catch (error) {
                  console.error('Error updating content:', error);
                  toast({
                    title: 'Erro',
                    description: 'Não foi possível salvar o conteúdo.',
                    variant: 'destructive',
                  });
                }
              }}
            />

            {/* Signature block for pending signatures - after content, before parties */}
            {formalizacao.status === 'pending_signatures' && pendingPartyForUser && (
              <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                    <div className="flex-1 space-y-4">
                      <div>
                        <h3 className="font-medium text-amber-900 dark:text-amber-100">
                          Sua ciência é necessária
                        </h3>
                        <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                          Leia o conteúdo da formalização e confirme sua ciência abaixo.
                        </p>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <Checkbox 
                          id="acknowledge" 
                          checked={acknowledged}
                          onCheckedChange={(checked) => setAcknowledged(checked === true)}
                          aria-describedby="acknowledge-description"
                        />
                        <Label 
                          htmlFor="acknowledge" 
                          id="acknowledge-description"
                          className="text-sm leading-relaxed cursor-pointer"
                        >
                          Li e estou ciente do conteúdo desta formalização, concordando com os termos e condições apresentados.
                        </Label>
                      </div>

                      <Button 
                        onClick={handleAcknowledge}
                        disabled={!acknowledged || acknowledge.isPending}
                        aria-label="Confirmar ciência"
                      >
                        {acknowledge.isPending ? 'Registrando...' : 'Li e estou ciente'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Parties involved */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Partes Envolvidas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {parties.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-4 text-center">
                    <p>Nenhuma parte cadastrada.</p>
                    <p className="text-xs mt-1">As partes serão adicionadas quando a formalização for enviada para assinatura.</p>
                  </div>
                ) : (
                  parties.map((party: any) => {
                    const ack = acknowledgements.find((a: any) => a.party_id === party.id);
                    const isSigned = !!ack;
                    return (
                      <div 
                        key={party.id} 
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          isSigned 
                            ? 'bg-success/10 border-success/30' 
                            : 'bg-muted/50 border-border'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {isSigned ? (
                            <div className="h-8 w-8 rounded-full bg-success/10 flex items-center justify-center">
                              <CheckCircle2 className="h-4 w-4 text-[hsl(var(--success))]" />
                            </div>
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-sm">{party.display_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {party.role_label || (party.party_type === 'customer' ? 'Cliente' : 'Empresa')}
                              {party.email && ` · ${party.email}`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          {isSigned ? (
                            <div>
                              <Badge variant="outline" className="bg-success/10 text-[hsl(var(--success))] border-success/30">
                                Assinado
                              </Badge>
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatDate(ack.acknowledged_at)}
                              </p>
                            </div>
                          ) : (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800">
                              Pendente
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                
                {/* Signature progress */}
                {parties.length > 0 && (
                  <div className="pt-3 border-t mt-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progresso de assinaturas</span>
                      <span className="font-medium">
                        {formalizacao.parties_signed ?? 0}/{formalizacao.parties_total ?? parties.length}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full mt-2 overflow-hidden">
                      <div 
                        className="h-full bg-[hsl(var(--success))] rounded-full transition-all duration-300"
                        style={{ 
                          width: `${((formalizacao.parties_signed ?? 0) / ((formalizacao.parties_total ?? parties.length) || 1)) * 100}%` 
                        }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="evidencias" className="mt-4">
            <FormalizacaoEvidence 
              formalizationId={id!}
              attachments={(formalizacao.attachments as any[]) || []}
              evidenceLinks={(formalizacao.evidence_links as any[]) || []}
              isLocked={!!formalizacao.locked_at}
            />
          </TabsContent>

          <TabsContent value="auditoria" className="mt-4 space-y-4">
            {/* Version History */}
            <VersionHistory
              formalizationId={id!}
              currentTitle={formalizacao.title}
              currentSummary={formalizacao.summary}
              currentBodyMd={formalizacao.body_md || ''}
            />

            {/* Digital Signature Log */}
            <DigitalSignatureLog 
              formalizationId={id!}
              signatures={acknowledgements}
              parties={parties}
              documentHash={formalizacao.locked_hash}
              lockedAt={formalizacao.locked_at}
            />

            {/* Event History */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Histórico de Eventos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {events.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhum evento registrado.</p>
                ) : (
                  <div className="space-y-4">
                    {events
                      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                      .map((event: any) => (
                        <div key={event.id} className="flex items-start gap-3 pb-4 border-b last:border-0">
                          <div className="w-2 h-2 mt-2 rounded-full bg-primary" />
                          <div className="flex-1">
                            <p className="font-medium text-sm">
                              {FORMALIZATION_EVENT_TYPE_LABELS[event.event_type as FormalizationEventType]}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDate(event.created_at)}
                            </p>
                            {/* Show signature details in event if available */}
                            {event.event_type === 'signed_by_party' && event.meta && (
                              <div className="mt-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                                {event.meta.email && (
                                  <p>E-mail: {event.meta.email}</p>
                                )}
                                {event.meta.ip_address && (
                                  <p>IP: {event.meta.ip_address}</p>
                                )}
                                {event.meta.signature_hash && (
                                  <p className="font-mono text-[10px] mt-1 break-all">
                                    Hash: {event.meta.signature_hash}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    }
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Mobile floating action bar for pending signatures */}
      {formalizacao.status === 'pending_signatures' && pendingPartyForUser && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t shadow-lg sm:hidden animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Ciência pendente</p>
              <p className="text-xs text-muted-foreground truncate">Leia e confirme sua ciência</p>
            </div>
            <Button 
              onClick={() => {
                setAcknowledged(true);
                handleAcknowledge();
              }}
              disabled={acknowledge.isPending}
              size="sm"
              className="shrink-0"
            >
              {acknowledge.isPending ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
              )}
              Dar ciência
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
