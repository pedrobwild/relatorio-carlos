import {
  CheckCircle2,
  Circle,
  Clock,
  FileCode,
  FileText,
  Building,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

interface JourneyStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  status: "completed" | "current" | "pending";
}

interface ProjectJourneyProps {
  currentStep?: "projeto_3d" | "projeto_executivo" | "liberacao" | "completed";
  className?: string;
}

export function ProjectJourney({
  currentStep = "projeto_3d",
  className,
}: ProjectJourneyProps) {
  const getStepStatus = (
    stepId: string,
  ): "completed" | "current" | "pending" => {
    const order = ["projeto_3d", "projeto_executivo", "liberacao", "completed"];
    const currentIndex = order.indexOf(currentStep);
    const stepIndex = order.indexOf(stepId);

    if (stepIndex < currentIndex) return "completed";
    if (stepIndex === currentIndex) return "current";
    return "pending";
  };

  const steps: JourneyStep[] = [
    {
      id: "projeto_3d",
      title: "Projeto 3D",
      description: "Desenvolvimento e aprovação do projeto em 3D",
      icon: <FileCode className="h-6 w-6" />,
      status: getStepStatus("projeto_3d"),
    },
    {
      id: "projeto_executivo",
      title: "Projeto Executivo",
      description: "Detalhamento técnico para execução",
      icon: <FileText className="h-6 w-6" />,
      status: getStepStatus("projeto_executivo"),
    },
    {
      id: "liberacao",
      title: "Liberação pelo Condomínio",
      description: "Aprovação da obra pelo condomínio",
      icon: <Building className="h-6 w-6" />,
      status: getStepStatus("liberacao"),
    },
  ];

  const getStatusIcon = (status: JourneyStep["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-8 w-8 text-primary" />;
      case "current":
        return <Clock className="h-8 w-8 text-primary animate-pulse" />;
      default:
        return <Circle className="h-8 w-8 text-muted-foreground/40" />;
    }
  };

  return (
    <div className={cn("w-full", className)}>
      <div className="relative">
        {/* Connection Line */}
        <div className="absolute left-[39px] top-[60px] bottom-[60px] w-0.5 bg-border md:hidden" />
        <div className="hidden md:block absolute top-[50px] left-[100px] right-[100px] h-0.5 bg-border" />

        {/* Progress Line */}
        <div
          className="absolute left-[39px] top-[60px] w-0.5 bg-primary transition-all duration-500 md:hidden"
          style={{
            height:
              currentStep === "completed"
                ? "calc(100% - 120px)"
                : currentStep === "liberacao"
                  ? "calc(66% - 40px)"
                  : currentStep === "projeto_executivo"
                    ? "calc(33% - 20px)"
                    : "0%",
          }}
        />
        <div
          className="hidden md:block absolute top-[50px] left-[100px] h-0.5 bg-primary transition-all duration-500"
          style={{
            width:
              currentStep === "completed"
                ? "calc(100% - 200px)"
                : currentStep === "liberacao"
                  ? "calc(66% - 100px)"
                  : currentStep === "projeto_executivo"
                    ? "calc(33% - 50px)"
                    : "0%",
          }}
        />

        {/* Steps */}
        <div className="flex flex-col md:flex-row md:justify-between gap-6 md:gap-4">
          {steps.map((step, index) => (
            <Card
              key={step.id}
              className={cn(
                "flex-1 transition-all duration-300",
                step.status === "current" && "ring-2 ring-primary shadow-lg",
                step.status === "pending" && "opacity-60",
              )}
            >
              <CardContent className="pt-6">
                <div className="flex items-start gap-4 md:flex-col md:items-center md:text-center">
                  <div className="relative z-10 bg-background rounded-full p-2">
                    {getStatusIcon(step.status)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 md:justify-center mb-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        Etapa {index + 1}
                      </span>
                      {step.status === "completed" && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          Concluído
                        </span>
                      )}
                      {step.status === "current" && (
                        <span className="text-xs bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full">
                          Em andamento
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-foreground">
                      {step.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {step.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
