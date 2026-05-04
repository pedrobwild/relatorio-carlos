import { FileText, Link2, History, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import ReactMarkdown from "react-markdown";
import DOMPurify from "dompurify";
import { RichTextEditorModal } from "@/components/report/RichTextEditorModal";
import { FormalizacaoEvidence } from "@/components/formalizacao/FormalizacaoEvidence";
import { DigitalSignatureLog } from "@/components/formalizacao/DigitalSignatureLog";
import { VersionHistory } from "@/components/formalizacao/VersionHistory";
import {
  FORMALIZATION_TYPE_LABELS,
  FORMALIZATION_STATUS_LABELS,
  type FormalizationType,
  type FormalizationStatus,
} from "@/types/formalization";
import {
  getStatusBadgeVariant,
  type AttachmentRow,
  type EvidenceLinkRow,
} from "./formalizacao-detalhe/types";
import { useFormalizacaoDetalhe } from "./formalizacao-detalhe/useFormalizacaoDetalhe";
import { FormalizacaoHeader } from "./formalizacao-detalhe/FormalizacaoHeader";
import { DraftActionCard } from "./formalizacao-detalhe/DraftActionCard";
import { PartiesCard } from "./formalizacao-detalhe/PartiesCard";
import {
  SignatureBlock,
  MobileSignatureBar,
} from "./formalizacao-detalhe/SignatureBlock";
import { EventHistoryCard } from "./formalizacao-detalhe/EventHistoryCard";

export default function FormalizacaoDetalhe() {
  const state = useFormalizacaoDetalhe();
  const {
    id,
    formalizacao,
    isLoading,
    isAdmin,
    isDraft,
    hasParties,
    parties,
    acknowledgements,
    events,
    activeTab,
    setActiveTab,
    acknowledged,
    setAcknowledged,
    downloadingPdf,
    sendingForSignature,
    editingContent,
    setEditingContent,
    pendingPartyForUser,
    goBackToList,
    handleSendForSignature,
    handleAcknowledge,
    handleDownloadPdf,
    handleDelete,
    handleUpdateContent,
    deleteFormalizacao,
    acknowledge,
  } = state;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-primary/20" />
            <div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground">
            Carregando formalização...
          </p>
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

  const showSignatureBlock =
    formalizacao.status === "pending_signatures" && !!pendingPartyForUser;

  return (
    <div className="min-h-screen bg-background">
      <FormalizacaoHeader
        title={formalizacao.title ?? ""}
        status={formalizacao.status ?? ""}
        isAdmin={isAdmin}
        downloadingPdf={downloadingPdf}
        isDeleting={deleteFormalizacao.isPending}
        onGoBack={goBackToList}
        onDownloadPdf={handleDownloadPdf}
        onDelete={handleDelete}
      />

      <main className="mx-auto px-4 py-6 max-w-4xl space-y-6">
        {/* Document header */}
        <Card>
          <CardContent className="p-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge
                  variant={getStatusBadgeVariant(
                    formalizacao.status as FormalizationStatus,
                  )}
                >
                  {
                    FORMALIZATION_STATUS_LABELS[
                      formalizacao.status as FormalizationStatus
                    ]
                  }
                </Badge>
                <Badge variant="outline">
                  {
                    FORMALIZATION_TYPE_LABELS[
                      formalizacao.type as FormalizationType
                    ]
                  }
                </Badge>
              </div>
              <h1 className="text-xl font-semibold">{formalizacao.title}</h1>
            </div>
          </CardContent>
        </Card>

        {isDraft && (
          <DraftActionCard
            hasParties={hasParties}
            sendingForSignature={sendingForSignature}
            onSendForSignature={handleSendForSignature}
          />
        )}

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
                  const content = formalizacao.body_md || "";
                  const isHtml = /<[a-z][\s\S]*>/i.test(content);
                  const proseClasses =
                    "prose prose-sm max-w-none prose-headings:text-foreground prose-headings:font-bold prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-p:text-muted-foreground prose-p:leading-relaxed prose-strong:text-foreground prose-li:text-muted-foreground prose-hr:border-border prose-hr:my-6 [&>*+*]:mt-4 [&>h1]:mt-0 [&>h2]:mt-6 [&>h3]:mt-5 [&>p]:mt-2 text-justify";
                  if (isHtml) {
                    return (
                      <div
                        className={proseClasses}
                        dangerouslySetInnerHTML={{
                          __html: DOMPurify.sanitize(content),
                        }}
                      />
                    );
                  }
                  return (
                    <div className={proseClasses}>
                      <ReactMarkdown>{content}</ReactMarkdown>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            <RichTextEditorModal
              open={editingContent}
              onOpenChange={setEditingContent}
              value={formalizacao.body_md || ""}
              title="Editar conteúdo da formalização"
              onSave={handleUpdateContent}
            />

            {showSignatureBlock && (
              <SignatureBlock
                acknowledged={acknowledged}
                setAcknowledged={setAcknowledged}
                isPending={acknowledge.isPending}
                onAcknowledge={handleAcknowledge}
              />
            )}

            <PartiesCard
              parties={parties}
              acknowledgements={acknowledgements}
              partiesSigned={formalizacao.parties_signed ?? 0}
              partiesTotal={formalizacao.parties_total ?? parties.length}
            />
          </TabsContent>

          <TabsContent value="evidencias" className="mt-4">
            <FormalizacaoEvidence
              formalizationId={id!}
              attachments={
                (formalizacao.attachments as unknown as AttachmentRow[]) || []
              }
              evidenceLinks={
                (formalizacao.evidence_links as unknown as EvidenceLinkRow[]) ||
                []
              }
              isLocked={!!formalizacao.locked_at}
            />
          </TabsContent>

          <TabsContent value="auditoria" className="mt-4 space-y-4">
            <VersionHistory
              formalizationId={id!}
              currentTitle={formalizacao.title ?? ""}
              currentSummary={formalizacao.summary ?? ""}
              currentBodyMd={formalizacao.body_md || ""}
            />
            <DigitalSignatureLog
              formalizationId={id!}
              signatures={acknowledgements}
              parties={parties}
              documentHash={formalizacao.locked_hash}
              lockedAt={formalizacao.locked_at}
            />
            <EventHistoryCard events={events} />
          </TabsContent>
        </Tabs>
      </main>

      {showSignatureBlock && (
        <MobileSignatureBar
          isPending={acknowledge.isPending}
          onQuickAcknowledge={() => {
            setAcknowledged(true);
            handleAcknowledge();
          }}
        />
      )}
    </div>
  );
}
