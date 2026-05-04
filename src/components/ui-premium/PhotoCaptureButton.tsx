import * as React from "react";
import { Camera, Loader2, RotateCw, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export interface CapturedPhoto {
  /** Compressed file ready for upload. */
  file: File;
  /** Object URL for previewing — caller MUST revoke when discarded. */
  previewUrl: string;
}

export interface PhotoCaptureButtonProps {
  /**
   * Called once per accepted photo. The component owns previews until the
   * user confirms/cancels — caller only sees `CapturedPhoto[]` on submit.
   */
  onCapture: (photos: CapturedPhoto[]) => void | Promise<void>;
  /** Allow taking several photos in sequence before submitting. */
  multiple?: boolean;
  /** Hide compression details and use rawer defaults (e.g. avatar uploads). */
  compressionOptions?: {
    maxSizeMB?: number;
    maxWidthOrHeight?: number;
    useWebWorker?: boolean;
    initialQuality?: number;
  };
  /** Button label (defaults: PT-BR). */
  label?: string;
  /** Override variant (default: outline). */
  variant?: "default" | "outline" | "secondary" | "ghost";
  /** Disabled state. */
  disabled?: boolean;
  /** Force capture mode regardless of breakpoint (useful for desktop too). */
  alwaysCapture?: boolean;
  className?: string;
}

const DEFAULT_COMPRESSION = {
  maxSizeMB: 0.6,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  initialQuality: 0.82,
};

async function compressPhoto(file: File, options: typeof DEFAULT_COMPRESSION): Promise<File> {
  try {
    const mod = await import("browser-image-compression");
    return await mod.default(file, options);
  } catch {
    return file;
  }
}

/**
 * PhotoCaptureButton — opens the device camera (rear, when available) on
 * mobile, falls back to a regular file picker on desktop. Compresses each
 * photo client-side via `browser-image-compression` (lazy-loaded — only
 * fetched when the user actually picks a file). Previews accepted photos
 * with `Refazer` / `Remover` controls before handing them off to `onCapture`.
 */
export function PhotoCaptureButton({
  onCapture,
  multiple = false,
  compressionOptions,
  label,
  variant = "outline",
  disabled = false,
  alwaysCapture = false,
  className,
}: PhotoCaptureButtonProps) {
  const isMobile = useIsMobile();
  const useCamera = alwaysCapture || isMobile;
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [pending, setPending] = React.useState<CapturedPhoto[]>([]);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const compression = { ...DEFAULT_COMPRESSION, ...compressionOptions };
  const buttonLabel = label ?? (useCamera ? "Tirar foto" : "Selecionar foto");

  React.useEffect(() => {
    return () => {
      pending.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
  }, [pending]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    setIsProcessing(true);
    try {
      const next: CapturedPhoto[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        const compressed = await compressPhoto(file, compression);
        next.push({
          file: compressed,
          previewUrl: URL.createObjectURL(compressed),
        });
      }
      setPending((prev) => (multiple ? [...prev, ...next] : next));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao processar a imagem");
    } finally {
      setIsProcessing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removePending = (index: number) => {
    setPending((prev) => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
  };

  const submit = async () => {
    if (pending.length === 0) return;
    await onCapture(pending);
    setPending([]);
  };

  const triggerPicker = () => inputRef.current?.click();

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        {...(useCamera ? { capture: "environment" as const } : {})}
        multiple={multiple}
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={disabled || isProcessing}
      />

      {pending.length === 0 && (
        <Button
          type="button"
          variant={variant}
          onClick={triggerPicker}
          disabled={disabled || isProcessing}
          className="min-h-[44px] text-base"
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : useCamera ? (
            <Camera className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Upload className="h-4 w-4" aria-hidden="true" />
          )}
          <span>{buttonLabel}</span>
        </Button>
      )}

      {pending.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-3 space-y-3">
          <ul className="grid grid-cols-3 gap-2">
            {pending.map((photo, idx) => (
              <li key={photo.previewUrl} className="relative aspect-square overflow-hidden rounded-md bg-muted">
                <img
                  src={photo.previewUrl}
                  alt={`Foto ${idx + 1}`}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removePending(idx)}
                  className="absolute top-1 right-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-background/90 text-destructive shadow-sm hover:bg-background"
                  aria-label={`Remover foto ${idx + 1}`}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={triggerPicker}
              disabled={disabled || isProcessing}
              className="min-h-[44px]"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <RotateCw className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{multiple ? "Adicionar" : "Refazer"}</span>
            </Button>

            <Button
              type="button"
              onClick={submit}
              disabled={disabled || isProcessing}
              className="min-h-[44px] flex-1"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              <span>
                {multiple
                  ? `Enviar ${pending.length} foto${pending.length > 1 ? "s" : ""}`
                  : "Enviar foto"}
              </span>
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
