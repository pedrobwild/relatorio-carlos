/**
 * Fotos de campo de uma alocação: miniaturas + botão de câmera.
 * Foto é opcional: nunca bloqueia o Feito.
 *
 * Funciona sem sinal: a foto vai primeiro para a fila do aparelho (IndexedDB)
 * e sobe sozinha quando houver conexão. Enquanto isso aparece aqui com a
 * marca "aguardando envio".
 */
import { useEffect, useMemo, useState } from "react";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PhotoCaptureButton, type CapturedPhoto } from "@/components/ui-premium/PhotoCaptureButton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useAddAssignmentPhotos, useOpsPhotoUrls } from "@/hooks/useOps";
import { useIsOnline, useQueuedPhotos } from "@/hooks/useOpsOffline";
import { getOpsPhotoQueue } from "@/lib/offline/opsPhotoSync";
import { PhotoQueueFullError, type QueuedPhoto } from "@/lib/offline/photoQueue";
import type { OpsDayAssignment } from "@/infra/repositories/ops.repository";

interface Props {
  assignment: Pick<OpsDayAssignment, "id" | "project_id" | "photo_paths">;
}

export function AssignmentPhotos({ assignment }: Props) {
  const paths = assignment.photo_paths ?? [];
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const online = useIsOnline();
  const { data: urls = [] } = useOpsPhotoUrls(paths);
  const addPhotos = useAddAssignmentPhotos();
  const queued = useQueuedPhotos();
  const waiting = useMemo(
    () => queued.filter((q) => q.assignmentId === assignment.id && q.userId === userId),
    [queued, assignment.id, userId],
  );
  const [capturing, setCapturing] = useState(false);

  const onCapture = async (photos: CapturedPhoto[]) => {
    const files = photos.map((p) => p.file);
    try {
      if (!userId) throw new Error("Sem usuário para guardar a foto");
      await getOpsPhotoQueue().enqueue(
        { userId, assignmentId: assignment.id, projectId: assignment.project_id },
        files,
      );
    } catch (err) {
      if (err instanceof PhotoQueueFullError) {
        toast.error(err.message);
        throw err;
      }
      // Não deu para guardar no aparelho: tenta o envio direto (precisa de rede).
      try {
        await addPhotos.mutateAsync({ assignment, files });
      } catch (sendErr) {
        // Não descarta as fotos: o botão as mantém para o "tente de novo".
        toast.error("Não foi possível salvar a foto. Tente de novo.");
        throw sendErr;
      }
    }
    photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    if (online) toast.success(photos.length === 1 ? "Foto salva" : `${photos.length} fotos salvas`);
    else
      toast.success(photos.length === 1 ? "Foto guardada no aparelho" : `${photos.length} fotos guardadas no aparelho`, {
        description: "Vão ser enviadas quando houver sinal.",
      });
    setCapturing(false);
  };

  const total = paths.length + waiting.length;

  return (
    <div className="space-y-2 pt-1">
      {(urls.length > 0 || waiting.length > 0) && (
        <ul className="flex gap-2 overflow-x-auto" aria-label="Fotos">
          {urls.map((u, i) => (
            <li key={u.path} className="shrink-0">
              <a href={u.url} target="_blank" rel="noreferrer" className="block">
                <img
                  src={u.url}
                  alt={`Foto ${i + 1}`}
                  loading="lazy"
                  className="h-16 w-16 rounded-md border border-border object-cover"
                />
              </a>
            </li>
          ))}
          {waiting.map((q) => (
            <li key={q.id} className="shrink-0">
              <PendingThumb item={q} />
            </li>
          ))}
        </ul>
      )}
      {capturing ? (
        <PhotoCaptureButton
          multiple
          alwaysCapture
          label="Tirar foto"
          disabled={addPhotos.isPending}
          onCapture={onCapture}
        />
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2 min-h-[40px] px-2 text-muted-foreground"
          onClick={() => setCapturing(true)}
        >
          <Camera className="h-4 w-4" aria-hidden="true" />
          {total > 0 ? "Mais fotos" : "Foto (opcional)"}
        </Button>
      )}
    </div>
  );
}

/** Miniatura de uma foto que ainda está só no aparelho. */
function PendingThumb({ item }: { item: QueuedPhoto }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (typeof URL.createObjectURL !== "function") return undefined;
    const url = URL.createObjectURL(item.blob);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [item.blob]);

  const label = item.failed ? "não enviada" : "aguardando envio";
  return (
    <figure className="relative h-16 w-16" data-sync={item.failed ? "failed" : "pending"}>
      {src ? (
        <img
          src={src}
          alt={`Foto ${label}`}
          className={cn(
            "h-16 w-16 rounded-md border object-cover opacity-80",
            item.failed ? "border-destructive/60" : "border-warning/60",
          )}
        />
      ) : (
        <div
          role="img"
          aria-label={`Foto ${label}`}
          className="h-16 w-16 rounded-md border border-warning/60 bg-muted"
        />
      )}
      <figcaption
        className={cn(
          "absolute inset-x-0 bottom-0 rounded-b-md px-0.5 py-px text-center text-[10px] font-medium leading-tight",
          item.failed ? "bg-destructive text-destructive-foreground" : "bg-warning text-warning-foreground",
        )}
      >
        {label}
      </figcaption>
    </figure>
  );
}
