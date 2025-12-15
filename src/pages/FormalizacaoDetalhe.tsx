import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Link2, History, Download, Shield, CheckCircle2, Clock, AlertTriangle, Loader2, Users, Send, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useFormalizacao, useAcknowledge, useSendForSignature } from '@/hooks/useFormalizacoes';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import bwildLogo from '@/assets/bwild-logo.png';
import ReactMarkdown from 'react-markdown';
import { 
  FORMALIZATION_TYPE_LABELS, 
  FORMALIZATION_STATUS_LABELS,
  FORMALIZATION_EVENT_TYPE_LABELS,
  type FormalizationType,
  type FormalizationStatus,
  type FormalizationEventType 
} from '@/types/formalization';
import { FormalizacaoEvidence } from '@/components/formalizacao/FormalizacaoEvidence';
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

export default function FormalizacaoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('conteudo');
  const [acknowledged, setAcknowledged] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [sendingForSignature, setSendingForSignature] = useState(false);

  const { data: formalizacao, isLoading, refetch } = useFormalizacao(id);
  const acknowledge = useAcknowledge();
  const sendForSignature = useSendForSignature();

  const parties = (formalizacao?.parties as any[] | null) || [];
  const acknowledgements = (formalizacao?.acknowledgements as any[] | null) || [];
  const events = (formalizacao?.events as any[] | null) || [];

  const isDraft = formalizacao?.status === 'draft';
  const hasParties = parties.length >= 2;

  // Find current user's party (customer) that hasn't signed yet
  const pendingCustomerParty = parties.find(p => 
    p.party_type === 'customer' && 
    p.must_sign &&
    !acknowledgements.some(a => a.party_id === p.id)
  );

  const handleSendForSignature = async () => {
    if (!id || !isDraft) return;

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
    if (!pendingCustomerParty || !id) return;

    try {
      await acknowledge.mutateAsync({
        formalizationId: id,
        partyId: pendingCustomerParty.id,
        signatureText: 'Li e estou ciente do conteúdo desta formalização.',
      });

      toast({
        title: 'Ciência registrada',
        description: 'Sua ciência foi registrada com sucesso.',
      });
    } catch (error) {
      console.error('Error acknowledging:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível registrar sua ciência. Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  const handleDownloadPdf = async () => {
    if (!id) return;

    setDownloadingPdf(true);
    try {
      const { data, error } = await supabase.functions.invoke('formalization-pdf', {
        body: { formalization_id: id },
      });

      if (error) throw error;

      // Create blob and download
      const blob = new Blob([data], { type: 'application/pdf' });
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
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!formalizacao) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Formalização não encontrada</p>
          <Button onClick={() => navigate('/formalizacoes')}>Voltar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigate('/formalizacoes')}
                aria-label="Voltar para lista"
                className="rounded-full"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <img src={bwildLogo} alt="Bwild" className="h-8" />
            </div>
            <Button 
              variant="outline" 
              aria-label="Baixar PDF"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
            >
              {downloadingPdf ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              {downloadingPdf ? 'Gerando...' : 'Baixar PDF'}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
        {/* Document header */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
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
                <p className="text-muted-foreground">{formalizacao.summary}</p>
              </div>
              
              {formalizacao.locked_hash && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
                  <Shield className="h-4 w-4" />
                  <div>
                    <p className="font-mono text-xs">{formatShortHash(formalizacao.locked_hash)}</p>
                    <p className="text-xs">Travado em {formatDate(formalizacao.locked_at)}</p>
                  </div>
                </div>
              )}
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

        {/* Signature block for pending signatures */}
        {formalizacao.status === 'pending_signatures' && pendingCustomerParty && (
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

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="conteudo">
              <FileText className="h-4 w-4 mr-2" />
              Conteúdo
            </TabsTrigger>
            <TabsTrigger value="evidencias">
              <Link2 className="h-4 w-4 mr-2" />
              Evidências
            </TabsTrigger>
            <TabsTrigger value="auditoria">
              <History className="h-4 w-4 mr-2" />
              Auditoria
            </TabsTrigger>
          </TabsList>

          <TabsContent value="conteudo" className="mt-4 space-y-4">
            {/* Content */}
            <Card>
              <CardContent className="p-6">
                <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-li:text-muted-foreground">
                  <ReactMarkdown>{formalizacao.body_md || ''}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>

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
                            ? 'bg-green-50/50 border-green-200 dark:bg-green-950/20 dark:border-green-900/50' 
                            : 'bg-muted/50 border-border'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {isSigned ? (
                            <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
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
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
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
                        className="h-full bg-green-500 rounded-full transition-all duration-300"
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

          <TabsContent value="auditoria" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Histórico de Eventos</CardTitle>
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
                          <div>
                            <p className="font-medium text-sm">
                              {FORMALIZATION_EVENT_TYPE_LABELS[event.event_type as FormalizationEventType]}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDate(event.created_at)}
                            </p>
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
    </div>
  );
}
