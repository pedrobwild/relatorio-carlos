/**
 * /gestao/auditoria-semanais — Auditoria de salvamentos dos relatórios semanais
 * (staff-only).
 *
 * Objetivo: diagnosticar "apagões" (relatório que aparece zerado) em segundos.
 * Cada salvamento gera uma versão; aqui listamos quem salvou, quando, de qual
 * obra/semana e o que foi enviado (fotos, texto, atividades), com inspeção do
 * payload completo.
 *
 * Leitura via RPCs SECURITY DEFINER com guard `is_staff`. Nunca referenciar
 * em superfícies do cliente.
 */
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  Camera,
  FileSearch,
  ListChecks,
  RefreshCw,
  Type,
} from "lucide-react";

import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader, EmptyState } from "@/components/ui-premium";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useProjectsQuery } from "@/hooks/useProjectsQuery";
import {
  useWeeklyReportAudit,
  useWeeklyReportAuditPayload,
} from "@/hooks/useWeeklyReportAudit";
import type { WeeklyReportAuditEntry } from "@/infra/repositories/weeklyReportAudit.repository";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

function formatDateTime(iso: string): string {
  try {
    return format(parseISO(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return iso;
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function authorLabel(entry: WeeklyReportAuditEntry): string {
  return (
    entry.author_name?.trim() ||
    entry.author_email?.trim() ||
    "Autor não identificado"
  );
}

/** Painel lateral com o conteúdo completo do salvamento. */
function PayloadSheet({
  entry,
  onOpenChange,
}: {
  entry: WeeklyReportAuditEntry | null;
  onOpenChange: (open: boolean) => void;
}) {
  const payloadQuery = useWeeklyReportAuditPayload(entry?.version_id);
  const payload = payloadQuery.data;

  return (
    <Sheet open={!!entry} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-xl"
      >
        {entry && (
          <>
            <SheetHeader className="text-left">
              <SheetTitle>
                {entry.project_name} · semana {entry.week_number}
              </SheetTitle>
              <SheetDescription>
                Versão {entry.version} salva por {authorLabel(entry)} em{" "}
                {formatDateTime(entry.created_at)}.
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Fotos", value: entry.gallery_count },
                  { label: "Atividades", value: entry.activities_count },
                  { label: "Riscos", value: entry.risks_count },
                  {
                    label: "Tamanho",
                    value: formatBytes(entry.payload_bytes),
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-md border border-border bg-muted/40 p-3"
                  >
                    <p className="text-xs text-muted-foreground">
                      {item.label}
                    </p>
                    <p className="text-lg font-semibold">{item.value}</p>
                  </div>
                ))}
              </div>

              {entry.restored_from_version !== null && (
                <p className="rounded-md border border-border bg-muted/40 p-3 text-sm">
                  Este salvamento foi uma restauração da versão{" "}
                  {entry.restored_from_version}.
                </p>
              )}

              {payloadQuery.isLoading && (
                <div className="space-y-2" aria-live="polite">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-24 w-full" />
                </div>
              )}

              {payloadQuery.error && (
                <p className="text-sm text-destructive">
                  Não foi possível carregar o conteúdo deste salvamento.
                  Atualize a página e tente de novo.
                </p>
              )}

              {payload && (
                <>
                  <section>
                    <h3 className="mb-2 text-sm font-semibold">
                      Resumo executivo enviado
                    </h3>
                    <p className="whitespace-pre-line rounded-md border border-border bg-muted/40 p-3 text-sm">
                      {payload.executiveSummary?.trim() ||
                        "Nenhum texto foi enviado neste salvamento."}
                    </p>
                  </section>

                  <section>
                    <h3 className="mb-2 text-sm font-semibold">
                      Fotos enviadas ({payload.gallery?.length ?? 0})
                    </h3>
                    {payload.gallery?.length ? (
                      <ul className="space-y-2">
                        {payload.gallery.map((photo) => (
                          <li
                            key={photo.id}
                            className="rounded-md border border-border p-2 text-sm"
                          >
                            <p className="font-medium">
                              {photo.caption?.trim() || "Sem legenda"}
                            </p>
                            <p className="break-all text-xs text-muted-foreground">
                              {photo.path || photo.url}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Nenhuma foto foi enviada neste salvamento.
                      </p>
                    )}
                  </section>

                  <section>
                    <h3 className="mb-2 text-sm font-semibold">
                      Conteúdo técnico completo
                    </h3>
                    <pre className="max-h-80 overflow-auto rounded-md border border-border bg-muted/40 p-3 text-xs">
                      {JSON.stringify(payload, null, 2)}
                    </pre>
                  </section>
                </>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function AuditoriaSemanais() {
  const [searchParams, setSearchParams] = useSearchParams();
  const projectsQ = useProjectsQuery({ status: "active" });
  const projects = projectsQ.data ?? [];

  const projectId = searchParams.get("projectId") ?? undefined;
  const search = searchParams.get("q") ?? "";
  const onlyEmpty = searchParams.get("vazios") === "1";
  const page = Number(searchParams.get("page") ?? "1");

  const [selected, setSelected] = useState<WeeklyReportAuditEntry | null>(null);

  const filters = useMemo(
    () => ({
      projectId,
      search: search || undefined,
      onlyEmpty,
      limit: PAGE_SIZE,
      offset: (Math.max(page, 1) - 1) * PAGE_SIZE,
    }),
    [projectId, search, onlyEmpty, page],
  );

  const { entries, total, isLoading, isFetching, error, refetch } =
    useWeeklyReportAudit(filters);

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    if (key !== "page") next.delete("page");
    setSearchParams(next, { replace: true });
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Uso interno"
        title="Auditoria de relatórios semanais"
        description="Todo salvamento fica registrado aqui: quem salvou, quando e o que foi enviado. Use para descobrir rapidamente quando um relatório ficou vazio e quem fez o último envio com conteúdo."
        actions={
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw
              className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")}
            />
            Atualizar
          </Button>
        }
      />

      <Card className="mt-4">
        <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="audit-obra">Obra</Label>
            <Select
              value={projectId ?? "todas"}
              onValueChange={(value) =>
                updateParam("projectId", value === "todas" ? null : value)
              }
            >
              <SelectTrigger id="audit-obra">
                <SelectValue placeholder="Todas as obras" />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="todas">Todas as obras</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 space-y-1.5">
            <Label htmlFor="audit-busca">Buscar por obra ou pessoa</Label>
            <Input
              id="audit-busca"
              value={search}
              placeholder="Ex.: Camila, Perdizes, camila@..."
              onChange={(event) => updateParam("q", event.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 pb-1">
            <Switch
              id="audit-vazios"
              checked={onlyEmpty}
              onCheckedChange={(checked) =>
                updateParam("vazios", checked ? "1" : null)
              }
            />
            <Label htmlFor="audit-vazios" className="cursor-pointer">
              Mostrar só salvamentos vazios
            </Label>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          className="mt-6"
          icon={AlertTriangle}
          title="Não foi possível carregar a auditoria"
          description="Atualize a página. Se continuar, avise o time de tecnologia."
        />
      ) : entries.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={FileSearch}
          title="Nenhum salvamento encontrado"
          description="Ajuste os filtros acima ou limpe a busca para ver todos os salvamentos recentes."
        />
      ) : (
        <>
          {/* Desktop */}
          <Card className="mt-4 hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Obra / semana</TableHead>
                  <TableHead>Quem salvou</TableHead>
                  <TableHead className="text-right">Fotos</TableHead>
                  <TableHead className="text-right">Texto</TableHead>
                  <TableHead className="text-right">Atividades</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Conteúdo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow
                    key={entry.version_id}
                    className={cn(entry.is_empty && "bg-destructive/5")}
                  >
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDateTime(entry.created_at)}
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="font-medium">{entry.project_name}</span>
                      <span className="block text-xs text-muted-foreground">
                        Semana {entry.week_number} · versão {entry.version}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {authorLabel(entry)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {entry.gallery_count}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {entry.summary_chars} car.
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {entry.activities_count}
                    </TableCell>
                    <TableCell>
                      {entry.is_empty ? (
                        <Badge variant="destructive">Salvou vazio</Badge>
                      ) : entry.restored_from_version !== null ? (
                        <Badge variant="secondary">
                          Restaurou v{entry.restored_from_version}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Com conteúdo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelected(entry)}
                      >
                        Ver o que foi enviado
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile */}
          <div className="mt-4 space-y-3 md:hidden">
            {entries.map((entry) => (
              <Card
                key={entry.version_id}
                className={cn(entry.is_empty && "border-destructive/40")}
              >
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{entry.project_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Semana {entry.week_number} · versão {entry.version}
                      </p>
                    </div>
                    {entry.is_empty ? (
                      <Badge variant="destructive">Salvou vazio</Badge>
                    ) : (
                      <Badge variant="outline">Com conteúdo</Badge>
                    )}
                  </div>
                  <p className="text-sm">
                    {authorLabel(entry)}
                    <span className="block text-xs text-muted-foreground">
                      {formatDateTime(entry.created_at)}
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                      {entry.gallery_count} fotos
                    </span>
                    <span className="flex items-center gap-1">
                      <Type className="h-3.5 w-3.5" aria-hidden="true" />
                      {entry.summary_chars} caracteres
                    </span>
                    <span className="flex items-center gap-1">
                      <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
                      {entry.activities_count} atividades
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    className="min-h-11 w-full"
                    onClick={() => setSelected(entry)}
                  >
                    Ver o que foi enviado
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {total} salvamento{total === 1 ? "" : "s"} · página {page} de{" "}
              {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => updateParam("page", String(page - 1))}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => updateParam("page", String(page + 1))}
              >
                Próxima
              </Button>
            </div>
          </div>
        </>
      )}

      <PayloadSheet
        entry={selected}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </PageContainer>
  );
}
