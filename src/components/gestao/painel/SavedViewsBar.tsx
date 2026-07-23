/**
 * SavedViewsBar — visões salvas do Painel de Obras.
 *
 * Chips clicáveis aplicam a querystring salva. Botão "Salvar visão atual"
 * abre Dialog para nomear. Menu do chip permite renomear e remover
 * (remoção passa por AlertDialog).
 */
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bookmark, Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import {
  usePainelSavedViews,
  type SavedView,
} from "@/hooks/usePainelSavedViews";

export function SavedViewsBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { views, save, rename, remove } = usePainelSavedViews();

  const [saveOpen, setSaveOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [renameTarget, setRenameTarget] = useState<SavedView | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SavedView | null>(null);

  const currentQuery = location.search.replace(/^\?/, "");
  const isViewActive = (view: SavedView) => view.query === currentQuery;

  const openSaveDialog = () => {
    setNewName("");
    setSaveOpen(true);
  };
  const confirmSave = () => {
    if (!newName.trim()) return;
    save(newName, currentQuery);
    setSaveOpen(false);
    setNewName("");
  };

  const openRename = (view: SavedView) => {
    setRenameTarget(view);
    setRenameValue(view.name);
  };
  const confirmRename = () => {
    if (renameTarget && renameValue.trim()) {
      rename(renameTarget.id, renameValue);
    }
    setRenameTarget(null);
    setRenameValue("");
  };

  return (
    <>
      <div
        className="flex flex-wrap items-center gap-2 mb-3"
        role="group"
        aria-label="Visões salvas"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mr-1">
          Visões
        </span>

        {views.length === 0 && (
          <span className="text-xs text-muted-foreground italic">
            Salve os filtros atuais para acessar rápido depois.
          </span>
        )}

        {views.map((view) => {
          const active = isViewActive(view);
          return (
            <div key={view.id} className="inline-flex items-center">
              <button
                type="button"
                onClick={() =>
                  navigate({
                    pathname: location.pathname,
                    search: view.query ? `?${view.query}` : "",
                  })
                }
                aria-pressed={active}
                className={cn(
                  "inline-flex items-center gap-1.5 h-11 md:h-8 pl-2.5 pr-1 rounded-l-md border-l border-y text-xs font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                  active
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border-subtle bg-surface text-foreground/80 hover:bg-accent/60",
                )}
              >
                <Bookmark
                  className={cn(
                    "h-3.5 w-3.5 shrink-0",
                    active ? "text-primary" : "opacity-70",
                  )}
                  aria-hidden
                />
                <span className="truncate max-w-[160px]">{view.name}</span>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Ações da visão ${view.name}`}
                    className={cn(
                      "inline-flex items-center justify-center h-11 md:h-8 w-8 rounded-r-md border-r border-y transition-colors",
                      active
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border-subtle bg-surface text-muted-foreground hover:bg-accent/60",
                    )}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[160px]">
                  <DropdownMenuItem onSelect={() => openRename(view)}>
                    <Pencil className="h-3.5 w-3.5 mr-2" aria-hidden />
                    Renomear
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => setDeleteTarget(view)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" aria-hidden />
                    Remover
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={openSaveDialog}
          className="h-11 md:h-8 gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          <span>Salvar visão atual</span>
        </Button>
      </div>

      {/* Dialog: salvar */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Salvar visão</DialogTitle>
            <DialogDescription>
              Guarda os filtros e a ordenação atuais para você reabrir rápido.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label className="text-xs font-medium text-foreground mb-1 block">
              Nome da visão
            </label>
            <Input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex.: Minhas obras em atraso"
              maxLength={60}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim()) confirmSave();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmSave} disabled={!newName.trim()}>
              Salvar visão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: renomear */}
      <Dialog
        open={!!renameTarget}
        onOpenChange={(o) => !o && setRenameTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Renomear visão</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              maxLength={60}
              onKeyDown={(e) => {
                if (e.key === "Enter" && renameValue.trim()) confirmRename();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmRename} disabled={!renameValue.trim()}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog: remover */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover esta visão?</AlertDialogTitle>
            <AlertDialogDescription>
              A visão “{deleteTarget?.name}” será removida do seu navegador.
              Você pode recriá-la a qualquer momento salvando os filtros
              novamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) remove(deleteTarget.id);
                setDeleteTarget(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
