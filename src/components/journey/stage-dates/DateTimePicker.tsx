import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function TimePicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <Input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 w-[120px] text-sm font-mono"
      aria-label="Horário"
      disabled={disabled}
    />
  );
}

interface DateTimePickerProps {
  date: Date | undefined;
  time: string;
  onDateChange: (d: Date | undefined) => void;
  onTimeChange: (t: string) => void;
  label: string;
  disabled?: boolean;
  disablePastDates?: boolean;
}

export function DateTimePicker({
  date,
  time,
  onDateChange,
  onTimeChange,
  label,
  disabled,
  disablePastDates,
}: DateTimePickerProps) {
  return (
    <fieldset className="flex items-center gap-2 flex-wrap" disabled={disabled}>
      <legend className="sr-only">{label}</legend>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-11 text-xs flex-1 min-w-[140px] justify-start",
              !date && "text-muted-foreground",
            )}
            disabled={disabled}
            aria-label="Selecionar data"
          >
            <CalendarIcon className="h-3.5 w-3.5 mr-1.5 shrink-0" />
            {date ? format(date, "dd/MM/yyyy") : label}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={onDateChange}
            disabled={
              disablePastDates
                ? (d) => d < new Date(new Date().setHours(0, 0, 0, 0))
                : undefined
            }
            className="p-3 pointer-events-auto"
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>
      <TimePicker value={time} onChange={onTimeChange} disabled={disabled} />
    </fieldset>
  );
}
