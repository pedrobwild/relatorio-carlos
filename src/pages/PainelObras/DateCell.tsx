/**
 * Célula de data editável inline com confirmação opcional.
 *
 * Usada para datas oficiais (que pedem confirmação antes de alterar) e
 * datas realizadas (alteração livre).
 */
import { useState } from 'react';
import { parseISO } from 'date-fns';
import { CalendarIcon, AlertTriangle } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
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
import { cn } from '@/lib/utils';
import { editableCell, fmtDate, toIsoDate } from './types';

interface DateCellProps {
  value: string | null;
  onChange: (iso: string | null) => void;
  confirmEdit?: boolean;
  confirmTitle?: string;
  disabled?: boolean;
}

export function DateCell({ value, onChange, confirmEdit, confirmTitle, disabled }: DateCellProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Date | undefined>();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleSelect = (d: Date | undefined) => {
    setOpen(false);
    if (confirmEdit && value) {
      setPending(d);
      setConfirmOpen(true);
      return;
    }
    onChange(toIsoDate(d));
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              editableCell,
              'flex items-center gap-1.5 tabular-nums',
              !value && 'text-muted-foreground',
              disabled && 'opacity-50 cursor-not-allowed',
            )}
          >
            <CalendarIcon className="h-3 w-3 shrink-0 opacity-60 group-hover/cell:opacity-100" />
            <span className="truncate">{fmtDate(value)}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value ? parseISO(value) : undefined}
            onSelect={handleSelect}
            initialFocus
            className="p-3 pointer-events-auto"
          />
          {value && (
            <div className="p-2 border-t border-border">
              <Button
                size="sm"
                variant="ghost"
                className="w-full text-destructive"
                onClick={() => {
                  setOpen(false);
                  if (confirmEdit) {
                    setPending(undefined);
                    setConfirmOpen(true);
                  } else {
                    onChange(null);
                  }
                }}
              >
                Limpar data
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              {confirmTitle ?? 'Confirmar alteração'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta data representa um <strong>prazo contratual</strong> e não deve ser alterada
              rotineiramente. Tem certeza de que deseja modificá-la?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPending(undefined)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onChange(toIsoDate(pending));
                setPending(undefined);
              }}
            >
              Confirmar alteração
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
