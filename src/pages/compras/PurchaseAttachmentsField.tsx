import { useEffect, useRef, useState } from "react";
import {
  Paperclip,
  X,
  FileIcon,
  ImageIcon,
  Loader2,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const BUCKET = "purchase-attachments";
const MAX_SIZE = 20 * 1024 * 1024; // 20 MB
const ACCEPT = "image/*,application/pdf,.doc,.docx,.xls,.xlsx";

export interface PendingAttachment {
  /** Local id used only for UI keys. */
  localId: string;
  file: File;
}

export interface SavedAttachment {
  id: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

interface CommonProps {
  label?: string;
  helperText?: string;
}

/**
 * "Pré-criação" mode: arquivos ficam em memória até o submit.
 * Use o helper `uploadPendingAttachments` após criar a compra.
 */
interface PendingProps extends CommonProps {
  mode: "pending";
  pending: PendingAttachment[];
  onPendingChange: (next: PendingAttachment[]) => void;
}

/**
 * "Live" mode: vinculado a uma compra existente; lê e grava direto na
 * tabela `project_purchase_attachments` + bucket.
 */
interface LiveProps extends CommonProps {
  mode: "live";
  projectId: string;
  purchaseId: string;
}

type Props = PendingProps | LiveProps;

function fileIconFor(mime?: string | null) {
  if (mime?.startsWith("image/")) return ImageIcon;
  return FileIcon;
}

function formatBytes(bytes?: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PurchaseAttachmentsField(props: Props) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState<SavedAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const isLive = props.mode === "live";

  // Load existing attachments in live mode
  useEffect(() => {
    if (!isLive) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("project_purchase_attachments")
        .select(
          "id, file_name, storage_path, mime_type, size_bytes, created_at",
        )
        .eq("purchase_id", (props as LiveProps).purchaseId)
        .order("created_at", { ascending: false });
      if (!cancelled) {
        if (error) {
          console.error("[PurchaseAttachmentsField] list error:", error);
        } else {
          setSaved((data || []) as SavedAttachment[]);
        }
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive, isLive ? (props as LiveProps).purchaseId : null]);

  const validateFiles = (files: FileList | File[]): File[] => {
    const out: File[] = [];
    for (const f of Array.from(files)) {
      if (f.size > MAX_SIZE) {
        toast.error(`"${f.name}" excede 20 MB`, {
          description: "Reduza o tamanho ou envie em outro formato.",
        });
        continue;
      }
      out.push(f);
    }
    return out;
  };

  const handlePick = () => inputRef.current?.click();

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = validateFiles(fileList);
    if (files.length === 0) return;

    if (props.mode === "pending") {
      const next: PendingAttachment[] = [
        ...props.pending,
        ...files.map((f) => ({ localId: crypto.randomUUID(), file: f })),
      ];
      props.onPendingChange(next);
      return;
    }

    // Live mode — upload imediato
    if (!user?.id) {
      toast.error("Sessão expirada", {
        description: "Faça login novamente para anexar arquivos.",
      });
      return;
    }
    setBusyId("upload");
    try {
      for (const f of files) {
        const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${(props as LiveProps).projectId}/${(props as LiveProps).purchaseId}/${Date.now()}_${safe}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, f, {
            contentType: f.type || "application/octet-stream",
            upsert: false,
          });
        if (upErr) throw upErr;

        const { data: row, error: dbErr } = await supabase
          .from("project_purchase_attachments")
          .insert({
            purchase_id: (props as LiveProps).purchaseId,
            project_id: (props as LiveProps).projectId,
            storage_path: path,
            storage_bucket: BUCKET,
            file_name: f.name,
            mime_type: f.type || null,
            size_bytes: f.size,
            uploaded_by: user.id,
          })
          .select(
            "id, file_name, storage_path, mime_type, size_bytes, created_at",
          )
          .single();
        if (dbErr) {
          // rollback do storage para evitar arquivo órfão
          await supabase.storage.from(BUCKET).remove([path]);
          throw dbErr;
        }
        setSaved((prev) => [row as SavedAttachment, ...prev]);
      }
      toast.success(
        files.length === 1
          ? "Arquivo anexado"
          : `${files.length} arquivos anexados`,
      );
    } catch (e) {
      console.error("[PurchaseAttachmentsField] upload error:", e);
      toast.error("Não foi possível anexar", {
        description:
          e instanceof Error
            ? e.message
            : "Tente novamente em alguns instantes.",
      });
    } finally {
      setBusyId(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removePending = (localId: string) => {
    if (props.mode !== "pending") return;
    props.onPendingChange(props.pending.filter((p) => p.localId !== localId));
  };

  const removeSaved = async (att: SavedAttachment) => {
    setBusyId(att.id);
    try {
      const { error: delDb } = await supabase
        .from("project_purchase_attachments")
        .delete()
        .eq("id", att.id);
      if (delDb) throw delDb;
      // best-effort no storage
      await supabase.storage.from(BUCKET).remove([att.storage_path]);
      setSaved((prev) => prev.filter((s) => s.id !== att.id));
      toast.success("Anexo removido");
    } catch (e) {
      console.error("[PurchaseAttachmentsField] remove error:", e);
      toast.error("Não foi possível remover o anexo");
    } finally {
      setBusyId(null);
    }
  };

  const downloadSaved = async (att: SavedAttachment) => {
    setBusyId(att.id);
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(att.storage_path, 60);
      if (error || !data?.signedUrl) throw error || new Error("Sem URL");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      console.error("[PurchaseAttachmentsField] download error:", e);
      toast.error("Não foi possível abrir o anexo");
    } finally {
      setBusyId(null);
    }
  };

  const items: Array<{
    key: string;
    name: string;
    size?: number | null;
    mime?: string | null;
    saved?: SavedAttachment;
    pendingId?: string;
  }> = [
    ...(props.mode === "pending"
      ? props.pending.map((p) => ({
          key: p.localId,
          name: p.file.name,
          size: p.file.size,
          mime: p.file.type,
          pendingId: p.localId,
        }))
      : saved.map((s) => ({
          key: s.id,
          name: s.file_name,
          size: s.size_bytes,
          mime: s.mime_type,
          saved: s,
        }))),
  ];

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">
          {props.label ?? "Anexos (opcional)"}
        </Label>
        <span className="text-[11px] text-muted-foreground">
          {props.helperText ?? "Imagens e documentos até 20 MB"}
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
        aria-label="Selecionar arquivos para anexar"
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handlePick}
        disabled={busyId === "upload"}
        className="w-fit gap-2"
      >
        {busyId === "upload" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Paperclip className="h-4 w-4" />
        )}
        {busyId === "upload" ? "Enviando…" : "Adicionar arquivos"}
      </Button>

      {loading && (
        <p className="text-xs text-muted-foreground inline-flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" /> Carregando anexos…
        </p>
      )}

      {items.length === 0 && !loading && (
        <p className="text-xs text-muted-foreground">
          Nenhum anexo adicionado.
        </p>
      )}

      {items.length > 0 && (
        <ul className="grid gap-1.5">
          {items.map((it) => {
            const Icon = fileIconFor(it.mime);
            const busy = busyId === (it.saved?.id ?? "");
            return (
              <li
                key={it.key}
                className={cn(
                  "flex items-center gap-2 rounded-md border border-border/70 bg-background px-2.5 py-1.5 text-sm",
                )}
              >
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium" title={it.name}>
                    {it.name}
                  </p>
                  {it.size ? (
                    <p className="text-[11px] text-muted-foreground">
                      {formatBytes(it.size)}
                    </p>
                  ) : null}
                </div>
                {it.saved && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => downloadSaved(it.saved!)}
                    disabled={busy}
                    aria-label={`Abrir ${it.name}`}
                  >
                    {busy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    it.saved
                      ? removeSaved(it.saved)
                      : removePending(it.pendingId!)
                  }
                  disabled={busy}
                  aria-label={`Remover ${it.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Faz upload dos arquivos pendentes após a compra ter sido criada.
 * Não lança — apenas reporta via toast e console (best-effort).
 */
export async function uploadPendingAttachments(args: {
  pending: PendingAttachment[];
  purchaseId: string;
  projectId: string;
  userId: string;
}): Promise<{ uploaded: number; failed: number }> {
  let uploaded = 0;
  let failed = 0;
  for (const p of args.pending) {
    try {
      const safe = p.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${args.projectId}/${args.purchaseId}/${Date.now()}_${safe}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, p.file, {
          contentType: p.file.type || "application/octet-stream",
          upsert: false,
        });
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase
        .from("project_purchase_attachments")
        .insert({
          purchase_id: args.purchaseId,
          project_id: args.projectId,
          storage_path: path,
          storage_bucket: BUCKET,
          file_name: p.file.name,
          mime_type: p.file.type || null,
          size_bytes: p.file.size,
          uploaded_by: args.userId,
        });
      if (dbErr) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw dbErr;
      }
      uploaded++;
    } catch (e) {
      console.error("[uploadPendingAttachments] failed:", p.file.name, e);
      failed++;
    }
  }
  return { uploaded, failed };
}
