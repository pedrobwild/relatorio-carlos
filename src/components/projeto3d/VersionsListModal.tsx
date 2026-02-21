import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, ImageIcon, Loader2, Upload, X, Eye } from 'lucide-react';
import { use3DVersions, type Version3D } from '@/hooks/use3DVersions';
import { useUserRole } from '@/hooks/useUserRole';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { CarouselModal } from './CarouselModal';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VersionsListModal({ projectId, open, onOpenChange }: Props) {
  const { versions, loading, createVersion, isCreating } = use3DVersions(projectId);
  const { isStaff } = useUserRole();
  const [uploadMode, setUploadMode] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [carouselVersionId, setCarouselVersionId] = useState<string | null>(null);
  const [imageCountsCache, setImageCountsCache] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load image counts for versions
  const loadImageCounts = async () => {
    if (versions.length === 0) return;
    const ids = versions.map(v => v.id);
    const { data } = await supabase
      .from('project_3d_images')
      .select('version_id')
      .in('version_id', ids);
    if (data) {
      const counts: Record<string, number> = {};
      data.forEach((row: any) => {
        counts[row.version_id] = (counts[row.version_id] || 0) + 1;
      });
      setImageCountsCache(counts);
    }
  };

  // Load counts when versions change
  if (open && versions.length > 0 && Object.keys(imageCountsCache).length === 0) {
    loadImageCounts();
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const invalid = files.filter(f => f.type !== 'image/png');
    if (invalid.length > 0) {
      toast.error('Apenas arquivos .png são aceitos');
      return;
    }
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Selecione ao menos uma imagem .png');
      return;
    }
    await createVersion(selectedFiles);
    setSelectedFiles([]);
    setUploadMode(false);
    setImageCountsCache({});
  };

  return (
    <>
      <Dialog open={open && !carouselVersionId} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg w-[95vw] max-h-[85vh] flex flex-col gap-0 p-0">
          <DialogHeader className="p-4 border-b border-border shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base">Versões do Projeto 3D</DialogTitle>
              {isStaff && !uploadMode && (
                <Button size="sm" onClick={() => setUploadMode(true)} className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Nova versão
                </Button>
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* Upload Mode */}
            {uploadMode && (
              <div className="border-2 border-dashed border-primary/30 rounded-lg p-4 space-y-3 bg-primary/5">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">Upload de imagens (.png)</h4>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setUploadMode(false); setSelectedFiles([]); }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".png,image/png"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />

                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  Selecionar imagens .png
                </Button>

                {selectedFiles.length > 0 && (
                  <div className="space-y-1.5">
                    {selectedFiles.map((file, i) => (
                      <div key={i} className="flex items-center justify-between bg-card rounded px-3 py-2 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="truncate">{file.name}</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleRemoveFile(i)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    <Button onClick={handleUpload} disabled={isCreating} className="w-full gap-2 mt-2">
                      {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      {isCreating ? 'Enviando...' : `Criar versão com ${selectedFiles.length} imagen${selectedFiles.length > 1 ? 's' : ''}`}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Versions list */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : versions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ImageIcon className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">Nenhuma versão cadastrada</p>
                {isStaff && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Clique em "Nova versão" para começar
                  </p>
                )}
              </div>
            ) : (
              versions.map((version) => (
                <div
                  key={version.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/80 transition-colors"
                >
                  <div>
                    <p className="font-medium text-sm">Versão {version.version_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(version.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      {imageCountsCache[version.id] != null && (
                        <> • {imageCountsCache[version.id]} imagen{imageCountsCache[version.id] !== 1 ? 's' : ''}</>
                      )}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setCarouselVersionId(version.id)}
                  >
                    <Eye className="h-4 w-4" />
                    Abrir
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Carousel Modal */}
      {carouselVersionId && (
        <CarouselModal
          versionId={carouselVersionId}
          open={!!carouselVersionId}
          onOpenChange={(open) => {
            if (!open) setCarouselVersionId(null);
          }}
        />
      )}
    </>
  );
}
