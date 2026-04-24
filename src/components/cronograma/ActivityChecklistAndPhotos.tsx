/**
 * ActivityChecklistAndPhotos — bloco expansível por atividade do
 * cronograma com 2 abas: Checklist técnico e Galeria de fotos.
 *
 * Como atividades não-salvas ainda não têm registro no banco, o
 * componente fica desabilitado até o `isPersisted` ser true.
 */
import { useRef, useState } from 'react';
import {
  ListChecks,
  ImageIcon,
  Plus,
  Trash2,
  Loader2,
  Upload,
  X,
  Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { useActivityChecklist } from '@/hooks/useActivityChecklist';
import { useActivityPhotos } from '@/hooks/useActivityPhotos';
import { cn } from '@/lib/utils';

interface ActivityChecklistAndPhotosProps {
  activityId: string;
  projectId: string;
  /** Indica se a atividade já existe no banco (foi salva). */
  isPersisted: boolean;
  /** Permite escrita; false para customers. */
  canEdit: boolean;
}

export function ActivityChecklistAndPhotos({
  activityId,
  projectId,
  isPersisted,
  canEdit,
}: ActivityChecklistAndPhotosProps) {
  if (!isPersisted) {
    return (
      <div className="rounded-md border border-dashed bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
        Salve o cronograma para liberar checklist e galeria de fotos desta atividade.
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-background shadow-sm">
      <Tabs defaultValue="checklist" className="w-full">
        <TabsList className="grid w-full grid-cols-2 rounded-t-md rounded-b-none">
          <TabsTrigger value="checklist" className="flex items-center gap-2">
            <ListChecks className="h-4 w-4" />
            Checklist
          </TabsTrigger>
          <TabsTrigger value="photos" className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            Fotos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="checklist" className="p-3">
          <ChecklistPanel activityId={activityId} projectId={projectId} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="photos" className="p-3">
          <PhotosPanel activityId={activityId} projectId={projectId} canEdit={canEdit} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------- Checklist ------------------------------------------------

function ChecklistPanel({
  activityId,
  projectId,
  canEdit,
}: {
  activityId: string;
  projectId: string;
  canEdit: boolean;
}) {
  const {
    items,
    isLoading,
    total,
    doneCount,
    progress,
    addItem,
    toggleItem,
    editItem,
    deleteItem,
  } = useActivityChecklist(activityId, projectId);

  const [newDescription, setNewDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  const handleAdd = () => {
    if (!newDescription.trim()) return;
    addItem.mutate(newDescription, { onSuccess: () => setNewDescription('') });
  };

  const startEdit = (id: string, current: string) => {
    setEditingId(id);
    setEditingValue(current);
  };

  const commitEdit = () => {
    if (!editingId) return;
    editItem.mutate(
      { id: editingId, description: editingValue },
      { onSuccess: () => setEditingId(null) },
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Progress value={progress} className="flex-1 h-2" />
        <span className="text-xs tabular-nums text-muted-foreground min-w-[60px] text-right">
          {doneCount}/{total} ({progress}%)
        </span>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando checklist…
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <p className="text-sm text-muted-foreground py-1">
          Nenhum item ainda. {canEdit ? 'Adicione abaixo.' : ''}
        </p>
      )}

      <ul className="space-y-1">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-start gap-2 group rounded px-1 py-1 hover:bg-accent/40"
          >
            <Checkbox
              checked={item.is_done}
              disabled={!canEdit || toggleItem.isPending}
              onCheckedChange={(checked) =>
                toggleItem.mutate({ id: item.id, is_done: checked === true })
              }
              className="mt-0.5"
            />
            <div className="flex-1 min-w-0">
              {editingId === item.id ? (
                <div className="flex gap-1">
                  <Input
                    autoFocus
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitEdit();
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    className="h-7 text-sm"
                  />
                  <Button size="sm" variant="secondary" onClick={commitEdit}>
                    OK
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  className={cn(
                    'text-sm text-left w-full block',
                    item.is_done && 'line-through text-muted-foreground',
                  )}
                  onClick={() => canEdit && startEdit(item.id, item.description)}
                  disabled={!canEdit}
                  title={canEdit ? 'Clique para editar' : undefined}
                >
                  {item.description}
                </button>
              )}
            </div>
            {canEdit && editingId !== item.id && (
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => startEdit(item.id, item.description)}
                  aria-label="Editar item"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-destructive hover:text-destructive"
                  onClick={() => deleteItem.mutate(item.id)}
                  aria-label="Excluir item"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {canEdit && (
        <div className="flex gap-2 pt-1 border-t">
          <Input
            placeholder="Novo item de checklist…"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
            }}
            className="h-8 text-sm"
          />
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={!newDescription.trim() || addItem.isPending}
          >
            {addItem.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1" /> Adicionar
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------- Photos ---------------------------------------------------

function PhotosPanel({
  activityId,
  projectId,
  canEdit,
}: {
  activityId: string;
  projectId: string;
  canEdit: boolean;
}) {
  const { photos, isLoading, uploadPhotos, deletePhoto } = useActivityPhotos(
    activityId,
    projectId,
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) {
      uploadPhotos.mutate({ files });
    }
    e.target.value = '';
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {photos.length === 0
            ? 'Nenhuma foto ainda.'
            : `${photos.length} foto${photos.length > 1 ? 's' : ''}`}
        </span>
        {canEdit && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              multiple
              className="hidden"
              onChange={handleSelect}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={uploadPhotos.isPending}
            >
              {uploadPhotos.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-1" /> Enviar fotos
                </>
              )}
            </Button>
          </>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando fotos…
        </div>
      )}

      {!isLoading && photos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="relative group rounded-md overflow-hidden border bg-muted aspect-square"
            >
              {photo.signed_url ? (
                <button
                  type="button"
                  className="w-full h-full"
                  onClick={() => setPreview(photo.signed_url ?? null)}
                  aria-label="Ampliar foto"
                >
                  <img
                    src={photo.signed_url}
                    alt={photo.caption ?? 'Foto da atividade'}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <ImageIcon className="h-6 w-6" />
                </div>
              )}
              {canEdit && (
                <button
                  type="button"
                  className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  onClick={() => deletePhoto.mutate(photo)}
                  aria-label="Remover foto"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {preview && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setPreview(null)}
        >
          <img
            src={preview}
            alt="Visualização ampliada"
            className="max-h-full max-w-full object-contain"
          />
        </div>
      )}
    </div>
  );
}

