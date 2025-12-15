import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, FileText, Users, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import bwildLogo from '@/assets/bwild-logo.png';
import { TemplateSelector } from '@/components/formalizacao/TemplateSelector';
import { BudgetItemSwapForm } from '@/components/formalizacao/BudgetItemSwapForm';
import { MeetingMinutesForm } from '@/components/formalizacao/MeetingMinutesForm';
import { ExceptionCustodyForm } from '@/components/formalizacao/ExceptionCustodyForm';
import { PartiesForm } from '@/components/formalizacao/PartiesForm';
import { ReviewStep } from '@/components/formalizacao/ReviewStep';
import { useCreateFormalizacao, useAddParty, useSendForSignature } from '@/hooks/useFormalizacoes';
import { useToast } from '@/hooks/use-toast';
import type { FormalizationType } from '@/types/formalization';

type WizardStep = 'template' | 'form' | 'parties' | 'review';

interface FormData {
  type: FormalizationType | null;
  title: string;
  summary: string;
  body_md: string;
  data: Record<string, unknown>;
  parties: Array<{
    party_type: 'customer' | 'company';
    display_name: string;
    email: string;
    role_label: string;
    must_sign: boolean;
  }>;
}

const STEPS: { key: WizardStep; label: string; icon: React.ReactNode }[] = [
  { key: 'template', label: 'Template', icon: <FileText className="h-4 w-4" /> },
  { key: 'form', label: 'Dados', icon: <FileText className="h-4 w-4" /> },
  { key: 'parties', label: 'Partes', icon: <Users className="h-4 w-4" /> },
  { key: 'review', label: 'Revisar', icon: <Send className="h-4 w-4" /> },
];

export default function FormalizacaoNova() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<WizardStep>('template');
  const [formData, setFormData] = useState<FormData>({
    type: null,
    title: '',
    summary: '',
    body_md: '',
    data: {},
    parties: [],
  });

  const createFormalizacao = useCreateFormalizacao();
  const addParty = useAddParty();
  const sendForSignature = useSendForSignature();

  const currentStepIndex = STEPS.findIndex(s => s.key === currentStep);
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100;

  const handleTemplateSelect = (type: FormalizationType) => {
    setFormData(prev => ({ ...prev, type }));
    setCurrentStep('form');
  };

  const handleFormComplete = (data: { title: string; summary: string; body_md: string; data: Record<string, unknown> }) => {
    setFormData(prev => ({ ...prev, ...data }));
    setCurrentStep('parties');
  };

  const handlePartiesComplete = (parties: FormData['parties']) => {
    setFormData(prev => ({ ...prev, parties }));
    setCurrentStep('review');
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].key);
    } else {
      navigate('/formalizacoes');
    }
  };

  const handleSubmit = async (sendNow: boolean) => {
    try {
      // Create the formalization
      const result = await createFormalizacao.mutateAsync({
        type: formData.type!,
        title: formData.title,
        summary: formData.summary,
        body_md: formData.body_md,
        data: formData.data as any,
        status: 'draft',
        customer_org_id: '', // Will be set by RLS/trigger
        created_by: '', // Will be set by RLS/trigger
      });

      // Add parties
      for (const party of formData.parties) {
        await addParty.mutateAsync({
          formalization_id: result.id,
          party_type: party.party_type,
          display_name: party.display_name,
          email: party.email,
          role_label: party.role_label,
          must_sign: party.must_sign,
        });
      }

      // Send for signature if requested
      if (sendNow) {
        await sendForSignature.mutateAsync(result.id);
        toast({
          title: 'Formalização enviada',
          description: 'A formalização foi enviada para ciência das partes.',
        });
      } else {
        toast({
          title: 'Rascunho salvo',
          description: 'A formalização foi salva como rascunho.',
        });
      }

      navigate(`/formalizacoes/${result.id}`);
    } catch (error) {
      console.error('Error creating formalization:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível criar a formalização. Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'template':
        return <TemplateSelector onSelect={handleTemplateSelect} />;
      case 'form':
        if (formData.type === 'budget_item_swap') {
          return <BudgetItemSwapForm onComplete={handleFormComplete} initialData={formData} />;
        }
        if (formData.type === 'meeting_minutes') {
          return <MeetingMinutesForm onComplete={handleFormComplete} initialData={formData} />;
        }
        if (formData.type === 'exception_custody') {
          return <ExceptionCustodyForm onComplete={handleFormComplete} initialData={formData} />;
        }
        return null;
      case 'parties':
        return <PartiesForm onComplete={handlePartiesComplete} initialParties={formData.parties} />;
      case 'review':
        return (
          <ReviewStep 
            formData={formData} 
            onSubmit={handleSubmit}
            isSubmitting={createFormalizacao.isPending || addParty.isPending || sendForSignature.isPending}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleBack}
              aria-label="Voltar"
              className="rounded-full"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <img src={bwildLogo} alt="Bwild" className="h-8" />
            <span className="text-muted-foreground">|</span>
            <h1 className="text-lg font-semibold">Nova Formalização</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-3xl">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {STEPS.map((step, index) => (
              <div 
                key={step.key}
                className={`flex items-center gap-2 text-sm ${
                  index <= currentStepIndex ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  index <= currentStepIndex ? 'bg-primary text-primary-foreground' : 'bg-muted'
                }`}>
                  {step.icon}
                </div>
                <span className="hidden sm:inline">{step.label}</span>
                {index < STEPS.length - 1 && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground mx-2" />
                )}
              </div>
            ))}
          </div>
          <Progress value={progress} className="h-2" aria-label={`Progresso: ${Math.round(progress)}%`} />
        </div>

        {/* Step content */}
        {renderStepContent()}
      </main>
    </div>
  );
}
