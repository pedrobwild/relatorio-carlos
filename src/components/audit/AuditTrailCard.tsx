/**
 * Contextual Audit Trail Card
 *
 * Shows the last N audit entries for a specific entity.
 * Use in Documents, Formalizations, Activities pages.
 */

import { History, User, Clock, AlertCircle, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useEntityAuditTrail } from "@/hooks/useAuditoria";
import type { AuditoriaWithUser } from "@/infra/repositories/auditoria.repository";

interface AuditTrailCardProps {
  entidade: string;
  entidadeId: string;
  title?: string;
  maxItems?: number;
  className?: string;
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Agora";
  if (diffMins < 60) return `${diffMins}min`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
};

const getActionConfig = (
  acao: string,
): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
} => {
  const configs: Record<
    string,
    {
      label: string;
      variant: "default" | "secondary" | "destructive" | "outline";
    }
  > = {
    create: { label: "Criado", variant: "default" },
    update: { label: "Atualizado", variant: "secondary" },
    delete: { label: "Removido", variant: "destructive" },
  };
  return configs[acao] || { label: acao, variant: "outline" };
};

function AuditItem({ audit }: { audit: AuditoriaWithUser }) {
  const actionConfig = getActionConfig(audit.acao);
  const userName =
    audit.users_profile?.nome || audit.users_profile?.email || "Sistema";

  return (
    <div className="flex items-start gap-3 py-2 border-b last:border-0">
      <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
        <User className="h-3 w-3 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={actionConfig.variant} className="text-[10px] h-5">
            {actionConfig.label}
          </Badge>
          <span className="text-xs text-muted-foreground truncate">
            {userName}
          </span>
        </div>
        <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {formatDate(audit.created_at)}
        </div>
      </div>
    </div>
  );
}

function AuditDetailDialog({ audit }: { audit: AuditoriaWithUser }) {
  const actionConfig = getActionConfig(audit.acao);
  const userName =
    audit.users_profile?.nome || audit.users_profile?.email || "Sistema";

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-11 w-11 min-h-[44px] min-w-[44px] p-0"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Detalhes da Alteração
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Ação</p>
              <Badge variant={actionConfig.variant}>{actionConfig.label}</Badge>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Data/Hora</p>
              <p>{new Date(audit.created_at).toLocaleString("pt-BR")}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Usuário</p>
              <p>{userName}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Entidade</p>
              <p className="capitalize">{audit.entidade}</p>
            </div>
          </div>

          {audit.diff && (
            <div>
              <p className="text-muted-foreground text-xs mb-2">
                Alterações (diff)
              </p>
              <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-48">
                {JSON.stringify(audit.diff, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AuditTrailCard({
  entidade,
  entidadeId,
  title = "Histórico",
  maxItems = 10,
  className = "",
}: AuditTrailCardProps) {
  const {
    data: audits = [],
    isLoading,
    error,
  } = useEntityAuditTrail(entidade, entidadeId, maxItems);

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <History className="h-4 w-4" />
          {title}
          {audits.length > 0 && (
            <Badge variant="outline" className="ml-auto text-xs">
              {audits.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-6 w-6 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-4">
            <AlertCircle className="h-6 w-6 text-destructive/50 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">
              Erro ao carregar histórico
            </p>
          </div>
        ) : audits.length === 0 ? (
          <div className="text-center py-4">
            <History className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">
              Nenhuma alteração registrada
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[250px]">
            <div className="space-y-0">
              {audits.map((audit) => (
                <div key={audit.id} className="flex items-start gap-1">
                  <div className="flex-1">
                    <AuditItem audit={audit} />
                  </div>
                  <AuditDetailDialog audit={audit} />
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Compact inline version for embedding in forms/panels
 */
export function AuditTrailInline({
  entidade,
  entidadeId,
  maxItems = 5,
}: {
  entidade: string;
  entidadeId: string;
  maxItems?: number;
}) {
  const { data: audits = [], isLoading } = useEntityAuditTrail(
    entidade,
    entidadeId,
    maxItems,
  );

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
    );
  }

  if (audits.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">Sem histórico disponível</p>
    );
  }

  return (
    <div className="space-y-1">
      {audits.map((audit) => {
        const actionConfig = getActionConfig(audit.acao);
        return (
          <div key={audit.id} className="flex items-center gap-2 text-xs">
            <Badge
              variant={actionConfig.variant}
              className="text-[10px] h-4 px-1"
            >
              {actionConfig.label}
            </Badge>
            <span className="text-muted-foreground truncate">
              {audit.users_profile?.nome || "Sistema"}
            </span>
            <span className="text-muted-foreground ml-auto">
              {formatDate(audit.created_at)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
