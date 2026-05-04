import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export interface Step {
  label: string;
  description?: string;
}

interface FormStepperProps {
  steps: Step[];
  currentStep: number;
  /** Steps that passed validation and can be revisited */
  completedSteps: Set<number>;
  onStepClick?: (index: number) => void;
}

export function FormStepper({
  steps,
  currentStep,
  completedSteps,
  onStepClick,
}: FormStepperProps) {
  return (
    <nav aria-label="Progresso do formulário" className="w-full">
      {/* Desktop horizontal stepper */}
      <ol className="hidden sm:flex items-center w-full">
        {steps.map((step, i) => {
          const isCompleted = completedSteps.has(i);
          const isCurrent = i === currentStep;
          const isClickable = isCompleted || isCurrent;

          return (
            <li
              key={i}
              className={cn(
                "flex items-center",
                i < steps.length - 1 && "flex-1",
              )}
            >
              <button
                type="button"
                disabled={!isClickable}
                onClick={() => isClickable && onStepClick?.(i)}
                className={cn(
                  "flex items-center gap-2.5 group transition-colors",
                  isClickable ? "cursor-pointer" : "cursor-default",
                )}
                aria-current={isCurrent ? "step" : undefined}
              >
                <span
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold border-2 transition-all shrink-0",
                    isCurrent &&
                      "border-primary bg-primary text-primary-foreground scale-110",
                    isCompleted &&
                      !isCurrent &&
                      "border-primary bg-primary/10 text-primary",
                    !isCompleted &&
                      !isCurrent &&
                      "border-muted-foreground/30 text-muted-foreground",
                  )}
                >
                  {isCompleted && !isCurrent ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    i + 1
                  )}
                </span>
                <span
                  className={cn(
                    "text-xs font-medium whitespace-nowrap",
                    isCurrent ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {step.label}
                </span>
              </button>
              {i < steps.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-3 rounded-full transition-colors",
                    isCompleted ? "bg-primary/40" : "bg-border",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>

      {/* Mobile compact stepper */}
      <div className="sm:hidden flex items-center gap-3">
        <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
          {currentStep + 1}/{steps.length}
        </span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">
            {steps[currentStep].label}
          </p>
          {steps[currentStep].description && (
            <p className="text-xs text-muted-foreground">
              {steps[currentStep].description}
            </p>
          )}
        </div>
        {/* Progress dots */}
        <div className="flex gap-1">
          {steps.map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-2 h-2 rounded-full transition-colors",
                i === currentStep
                  ? "bg-primary"
                  : completedSteps.has(i)
                    ? "bg-primary/40"
                    : "bg-border",
              )}
            />
          ))}
        </div>
      </div>
    </nav>
  );
}
