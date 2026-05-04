import { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2, ImageIcon } from "lucide-react";
import { use3DImages } from "@/hooks/use3DVersions";
import { ImageWithComments } from "./ImageWithComments";

interface Props {
  versionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CarouselModal({ versionId, open, onOpenChange }: Props) {
  const { data: images, isLoading } = use3DImages(versionId);
  const [currentIndex, setCurrentIndex] = useState(0);

  const total = images?.length ?? 0;
  const currentImage = images?.[currentIndex];

  // Reset index when version changes or images load
  useEffect(() => {
    setCurrentIndex(0);
  }, [versionId]);

  // Clamp index if images shrink
  useEffect(() => {
    if (total > 0 && currentIndex >= total) {
      setCurrentIndex(total - 1);
    }
  }, [total, currentIndex]);

  const handlePrev = useCallback(() => {
    setCurrentIndex((i) => (i > 0 ? i - 1 : total - 1));
  }, [total]);

  const handleNext = useCallback(() => {
    setCurrentIndex((i) => (i < total - 1 ? i + 1 : 0));
  }, [total]);

  // Keyboard navigation: ← → ESC
  useEffect(() => {
    if (!open || total <= 1) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, total, handlePrev, handleNext]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[95vw] w-[95vw] h-[95dvh] sm:h-[90vh] p-0 flex flex-col gap-0"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        aria-label="Carrossel de imagens do Projeto 3D"
      >
        <DialogHeader className="p-3 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-sm">
              Projeto 3D
              {total > 0 && (
                <span className="text-muted-foreground font-normal ml-2">
                  Imagem {currentIndex + 1} / {total}
                </span>
              )}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden relative flex items-center justify-center bg-muted/30">
          {isLoading ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : total === 0 ? (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <ImageIcon className="h-12 w-12 opacity-30" />
              <p className="text-sm">Nenhuma imagem nesta versão</p>
            </div>
          ) : currentImage ? (
            <>
              <ImageWithComments key={currentImage.id} image={currentImage} />

              {/* Navigation arrows */}
              {total > 1 && (
                <>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-20 rounded-full shadow-lg h-11 w-11"
                    onClick={handlePrev}
                    aria-label="Imagem anterior"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 z-20 rounded-full shadow-lg h-11 w-11"
                    onClick={handleNext}
                    aria-label="Próxima imagem"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </>
              )}
            </>
          ) : null}
        </div>

        {/* Thumbnails */}
        {total > 1 && (
          <div className="border-t border-border p-2 shrink-0 bg-card">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {images?.map((img, idx) => (
                <button
                  key={img.id}
                  onClick={() => setCurrentIndex(idx)}
                  aria-label={`Miniatura ${idx + 1}`}
                  aria-current={idx === currentIndex ? "true" : undefined}
                  className={`shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 transition-colors ${
                    idx === currentIndex
                      ? "border-primary"
                      : "border-transparent hover:border-muted-foreground/30"
                  }`}
                >
                  <img
                    src={img.url}
                    alt={`Miniatura ${idx + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
