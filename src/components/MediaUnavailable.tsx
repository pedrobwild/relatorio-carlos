import { ImageOff } from "lucide-react";

/**
 * Placeholder mostrado quando uma imagem/vídeo falha ao carregar (signed URL
 * expirada, RLS bloqueando, path inválido). Substitui o ícone de imagem
 * quebrada do navegador por um feedback claro. Usar dentro de um container
 * `relative` (cobre via inset-0).
 */
export function MediaUnavailable({ compact = false }: { compact?: boolean }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-muted text-muted-foreground p-2 text-center">
      <ImageOff className={compact ? "w-4 h-4" : "w-6 h-6"} />
      {!compact && (
        <span className="text-tiny">Mídia indisponível — recarregue</span>
      )}
    </div>
  );
}
