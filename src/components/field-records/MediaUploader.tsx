/**
 * Upload de mídia (foto / vídeo) para Field Records.
 *
 * Dois pontos de entrada:
 *  - "Galeria" (input file padrão) — permite escolher múltiplos.
 *  - "Câmera" (input com `capture="environment"`) — abre a câmera traseira
 *    diretamente em devices mobile.
 *
 * O componente é "controlled": recebe `files` (array de FieldRecordMedia)
 * e devolve via `onChange`. Não faz upload — quem persiste é o consumidor
 * (CreateNcDialog faz upload pra Supabase Storage; outras kinds podem ter
 * destinos diferentes).
 *
 * Os object URLs são revogados ao desmontar para evitar leaks.
 */
import { useCallback, useEffect, useRef } from 'react';
import { Camera, ImagePlus, Film, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { FieldRecordMedia } from './types';

const ACCEPT = 'image/*,video/*';

interface MediaUploaderProps {
  files: FieldRecordMedia[];
  onChange: (files: FieldRecordMedia[]) => void;
  /** Limite máximo de bytes por arquivo. Default 20MB. */
  maxFileSize?: number;
  /** Limite máximo de arquivos. Opcional. */
  maxFiles?: number;
  label?: string;
  className?: string;
  /** Callback quando arquivo é rejeitado (tamanho/tipo). */
  onReject?: (file: File, reason: 'size' | 'limit') => void;
}

export function buildMedia(file: File): FieldRecordMedia {
  return {
    file,
    previewUrl: URL.createObjectURL(file),
    type: file.type.startsWith('video/') ? 'video' : 'image',
  };
}

export function MediaUploader({
  files,
  onChange,
  maxFileSize = 20 * 1024 * 1024,
  maxFiles,
  label = 'Mídia',
  className,
  onReject,
}: MediaUploaderProps) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  // Revoga URLs ao desmontar.
  useEffect(() => {
    return () => {
      files.forEach((m) => URL.revokeObjectURL(m.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const list = Array.from(incoming);
      const accepted: FieldRecordMedia[] = [];
      list.forEach((file) => {
        if (file.size > maxFileSize) {
          onReject?.(file, 'size');
          return;
        }
        if (maxFiles != null && files.length + accepted.length >= maxFiles) {
          onReject?.(file, 'limit');
          return;
        }
        accepted.push(buildMedia(file));
      });
      if (accepted.length > 0) onChange([...files, ...accepted]);
    },
    [files, maxFileSize, maxFiles, onChange, onReject],
  );

  const handleRemove = (idx: number) => {
    const next = files.slice();
    const [removed] = next.splice(idx, 1);
    if (removed) URL.revokeObjectURL(removed.previewUrl);
    onChange(next);
  };

  return (
    <div className={cn('space-y-2', className)}>
      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => galleryRef.current?.click()}
          className="h-9 gap-1.5 text-xs"
        >
          <ImagePlus className="h-3.5 w-3.5" />
          Galeria
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => cameraRef.current?.click()}
          className="h-9 gap-1.5 text-xs"
        >
          <Camera className="h-3.5 w-3.5" />
          Câmera
        </Button>
        <input
          ref={galleryRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <input
          ref={cameraRef}
          type="file"
          accept={ACCEPT}
          capture="environment"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
        {maxFiles != null && (
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {files.length}/{maxFiles}
          </span>
        )}
      </div>

      {files.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {files.map((media, idx) => (
            <div
              key={`${media.previewUrl}-${idx}`}
              className="relative group aspect-square rounded-md overflow-hidden border border-border bg-muted"
            >
              {media.type === 'image' ? (
                <img
                  src={media.previewUrl}
                  alt={`Mídia ${idx + 1}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-muted-foreground bg-muted">
                  <Film className="h-6 w-6" />
                </div>
              )}
              <Button
                type="button"
                size="icon"
                variant="destructive"
                onClick={() => handleRemove(idx)}
                aria-label={`Remover ${media.file.name}`}
                className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
