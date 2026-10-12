/**
 * Etiqueta da situação de uma etapa da fase de projeto ("Atrasada há 4 dias",
 * "Vence amanhã", "Sem prazo"…). Mesmas cores de risco do resto do Painel, e
 * nunca só a cor: a etiqueta sempre leva o texto.
 */
import { cn } from "@/lib/utils";
import type { PhaseVerdict, PhaseVerdictKind } from "@/lib/faseProjeto";

const TONE: Record<PhaseVerdictKind, string> = {
  atrasada: "border-destructive/20 bg-destructive/10 text-destructive",
  vence_logo: "border-warning/30 bg-warning/10 text-warning",
  no_prazo: "border-success/20 bg-success/10 text-success",
  pronta: "border-success/20 bg-success/10 text-success",
  sem_prazo: "border-border bg-muted text-muted-foreground",
};

export function FaseChip({ verdict, className }: { verdict: PhaseVerdict; className?: string }) {
  return (
    <span
      data-verdict={verdict.verdict}
      className={cn(
        // Sem `nowrap`: numa coluna estreita a etiqueta quebra a linha em vez de invadir a vizinha.
        "inline-block max-w-full rounded-full border px-2 py-0.5 text-xs font-medium",
        TONE[verdict.verdict],
        className,
      )}
    >
      {verdict.text}
    </span>
  );
}
