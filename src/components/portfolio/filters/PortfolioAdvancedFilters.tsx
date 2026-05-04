import { useState, useMemo } from "react";
import {
  X,
  Check,
  SlidersHorizontal,
  CalendarDays,
  DollarSign,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { emptyFilters, isFiltersEmpty, type AdvancedFilters } from "./types";
import type { ProjectWithCustomer } from "@/infra/repositories";

// ─── Props ───────────────────────────────────────────────────────────────────

interface PortfolioAdvancedFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: AdvancedFilters;
  onApply: (filters: AdvancedFilters) => void;
  projects: ProjectWithCustomer[];
}

// ─── Option sets ─────────────────────────────────────────────────────────────

const statusOptions = [
  { value: "draft", label: "Rascunho" },
  { value: "active", label: "Em andamento" },
  { value: "completed", label: "Concluída" },
  { value: "paused", label: "Pausada" },
  { value: "cancelled", label: "Cancelada" },
];

const phaseOptions = [
  { value: "execution", label: "Execução" },
  { value: "project", label: "Fase Projeto" },
];

const criticalityOptions = [
  { value: "overdue", label: "Com itens em atraso" },
  { value: "blocked", label: "Bloqueada / Pausada" },
  { value: "stale", label: "Sem atualização (7d+)" },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function PortfolioAdvancedFilters({
  open,
  onOpenChange,
  filters,
  onApply,
  projects,
}: PortfolioAdvancedFiltersProps) {
  const [draft, setDraft] = useState<AdvancedFilters>(filters);

  // Reset draft when opening
  const handleOpenChange = (o: boolean) => {
    if (o) setDraft(filters);
    onOpenChange(o);
  };

  // Extract unique values from projects for dynamic options
  const engineers = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p) => {
      if (p.engineer_name) set.add(p.engineer_name);
    });
    return Array.from(set).sort();
  }, [projects]);

  const toggleArray = (arr: string[], value: string) =>
    arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];

  const activeCount = [
    draft.status.length,
    draft.phase.length,
    draft.engineers.length,
    draft.criticality.length,
    draft.hasPendingDocs !== null ? 1 : 0,
    draft.hasPendingSign !== null ? 1 : 0,
    draft.dateRange.from || draft.dateRange.to ? 1 : 0,
    draft.contractMin !== null || draft.contractMax !== null ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-[420px] p-0 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
          <SheetHeader className="space-y-0">
            <SheetTitle className="flex items-center gap-2 text-base">
              <SlidersHorizontal className="h-4 w-4" />
              Filtros Avançados
              {activeCount > 0 && (
                <Badge
                  variant="secondary"
                  className="h-5 px-1.5 text-[10px] font-bold"
                >
                  {activeCount}
                </Badge>
              )}
            </SheetTitle>
          </SheetHeader>
          {!isFiltersEmpty(draft) && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-destructive h-7"
              onClick={() => setDraft(emptyFilters)}
            >
              Limpar tudo
            </Button>
          )}
        </div>

        {/* Body */}
        <ScrollArea className="flex-1">
          <div className="px-6 py-4 space-y-6">
            {/* Status */}
            <FilterSection title="Status">
              <div className="flex flex-wrap gap-1.5">
                {statusOptions.map((o) => (
                  <ToggleChip
                    key={o.value}
                    label={o.label}
                    selected={draft.status.includes(o.value)}
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        status: toggleArray(d.status, o.value),
                      }))
                    }
                  />
                ))}
              </div>
            </FilterSection>

            {/* Phase */}
            <FilterSection title="Fase">
              <div className="flex flex-wrap gap-1.5">
                {phaseOptions.map((o) => (
                  <ToggleChip
                    key={o.value}
                    label={o.label}
                    selected={draft.phase.includes(o.value)}
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        phase: toggleArray(d.phase, o.value),
                      }))
                    }
                  />
                ))}
              </div>
            </FilterSection>

            {/* Engineer */}
            {engineers.length > 0 && (
              <FilterSection title="Engenheiro">
                <div className="flex flex-wrap gap-1.5">
                  {engineers.map((name) => (
                    <ToggleChip
                      key={name}
                      label={name.split(" ")[0]}
                      selected={draft.engineers.includes(name)}
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          engineers: toggleArray(d.engineers, name),
                        }))
                      }
                    />
                  ))}
                </div>
              </FilterSection>
            )}

            {/* Docs / Signatures */}
            <FilterSection title="Documentação">
              <div className="flex flex-wrap gap-1.5">
                <ToggleChip
                  label="Docs pendentes"
                  selected={draft.hasPendingDocs === true}
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      hasPendingDocs: d.hasPendingDocs === true ? null : true,
                    }))
                  }
                />
                <ToggleChip
                  label="Assinatura pendente"
                  selected={draft.hasPendingSign === true}
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      hasPendingSign: d.hasPendingSign === true ? null : true,
                    }))
                  }
                />
              </div>
            </FilterSection>

            {/* Criticality */}
            <FilterSection title="Criticidade">
              <div className="flex flex-wrap gap-1.5">
                {criticalityOptions.map((o) => (
                  <ToggleChip
                    key={o.value}
                    label={o.label}
                    selected={draft.criticality.includes(o.value)}
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        criticality: toggleArray(d.criticality, o.value),
                      }))
                    }
                  />
                ))}
              </div>
            </FilterSection>

            <Separator />

            {/* Date range */}
            <FilterSection title="Período (data de término)">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">
                    De
                  </Label>
                  <Input
                    type="date"
                    value={draft.dateRange.from ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        dateRange: {
                          ...d.dateRange,
                          from: e.target.value || null,
                        },
                      }))
                    }
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">
                    Até
                  </Label>
                  <Input
                    type="date"
                    value={draft.dateRange.to ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        dateRange: {
                          ...d.dateRange,
                          to: e.target.value || null,
                        },
                      }))
                    }
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </FilterSection>

            {/* Financial range */}
            <FilterSection title="Faixa de Contrato">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">
                    Mínimo (R$)
                  </Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={draft.contractMin ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        contractMin: e.target.value
                          ? Number(e.target.value)
                          : null,
                      }))
                    }
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">
                    Máximo (R$)
                  </Label>
                  <Input
                    type="number"
                    placeholder="∞"
                    value={draft.contractMax ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        contractMax: e.target.value
                          ? Number(e.target.value)
                          : null,
                      }))
                    }
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </FilterSection>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/40 bg-muted/10 flex items-center gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => handleOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            className="flex-1 gap-1.5"
            onClick={() => {
              onApply(draft);
              handleOpenChange(false);
            }}
          >
            <Check className="h-3.5 w-3.5" />
            Aplicar filtros
            {activeCount > 0 && (
              <Badge
                variant="secondary"
                className="ml-1 h-5 px-1.5 text-[10px] bg-primary-foreground/20 text-primary-foreground"
              >
                {activeCount}
              </Badge>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h4>
      {children}
    </div>
  );
}

function ToggleChip({
  label,
  selected,
  onClick,
  dot,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  dot?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "border",
        selected
          ? "bg-primary text-primary-foreground border-primary shadow-sm"
          : "bg-background text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground",
      )}
    >
      {dot && <span className={cn("h-2 w-2 rounded-full shrink-0", dot)} />}
      {selected && <Check className="h-3 w-3 shrink-0" />}
      {label}
    </button>
  );
}
