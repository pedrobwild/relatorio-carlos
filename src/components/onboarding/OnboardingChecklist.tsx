import { useState, useEffect, useMemo } from 'react';
import { Check, Circle, ChevronRight, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useUserRole, type AppRole } from '@/hooks/useUserRole';
import { useAuth } from '@/hooks/useAuth';
import { track } from '@/lib/telemetry';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Role-specific - only show for these roles */
  roles?: AppRole[];
}

interface OnboardingChecklistProps {
  projectId?: string;
  /** Override steps (otherwise uses role-based defaults) */
  steps?: OnboardingStep[];
  /** Called when checklist is dismissed */
  onDismiss?: () => void;
  /** Custom className */
  className?: string;
}

// Default steps by role
const getDefaultSteps = (role: AppRole | string, navigate: (path: string) => void): OnboardingStep[] => {
  const customerSteps: OnboardingStep[] = [
    {
      id: 'view_schedule',
      title: 'Acompanhe o cronograma',
      description: 'Veja o progresso da sua obra na Curva S',
      roles: ['customer'],
    },
    {
      id: 'check_documents',
      title: 'Confira os documentos',
      description: 'Acesse contratos, projetos e aprovações',
      roles: ['customer'],
    },
    {
      id: 'review_formalizations',
      title: 'Revise formalizações',
      description: 'Dê ciência em decisões importantes',
      roles: ['customer'],
    },
    {
      id: 'check_payments',
      title: 'Acompanhe pagamentos',
      description: 'Veja boletos e comprovantes',
      roles: ['customer'],
    },
  ];

  const staffSteps: OnboardingStep[] = [
    {
      id: 'create_schedule',
      title: 'Cadastre o cronograma',
      description: 'Adicione atividades e datas previstas',
      roles: ['engineer', 'manager', 'admin'],
    },
    {
      id: 'upload_documents',
      title: 'Envie documentos',
      description: 'Contrato, projeto 3D, executivo',
      roles: ['engineer', 'manager', 'admin'],
    },
    {
      id: 'configure_journey',
      title: 'Configure a jornada',
      description: 'Personalize etapas para o cliente',
      roles: ['engineer', 'manager', 'admin'],
    },
    {
      id: 'add_payments',
      title: 'Cadastre pagamentos',
      description: 'Parcelas e boletos do projeto',
      roles: ['engineer', 'manager', 'admin'],
    },
  ];

  if (role === 'customer') {
    return customerSteps;
  }
  return staffSteps;
};

function getStorageKey(projectId: string | undefined, userId: string | undefined): string {
  return `onboarding:${projectId ?? 'global'}:${userId ?? 'anon'}`;
}

export function OnboardingChecklist({
  projectId,
  steps: customSteps,
  onDismiss,
  className,
}: OnboardingChecklistProps) {
  const { roles, isStaff, isCustomer } = useUserRole();
  const { user } = useAuth();
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [isDismissed, setIsDismissed] = useState(false);

  const storageKey = useMemo(
    () => getStorageKey(projectId, user?.id),
    [projectId, user?.id]
  );

  // Load progress from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setCompletedSteps(parsed.completed || []);
        setIsDismissed(parsed.dismissed || false);
      }
    } catch {
      // Ignore parse errors
    }
  }, [storageKey]);

  // Get steps filtered by role
  const steps = useMemo(() => {
    if (customSteps) return customSteps;

    const primaryRole = isStaff ? 'engineer' : isCustomer ? 'customer' : roles[0];
    const defaultSteps = getDefaultSteps(primaryRole || 'customer', () => {});
    
    return defaultSteps.filter(step => {
      if (!step.roles) return true;
      return roles.some(role => step.roles?.includes(role));
    });
  }, [customSteps, roles, isStaff, isCustomer]);

  const toggleStep = (stepId: string) => {
    const isCompleted = completedSteps.includes(stepId);
    const newCompleted = isCompleted
      ? completedSteps.filter(id => id !== stepId)
      : [...completedSteps, stepId];

    setCompletedSteps(newCompleted);

    // Persist to localStorage
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ completed: newCompleted, dismissed: isDismissed })
      );
    } catch {
      // Ignore storage errors
    }

    // Track completion
    if (!isCompleted) {
      track('complete_onboarding_step', { stepId }, { projectId });
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ completed: completedSteps, dismissed: true })
      );
    } catch {
      // Ignore storage errors
    }
    onDismiss?.();
  };

  const progress = (completedSteps.length / steps.length) * 100;
  const isComplete = completedSteps.length === steps.length;

  // Don't render if dismissed or fully complete
  if (isDismissed || isComplete) {
    return null;
  }

  return (
    <Card className={cn('border-primary/20 bg-gradient-to-br from-primary/5 to-background', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Primeiros passos</CardTitle>
              <p className="text-xs text-muted-foreground">
                {completedSteps.length} de {steps.length} concluídos
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={handleDismiss}
            aria-label="Fechar checklist"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <Progress value={progress} className="h-1.5 mt-3" />
      </CardHeader>

      <CardContent className="pt-0">
        <ul className="space-y-2" role="list" aria-label="Passos do onboarding">
          {steps.map((step) => {
            const isChecked = completedSteps.includes(step.id);
            
            return (
              <li key={step.id}>
                <button
                  onClick={() => toggleStep(step.id)}
                  className={cn(
                    'w-full flex items-start gap-3 p-3 rounded-lg text-left transition-all',
                    'hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    isChecked && 'bg-primary/5'
                  )}
                  aria-pressed={isChecked}
                >
                  <div
                    className={cn(
                      'h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors',
                      isChecked
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'border-muted-foreground/30'
                    )}
                  >
                    {isChecked && <Check className="h-3 w-3" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        'text-sm font-medium',
                        isChecked && 'line-through text-muted-foreground'
                      )}
                    >
                      {step.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {step.description}
                    </p>
                  </div>
                  {step.action && !isChecked && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        step.action?.onClick();
                      }}
                    >
                      {step.action.label}
                      <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

export default OnboardingChecklist;
