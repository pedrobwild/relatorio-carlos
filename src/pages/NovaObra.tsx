import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Send, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useProjectTemplates, type ProjectTemplate, type TemplateActivity } from '@/hooks/useProjectTemplates';
import { addBusinessDays } from '@/lib/businessDays';

import { formSchema, initialFormData, type FormData } from './nova-obra/types';
import { useNovaObraSubmit } from './nova-obra/useNovaObraSubmit';
import { TemplateSelectorCard } from './nova-obra/TemplateSelectorCard';
import { ProjectInfoCard } from './nova-obra/ProjectInfoCard';
import { ScheduleCard, type ScheduleActivity, createEmptyActivity } from './nova-obra/ScheduleCard';
import { FinancialCard } from './nova-obra/FinancialCard';
import { CustomerCard } from './nova-obra/CustomerCard';
import { BudgetUploadCard } from './nova-obra/BudgetUploadCard';
import { ReviewSummary } from './nova-obra/ReviewSummary';
import { FormStepper, type Step } from '@/components/FormStepper';
import { StickySummary } from './nova-obra/StickySummary';
import { MobileSummarySheet } from './nova-obra/MobileSummarySheet';
import { cn } from '@/lib/utils';

const STEPS: Step[] = [
  { label: 'Dados Básicos', description: 'Nome, código e configurações iniciais do projeto (~2 min)' },
  { label: 'Cronograma', description: 'Datas de início/término e atividades planejadas (~3 min)' },
  { label: 'Orçamento', description: 'Valores que comporão o gráfico de saúde financeira (~1 min)' },
  { label: 'Cliente', description: 'Dados de acesso ao portal do cliente (~2 min)' },
];

// Fields required per step for validation gating
const STEP_REQUIRED_FIELDS: Record<number, (keyof FormData)[]> = {
  0: ['name'],
  1: [],
  2: [],
  3: ['customer_name', 'customer_email'],
};

const DRAFT_KEY = 'nova-obra-draft';

interface NovaObraDraft {
  formData: FormData;
  step: number;
  scheduleActivities?: ScheduleActivity[];
}

function loadDraft(): NovaObraDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.formData) return parsed;
  } catch { /* ignore */ }
  return null;
}

function saveDraft(formData: FormData, step: number, scheduleActivities: ScheduleActivity[]) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ formData, step, scheduleActivities, savedAt: Date.now() }));
  } catch { /* ignore */ }
}

function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}

