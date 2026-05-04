import {
  Building2,
  Calendar,
  DollarSign,
  User,
  MapPin,
  Check,
  Circle,
  Save,
  HeartPulse,
  Home,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { FormData } from "./types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useMemo } from "react";

interface StickySummaryProps {
  formData: FormData;
  currentStep: number;
  completedSteps: Set<number>;
}

const formatDate = (d: string) => {
  if (!d) return null;
  try {
    return format(new Date(d + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return d;
  }
};

const formatCurrency = (v: string) => {
  if (!v) return null;
  const num = parseFloat(v);
  if (isNaN(num)) return null;
  return `R$ ${num.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
};

interface SectionProps {
  icon: React.ReactNode;
  label: string;
  stepIndex: number;
  currentStep: number;
  completedSteps: Set<number>;
  children: React.ReactNode;
  hasContent: boolean;
}

function Section({
  icon,
  label,
  stepIndex,
  currentStep,
  completedSteps,
  children,
  hasContent,
}: SectionProps) {
  const isCurrent = currentStep === stepIndex;
  const isCompleted = completedSteps.has(stepIndex);

  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-all text-sm",
        isCurrent && "border-primary/40 bg-primary/5 ring-1 ring-primary/20",
        isCompleted && !isCurrent && "border-border bg-muted/30",
        !isCurrent &&
          !isCompleted &&
          "border-border/50 bg-transparent opacity-60",
      )}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className={cn(
            "shrink-0",
            isCurrent
              ? "text-primary"
              : isCompleted
                ? "text-primary/70"
                : "text-muted-foreground",
          )}
        >
          {icon}
        </span>
        <span
          className={cn(
            "text-xs font-semibold uppercase tracking-wide",
            isCurrent ? "text-primary" : "text-muted-foreground",
          )}
        >
          {label}
        </span>
        {isCompleted && <Check className="h-3.5 w-3.5 text-primary ml-auto" />}
        {isCurrent && !isCompleted && (
          <Circle className="h-2.5 w-2.5 fill-primary text-primary ml-auto animate-pulse" />
        )}
      </div>
      <div className="text-xs text-muted-foreground space-y-0.5 ml-6">
        {hasContent ? children : <p className="italic">Pendente</p>}
      </div>
    </div>
  );
}

export function StickySummary({
  formData,
  currentStep,
  completedSteps,
}: StickySummaryProps) {
  const navigate = useNavigate();
  const hasCadastro = !!formData.name || !!formData.customer_name;
  const hasComercial = !!formData.contract_value || formData.budget_uploaded;
  const hasPlanejamento =
    !!formData.planned_start_date ||
    !!formData.planned_end_date ||
    formData.is_project_phase;
  const hasReview = hasCadastro && hasComercial;

  const healthPreview = useMemo(() => {
    const completeness = [
      hasCadastro,
      hasComercial,
      hasPlanejamento,
      hasReview,
    ].filter(Boolean).length;
    const pct = Math.round((completeness / 4) * 100);
    const missingFields: string[] = [];
    if (!hasCadastro) missingFields.push("Cadastro Base");
    if (!hasComercial) missingFields.push("Comercial");
    if (!hasPlanejamento) missingFields.push("Planejamento");
    return { pct, missingFields };
  }, [hasCadastro, hasComercial, hasPlanejamento, hasReview]);

  const handleSaveDraft = () => {
    toast.success("Rascunho salvo! Você pode continuar depois.");
    navigate("/gestao");
  };

  return (
    <div className="hidden md:block w-72 shrink-0">
      <div
        className={cn(
          "space-y-2.5",
          "lg:sticky lg:top-20",
          "md:max-lg:rounded-xl md:max-lg:border md:max-lg:border-border/50 md:max-lg:bg-card md:max-lg:p-4",
        )}
      >
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 px-1">
          Resumo
        </p>

        {/* Step 0 — Cadastro Base */}
        <Section
          icon={<Building2 className="h-4 w-4" />}
          label="Cadastro Base"
          stepIndex={0}
          currentStep={currentStep}
          completedSteps={completedSteps}
          hasContent={!!formData.name || !!formData.customer_name}
        >
          {formData.name && (
            <p className="font-medium text-foreground">{formData.name}</p>
          )}
          {formData.unit_name && <p>{formData.unit_name}</p>}
          {formData.customer_name && <p>{formData.customer_name}</p>}
          {(formData.address || formData.bairro) && (
            <p className="flex items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              {[formData.address, formData.bairro].filter(Boolean).join(", ")}
            </p>
          )}
        </Section>

        {/* Step 1 — Comercial */}
        <Section
          icon={<DollarSign className="h-4 w-4" />}
          label="Comercial"
          stepIndex={1}
          currentStep={currentStep}
          completedSteps={completedSteps}
          hasContent={hasComercial}
        >
          <p className="font-medium text-foreground">
            {formatCurrency(formData.contract_value)}
          </p>
          {formData.payment_method && (
            <p>
              {formData.payment_method === "pix"
                ? "PIX"
                : formData.payment_method === "boleto"
                  ? "Boleto"
                  : formData.payment_method}
            </p>
          )}
          {formData.budget_uploaded && (
            <p className="flex items-center gap-1 text-primary">
              <Check className="h-3 w-3" /> Orçamento anexado
            </p>
          )}
        </Section>

        {/* Step 2 — Planejamento */}
        <Section
          icon={<Calendar className="h-4 w-4" />}
          label="Planejamento"
          stepIndex={2}
          currentStep={currentStep}
          completedSteps={completedSteps}
          hasContent={hasPlanejamento}
        >
          {formData.is_project_phase && !formData.planned_start_date ? (
            <p>Fase de projeto — datas em definição</p>
          ) : (
            <>
              {formData.planned_start_date && (
                <p>Início: {formatDate(formData.planned_start_date)}</p>
              )}
              {formData.planned_end_date && (
                <p>Término: {formatDate(formData.planned_end_date)}</p>
              )}
              {formData.business_days_duration && (
                <p>{formData.business_days_duration} dias úteis</p>
              )}
            </>
          )}
        </Section>

        {/* Step 3 — Revisão */}
        <Section
          icon={<Check className="h-4 w-4" />}
          label="Revisão"
          stepIndex={3}
          currentStep={currentStep}
          completedSteps={completedSteps}
          hasContent={false}
        >
          <p className="italic">Pendente</p>
        </Section>

        {/* Health Preview */}
        <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <HeartPulse className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Completude
            </span>
            <span
              className={cn(
                "ml-auto text-sm font-bold tabular-nums",
                healthPreview.pct === 100
                  ? "text-[hsl(var(--success))]"
                  : healthPreview.pct >= 50
                    ? "text-[hsl(var(--warning))]"
                    : "text-destructive",
              )}
            >
              {healthPreview.pct}%
            </span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                healthPreview.pct === 100
                  ? "bg-[hsl(var(--success))]"
                  : healthPreview.pct >= 50
                    ? "bg-[hsl(var(--warning))]"
                    : "bg-destructive",
              )}
              style={{ width: `${healthPreview.pct}%` }}
            />
          </div>
          {healthPreview.missingFields.length > 0 && (
            <p className="text-[10px] text-muted-foreground/70">
              Faltam: {healthPreview.missingFields.join(", ")}
            </p>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2 text-xs mt-3"
          onClick={handleSaveDraft}
        >
          <Save className="h-3.5 w-3.5" />
          Continuar depois
        </Button>
      </div>
    </div>
  );
}
