import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { queryKeys } from "@/lib/queryKeys";
import { inspectionChecklistTemplatesRepo } from "@/infra/repositories/inspectionChecklistTemplates.repository";

/**
 * Seletor de template de checklist salvo. Ao escolher um template,
 * carrega seus itens no checklist da vistoria em edição.
 * Uso staff (dentro do CreateInspectionDialog) — não muda fluxos existentes.
 */
export function SavedTemplatePicker({
  onLoad,
}: {
  onLoad: (items: string[], mode: "replace" | "append") => void;
}) {
  const [selectedId, setSelectedId] = useState<string>("");

  const { data: templates = [], isLoading } = useQuery({
    queryKey: [
      ...queryKeys.qualidade.templates(),
      { includeArchived: false, picker: true },
    ],
    queryFn: async () => {
      const res = await inspectionChecklistTemplatesRepo.list(false);
      if (res.error) throw new Error(res.error.userError.userMessage);
      return res.data;
    },
    staleTime: 60_000,
  });

  const handleLoad = async (mode: "replace" | "append") => {
    if (!selectedId) return;
    const res =
      await inspectionChecklistTemplatesRepo.getWithItems(selectedId);
    if (res.error || !res.data) return;
    onLoad(
      res.data.items.map((it) => it.description),
      mode,
    );
    setSelectedId("");
  };

  if (isLoading || templates.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-dashed p-2 sm:flex-row sm:items-center">
      <Sparkles className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />
      <Select value={selectedId} onValueChange={setSelectedId}>
        <SelectTrigger className="h-10 flex-1">
          <SelectValue placeholder="Usar template salvo..." />
        </SelectTrigger>
        <SelectContent position="popper" sideOffset={4}>
          {templates.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
              {t.category ? ` · ${t.category}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!selectedId}
          onClick={() => handleLoad("append")}
        >
          Adicionar
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!selectedId}
          onClick={() => handleLoad("replace")}
        >
          Substituir
        </Button>
      </div>
    </div>
  );
}
