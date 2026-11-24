/**
 * InternalNotesCard — observações internas da obra (canal da equipe).
 *
 * Onde o time de obras registra, p.ex., por que a obra está sem atualização,
 * e o time de CS lê antes de falar com o cliente. A nota fixada é o "status
 * atual" da obra e aparece também no Painel de Obras e nas telas de CS.
 *
 * Só staff vê: sem `internal_notes:view` o componente não renderiza nada, e
 * a RLS do banco (`is_staff()`) garante o sigilo mesmo fora da interface.
 * Fica FORA do `reportRef` do Index — não pode entrar no PDF do relatório.
 */
import { useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import {
  AtSign,
  Loader2,
  Lock,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Send,
  StickyNote,
  Trash2,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useProjectNoteMentions, useSetNoteMentions } from "@/hooks/useInternalNoteMentions";
import { MAX_MENTIONS_PER_NOTE, type InternalNoteMention } from "@/infra/repositories/internalNoteMentions.repository";
import { gatilhoDeMencao, inserirMencao } from "@/lib/mencoes";
import { MentionPicker, type MentionPerson } from "./MentionPicker";
import { NoteMentions } from "./NoteMentions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useCan } from "@/hooks/useCan";
import {
  useCreateInternalNote,
  useDeleteInternalNote,
  useProjectInternalNotes,
  useSetInternalNotePinned,
  useUpdateInternalNote,
} from "@/hooks/useProjectInternalNotes";
import {
  INTERNAL_NOTE_CATEGORIES,
  INTERNAL_NOTE_MAX_LENGTH,
  type InternalNoteCategory,
  type ProjectInternalNote,
} from "@/infra/repositories";
import {
  INTERNAL_NOTE_CATEGORY_META,
  formatNoteDateTime,
  formatNoteRelative,
  getAuthorInitials,
  getInternalNoteCategoryMeta,
} from "./internalNoteMeta";

export interface InternalNotesCardProps {
  projectId: string;
  className?: string;
  /**
   * "card" — bloco destacado no topo da página da obra.
   * "compact" — para drawers e barras laterais (menos itens visíveis).
   */
  variant?: "card" | "compact";
}

const DEFAULT_CATEGORY: InternalNoteCategory = "sem_atualizacao";

function CategorySelect({
  value,
  onChange,
  disabled,
  id,
}: {
  value: InternalNoteCategory;
  onChange: (value: InternalNoteCategory) => void;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as InternalNoteCategory)}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        className="h-8 w-full sm:w-[200px] text-xs"
        aria-label="Categoria da observação"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {INTERNAL_NOTE_CATEGORIES.map((c) => (
          <SelectItem key={c} value={c} className="text-xs">
            {INTERNAL_NOTE_CATEGORY_META[c].label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function CategoryPill({
  category,
  className,
}: {
  category: string;
  className?: string;
}) {
  const meta = getInternalNoteCategoryMeta(category);
  return (
    <span
      className={cn(
        "inline-flex items-center h-5 px-1.5 rounded text-[10px] font-medium whitespace-nowrap",
        meta.tone,
        className,
      )}
    >
      {meta.label}
    </span>
  );
}

interface NoteItemProps {
  note: ProjectInternalNote;
  canPin: boolean;
  canEdit: boolean;
  busy: boolean;
  /** Edição controlada pelo card: sobrevive a refetch e reordenação. */
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onTogglePin: () => void;
  onDelete: () => void;
  onSaveEdit: (body: string, category: InternalNoteCategory) => Promise<void>;
  /** Pessoas marcadas nesta observação (abertas e resolvidas). */
  mentions: InternalNoteMention[];
  currentUserId?: string | null;
}

function NoteItem({
  note,
  canPin,
  canEdit,
  busy,
  editing,
  onEditingChange,
  onTogglePin,
  onDelete,
  onSaveEdit,
  mentions,
  currentUserId,
}: NoteItemProps) {
  const [draft, setDraft] = useState(note.body);
  const [draftCategory, setDraftCategory] = useState<InternalNoteCategory>(
    note.category as InternalNoteCategory,
  );
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setDraft(note.body);
    setDraftCategory(note.category as InternalNoteCategory);
    onEditingChange(true);
  };

  const saveEdit = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      await onSaveEdit(draft, draftCategory);
      onEditingChange(false);
    } catch {
      // O toast de erro vem do handler global de mutations.
    } finally {
      setSaving(false);
    }
  };

  const hasActions = canPin || canEdit;

  return (
    <li
      className={cn(
        "flex gap-2.5 rounded-lg border px-3 py-2.5",
        note.is_pinned
          ? "border-warning/40 bg-warning/5"
          : "border-border bg-muted/30",
      )}
    >
      <Avatar className="h-7 w-7 shrink-0 mt-0.5">
        <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
          {getAuthorInitials(note.author_name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {note.is_pinned && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-warning">
              <Pin className="h-3 w-3" aria-hidden />
              Status atual
            </span>
          )}
          <span className="text-xs font-semibold text-foreground truncate">
            {note.author_name || "Colaborador"}
          </span>
          <time
            dateTime={note.created_at}
            title={formatNoteDateTime(note.created_at)}
            className="text-[11px] text-muted-foreground"
          >
            {formatNoteRelative(note.created_at)}
          </time>
          {note.edited_at && (
            <span
              className="text-[11px] text-muted-foreground italic"
              title={`Editada em ${formatNoteDateTime(note.edited_at)}`}
            >
              (editada)
            </span>
          )}
          <CategoryPill category={note.category} />
          {hasActions && !editing && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 ml-auto text-muted-foreground"
                  aria-label="Ações da observação"
                  disabled={busy}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canPin && (
                  <DropdownMenuItem onSelect={onTogglePin}>
                    {note.is_pinned ? (
                      <>
                        <PinOff className="h-4 w-4 mr-2" />
                        Desafixar
                      </>
                    ) : (
                      <>
                        <Pin className="h-4 w-4 mr-2" />
                        Fixar como status atual
                      </>
                    )}
                  </DropdownMenuItem>
                )}
                {canEdit && (
                  <>
                    <DropdownMenuItem onSelect={startEdit}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={onDelete}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remover
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {editing ? (
          <div className="mt-2 space-y-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              maxLength={INTERNAL_NOTE_MAX_LENGTH}
              className="resize-none text-sm"
              aria-label="Editar observação"
              autoFocus
            />
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <CategorySelect
                value={draftCategory}
                onChange={setDraftCategory}
                disabled={saving}
              />
              <div className="flex gap-2 sm:ml-auto">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onEditingChange(false)}
                  disabled={saving}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={saveEdit}
                  disabled={saving || !draft.trim()}
                >
                  {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                  Salvar
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-1 text-sm text-foreground whitespace-pre-wrap break-words">
            {note.body}
          </p>
        )}
        <NoteMentions mentions={mentions} currentUserId={currentUserId} noteBody={note.body} />
      </div>
    </li>
  );
}

export function InternalNotesCard({
  projectId,
  className,
  variant = "card",
}: InternalNotesCardProps) {
  const { can } = useCan();
  const { user } = useAuth();
  const canView = can("internal_notes:view");
  const canCreate = can("internal_notes:create");
  const canModerate = can("internal_notes:moderate");

  const {
    data: notes = [],
    isLoading,
    isError,
  } = useProjectInternalNotes(projectId);
  const createNote = useCreateInternalNote();
  const updateNote = useUpdateInternalNote();
  const setPinned = useSetInternalNotePinned();
  const deleteNote = useDeleteInternalNote();

  const [body, setBody] = useState("");
  const [category, setCategory] =
    useState<InternalNoteCategory>(DEFAULT_CATEGORY);
  const [pin, setPin] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [toDelete, setToDelete] = useState<ProjectInternalNote | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Menções: quem está marcado na observação que está sendo escrita.
  const { byNote: mentionsByNote } = useProjectNoteMentions(projectId);
  const setMentions = useSetNoteMentions();
  const [marcados, setMarcados] = useState<MentionPerson[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const composerRef = useRef<HTMLTextAreaElement>(null);

  if (!canView) return null;

  const isCompact = variant === "compact";
  const limit = isCompact ? 3 : 5;
  const pinned = notes.find((n) => n.is_pinned) ?? null;
  const others = notes.filter((n) => !n.is_pinned);
  // A nota em edição nunca sai da tela, mesmo que notas novas a empurrem
  // para além do limite (texto digitado não pode sumir).
  const visibleOthers = showAll
    ? others
    : others.filter((n, i) => i < limit || n.id === editingId);
  const hiddenCount = others.length - visibleOthers.length;
  // Lista única com key estável: quando a nota ganha/perde a fixação ela
  // muda de posição sem remontar (e sem perder uma edição em andamento).
  const listed = pinned ? [pinned, ...visibleOthers] : visibleOthers;
  const busy = setPinned.isPending || deleteNote.isPending;

  const canEditNote = (note: ProjectInternalNote) =>
    canModerate || (!!user?.id && note.author_id === user.id);

  const submit = () => {
    if (!body.trim() || createNote.isPending) return;
    // Só vale a marcação cujo @Nome continua no texto.
    const userIds = marcados.filter((p) => body.includes(`@${p.nome}`)).map((p) => p.id);
    createNote.mutate(
      { projectId, body, category, pin },
      {
        onSuccess: (note) => {
          setBody("");
          setCategory(DEFAULT_CATEGORY);
          setPin(true);
          setMarcados([]);
          if (note?.id && userIds.length > 0) setMentions.mutate({ noteId: note.id, userIds });
        },
      },
    );
  };

  // Digitar @ abre a lista da equipe, já filtrada pelo que vier depois.
  const handleBodyChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const texto = e.target.value;
    setBody(texto);
    const trecho = gatilhoDeMencao(texto, e.target.selectionStart ?? texto.length);
    if (trecho !== null && texto.length > body.length && marcados.length < MAX_MENTIONS_PER_NOTE) {
      setPickerQuery(trecho);
      setPickerOpen(true);
    }
  };

  const handlePick = (person: MentionPerson) => {
    const cursor = composerRef.current?.selectionStart ?? body.length;
    if (!body.includes(`@${person.nome}`)) {
      setBody(inserirMencao(body, cursor, person.nome).texto.slice(0, INTERNAL_NOTE_MAX_LENGTH));
    }
    setMarcados((prev) => (prev.some((p) => p.id === person.id) ? prev : [...prev, person]));
    setPickerOpen(false);
    requestAnimationFrame(() => composerRef.current?.focus());
  };

  const marcadosNoTexto = marcados.filter((p) => body.includes(`@${p.nome}`));

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  };

  const renderNote = (note: ProjectInternalNote) => (
    <NoteItem
      key={note.id}
      note={note}
      canPin={canCreate}
      canEdit={canEditNote(note)}
      busy={busy}
      editing={editingId === note.id}
      onEditingChange={(next) => setEditingId(next ? note.id : null)}
      onTogglePin={() => setPinned.mutate({ id: note.id, pinned: !note.is_pinned })}
      onDelete={() => setToDelete(note)}
      mentions={mentionsByNote.get(note.id) ?? []}
      currentUserId={user?.id}
      onSaveEdit={async (nextBody, nextCategory) => {
        await updateNote.mutateAsync({
          id: note.id,
          input: { body: nextBody, category: nextCategory },
        });
      }}
    />
  );

  const composerId = `internal-note-${projectId}`;

  return (
    <section
      aria-label="Observações internas"
      className={cn(
        "rounded-xl border bg-card",
        isCompact ? "p-3" : "p-4 shadow-sm",
        className,
      )}
    >
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
          <StickyNote className="h-4 w-4 text-warning" aria-hidden />
          Observações internas
        </h2>
        <Badge variant="outline" className="gap-1 text-[10px] font-medium">
          <Lock className="h-3 w-3" aria-hidden />
          Só equipe
        </Badge>
        {notes.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {notes.length} {notes.length === 1 ? "registro" : "registros"}
          </span>
        )}
      </header>
      {!isCompact && (
        <p className="mt-1 text-xs text-muted-foreground">
          Contexto para os times de obras e CS, por exemplo, por que a obra
          está sem atualização. O cliente não vê estas observações.
        </p>
      )}

      {canCreate && (
        <div className="mt-3 space-y-2">
          <Label htmlFor={composerId} className="sr-only">
            Nova observação interna
          </Label>
          <Textarea
            id={composerId}
            ref={composerRef}
            value={body}
            onChange={handleBodyChange}
            onKeyDown={handleKeyDown}
            rows={2}
            maxLength={INTERNAL_NOTE_MAX_LENGTH}
            placeholder="Ex.: Sem atualização porque o cliente pediu para pausar até dia 15."
            className="resize-none text-sm"
            disabled={createNote.isPending}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-[44px] sm:min-h-9"
              onClick={() => {
                setPickerQuery("");
                setPickerOpen(true);
              }}
              disabled={createNote.isPending || marcados.length >= MAX_MENTIONS_PER_NOTE}
            >
              <AtSign className="h-4 w-4 mr-1.5" />
              Marcar alguém
            </Button>
            {marcadosNoTexto.length > 0 && (
              <span className="text-xs text-muted-foreground">
                Avisa: {marcadosNoTexto.map((p) => p.nome).join(", ")}
              </span>
            )}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <CategorySelect
              value={category}
              onChange={setCategory}
              disabled={createNote.isPending}
            />
            <label className="inline-flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
              <Checkbox
                checked={pin}
                onCheckedChange={(v) => setPin(v === true)}
                disabled={createNote.isPending}
                aria-label="Fixar como status atual da obra"
              />
              Fixar como status atual
            </label>
            <Button
              size="sm"
              className="sm:ml-auto"
              onClick={submit}
              disabled={!body.trim() || createNote.isPending}
            >
              {createNote.isPending ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-1.5" />
              )}
              Registrar
            </Button>
          </div>
        </div>
      )}

      <div className="mt-3">
        {isLoading ? (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive py-2">
            Não foi possível carregar as observações internas.
          </p>
        ) : notes.length === 0 ? (
          <p className="text-sm italic text-muted-foreground py-2 text-center">
            Nenhuma observação interna registrada.
          </p>
        ) : (
          <ul className="space-y-2">
            {listed.map(renderNote)}
          </ul>
        )}
        {(hiddenCount > 0 || (showAll && others.length > limit)) && (
          <Button
            variant="link"
            size="sm"
            className="mt-1 h-auto px-0 text-xs"
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? "Mostrar menos" : `Ver todas (${hiddenCount} a mais)`}
          </Button>
        )}
      </div>

      <AlertDialog
        open={!!toDelete}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover observação interna?</AlertDialogTitle>
            <AlertDialogDescription>
              A observação deixa de aparecer para toda a equipe. Esta ação não
              pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (toDelete) deleteNote.mutate(toDelete.id);
                setToDelete(null);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MentionPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        initialQuery={pickerQuery}
        selectedIds={marcadosNoTexto.map((p) => p.id)}
        excludeId={user?.id}
        onPick={handlePick}
      />
    </section>
  );
}
