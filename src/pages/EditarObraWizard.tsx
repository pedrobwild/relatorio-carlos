import { useState, useMemo, useCallback, useEffect, useRef } from'react';
import { useNavigate, useParams } from'react-router-dom';
import { ArrowLeft, ArrowRight, Send, Check, X, Loader2, Rocket } from'lucide-react';
import { Button } from'@/components/ui/button';
import { useToast } from'@/hooks/use-toast';
import { useProjectTemplates, type ProjectTemplate, type TemplateActivity } from'@/hooks/useProjectTemplates';
import { addBusinessDays } from'@/lib/businessDays';
import { useIsMobile } from'@/hooks/use-mobile';
import { motion, AnimatePresence } from'framer-motion';
import { supabase } from'@/integrations/supabase/client';
import { useQueryClient } from'@tanstack/react-query';
import { projectKeys } from'@/hooks/useProjectsQuery';

import { formSchema, initialFormData, initialContractImportState, type FormData, type ContractImportState, type ContractParseResult, type ContractConflict } from'./nova-obra/types';
import { useNovaObraSubmit } from'./nova-obra/useNovaObraSubmit';
import { useEditProjectLoader } from'./nova-obra/useEditProjectLoader';
import { ProjectInfoCard } from'./nova-obra/ProjectInfoCard';
import { ScheduleCard, type ScheduleActivity } from'./nova-obra/ScheduleCard';
import { FinancialCard } from'./nova-obra/FinancialCard';
import { CustomerCard } from'./nova-obra/CustomerCard';
import { BudgetUploadCard } from'./nova-obra/BudgetUploadCard';
import { ReviewSummary } from'./nova-obra/ReviewSummary';
import { ContractImportCard } from'./nova-obra/ContractImportCard';
import { FormStepper, type Step } from'@/components/FormStepper';
import { StickySummary } from'./nova-obra/StickySummary';
import { MobileSummarySheet } from'./nova-obra/MobileSummarySheet';
import { cn } from'@/lib/utils';
import { safeParseInt, trackBlock1CUsage } from'@/lib/block1cMonitor';

const STEPS: Step[] = [
 { label:'Cadastro Base', description:'Obra, imóvel e contratante' },
 { label:'Comercial', description:'Valor do contrato e orçamento' },
 { label:'Planejamento', description:'Cronograma, datas e atividades' },
 { label:'Revisão', description:'Confira os dados e publique a obra' },
];

const STEP_SHORT_LABELS = ['Cadastro','Comercial','Planejamento','Revisão'];

const STEP_REQUIRED_FIELDS: Record<number, (keyof FormData)[]> = {
 0: ['name','customer_name','customer_email'],
 1: [],
 2: [],
 3: [],
};

/**
 * EditarObraWizard — reuses the same wizard UI as NovaObra but loads
 * existing project data and updates instead of creating.
 */
