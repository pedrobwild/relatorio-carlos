import { useState } from "react";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDate, toISODate } from "./utils";

interface EditableDateCellProps {
  value: string;
  baseYear: number;
  activityId: string;
  field: "actual_start" | "actual_end";
  onSave: (
    activityId: string,
    updates: { actual_start?: string | null; actual_end?: string | null },
  ) => Promise<boolean>;
}

/** Desktop inline date cell with popover picker */
export function EditableDateCell({
  value,
  baseYear,
  activityId,
  field,
  onSave,
}: EditableDateCellProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const currentDate = value ? new Date(value + "T00:00:00") : undefined;

  const handleSelect = async (date: Date | undefined) => {
    setSaving(true);
    try {
      await onSave(activityId, { [field]: date ? toISODate(date) : null });
    } catch {
      // error handled by caller
    } finally {
      setSaving(false);
      setOpen(false);
    }
  };

  const handleClear = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSaving(true);
    try {
      await onSave(activityId, { [field]: null });
    } catch {
      // error handled by caller
    } finally {
      setSaving(false);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm tabular-nums transition-all min-h-[44px]",
            "hover:bg-primary/10 hover:text-primary cursor-pointer group",
            value ? "font-medium text-foreground" : "text-muted-foreground",
            saving && "opacity-50 pointer-events-none",
          )}
          title={`Clique para ${value ? "alterar" : "definir"} a data`}
        >
          {value ? formatDate(value, baseYear) : "—"}
          <CalendarIcon className="w-3 h-3 opacity-0 group-hover:opacity-70 transition-opacity shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="center" sideOffset={4}>
        <div className="p-2 pb-0 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            {field === "actual_start" ? "Início Real" : "Término Real"}
          </span>
          {value && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleClear}
            >
              <X className="w-3 h-3 mr-1" /> Limpar
            </Button>
          )}
        </div>
        <Calendar
          mode="single"
          selected={currentDate}
          onSelect={handleSelect}
          locale={ptBR}
          initialFocus
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
}

interface EditableDateCellMobileProps extends EditableDateCellProps {
  label: string;
}

/** Mobile date cell with popover picker */
export function EditableDateCellMobile({
  value,
  baseYear,
  activityId,
  field,
  label,
  onSave,
}: EditableDateCellMobileProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const currentDate = value ? new Date(value + "T00:00:00") : undefined;

  const handleSelect = async (date: Date | undefined) => {
    setSaving(true);
    try {
      await onSave(activityId, { [field]: date ? toISODate(date) : null });
    } catch {
      // error handled by caller
    } finally {
      setSaving(false);
      setOpen(false);
    }
  };

  const handleClear = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSaving(true);
    try {
      await onSave(activityId, { [field]: null });
    } catch {
      // error handled by caller
    } finally {
      setSaving(false);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "w-full text-left bg-muted/40 rounded-md px-2 py-1.5 transition-all",
            "hover:bg-primary/10 hover:ring-1 hover:ring-primary/30 cursor-pointer",
            saving && "opacity-50 pointer-events-none",
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-0.5 flex items-center gap-1">
            {label} <CalendarIcon className="w-2.5 h-2.5" />
          </p>
          <p
            className={cn(
              "text-xs font-semibold tabular-nums",
              value ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {value ? formatDate(value, baseYear) : "Toque para definir"}
          </p>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" sideOffset={4}>
        <div className="p-2 pb-0 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            {label}
          </span>
          {value && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleClear}
            >
              <X className="w-3 h-3 mr-1" /> Limpar
            </Button>
          )}
        </div>
        <Calendar
          mode="single"
          selected={currentDate}
          onSelect={handleSelect}
          locale={ptBR}
          initialFocus
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
}
