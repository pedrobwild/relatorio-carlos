/**
 * PhotoCaptureButton — captura foto direto da câmera traseira em mobile.
 *
 * - Usa `<input type="file" accept="image/*" capture="environment">`. No
 *   Android/iOS isso abre a câmera traseira nativamente; no desktop cai
 *   no seletor padrão de arquivo.
 * - Suporta múltiplas fotos (atributo `multiple`). Em iOS o usuário pode
 *   tirar várias em sequência sem fechar a câmera.
 * - Comprime client-side com `browser-image-compression` (lazy-loaded —
 *   só baixa a lib quando o usuário escolhe a primeira foto).
 * - Preview imediato com opção "Refazer" antes de confirmar o envio.
 *
 * O componente é "headless até o ponto de upload": ele entrega `File[]`
 * já comprimidos via `onCapture`. Quem chama decide o que fazer
 * (subir pro storage, anexar a um form, etc).
 */
import * as React from 'react';
import { Camera, X, RotateCcw, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface PhotoCaptureButtonProps {
  /** Callback chamado com os arquivos finais (já comprimidos). */
  onCapture: (files: File[]) => void | Promise<void>;
  /** Permite múltiplas fotos. Default: true. */
  multiple?: boolean;
  /** Compressão. Default: ativada com targets de canteiro de obra. */
  compression?: {
    enabled?: boolean;
    /** Tamanho máximo em MB pós-compressão. Default 0.6 (≈600KB). */
    maxSizeMB?: number;
    /** Maior dimensão (largura ou altura) em px. Default 1920. */
    maxWidthOrHeight?: number;
  };
  /** Label do botão (default: "Tirar foto"). */
  label?: React.ReactNode;
  /** Variante do botão. */
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  /** Tamanho do botão. */
  size?: 'default' | 'sm' | 'lg';
  className?: string;
  disabled?: boolean;
}

interface PreviewItem {
  file: File;
  url: string;
}

const DEFAULT_COMPRESSION = {
  enabled: true,
  maxSizeMB: 0.6,
  maxWidthOrHeight: 1920,
} as const;

async function compressImages(files: File[], opts: Required<NonNullable<PhotoCaptureButtonProps['compression']>>) {
  if (!opts.enabled) return files;

  // Lazy-load: a lib (~30KB gzip) só é baixada quando o usuário escolhe a foto.
  const { default: imageCompression } = await import('browser-image-compression');

  const results = await Promise.all(
    files.map(async (file) => {
      // Não comprime se já estiver dentro do alvo, evita re-encode lossy.
      if (file.size <= opts.maxSizeMB * 1024 * 1024) return file;
      try {
        return await imageCompression(file, {
          maxSizeMB: opts.maxSizeMB,
          maxWidthOrHeight: opts.maxWidthOrHeight,
          useWebWorker: true,
        });
      } catch (err) {
        // Falha na compressão não impede o envio — devolve o original.
        console.warn('[PhotoCapture] compression failed, using original', err);
        return file;
      }
    }),
  );
  return results;
}

export function PhotoCaptureButton({
  onCapture,
  multiple = true,
  compression,
  label,
  variant = 'default',
  size = 'default',
  className,
  disabled,
}: PhotoCaptureButtonProps) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [previews, setPreviews] = React.useState<PreviewItem[]>([]);
  const [processing, setProcessing] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);

  const compressionOpts = React.useMemo(
    () => ({ ...DEFAULT_COMPRESSION, ...compression }),
    [compression],
  );

  const reset = React.useCallback(() => {
    previews.forEach((p) => URL.revokeObjectURL(p.url));
    setPreviews([]);
    if (inputRef.current) inputRef.current.value = '';
  }, [previews]);

  React.useEffect(() => {
    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list || list.length === 0) return;
    const incoming = Array.from(list);

    setProcessing(true);
    try {
      const compressed = await compressImages(incoming, compressionOpts);
      const items = compressed.map((file) => ({
        file,
        url: URL.createObjectURL(file),
      }));
      setPreviews((prev) => [...prev, ...items]);
    } finally {
      setProcessing(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const removeAt = (idx: number) => {
    setPreviews((prev) => {
      const next = [...prev];
      const removed = next.splice(idx, 1)[0];
      if (removed) URL.revokeObjectURL(removed.url);
      return next;
    });
  };

  const confirm = async () => {
    if (previews.length === 0) return;
    setConfirming(true);
    try {
      await onCapture(previews.map((p) => p.file));
      reset();
    } finally {
      setConfirming(false);
    }
  };

  const showPreviewPanel = previews.length > 0;

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple={multiple}
        className="sr-only"
        onChange={handleChange}
        data-testid="photo-capture-input"
      />
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={disabled || processing || confirming}
        onClick={() => inputRef.current?.click()}
        className="min-h-[44px] gap-2"
      >
        {processing ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Camera className="h-4 w-4" aria-hidden />
        )}
        {label ?? (showPreviewPanel ? 'Tirar outra foto' : 'Tirar foto')}
      </Button>

      {showPreviewPanel && (
        <div
          role="region"
          aria-label="Pré-visualização das fotos"
          className="rounded-lg border border-border-subtle bg-surface p-3"
        >
          <div className="grid grid-cols-3 gap-2">
            {previews.map((preview, idx) => (
              <div
                key={preview.url}
                className="relative aspect-square overflow-hidden rounded-md border border-border-subtle bg-muted"
              >
                <img
                  src={preview.url}
                  alt={`Foto ${idx + 1}`}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  aria-label={`Remover foto ${idx + 1}`}
                  onClick={() => removeAt(idx)}
                  className="absolute right-1 top-1 inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/90 text-foreground shadow ring-1 ring-border-subtle hover:bg-background"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={reset}
              disabled={confirming}
              className="min-h-[44px] gap-1.5"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              Refazer
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={confirm}
              disabled={confirming || previews.length === 0}
              className="min-h-[44px] gap-1.5"
            >
              {confirming ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Check className="h-4 w-4" aria-hidden />
              )}
              Confirmar {previews.length} foto{previews.length === 1 ? '' : 's'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
