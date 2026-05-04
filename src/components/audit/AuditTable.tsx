import { History, User, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AuditDetailModal, getActionConfig } from "./AuditDetailModal";
import { EmptyState } from "@/components/ui-premium";
import type { AuditoriaWithUser } from "@/infra/repositories/auditoria.repository";

function TableLoading() {
  return (
    <TableBody>
      {[1, 2, 3, 4, 5].map((i) => (
        <TableRow key={i}>
          <TableCell>
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-32" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-6 w-20" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-32" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-8 w-8" />
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  );
}

interface AuditTableProps {
  audits: AuditoriaWithUser[];
  isLoading: boolean;
  error: unknown;
  totalCount: number;
  page: number;
  setPage: (p: number | ((prev: number) => number)) => void;
  pageSize: number;
  hasActiveFilters: boolean;
  onResetFilters: () => void;
}

export function AuditTable({
  audits,
  isLoading,
  error,
  totalCount,
  page,
  setPage,
  pageSize,
  hasActiveFilters,
  onResetFilters,
}: AuditTableProps) {
  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span>Registros de Auditoria</span>
          {!isLoading && (
            <Badge variant="secondary" className="text-xs">
              {totalCount} registro{totalCount !== 1 ? "s" : ""}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <EmptyState
            icon={History}
            title="Erro ao carregar auditoria"
            description="Ocorreu um problema ao buscar os registros. Tente atualizar a página."
            bare
            size="sm"
          />
        ) : (
          <>
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Data/Hora</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead className="w-[100px]">Ação</TableHead>
                    <TableHead>Entidade</TableHead>
                    <TableHead>ID Entidade</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                {isLoading ? (
                  <TableLoading />
                ) : audits.length === 0 ? (
                  <TableBody>
                    <TableRow>
                      <TableCell colSpan={6} className="p-0">
                        <EmptyState
                          icon={History}
                          title="Nenhum registro encontrado"
                          description={
                            hasActiveFilters
                              ? "Ajuste ou limpe os filtros para ampliar os resultados."
                              : "Não há eventos de auditoria registrados ainda."
                          }
                          action={
                            hasActiveFilters
                              ? {
                                  label: "Limpar filtros",
                                  onClick: onResetFilters,
                                  variant: "outline",
                                }
                              : undefined
                          }
                          bare
                          size="sm"
                        />
                      </TableCell>
                    </TableRow>
                  </TableBody>
                ) : (
                  <TableBody>
                    {audits.map((audit) => {
                      const actionConfig = getActionConfig(audit.acao);
                      const userName =
                        audit.users_profile?.nome ||
                        audit.users_profile?.email ||
                        "Sistema";

                      return (
                        <TableRow key={audit.id}>
                          <TableCell className="text-xs">
                            {new Date(audit.created_at).toLocaleString("pt-BR")}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                                <User className="h-3 w-3" />
                              </div>
                              <span className="text-sm truncate max-w-[150px]">
                                {userName}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={actionConfig.variant}
                              className="text-xs"
                            >
                              {actionConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="capitalize text-xs"
                            >
                              {audit.entidade}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {audit.entidade_id.slice(0, 8)}...
                            </code>
                          </TableCell>
                          <TableCell>
                            <AuditDetailModal audit={audit} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                )}
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-muted-foreground">
                  Página {page} de {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Próxima
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
