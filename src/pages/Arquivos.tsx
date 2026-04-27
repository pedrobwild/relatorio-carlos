/**
 * Arquivos Page
 * 
 * General file listing with inline preview for PDFs and images.
 * Staff-only page accessible from /gestao/arquivos.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Search, FileText, Image, Film, File, Eye, Download, Trash2, Archive, Filter } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { AppHeader } from '@/components/AppHeader';
import { ContentSkeleton } from '@/components/ContentSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DocumentViewer } from '@/components/DocumentViewer';
import { useFilesQuery, useDeleteFileMutation, useArchiveFileMutation } from '@/hooks/useFilesQuery';
import { useProjectsQuery } from '@/hooks/useProjectsQuery';
import { getSignedUrl, type FileMetadata } from '@/infra/repositories/files.repository';
import { matchesSearch } from '@/lib/searchNormalize';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// ---- helpers ----

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <Image className="h-5 w-5 text-primary" />;
  if (mimeType === 'application/pdf') return <FileText className="h-5 w-5 text-destructive" />;
  if (mimeType.startsWith('video/')) return <Film className="h-5 w-5 text-accent-foreground" />;
  return <File className="h-5 w-5 text-muted-foreground" />;
}

function canPreview(mimeType: string): boolean {
  return (
    mimeType === 'application/pdf' ||
    mimeType.startsWith('image/')
  );
}

const statusLabels: Record<string, string> = {
  active: 'Ativo',
  archived: 'Arquivado',
  deleted: 'Excluído',
};

const statusColors: Record<string, string> = {
  active: 'bg-green-500/10 text-green-600 border-green-500/20',
  archived: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  deleted: 'bg-red-500/10 text-red-600 border-red-500/20',
};

// ---- components ----

function FilePreviewModal({
  file,
  open,
  onOpenChange,
}: {
  file: FileMetadata | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch signed URL when modal opens
  const loadUrl = useCallback(async (f: FileMetadata) => {
    setLoading(true);
    try {
      const signedUrl = await getSignedUrl(f.bucket, f.storage_path);
      setUrl(signedUrl);
    } finally {
      setLoading(false);
    }
  }, []);

  // Reset on close / load on open
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setUrl(null);
        setLoading(false);
      }
      onOpenChange(open);
    },
    [onOpenChange]
  );

  // Trigger load when file changes via useEffect (not during render)
  useEffect(() => {
    if (open && file && !url && !loading) {
      loadUrl(file);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, file?.id]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] h-[90vh] p-0 flex flex-col rounded-xl">
        <DialogHeader className="p-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            {file && getFileIcon(file.mime_type)}
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base truncate">
                {file?.original_name}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {file && formatFileSize(file.size_bytes)} •{' '}
                {file && format(new Date(file.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : url && file ? (
            <DocumentViewer
              url={url}
              title={file.original_name}
              mimeType={file.mime_type}
              className="h-full rounded-none border-0"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Não foi possível carregar a pré-visualização
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---- main page ----

export default function Arquivos() {
  const { isStaff } = useUserRole();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'deleted'>('active');
  const [projectFilter, setProjectFilter] = useState<string | null>(null);

  const { data: files = [], isLoading } = useFilesQuery({ status: statusFilter });
  const { data: projects = [] } = useProjectsQuery();
  const deleteMutation = useDeleteFileMutation();
  const archiveMutation = useArchiveFileMutation();

  const [previewFile, setPreviewFile] = useState<FileMetadata | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FileMetadata | null>(null);

  // Build project name map
  const projectMap = useMemo(() => {
    const map = new Map<string, string>();
    projects.forEach((p) => map.set(p.id, p.name));
    return map;
  }, [projects]);

  // Filtered files
  const filteredFiles = useMemo(() => {
    return files.filter((f) => {
      const matchesQuery = matchesSearch(searchTerm, [f.original_name, f.category]);
      const matchesProject = !projectFilter || f.project_id === projectFilter;
      return matchesQuery && matchesProject;
    });
  }, [files, searchTerm, projectFilter]);

  // Unique projects from file list for filter
  const fileProjects = useMemo(() => {
    const ids = new Set(files.map((f) => f.project_id).filter(Boolean));
    return Array.from(ids).map((id) => ({
      id: id!,
      name: projectMap.get(id!) || id!,
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [files, projectMap]);

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id);
    setDeleteTarget(null);
  };

  const handleDownload = async (file: FileMetadata) => {
    const url = await getSignedUrl(file.bucket, file.storage_path);
    if (url) {
      const link = document.createElement('a');
      link.href = url;
      link.download = file.original_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader>
        <div className="ml-2">
          <h1 className="text-h3 font-bold">Arquivos</h1>
        </div>
      </AppHeader>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-4">
            <p className="text-tiny text-muted-foreground uppercase tracking-wider">Total</p>
            <p className="text-h2 font-bold">{filteredFiles.length}</p>
          </Card>
          <Card className="p-4">
            <p className="text-tiny text-muted-foreground uppercase tracking-wider">PDFs</p>
            <p className="text-h2 font-bold">{filteredFiles.filter((f) => f.mime_type === 'application/pdf').length}</p>
          </Card>
          <Card className="p-4">
            <p className="text-tiny text-muted-foreground uppercase tracking-wider">Imagens</p>
            <p className="text-h2 font-bold">{filteredFiles.filter((f) => f.mime_type.startsWith('image/')).length}</p>
          </Card>
          <Card className="p-4">
            <p className="text-tiny text-muted-foreground uppercase tracking-wider">Tamanho total</p>
            <p className="text-h2 font-bold">{formatFileSize(filteredFiles.reduce((acc, f) => acc + f.size_bytes, 0))}</p>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome do arquivo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {isStaff ? (
              <>
                <Button
                  variant={statusFilter === 'active' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter('active')}
                >
                  Ativos
                </Button>
                <Button
                  variant={statusFilter === 'archived' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter('archived')}
                >
                  Arquivados
                </Button>
                <Button
                  variant={statusFilter === 'deleted' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter('deleted')}
                >
                  Excluídos
                </Button>
              </>
            ) : null}

            {fileProjects.length > 0 && (
              <>
                <div className="w-px h-8 bg-border mx-1 hidden sm:block" />
                <Button
                  variant={!projectFilter ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setProjectFilter(null)}
                >
                  Todas obras
                </Button>
                {fileProjects.map((p) => (
                  <Button
                    key={p.id}
                    variant={projectFilter === p.id ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setProjectFilter(p.id)}
                    className="truncate max-w-[200px]"
                  >
                    {p.name}
                  </Button>
                ))}
              </>
            )}
          </div>
        </div>

        {/* File List */}
        {isLoading ? (
          <ContentSkeleton variant="cards" rows={6} />
        ) : filteredFiles.length === 0 ? (
          <EmptyState
            variant="documents"
            title="Nenhum arquivo encontrado"
            description={searchTerm || projectFilter ? 'Tente ajustar os filtros de busca.' : 'Os arquivos aparecerão aqui conforme forem enviados.'}
          />
        ) : (
          <div className="space-y-2">
            {filteredFiles.map((file) => (
              <Card
                key={file.id}
                className="p-3 hover:bg-accent/50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-muted rounded-lg shrink-0">
                    {getFileIcon(file.mime_type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-body font-medium truncate">{file.original_name}</h3>
                      {file.status !== 'active' && (
                        <Badge variant="outline" className={statusColors[file.status]}>
                          {statusLabels[file.status]}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap mt-0.5">
                      <span>{formatFileSize(file.size_bytes)}</span>
                      <span>•</span>
                      <span>{format(new Date(file.created_at), 'dd/MM/yyyy', { locale: ptBR })}</span>
                      {file.project_id && projectMap.get(file.project_id) && (
                        <>
                          <span>•</span>
                          <span className="truncate max-w-[150px]">{projectMap.get(file.project_id)}</span>
                        </>
                      )}
                      {file.category && (
                        <>
                          <span>•</span>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{file.category}</Badge>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    {canPreview(file.mime_type) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        title="Pré-visualizar"
                        onClick={() => setPreviewFile(file)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      title="Baixar"
                      onClick={() => handleDownload(file)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {file.status === 'active' && isStaff && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                          title="Arquivar"
                          onClick={() => archiveMutation.mutate(file.id)}
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-destructive hover:text-destructive"
                          title="Excluir"
                          onClick={() => setDeleteTarget(file)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Preview Modal */}
      <FilePreviewModal
        file={previewFile}
        open={!!previewFile}
        onOpenChange={(open) => !open && setPreviewFile(null)}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir arquivo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir &quot;{deleteTarget?.original_name}&quot;? O arquivo será marcado para remoção permanente após 7 dias.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
