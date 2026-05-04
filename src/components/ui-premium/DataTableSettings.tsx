/**
 * DataTableSettings — popover de personalização para DataTable.
 *
 * Combina visualmente:
 *  - Toggle de zebra striping
 *  - Seletor de densidade (compact / comfortable / spacious)
 *  - Checkboxes de visibilidade de colunas (required ficam fixas)
 *
 * Controlado pelo hook `useTablePreferences`. Persiste em localStorage.
 *
 * @example
 * const prefs = useTablePreferences('painel-obras', columns);
 * <DataTableSettings prefs={prefs} columns={columns} />
 */
import { Settings2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DataTableColumn, TableDensity } from "./DataTable";
import type { UseTablePreferencesReturn } from "./useTablePreferences";

interface DataTableSettingsProps<T> {
  prefs: UseTablePreferencesReturn;
  columns: DataTableColumn<T>[];
  /** Texto do botão (icon-only se omitido). */
  triggerLabel?: string;
  /** Mostra seletor de densidade. */
  showDensity?: boolean;
  /** Mostra toggle de zebra. */
  showZebra?: boolean;
  /** Mostra seção de colunas. */
  showColumns?: boolean;
  align?: "start" | "center" | "end";
}

const densityLabels: Record<TableDensity, string> = {
  compact: "Compacta",
  comfortable: "Confortável",
  spacious: "Espaçada",
};

function getColumnLabel<T>(col: DataTableColumn<T>): string {
  if (col.label) return col.label;
  if (typeof col.header === "string") return col.header;
  return col.id;
}

export function DataTableSettings<T>({
  prefs,
  columns,
  triggerLabel,
  showDensity = true,
  showZebra = true,
  showColumns = true,
  align = "end",
}: DataTableSettingsProps<T>) {
  const visibleSet = new Set(prefs.visibleColumnIds);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size={triggerLabel ? "sm" : "icon"}
          className="gap-2"
          aria-label="Personalizar tabela"
        >
          <Settings2 className="h-4 w-4" />
          {triggerLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-72 p-0 overflow-hidden"
        sideOffset={6}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
          <p className="text-sm font-semibold">Personalizar tabela</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
            onClick={prefs.reset}
            title="Restaurar padrão"
          >
            <RotateCcw className="h-3 w-3" />
            Padrão
          </Button>
        </div>

        <div className="px-4 py-3 space-y-3">
          {showZebra && (
            <div className="flex items-center justify-between">
              <Label
                htmlFor="dt-zebra"
                className="text-sm font-normal cursor-pointer"
              >
                Listras alternadas
              </Label>
              <Switch
                id="dt-zebra"
                checked={prefs.zebra}
                onCheckedChange={prefs.setZebra}
              />
            </div>
          )}

          {showDensity && (
            <div className="space-y-1.5">
              <Label className="text-sm font-normal">Densidade</Label>
              <Select
                value={prefs.density}
                onValueChange={(v) => prefs.setDensity(v as TableDensity)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    ["compact", "comfortable", "spacious"] as TableDensity[]
                  ).map((d) => (
                    <SelectItem key={d} value={d}>
                      {densityLabels[d]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {showColumns && columns.length > 0 && (
          <>
            <Separator />
            <div className="px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Colunas visíveis
              </p>
              <div className="max-h-64 overflow-y-auto -mx-1 pr-1">
                <ul className="space-y-1">
                  {columns.map((col) => {
                    const checked = visibleSet.has(col.id);
                    const disabled = !!col.required;
                    return (
                      <li key={col.id}>
                        <label
                          className={
                            "flex items-center gap-2 px-1 py-1.5 rounded-md text-sm cursor-pointer hover:bg-accent/50 " +
                            (disabled
                              ? "opacity-60 cursor-not-allowed hover:bg-transparent"
                              : "")
                          }
                        >
                          <Checkbox
                            checked={checked}
                            disabled={disabled}
                            onCheckedChange={() => prefs.toggleColumn(col.id)}
                          />
                          <span className="flex-1 truncate">
                            {getColumnLabel(col)}
                          </span>
                          {disabled && (
                            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                              Fixa
                            </span>
                          )}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
