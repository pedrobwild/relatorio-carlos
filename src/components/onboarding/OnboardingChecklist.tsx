import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronRight, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { track } from "@/lib/telemetry";
import { supabase } from "@/integrations/supabase/client";
import { logError } from "@/lib/errorLogger";
import {
  getOnboardingFlow,
  type ObraStatus,
  type OnboardingRole,
  type OnboardingStep,
} from "@/content/onboardingFlows";

export type { OnboardingStep, OnboardingRole, ObraStatus };

interface OnboardingChecklistProps {
  projectId?: string;
  /** Sobrescreve a detecção automática de papel. */
  userRole?: OnboardingRole;
  /** Fase da obra. Default: `'execucao'`. */
  obraStatus?: ObraStatus;
  /** Override total dos passos (ignora `userRole` / `obraStatus`). */
  steps?: OnboardingStep[];
  /** Chamado quando o checklist é dispensado. */
  onDismiss?: () => void;
  className?: string;
}

const STORAGE_PREFIX = "onboarding";

function getStorageKey(
  projectId: string | undefined,
  userId: string | undefined,
  flowKey: string,
): string {
  return `${STORAGE_PREFIX}:${flowKey}:${projectId ?? "global"}:${userId ?? "anon"}`;
}

function inferRoleFromAppRole(args: {
  isAdmin: boolean;
  isStaff: boolean;
  isCustomer: boolean;
}): OnboardingRole {
  if (args.isAdmin) return "admin";
  if (args.isCustomer) return "cliente";
  if (args.isStaff) return "equipe";
  return "cliente";
}

interface OnboardingProgressRow {
  step_key: string;
  completed_at: string | null;
}

async function fetchProgress(
  userId: string,
  projectId: string | null,
): Promise<{ completed: string[]; dismissed: boolean } | null> {
  // Cast to `any` because the generated Supabase types haven't been
  // regenerated yet for the new `onboarding_progress` table.
  const base = (supabase as any)
    .from("onboarding_progress")
    .select("step_key, completed_at, dismissed")
    .eq("user_id", userId);

  const { data, error } = projectId
    ? await base.eq("obra_id", projectId)
    : await base.is("obra_id", null);

  if (error) {
    logError("onboarding.fetch_progress_failed", error, { userId, projectId });
    return null;
  }

  const rows = (data ?? []) as Array<
    OnboardingProgressRow & { dismissed: boolean }
  >;
  return {
    completed: rows.filter((r) => r.completed_at).map((r) => r.step_key),
    dismissed: rows.some((r) => r.dismissed),
  };
}

async function persistStep(args: {
  userId: string;
  projectId: string | null;
  stepKey: string;
  completed: boolean;
  dismissed?: boolean;
}): Promise<void> {
  const { userId, projectId, stepKey, completed, dismissed } = args;
  const { error } = await (supabase as any).from("onboarding_progress").upsert(
    {
      user_id: userId,
      obra_id: projectId,
      step_key: stepKey,
      completed_at: completed ? new Date().toISOString() : null,
      dismissed: dismissed ?? false,
    },
    { onConflict: "user_id,obra_id,step_key" },
  );

  if (error) {
    logError("onboarding.persist_step_failed", error, args);
  }
}

export function OnboardingChecklist({
  projectId,
  userRole,
  obraStatus = "execucao",
  steps: customSteps,
  onDismiss,
  className,
}: OnboardingChecklistProps) {
  const { isStaff, isCustomer, isAdmin } = useUserRole();
  const { user } = useAuth();
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  const resolvedRole: OnboardingRole = useMemo(
    () => userRole ?? inferRoleFromAppRole({ isAdmin, isStaff, isCustomer }),
    [userRole, isAdmin, isStaff, isCustomer],
  );

  const flowKey = `${resolvedRole}:${obraStatus}`;

  const steps: OnboardingStep[] = useMemo(() => {
    if (customSteps) return customSteps;
    return getOnboardingFlow(resolvedRole, obraStatus);
  }, [customSteps, resolvedRole, obraStatus]);

  const storageKey = useMemo(
    () => getStorageKey(projectId, user?.id, flowKey),
    [projectId, user?.id, flowKey],
  );

  // Hydrate from Supabase (with localStorage fallback)
  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      // localStorage first for instant render
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (!cancelled) {
            setCompletedSteps(parsed.completed ?? []);
            setIsDismissed(Boolean(parsed.dismissed));
          }
        }
      } catch {
        // ignore parse errors
      }

      if (user?.id) {
        const remote = await fetchProgress(user.id, projectId ?? null);
        if (remote && !cancelled) {
          setCompletedSteps(remote.completed);
          setIsDismissed(remote.dismissed);
        }
      }

      if (!cancelled) setIsHydrated(true);
    }

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [storageKey, user?.id, projectId]);

  const writeLocal = useCallback(
    (completed: string[], dismissed: boolean) => {
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({ completed, dismissed }),
        );
      } catch {
        // ignore
      }
    },
    [storageKey],
  );

  const toggleStep = useCallback(
    async (stepId: string) => {
      const isCompleted = completedSteps.includes(stepId);
      const newCompleted = isCompleted
        ? completedSteps.filter((id) => id !== stepId)
        : [...completedSteps, stepId];

      setCompletedSteps(newCompleted);
      writeLocal(newCompleted, isDismissed);

      if (!isCompleted) {
        track("complete_onboarding_step", { stepId }, { projectId });
      }

      if (user?.id) {
        await persistStep({
          userId: user.id,
          projectId: projectId ?? null,
          stepKey: stepId,
          completed: !isCompleted,
        });
      }
    },
    [completedSteps, isDismissed, projectId, user?.id, writeLocal],
  );

  const handleDismiss = useCallback(async () => {
    setIsDismissed(true);
    writeLocal(completedSteps, true);

    if (user?.id) {
      // dismiss is a per-flow, not per-step, signal — write a sentinel row
      await persistStep({
        userId: user.id,
        projectId: projectId ?? null,
        stepKey: `__dismissed__:${flowKey}`,
        completed: false,
        dismissed: true,
      });
    }

    onDismiss?.();
  }, [completedSteps, flowKey, projectId, user?.id, onDismiss, writeLocal]);

  if (steps.length === 0) return null;

  const progress = (completedSteps.length / steps.length) * 100;
  const isComplete = completedSteps.length === steps.length;

  if (!isHydrated) return null;
  if (isDismissed || isComplete) return null;

  return (
    <Card
      className={cn(
        "border-primary/20 bg-gradient-to-br from-primary/5 to-background",
        className,
      )}
      data-testid="onboarding-checklist"
      data-flow-key={flowKey}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
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
                <div
                  className={cn(
                    "w-full flex items-start gap-3 p-3 rounded-lg transition-all",
                    "hover:bg-accent/50",
                    isChecked && "bg-primary/5",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => void toggleStep(step.id)}
                    aria-pressed={isChecked}
                    aria-label={
                      isChecked
                        ? `Desmarcar passo: ${step.title}`
                        : `Marcar passo concluído: ${step.title}`
                    }
                    className={cn(
                      "h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      isChecked
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-muted-foreground/30",
                    )}
                  >
                    {isChecked && <Check className="h-3 w-3" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        isChecked && "line-through text-muted-foreground",
                      )}
                    >
                      {step.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {step.description}
                    </p>
                  </div>
                  {step.href && !isChecked && (
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                    >
                      <Link to={step.href}>
                        {step.ctaLabel ?? "Abrir"}
                        <ChevronRight className="h-3 w-3 ml-1" />
                      </Link>
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

export default OnboardingChecklist;
