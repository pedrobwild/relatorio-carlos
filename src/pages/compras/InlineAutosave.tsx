import { useState, type ReactNode } from "react";
import { Loader2, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * Padrão único de autosave para campos da lista de compras (linha + colapsado).
 *
 * Regras:
 * - Salva APENAS quando o valor muda (evita writes inúteis em blur sem edição).
 * - Sempre exibe o mesmo indicador visual: spinner enquanto salva → check verde
 *   por ~1.2s ao concluir → idle.
 * - Em caso de erro durante o save, retorna ao estado idle (o toast/handler
 *   global cuida da mensagem).
 */
export type SaveState = "idle" | "saving" | "saved";

/* ─── Indicador visual reutilizável ─── */
export function AutosaveStatusIcon({
  state,
  className,
}: {
  state: SaveState;
  className?: string;
}) {
  if (state === "saving") {
    return (
      <Loader2
        aria-label="Salvando"
        className={cn(
          "h-3 w-3 animate-spin text-muted-foreground pointer-events-none",
          className,
        )}
      />
    );
  }
  if (state === "saved") {
    return (
      <Check
        aria-label="Salvo"
        className={cn(
          "h-3 w-3 text-[hsl(var(--success))] pointer-events-none",
          className,
        )}
      />
    );
  }
  return null;
}

/**
 * Hook compartilhado: encapsula a transição idle → saving → saved
 * e o no-op quando o valor não mudou.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useFieldAutosave(
  currentValue: string | number | null | undefined,
) {
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const runSave = async (
    newVal: string,
    onSave: (val: string) => void | Promise<void>,
  ) => {
    const oldVal = currentValue == null ? "" : String(currentValue);
    if (newVal === oldVal) return; // nada mudou → não salva
    setSaveState("saving");
    try {
      await onSave(newVal);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1200);
    } catch {
      setSaveState("idle");
    }
  };

  return { saveState, runSave };
}

/* ─── Inline Editable Input ─── */
export function InlineField({
  type = "text",
  value,
  placeholder,
  onSave,
  className,
  prefix,
  inputClassName,
  inputMode,
}: {
  type?: "text" | "number" | "date";
  value: string | number | null;
  placeholder?: string;
  onSave: (val: string) => void | Promise<void>;
  className?: string;
  prefix?: string;
  inputClassName?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  // Re-mount quando o valor externo muda para manter defaultValue em sincronia.
  const stableKey = `${value ?? ""}`;
  const { saveState, runSave } = useFieldAutosave(value);

  return (
    <div className={cn("relative", className)}>
      {prefix && (
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
          {prefix}
        </span>
      )}
      <Input
        key={stableKey}
        type={type}
        inputMode={inputMode}
        className={cn(
          "h-8 text-sm bg-transparent border-transparent hover:border-input focus:border-input transition-colors",
          prefix && "pl-7",
          saveState !== "idle" && "pr-7",
          inputClassName,
        )}
        placeholder={placeholder}
        defaultValue={value ?? ""}
        onBlur={(e) => runSave(e.target.value, onSave)}
      />
      <AutosaveStatusIcon
        state={saveState}
        className="absolute right-2 top-1/2 -translate-y-1/2"
      />
    </div>
  );
}

/* ─── Inline Editable Textarea ─── */
export function InlineTextarea({
  value,
  placeholder,
  onSave,
  rows = 2,
  className,
}: {
  value: string | null;
  placeholder?: string;
  onSave: (val: string) => void | Promise<void>;
  rows?: number;
  className?: string;
}) {
  const stableKey = `${value ?? ""}`;
  const { saveState, runSave } = useFieldAutosave(value);

  return (
    <div className="relative">
      <Textarea
        key={stableKey}
        rows={rows}
        className={cn(
          "text-sm bg-transparent border-input/40 hover:border-input focus:border-input transition-colors resize-none",
          saveState !== "idle" && "pr-7",
          className,
        )}
        placeholder={placeholder}
        defaultValue={value ?? ""}
        onBlur={(e) => runSave(e.target.value, onSave)}
      />
      <AutosaveStatusIcon
        state={saveState}
        className="absolute right-2 top-2"
      />
    </div>
  );
}

/* ─── Inline Editable Select ─── */
export function InlineSelect({
  value,
  onSave,
  placeholder,
  triggerClassName,
  children,
}: {
  value: string | null;
  onSave: (val: string | null) => void | Promise<void>;
  placeholder?: string;
  triggerClassName?: string;
  /** Conteúdo (SelectItem...) a ser renderizado dentro do SelectContent. */
  children: ReactNode;
}) {
  const { saveState, runSave } = useFieldAutosave(value);

  const handleChange = (next: string) => {
    // Convenção: 'none' → limpar campo (null).
    runSave(next, async (val) => {
      await onSave(val === "none" ? null : val);
    });
  };

  return (
    <div className="relative">
      <Select value={value || "none"} onValueChange={handleChange}>
        <SelectTrigger
          className={cn(
            "h-8 text-sm",
            saveState !== "idle" && "pr-9",
            triggerClassName,
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
      {saveState !== "idle" && (
        <span className="absolute right-7 top-1/2 -translate-y-1/2">
          <AutosaveStatusIcon state={saveState} />
        </span>
      )}
    </div>
  );
}
