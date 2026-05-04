import { useMemo, useState } from "react";
import {
  Download,
  ExternalLink,
  FileText,
  Award,
  Ruler,
  ClipboardList,
  CheckCircle2,
  Loader2,
  Layers,
  MessageSquareWarning,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import PDFViewer from "@/components/PDFViewer";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { useProject } from "@/contexts/ProjectContext";
import { useDocuments, type ProjectDocument } from "@/hooks/useDocuments";
import { useUserRole } from "@/hooks/useUserRole";
import { useExecutivoVersions } from "@/hooks/useExecutivoVersions";
import { ExecutivoVersionsModal } from "@/components/executivo/ExecutivoVersionsModal";
import { RelatedDocPDFModal } from "@/components/executivo/RelatedDocPDFModal";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProjectSubNav } from "@/components/layout/ProjectSubNav";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

// ── Tacit Approval Banner ──────────────────────────────────────────────
interface TacitApprovalNoticeProps {
  formalizacoesPath: string;
  /** ISO timestamp em que a tácita foi registrada. Quando ausente, o texto
   *  cai num fallback genérico (compatibilidade com docs legados). */
  registeredAt?: string | null;
  /** Hash SHA-256 do PDF aprovado tacitamente (rastreabilidade jurídica). */
  documentHash?: string | null;
  /** Dias contratuais sem manifestação que dispararam a tácita. */
  daysSilent?: number | null;
}

/**
 * Banner de aprovação tácita rastreável: usa tokens semânticos (warning) em
 * vez de literais Tailwind para respeitar dark mode e acessibilidade. Quando
 * recebe `registeredAt` + `daysSilent`, gera o texto humano completo
 * exigido pelo Bloco 1 (DD/MM, HH:MM, dias). Hash do PDF é exposto em
 * mono pequena para auditoria sem poluir o copy.
 */
