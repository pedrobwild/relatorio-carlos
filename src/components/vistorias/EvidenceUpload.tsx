import { useState, useRef, useEffect } from "react";
import {
  Camera,
  X,
  Loader2,
  ImagePlus,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface EvidenceUploadProps {
  projectId: string;
  entityId: string;
  value: string[];
  onChange: (paths: string[]) => void;
  required?: boolean;
  disabled?: boolean;
  maxFiles?: number;
}

export function EvidenceUpload({
  projectId,
  entityId,
  value,
  onChange,
  required = false,
  disabled = false,
  maxFiles = 5,
}: EvidenceUploadProps) {
  const isMobile = useIsMobile();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const loadSignedUrl = async (path: string) => {
    const { data } = await supabase.storage
      .from("inspection-evidences")
      .createSignedUrl(path, 3600);
    if (data?.signedUrl) {
      setSignedUrls((prev) => ({ ...prev, [path]: data.signedUrl }));
    }
  };

  useEffect(() => {
    value.forEach((path) => {
      setSignedUrls((prev) => {
        if (!prev[path]) loadSignedUrl(path);
        return prev;
      });
    });
    setSignedUrls((prev) => {
      const pathSet = new Set(value);
      const cleaned = Object.fromEntries(
        Object.entries(prev).filter(([k]) => pathSet.has(k)),
      );
      return Object.keys(cleaned).length !== Object.keys(prev).length
        ? cleaned
        : prev;
    });
  }, [value]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const remaining = maxFiles - value.length;
    if (remaining <= 0) {
      toast.error(`Máximo de ${maxFiles} fotos atingido`);
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remaining);
    setUploading(true);
    setUploadProgress(0);

    try {
      const newPaths: string[] = [];
      const total = filesToUpload.length;

      for (let idx = 0; idx < total; idx++) {
        const file = filesToUpload[idx];
        const uuid = crypto.randomUUID();
        const safeName = file.name
          .replace(/[^a-zA-Z0-9._-]/g, "_")
          .slice(0, 80);
        const storagePath = `${projectId}/${entityId}/${uuid}_${safeName}`;

        const { error } = await supabase.storage
          .from("inspection-evidences")
          .upload(storagePath, file, { cacheControl: "3600", upsert: false });

        if (error) {
          toast.error(`Erro ao enviar ${file.name}: ${error.message}`);
          continue;
        }

        newPaths.push(storagePath);
        setUploadProgress(Math.round(((idx + 1) / total) * 100));

        // Pre-load signed URL
        const { data: urlData } = await supabase.storage
          .from("inspection-evidences")
          .createSignedUrl(storagePath, 3600);
        if (urlData?.signedUrl) {
          setSignedUrls((prev) => ({
            ...prev,
            [storagePath]: urlData.signedUrl,
          }));
        }
      }

      if (newPaths.length > 0) {
        onChange([...value, ...newPaths]);
        toast.success(`${newPaths.length} foto(s) enviada(s)`);
      }
    } catch {
      toast.error("Erro ao enviar fotos");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  };

  const handleRemove = async (path: string) => {
    const { error } = await supabase.storage
      .from("inspection-evidences")
      .remove([path]);

    if (error) {
      toast.error("Erro ao remover foto");
      return;
    }

    onChange(value.filter((p) => p !== path));
    setSignedUrls((prev) => {
      const next = { ...prev };
      delete next[path];
      return next;
    });
  };

  const showError = required && value.length === 0;
  const thumbSize = isMobile ? "w-20 h-20" : "w-16 h-16";
  const deleteButtonSize = isMobile
    ? "min-w-[32px] min-h-[32px]"
    : "min-w-[28px] min-h-[28px]";

  return (
    <div className="space-y-2">
      {/* Thumbnails */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((path, idx) => (
            <div
              key={path}
              className={cn(
                "relative group rounded-lg overflow-hidden border bg-muted cursor-pointer",
                thumbSize,
              )}
              onClick={() => signedUrls[path] && setLightboxIndex(idx)}
            >
              {signedUrls[path] ? (
                <img
                  src={signedUrls[path]}
                  alt="Evidência"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(path);
                  }}
                  className={cn(
                    "absolute top-0 right-0 bg-destructive text-destructive-foreground rounded-bl-lg p-1 flex items-center justify-center transition-opacity touch-manipulation",
                    deleteButtonSize,
                    isMobile
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100",
                  )}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload buttons */}
      {!disabled && value.length < maxFiles && (
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/heic"
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />

          {/* Camera button — primary on mobile */}
          <Button
            type="button"
            variant={isMobile ? "default" : "outline"}
            size="sm"
            className={cn(
              "gap-1.5 text-xs h-11 min-w-[44px] touch-manipulation",
              isMobile && "flex-1",
            )}
            onClick={() => cameraInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
            {isMobile ? (
              uploading ? (
                `Enviando ${uploadProgress}%`
              ) : (
                "Tirar Foto"
              )
            ) : (
              <span className="hidden sm:inline">Câmera</span>
            )}
          </Button>

          {/* Gallery button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-11 min-w-[44px] touch-manipulation"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <ImagePlus className="h-4 w-4" />
            {!isMobile && "Galeria"}
          </Button>

          {/* File count */}
          <span className="text-[10px] text-muted-foreground shrink-0">
            {value.length}/{maxFiles}
          </span>
        </div>
      )}

      {/* Upload progress bar */}
      {uploading && uploadProgress > 0 && (
        <div
          className="h-1 bg-muted rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={uploadProgress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progresso do upload"
        >
          <div
            className="h-full bg-primary transition-all duration-200 rounded-full"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}

      {/* Required error */}
      {showError && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Foto obrigatória para itens reprovados
        </p>
      )}

      {/* Lightbox */}
      <Dialog
        open={lightboxIndex !== null}
        onOpenChange={() => setLightboxIndex(null)}
      >
        <DialogContent className="max-w-[95vw] max-h-[95dvh] p-0 bg-black/95 border-none flex items-center justify-center">
          {lightboxIndex !== null && signedUrls[value[lightboxIndex]] && (
            <>
              <img
                src={signedUrls[value[lightboxIndex]]}
                alt={`Evidência ${lightboxIndex + 1}`}
                className="max-w-full max-h-[85dvh] object-contain"
              />
              {value.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-2 top-1/2 -translate-y-1/2 h-12 w-12 bg-black/50 text-white hover:bg-black/70 touch-manipulation"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxIndex(
                        (lightboxIndex - 1 + value.length) % value.length,
                      );
                    }}
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-12 w-12 bg-black/50 text-white hover:bg-black/70 touch-manipulation"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxIndex((lightboxIndex + 1) % value.length);
                    }}
                  >
                    <ChevronRight className="h-6 w-6" />
                  </Button>
                </>
              )}
              <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm bg-black/50 px-3 py-1 rounded-full">
                {lightboxIndex + 1} / {value.length}
              </span>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
