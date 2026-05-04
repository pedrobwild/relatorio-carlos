import { GalleryPhoto } from "@/types/weeklyReport";
import { Camera, Plus, Trash2, X, Image, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface GallerySectionProps {
  photos: GalleryPhoto[];
  onAdd: () => void;
  onUpdate: (index: number, field: keyof GalleryPhoto, value: string) => void;
  onRemove: (index: number) => void;
  onFileSelect: (
    index: number,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => void;
  onBulkFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const GallerySection = ({
  photos,
  onAdd,
  onUpdate,
  onRemove,
  onFileSelect,
  onBulkFileSelect,
}: GallerySectionProps) => (
  <AccordionItem
    value="gallery"
    className="bg-card border border-border rounded-lg overflow-hidden"
  >
    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
      <div className="flex items-center gap-2">
        <Camera className="w-4 h-4 text-[hsl(var(--success))]" />
        <span className="font-semibold">Fotos e Vídeos ({photos.length})</span>
      </div>
    </AccordionTrigger>
    <AccordionContent className="px-4 pb-4 space-y-3">
      <p className="text-sm text-muted-foreground mb-2">
        Anexe fotos e vídeos do progresso da obra nesta semana.
      </p>
      {photos.map((photo, index) => (
        <Card key={photo.id} className="border-muted">
          <CardContent className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                Mídia {index + 1}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="min-h-[44px] min-w-[44px] h-11 w-11"
                onClick={() => onRemove(index)}
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Arquivo</Label>
              {photo.url ? (
                <div className="relative">
                  {photo.url.includes("video") ||
                  photo.url.endsWith(".mp4") ||
                  photo.url.endsWith(".mov") ? (
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                      <video
                        src={photo.url}
                        className="w-full h-full object-cover"
                        controls
                      />
                    </div>
                  ) : (
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                      <img
                        src={photo.url}
                        alt={photo.caption || "Preview"}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6"
                    onClick={() => onUpdate(index, "url", "")}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
                    onChange={(e) => onFileSelect(index, e)}
                    className="hidden"
                    id={`file-${photo.id}`}
                  />
                  <label
                    htmlFor={`file-${photo.id}`}
                    className="flex flex-col items-center gap-2 cursor-pointer"
                  >
                    <div className="flex gap-2">
                      <Image className="w-6 h-6 text-muted-foreground" />
                      <Video className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <span className="text-sm text-muted-foreground text-center">
                      Clique para selecionar foto ou vídeo
                    </span>
                    <span className="text-xs text-muted-foreground/70">
                      JPG, PNG, WEBP, MP4, MOV (máx. 50MB)
                    </span>
                  </label>
                </div>
              )}
            </div>

            {!photo.url && (
              <div>
                <Label className="text-xs">Ou cole a URL da imagem/vídeo</Label>
                <Input
                  placeholder="https://..."
                  value={photo.url}
                  onChange={(e) => onUpdate(index, "url", e.target.value)}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Área/Ambiente</Label>
                <Input
                  placeholder="Ex: Cozinha, Sala, Banheiro..."
                  value={photo.area}
                  onChange={(e) => onUpdate(index, "area", e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Data</Label>
                <Input
                  type="date"
                  value={photo.date}
                  onChange={(e) => onUpdate(index, "date", e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Legenda</Label>
              <Input
                placeholder="Descreva o que aparece na foto/vídeo"
                value={photo.caption}
                onChange={(e) => onUpdate(index, "caption", e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Categoria</Label>
              <Select
                value={photo.category}
                onValueChange={(v) => onUpdate(index, "category", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="progresso">Progresso</SelectItem>
                  <SelectItem value="antes">Antes</SelectItem>
                  <SelectItem value="depois">Depois</SelectItem>
                  <SelectItem value="problema">Problema</SelectItem>
                  <SelectItem value="solução">Solução</SelectItem>
                  <SelectItem value="material">Material</SelectItem>
                  <SelectItem value="equipe">Equipe</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      ))}
      <div className="flex gap-2">
        <Button variant="outline" onClick={onAdd} className="flex-1">
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Manualmente
        </Button>
        <div className="flex-1">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
            multiple
            onChange={onBulkFileSelect}
            className="hidden"
            id="bulk-file-upload"
          />
          <label htmlFor="bulk-file-upload" className="w-full">
            <Button variant="default" asChild className="w-full cursor-pointer">
              <span>
                <Camera className="w-4 h-4 mr-2" />
                Enviar Múltiplas Fotos
              </span>
            </Button>
          </label>
        </div>
      </div>
    </AccordionContent>
  </AccordionItem>
);

export default GallerySection;