function TacitApprovalNotice({
  formalizacoesPath,
  registeredAt,
  documentHash,
  daysSilent,
}: TacitApprovalNoticeProps) {
  const description = useMemo(() => {
    if (!registeredAt) {
      return (
        <>
          Este projeto executivo foi considerado{" "}
          <strong>aprovado tacitamente</strong>, pois não houve manifestação do
          cliente dentro do prazo estipulado em contrato.
        </>
      );
    }
    const parsed = parseISO(registeredAt);
    const dateStr = Number.isNaN(parsed.getTime())
      ? null
      : format(parsed, "dd/MM 'às' HH:mm", { locale: ptBR });
    const days =
      typeof daysSilent === "number" && daysSilent > 0 ? daysSilent : null;
    if (dateStr && days) {
      return (
        <>
          Aprovação automática registrada em <strong>{dateStr}</strong> porque o
          prazo contratual de <strong>{days} dia(s)</strong> venceu sem
          manifestação.
        </>
      );
    }
    if (dateStr) {
      return (
        <>
          Aprovação automática registrada em <strong>{dateStr}</strong> porque o
          prazo contratual venceu sem manifestação.
        </>
      );
    }
    return (
      <>
        Este projeto executivo foi considerado{" "}
        <strong>aprovado tacitamente</strong>, pois não houve manifestação do
        cliente dentro do prazo estipulado em contrato.
      </>
    );
  }, [registeredAt, daysSilent]);

  return (
    <div
      role="status"
      className="rounded-lg border border-warning/30 bg-warning/10 p-3 sm:p-4"
    >
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-warning/20 shrink-0 mt-0.5">
          <CheckCircle2 className="w-4 h-4 text-warning" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-h3 text-warning mb-1">Aprovação Tácita</h3>
          <p className="text-caption text-foreground/85">{description}</p>
          {documentHash && (
            <p
              className="mt-1 text-tiny font-mono text-muted-foreground truncate"
              title={documentHash}
            >
              hash: {documentHash}
            </p>
          )}
          <Link
            to={formalizacoesPath}
            className="inline-flex items-center gap-1.5 mt-2 text-caption text-warning hover:text-warning/80 underline underline-offset-2"
          >
            <FileText className="w-3.5 h-3.5" />
            Ver formalização completa
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Related Document Card (mobile) ─────────────────────────────────────
function RelatedDocCard({
  doc,
  icon: Icon,
  subtitle,
  modalOpen,
  setModalOpen,
}: {
  doc: ProjectDocument;
  icon: typeof Award;
  subtitle: string;
  modalOpen: boolean;
  setModalOpen: (v: boolean) => void;
}) {
  return (
    <div className="bg-card rounded-lg border border-border p-3 sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary/10 shrink-0">
            <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="text-h3 truncate">{doc.name}</h3>
            <p className="text-caption">{subtitle}</p>
          </div>
        </div>
        <RelatedDocPDFModal
          doc={doc}
          icon={Icon}
          open={modalOpen}
          onOpenChange={setModalOpen}
          trigger={
            <Button variant="outline" size="sm" className="gap-2 shrink-0">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Visualizar</span>
              <span className="sm:hidden">Ver</span>
            </Button>
          }
        />
      </div>
    </div>
  );
}

// ── Desktop Sidebar Card ───────────────────────────────────────────────
function DesktopDocCard({
  doc,
  icon: Icon,
  subtitle,
  modalOpen,
  setModalOpen,
}: {
  doc: ProjectDocument;
  icon: typeof Award;
  subtitle: string;
  modalOpen: boolean;
  setModalOpen: (v: boolean) => void;
}) {
  return (
    <RelatedDocPDFModal
      doc={doc}
      icon={Icon}
      open={modalOpen}
      onOpenChange={setModalOpen}
      trigger={
        <div className="bg-secondary/50 border border-border rounded-lg p-3 cursor-pointer hover:bg-accent/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 shrink-0">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-body font-medium">{doc.name}</h3>
              <p className="text-caption text-muted-foreground">{subtitle}</p>
            </div>
          </div>
        </div>
      }
    />
  );
}

// ── Main Page ──────────────────────────────────────────────────────────
const Executivo = () => {
  const { projectId } = useParams();
  const { paths } = useProjectNavigation();
  const {
    project,
    loading: projectLoading,
    error: projectError,
  } = useProject();
  const { loading: docsLoading, getLatestByCategory } = useDocuments(projectId);
  const { isStaff } = useUserRole();
  const { versions } = useExecutivoVersions(projectId);

  const executivoDoc = getLatestByCategory("executivo")[0];
  const artDoc = getLatestByCategory("art_rrt")[0];
  const planoReformaDoc = getLatestByCategory("plano_reforma")[0];

  // Aprovação tácita = aprovado sem actor humano (approved_by IS NULL).
  // Aprovação manual também marca approved_at, então não basta olhar status.
  const isTacitApproval = useMemo(() => {
    if (!executivoDoc) return false;
    return (
      executivoDoc.status === "approved" &&
      !!executivoDoc.approved_at &&
      !executivoDoc.approved_by
    );
  }, [executivoDoc]);

  // Proxy de "dias silentes": intervalo entre upload e aprovação tácita —
  // mesmo cálculo usado pelo trigger DB log_executive_tacit_approval para
  // garantir paridade visual com o domain_event registrado.
  const tacitDaysSilent = useMemo(() => {
    if (
      !isTacitApproval ||
      !executivoDoc?.created_at ||
      !executivoDoc?.approved_at
    ) {
      return null;
    }
    const days = differenceInCalendarDays(
      parseISO(executivoDoc.approved_at),
      parseISO(executivoDoc.created_at),
    );
    return days > 0 ? days : null;
  }, [isTacitApproval, executivoDoc?.created_at, executivoDoc?.approved_at]);

  const loading = projectLoading || docsLoading;

  const [artModalOpen, setArtModalOpen] = useState(false);
  const [planoReformaModalOpen, setPlanoReformaModalOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [revisionDetailVersion, setRevisionDetailVersion] = useState<
    number | null
  >(null);

  const pendingRevisions = versions.filter((v) => v.revision_requested_at);

  const handleDownload = async (doc: ProjectDocument) => {
    if (!doc.url) return;
    const response = await fetch(doc.url);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = doc.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleOpenInNewTab = (doc: ProjectDocument) => {
    if (doc.url) window.open(doc.url, "_blank");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (projectError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">{projectError}</p>
          <Link to="/minhas-obras" className="text-primary underline">
            Voltar
          </Link>
        </div>
      </div>
    );
  }

  const hasDocument = !!executivoDoc?.url;
  const hasArt = !!artDoc?.url;
  const hasPlanoReforma = !!planoReformaDoc?.url;

  return (
    <div className="min-h-screen min-h-[100dvh] pb-safe bg-background flex flex-col">
      <PageHeader
        title="Projeto Executivo"
        backTo={paths.relatorio}
        breadcrumbs={[
          { label: "Minhas Obras", href: "/minhas-obras" },
          { label: project?.name || "Obra", href: paths.relatorio },
          { label: "Executivo" },
        ]}
      >
        {hasDocument && (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleOpenInNewTab(executivoDoc)}
              className="h-9 w-9 rounded-full sm:hidden hover:bg-primary/10"
              title="Abrir em nova aba"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
            <Button
              onClick={() => handleDownload(executivoDoc)}
              size="sm"
              className="gap-2 h-9"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Download</span>
            </Button>
          </>
        )}
      </PageHeader>
      <ProjectSubNav />

      {hasDocument ? (
        <div className="flex-1 p-2 sm:p-4 md:p-6 overflow-auto">
          <div className="max-w-7xl mx-auto w-full space-y-6">
            {/* Versions Card */}
            <div className="bg-card rounded-xl border border-border shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Layers className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Versões do Projeto Executivo
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      PDFs com comentários e revisão
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setVersionsOpen(true)}
                  className="gap-1.5"
                >
                  <Layers className="h-4 w-4" />
                  Gerenciar
                </Button>
              </div>
            </div>

            {/* Revision Request Banners */}
            {isStaff && pendingRevisions.length > 0 && (
              <div className="space-y-3">
                {pendingRevisions.map((version) => (
                  <div
                    key={version.id}
                    className="flex items-center gap-3 p-4 bg-[hsl(var(--warning-light))] border border-[hsl(var(--warning)/0.2)] rounded-xl"
                  >
                    <MessageSquareWarning className="h-5 w-5 text-[hsl(var(--warning))] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        Solicitação de Revisão — Versão {version.version_number}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Solicitada em{" "}
                        {format(
                          new Date(version.revision_requested_at!),
                          "dd/MM/yyyy 'às' HH:mm",
                          { locale: ptBR },
                        )}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-1.5"
                      onClick={() =>
                        setRevisionDetailVersion(version.version_number)
                      }
                    >
                      Ver detalhes
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Desktop: Two-column layout */}
            <div className="hidden lg:grid lg:grid-cols-[1fr_340px] lg:gap-6">
              <div className="space-y-4">
                {isTacitApproval && (
                  <TacitApprovalNotice
                    formalizacoesPath={paths.formalizacoes}
                    registeredAt={executivoDoc.approved_at}
                    documentHash={executivoDoc.checksum}
                    daysSilent={tacitDaysSilent}
                  />
                )}
                <div className="h-[calc(100vh-260px)]">
                  <PDFViewer
                    url={executivoDoc.url!}
                    title="Projeto Executivo"
                  />
                </div>
              </div>

              <div className="space-y-4 sticky top-20 h-fit">
                {(hasArt || hasPlanoReforma) && (
                  <div className="bg-card border border-border rounded-lg p-4">
                    <h2 className="text-h2 mb-4">Documentos Relacionados</h2>
                    <div className="space-y-3">
                      {hasArt && (
                        <DesktopDocCard
                          doc={artDoc}
                          icon={Award}
                          subtitle="Responsabilidade Técnica"
                          modalOpen={artModalOpen}
                          setModalOpen={setArtModalOpen}
                        />
                      )}
                      {hasPlanoReforma && (
                        <DesktopDocCard
                          doc={planoReformaDoc}
                          icon={ClipboardList}
                          subtitle="Planejamento da reforma"
                          modalOpen={planoReformaModalOpen}
                          setModalOpen={setPlanoReformaModalOpen}
                        />
                      )}
                    </div>
                  </div>
                )}
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                  <p className="text-caption text-foreground/80">
                    <strong>Dica:</strong> Clique em um documento para
                    visualizá-lo ou fazer download.
                  </p>
                </div>
              </div>
            </div>

            {/* Mobile/Tablet: Stack layout */}
            <div className="lg:hidden flex flex-col gap-3">
              {isTacitApproval && (
                <TacitApprovalNotice
                  formalizacoesPath={paths.formalizacoes}
                  registeredAt={executivoDoc.approved_at}
                  documentHash={executivoDoc.checksum}
                  daysSilent={tacitDaysSilent}
                />
              )}
              <div>
                <PDFViewer url={executivoDoc.url!} title="Projeto Executivo" />
              </div>
              {hasArt && (
                <RelatedDocCard
                  doc={artDoc}
                  icon={Award}
                  subtitle="Documento de responsabilidade técnica"
                  modalOpen={artModalOpen}
                  setModalOpen={setArtModalOpen}
                />
              )}
              {hasPlanoReforma && (
                <RelatedDocCard
                  doc={planoReformaDoc}
                  icon={ClipboardList}
                  subtitle="Documento de planejamento da reforma"
                  modalOpen={planoReformaModalOpen}
                  setModalOpen={setPlanoReformaModalOpen}
                />
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 p-4 md:p-6 lg:p-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-card rounded-xl border border-border p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                  <Ruler className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-h2">Projeto Executivo</h2>
                  <p className="text-caption">Documentação técnica detalhada</p>
                </div>
              </div>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="w-16 h-16 text-muted-foreground/30 mb-4" />
                <p className="text-body text-muted-foreground">
                  Documento em preparação
                </p>
                <p className="text-caption mt-1">
                  O arquivo será disponibilizado em breve
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {projectId && (
        <ExecutivoVersionsModal
          projectId={projectId}
          open={versionsOpen}
          onOpenChange={setVersionsOpen}
        />
      )}

      {/* Revision Detail Modal */}
      <Dialog
        open={revisionDetailVersion !== null}
        onOpenChange={(o) => {
          if (!o) setRevisionDetailVersion(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquareWarning className="h-5 w-5 text-[hsl(var(--warning))]" />
              Solicitação de Revisão
            </DialogTitle>
          </DialogHeader>
          {revisionDetailVersion !== null &&
            (() => {
              const version = pendingRevisions.find(
                (v) => v.version_number === revisionDetailVersion,
              );
              if (!version)
                return (
                  <p className="text-sm text-muted-foreground">
                    Versão não encontrada.
                  </p>
                );
              return (
                <div className="space-y-4">
                  <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                    <p className="text-sm font-medium">
                      Versão {version.version_number}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Solicitada em{" "}
                      {format(
                        new Date(version.revision_requested_at!),
                        "dd 'de' MMMM 'de' yyyy 'às' HH:mm",
                        { locale: ptBR },
                      )}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    O cliente finalizou os apontamentos e solicitou a revisão
                    desta versão do Projeto Executivo. Acesse a versão para
                    conferir os comentários e realizar os ajustes necessários.
                  </p>
                  <Button
                    className="w-full gap-2"
                    onClick={() => {
                      setRevisionDetailVersion(null);
                      setVersionsOpen(true);
                    }}
                  >
                    <Layers className="h-4 w-4" />
                    Abrir versões
                  </Button>
                </div>
              );
            })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Executivo;
