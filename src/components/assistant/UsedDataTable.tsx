import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Table as TableIcon } from "lucide-react";

interface Props {
  rows: Record<string, unknown>[];
  rowsReturned?: number;
  defaultOpen?: boolean;
}

const NUMERIC_HINTS = [
  "amount",
  "valor",
  "total",
  "estimated_cost",
  "actual_cost",
  "value",
  "weight",
];

const fmtCell = (v: unknown, key: string): string => {
  if (v == null || v === "") return "—";
  const lower = key.toLowerCase();
  if (NUMERIC_HINTS.some((h) => lower.includes(h))) {
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n)) {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 2,
      }).format(n);
    }
  }
  if (/(date|_at|deadline)$/i.test(key)) {
    const d = new Date(String(v));
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("pt-BR");
  }
  return typeof v === "object" ? JSON.stringify(v) : String(v);
};

export function UsedDataTable({
  rows,
  rowsReturned,
  defaultOpen = false,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const cols = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows.slice(0, 50))
      for (const k of Object.keys(r)) set.add(k);
    return [...set];
  }, [rows]);

  if (!rows || rows.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className="h-7 px-2 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
      >
        {open ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        <TableIcon className="h-3 w-3" />
        Ver dados utilizados ({rowsReturned ?? rows.length} linhas)
      </Button>
      {open && (
        <div className="overflow-x-auto rounded-md border bg-card max-h-[360px]">
          <Table>
            <TableHeader>
              <TableRow>
                {cols.map((c) => (
                  <TableHead
                    key={c}
                    className="text-[11px] uppercase tracking-wide whitespace-nowrap"
                  >
                    {c}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 50).map((r, i) => (
                <TableRow key={i}>
                  {cols.map((c) => (
                    <TableCell key={c} className="text-xs whitespace-nowrap">
                      {fmtCell(r[c], c)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
