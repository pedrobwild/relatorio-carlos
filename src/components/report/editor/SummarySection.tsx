import DOMPurify from "dompurify";
import { MessageSquare, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { RichTextEditorModal } from "../RichTextEditorModal";

interface SummarySectionProps {
  weekNumber: number;
  executiveSummary: string;
  richTextOpen: boolean;
  setRichTextOpen: (open: boolean) => void;
  onUpdate: (value: string) => void;
}

const SummarySection = ({
  weekNumber,
  executiveSummary,
  richTextOpen,
  setRichTextOpen,
  onUpdate,
}: SummarySectionProps) => (
  <AccordionItem
    value="summary"
    className="bg-card border border-border rounded-lg overflow-hidden"
  >
    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-primary" />
        <span className="font-semibold">Resumo Executivo</span>
      </div>
    </AccordionTrigger>
    <AccordionContent className="px-4 pb-4 space-y-3">
      <div
        className="min-h-[100px] p-3 bg-muted/30 rounded-md border border-border text-sm leading-[1.7] text-foreground/85 cursor-pointer hover:border-primary/40 transition-colors"
        onClick={() => setRichTextOpen(true)}
        dangerouslySetInnerHTML={{
          __html: DOMPurify.sanitize(
            executiveSummary
              ? /<[a-z][\s\S]*>/i.test(executiveSummary)
                ? executiveSummary
                : executiveSummary
                    .replace(/\n\n/g, "<br><br>")
                    .replace(/\n/g, "<br>")
              : '<span class="text-muted-foreground">Clique para editar o resumo executivo...</span>',
          ),
        }}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => setRichTextOpen(true)}
        className="w-full"
      >
        <Pencil className="w-4 h-4 mr-2" />
        Abrir Editor de Texto
      </Button>
      <RichTextEditorModal
        open={richTextOpen}
        onOpenChange={setRichTextOpen}
        value={executiveSummary}
        onSave={(html) => onUpdate(html)}
        title={`Resumo Executivo - Semana ${weekNumber}`}
      />
    </AccordionContent>
  </AccordionItem>
);

export default SummarySection;
