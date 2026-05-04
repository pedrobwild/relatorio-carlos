import { FileText, CheckCircle2, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface EditorHeaderProps {
  weekNumber: number;
  periodStart: string;
  periodEnd: string;
  isSaving: boolean;
  lastSaved: Date | null;
  onSave: () => void;
  onCancel?: () => void;
}

const EditorHeader = ({
  weekNumber,
  periodStart,
  periodEnd,
  isSaving,
  lastSaved,
  onSave,
  onCancel,
}: EditorHeaderProps) => (
  <div className="bg-primary-dark text-white rounded-lg p-4">
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <FileText className="w-6 h-6 shrink-0" />
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-bold truncate">
            Editar Relatório - Semana {weekNumber}
          </h2>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/80">
            <span className="truncate">
              Período: {periodStart} a {periodEnd}
            </span>
            {isSaving ? (
              <span className="flex items-center gap-1.5 text-white/70">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Salvando...
              </span>
            ) : (
              lastSaved && (
                <span className="flex items-center gap-1.5 text-green-300">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Salvo às {format(lastSaved, "HH:mm", { locale: ptBR })}
                </span>
              )
            )}
          </div>
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        {onCancel && (
          <Button
            variant="outline"
            onClick={onCancel}
            className="bg-white/10 border-white/20 text-white hover:bg-white/20 min-h-[44px]"
          >
            Cancelar
          </Button>
        )}
        <Button
          onClick={onSave}
          disabled={isSaving}
          className="bg-white text-primary hover:bg-white/90 min-h-[44px]"
        >
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  </div>
);

export default EditorHeader;
