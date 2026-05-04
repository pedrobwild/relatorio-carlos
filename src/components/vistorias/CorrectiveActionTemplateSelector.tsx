import { useState, useMemo } from "react";
import { FileText, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  useActiveCorrectiveActionTemplates,
  type CorrectiveActionTemplate,
} from "@/hooks/useCorrectiveActionTemplates";

interface Props {
  category?: string | null;
  currentText: string;
  onSelect: (text: string) => void;
}

export function CorrectiveActionTemplateSelector({
  category,
  currentText,
  onSelect,
}: Props) {
  const { data: templates = [] } = useActiveCorrectiveActionTemplates();
  const [open, setOpen] = useState(false);
  const [confirmTemplate, setConfirmTemplate] =
    useState<CorrectiveActionTemplate | null>(null);

  const filtered = useMemo(() => {
    if (category) {
      const byCategory = templates.filter((t) => t.category === category);
      if (byCategory.length > 0) return byCategory;
    }
    return templates;
  }, [templates, category]);

  const handleSelect = (template: CorrectiveActionTemplate) => {
    setOpen(false);
    if (currentText.trim()) {
      setConfirmTemplate(template);
    } else {
      onSelect(template.template_text);
    }
  };

  const handleConfirm = () => {
    if (confirmTemplate) {
      onSelect(confirmTemplate.template_text);
      setConfirmTemplate(null);
    }
  };

  if (templates.length === 0) return null;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 h-8 text-xs"
          >
            <FileText className="h-3.5 w-3.5" />
            Usar template
            <ChevronDown className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start" sideOffset={4}>
          <ScrollArea className="max-h-64">
            <div className="p-1">
              {filtered.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors"
                  onClick={() => handleSelect(t)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {t.title}
                    </span>
                    {category && t.category !== category && (
                      <Badge variant="outline" className="text-[9px] shrink-0">
                        {t.category}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {t.template_text.slice(0, 80)}
                    {t.template_text.length > 80 ? "…" : ""}
                  </p>
                </button>
              ))}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      <AlertDialog
        open={!!confirmTemplate}
        onOpenChange={(o) => !o && setConfirmTemplate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Substituir texto atual?</AlertDialogTitle>
            <AlertDialogDescription>
              O texto da ação corretiva será substituído pelo template
              selecionado. Você poderá editar livremente depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              Substituir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
