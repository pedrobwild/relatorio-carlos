/**
 * AssessorSheet — entrada contextual do BWild Assessor para uso dentro de
 * páginas de módulo (Cronograma, Orçamento, Compras, Vistorias, NCs).
 *
 * Renderiza um botão (ou recebe um trigger via children) que abre um Sheet
 * lateral com formulário pré-configurado para o módulo (event_type fixo
 * mas editável, source padrão, placeholder específico) e exibe a resposta
 * estruturada em sequência. Para o histórico completo, link para a página
 * `/obra/:projectId/assessor`.
 *
 * Permissão `assessor:use` é checada — se o usuário não tem acesso, o
 * componente não renderiza nada (silencioso, sem placeholder vazio).
 */

import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertCircle, Bot, Send, Sparkles, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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

import { useBwildAgentMutation } from "@/hooks/useBwildAgent";
import { useCanFeature } from "@/hooks/useCan";
import type {
  AgentEventSource,
  AgentEventType,
} from "@/infra/repositories/agentMemory.repository";

import { AssessorResponse } from "./AssessorResponse";
import { EVENT_TYPE_LABEL, SOURCE_LABEL } from "./labels";

type ButtonVariant = React.ComponentProps<typeof Button>["variant"];
type ButtonSize = React.ComponentProps<typeof Button>["size"];

export interface AssessorSheetProps {
  /**
   * Override do projectId. Por padrão o componente lê `:projectId` da rota.
   */
  projectId?: string;
  /**
   * Tipo de evento pré-selecionado quando o sheet abre. O usuário ainda
   * pode trocar pelo select dentro do sheet.
   */
  defaultEventType: AgentEventType;
  /**
   * Fonte padrão. Default: "gestor".
   */
  defaultSource?: AgentEventSource;
  /**
   * Placeholder do textarea — deve ser específico do módulo onde o Sheet
   * está sendo usado.
   */
  placeholder?: string;
  /**
   * Texto e visual do botão padrão. Ignorado se `children` for passado.
   */
  triggerLabel?: string;
  triggerVariant?: ButtonVariant;
  triggerSize?: ButtonSize;
  /**
   * Children opcional usado como trigger (recebe `asChild`). Se não
   * passado, renderiza um Button padrão com ícone Bot.
   */
  children?: React.ReactNode;
}

const DEFAULT_PLACEHOLDER =
  "Descreva a situação. O assessor usa a memória stateful do projeto para responder com diagnóstico, plano de ação e decisões necessárias.";

export function AssessorSheet({
  projectId: projectIdProp,
  defaultEventType,
  defaultSource = "gestor",
  placeholder = DEFAULT_PLACEHOLDER,
  triggerLabel = "Consultar Assessor",
  triggerVariant = "outline",
  triggerSize = "sm",
  children,
}: AssessorSheetProps) {
  const params = useParams<{ projectId: string }>();
  const projectId = projectIdProp ?? params.projectId;
  const canUse = useCanFeature("assessor:use");

  const [open, setOpen] = useState(false);

  if (!canUse || !projectId) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {children ? (
        <SheetTrigger asChild>{children}</SheetTrigger>
      ) : (
        <SheetTrigger asChild>
          <Button variant={triggerVariant} size={triggerSize}>
            <Bot className="h-4 w-4 mr-2" />
            {triggerLabel}
          </Button>
        </SheetTrigger>
      )}
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Assessor BWild
          </SheetTitle>
          <SheetDescription>
            Pré-classificado como{" "}
            <strong>{EVENT_TYPE_LABEL[defaultEventType]}</strong>. O assessor
            usa a memória do projeto e devolve análise técnica.
          </SheetDescription>
        </SheetHeader>

        <AssessorSheetBody
          projectId={projectId}
          defaultEventType={defaultEventType}
          defaultSource={defaultSource}
          placeholder={placeholder}
        />
      </SheetContent>
    </Sheet>
  );
}

interface BodyProps {
  projectId: string;
  defaultEventType: AgentEventType;
  defaultSource: AgentEventSource;
  placeholder: string;
}

function AssessorSheetBody({
  projectId,
  defaultEventType,
  defaultSource,
  placeholder,
}: BodyProps) {
  const [eventType, setEventType] = useState<AgentEventType>(defaultEventType);
  const [source, setSource] = useState<AgentEventSource | "none">(
    defaultSource,
  );
  const [content, setContent] = useState("");

  const mutation = useBwildAgentMutation(projectId);
  const lastResponse = mutation.data;

  const trimmed = content.trim();
  const canSubmit = trimmed.length > 0 && !mutation.isPending;

  const submit = () => {
    if (!canSubmit) return;
    mutation.mutate({
      event_type: eventType,
      content: trimmed,
      source: source === "none" ? undefined : source,
    });
  };

  return (
    <div className="mt-6 space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="assessor-sheet-event">Tipo de evento</Label>
          <Select
            value={eventType}
            onValueChange={(v) => setEventType(v as AgentEventType)}
          >
            <SelectTrigger id="assessor-sheet-event">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(EVENT_TYPE_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="assessor-sheet-source">Fonte</Label>
          <Select
            value={source}
            onValueChange={(v) => setSource(v as AgentEventSource | "none")}
          >
            <SelectTrigger id="assessor-sheet-source">
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
        <Label htmlFor="assessor-sheet-content">Descreva a situação</Label>
        <Textarea
          id="assessor-sheet-content"
          placeholder={placeholder}
          rows={6}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={mutation.isPending}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to={`/obra/${projectId}/assessor`}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Histórico e memória
          </Link>
        </Button>
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

      {mutation.isPending && (
        <div className="space-y-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      )}

      {!mutation.isPending && lastResponse && (
        <div className="border-t pt-4">
          <AssessorResponse response={lastResponse} />
        </div>
      )}
    </div>
  );
}
