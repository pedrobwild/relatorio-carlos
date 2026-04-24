/**
 * ExternalBudgetCell — célula do Painel de Obras para vincular o ID do
 * orçamento público no sistema externo Bwild Engine.
 *
 * Quando preenchido: exibe um botão compacto que abre o orçamento em nova aba.
 * Quando vazio: exibe "Vincular" que abre um dialog para colar o ID/URL.
 *
 * Aceita tanto o UUID isolado quanto a URL completa
 * (https://bwildengine.com/admin/budget/{id}). Faz extração básica do UUID.
 */
import { useState } from 'react';
import { ExternalLink, Link2, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const BUDGET_BASE_URL = 'https://bwildengine.com/admin/budget/';
const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Extrai o UUID de uma string (URL completa ou ID puro). */
function extractBudgetId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const match = trimmed.match(UUID_REGEX);
  return match ? match[0].toLowerCase() : null;
}

interface ExternalBudgetCellProps {
  value: string | null;
  onChange: (id: string | null) => void;
}

export function ExternalBudgetCell({ value, onChange }: ExternalBudgetCellProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [touched, setTouched] = useState(false);

  const openDialog = () => {
    setDraft(value ?? '');
    setTouched(false);
    setOpen(true);
  };

  const parsed = extractBudgetId(draft);
  const showError = touched && draft.trim().length > 0 && !parsed;

  const handleSave = () => {
    setTouched(true);
    if (draft.trim().length === 0) {
      onChange(null);
      setOpen(false);
      return;
    }
    if (!parsed) return;
    onChange(parsed);
    setOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setOpen(false);
  };

  const url = value ? `${BUDGET_BASE_URL}${value}` : null;

  return (
    <>
      <div className="flex items-center gap-1">
        {url ? (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-xs font-medium',
                    'bg-primary/10 text-primary border border-primary/20',
                    'hover:bg-primary/15 transition-colors',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  )}
                  aria-label="Abrir orçamento público em nova aba"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span>Ver orçamento</span>
                </a>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[320px] text-xs">
                Abre o orçamento público em <strong>bwildengine.com</strong>
                <br />
                ID: <span className="font-mono">{value}</span>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={openDialog}
                  aria-label="Editar vínculo do orçamento"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Editar vínculo</TooltipContent>
            </Tooltip>
          </>
        ) : (
          <button
            type="button"
            onClick={openDialog}
            className={cn(
              'inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-xs',
              'text-muted-foreground hover:text-foreground hover:bg-accent/60',
              'transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
            aria-label="Vincular orçamento público"
          >
            <Link2 className="h-3 w-3" />
            <span>Vincular</span>
          </button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Vincular orçamento público</DialogTitle>
            <DialogDescription>
              Cole o link completo do orçamento ou apenas o identificador (UUID).
              O link abre em <strong>bwildengine.com</strong> em nova aba.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label
              htmlFor="external-budget-id"
              className="text-xs font-medium text-foreground"
            >
              Link ou ID do orçamento
            </label>
            <Input
              id="external-budget-id"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                if (!touched) setTouched(true);
              }}
              placeholder="https://bwildengine.com/admin/budget/..."
              autoFocus
              spellCheck={false}
              className="font-mono text-xs"
            />
            {showError && (
              <p className="text-xs text-destructive">
                Não foi possível identificar um UUID válido. Verifique o link.
              </p>
            )}
            {!showError && parsed && parsed !== draft.trim() && (
              <p className="text-xs text-muted-foreground">
                Identificado: <span className="font-mono text-foreground">{parsed}</span>
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            {value && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleClear}
                className="mr-auto text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4 mr-1.5" />
                Remover vínculo
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={draft.trim().length > 0 && !parsed}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