export default function EditarObraWizard() {
 const { projectId } = useParams<{ projectId: string }>();
 const navigate = useNavigate();
 const { toast } = useToast();
 const queryClient = useQueryClient();
 const isMobile = useIsMobile();

 const { formData: loadedFormData, loading: loadingProject, error: loadError, projectName } = useEditProjectLoader(projectId);

 const [currentStep, setCurrentStep] = useState(0);
 const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
 const [saving, setSaving] = useState(false);
 const [errors, setErrors] = useState<Record<string, string>>({});
 const [formData, setFormData] = useState<FormData>(initialFormData);
 const [budgetFile, setBudgetFile] = useState<File | null>(null);
 const [scheduleActivities, setScheduleActivities] = useState<ScheduleActivity[]>([]);
 const [direction, setDirection] = useState(1);
 const [sendInvite, setSendInvite] = useState(false);
 const [contractState, setContractState] = useState<ContractImportState>(initialContractImportState);

 const userEditedFieldsRef = useRef<Set<string>>(new Set());

 // Load project data into form when ready
 useEffect(() => {
 if (!loadingProject && loadedFormData) {
 setFormData(loadedFormData);
 }
 }, [loadingProject, loadedFormData]);

 const handleChange = (field: keyof FormData, value: string | boolean) => {
 setFormData(prev => ({ ...prev, [field]: value }));
 if (errors[field]) setErrors(prev => ({ ...prev, [field]:'' }));
 userEditedFieldsRef.current.add(field);

 if (field ==='planned_start_date' && typeof value ==='string' && value) {
 const duration = safeParseInt(formData.business_days_duration, {
 area:'duracao',
 context:'EditarObraWizard.autoCalc',
 fallback: 0,
 });
 if (duration > 0) {
 trackBlock1CUsage('duracao', { duration, source:'EditarObraWizard' });
 const start = new Date(value +'T00:00:00');
 const end = addBusinessDays(start, duration - 1);
 setFormData(prev => ({ ...prev, planned_end_date: end.toISOString().split('T')[0] }));
 }
 }
 };

 const validateStep = useCallback((step: number): boolean => {
 const requiredFields = STEP_REQUIRED_FIELDS[step] || [];
 const newErrors: Record<string, string> = {};
 for (const field of requiredFields) {
 const value = formData[field];
 if (typeof value ==='string' && !value.trim()) {
 newErrors[field] ='Campo obrigatório';
 }
 }
 if (step === 0 && formData.customer_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.customer_email)) {
 newErrors.customer_email ='E-mail inválido';
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
 toast({ title:'Preencha os campos obrigatórios', variant:'destructive' });
 }
 };

 const handleNext = () => goToStep(currentStep + 1);
 const handleBack = () => goToStep(currentStep - 1);

 const handlePublish = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!projectId) return;

 if (!validateStep(currentStep)) {
 toast({ title:'Erro de validação', description:'Verifique os campos obrigatórios', variant:'destructive' });
 return;
 }

 setSaving(true);
 setErrors({});

 try {
 // Update project
 const { error: projectError } = await supabase
 .from('projects')
 .update({
 name: formData.name.trim(),
 unit_name: formData.unit_name.trim() || null,
 address: formData.address.trim() || null,
 bairro: formData.bairro.trim() || null,
 cep: formData.cep.trim() || null,
 planned_start_date: formData.planned_start_date || null,
 planned_end_date: formData.planned_end_date || null,
 contract_signing_date: formData.contract_signed_at || formData.contract_signing_date || null,
 contract_value: formData.contract_value ? parseFloat(formData.contract_value) : null,
 is_project_phase: formData.is_project_phase,
 status:'active',
 })
 .eq('id', projectId);

 if (projectError) throw new Error('Falha ao atualizar projeto:' + projectError.message);

 // Upsert customer data
 if (formData.customer_name && formData.customer_email) {
 await supabase
 .from('project_customers')
 .upsert({
 project_id: projectId,
 customer_name: formData.customer_name.trim(),
 customer_email: formData.customer_email.trim().toLowerCase(),
 customer_phone: formData.customer_phone.trim() || null,
 nacionalidade: formData.nacionalidade.trim() || null,
 estado_civil: formData.estado_civil.trim() || null,
 profissao: formData.profissao.trim() || null,
 cpf: formData.cpf.trim() || null,
 rg: formData.rg.trim() || null,
 endereco_residencial: formData.endereco_residencial.trim() || null,
 cidade: formData.cidade_cliente.trim() || null,
 estado: formData.estado_cliente.trim() || null,
 }, { onConflict:'project_id,customer_email' });
 }

 // Upsert studio info
 const hasStudioData = formData.nome_do_empreendimento || formData.complemento ||
 formData.tamanho_imovel_m2 || formData.tipo_de_locacao || formData.data_recebimento_chaves ||
 formData.cidade_imovel;

 if (hasStudioData) {
 await (supabase
 .from('project_studio_info' as any)
 .upsert({
 project_id: projectId,
 nome_do_empreendimento: formData.nome_do_empreendimento.trim() || null,
 endereco_completo: formData.address.trim() || null,
 bairro: formData.bairro.trim() || null,
 cidade: formData.cidade_imovel.trim() || null,
 cep: formData.cep.trim() || null,
 complemento: formData.complemento.trim() || null,
 tamanho_imovel_m2: formData.tamanho_imovel_m2 ? parseFloat(formData.tamanho_imovel_m2) : null,
 tipo_de_locacao: formData.tipo_de_locacao || null,
 data_recebimento_chaves: formData.data_recebimento_chaves || null,
 } as any));
 }

 // Initialize journey if project phase
 if (formData.is_project_phase) {
 await supabase.rpc('initialize_project_journey', { p_project_id: projectId });
 }

 await queryClient.invalidateQueries({ queryKey: projectKeys.all });

 toast({
 title:'Obra publicada!',
 description:'O projeto foi revisado e ativado com sucesso.',
 });

 navigate('/gestao');
 } catch (err) {
 console.error('Error publishing project:', err);
 toast({
 title:'Erro ao publicar',
 description: err instanceof Error ? err.message :'Erro desconhecido',
 variant:'destructive',
 });
 } finally {
 setSaving(false);
 }
 };

 const isLastStep = currentStep === STEPS.length - 1;
 const progressPercent = ((currentStep + 1) / STEPS.length) * 100;

 if (loadingProject) {
 return (
 <div className="min-h-screen flex items-center justify-center bg-background">
 <Loader2 className="h-8 w-8 animate-spin text-primary" />
 </div>
 );
 }

 if (loadError) {
 return (
 <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
 <p className="text-muted-foreground">{loadError}</p>
 <Button variant="outline" onClick={() => navigate('/gestao')}>Voltar</Button>
 </div>
 );
 }

 return (
 <div className="min-h-screen bg-background">
 {/* Header */}
 <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-lg border-b">
 <div className="max-w-3xl mx-auto px-4 py-3">
 <div className="flex items-center gap-3">
 <Button variant="ghost" size="icon" onClick={() => navigate('/gestao')} className="h-11 w-11 shrink-0">
 <ArrowLeft className="h-5 w-5" />
 </Button>
 <div className="flex-1 min-w-0">
 <h1 className="text-lg sm:text-xl font-bold leading-tight">
 Revisar Obra
 </h1>
 <p className="text-xs text-muted-foreground">
 {projectName ||'Revise e publique a obra recebida'}
 </p>
 </div>
 </div>
 </div>

 {/* Mobile progress bar */}
 <div className="sm:hidden px-4 pb-3 space-y-2">
 <div className="relative h-1.5 bg-muted rounded-full overflow-hidden">
 <motion.div
 className="absolute left-0 top-0 h-full bg-primary rounded-full"
 initial={false}
 animate={{ width:`${progressPercent}%` }}
 transition={{ duration: 0.3, ease:'easeInOut' }}
 />
 </div>
 <div className="flex">
 {STEP_SHORT_LABELS.map((label, i) => (
 <button
 key={i}
 onClick={() => goToStep(i)}
 className={cn(
"flex-1 text-center py-1 text-[10px] font-medium transition-colors relative",
 i === currentStep ?"text-primary font-bold" :
 completedSteps.has(i) ?"text-foreground" :
"text-muted-foreground/60"
 )}
 >
 <span className="flex items-center justify-center gap-1">
 {completedSteps.has(i) && i !== currentStep && <Check className="h-2.5 w-2.5 text-primary" />}
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

 {/* Draft banner */}
 <motion.div
 initial={{ opacity: 0, y: -8 }}
 animate={{ opacity: 1, y: 0 }}
 className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-50 p-3 mb-4"
 >
 <Rocket className="h-4 w-4 text-amber-600 shrink-0" />
 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium text-amber-800">Rascunho — Recebido via integração</p>
 <p className="text-[11px] text-amber-600">
 Revise as informações e clique em"Publicar Obra" para ativar o projeto.
 </p>
 </div>
 </motion.div>

 <div className="flex gap-8 items-start">
 <div className="flex-1 min-w-0 max-w-3xl">
 <form onSubmit={handlePublish} noValidate>
 <AnimatePresence mode="wait" initial={false}>
 <motion.div
 key={currentStep}
 initial={isMobile ? { opacity: 0, x: direction * 40 } : false}
 animate={{ opacity: 1, x: 0 }}
 exit={isMobile ? { opacity: 0, x: direction * -40 } : undefined}
 transition={{ duration: 0.2, ease:'easeOut' }}
 className="space-y-6"
 >
 {currentStep === 0 && (
 <>
 <ContractImportCard
 contractState={contractState}
 onContractStateChange={setContractState}
 formData={formData}
 onApplyPrefill={() => {}}
 />
 <ProjectInfoCard
 formData={formData}
 errors={errors}
 onChange={handleChange}
 aiPrefilledFields={new Set()}
 aiConflictFields={new Set()}
 />
 <CustomerCard
 formData={formData}
 errors={errors}
 sendInvite={sendInvite}
 onSendInviteChange={setSendInvite}
 onChange={handleChange}
 aiPrefilledFields={new Set()}
 aiConflictFields={new Set()}
 />
 </>
 )}

 {currentStep === 1 && (
 <div className="space-y-6">
 <BudgetUploadCard file={budgetFile} onFileChange={setBudgetFile} formData={formData} onChange={handleChange} />
 <FinancialCard
 formData={formData}
 onChange={handleChange}
 aiPrefilledFields={new Set()}
 aiConflictFields={new Set()}
 />
 </div>
 )}

 {currentStep === 2 && (
 <ScheduleCard formData={formData} onChange={handleChange} activities={scheduleActivities} onActivitiesChange={setScheduleActivities} />
 )}

 {currentStep === 3 && (
 <div className="space-y-6">
 <ReviewSummary
 formData={formData}
 contractSourceDoc=""
 aiPrefilledCount={0}
 aiConflictsCount={0}
 />
 </div>
 )}
 </motion.div>
 </AnimatePresence>

 {/* Desktop Navigation */}
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
 <Button type="submit" disabled={saving} className="min-h-[44px] bg-gradient-to-r from-primary to-[hsl(var(--primary-dark))]">
 {saving ? (
 <>
 <Loader2 className="h-4 w-4 mr-2 animate-spin" />
 Publicando...
 </>
 ) : (
 <>
 <Rocket className="h-4 w-4 mr-2" />
 Publicar Obra
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

 <StickySummary
 formData={formData}
 currentStep={currentStep}
 completedSteps={completedSteps}
 />
 </div>

 <MobileSummarySheet
 formData={formData}
 currentStep={currentStep}
 completedSteps={completedSteps}
 totalSteps={STEPS.length}
 />
 </main>

 {/* Mobile sticky bottom */}
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
 <Button onClick={handlePublish} disabled={saving} className="h-12 flex-[2] rounded-xl text-sm font-semibold gap-2">
 {saving ? (
 <>
 <Loader2 className="h-4 w-4 animate-spin" />
 Publicando...
 </>
 ) : (
 <>
 <Rocket className="h-4 w-4" />
 Publicar Obra
 </>
 )}
 </Button>
 ) : (
 <Button type="button" onClick={handleNext} className="h-12 flex-[2] rounded-xl text-sm font-semibold gap-1">
 Próximo
 <ArrowRight className="h-4 w-4" />
 </Button>
 )}
 </div>
 </div>
 </div>
 </div>
 );
}
