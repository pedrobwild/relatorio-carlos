import { useState, useCallback, useEffect, useRef } from "react";
import { GalleryPhoto } from "@/types/weeklyReport";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { X, ChevronLeft, ChevronRight, Play } from "lucide-react";

const isVideoUrl = (url: string) => {
  if (!url) return false;
  const lower = url.toLowerCase().split("?")[0];
  return (
    lower.endsWith(".mp4") ||
    lower.endsWith(".mov") ||
    lower.endsWith(".webm") ||
    lower.endsWith(".quicktime") ||
    lower.includes("video/")
  );
};
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { cn } from "@/lib/utils";

interface PhotoGalleryProps {
  photos: GalleryPhoto[];
}

const PhotoGallery = ({ photos }: PhotoGalleryProps) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const handlePrevious = useCallback(() => {
    if (selectedIndex !== null && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    }
  }, [selectedIndex]);

  const handleNext = useCallback(() => {
    if (selectedIndex !== null && selectedIndex < photos.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    }
  }, [selectedIndex, photos.length]);

  // Keyboard navigation
  useEffect(() => {
    if (selectedIndex === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handlePrevious();
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "Escape") setSelectedIndex(null);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedIndex, handlePrevious, handleNext]);

  // Swipe handlers
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };
  const onTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0) handleNext();
      else handlePrevious();
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  if (photos.length === 0) return null;

  const _firstPhotos = photos.slice(0, 4);
  const _remainingPhotos = photos.slice(4);

  const PhotoItem = ({
    photo,
    index,
    animationDelay = 0,
  }: {
    photo: GalleryPhoto;
    index: number;
    animationDelay?: number;
  }) => (
    <button
      onClick={() => setSelectedIndex(index)}
      className="group relative aspect-[4/3] rounded-lg overflow-hidden bg-muted min-h-0"
      style={{
        animationDelay: `${animationDelay}ms`,
        animation:
          animationDelay > 0 ? "fade-in 0.3s ease-out forwards" : undefined,
        opacity: animationDelay > 0 ? 0 : 1,
      }}
    >
      {isVideoUrl(photo.url) ? (
        <>
          <video
            src={`${photo.url}#t=0.5`}
            preload="metadata"
            muted
            playsInline
            disablePictureInPicture
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
          />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black/60 rounded-full p-2">
              <Play className="w-5 h-5 text-white fill-white" />
            </div>
          </div>
        </>
      ) : (
        <img
          src={photo.url}
          alt={photo.caption}
          loading="lazy"
          className="w-full h-full object-cover transition-transform group-hover:scale-105"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-1.5">
        <p className="text-tiny font-medium text-white line-clamp-2">
          {photo.caption}
        </p>
      </div>
    </button>
  );

  // Mobile: horizontal carousel of thumbnails
  const MobileCarousel = () => (
    <div className="overflow-x-auto scrollbar-hide">
      <div className="flex gap-2 p-2.5 w-max">
        {photos.map((photo, index) => (
          <button
            key={photo.id}
            onClick={() => setSelectedIndex(index)}
            className="relative w-28 h-20 rounded-lg overflow-hidden bg-muted shrink-0"
          >
            {isVideoUrl(photo.url) ? (
              <>
                <video
                  src={`${photo.url}#t=0.5`}
                  preload="metadata"
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-black/60 rounded-full p-1">
                    <Play className="w-3.5 h-3.5 text-white fill-white" />
                  </div>
                </div>
              </>
            ) : (
              <img
                src={photo.url}
                alt={photo.caption}
                loading="lazy"
                className="w-full h-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <p className="absolute bottom-1 left-1.5 right-1.5 text-[10px] font-medium text-white line-clamp-1">
              {photo.caption}
            </p>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="px-3 py-2.5 sm:px-4 sm:py-3 border-b border-border">
        <h3 className="text-h2">
          Galeria de Fotos{" "}
          <span className="text-caption font-normal">({photos.length})</span>
        </h3>
      </div>

      {/* Desktop: Grid */}
      <div className="hidden sm:block p-2.5 sm:p-3">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {photos.map((photo, index) => (
            <PhotoItem key={photo.id} photo={photo} index={index} />
          ))}
        </div>
      </div>

      {/* Mobile: Horizontal carousel */}
      <div className="sm:hidden">
        <MobileCarousel />
      </div>

      {/* Fullscreen Dialog with swipe */}
      <Dialog
        open={selectedIndex !== null}
        onOpenChange={() => setSelectedIndex(null)}
      >
        <DialogContent className="max-w-4xl sm:max-w-4xl w-[100dvw] sm:w-auto h-[100dvh] sm:h-auto max-h-[100dvh] sm:max-h-[95dvh] p-0 bg-black/95 border-none rounded-none sm:rounded-lg">
          <VisuallyHidden>
            <DialogTitle>
              {selectedIndex !== null ? photos[selectedIndex].caption : "Foto"}
            </DialogTitle>
          </VisuallyHidden>

          {selectedIndex !== null && (
            <div
              className="relative h-full flex flex-col"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              {/* Top bar */}
              <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-3">
                <span className="text-white/60 text-xs tabular-nums">
                  {selectedIndex + 1} / {photos.length}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20 h-11 w-11"
                  onClick={() => setSelectedIndex(null)}
                  aria-label="Fechar"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Navigation arrows - hidden on mobile (use swipe) */}
              {selectedIndex > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20 h-11 w-11"
                  onClick={handlePrevious}
                  aria-label="Foto anterior"
                >
                  <ChevronLeft className="w-6 h-6" />
                </Button>
              )}
              {selectedIndex < photos.length - 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20 h-11 w-11"
                  onClick={handleNext}
                  aria-label="Próxima foto"
                >
                  <ChevronRight className="w-6 h-6" />
                </Button>
              )}

              {/* Image / Video */}
              <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
                {isVideoUrl(photos[selectedIndex].url) ? (
                  <video
                    src={photos[selectedIndex].url}
                    controls
                    autoPlay
                    playsInline
                    className="max-w-full max-h-[70dvh] sm:max-h-[70vh] rounded"
                  />
                ) : (
                  <img
                    src={photos[selectedIndex].url}
                    alt={photos[selectedIndex].caption}
                    className="max-w-full max-h-[70dvh] sm:max-h-[70vh] object-contain rounded"
                  />
                )}
              </div>

              {/* Caption bar */}
              <div className="p-4 bg-gradient-to-t from-black to-transparent">
                <p className="text-white text-caption font-medium">
                  {photos[selectedIndex].caption}
                </p>
                <p className="text-white/70 text-tiny">
                  {[
                    photos[selectedIndex].area,
                    photos[selectedIndex].category,
                    (() => {
                      try {
                        const d = new Date(photos[selectedIndex].date);
                        return isNaN(d.getTime())
                          ? null
                          : format(d, "dd/MM/yyyy", { locale: ptBR });
                      } catch {
                        return null;
                      }
                    })(),
                  ]
                    .filter(Boolean)
                    .join(" • ")}
                </p>
              </div>

              {/* Mobile thumbnail strip */}
              <div className="sm:hidden overflow-x-auto scrollbar-hide border-t border-white/10">
                <div className="flex gap-1 p-2 w-max">
                  {photos.map((photo, i) => (
                    <button
                      key={photo.id}
                      onClick={() => setSelectedIndex(i)}
                      className={cn(
                        "w-12 h-12 rounded overflow-hidden shrink-0 border-2 transition-all",
                        i === selectedIndex
                          ? "border-primary opacity-100"
                          : "border-transparent opacity-50",
                      )}
                    >
                      {isVideoUrl(photo.url) ? (
                        <video
                          src={`${photo.url}#t=0.5`}
                          preload="metadata"
                          muted
                          playsInline
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <img
                          src={photo.url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PhotoGallery;
