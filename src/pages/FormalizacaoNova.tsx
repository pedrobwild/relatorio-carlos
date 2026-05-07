import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  FileText,
  Users,
  Send,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import bwildLogo from "@/assets/bwild-logo-dark.png";
import { TemplateSelector } from "@/components/formalizacao/TemplateSelector";
import { BudgetItemSwapForm } from "@/components/formalizacao/BudgetItemSwapForm";
import { MeetingMinutesForm } from "@/components/formalizacao/MeetingMinutesForm";
import { ExceptionCustodyForm } from "@/components/formalizacao/ExceptionCustodyForm";
import { PartiesForm } from "@/components/formalizacao/PartiesForm";
import { ReviewStep } from "@/components/formalizacao/ReviewStep";
import { GenericFormEditor } from "@/components/formalizacao/GenericFormEditor";
import {
  useCreateFormalizacao,
  useAddParty,
  useSendForSignature,
} from "@/hooks/useFormalizacoes";
import { useToast } from "@/hooks/use-toast";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formalizationTemplates } from "@/data/formalizationTemplates";
import type { FormalizationType } from "@/types/formalization";

type WizardStep = "template" | "form" | "parties" | "review";

interface FormData {
  type: FormalizationType | null;
  title: string;
  summary: string;
  body_md: string;
  data: Record<string, unknown>;
  parties: Array<{
    party_type: "customer" | "company";
    display_name: string;
    email: string;
    role_label?: string;
    must_sign: boolean;
  }>;
}

const STEPS: {
  key: WizardStep;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
}[] = [
  {
    key: "template",
    label: "Template",
    shortLabel: "1",
    icon: <FileText className="h-4 w-4" />,
  },
  {
    key: "form",
    label: "Dados",
    shortLabel: "2",
    icon: <FileText className="h-4 w-4" />,
  },
  {
    key: "parties",
    label: "Partes",
    shortLabel: "3",
    icon: <Users className="h-4 w-4" />,
  },
  {
    key: "review",
    label: "Revisar",
    shortLabel: "4",
    icon: <Send className="h-4 w-4" />,
  },
];

