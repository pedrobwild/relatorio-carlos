import { useState } from "react";
import { GalleryPhoto } from "@/types/weeklyReport";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { X, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface PhotoGalleryProps {
  photos: GalleryPhoto[];
}

const PhotoGallery = ({ photos }: PhotoGalleryProps) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const handlePrevious = () => {
    if (selectedIndex !== null && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    }
  };

  const handleNext = () => {
    if (selectedIndex !== null && selectedIndex < photos.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    }
  };

  if (photos.length === 0) return null;

  // Show first 4 photos on mobile, rest are collapsible
  const firstPhotos = photos.slice(0, 4);
  const remainingPhotos = photos.slice(4);

  const PhotoItem = ({ photo, index, animationDelay = 0 }: { photo: GalleryPhoto; index: number; animationDelay?: number }) => (
    <button
      onClick={() => setSelectedIndex(index)}
      className="group relative aspect-[4/3] rounded-lg overflow-hidden bg-muted min-h-0"
      style={{ 
        animationDelay: `${animationDelay}ms`,
        animation: animationDelay > 0 ? 'fade-in 0.3s ease-out forwards' : undefined,
        opacity: animationDelay > 0 ? 0 : 1
      }}
    >
      <img
        src={photo.url}
        alt={photo.caption}
        className="w-full h-full object-cover transition-transform group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-2">
        <p className="text-xs font-medium text-white line-clamp-2">{photo.caption}</p>
      </div>
    </button>
  );

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="p-4 sm:p-5 bg-primary-dark">
        <h3 className="text-sm sm:text-base font-semibold text-white">
          Galeria de Fotos <span className="text-xs font-normal text-white/70">({photos.length} fotos)</span>
        </h3>
      </div>
      
      {/* Desktop: Always show all photos */}
      <div className="hidden sm:block p-3 sm:p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
          {photos.map((photo, index) => (
            <PhotoItem key={photo.id} photo={photo} index={index} />
          ))}
        </div>
      </div>

      {/* Mobile: Collapsible content */}
      <div className="sm:hidden">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <div className="p-3">
            <div className="grid grid-cols-2 gap-2">
              {firstPhotos.map((photo, index) => (
                <PhotoItem key={photo.id} photo={photo} index={index} />
              ))}
              
              <CollapsibleContent className="col-span-2 overflow-hidden">
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {remainingPhotos.map((photo, index) => (
                    <PhotoItem key={photo.id} photo={photo} index={firstPhotos.length + index} animationDelay={isOpen ? (index + 1) * 50 : 0} />
                  ))}
                </div>
              </CollapsibleContent>
            </div>
          </div>
          
          {remainingPhotos.length > 0 && (
            <CollapsibleTrigger asChild>
              <button className="w-full py-3 px-4 border-t border-border flex items-center justify-center gap-2 text-xs font-medium text-primary hover:bg-primary/5 transition-colors">
                <span>{isOpen ? "Ver menos" : "Ver mais"}</span>
                {!isOpen && <span className="bg-primary/10 px-1.5 py-0.5 rounded-md text-[10px] font-semibold">+{remainingPhotos.length}</span>}
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
              </button>
            </CollapsibleTrigger>
          )}
        </Collapsible>
      </div>

      {/* Lightbox Modal */}
      <Dialog open={selectedIndex !== null} onOpenChange={() => setSelectedIndex(null)}>
        <DialogContent className="max-w-4xl p-0 bg-black/95 border-none">
          <VisuallyHidden>
            <DialogTitle>
              {selectedIndex !== null ? photos[selectedIndex].caption : "Foto"}
            </DialogTitle>
          </VisuallyHidden>
          
          {selectedIndex !== null && (
            <div className="relative">
              {/* Close Button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 z-10 text-white hover:bg-white/20"
                onClick={() => setSelectedIndex(null)}
              >
                <X className="w-5 h-5" />
              </Button>

              {/* Navigation */}
              {selectedIndex > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
                  onClick={handlePrevious}
                >
                  <ChevronLeft className="w-6 h-6" />
                </Button>
              )}
              {selectedIndex < photos.length - 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
                  onClick={handleNext}
                >
                  <ChevronRight className="w-6 h-6" />
                </Button>
              )}

              {/* Image */}
              <div className="flex items-center justify-center min-h-[60vh] p-8">
                <img
                  src={photos[selectedIndex].url}
                  alt={photos[selectedIndex].caption}
                  className="max-w-full max-h-[70vh] object-contain rounded"
                />
              </div>

              {/* Caption */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black to-transparent">
                <p className="text-white text-sm font-medium">{photos[selectedIndex].caption}</p>
                <p className="text-white/70 text-xs">
                  {photos[selectedIndex].area} • {photos[selectedIndex].category} • {format(new Date(photos[selectedIndex].date), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PhotoGallery;
