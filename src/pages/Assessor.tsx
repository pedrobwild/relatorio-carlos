import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Bot,
  Send,
  Sparkles,
  Brain,
  AlertCircle,
  Clock,
  History,
  Info,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { ProjectSubNav } from "@/components/layout/ProjectSubNav";
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import {
  useAgentEventsQuery,
  useBwildAgentMutation,
  useProjectStateMemoryQuery,
} from "@/hooks/useBwildAgent";
import type {
  AgentEventSource,
  AgentEventType,
  BwildAgentEvent,
  ProjectState,
  RoutedAgent,
} from "@/infra/repositories/agentMemory.repository";
import type { BwildAgentResponse } from "@/infra/edgeFunctions";

const EVENT_TYPE_LABEL: Record<AgentEventType, string> = {
  new_project: "Novo projeto",
  project_update: "Atualização do projeto",
  schedule_request: "Cronograma",
  budget_request: "Orçamento",
  field_problem: "Problema em campo",
  client_message: "Mensagem ao cliente",
  supplier_quote: "Cotação de fornecedor",
  purchase_decision: "Decisão de compra",
  quality_inspection: "Inspeção de qualidade",
  scope_change: "Mudança de escopo",
  handover: "Entrega / pós-obra",
};

const SOURCE_LABEL: Record<AgentEventSource, string> = {
  cliente: "Cliente",
  equipe: "Equipe",
  fornecedor: "Fornecedor",
  gestor: "Gestor",
  vistoria: "Vistoria",
  documento: "Documento",
};

const ROUTED_AGENT_LABEL: Record<RoutedAgent, string> = {
  master_bwild: "Master BWild",
  schedule_planner: "Planejador",
  cost_engineer: "Eng. de Custos",
  procurement_manager: "Suprimentos",
  field_engineer: "Eng. de Campo",
  root_cause_engineer: "Diagnóstico",
  coordination_engineer: "Compatibilização",
  risk_manager: "Riscos",
  quality_controller: "Qualidade",
  client_communication: "Comunicação",
  supplier_evaluator: "Aval. Fornecedor",
  millwork_agent: "Marcenaria",
  stonework_agent: "Marmoraria",
  delay_recovery: "Recup. de Atraso",
  handover_postwork: "Entrega / Pós-obra",
};

const STATE_SECTION_LABEL: Record<keyof ProjectState, string> = {
  project_context: "Contexto do projeto",
  technical_scope: "Escopo técnico",
  design_status: "Status do projeto/design",
  schedule_state: "Cronograma",
  financial_state: "Financeiro",
  procurement_state: "Suprimentos",
  execution_state: "Execução",
  quality_state: "Qualidade",
  communication_state: "Comunicação",
};

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
        <ProjectSubNav />
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
              <MemoryDrawerContent
                isLoading={memoryQuery.isLoading}
                state={memoryQuery.data?.state ?? null}
                version={memoryQuery.data?.version}
                updatedAt={memoryQuery.data?.updated_at}
              />
            </SheetContent>
          </Sheet>
        </div>
      </PageHeader>
      <ProjectSubNav />

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
                  <ResponsePanel response={lastResponse} />
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
              <EventsList
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

interface ResponsePanelProps {
  response: BwildAgentResponse;
}