export default function FormalizacaoNova() {
  const navigate = useNavigate();
  const { paths, projectId } = useProjectNavigation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<WizardStep>("template");
  const [formData, setFormData] = useState<FormData>({
    type: null,
    title: "",
    summary: "",
    body_md: "",
    data: {},
    parties: [],
  });

  // Fetch user profile to get customer_org_id
  const { data: profile, error: profileError } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("customer_org_id")
        .eq("user_id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const createFormalizacao = useCreateFormalizacao();
  const addParty = useAddParty();
  const sendForSignature = useSendForSignature();

  const currentStepIndex = STEPS.findIndex((s) => s.key === currentStep);
  const _progress = ((currentStepIndex + 1) / STEPS.length) * 100;

  const handleTemplateSelect = (type: FormalizationType) => {
    const template = formalizationTemplates[type];
    setFormData((prev) => ({
      ...prev,
      type,
      title: template?.title || "",
      summary: template?.summary || "",
      body_md: template?.body_md || "",
    }));
    setCurrentStep("form");
  };

  const handleFormComplete = (data: {
    title: string;
    summary: string;
    body_md: string;
    data: Record<string, unknown>;
  }) => {
    setFormData((prev) => ({ ...prev, ...data }));
    setCurrentStep("parties");
  };

  const handlePartiesComplete = (parties: FormData["parties"]) => {
    setFormData((prev) => ({ ...prev, parties }));
    setCurrentStep("review");
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].key);
    } else {
      navigate(paths.formalizacoes);
    }
  };

  const handleSubmit = async (sendNow: boolean) => {
    if (!user?.id || !profile?.customer_org_id) {
      toast({
        title: "Erro",
        description: "Usuário não autenticado ou perfil não encontrado.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Create the formalization
      const result = await createFormalizacao.mutateAsync({
        type: formData.type!,
        title: formData.title,
        summary: formData.summary,
        body_md: formData.body_md,
        data: formData.data as import("@/integrations/supabase/types").Json,
        status: "draft",
        customer_org_id: profile.customer_org_id,
        created_by: user.id,
        project_id: projectId || null,
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
          title: "Formalização enviada",
          description: "A formalização foi enviada para ciência das partes.",
        });
      } else {
        toast({
          title: "Rascunho salvo",
          description: "A formalização foi salva como rascunho.",
        });
      }

      navigate(
        projectId
          ? `/obra/${projectId}/formalizacoes/${result.id}`
          : `/formalizacoes/${result.id}`,
      );
    } catch (error) {
      console.error("Error creating formalization:", error);
      toast({
        title: "Erro",
        description: "Não foi possível criar a formalização. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  if (profileError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <p className="text-destructive font-medium">
            Erro ao carregar perfil
          </p>
          <p className="text-sm text-muted-foreground">
            Recarregue a página e tente novamente.
          </p>
        </div>
      </div>
    );
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case "template":
        return <TemplateSelector onSelect={handleTemplateSelect} />;
      case "form":
        if (formData.type === "budget_item_swap") {
          return (
            <BudgetItemSwapForm
              onComplete={handleFormComplete}
              initialData={formData}
            />
          );
        }
        if (formData.type === "meeting_minutes") {
          return (
            <MeetingMinutesForm
              onComplete={handleFormComplete}
              initialData={formData}
            />
          );
        }
        if (formData.type === "exception_custody") {
          return (
            <ExceptionCustodyForm
              onComplete={handleFormComplete}
              initialData={formData}
            />
          );
        }
        // scope_change, general — use generic form with pre-filled template
        return (
          <GenericFormEditor
            onComplete={handleFormComplete}
            initialData={formData}
          />
        );
      case "parties":
        return (
          <PartiesForm
            onComplete={handlePartiesComplete}
            initialParties={formData.parties}
          />
        );
      case "review":
        return (
          <ReviewStep
            formData={formData}
            onSubmit={handleSubmit}
            isSubmitting={
              createFormalizacao.isPending ||
              addParty.isPending ||
              sendForSignature.isPending
            }
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b">
        <div className="mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBack}
                aria-label="Voltar"
                className="rounded-full h-9 w-9 hover:bg-primary/10"
              >
                {currentStepIndex === 0 ? (
                  <ArrowLeft className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-5 w-5" />
                )}
              </Button>
              <img src={bwildLogo} alt="Bwild" className="h-6" />
              <span className="text-muted-foreground/30">|</span>
              <h1 className="text-sm font-medium">Nova Formalização</h1>
            </div>

            {/* Step indicator for mobile */}
            <span className="text-xs text-muted-foreground sm:hidden">
              Passo {currentStepIndex + 1} de {STEPS.length}
            </span>
          </div>
        </div>
      </header>

      {/* Progress indicator */}
      <div className="bg-muted/30 border-b">
        <div className="mx-auto px-4 py-4">
          {/* Desktop stepper */}
          <div className="hidden sm:flex items-center justify-between max-w-2xl mx-auto">
            {STEPS.map((step, index) => {
              const isCompleted = index < currentStepIndex;
              const isCurrent = index === currentStepIndex;

              return (
                <div key={step.key} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={`
                      w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300
                      ${isCompleted ? "bg-primary text-primary-foreground" : ""}
                      ${isCurrent ? "bg-primary text-primary-foreground ring-4 ring-primary/20" : ""}
                      ${!isCompleted && !isCurrent ? "bg-muted text-muted-foreground" : ""}
                    `}
                    >
                      {isCompleted ? <Check className="h-5 w-5" /> : step.icon}
                    </div>
                    <span
                      className={`text-xs mt-2 font-medium ${isCurrent ? "text-primary" : "text-muted-foreground"}`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div
                      className={`w-16 h-0.5 mx-2 transition-colors ${index < currentStepIndex ? "bg-primary" : "bg-muted"}`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Mobile progress bar */}
          <div className="sm:hidden space-y-2">
            <div className="flex justify-between">
              {STEPS.map((step, index) => (
                <div
                  key={step.key}
                  className={`flex-1 mx-0.5 h-1.5 rounded-full transition-colors ${
                    index <= currentStepIndex ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>
            <p className="text-xs text-center text-muted-foreground">
              {STEPS[currentStepIndex].label}
            </p>
          </div>
        </div>
      </div>

      {/* Step content */}
      <main className="flex-1 mx-auto w-full px-4 py-6 max-w-2xl">
        <div className="animate-fade-in">{renderStepContent()}</div>
      </main>
    </div>
  );
}
