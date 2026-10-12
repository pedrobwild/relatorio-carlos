/**
 * Ficha da obra — o que a equipe precisa na porta do prédio, a um toque das
 * telas Hoje, Semana e Painel de Obras: endereço, chaves, senha da fechadura,
 * regras do condomínio e contatos (síndico, gerente predial, portaria,
 * administradora).
 *
 * Abre só para leitura; quem pode editar troca para um formulário compacto na
 * própria gaveta. Interna: o cliente não vê esta tela nem estes dados.
 */
import { useEffect, useId, useRef, useState } from "react";
import {
  Building2,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  RefreshCw,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useCan } from "@/hooks/useCan";
import { useIsMobile } from "@/hooks/use-mobile";
import { useStudioInfo, useUpdateStudioInfo } from "@/hooks/useStudioInfo";
import {
  fichaMissing,
  fichaMissingLabel,
  keysStatus,
  mapHref,
  telHref,
  whatsappHref,
  workScheduleLabel,
  type FichaInfo,
} from "@/lib/fichaObra";
import { extractRichTextPlain, sanitizeInlineRichText } from "@/lib/sanitizeRichText";
import type { StudioInfoPatch } from "@/infra/repositories/studioInfo.repository";
import { FichaObraForm } from "@/components/gestao/ficha/FichaObraForm";

export interface FichaObraSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null | undefined;
  projectName?: string | null;
}

export function FichaObraSheet({ open, onOpenChange, projectId, projectName }: FichaObraSheetProps) {
  const isMobile = useIsMobile();
  // Enquanto a gaveta fecha, quem abriu já pode ter limpado a obra: mantém a
  // última para o conteúdo não sumir durante a animação.
  const last = useRef({ projectId, projectName });
  if (projectId) last.current = { projectId, projectName };
  const shown = last.current;

  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!open) setEditing(false);
  }, [open]);

  /** Editando, tocar fora ou Esc não fecha: evita perder o que foi digitado. */
  const keepOpenWhileEditing = (e: Event) => {
    if (editing) e.preventDefault();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "flex w-full flex-col gap-0 p-0",
          isMobile ? "mx-auto max-w-lg rounded-t-2xl pb-[env(safe-area-inset-bottom)]" : "sm:max-w-md",
        )}
        onInteractOutside={keepOpenWhileEditing}
        onEscapeKeyDown={keepOpenWhileEditing}
      >
        {shown.projectId ? (
          <FichaContent
            key={shown.projectId}
            projectId={shown.projectId}
            projectName={shown.projectName ?? null}
            editing={editing}
            setEditing={setEditing}
          />
        ) : (
          <SheetHeader className="p-5 pr-14 text-left">
            <SheetTitle>Ficha da obra</SheetTitle>
            <SheetDescription>Escolha uma obra para ver a ficha.</SheetDescription>
          </SheetHeader>
        )}
      </SheetContent>
    </Sheet>
  );
}

