import { useState } from "react";
import { Compass, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { JourneyHero } from "@/hooks/useProjectJourney";

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

const portalBullets = [
  {
    icon: "📍",
    text: "Clareza do andamento: veja a etapa atual, o que já foi feito e o que vem a seguir.",
  },
  {
    icon: "✅",
    text: "Decisões mais rápidas: aprove documentos e resolva pendências direto por aqui.",
  },
  {
    icon: "🗓️",
    text: "Mais previsibilidade: acompanhe datas, reuniões e marcos importantes em um só lugar.",
  },
  {
    icon: "🔒",
    text: "Mais segurança: decisões e arquivos ficam registrados, reduzindo dúvidas e ruídos.",
  },
  {
    icon: "💬",
    text: "Contato fácil com o time: saiba quem é responsável por cada frente e como falar.",
  },
];

const portalAreas = [
  { bold: "Jornada", text: "status da obra e próximos passos" },
  { bold: "Documentos", text: "arquivos do projeto e histórico" },
  { bold: "Formalizações", text: "aprovações e assinaturas" },
  { bold: "Financeiro", text: "valores, boletos e registros" },
  { bold: "Pendências", text: "tudo que precisa da sua ação" },
];

interface WelcomeGuideCardProps {
  hero: JourneyHero;
  onScrollToTeam: () => void;
}

export function WelcomeGuideCard({
  hero,
  onScrollToTeam,
}: WelcomeGuideCardProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <Card
      data-stage-id="welcome-guide"
      className="transition-shadow duration-200 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10"
    >
      <CardHeader
        className="cursor-pointer hover:bg-muted/30 active:bg-muted/50 transition-colors p-4 md:p-6"
        onClick={() => setExpanded(!expanded)}
        role="button"
        aria-expanded={expanded}
        aria-label="Guia de Uso"
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
            <Compass className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm text-foreground">
              Guia de Uso
            </h3>
            <p className="text-xs text-primary font-medium">
              Entenda como acompanhar seu projeto e aproveitar o portal
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
            key="guide-content"
            variants={contentVariants}
            initial="collapsed"
            animate="expanded"
            exit="exit"
          >
            <CardContent className="space-y-5 pt-0 px-4 pb-5 md:px-6 md:pb-6">
              <div className="space-y-2">
                <h2 className="text-base md:text-lg font-bold text-foreground">
                  Sua jornada com a Bwild, em um só lugar.
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Aqui você acompanha cada etapa do seu projeto com
                  transparência e previsibilidade. O portal reúne prazos,
                  documentos, aprovações e comunicação com o time — para você
                  tomar decisões com segurança e evitar retrabalho.
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground">
                  Como este portal te ajuda
                </h4>
                <ul className="space-y-2.5">
                  {portalBullets.map((bullet, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="text-base leading-none mt-0.5 shrink-0">
                        {bullet.icon}
                      </span>
                      <span className="text-sm text-muted-foreground leading-relaxed">
                        {bullet.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground">
                  Principais áreas do portal
                </h4>
                <ul className="space-y-1.5">
                  {portalAreas.map((area, i) => (
                    <li
                      key={i}
                      className="text-sm text-muted-foreground leading-relaxed"
                    >
                      <span className="font-medium text-foreground">
                        {area.bold}:
                      </span>{" "}
                      {area.text}
                    </li>
                  ))}
                </ul>
              </div>

              <Button
                className="w-full md:w-auto min-h-[44px] gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onScrollToTeam();
                }}
              >
                Avançar
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
