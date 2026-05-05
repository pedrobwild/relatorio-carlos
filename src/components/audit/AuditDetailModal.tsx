import { History, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { AuditoriaWithUser } from "@/infra/repositories/auditoria.repository";

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

// eslint-disable-next-line react-refresh/only-export-components
export { getActionConfig };

export function AuditDetailModal({ audit }: { audit: AuditoriaWithUser }) {
  const actionConfig = getActionConfig(audit.acao);
  const userName =
    audit.users_profile?.nome || audit.users_profile?.email || "Sistema";

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Eye className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Detalhes do Registro de Auditoria
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">ID</p>
              <code className="text-xs bg-muted px-2 py-1 rounded">
                {audit.id.slice(0, 8)}...
              </code>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Ação</p>
              <Badge variant={actionConfig.variant}>{actionConfig.label}</Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Data/Hora</p>
              <p className="text-sm">
                {new Date(audit.created_at).toLocaleString("pt-BR")}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Usuário</p>
              <p className="text-sm">{userName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Entidade</p>
              <Badge variant="outline" className="capitalize">
                {audit.entidade}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">ID Entidade</p>
              <code className="text-xs bg-muted px-2 py-1 rounded">
                {audit.entidade_id.slice(0, 8)}...
              </code>
            </div>
            {audit.obra_id && (
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground mb-1">Obra ID</p>
                <code className="text-xs bg-muted px-2 py-1 rounded">
                  {audit.obra_id}
                </code>
              </div>
            )}
          </div>

          {audit.diff && (
            <div>
              <p className="text-sm font-medium mb-2">Alterações (diff)</p>
              <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-64 border">
                {JSON.stringify(audit.diff, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
