import { useState, useMemo } from "react";
import {
  BookOpen,
  MessageSquare,
  Clock,
  Plus,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useStageRecords, type RecordCategory } from "@/hooks/useStageRecords";
import { RecordItem } from "./stage-registry/RecordItem";
import { AddRecordForm } from "./stage-registry/AddRecordForm";

/* ─── Tab config ─── */

const tabConfig: {
  value: RecordCategory;
  label: string;
  Icon: React.ElementType;
}[] = [
  { value: "decision", label: "Decisões", Icon: BookOpen },
  { value: "conversation", label: "Conversas", Icon: MessageSquare },
  { value: "history", label: "Histórico", Icon: Clock },
];

/* ─── Props ─── */

interface StageRegistryProps {
  stageId: string;
  projectId: string;
  isAdmin: boolean;
  minutesOnly?: boolean;
  stageName?: string;
}

/* ─── Main ─── */

export function StageRegistry({
  stageId,
  projectId,
  isAdmin,
  minutesOnly = false,
  stageName,
}: StageRegistryProps) {
  const {
    data: records,
    isLoading,
    isError,
    refetch,
  } = useStageRecords(stageId, projectId);
  const [activeTab, setActiveTab] = useState<RecordCategory>(
    minutesOnly ? "conversation" : "decision",
  );
  const [showForm, setShowForm] = useState(false);

  const filtered = useMemo(
    () => (records || []).filter((r) => r.category === activeTab),
    [records, activeTab],
  );

  const counts = useMemo(() => {
    const map: Record<RecordCategory, number> = {
      decision: 0,
      conversation: 0,
      history: 0,
    };
    for (const r of records || []) map[r.category as RecordCategory]++;
    return map;
  }, [records]);

  return (
    <section className="space-y-3" aria-label="Registro da etapa">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" aria-hidden />
          Registro da etapa
        </h3>
        {isAdmin && !showForm && (
          <Button
            size="sm"
            variant="outline"
            className="h-9 gap-1.5 text-xs min-h-[44px]"
            onClick={() => setShowForm(true)}
            aria-label="Adicionar novo registro"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Novo registro
          </Button>
        )}
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as RecordCategory)}
      >
        {!minutesOnly && (
          <TabsList className="w-full grid grid-cols-3 h-10">
            {tabConfig.map(({ value, label, Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="text-xs gap-1.5 data-[state=active]:shadow-sm min-h-[40px]"
                aria-label={`${label}${counts[value] > 0 ? ` (${counts[value]})` : ""}`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                <span className="hidden sm:inline">{label}</span>
                {counts[value] > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1 h-4 min-w-[16px] px-1 text-[10px]"
                  >
                    {counts[value]}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        )}

        {(minutesOnly
          ? tabConfig.filter((t) => t.value === "conversation")
          : tabConfig
        ).map(({ value }) => (
          <TabsContent
            key={value}
            value={value}
            className={minutesOnly ? "mt-0" : "mt-3"}
          >
            {showForm && activeTab === value && (
              <AddRecordForm
                stageId={stageId}
                projectId={projectId}
                category={value}
                onClose={() => setShowForm(false)}
                minutesOnly={minutesOnly}
                stageName={stageName}
              />
            )}

            {isLoading ? (
              <div
                className="space-y-2"
                aria-busy="true"
                aria-label="Carregando registros"
              >
                <Skeleton className="h-16 w-full rounded-lg" />
                <Skeleton className="h-16 w-full rounded-lg" />
              </div>
            ) : isError ? (
              <div
                className="flex flex-col items-center gap-3 py-6"
                role="alert"
              >
                <AlertCircle
                  className="h-8 w-8 text-destructive/60"
                  aria-hidden
                />
                <p className="text-sm text-muted-foreground">
                  Erro ao carregar registros.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 gap-1.5 min-h-[44px]"
                  onClick={() => refetch()}
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  Tentar novamente
                </Button>
              </div>
            ) : filtered.length === 0 ? (
              <div
                className="flex flex-col items-center gap-2 py-6"
                role="status"
              >
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  {value === "decision" && (
                    <BookOpen
                      className="h-5 w-5 text-muted-foreground"
                      aria-hidden
                    />
                  )}
                  {value === "conversation" && (
                    <MessageSquare
                      className="h-5 w-5 text-muted-foreground"
                      aria-hidden
                    />
                  )}
                  {value === "history" && (
                    <Clock
                      className="h-5 w-5 text-muted-foreground"
                      aria-hidden
                    />
                  )}
                </div>
                <p className="text-sm font-medium text-foreground">
                  {value === "decision" && "Nenhuma decisão registrada"}
                  {value === "conversation" && "Nenhuma conversa registrada"}
                  {value === "history" && "Nenhum registro ainda"}
                </p>
                <p className="text-xs text-muted-foreground max-w-[240px] text-center">
                  {isAdmin
                    ? 'Clique em "Novo registro" para adicionar.'
                    : "Os registros aparecerão aqui conforme o projeto avança."}
                </p>
              </div>
            ) : (
              <ul
                className="space-y-2"
                role="list"
                aria-label={`Lista de ${value === "decision" ? "decisões" : value === "conversation" ? "conversas" : "registros"}`}
              >
                {filtered.map((r) => (
                  <RecordItem
                    key={r.id}
                    record={r}
                    isAdmin={isAdmin}
                    stageId={stageId}
                  />
                ))}
              </ul>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}