export default function NovaObra() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: templates } = useProjectTemplates();
  const { submit, user } = useNovaObraSubmit();

  const draft = useMemo(() => loadDraft(), []);
  const [currentStep, setCurrentStep] = useState(draft?.step ?? 0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [sendInvite, setSendInvite] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<FormData>(draft?.formData ?? initialFormData);
  const [budgetFile, setBudgetFile] = useState<File | null>(null);
  const [scheduleActivities, setScheduleActivities] = useState<ScheduleActivity[]>(draft?.scheduleActivities ?? []);
  const [draftRestored, setDraftRestored] = useState(!!draft);

  // Auto-save draft on formData, activities or step change
  useEffect(() => {
    saveDraft(formData, currentStep, scheduleActivities);
  }, [formData, currentStep, scheduleActivities]);

  const templateTotalDays = useMemo(() => {
    if (!selectedTemplate?.default_activities) return 0;
    return (selectedTemplate.default_activities as TemplateActivity[]).reduce((s, a) => s + a.durationDays, 0);
  }, [selectedTemplate]);

  const autoCalculateEndDate = (startDateStr: string, durationStr?: string) => {
    const duration = parseInt(durationStr || formData.business_days_duration);
    if (!startDateStr || isNaN(duration) || duration <= 0) return;
    const start = new Date(startDateStr + 'T00:00:00');
    const end = addBusinessDays(start, duration - 1);
    setFormData(prev => ({ ...prev, planned_end_date: end.toISOString().split('T')[0] }));
  };

  const handleChange = (field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
    if (field === 'planned_start_date' && typeof value === 'string') {
      autoCalculateEndDate(value);
    }
    if (field === 'business_days_duration' && typeof value === 'string') {
      autoCalculateEndDate(formData.planned_start_date, value);
    }
  };

  const validateStep = useCallback((step: number): boolean => {
    const requiredFields = STEP_REQUIRED_FIELDS[step] || [];
    const newErrors: Record<string, string> = {};

    for (const field of requiredFields) {
      const value = formData[field];
      if (typeof value === 'string' && !value.trim()) {
        newErrors[field] = 'Campo obrigatório';
      }
    }

    // Step-specific validations
    if (step === 1 && !formData.is_project_phase) {
      if (!formData.planned_start_date) newErrors.planned_start_date = 'Data de início é obrigatória';
      if (!formData.planned_end_date) newErrors.planned_end_date = 'Data de término é obrigatória';
    }

    if (step === 2) {
      if (formData.contract_value) {
        const numVal = parseFloat(formData.contract_value);
        if (isNaN(numVal) || numVal < 0) {
          newErrors.contract_value = 'Valor do contrato inválido';
        }
      }
    }

    if (step === 3) {
      if (formData.customer_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.customer_email)) {
        newErrors.customer_email = 'E-mail inválido';
      }
      if (formData.create_user && formData.customer_password.length < 6) {
        newErrors.customer_password = 'Senha deve ter no mínimo 6 caracteres';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(prev => ({ ...prev, ...newErrors }));
      return false;
    }
    return true;
  }, [formData]);

  const goToStep = (target: number) => {
    // Can always go back
    if (target < currentStep) {
      setCurrentStep(target);
      return;
    }
    // Must validate current step to go forward
    if (validateStep(currentStep)) {
      setCompletedSteps(prev => new Set([...prev, currentStep]));
      setCurrentStep(target);
    } else {
      toast({ title: 'Preencha os campos obrigatórios', variant: 'destructive' });
    }
  };

  const handleNext = () => goToStep(currentStep + 1);
  const handleBack = () => goToStep(currentStep - 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ title: 'Erro', description: 'Você precisa estar logado', variant: 'destructive' });
      return;
    }

    // Validate final step
    if (!validateStep(currentStep)) {
      toast({ title: 'Erro de validação', description: 'Verifique os campos obrigatórios', variant: 'destructive' });
      return;
    }

    // Full zod validation
    const result = formSchema.safeParse(formData);
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) newErrors[err.path[0] as string] = err.message;
      });
      setErrors(newErrors);

      // Navigate to the first step with an error
      const errorFields = Object.keys(newErrors);
      for (let s = 0; s < STEPS.length; s++) {
        const stepFields = STEP_REQUIRED_FIELDS[s] || [];
        if (stepFields.some(f => errorFields.includes(f))) {
          setCurrentStep(s);
          break;
        }
      }
      toast({ title: 'Erro de validação', description: 'Verifique os campos obrigatórios', variant: 'destructive' });
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      await submit(formData, selectedTemplate, sendInvite, budgetFile, scheduleActivities);
      toast({
        title: 'Obra cadastrada!',
        description: formData.create_user
          ? 'Usuário criado e obra cadastrada com sucesso'
          : sendInvite
            ? `Convite enviado para ${formData.customer_email}`
            : 'Cliente cadastrado sem envio de convite',
      });
      clearDraft();
      navigate('/gestao');
    } catch (err: unknown) {
      console.error('Error creating project:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      toast({ title: 'Erro ao cadastrar', description: errorMessage, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const isLastStep = currentStep === STEPS.length - 1;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/gestao')} className="min-h-[44px] min-w-[44px] h-11 w-11" aria-label="Voltar">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-h3 font-bold">Nova Obra</h1>
              <p className="text-tiny text-muted-foreground">Cadastre uma nova obra</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Stepper */}
        <div className="mb-8 lg:max-w-3xl">
          <FormStepper
            steps={STEPS}
            currentStep={currentStep}
            completedSteps={completedSteps}
            onStepClick={goToStep}
          />
        </div>

        <div className="flex gap-8 items-start">
          {/* Main form */}
          <div className="flex-1 min-w-0 max-w-3xl">
            {/* Draft restored banner */}
            {draftRestored && (
              <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 p-3 mb-2">
                <p className="text-sm text-muted-foreground">Rascunho restaurado automaticamente.</p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      clearDraft();
                      setFormData(initialFormData);
                      setScheduleActivities([]);
                      setCurrentStep(0);
                      setCompletedSteps(new Set());
                      setDraftRestored(false);
                    }}
                  >
                    Limpar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      clearDraft();
                      setDraftRestored(false);
                      navigate('/gestao');
                      toast({ title: 'Rascunho excluído' });
                    }}
                  >
                    Excluir rascunho
                  </Button>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Step 0: Dados Básicos */}
              <div className={cn(currentStep !== 0 && 'hidden')}>
                {templates && templates.length > 0 && (
                  <div className="mb-6">
                    <TemplateSelectorCard
                      templates={templates}
                      selectedTemplate={selectedTemplate}
                      onSelectTemplate={setSelectedTemplate}
                      formData={formData}
                      onFormChange={handleChange}
                      customFieldValues={customFieldValues}
                      onCustomFieldChange={setCustomFieldValues}
                    />
                  </div>
                )}
                <ProjectInfoCard formData={formData} errors={errors} onChange={handleChange} />
              </div>

              {/* Step 1: Cronograma */}
              <div className={cn(currentStep !== 1 && 'hidden')}>
                <ScheduleCard formData={formData} onChange={handleChange} activities={scheduleActivities} onActivitiesChange={setScheduleActivities} />
              </div>

              {/* Step 2: Orçamento e Financeiro */}
              <div className={cn(currentStep !== 2 && 'hidden')}>
                <div className="space-y-6">
                  <BudgetUploadCard file={budgetFile} onFileChange={setBudgetFile} />
                  <FinancialCard formData={formData} onChange={handleChange} />
                </div>
              </div>

              {/* Step 3: Cliente - with Review Summary */}
              <div className={cn(currentStep !== 3 && 'hidden')}>
                <div className="space-y-6">
                  <ReviewSummary formData={formData} />
                  <CustomerCard formData={formData} errors={errors} sendInvite={sendInvite} onSendInviteChange={setSendInvite} onChange={handleChange} />
                </div>
              </div>

              {/* Navigation buttons */}
              <div className="flex flex-col-reverse sm:flex-row justify-between gap-3 pt-2">
                <div>
                  {currentStep > 0 ? (
                    <Button type="button" variant="outline" onClick={handleBack} className="min-h-[44px] w-full sm:w-auto">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Voltar
                    </Button>
                  ) : (
                    <Button type="button" variant="outline" onClick={() => navigate('/gestao')} className="min-h-[44px] w-full sm:w-auto">
                      Cancelar
                    </Button>
                  )}
                </div>

                <div>
                  {isLastStep ? (
                    <Button type="submit" disabled={loading} className="min-h-[44px] w-full sm:w-auto">
                      {loading ? 'Cadastrando...' : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Cadastrar Obra
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button type="button" onClick={handleNext} className="min-h-[44px] w-full sm:w-auto">
                      Próximo
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </div>

          {/* Sticky sidebar summary — desktop only */}
          <StickySummary
            formData={formData}
            currentStep={currentStep}
            completedSteps={completedSteps}
          />
        </div>

        {/* Mobile bottom sheet summary */}
        <MobileSummarySheet
          formData={formData}
          currentStep={currentStep}
          completedSteps={completedSteps}
          totalSteps={STEPS.length}
        />
      </main>
    </div>
  );
}
