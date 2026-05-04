import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Camera, Plus, Trash2, X, Loader2, ImageIcon, Box } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { useProject } from "@/contexts/ProjectContext";
import { useUserRole } from "@/hooks/useUserRole";
import { PageHeader } from "@/components/layout/PageHeader";
import { useProject3DPhotos, Project3DPhoto } from "@/hooks/useProject3DPhotos";
import { cn } from "@/lib/utils";

const Projeto3D = () => {
  const { projectId } = useParams();
  const { paths } = useProjectNavigation();
  const { project, loading: projectLoading, error: projectError } = useProject();
  const { isStaff } = useUserRole();
  const {
    photos,
    isLoading,
    upload,
    isUploading,
    deletePhoto,
    updateCaption,
  } = useProject3DPhotos(projectId);

  const fileRef = useRef<HTMLInputElement>(null);
  const [lightbox, setLightbox] = useState<Project3DPhoto | null>(null);
  const [editingCaption, setEditingCaption] = useState<string | null>(null);
  const [captionValue, setCaptionValue] = useState("");

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    await upload(files);
    if (fileRef.current) fileRef.current.value = "";
  };

  const startEditCaption = (photo: Project3DPhoto) => {
    setEditingCaption(photo.id);
    setCaptionValue(photo.caption || "");
  };

  const saveCaption = (id: string) => {
    updateCaption({ id, caption: captionValue });
    setEditingCaption(null);
  };

  if (projectLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (projectError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">{projectError}</p>
          <Link to="/minhas-obras" className="text-primary underline">Voltar</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] pb-safe bg-background flex flex-col">
      <PageHeader
        title="Projeto 3D"
        backTo={paths.relatorio}
        breadcrumbs={[
          { label: "Minhas Obras", href: "/minhas-obras" },
          { label: project?.name || "Obra", href: paths.relatorio },
          { label: "Projeto 3D" },
        ]}
      >
        {isStaff && (
          <Button
            size="sm"
            className="gap-2 h-9"
            onClick={() => fileRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">{isUploading ? "Enviando..." : "Adicionar fotos"}</span>
          </Button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFiles}
        />
      </PageHeader>

      <div className="flex-1 p-2 sm:p-4 md:p-6 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="bg-card rounded-xl border border-border shadow-sm">
            <div className="flex items-center gap-3 p-4 border-b border-border">
              <div className="shrink-0 w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <Camera className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-foreground">Galeria do Projeto 3D</h2>
                <p className="text-xs text-muted-foreground">
                  {photos.length > 0
                    ? `${photos.length} ${photos.length === 1 ? "foto" : "fotos"}`
                    : "Imagens e renders do projeto 3D"}
                </p>
              </div>
            </div>

            <div className="p-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : photos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                    {isStaff ? (
                      <ImageIcon className="h-7 w-7 text-muted-foreground/50" />
                    ) : (
                      <Box className="h-7 w-7 text-muted-foreground/50" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {isStaff ? "Nenhuma foto ainda" : "Galeria em breve"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {isStaff
                        ? "Clique em Adicionar fotos para enviar imagens do Projeto 3D."
                        : "As imagens do Projeto 3D serão disponibilizadas em breve."}
                    </p>
                  </div>
                  {isStaff && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 mt-2"
                      onClick={() => fileRef.current?.click()}
                      disabled={isUploading}
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar fotos
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {photos.map((photo) => (
                    <div
                      key={photo.id}
                      className="group relative aspect-square rounded-lg overflow-hidden border border-border bg-muted cursor-pointer"
                      onClick={() => setLightbox(photo)}
                    >
                      <img
                        src={photo.url}
                        alt={photo.caption || "Foto do Projeto 3D"}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        loading="lazy"
                      />
                      {isStaff && (
                        <button
                          className="absolute top-1.5 right-1.5 bg-background/80 backdrop-blur-sm rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            deletePhoto(photo);
                          }}
                          aria-label="Remover foto"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </button>
                      )}
                      {photo.caption && (
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                          <p className="text-[11px] text-white line-clamp-2">{photo.caption}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      <Dialog open={!!lightbox} onOpenChange={(open) => !open && setLightbox(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-background">
          <DialogTitle className="sr-only">Visualizar foto do Projeto 3D</DialogTitle>
          {lightbox && (
            <div className="flex flex-col">
              <img
                src={lightbox.url}
                alt={lightbox.caption || "Foto"}
                className="w-full max-h-[75vh] object-contain bg-black"
              />
              <div className="p-4 space-y-2">
                {isStaff && editingCaption === lightbox.id ? (
                  <div className="flex gap-2">
                    <Input
                      value={captionValue}
                      onChange={(e) => setCaptionValue(e.target.value)}
                      placeholder="Legenda da foto..."
                      className="h-9 text-sm"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      className="h-9"
                      onClick={() => {
                        saveCaption(lightbox.id);
                        setLightbox({ ...lightbox, caption: captionValue });
                      }}
                    >
                      Salvar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9"
                      onClick={() => setEditingCaption(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <p
                    className={cn(
                      "text-sm transition-colors",
                      isStaff && "cursor-pointer hover:text-primary",
                      !lightbox.caption && "text-muted-foreground italic"
                    )}
                    onClick={() => isStaff && startEditCaption(lightbox)}
                  >
                    {lightbox.caption || (isStaff ? "Clique para adicionar legenda..." : "Sem legenda")}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {new Date(lightbox.created_at).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Projeto3D;
