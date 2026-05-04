import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { SortField, SortDirection } from "./types";

interface SortableHeaderProps {
  field: SortField;
  currentField: SortField | null;
  direction: SortDirection;
  onSort: (field: SortField) => void;
  children: React.ReactNode;
  className?: string;
}

export function SortableHeader({
  field,
  currentField,
  direction,
  onSort,
  children,
  className = "",
}: SortableHeaderProps) {
  const isActive = currentField === field;
  return (
    <TableHead
      className={`cursor-pointer select-none transition-all hover:bg-primary/10 group ${className}`}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center justify-center gap-1">
        <span className="truncate">{children}</span>
        {isActive ? (
          direction === "asc" ? (
            <ArrowUp className="w-3 h-3 shrink-0" />
          ) : (
            <ArrowDown className="w-3 h-3 shrink-0" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-50 shrink-0 transition-opacity" />
        )}
      </div>
    </TableHead>
  );
}
