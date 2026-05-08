import { useState } from "react";
import {
  Shield,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Database,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Status = {
  columns_present: number;
  columns_removed: boolean;
  with_pii_in_projects: number;
  pending_backfill: number;
  projects_in_project_customers: number;
  divergences: number;
  checked_at: string;
};

const QK = ["admin", "pii-projects-status"] as const;

const CODE_REFS = [
  "supabase/functions/sync-project-inbound",
  "supabase/functions/parse-budget-pdf",
  "supabase/functions/seed-demo-project",
  "supabase/functions/sync-monitor-agent",
  "src/hooks/useWeekActivities.ts",
  "src/hooks/usePurchasesByCreationRange.ts",
  "src/pages/nova-obra/useEditProjectLoader.ts",
  "src/pages/CalendarioObras.tsx",
];

export function PiiMigrationCard() {
  const qc = useQueryClient();
  const [confirmText, setConfirmText] = useState("");

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: QK,
    queryFn: async (): Promise<Status> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)(
        "pii_projects_status",
      );
      if (error) throw error;
      return data as Status;
    },
    staleTime: 30_000,
  });

  const backfill = useMutation({
    mutationFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)(
        "pii_projects_backfill",
      );
      if (error) throw error;
      return data as { inserted: number };
    },
    onSuccess: (res) => {
      toast.success("Backfill concluído", {
        description: `${res.inserted} registro(s) copiado(s) para project_customers.`,
      });
      qc.invalidateQueries({ queryKey: QK });
    },
    onError: (e: Error) => toast.error("Erro no backfill", { description: e.message }),
  });

  const dropCols = useMutation({
    mutationFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)(
        "pii_projects_drop_legacy_columns",
      );
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Colunas legadas removidas", {
        description: "client_name, client_email e client_phone foram apagadas de projects.",
      });
      qc.invalidateQueries({ queryKey: QK });
      setConfirmText("");
    },
    onError: (e: Error) =>
      toast.error("Não foi possível remover colunas", { description: e.message }),
  });

  const removed = data?.columns_removed === true;
  const canDrop =
    !!data &&
    !removed &&
    data.pending_backfill === 0 &&
    data.divergences === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Migração PII em projects
        </CardTitle>
        <CardDescription>
          Remove a duplicação de nome, e-mail e telefone do cliente em
          <code className="mx-1 px-1 rounded bg-muted text-xs">projects</code>
          migrando tudo para
          <code className="mx-1 px-1 rounded bg-muted text-xs">project_customers</code>
          (fonte única).
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status */}
        <div className="rounded-lg border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium flex items-center gap-2">
              <Database className="h-4 w-4" />
              Status atual
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`}
              />
            </Button>
          </div>

          {isLoading ? (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Verificando…
            </div>
          ) : !data ? (
            <p className="text-sm text-muted-foreground">
              Sem dados disponíveis.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {removed ? (
                <Badge className="bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 hover:bg-emerald-500/15">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Colunas removidas
                </Badge>
              ) : (
                <Badge variant="outline">
                  Colunas legadas: {data.columns_present}/3 presentes
                </Badge>
              )}
              <Badge variant="secondary">
                PII em projects: {data.with_pii_in_projects}
              </Badge>
              <Badge variant="secondary">
                Em project_customers: {data.projects_in_project_customers}
              </Badge>
              <Badge
                variant={data.pending_backfill > 0 ? "destructive" : "secondary"}
              >
                Pendentes de backfill: {data.pending_backfill}
              </Badge>
              <Badge
                variant={data.divergences > 0 ? "destructive" : "secondary"}
              >
                Divergências: {data.divergences}
              </Badge>
            </div>
          )}
        </div>

        {/* Ações */}
        {!removed && (
          <>
            <Separator />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => backfill.mutate()}
                disabled={backfill.isPending || !data}
              >
                {backfill.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Copiando…
                  </>
                ) : (
                  <>1. Rodar backfill</>
                )}
              </Button>

              <AlertDialog
                onOpenChange={(open) => {
                  if (!open) setConfirmText("");
                }}
              >
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    disabled={!canDrop || dropCols.isPending}
                  >
                    {dropCols.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Removendo…
                      </>
                    ) : (
                      <>2. Remover colunas (irreversível)</>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      Remover colunas legadas de projects?
                    </AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-3">
                        <p>
                          Esta ação executa{" "}
                          <code className="text-xs">DROP COLUMN</code> em
                          <code className="text-xs"> client_name</code>,
                          <code className="text-xs"> client_email</code> e
                          <code className="text-xs"> client_phone</code> da
                          tabela <code className="text-xs">projects</code>.
                          <strong> Não pode ser desfeita.</strong>
                        </p>
                        <p className="font-medium">
                          Antes de prosseguir, garanta que estes pontos do
                          código já leem/escrevem em{" "}
                          <code className="text-xs">project_customers</code>:
                        </p>
                        <ul className="list-disc list-inside text-xs space-y-0.5 max-h-40 overflow-auto rounded bg-muted/50 p-2">
                          {CODE_REFS.map((p) => (
                            <li key={p}>
                              <code>{p}</code>
                            </li>
                          ))}
                        </ul>
                        <div className="space-y-1">
                          <label className="text-sm font-medium block">
                            Para confirmar, digite{" "}
                            <code className="text-xs">REMOVER</code>:
                          </label>
                          <input
                            type="text"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            className="w-full px-3 py-1.5 rounded border border-input bg-background text-sm"
                            placeholder="REMOVER"
                          />
                        </div>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={confirmText !== "REMOVER"}
                      onClick={(e) => {
                        e.preventDefault();
                        if (confirmText === "REMOVER") dropCols.mutate();
                      }}
                    >
                      Remover colunas
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {data && !canDrop && (
              <p className="text-xs text-muted-foreground">
                A remoção fica habilitada quando{" "}
                <strong>pendentes de backfill = 0</strong> e{" "}
                <strong>divergências = 0</strong>.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
