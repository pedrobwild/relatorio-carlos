import { useState } from "react";
import { Info, Pencil, ChevronDown } from "lucide-react";
import DOMPurify from "dompurify";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface InstructionsCollapsibleProps {
  hasInstructions: boolean;
  displayHtml: string;
  isStaff: boolean;
  onEditClick: () => void;
}

export function InstructionsCollapsible({
  hasInstructions,
  displayHtml,
  isStaff,
  onEditClick,
}: InstructionsCollapsibleProps) {
  const [open, setOpen] = useState(true);

  return (
    <Card className="rounded-xl shadow-sm">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center gap-3 pt-6 px-6 pb-3 text-left">
            <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Info className="h-4 w-4 text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-foreground flex-1">
              Instruções
            </h3>
            {isStaff && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditClick();
                }}
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            )}
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pl-[4.25rem] pr-6 pb-6">
            {hasInstructions ? (
              <div
                className="prose prose-sm max-w-none text-muted-foreground [&_p]:mb-2 [&_p]:leading-relaxed [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:mb-1 [&_li]:leading-relaxed [&_*]:!text-sm [&_strong]:text-foreground"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(displayHtml),
                }}
              />
            ) : (
              <button
                onClick={onEditClick}
                className="w-full py-6 text-sm text-muted-foreground hover:text-foreground border-2 border-dashed border-border rounded-lg transition-colors hover:border-primary/30"
              >
                Clique para adicionar instruções
              </button>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
