import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Send,
  Check,
  X,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  useProjectTemplates,
  type ProjectTemplate,
  type TemplateActivity,
} from "@/hooks/useProjectTemplates";
import { addBusinessDays } from "@/lib/businessDays";
import { useIsMobile } from "@/hooks/use-mobile";
import { motion, AnimatePresence } from "framer-motion";

import {
  formSchema,
  initialFormData,
  initialContractImportState,
  type FormData,
  type ContractImportState,
  type ContractParseResult,
  type ContractConflict,
} from "./nova-obra/types";
import { useNovaObraSubmit } from "./nova-obra/useNovaObraSubmit";
import { TemplateSelectorCard } from "./nova-obra/TemplateSelectorCard";
import { ProjectInfoCard } from "./nova-obra/ProjectInfoCard";
import { ScheduleCard, type ScheduleActivity } from "./nova-obra/ScheduleCard";
import { FinancialCard } from "./nova-obra/FinancialCard";
import { CustomerCard } from "./nova-obra/CustomerCard";
import { BudgetUploadCard } from "./nova-obra/BudgetUploadCard";
import { ReviewSummary } from "./nova-obra/ReviewSummary";
import { ContractImportCard } from "./nova-obra/ContractImportCard";
import { FormStepper, type Step } from "@/components/FormStepper";
import { StickySummary } from "./nova-obra/StickySummary";
import { MobileSummarySheet } from "./nova-obra/MobileSummarySheet";
import { cn } from "@/lib/utils";
import { safeParseInt, trackBlock1CUsage } from "@/lib/block1cMonitor";

const STEPS: Step[] = [
  {
    label: "Cadastro Base",
    description: "Obra, imóvel e contratante (~3 min)",
  },
  { label: "Comercial", description: "Valor do contrato e orçamento (~1 min)" },
  {
    label: "Planejamento",
    description: "Cronograma, datas e atividades (~3 min)",
  },
  { label: "Revisão", description: "Confira os dados e cadastre a obra" },
];

const STEP_SHORT_LABELS = ["Cadastro", "Comercial", "Planejamento", "Revisão"];
const STEP_CTA_LABELS = [
  "Próximo: Comercial",
  "Próximo: Planejamento",
  "Próximo: Revisão",
  "Cadastrar Obra",
];

const STEP_REQUIRED_FIELDS: Record<number, (keyof FormData)[]> = {
  0: ["name", "customer_name", "customer_email"],
  1: [],
  2: [],
  3: [],
};

const DRAFT_KEY = "nova-obra-draft";

interface NovaObraDraft {
  formData: FormData;
  step: number;
  scheduleActivities?: ScheduleActivity[];
  savedAt?: number;
  contractSourceDoc?: string;
  aiPrefilledFields?: string[];
  aiConflicts?: ContractConflict[];
  aiMissingFields?: string[];
}

function loadDraft(): NovaObraDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.formData) return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

