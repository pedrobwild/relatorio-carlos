import { Building2, Calendar, DollarSign, User, MapPin, Check, Circle, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { FormData } from './types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface StickySummaryProps {
  formData: FormData;
  currentStep: number;
  completedSteps: Set<number>;
}

const formatDate = (d: string) => {
  if (!d) return null;
  try {
    return format(new Date(d + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return d;
  }
};

const formatCurrency = (v: string) => {
  if (!v) return null;
  const num = parseFloat(v);
  if (isNaN(num)) return null;
  return `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
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

function Section({ icon, label, stepIndex, currentStep, completedSteps, children, hasContent }: SectionProps) {
  const isCurrent = currentStep === stepIndex;
  const isCompleted = completedSteps.has(stepIndex);

  return (
    <div className={cn(
      'rounded-lg border p-3 transition-all text-sm',
      isCurrent && 'border-primary/40 bg-primary/5 ring-1 ring-primary/20',
      isCompleted && !isCurrent && 'border-border bg-muted/30',
      !isCurrent && !isCompleted && 'border-border/50 bg-transparent opacity-60',
    )}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className={cn(
          'shrink-0',
          isCurrent ? 'text-primary' : isCompleted ? 'text-primary/70' : 'text-muted-foreground',
        )}>
          {icon}
        </span>
        <span className={cn(
          'text-xs font-semibold uppercase tracking-wide',
          isCurrent ? 'text-primary' : 'text-muted-foreground',
        )}>
          {label}
        </span>
        {isCompleted && (
          <Check className="h-3.5 w-3.5 text-primary ml-auto" />
        )}
        {isCurrent && !isCompleted && (
          <Circle className="h-2.5 w-2.5 fill-primary text-primary ml-auto animate-pulse" />
        )}
      </div>
      <div className="text-xs text-muted-foreground space-y-0.5 ml-6">
        {hasContent ? children : (
          <p className="italic">Pendente</p>
        )}
      </div>
    </div>
  );
}

export function StickySummary({ formData, currentStep, completedSteps }: StickySummaryProps) {
  const navigate = useNavigate();
  const hasProject = !!formData.name;
  const hasSchedule = !!formData.planned_start_date || !!formData.planned_end_date || formData.is_project_phase;
  const hasFinancial = !!formData.contract_value;
  const hasCustomer = !!formData.customer_name;

  const handleSaveDraft = () => {
    toast.success('Rascunho salvo! Você pode continuar depois.');
    navigate('/gestao');
  };

  return (
    <div className="hidden lg:block w-72 shrink-0">
      <div className="sticky top-20 space-y-2.5">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 px-1">
          Resumo
        </p>

        {/* Step 0 — Dados Básicos */}
        <Section
          icon={<Building2 className="h-4 w-4" />}
          label="Dados Básicos"
          stepIndex={0}
          currentStep={currentStep}
          completedSteps={completedSteps}
          hasContent={hasProject}
        >
          <p className="font-medium text-foreground">{formData.name}</p>
          {formData.unit_name && <p>{formData.unit_name}</p>}
          {(formData.address || formData.bairro) && (
            <p className="flex items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              {[formData.address, formData.bairro].filter(Boolean).join(', ')}
            </p>
          )}
        </Section>

        {/* Step 1 — Cronograma */}
        <Section
          icon={<Calendar className="h-4 w-4" />}
          label="Cronograma"
          stepIndex={1}
          currentStep={currentStep}
          completedSteps={completedSteps}
          hasContent={hasSchedule}
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

        {/* Step 2 — Orçamento */}
        <Section
          icon={<DollarSign className="h-4 w-4" />}
          label="Orçamento"
          stepIndex={2}
          currentStep={currentStep}
          completedSteps={completedSteps}
          hasContent={hasFinancial}
        >
          <p className="font-medium text-foreground">{formatCurrency(formData.contract_value)}</p>
        </Section>

        {/* Step 3 — Cliente */}
        <Section
          icon={<User className="h-4 w-4" />}
          label="Cliente"
          stepIndex={3}
          currentStep={currentStep}
          completedSteps={completedSteps}
          hasContent={hasCustomer}
        >
          <p className="font-medium text-foreground">{formData.customer_name}</p>
          {formData.customer_email && <p>{formData.customer_email}</p>}
        </Section>
        {/* Save Draft Button */}
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
