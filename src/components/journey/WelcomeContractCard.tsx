import { useState } from "react";
import { FileText, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const contentVariants = {
  collapsed: { height: 0, opacity: 0, overflow: "hidden" as const },
  expanded: {
    height: "auto",
    opacity: 1,
    overflow: "visible" as const,
    transition: {
      height: {
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
      },
      opacity: { duration: 0.2, delay: 0.1 },
    },
  },
  exit: {
    height: 0,
    opacity: 0,
    overflow: "hidden" as const,
    transition: {
      height: {
        duration: 0.25,
        ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
      },
      opacity: { duration: 0.15 },
    },
  },
};

const bwildCommitments = [
  "Fazer a medição da unidade para compatibilizar medidas e evitar erros.",
  "Entregar o Projeto 3D e o Projeto Executivo da arquitetura/interiores.",
  "🧾 Emitir/assinar ART/RRT e solicitar a liberação da obra para o condomínio da unidade.",
  "Compartilhar cronograma após a aprovação da ART/RRT pelo condomínio.",
  "Tomar decisões técnicas necessárias para viabilizar o projeto/execução, sem mudar o resultado final acordado no 3D aprovado.",
];

const clientCommitments = [
  "Fornecer o Memorial Descritivo e regras do condomínio, além de contatos (síndico/adm/zeladoria).",
  "Garantir acesso para medições e equipe nos horários permitidos.",
  "Aprovar e assinar o Projeto Executivo (ele vira a referência oficial da obra).",
  "Formalizar escolhas diferentes das recomendações (itens/soluções) antes da aprovação do Projeto Executivo, assumindo riscos/limitações quando aplicável.",
  "Providenciar autorizações, chaves e energia para início da obra (sem isso, o início pode ser postergado).",
];

const importantRules = [
  "Depois da assinatura do Projeto Executivo, mudanças que afetem o projeto/obra civil e itens do escopo base não são aceitas (ajustes só quando cabível via aditivo, dentro das regras do contrato).",
  "Se algum item não puder ser executado por restrição do condomínio/limitação do imóvel e isso for identificado antes da assinatura do Projeto Executivo, o valor do item pode ser devolvido integralmente; após a assinatura, não há devolução/abatimento.",
  "Itens do Projeto Executivo são escolhidos com critério técnico; após aprovação, a Bwild não altera itens especificados, exceto por indisponibilidade/variação de mercado (conforme contrato).",
  "©️ Propriedade intelectual: o Projeto (3D, executivo, plantas, materiais técnicos) é da Bwild e o uso pelo cliente é apenas para esta obra contratada (não pode reproduzir, reutilizar em outra unidade, divulgar ou explorar comercialmente).",
];

interface WelcomeContractCardProps {
  onAcknowledge?: () => void;
}

export function WelcomeContractCard({
  onAcknowledge,
}: WelcomeContractCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card
      data-stage-id="welcome-contract"
      className="transition-shadow duration-200 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10"
    >
      <CardHeader
        className="cursor-pointer hover:bg-muted/30 active:bg-muted/50 transition-colors p-4 md:p-6"
        onClick={() => setExpanded(!expanded)}
        role="button"
        aria-expanded={expanded}
        aria-label="Resumo do Contrato"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary shrink-0">
            <FileText className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm text-foreground">
              Resumo do Contrato
            </h3>
            <p className="text-xs text-primary font-medium">
              Etapa de Projeto (3D + Executivo) — o que cada parte faz
            </p>
          </div>
          <motion.div
            animate={{ rotate: expanded ? 90 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </motion.div>
        </div>
      </CardHeader>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="contract-content"
            variants={contentVariants}
            initial="collapsed"
            animate="expanded"
            exit="exit"
          >
            <CardContent className="space-y-5 pt-0 px-4 pb-5 md:px-6 md:pb-6">
              <div className="space-y-2">
                <h2 className="text-base md:text-lg font-bold text-foreground">
                  Direitos e deveres nesta etapa de Projeto
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Esta etapa transforma o que foi combinado em um plano técnico
                  (Projeto 3D e Projeto Executivo) que guia decisões, compras e
                  execução. Aqui fica definido o que pode mudar, o que precisa
                  de aprovação e o que cada parte deve entregar para a obra
                  seguir com segurança.
                </p>
              </div>

              {/* Bwild commitments */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground">
                  A Bwild (Contratada) se compromete a:
                </h4>
                <ul className="space-y-2">
                  {bwildCommitments.map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="text-primary mt-1 shrink-0 text-xs">
                        ●
                      </span>
                      <span className="text-sm text-muted-foreground leading-relaxed">
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Client commitments */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground">
                  Você (Contratante) se compromete a:
                </h4>
                <ul className="space-y-2">
                  {clientCommitments.map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="text-primary mt-1 shrink-0 text-xs">
                        ●
                      </span>
                      <span className="text-sm text-muted-foreground leading-relaxed">
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Important rules */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground">
                  Regras importantes (para evitar retrabalho)
                </h4>
                <ul className="space-y-2">
                  {importantRules.map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="text-amber-500 mt-1 shrink-0 text-xs">
                        ⚠
                      </span>
                      <span className="text-sm text-muted-foreground leading-relaxed">
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <p className="text-xs text-muted-foreground/70 italic">
                Este é um resumo para facilitar sua leitura. Em caso de dúvida,
                vale o texto do contrato.
              </p>

              {onAcknowledge && (
                <Button
                  className="w-full md:w-auto min-h-[44px] gap-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAcknowledge();
                  }}
                >
                  Entendi as regras do Projeto
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
