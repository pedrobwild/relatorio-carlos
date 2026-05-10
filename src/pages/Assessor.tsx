import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Bot,
  Send,
  Sparkles,
  Brain,
  AlertCircle,
  History,
} from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { useCanFeature } from "@/hooks/useCan";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import {
  useAgentEventsQuery,
  useBwildAgentMutation,
  useProjectStateMemoryQuery,
} from "@/hooks/useBwildAgent";
import type {
  AgentEventSource,
  AgentEventType,
  BwildAgentEvent,
} from "@/infra/repositories/agentMemory.repository";

import {
  AssessorEventsList,
  AssessorMemoryView,
  AssessorResponse,
  EVENT_TYPE_LABEL,
  SOURCE_LABEL,
} from "@/components/agent";

const Assessor = () => {
  const { paths } = useProjectNavigation();
  const canUse = useCanFeature("assessor:use");

  if (!canUse) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader
          title="Assessor BWild"
          backTo={paths.relatorio}
          maxWidth="xl"
          breadcrumbs={[
            { label: "Painel de Obras", href: "/gestao/painel-obras" },
            { label: "Obra", href: paths.relatorio },
            { label: "Assessor" },
          ]}
        />
        <main className="py-6">
          <PageContainer maxWidth="xl">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Sem permissão</AlertTitle>
              <AlertDescription>
                Seu perfil não tem acesso ao Assessor BWild.
              </AlertDescription>
            </Alert>
          </PageContainer>
        </main>
      </div>
    );
  }

  return <AssessorContent />;
};

const AssessorContent = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { paths } = useProjectNavigation();

  const [eventType, setEventType] = useState<AgentEventType>("field_problem");
  const [source, setSource] = useState<AgentEventSource | "none">("gestor");
  const [content, setContent] = useState("");

  const memoryQuery = useProjectStateMemoryQuery(projectId);
  const eventsQuery = useAgentEventsQuery(projectId, 20);
  const mutation = useBwildAgentMutation(projectId);

  const lastResponse = mutation.data;
  const lastEvent: BwildAgentEvent | undefined = eventsQuery.data?.[0];

  const trimmed = content.trim();
  const canSubmit = trimmed.length > 0 && !mutation.isPending && !!projectId;

  const submit = () => {
    if (!canSubmit) return;
    mutation.mutate(
      {
        event_type: eventType,
        content: trimmed,
        source: source === "none" ? undefined : source,
      },
      {
        onSuccess: () => setContent(""),
      },
    );
  };

  const memoryFilled = useMemo(() => {
    const state = memoryQuery.data?.state ?? {};
    return Object.entries(state).filter(
      ([, value]) =>
        value && typeof value === "object" && Object.keys(value).length > 0,
    );
  }, [memoryQuery.data]);

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Assessor BWild"
        backTo={paths.relatorio}
        maxWidth="xl"
        breadcrumbs={[
          { label: "Painel de Obras", href: "/gestao/painel-obras" },
          { label: "Obra", href: paths.relatorio },
          { label: "Assessor" },
        ]}
      >
        <div className="flex items-center gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm">
                <Brain className="h-4 w-4 mr-2" />
                Memória
                {memoryFilled.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {memoryFilled.length}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Memória stateful do projeto</SheetTitle>
                <SheetDescription>
                  Snapshot atual usado pelo assessor a cada consulta. Atualizado
                  automaticamente quando o agente identifica novas informações.
                </SheetDescription>
              </SheetHeader>
              <AssessorMemoryView
                isLoading={memoryQuery.isLoading}
                state={memoryQuery.data?.state ?? null}
                version={memoryQuery.data?.version}
                updatedAt={memoryQuery.data?.updated_at}
              />
            </SheetContent>
          </Sheet>
        </div>
      </PageHeader>

      <main className="py-6">
        <PageContainer maxWidth="xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  Consultar o Assessor
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="event_type">Tipo de evento</Label>
                    <Select
                      value={eventType}
                      onValueChange={(v) => setEventType(v as AgentEventType)}
                    >
                      <SelectTrigger id="event_type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(EVENT_TYPE_LABEL).map(
                          ([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="source">Fonte</Label>
                    <Select
                      value={source}
                      onValueChange={(v) =>
                        setSource(v as AgentEventSource | "none")
                      }
                    >
                      <SelectTrigger id="source">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Não informar</SelectItem>
                        {Object.entries(SOURCE_LABEL).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="content">Descreva a situação</Label>
                  <Textarea
                    id="content"
                    placeholder="Ex: A marmoraria atrasou 5 dias e a marcenaria depende da bancada para fechar a cozinha..."
                    rows={8}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    disabled={mutation.isPending}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    O assessor usa a memória do projeto e devolve diagnóstico,
                    plano de ação e decisões necessárias.
                  </p>
                  <Button onClick={submit} disabled={!canSubmit}>
                    <Send className="h-4 w-4 mr-2" />
                    {mutation.isPending ? "Consultando…" : "Consultar"}
                  </Button>
                </div>

                {mutation.isError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Falha na consulta</AlertTitle>
                    <AlertDescription>
                      {mutation.error?.message ?? "Erro desconhecido."}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Última resposta
                </CardTitle>
              </CardHeader>
              <CardContent>
                {mutation.isPending ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                ) : lastResponse ? (
                  <AssessorResponse response={lastResponse} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma consulta ainda. Envie um evento para receber a
                    análise do assessor.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Histórico recente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AssessorEventsList
                isLoading={eventsQuery.isLoading}
                events={eventsQuery.data ?? []}
                highlightedEventId={lastEvent?.id ?? null}
              />
            </CardContent>
          </Card>
        </PageContainer>
      </main>
    </div>
  );
};

export default Assessor;
