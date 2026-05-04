import { MapPin, Ruler, Key, User, Phone, Mail, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseLocalDate } from "@/lib/activityStatus";
import type { StudioInfo } from "./TabFichaTecnica";

const statusColors: Record<string, string> = {
  active: "bg-green-500/10 text-green-600 border-green-500/20",
  completed: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  paused: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  cancelled: "bg-red-500/10 text-red-600 border-red-500/20",
};

const statusLabels: Record<string, string> = {
  active: "Em andamento",
  completed: "Concluída",
  paused: "Pausada",
  cancelled: "Cancelada",
};

const statusTooltips: Record<string, string> = {
  active: "Obra em execução — cronograma e financeiro ativos",
  completed: "Obra entregue e finalizada",
  paused: "Obra temporariamente pausada — sem atividades em andamento",
  cancelled: "Obra cancelada — não será retomada",
};

interface EditarObraSidebarProps {
  project: { name: string; status: string; is_project_phase?: boolean };
  studioInfo: StudioInfo;
  customer: {
    customer_name: string | null;
    customer_email: string | null;
    customer_phone: string | null;
  } | null;
}

export function EditarObraSidebar({
  project,
  studioInfo,
  customer,
}: EditarObraSidebarProps) {
  const hasAddress =
    studioInfo.endereco_completo || studioInfo.cidade || studioInfo.bairro;
  const hasStudioData =
    studioInfo.tamanho_imovel_m2 ||
    studioInfo.data_recebimento_chaves ||
    studioInfo.tipo_de_locacao;
  const hasCustomer = customer?.customer_name;
  const hasAnyData = hasAddress || hasStudioData || hasCustomer;

  if (!hasAnyData) return null;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-3">
        {/* Status */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Status da Obra
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className={`${statusColors[project.status]} cursor-help`}
                  >
                    {statusLabels[project.status]}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">{statusTooltips[project.status]}</p>
                </TooltipContent>
              </Tooltip>
            </div>
            {project.is_project_phase && (
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Fase
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="cursor-help">
                      Projeto
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">
                      Fase de planejamento e projeto — ainda não iniciou
                      execução
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Location & Studio Info */}
        {(hasAddress || hasStudioData) && (
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                Ficha Técnica
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-2.5">
              {hasAddress && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                  <span className="text-foreground leading-snug">
                    {[
                      studioInfo.endereco_completo,
                      studioInfo.bairro,
                      studioInfo.cidade,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                </div>
              )}
              {studioInfo.tamanho_imovel_m2 && (
                <div className="flex items-center gap-2 text-sm">
                  <Ruler className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span>{studioInfo.tamanho_imovel_m2}m²</span>
                </div>
              )}
              {studioInfo.tipo_de_locacao && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                    {studioInfo.tipo_de_locacao}
                  </span>
                </div>
              )}
              {studioInfo.data_recebimento_chaves && (
                <div className="flex items-center gap-2 text-sm">
                  <Key className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span>
                    Chaves:{" "}
                    {format(
                      parseLocalDate(studioInfo.data_recebimento_chaves),
                      "dd/MM/yyyy",
                      { locale: ptBR },
                    )}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Customer */}
        {hasCustomer && (
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-2">
              <p className="text-sm font-medium">{customer!.customer_name}</p>
              {customer!.customer_email && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{customer!.customer_email}</span>
                </div>
              )}
              {customer!.customer_phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  <span>{customer!.customer_phone}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  );
}
