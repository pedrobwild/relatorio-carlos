/**
 * Lista da equipe para marcar alguém em uma observação interna.
 *
 * Gaveta que sobe de baixo: no celular, com a mão que segura o aparelho.
 * Só mostra a equipe ativa (cliente não aparece; o banco também recusa).
 */
import { useEffect, useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useStaffUsers, type StaffUser } from "@/hooks/useStaffUsers";
import { semAcento } from "@/lib/mencoes";
import { cn } from "@/lib/utils";

export interface MentionPerson {
  id: string;
  nome: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** O que a pessoa digitou depois do @, para já abrir filtrado. */
  initialQuery?: string;
  selectedIds: readonly string[];
  /** Quem escreve não marca a si mesmo. */
  excludeId?: string | null;
  onPick: (person: MentionPerson) => void;
}

export function MentionPicker({ open, onOpenChange, initialQuery = "", selectedIds, excludeId, onPick }: Props) {
  const { data: staff = [], isLoading, isError } = useStaffUsers();
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => {
    if (open) setQuery(initialQuery);
  }, [open, initialQuery]);

  const options = useMemo(() => {
    const q = semAcento(query.trim());
    return (staff as StaffUser[])
      .filter((p) => p.id !== excludeId && !!p.nome?.trim())
      .filter((p) => !q || semAcento(p.nome).includes(q));
  }, [staff, query, excludeId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex max-h-[85dvh] flex-col gap-0 rounded-t-3xl p-0">
        <SheetHeader className="shrink-0 px-5 pb-3 pt-5 text-left">
          <SheetTitle className="text-lg font-bold">Marcar alguém da equipe</SheetTitle>
          <SheetDescription>A pessoa é avisada e a pendência fica com ela até resolver.</SheetDescription>
        </SheetHeader>
        <div className="relative shrink-0 px-5">
          <Search className="pointer-events-none absolute left-8 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar pelo nome"
            aria-label="Buscar pessoa da equipe"
            className="min-h-[48px] pl-9 text-base"
          />
        </div>
        <ul className="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto px-5 pb-6">
          {isLoading && <li className="py-6 text-center text-sm text-muted-foreground">Carregando a equipe…</li>}
          {isError && (
            <li className="py-6 text-center text-sm text-destructive">Não deu para carregar a equipe. Tente de novo.</li>
          )}
          {!isLoading && !isError && options.length === 0 && (
            <li className="py-6 text-center text-sm text-muted-foreground">Ninguém da equipe com esse nome.</li>
          )}
          {options.map((p) => {
            const selected = selectedIds.includes(p.id);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onPick({ id: p.id, nome: p.nome.trim() })}
                  className={cn(
                    "flex min-h-[56px] w-full items-center gap-3 rounded-xl border px-4 text-left text-base font-medium",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card text-foreground",
                  )}
                >
                  <span className="min-w-0 flex-1 break-words">{p.nome}</span>
                  {selected && <Check className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
