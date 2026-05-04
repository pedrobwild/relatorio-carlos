import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, CalendarDays, Percent, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PaymentInstallment {
  id?: string;
  installment_number: number;
  description: string;
  percentage: number;
  amount: number;
  due_date: string;
}

interface Props {
  totalValue: number;
  startDate: string;
  endDate: string;
  installments: PaymentInstallment[];
  onChange: (installments: PaymentInstallment[]) => void;
}

const PRESETS = [
  {
    label: "100% à vista",
    splits: [
      { pct: 100, desc: "Pagamento integral", dateRef: "start" as const },
    ],
  },
  {
    label: "50/50",
    splits: [
      { pct: 50, desc: "Entrada (início)", dateRef: "start" as const },
      { pct: 50, desc: "Conclusão", dateRef: "end" as const },
    ],
  },
  {
    label: "30/40/30",
    splits: [
      { pct: 30, desc: "Entrada (início)", dateRef: "start" as const },
      { pct: 40, desc: "Medição parcial", dateRef: "mid" as const },
      { pct: 30, desc: "Conclusão", dateRef: "end" as const },
    ],
  },
  {
    label: "40/30/30",
    splits: [
      { pct: 40, desc: "Entrada (início)", dateRef: "start" as const },
      { pct: 30, desc: "Medição parcial", dateRef: "mid" as const },
      { pct: 30, desc: "Conclusão", dateRef: "end" as const },
    ],
  },
];

function midDate(start: string, end: string): string {
  if (!start || !end) return start || "";
  const s = new Date(start + "T00:00:00").getTime();
  const e = new Date(end + "T00:00:00").getTime();
  const mid = new Date(s + (e - s) / 2);
  return mid.toISOString().slice(0, 10);
}

function resolveDate(
  ref: "start" | "mid" | "end",
  start: string,
  end: string,
): string {
  if (ref === "start") return start || "";
  if (ref === "end") return end || "";
  return midDate(start, end);
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    v,
  );

export function PaymentScheduleSection({
  totalValue,
  startDate,
  endDate,
  installments,
  onChange,
}: Props) {
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const applyPreset = (presetLabel: string) => {
    const preset = PRESETS.find((p) => p.label === presetLabel);
    if (!preset) return;
    setActivePreset(presetLabel);
    const newInstallments: PaymentInstallment[] = preset.splits.map((s, i) => ({
      installment_number: i + 1,
      description: s.desc,
      percentage: s.pct,
      amount: Math.round(((totalValue * s.pct) / 100) * 100) / 100,
      due_date: resolveDate(s.dateRef, startDate, endDate),
    }));
    onChange(newInstallments);
  };

  const addInstallment = () => {
    setActivePreset(null);
    const remaining =
      100 - installments.reduce((sum, i) => sum + (i.percentage || 0), 0);
    const remainingAmt =
      totalValue - installments.reduce((sum, i) => sum + (i.amount || 0), 0);
    onChange([
      ...installments,
      {
        installment_number: installments.length + 1,
        description: `Parcela ${installments.length + 1}`,
        percentage: Math.max(0, remaining),
        amount: Math.max(0, Math.round(remainingAmt * 100) / 100),
        due_date: endDate || "",
      },
    ]);
  };

  const removeInstallment = (idx: number) => {
    setActivePreset(null);
    const updated = installments
      .filter((_, i) => i !== idx)
      .map((inst, i) => ({ ...inst, installment_number: i + 1 }));
    onChange(updated);
  };

  const updateInstallment = (
    idx: number,
    field: keyof PaymentInstallment,
    value: string | number,
  ) => {
    setActivePreset(null);
    const updated = [...installments];
    const inst = { ...updated[idx] };

    if (field === "percentage") {
      const pct = Math.min(100, Math.max(0, Number(value)));
      inst.percentage = pct;
      inst.amount = Math.round(((totalValue * pct) / 100) * 100) / 100;
    } else if (field === "amount") {
      const amt = Math.max(0, Number(value));
      inst.amount = amt;
      inst.percentage =
        totalValue > 0 ? Math.round((amt / totalValue) * 10000) / 100 : 0;
    } else {
      (inst as any)[field] = value;
    }

    updated[idx] = inst;
    onChange(updated);
  };

  const totalPct = installments.reduce(
    (sum, i) => sum + (i.percentage || 0),
    0,
  );
  const totalAmt = installments.reduce((sum, i) => sum + (i.amount || 0), 0);
  const isBalanced = Math.abs(totalPct - 100) < 0.5;

  return (
    <div className="col-span-2 space-y-3 rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5 text-sm font-semibold">
          <CalendarDays className="h-4 w-4 text-primary" />
          Cronograma de Pagamentos
        </Label>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => applyPreset(p.label)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium border transition-all",
              activePreset === p.label
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border hover:border-primary/40 text-muted-foreground hover:text-foreground",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Installments */}
      {installments.length > 0 && (
        <div className="space-y-2">
          {installments.map((inst, idx) => (
            <div
              key={idx}
              className="grid grid-cols-[1fr_80px_100px_110px_32px] gap-2 items-end"
            >
              <div>
                {idx === 0 && (
                  <Label className="text-[11px] text-muted-foreground mb-1 block">
                    Descrição
                  </Label>
                )}
                <Input
                  value={inst.description}
                  onChange={(e) =>
                    updateInstallment(idx, "description", e.target.value)
                  }
                  className="h-8 text-xs"
                  placeholder="Descrição"
                />
              </div>
              <div>
                {idx === 0 && (
                  <Label className="text-[11px] text-muted-foreground mb-1 flex items-center gap-0.5">
                    <Percent className="h-3 w-3" /> %
                  </Label>
                )}
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={inst.percentage || ""}
                  onChange={(e) =>
                    updateInstallment(idx, "percentage", e.target.value)
                  }
                  className="h-8 text-xs"
                />
              </div>
              <div>
                {idx === 0 && (
                  <Label className="text-[11px] text-muted-foreground mb-1 flex items-center gap-0.5">
                    <DollarSign className="h-3 w-3" /> Valor
                  </Label>
                )}
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={inst.amount || ""}
                  onChange={(e) =>
                    updateInstallment(idx, "amount", e.target.value)
                  }
                  className="h-8 text-xs"
                />
              </div>
              <div>
                {idx === 0 && (
                  <Label className="text-[11px] text-muted-foreground mb-1 block">
                    Vencimento
                  </Label>
                )}
                <Input
                  type="date"
                  value={inst.due_date}
                  onChange={(e) =>
                    updateInstallment(idx, "due_date", e.target.value)
                  }
                  className="h-8 text-xs"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => removeInstallment(idx)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}

          {/* Summary */}
          <div
            className={cn(
              "flex items-center justify-between rounded-md px-3 py-1.5 text-xs font-medium",
              isBalanced
                ? "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]"
                : "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]",
            )}
          >
            <span>
              Total: {totalPct.toFixed(1)}% — {fmt(totalAmt)}
            </span>
            {!isBalanced && <span>⚠ Soma ≠ 100%</span>}
          </div>
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full h-8 text-xs gap-1"
        onClick={addInstallment}
      >
        <Plus className="h-3.5 w-3.5" />
        Adicionar parcela
      </Button>
    </div>
  );
}
