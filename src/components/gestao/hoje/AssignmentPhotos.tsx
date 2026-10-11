/**
 * Fotos de campo de uma alocação: miniaturas + botão de câmera.
 * Foto é opcional: nunca bloqueia o Feito.
 */
import { useState } from "react";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PhotoCaptureButton, type CapturedPhoto } from "@/components/ui-premium/PhotoCaptureButton";
import { useAddAssignmentPhotos, useOpsPhotoUrls } from "@/hooks/useOps";
import type { OpsDayAssignment } from "@/infra/repositories/ops.repository";

interface Props {
  assignment: Pick<OpsDayAssignment, "id" | "project_id" | "photo_paths">;
}

export function AssignmentPhotos({ assignment }: Props) {
  const paths = assignment.photo_paths ?? [];
  const { data: urls = [] } = useOpsPhotoUrls(paths);
  const addPhotos = useAddAssignmentPhotos();
  const [capturing, setCapturing] = useState(false);

  const onCapture = async (photos: CapturedPhoto[]) => {
    try {
      await addPhotos.mutateAsync({ assignment, files: photos.map((p) => p.file) });
      toast.success(photos.length === 1 ? "Foto salva" : `${photos.length} fotos salvas`);
      setCapturing(false);
    } catch {
      toast.error("Não foi possível salvar a foto. Tente de novo.");
    } finally {
      photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    }
  };

  return (
    <div className="space-y-2 pt-1">
      {urls.length > 0 && (
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
          {paths.length > 0 ? "Mais fotos" : "Foto (opcional)"}
        </Button>
      )}
    </div>
  );
}
