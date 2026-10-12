/**
 * Kanban do Painel de Obras: uma coluna por etapa; arrastar o cartão muda a
 * etapa da obra. O cartão mostra a situação calculada (uma cor só) e o aviso
 * mais importante. Tocar no cartão abre a gaveta, que também troca a etapa
 * (caminho para teclado e celular, onde não dá para arrastar).
 *
 * Serve às duas listas: em execução (colunas = etapas do Painel) e Projetos
 * (colunas = etapas da fase de projeto). Quem usa decide o que significa
 * soltar numa coluna (`onMove` recebe a chave dela).
 */
import { useState, type DragEvent } from "react";
import { cn } from "@/lib/utils";
import type { KanbanCardData } from "@/lib/painelNovo";
import { RISK_LABEL } from "@/lib/obrasPainel";
import { ObraFlags, RISK_DOT } from "@/components/gestao/obras/ObrasList";
import { FaseChip } from "@/components/gestao/obras/FaseChip";

const DRAG_TYPE = "application/x-bwild-obra";

const HEADLINE_TONE: Record<KanbanCardData["headlineTone"], string> = {
  destructive: "text-destructive",
  warning: "text-warning",
  success: "text-success",
  muted: "text-muted-foreground",
};

export interface KanbanColumn {
  key: string;
  label: string;
  items: KanbanCardData[];
  /** false = a coluna não recebe cartões (ex.: "Sem etapa registrada"). Padrão: recebe. */
  droppable?: boolean;
}

interface Props {
  groups: readonly KanbanColumn[];
  onOpen: (id: string) => void;
  /** Soltou o cartão em outra coluna (recebe a chave dela). Sem isto, os cartões não arrastam. */
  onMove?: (id: string, columnKey: string) => void;
  /** Nome do conjunto para leitor de tela. */
  label?: string;
}

export function EtapaKanban({ groups, onOpen, onMove, label = "Obras por etapa" }: Props) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const canDrag = !!onMove;

  const onDrop = (e: DragEvent, column: KanbanColumn) => {
    e.preventDefault();
    const id = e.dataTransfer.getData(DRAG_TYPE) || dragging;
    setDragging(null);
    setOver(null);
    if (!id || !onMove || column.droppable === false) return;
    if (column.items.some((c) => c.id === id)) return; // soltou na própria coluna
    // Cartão travado não se move, mesmo que o arrasto tenha começado de outro jeito.
    if (groups.some((g) => g.items.some((c) => c.id === id && c.locked))) return;
    onMove(id, column.key);
  };

  return (
    // `relative`: os textos só para leitor de tela (sr-only, position:absolute)
    // precisam rolar junto com os cartões; sem isso alargavam a página inteira.
    <div className="relative w-full max-w-full overflow-x-auto pb-2" role="group" aria-label={label}>
      <div className="flex w-max gap-3">
        {groups.map((g) => {
          const droppable = canDrag && g.droppable !== false;
          return (
            <section
              key={g.key}
              aria-label={`${g.label}: ${g.items.length}`}
              onDragOver={(e) => {
                // Sem preventDefault o navegador não deixa soltar: é assim que a
                // coluna que não recebe cartões recusa o arrasto.
                if (!droppable || !dragging) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (over !== g.key) setOver(g.key);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver((k) => (k === g.key ? null : k));
              }}
              onDrop={(e) => onDrop(e, g)}
              className={cn(
                "flex w-[272px] shrink-0 flex-col rounded-xl border border-border bg-muted/30 transition-colors",
                over === g.key && "border-primary bg-primary/5",
              )}
            >
              <h2 className="flex items-baseline justify-between gap-2 px-3 pb-1 pt-3">
                <span className="truncate text-sm font-semibold text-foreground">{g.label}</span>
                <span className="text-sm tabular-nums text-muted-foreground">{g.items.length}</span>
              </h2>
              <ul className="flex min-h-[72px] flex-col gap-2 p-2">
                {g.items.map((c) => (
                  <li key={c.id}>
                    {/* div com role="button", não <button>: o Firefox não deixa arrastar botões. */}
                    <div
                      role="button"
                      tabIndex={0}
                      draggable={canDrag && !c.locked}
                      onDragStart={(e) => {
                        e.dataTransfer.setData(DRAG_TYPE, c.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDragging(c.id);
                      }}
                      onDragEnd={() => {
                        setDragging(null);
                        setOver(null);
                      }}
                      onClick={() => onOpen(c.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onOpen(c.id);
                        }
                      }}
                      className={cn(
                        "block w-full cursor-pointer select-none rounded-lg border border-border bg-card p-3 text-left shadow-sm transition-colors",
                        "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        canDrag && !c.locked && "cursor-grab active:cursor-grabbing",
                        dragging === c.id && "opacity-50",
                      )}
                    >
                      <span className="flex items-start gap-2">
                        {c.risk && (
                          <span aria-hidden="true" className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", RISK_DOT[c.risk])} />
                        )}
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-foreground">{c.name}</span>
                          {c.customer && <span className="block truncate text-xs text-muted-foreground">{c.customer}</span>}
                        </span>
                      </span>
                      {c.risk && <span className="sr-only">{RISK_LABEL[c.risk]}</span>}
                      {c.fase && <FaseChip verdict={c.fase} className="mt-2" />}
                      {c.headline && (
                        <span
                          className={cn(
                            "block text-sm font-semibold tabular-nums",
                            c.fase ? "mt-1" : "mt-2",
                            HEADLINE_TONE[c.headlineTone],
                          )}
                        >
                          {c.headline}
                        </span>
                      )}
                      {c.alert && <span className="mt-0.5 block text-xs leading-snug text-foreground/80">{c.alert}</span>}
                      <span className="mt-1.5 block truncate text-xs text-muted-foreground">
                        {c.responsible ?? "Sem responsável"}
                      </span>
                      <ObraFlags cadastro={c} />
                    </div>
                  </li>
                ))}
                {g.items.length === 0 && (
                  <li className="px-1 py-3 text-center text-xs text-muted-foreground">
                    {droppable ? "Arraste uma obra para cá" : "Nenhuma obra"}
                  </li>
                )}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
