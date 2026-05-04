import { WeeklyReportData, DeliverableItem } from "@/types/weeklyReport";
import { CheckCircle2, ChevronDown, FileText } from "lucide-react";
import { useState, useMemo } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import DOMPurify from "dompurify";

interface ExecutiveSummaryProps {
  data: WeeklyReportData;
}

const ExecutiveSummary = ({ data }: ExecutiveSummaryProps) => {
  const [isOpen, setIsOpen] = useState(true);

  const isHtml = /<[a-z][\s\S]*>/i.test(data.executiveSummary);
  const isEmpty =
    !data.executiveSummary || data.executiveSummary.trim().length < 50;

  const sanitizedHtml = useMemo(() => {
    if (isHtml) {
      return DOMPurify.sanitize(data.executiveSummary);
    }
    return "";
  }, [data.executiveSummary, isHtml]);

  // For plain text fallback
  const paragraphs = isHtml ? [] : data.executiveSummary.split("\n\n");
  const firstParagraph = paragraphs[0] || "";
  const remainingParagraphs = paragraphs.slice(1);

  const renderContent = () => {
    if (isEmpty) {
      return (
        <div className="flex items-start gap-3 py-2">
          <FileText className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-muted-foreground leading-[1.6]">
              Seu relatório está sendo finalizado pela equipe. Detalhes técnicos
              disponíveis abaixo ⬇️
            </p>
          </div>
        </div>
      );
    }

    if (isHtml) {
      return (
        <div
          className="text-sm text-foreground/85 leading-[1.7] prose prose-sm max-w-none [&_p]:mb-3 [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:mb-1 [&_*]:!font-[inherit] [&_span]:!text-inherit"
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />
      );
    }
    return (
      <div className="text-sm text-foreground/85 leading-[1.7] space-y-3">
        {paragraphs.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="px-4 py-2.5 bg-primary-dark">
          <h3 className="text-base font-semibold text-white tracking-tight">
            Resumo Executivo
          </h3>
        </div>

        {/* Desktop: Always show full content */}
        <div className="hidden sm:block px-5 py-4 sm:px-6 sm:py-5">
          {renderContent()}
        </div>

        {/* Mobile: Collapsible content */}
        <div className="sm:hidden">
          {isEmpty ? (
            <div className="px-4 py-3">{renderContent()}</div>
          ) : isHtml ? (
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
              <div className="px-4 py-3">
                <CollapsibleContent className="overflow-hidden" forceMount>
                  {renderContent()}
                </CollapsibleContent>
              </div>
              <CollapsibleTrigger asChild>
                <button className="w-full py-2.5 px-4 border-t border-border flex items-center justify-center gap-1.5 text-xs font-medium text-primary hover:bg-primary/5 transition-colors">
                  <span>{isOpen ? "Ver menos" : "Continuar lendo"}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
              </CollapsibleTrigger>
            </Collapsible>
          ) : (
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
              <div className="px-4 py-3">
                <p className="text-sm leading-[1.65] text-foreground/85">
                  {firstParagraph}
                </p>
                <CollapsibleContent className="overflow-hidden">
                  <div className="space-y-3 mt-3">
                    {remainingParagraphs.map((paragraph, index) => (
                      <p
                        key={index}
                        className="text-sm leading-[1.65] text-foreground/85"
                      >
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </CollapsibleContent>
              </div>
              {remainingParagraphs.length > 0 && (
                <CollapsibleTrigger asChild>
                  <button className="w-full py-2.5 px-4 border-t border-border flex items-center justify-center gap-1.5 text-xs font-medium text-primary hover:bg-primary/5 transition-colors">
                    <span>{isOpen ? "Ver menos" : "Continuar lendo"}</span>
                    {!isOpen && (
                      <span className="bg-primary/10 px-1.5 py-0.5 rounded-md text-xs font-semibold">
                        +{remainingParagraphs.length}
                      </span>
                    )}
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                </CollapsibleTrigger>
              )}
            </Collapsible>
          )}
        </div>
      </div>

      {/* Deliverables Completed This Week */}
      {data.deliverablesCompleted.length > 0 && (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="px-4 py-2.5 bg-primary-dark">
            <h3 className="text-base font-semibold text-white tracking-tight">
              Entregáveis concluídos na semana
            </h3>
          </div>
          <div className="px-5 py-4 sm:px-6 sm:py-5">
            <ul className="space-y-3">
              {data.deliverablesCompleted.map((item) => (
                <li key={item.id} className="space-y-1.5">
                  <div className="flex items-start gap-2 text-sm text-foreground font-medium">
                    <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                    <span className="leading-[1.6]">{item.description}</span>
                  </div>
                  {item.subItems && item.subItems.length > 0 && (
                    <ul className="ml-6 space-y-1 border-l-2 border-border pl-3">
                      {item.subItems.map((subItem) => (
                        <li
                          key={subItem.id}
                          className="text-sm text-foreground/75 leading-[1.6]"
                        >
                          {subItem.description}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExecutiveSummary;