function FichaContent({
  projectId,
  projectName,
  editing,
  setEditing,
}: {
  projectId: string;
  projectName: string | null;
  editing: boolean;
  setEditing: (editing: boolean) => void;
}) {
  const { can } = useCan();
  const { data, isLoading, isError, isFetching, refetch } = useStudioInfo(projectId);
  const update = useUpdateStudioInfo();

  // `undefined` = nunca carregou; `null` = carregou e a obra não tem ficha.
  const loaded = data !== undefined;
  const failed = isError && !loaded;
  const canEdit = can("ficha:edit") && loaded;

  const save = async (patch: StudioInfoPatch) => {
    try {
      await update.mutateAsync({ projectId, patch });
      toast.success("Ficha salva");
      setEditing(false);
    } catch {
      // O aviso de erro é o global das mutações; o formulário continua
      // aberto com o que foi digitado.
    }
  };

  return (
    <>
      <SheetHeader className="flex-row items-start justify-between gap-3 space-y-0 border-b border-border p-5 pr-14 text-left">
        <div className="min-w-0 space-y-1">
          <SheetTitle>{editing ? "Editar ficha da obra" : "Ficha da obra"}</SheetTitle>
          <SheetDescription className="truncate">{projectName ?? "Obra"}</SheetDescription>
        </div>
        {canEdit && !editing && (
          <Button type="button" variant="outline" className="min-h-[40px] shrink-0" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Editar
          </Button>
        )}
      </SheetHeader>

      {isLoading && !loaded ? (
        <div className="space-y-4 p-5" aria-busy="true" aria-label="Carregando a ficha da obra">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      ) : failed ? (
        <div role="alert" className="space-y-3 p-5">
          <p className="text-sm font-medium text-foreground">Não foi possível carregar a ficha desta obra.</p>
          <p className="text-sm text-muted-foreground">Confira a conexão e tente de novo.</p>
          <Button type="button" variant="outline" className="min-h-[44px]" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} aria-hidden="true" />
            Tentar de novo
          </Button>
        </div>
      ) : editing ? (
        <FichaObraForm info={data ?? null} saving={update.isPending} onCancel={() => setEditing(false)} onSave={save} />
      ) : (
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
          {isError && (
            <p role="status" className="text-xs text-muted-foreground">
              Não foi possível atualizar agora. Mostrando a última versão carregada.{" "}
              <button type="button" className="font-medium text-foreground underline underline-offset-2" onClick={() => refetch()}>
                Tentar de novo
              </button>
            </p>
          )}
          <FichaView info={data ?? null} />
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

const Empty = ({ children = "Não informado" }: { children?: React.ReactNode }) => (
  <span className="text-muted-foreground">{children}</span>
);

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <h3 id={id} className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        {title}
      </h3>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-0.5 text-sm text-foreground">{children}</div>
    </div>
  );
}

const text = (v: string | null | undefined) => v?.trim() || null;

function FichaView({ info }: { info: FichaInfo | null }) {
  const missing = fichaMissing(info);
  const keys = keysStatus(info);
  const map = mapHref(info);
  const schedule = workScheduleLabel(info);
  const release = text(info?.access_release_process);
  const accessHtml = sanitizeInlineRichText(info?.provider_access_instructions);
  const hasAccess = extractRichTextPlain(accessHtml).length > 0;
  const addressTail = [text(info?.bairro), text(info?.cidade)].filter(Boolean).join(" · ");

  return (
    <>
      {missing.length > 0 && (
        <p role="status" className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-foreground">
          <span className="font-medium">{fichaMissingLabel(missing.length)}</span>
          <span className="text-muted-foreground">: {missing.join(", ")}.</span>
        </p>
      )}

      <Section icon={MapPin} title="Endereço">
        <Row label="Empreendimento">{text(info?.nome_do_empreendimento) ?? <Empty />}</Row>
        <Row label="Endereço">
          {text(info?.endereco_completo) ? (
            <>
              <span className="block">
                {text(info?.endereco_completo)}
                {text(info?.complemento) ? ` · ${text(info?.complemento)}` : ""}
              </span>
              {addressTail && <span className="block text-muted-foreground">{addressTail}</span>}
            </>
          ) : (
            <Empty />
          )}
        </Row>
        {map && (
          <a
            href={map}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            <MapPin className="h-4 w-4" aria-hidden="true" />
            Abrir no mapa
          </a>
        )}
      </Section>

      <Section icon={KeyRound} title="Chaves">
        <p className={cn("text-sm text-foreground", !keys.received && "font-medium")}>{keys.text}</p>
        <Row label="Onde estão">{text(info?.key_location) ?? <Empty />}</Row>
      </Section>

      <Section icon={Lock} title="Fechadura eletrônica">
        <LockPassword password={text(info?.electronic_lock_password)} />
      </Section>

      <Section icon={Building2} title="Condomínio">
        <Row label="Dias e horários permitidos">{schedule ?? <Empty />}</Row>
        <Row label="Como pedir a liberação da equipe">
          {release ? <p className="whitespace-pre-line">{release}</p> : <Empty />}
        </Row>
        <Row label="Acesso no dia">
          {hasAccess ? (
            <div
              className="space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
              // HTML já limpo por sanitizeInlineRichText (DOMPurify, só formatação básica).
              dangerouslySetInnerHTML={{ __html: accessHtml }}
            />
          ) : (
            <Empty />
          )}
        </Row>
      </Section>

      <Section icon={Users} title="Contatos">
        <ul className="space-y-3">
          <Contact role="Síndico" name={info?.syndic_name} phone={info?.syndic_phone} email={info?.syndic_email} />
          <Contact
            role="Gerente predial"
            name={info?.building_manager_name}
            phone={info?.building_manager_phone}
            email={info?.building_manager_email}
          />
          <Contact role="Portaria" name={info?.concierge_name} phone={info?.concierge_phone} />
          <Contact
            role="Administradora"
            name={info?.property_admin_name}
            phone={info?.property_admin_phone}
            email={info?.property_admin_email}
          />
        </ul>
      </Section>
    </>
  );
}

function LockPassword({ password }: { password: string | null }) {
  const [revealed, setRevealed] = useState(false);
  if (!password) return <p className="text-sm text-muted-foreground">Sem fechadura eletrônica informada</p>;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      toast.success("Senha copiada");
    } catch {
      toast.error("Não foi possível copiar. Toque em Mostrar para ver a senha.");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="mr-auto text-sm text-foreground">
        <span className="sr-only">Senha: </span>
        {revealed ? (
          <span className="select-all font-mono text-base font-semibold tracking-wider">{password}</span>
        ) : (
          <>
            <span aria-hidden="true" className="font-mono text-base tracking-widest">
              ••••••
            </span>
            <span className="sr-only">oculta</span>
          </>
        )}
      </p>
      <Button
        type="button"
        variant="outline"
        className="min-h-[44px]"
        aria-pressed={revealed}
        onClick={() => setRevealed((r) => !r)}
      >
        {revealed ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        {revealed ? "Ocultar" : "Mostrar"}
      </Button>
      <Button type="button" variant="outline" className="min-h-[44px]" onClick={copy} aria-label="Copiar senha">
        <Copy className="h-4 w-4" aria-hidden="true" />
        Copiar
      </Button>
    </div>
  );
}

function Contact({
  role,
  name,
  phone,
  email,
}: {
  role: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}) {
  const n = text(name);
  const p = text(phone);
  const e = text(email);
  const tel = telHref(p);
  const whats = whatsappHref(p);
  const who = n ? `${role} (${n})` : role;

  return (
    <li className="rounded-lg border border-border p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{role}</p>
      {!n && !p && !e ? (
        <p className="mt-1 text-sm">
          <Empty />
        </p>
      ) : (
        <div className="mt-1 space-y-1 text-sm text-foreground">
          {n && <p className="font-medium">{n}</p>}
          {p && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {tel ? (
                <a
                  href={tel}
                  aria-label={`Ligar para ${who}: ${p}`}
                  className="inline-flex min-h-[44px] items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline"
                >
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  {p}
                </a>
              ) : (
                <span className="select-all">{p}</span>
              )}
              {whats && (
                <a
                  href={whats}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`WhatsApp de ${who}`}
                  className="inline-flex min-h-[44px] items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  WhatsApp
                </a>
              )}
            </div>
          )}
          {e && <p className="select-all break-all text-muted-foreground">{e}</p>}
        </div>
      )}
    </li>
  );
}
