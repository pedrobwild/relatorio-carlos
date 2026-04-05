import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Send, Check, X, RotateCcw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useProjectTemplates, type ProjectTemplate, type TemplateActivity } from '@/hooks/useProjectTemplates';
import { addBusinessDays } from '@/lib/businessDays';
import { useIsMobile } from '@/hooks/use-mobile';
import { motion, AnimatePresence } from 'framer-motion';

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

const STEP_SHORT_LABELS = ['Dados', 'Cronograma', 'Orçamento', 'Cliente'];
const STEP_CTA_LABELS = ['Próximo: Cronograma', 'Próximo: Orçamento', 'Próximo: Cliente', 'Cadastrar Obra'];

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
  savedAt?: number;
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

function formatDraftAge(savedAt?: number): string {
  if (!savedAt) return '';
  const minutes = Math.floor((Date.now() - savedAt) / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  return `${Math.floor(hours / 24)}d atrás`;
}

export default function NovaObra() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: templates } = useProjectTemplates();
  const { submit, user } = useNovaObraSubmit();
  const isMobile = useIsMobile();

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
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = back

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
    if (target < currentStep) {
      setDirection(-1);
      setCurrentStep(target);
      return;
    }
    if (validateStep(currentStep)) {
      setDirection(1);
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

    if (!validateStep(currentStep)) {
      toast({ title: 'Erro de validação', description: 'Verifique os campos obrigatórios', variant: 'destructive' });
      return;
    }

    const result = formSchema.safeParse(formData);
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) newErrors[err.path[0] as string] = err.message;
      });
      setErrors(newErrors);

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
  const progressPercent = ((currentStep + 1) / STEPS.length) * 100;

  const handleClearDraft = () => {
    clearDraft();
    setFormData(initialFormData);
    setScheduleActivities([]);
    setCurrentStep(0);
    setCompletedSteps(new Set());
    setDraftRestored(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-lg border-b">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/gestao')} className="h-11 w-11 shrink-0 touch-target" aria-label="Voltar">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl font-bold leading-tight">Nova Obra</h1>
              {/* Mobile: current step context */}
              <p className="text-xs text-muted-foreground sm:hidden">
                Etapa {currentStep + 1} de {STEPS.length} · {STEP_SHORT_LABELS[currentStep]}
              </p>
              <p className="text-xs text-muted-foreground hidden sm:block">Cadastre uma nova obra</p>
            </div>
          </div>
        </div>

        {/* Mobile progress bar — animated, tappable */}
        <div className="sm:hidden px-4 pb-3 space-y-2">
          {/* Continuous progress bar */}
          <div className="relative h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="absolute left-0 top-0 h-full bg-primary rounded-full"
              initial={false}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            />
          </div>
          {/* Step labels — tappable */}
          <div className="flex">
            {STEP_SHORT_LABELS.map((label, i) => (
              <button
                key={i}
                onClick={() => goToStep(i)}
                className={cn(
                  "flex-1 text-center py-1 text-[10px] font-medium transition-colors touch-target relative",
                  i === currentStep ? "text-primary font-bold" :
                  completedSteps.has(i) ? "text-foreground" :
                  "text-muted-foreground/60"
                )}
              >
                <span className="flex items-center justify-center gap-1">
                  {completedSteps.has(i) && i !== currentStep && (
                    <Check className="h-2.5 w-2.5 text-primary" />
                  )}
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-4 sm:py-6 pb-[88px] sm:pb-6">
        {/* Desktop Stepper */}
        <div className="mb-8 lg:max-w-3xl hidden sm:block">
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
            {/* Draft restored banner — compact on mobile */}
            {draftRestored && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 mb-4"
              >
                <RotateCcw className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Rascunho restaurado</p>
                  {draft?.savedAt && (
                    <p className="text-[11px] text-muted-foreground">Salvo {formatDraftAge(draft.savedAt)}</p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs shrink-0"
                  onClick={handleClearDraft}
                >
                  Limpar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setDraftRestored(false)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </motion.div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Animated step transitions on mobile */}
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={currentStep}
                  initial={isMobile ? { opacity: 0, x: direction * 40 } : false}
                  animate={{ opacity: 1, x: 0 }}
                  exit={isMobile ? { opacity: 0, x: direction * -40 } : undefined}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="space-y-6"
                >
                  {/* Step 0: Dados Básicos */}
                  {currentStep === 0 && (
                    <>
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
                    </>
                  )}

                  {/* Step 1: Cronograma */}
                  {currentStep === 1 && (
                    <ScheduleCard formData={formData} onChange={handleChange} activities={scheduleActivities} onActivitiesChange={setScheduleActivities} />
                  )}

                  {/* Step 2: Orçamento e Financeiro */}
                  {currentStep === 2 && (
                    <div className="space-y-6">
                      <BudgetUploadCard file={budgetFile} onFileChange={setBudgetFile} />
                      <FinancialCard formData={formData} onChange={handleChange} />
                    </div>
                  )}

                  {/* Step 3: Cliente + Review */}
                  {currentStep === 3 && (
                    <div className="space-y-6">
                      <ReviewSummary formData={formData} />
                      <CustomerCard formData={formData} errors={errors} sendInvite={sendInvite} onSendInviteChange={setSendInvite} onChange={handleChange} />
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Desktop Navigation buttons */}
              <div className="hidden sm:flex flex-row justify-between gap-3 pt-6">
                <div>
                  {currentStep > 0 ? (
                    <Button type="button" variant="outline" onClick={handleBack} className="min-h-[44px]">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Voltar
                    </Button>
                  ) : (
                    <Button type="button" variant="outline" onClick={() => navigate('/gestao')} className="min-h-[44px]">
                      Cancelar
                    </Button>
                  )}
                </div>

                <div>
                  {isLastStep ? (
                    <Button type="submit" disabled={loading} className="min-h-[44px]">
                      {loading ? 'Cadastrando...' : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Cadastrar Obra
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button type="button" onClick={handleNext} className="min-h-[44px]">
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

        {/* Mobile bottom sheet summary — only on desktop-ish */}
        <div className="hidden lg:block">
          <MobileSummarySheet
            formData={formData}
            currentStep={currentStep}
            completedSteps={completedSteps}
            totalSteps={STEPS.length}
          />
        </div>
      </main>

      {/* Mobile sticky bottom navigation — keyboard-aware */}
      <div className="fixed bottom-0 inset-x-0 z-50 bg-card/95 backdrop-blur-md border-t border-border sm:hidden keyboard-aware">
        <div className="px-4 py-3 pb-safe">
          <div className="flex gap-3">
            {currentStep > 0 ? (
              <Button type="button" variant="outline" onClick={handleBack} className="h-12 flex-1 rounded-xl text-sm font-medium">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Voltar
              </Button>
            ) : (
              <Button type="button" variant="ghost" onClick={() => navigate('/gestao')} className="h-12 px-4 rounded-xl text-sm text-muted-foreground">
                Cancelar
              </Button>
            )}

            {isLastStep ? (
              <Button onClick={handleSubmit} disabled={loading} className="h-12 flex-[2] rounded-xl text-sm font-semibold gap-2">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cadastrando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Cadastrar Obra
                  </>
                )}
              </Button>
            ) : (
              <Button type="button" onClick={handleNext} className="h-12 flex-[2] rounded-xl text-sm font-semibold gap-1">
                {STEP_CTA_LABELS[currentStep]}
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
