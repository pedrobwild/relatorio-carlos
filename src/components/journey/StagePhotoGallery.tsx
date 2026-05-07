import { useRef, useState } from "react";
import { Camera, Plus, Trash2, X, Loader2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStagePhotos, StagePhoto } from "@/hooks/useStagePhotos";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface StagePhotoGalleryProps {
  stageId: string;
  projectId: string;
  isAdmin: boolean;
}

export function StagePhotoGallery({
  stageId,
  projectId,
  isAdmin,
}: StagePhotoGalleryProps) {
  const {
    photos,
    isLoading,
    upload,
    isUploading,
    deletePhoto,
    isDeleting: _isDeleting,
    updateCaption,
  } = useStagePhotos(stageId, projectId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [lightbox, setLightbox] = useState<StagePhoto | null>(null);
  const [editingCaption, setEditingCaption] = useState<string | null>(null);
  const [captionValue, setCaptionValue] = useState("");

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    await upload(files);
    if (fileRef.current) fileRef.current.value = "";
  };

  const startEditCaption = (photo: StagePhoto) => {
    setEditingCaption(photo.id);
    setCaptionValue(photo.caption || "");
  };

  const saveCaption = (id: string) => {
    updateCaption({ id, caption: captionValue });
    setEditingCaption(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
          <Camera className="h-4 w-4 text-primary" />
          Galeria de Fotos
        </h4>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1"
          onClick={() => fileRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          {isUploading ? "Enviando..." : "Adicionar"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFiles}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
          <ImageIcon className="h-8 w-8 opacity-40" />
          <p className="text-xs">Nenhuma foto nesta etapa</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="group relative aspect-square rounded-lg overflow-hidden border border-border bg-muted cursor-pointer"
              onClick={() => setLightbox(photo)}
            >
              <img
                src={photo.url}
                alt={photo.caption || "Foto da etapa"}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                loading="lazy"
              />
              {isAdmin && (
                <button
                  className="absolute top-1 right-1 bg-background/80 backdrop-blur-sm rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    deletePhoto(photo);
                  }}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </button>
              )}
              {photo.caption && (
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-1.5">
                  <p className="text-[10px] text-white line-clamp-1">
                    {photo.caption}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      <Dialog
        open={!!lightbox}
        onOpenChange={(open) => !open && setLightbox(null)}
      >
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-background">
          <DialogTitle className="sr-only">Visualizar foto</DialogTitle>
          {lightbox && (
            <div className="flex flex-col">
              <img
                src={lightbox.url}
                alt={lightbox.caption || "Foto"}
                className="w-full max-h-[70vh] object-contain bg-black"
              />
              <div className="p-4 space-y-2">
                {editingCaption === lightbox.id ? (
                  <div className="flex gap-2">
                    <Input
                      value={captionValue}
                      onChange={(e) => setCaptionValue(e.target.value)}
                      placeholder="Legenda da foto..."
                      className="h-9 text-sm"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      className="h-9"
                      onClick={() => {
                        saveCaption(lightbox.id);
                        setLightbox({ ...lightbox, caption: captionValue });
                      }}
                    >
                      Salvar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9"
                      onClick={() => setEditingCaption(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <p
                    className={cn(
                      "text-sm cursor-pointer hover:text-primary transition-colors",
                      !lightbox.caption && "text-muted-foreground italic",
                    )}
                    onClick={() => startEditCaption(lightbox)}
                  >
                    {lightbox.caption || "Clique para adicionar legenda..."}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {new Date(lightbox.created_at).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
