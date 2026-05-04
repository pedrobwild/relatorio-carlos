import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseLocalDate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerFieldProps {
  value: string; // ISO date string YYYY-MM-DD or empty
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  hasError?: boolean;
  disabled?: boolean;
}

export function DatePickerField({
  value,
  onChange,
  placeholder = "Selecionar data",
  id,
  hasError,
  disabled,
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  // Calendar input arrives as YYYY-MM-DD; parse as local to keep the same calendar day.
  const selectedDate = value ? parseLocalDate(value) : undefined;

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      const y = date.getFullYear();
      const m = (date.getMonth() + 1).toString().padStart(2, "0");
      const d = date.getDate().toString().padStart(2, "0");
      onChange(`${y}-${m}-${d}`);
    }
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal h-10",
            !value && "text-muted-foreground",
            hasError && "border-destructive",
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          {selectedDate ? (
            <span className="tabular-nums">
              {format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}
            </span>
          ) : (
            <span>{placeholder}</span>
          )}
          {value && (
            <X
              className="ml-auto h-3.5 w-3.5 text-muted-foreground hover:text-destructive shrink-0"
              onClick={handleClear}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          locale={ptBR}
          initialFocus
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
}