function ResponsePanel({ response }: ResponsePanelProps) {
  const r = response.response;
  if (!r) {
    return (
      <p className="text-sm text-muted-foreground">
        O assessor não retornou conteúdo estruturado.
      </p>
    );
  }
  const impactos = r.impactos ?? {};
  const hasImpacts = Object.values(impactos).some((v) => !!v);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">
          {ROUTED_AGENT_LABEL[response.routed_agent]}
        </Badge>
        <span>via {response.routing_reason}</span>
        <span className="ml-auto inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {response.latency_ms} ms
        </span>
      </div>

      {r.diagnostico && (
        <Section title="Diagnóstico">
          <p className="text-sm whitespace-pre-line">{r.diagnostico}</p>
        </Section>
      )}

      {r.recomendacao && (
        <Section title="Recomendação">
          <p className="text-sm whitespace-pre-line">{r.recomendacao}</p>
        </Section>
      )}

      {r.plano_de_acao && r.plano_de_acao.length > 0 && (
        <Section title="Plano de ação">
          <ul className="text-sm list-disc pl-5 space-y-1">
            {r.plano_de_acao.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </Section>
      )}

      {r.decisoes_necessarias && r.decisoes_necessarias.length > 0 && (
        <Section title="Decisões necessárias">
          <ul className="text-sm list-disc pl-5 space-y-1">
            {r.decisoes_necessarias.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </Section>
      )}

      <Accordion type="multiple" className="border-t pt-2">
        {hasImpacts && (
          <AccordionItem value="impactos">
            <AccordionTrigger className="text-sm">Impactos</AccordionTrigger>
            <AccordionContent>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {Object.entries(impactos).map(([key, value]) =>
                  value ? (
                    <div key={key}>
                      <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                        {key}
                      </dt>
                      <dd>{value}</dd>
                    </div>
                  ) : null,
                )}
              </dl>
            </AccordionContent>
          </AccordionItem>
        )}
        {r.riscos && r.riscos.length > 0 && (
          <AccordionItem value="riscos">
            <AccordionTrigger className="text-sm">
              Riscos ({r.riscos.length})
            </AccordionTrigger>
            <AccordionContent>
              <ul className="text-sm list-disc pl-5 space-y-1">
                {r.riscos.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        )}
        {r.premissas && r.premissas.length > 0 && (
          <AccordionItem value="premissas">
            <AccordionTrigger className="text-sm">
              Premissas ({r.premissas.length})
            </AccordionTrigger>
            <AccordionContent>
              <ul className="text-sm list-disc pl-5 space-y-1">
                {r.premissas.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        )}
        {Object.keys(response.state_diff ?? {}).length > 0 && (
          <AccordionItem value="diff">
            <AccordionTrigger className="text-sm">
              Atualização da memória
            </AccordionTrigger>
            <AccordionContent>
              <pre className="text-xs bg-muted/50 rounded p-3 overflow-x-auto">
                {JSON.stringify(response.state_diff, null, 2)}
              </pre>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
        {title}
      </h3>
      {children}
    </div>
  );
}

interface EventsListProps {
  isLoading: boolean;
  events: BwildAgentEvent[];
  highlightedEventId: string | null;
}

function EventsList({
  isLoading,
  events,
  highlightedEventId,
}: EventsListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma consulta registrada para esta obra ainda.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {events.map((event) => (
        <li
          key={event.id}
          className={
            "py-3 " +
            (event.id === highlightedEventId
              ? "bg-primary/5 -mx-2 px-2 rounded"
              : "")
          }
        >
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Badge variant="outline">
              {EVENT_TYPE_LABEL[event.event_type]}
            </Badge>
            {event.routed_agent && (
              <Badge variant="secondary">
                {ROUTED_AGENT_LABEL[event.routed_agent]}
              </Badge>
            )}
            {event.source && (
              <span className="text-xs text-muted-foreground">
                {SOURCE_LABEL[event.source]}
              </span>
            )}
            <span className="ml-auto text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(event.created_at), {
                addSuffix: true,
                locale: ptBR,
              })}
            </span>
          </div>
          <p className="text-sm text-foreground/90 line-clamp-2">
            {event.content}
          </p>
          {event.status !== "success" && (
            <p className="text-xs text-destructive mt-1">
              {event.status}: {event.error_message ?? "Erro desconhecido"}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

interface MemoryDrawerProps {
  isLoading: boolean;
  state: ProjectState | null;
  version?: number;
  updatedAt?: string;
}

function MemoryDrawerContent({
  isLoading,
  state,
  version,
  updatedAt,
}: MemoryDrawerProps) {
  if (isLoading) {
    return (
      <div className="mt-6 space-y-3">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (!state || Object.keys(state).length === 0) {
    return (
      <Alert className="mt-6">
        <Info className="h-4 w-4" />
        <AlertDescription>
          Memória vazia — nenhuma consulta ainda preencheu o estado deste
          projeto.
        </AlertDescription>
      </Alert>
    );
  }

  const sections = (
    Object.keys(STATE_SECTION_LABEL) as Array<keyof ProjectState>
  )
    .map((key) => [key, state[key]] as const)
    .filter(([, value]) => value && Object.keys(value).length > 0);

  return (
    <div className="mt-6 space-y-4">
      <div className="text-xs text-muted-foreground flex items-center gap-3">
        {typeof version === "number" && <span>versão {version}</span>}
        {updatedAt && (
          <span>
            atualizado{" "}
            {formatDistanceToNow(new Date(updatedAt), {
              addSuffix: true,
              locale: ptBR,
            })}
          </span>
        )}
      </div>
      <Accordion
        type="multiple"
        defaultValue={sections.map(([k]) => String(k))}
      >
        {sections.map(([key, value]) => (
          <AccordionItem key={String(key)} value={String(key)}>
            <AccordionTrigger className="text-sm">
              {STATE_SECTION_LABEL[key]}
            </AccordionTrigger>
            <AccordionContent>
              <pre className="text-xs bg-muted/50 rounded p-3 overflow-x-auto">
                {JSON.stringify(value, null, 2)}
              </pre>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

export default Assessor;