function saveDraft(
  formData: FormData,
  step: number,
  scheduleActivities: ScheduleActivity[],
  contractSourceDoc?: string,
  aiPrefilledFields?: string[],
  aiConflicts?: ContractConflict[],
  aiMissingFields?: string[],
) {
  try {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        formData,
        step,
        scheduleActivities,
        savedAt: Date.now(),
        contractSourceDoc,
        aiPrefilledFields,
        aiConflicts,
        aiMissingFields,
      }),
    );
  } catch {
    /* ignore */
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

function formatDraftAge(savedAt?: number): string {
  if (!savedAt) return "";
  const minutes = Math.floor((Date.now() - savedAt) / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  return `${Math.floor(hours / 24)}d atrás`;
}

// Map AI parse result fields to FormData fields
const AI_FIELD_MAP: Record<
  string,
  { section: "customer" | "studio" | "commercial" | "project"; aiField: string }
> = {
  customer_name: { section: "customer", aiField: "customer_name" },
  customer_email: { section: "customer", aiField: "customer_email" },
  customer_phone: { section: "customer", aiField: "customer_phone" },
  nacionalidade: { section: "customer", aiField: "nacionalidade" },
  estado_civil: { section: "customer", aiField: "estado_civil" },
  profissao: { section: "customer", aiField: "profissao" },
  cpf: { section: "customer", aiField: "cpf" },
  rg: { section: "customer", aiField: "rg" },
  endereco_residencial: {
    section: "customer",
    aiField: "endereco_residencial",
  },
  cidade_cliente: { section: "customer", aiField: "cidade" },
  estado_cliente: { section: "customer", aiField: "estado" },
  nome_do_empreendimento: {
    section: "studio",
    aiField: "nome_do_empreendimento",
  },
  address: { section: "studio", aiField: "endereco_completo" },
  bairro: { section: "studio", aiField: "bairro" },
  cidade_imovel: { section: "studio", aiField: "cidade" },
  cep: { section: "studio", aiField: "cep" },
  complemento: { section: "studio", aiField: "complemento" },
  tamanho_imovel_m2: { section: "studio", aiField: "tamanho_imovel_m2" },
  tipo_de_locacao: { section: "studio", aiField: "tipo_de_locacao" },
  data_recebimento_chaves: {
    section: "studio",
    aiField: "data_recebimento_chaves",
  },
  unit_name: { section: "studio", aiField: "unit_name" },
  contract_value: { section: "commercial", aiField: "contract_value" },
  payment_method: { section: "commercial", aiField: "payment_method" },
  contract_signed_at: { section: "commercial", aiField: "contract_signed_at" },
  name: { section: "project", aiField: "suggested_project_name" },
};

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
  const [selectedTemplate, setSelectedTemplate] =
    useState<ProjectTemplate | null>(null);
  const [customFieldValues, setCustomFieldValues] = useState<
    Record<string, string>
  >({});
  const [formData, setFormData] = useState<FormData>(
    draft?.formData ?? initialFormData,
  );
  const [budgetFile, setBudgetFile] = useState<File | null>(null);
  const [scheduleActivities, setScheduleActivities] = useState<
    ScheduleActivity[]
  >(draft?.scheduleActivities ?? []);
  const [draftRestored, setDraftRestored] = useState(!!draft);
  const [direction, setDirection] = useState(1);

  // Contract import state — restore from draft including conflicts/missing
  const [contractState, setContractState] = useState<ContractImportState>(
    () => {
      if (draft?.aiPrefilledFields && draft.aiPrefilledFields.length > 0) {
        return {
          ...initialContractImportState,
          parseStatus: "success" as const,
          aiPrefilledFields: new Set(draft.aiPrefilledFields),
          aiSourceDocumentName: draft.contractSourceDoc || "",
          aiConflicts: draft.aiConflicts || [],
          aiMissingFields: draft.aiMissingFields || [],
          aiLastAppliedAt: new Date().toISOString(),
        };
      }
      return initialContractImportState;
    },
  );

  // Track which fields user has manually edited after AI prefill
  const userEditedFieldsRef = useRef<Set<string>>(new Set());

  // Auto-save draft — includes contract metadata
  useEffect(() => {
    saveDraft(
      formData,
      currentStep,
      scheduleActivities,
      contractState.aiSourceDocumentName,
      Array.from(contractState.aiPrefilledFields),
      contractState.aiConflicts,
      contractState.aiMissingFields,
    );
  }, [
    formData,
    currentStep,
    scheduleActivities,
    contractState.aiSourceDocumentName,
    contractState.aiPrefilledFields,
    contractState.aiConflicts,
    contractState.aiMissingFields,
  ]);

  const _templateTotalDays = useMemo(() => {
    if (!selectedTemplate?.default_activities) return 0;
    return (selectedTemplate.default_activities as TemplateActivity[]).reduce(
      (s, a) => s + a.durationDays,
      0,
    );
  }, [selectedTemplate]);

  const autoCalculateEndDate = (startDateStr: string, durationStr?: string) => {
    const duration = safeParseInt(
      durationStr || formData.business_days_duration,
      {
        area: "duracao",
        context: "NovaObra.autoCalc",
        fallback: 0,
      },
    );
    if (!startDateStr || duration <= 0) return;
    trackBlock1CUsage("duracao", { duration, source: "NovaObra" });
    const start = new Date(startDateStr + "T00:00:00");
    const end = addBusinessDays(start, duration - 1);
    setFormData((prev) => ({
      ...prev,
      planned_end_date: end.toISOString().split("T")[0],
    }));
  };

  const handleChange = (field: keyof FormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
    // Track manual edits to prevent AI overwrite
    userEditedFieldsRef.current.add(field);
    if (field === "planned_start_date" && typeof value === "string") {
      autoCalculateEndDate(value);
    }
    if (field === "business_days_duration" && typeof value === "string") {
      autoCalculateEndDate(formData.planned_start_date, value);
    }
  };

  // Apply AI parse result to formData — side effects extracted from state updater
  const handleApplyPrefill = useCallback(
    (result: ContractParseResult, fileName: string) => {
      if (import.meta.env.DEV)
        console.log(
          "[AI Prefill] Full result:",
          JSON.stringify(result, null, 2),
        );

      const prefilledFields = new Set<string>();
      const updates: Partial<FormData> = {};

      // Build updates based on current formData (read via ref-like access through setFormData)
      setFormData((prev) => {
        for (const [formField, mapping] of Object.entries(AI_FIELD_MAP)) {
          if (userEditedFieldsRef.current.has(formField)) {
            if (import.meta.env.DEV)
              console.log(`[AI Prefill] Skipping ${formField} — user edited`);
            continue;
          }

          const sectionData = result[mapping.section] as
            | Record<string, unknown>
            | undefined;
          const aiValue = sectionData?.[mapping.aiField];
          if (import.meta.env.DEV)
            console.log(
              `[AI Prefill] ${formField}: section=${mapping.section}, aiField=${mapping.aiField}, value=`,
              aiValue,
            );

          if (
            aiValue != null &&
            aiValue !== "" &&
            typeof aiValue === "string"
          ) {
            const currentValue = prev[formField as keyof FormData];
            if (
              !currentValue ||
              currentValue === "" ||
              currentValue === initialFormData[formField as keyof FormData]
            ) {
              (updates as Record<string, unknown>)[formField] = aiValue;
              prefilledFields.add(formField);
              if (import.meta.env.DEV)
                console.log(`[AI Prefill] ✓ ${formField} = "${aiValue}"`);
            } else {
              if (import.meta.env.DEV)
                console.log(
                  `[AI Prefill] ${formField} skipped — current value:`,
                  currentValue,
                );
            }
          }
        }

        // Fallback: if 'name' wasn't filled but studio.nome_do_empreendimento exists, use it
        if (!updates.name && !prev.name) {
          const studioName = (result.studio as Record<string, unknown>)
            ?.nome_do_empreendimento;
          const unitName = (result.studio as Record<string, unknown>)
            ?.unit_name;
          if (typeof studioName === "string" && studioName) {
            updates.name = unitName
              ? `${studioName} - ${unitName}`
              : studioName;
            prefilledFields.add("name");
          }
        }

        updates.contract_document_name = fileName;

        if (import.meta.env.DEV) {
          console.log(
            "[AI Prefill] Final updates:",
            JSON.stringify(updates, null, 2),
          );
          console.log(
            "[AI Prefill] Prefilled fields:",
            Array.from(prefilledFields),
          );
        }

        return { ...prev, ...updates };
      });

      // Side effects OUTSIDE the state updater
      setContractState((prev) => ({
        ...prev,
        aiPrefilledFields: prefilledFields,
        aiConflicts: result.conflicts || [],
        aiMissingFields: result.missing_fields || [],
        aiSourceDocumentName: fileName,
        aiLastAppliedAt: new Date().toISOString(),
      }));

      toast({
        title: `${prefilledFields.size} campos preenchidos automaticamente`,
        description: result.conflicts?.length
          ? `Atenção: ${result.conflicts.length} divergência(s) encontrada(s)`
          : "Revise os dados antes de prosseguir",
      });
    },
    [toast],
  );

  const validateStep = useCallback(
    (step: number): boolean => {
      const requiredFields = STEP_REQUIRED_FIELDS[step] || [];
      const newErrors: Record<string, string> = {};

      for (const field of requiredFields) {
        const value = formData[field];
        if (typeof value === "string" && !value.trim()) {
          newErrors[field] = "Campo obrigatório";
        }
      }

      if (step === 0) {
        if (
          formData.customer_email &&
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.customer_email)
        ) {
          newErrors.customer_email = "E-mail inválido";
        }
        if (
          formData.create_user &&
          (!formData.customer_password || formData.customer_password.length < 6)
        ) {
          newErrors.customer_password = "Senha deve ter no mínimo 6 caracteres";
        }
      }

      if (step === 1) {
        if (formData.contract_value) {
          const numVal = parseFloat(formData.contract_value);
          if (isNaN(numVal) || numVal < 0) {
            newErrors.contract_value = "Valor do contrato inválido";
          }
        }
      }

      if (step === 2 && !formData.is_project_phase) {
        if (!formData.planned_start_date)
          newErrors.planned_start_date = "Data de início é obrigatória";
        if (!formData.planned_end_date)
          newErrors.planned_end_date = "Data de término é obrigatória";
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors((prev) => ({ ...prev, ...newErrors }));
        return false;
      }
      return true;
    },
    [formData],
  );

  const goToStep = (target: number) => {
    if (target < currentStep) {
      setDirection(-1);
      setCurrentStep(target);
      return;
    }
    if (validateStep(currentStep)) {
      setDirection(1);
      setCompletedSteps((prev) => new Set([...prev, currentStep]));
      setCurrentStep(target);
    } else {
      toast({
        title: "Preencha os campos obrigatórios",
        variant: "destructive",
      });
    }
  };

  const handleNext = () => goToStep(currentStep + 1);
  const handleBack = () => goToStep(currentStep - 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({
        title: "Erro",
        description: "Você precisa estar logado",
        variant: "destructive",
      });
      return;
    }

    if (!validateStep(currentStep)) {
      toast({
        title: "Erro de validação",
        description: "Verifique os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    const result = formSchema.safeParse(formData);
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) newErrors[err.path[0] as string] = err.message;
      });
      setErrors(newErrors);

      const errorFields = Object.keys(newErrors);
      for (let s = 0; s < STEPS.length; s++) {
        const stepFields = STEP_REQUIRED_FIELDS[s] || [];
        if (stepFields.some((f) => errorFields.includes(f))) {
          setCurrentStep(s);
          break;
        }
      }
      toast({
        title: "Erro de validação",
        description: "Verifique os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      await submit(
        formData,
        selectedTemplate,
        sendInvite,
        budgetFile,
        scheduleActivities,
        contractState.file ?? undefined,
      );
      toast({
        title: "Obra cadastrada!",
        description: formData.create_user
          ? "Usuário criado e obra cadastrada com sucesso"
          : sendInvite
            ? `Convite enviado para ${formData.customer_email}`
            : "Cliente cadastrado sem envio de convite",
      });
      clearDraft();
      navigate("/gestao");
    } catch (err: unknown) {
      console.error("Error creating project:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Erro desconhecido";
      toast({
        title: "Erro ao cadastrar",
        description: errorMessage,
        variant: "destructive",
      });
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
    setContractState(initialContractImportState);
  };

  // Conflict field set for indicators
  const aiConflictFields = useMemo(() => {
    const s = new Set<string>();
    for (const c of contractState.aiConflicts) {
      for (const [formField, mapping] of Object.entries(AI_FIELD_MAP)) {
        if (mapping.aiField === c.field || formField === c.field) {
          s.add(formField);
        }
      }
    }
    return s;
  }, [contractState.aiConflicts]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-lg border-b">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/gestao")}
              className="h-11 w-11 shrink-0 touch-target"
              aria-label="Voltar para gestão"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl font-bold leading-tight">
                Nova Obra
              </h1>
              <p className="text-xs text-muted-foreground sm:hidden">
                Etapa {currentStep + 1} de {STEPS.length} ·{" "}
                {STEP_SHORT_LABELS[currentStep]}
              </p>
              <p className="text-xs text-muted-foreground hidden sm:block">
                Cadastre uma nova obra
              </p>
            </div>
          </div>
        </div>

        {/* Mobile progress bar */}
        <div
          className="sm:hidden px-4 pb-3 space-y-2"
          role="navigation"
          aria-label="Progresso do cadastro"
        >
          <div
            className="relative h-1.5 bg-muted rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={currentStep + 1}
            aria-valuemin={1}
            aria-valuemax={STEPS.length}
          >
            <motion.div
              className="absolute left-0 top-0 h-full bg-primary rounded-full"
              initial={false}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            />
          </div>
          <div className="flex" role="tablist">
            {STEP_SHORT_LABELS.map((label, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === currentStep}
                aria-label={`${label}: etapa ${i + 1} de ${STEPS.length}${completedSteps.has(i) ? ", concluída" : ""}`}
                onClick={() => goToStep(i)}
                className={cn(
                  "flex-1 text-center py-1 text-[10px] font-medium transition-colors touch-target relative",
                  i === currentStep
                    ? "text-primary font-bold"
                    : completedSteps.has(i)
                      ? "text-foreground"
                      : "text-muted-foreground/60",
                )}
              >
                <span className="flex items-center justify-center gap-1">
                  {completedSteps.has(i) && i !== currentStep && (
                    <Check
                      className="h-2.5 w-2.5 text-primary"
                      aria-hidden="true"
                    />
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
            {/* Draft restored banner */}
            {draftRestored && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 mb-4"
                role="status"
              >
                <RotateCcw
                  className="h-4 w-4 text-primary shrink-0"
                  aria-hidden="true"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Rascunho restaurado</p>
                  {draft?.savedAt && (
                    <p className="text-[11px] text-muted-foreground">
                      Salvo {formatDraftAge(draft.savedAt)}
                    </p>
                  )}
                  {(draft?.contractSourceDoc ||
                    draft?.formData?.contract_document_name) && (
                    <p className="text-[11px] text-muted-foreground">
                      ⚠ Arquivos (contrato/orçamento) precisam ser reenviados
                    </p>
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
                  aria-label="Fechar aviso de rascunho"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </motion.div>
            )}

            {/* Live region for screen readers */}
            <div aria-live="polite" aria-atomic="true" className="sr-only">
              Etapa {currentStep + 1} de {STEPS.length}:{" "}
              {STEPS[currentStep].label}
            </div>

            <form onSubmit={handleSubmit} noValidate>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={currentStep}
                  initial={isMobile ? { opacity: 0, x: direction * 40 } : false}
                  animate={{ opacity: 1, x: 0 }}
                  exit={
                    isMobile ? { opacity: 0, x: direction * -40 } : undefined
                  }
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="space-y-6"
                >
                  {/* Step 0: Cadastro Base */}
                  {currentStep === 0 && (
                    <>
                      {/* Contract Import - top of step 0 */}
                      <ContractImportCard
                        contractState={contractState}
                        onContractStateChange={setContractState}
                        formData={formData}
                        onApplyPrefill={handleApplyPrefill}
                      />

                      {templates && templates.length > 0 && (
                        <div>
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
                      <ProjectInfoCard
                        formData={formData}
                        errors={errors}
                        onChange={handleChange}
                        aiPrefilledFields={contractState.aiPrefilledFields}
                        aiConflictFields={aiConflictFields}
                      />
                      <CustomerCard
                        formData={formData}
                        errors={errors}
                        sendInvite={sendInvite}
                        onSendInviteChange={setSendInvite}
                        onChange={handleChange}
                        aiPrefilledFields={contractState.aiPrefilledFields}
                        aiConflictFields={aiConflictFields}
                      />
                    </>
                  )}

                  {/* Step 1: Comercial */}
                  {currentStep === 1 && (
                    <div className="space-y-6">
                      <BudgetUploadCard
                        file={budgetFile}
                        onFileChange={setBudgetFile}
                        formData={formData}
                        onChange={handleChange}
                      />
                      <FinancialCard
                        formData={formData}
                        onChange={handleChange}
                        aiPrefilledFields={contractState.aiPrefilledFields}
                        aiConflictFields={aiConflictFields}
                      />
                    </div>
                  )}

                  {/* Step 2: Planejamento */}
                  {currentStep === 2 && (
                    <ScheduleCard
                      formData={formData}
                      onChange={handleChange}
                      activities={scheduleActivities}
                      onActivitiesChange={setScheduleActivities}
                    />
                  )}

                  {/* Step 3: Revisão */}
                  {currentStep === 3 && (
                    <div className="space-y-6">
                      <ReviewSummary
                        formData={formData}
                        contractSourceDoc={contractState.aiSourceDocumentName}
                        aiPrefilledCount={contractState.aiPrefilledFields.size}
                        aiConflictsCount={contractState.aiConflicts.length}
                      />
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Desktop Navigation buttons */}
              <div className="hidden sm:flex flex-row justify-between gap-3 pt-6">
                <div>
                  {currentStep > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleBack}
                      className="min-h-[44px]"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Voltar
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate("/gestao")}
                      className="min-h-[44px]"
                    >
                      Cancelar
                    </Button>
                  )}
                </div>

                <div>
                  {isLastStep ? (
                    <Button
                      type="submit"
                      disabled={loading}
                      className="min-h-[44px]"
                    >
                      {loading ? (
                        <>
                          <Loader2
                            className="h-4 w-4 mr-2 animate-spin"
                            aria-hidden="true"
                          />
                          Cadastrando...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Cadastrar Obra
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={handleNext}
                      className="min-h-[44px]"
                    >
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

        {/* Mobile bottom sheet summary — visible on small screens only */}
        <MobileSummarySheet
          formData={formData}
          currentStep={currentStep}
          completedSteps={completedSteps}
          totalSteps={STEPS.length}
        />
      </main>

      {/* Mobile sticky bottom navigation */}
      <div className="fixed bottom-0 inset-x-0 z-50 bg-card/95 backdrop-blur-md border-t border-border sm:hidden keyboard-aware">
        <div className="px-4 py-3 pb-safe">
          <div className="flex gap-3">
            {currentStep > 0 ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                className="h-12 flex-1 rounded-xl text-sm font-medium"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Voltar
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate("/gestao")}
                className="h-12 px-4 rounded-xl text-sm text-muted-foreground"
              >
                Cancelar
              </Button>
            )}

            {isLastStep ? (
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="h-12 flex-[2] rounded-xl text-sm font-semibold gap-2"
              >
                {loading ? (
                  <>
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
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
              <Button
                type="button"
                onClick={handleNext}
                className="h-12 flex-[2] rounded-xl text-sm font-semibold gap-1"
              >
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
