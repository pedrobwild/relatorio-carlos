/**
 * Renderiza a resposta estruturada do BWild Assessor.
 * Compartilhado pela página `/obra/:projectId/assessor` e pelo
 * AssessorSheet usado nas páginas de módulo.
 */

import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { BwildAgentResponse } from "@/infra/edgeFunctions";
import { ROUTED_AGENT_LABEL } from "./labels";

interface AssessorResponseProps {
  response: BwildAgentResponse;
}

export function AssessorResponse({ response }: AssessorResponseProps) {
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
