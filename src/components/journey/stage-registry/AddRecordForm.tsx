import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Users, MessageSquare, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateStageRecord,
  type RecordCategory,
} from "@/hooks/useStageRecords";
import { useAuth } from "@/hooks/useAuth";

interface AddRecordFormProps {
  stageId: string;
  projectId: string;
  category: RecordCategory;
  onClose: () => void;
  minutesOnly?: boolean;
  stageName?: string;
}

const categoryLabels: Record<RecordCategory, string> = {
  decision: "decisão",
  conversation: "conversa",
  history: "registro",
};

export function AddRecordForm({
  stageId,
  projectId,
  category,
  onClose,
  minutesOnly,
  stageName: _stageName,
}: AddRecordFormProps) {
  const { user } = useAuth();
  const create = useCreateStageRecord();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [responsible, setResponsible] = useState<"client" | "bwild">("bwild");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [isMinutesMode, setIsMinutesMode] = useState(minutesOnly ?? false);

  // Meeting minutes state
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingTime, setMeetingTime] = useState("");
  const [participants, setParticipants] = useState<
    { name: string; role: string }[]
  >([{ name: "", role: "" }]);
  const [mainTopics, setMainTopics] = useState("");

  const handleSubmit = () => {
    if (!title.trim() || !user) return;
    create.mutate(
      {
        stage_id: stageId,
        project_id: projectId,
        category,
        title: title.trim(),
        description: description.trim() || undefined,
        responsible,
        evidence_url: evidenceUrl.trim() || undefined,
        created_by: user.id,
      },
      { onSuccess: () => onClose() },
    );
  };

  const handleMinutesSubmit = () => {
    if (!meetingDate || !mainTopics.trim() || !user) return;

    const dateFormatted = format(parseISO(meetingDate), "dd MMM yyyy", {
      locale: ptBR,
    });
    const participantsList = participants
      .filter((p) => p.name.trim())
      .map(
        (p) => `${p.name.trim()}${p.role.trim() ? ` (${p.role.trim()})` : ""}`,
      )
      .join(", ");

    const generatedTitle = `Ata de Reunião — ${dateFormatted}${meetingTime ? ` às ${meetingTime}` : ""}`;
    const generatedDescription = [
      participantsList ? `Participantes: ${participantsList}` : "",
      mainTopics.trim(),
    ]
      .filter(Boolean)
      .join("\n\n");

    create.mutate(
      {
        stage_id: stageId,
        project_id: projectId,
        category: "conversation",
        title: generatedTitle,
        description: generatedDescription,
        responsible: "bwild",
        evidence_url: evidenceUrl.trim() || undefined,
        created_by: user.id,
        record_date: meetingDate,
      },
      { onSuccess: () => onClose() },
    );
  };

  const addParticipant = () =>
    setParticipants((prev) => [...prev, { name: "", role: "" }]);
  const removeParticipant = (i: number) =>
    setParticipants((prev) => prev.filter((_, idx) => idx !== i));
  const updateParticipant = (
    i: number,
    field: "name" | "role",
    value: string,
  ) =>
    setParticipants((prev) =>
      prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)),
    );

  // Show minutes mode toggle for conversation category
  if (category === "conversation" && !isMinutesMode && !minutesOnly) {
    return (
      <div className="mb-3 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setIsMinutesMode(true)}
            className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/[0.02] p-4 text-left transition-colors hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary min-h-[44px]"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                Ata de reunião
              </p>
              <p className="text-xs text-muted-foreground">
                Registre participantes e tópicos
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => {
              setTitle("");
              setDescription("");
            }}
            className="flex items-center gap-3 rounded-lg border border-border/60 bg-card p-4 text-left transition-colors hover:bg-muted/20 focus-visible:outline-2 focus-visible:outline-primary min-h-[44px]"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                Registro simples
              </p>
              <p className="text-xs text-muted-foreground">
                Título e descrição livre
              </p>
            </div>
          </button>
        </div>
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="h-9 min-h-[44px]"
          >
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  // Meeting minutes form
  if (isMinutesMode) {
    return (
      <div
        className="mb-3 space-y-3 rounded-lg border border-primary/20 bg-primary/[0.02] p-3"
        role="form"
        aria-label="Nova ata de reunião"
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-primary flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" aria-hidden />
            Ata de reunião
          </p>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => setIsMinutesMode(false)}
            aria-label="Voltar"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor={`min-date-${stageId}`}
              className="text-[11px] text-muted-foreground mb-1 block"
            >
              Data da reunião
            </label>
            <Input
              id={`min-date-${stageId}`}
              type="date"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              className="h-10 text-sm"
              autoFocus
            />
          </div>
          <div>
            <label
              htmlFor={`min-time-${stageId}`}
              className="text-[11px] text-muted-foreground mb-1 block"
            >
              Horário (opcional)
            </label>
            <Input
              id={`min-time-${stageId}`}
              type="time"
              value={meetingTime}
              onChange={(e) => setMeetingTime(e.target.value)}
              className="h-10 text-sm"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-muted-foreground">
              Participantes
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 text-[11px] px-2 gap-1"
              onClick={addParticipant}
            >
              <Plus className="h-3 w-3" /> Adicionar
            </Button>
          </div>
          <div className="space-y-2">
            {participants.map((p, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input
                  placeholder="Nome"
                  value={p.name}
                  onChange={(e) => updateParticipant(i, "name", e.target.value)}
                  className="h-9 text-sm flex-1"
                />
                <Input
                  placeholder="Cargo (opcional)"
                  value={p.role}
                  onChange={(e) => updateParticipant(i, "role", e.target.value)}
                  className="h-9 text-sm flex-1"
                />
                {participants.length > 1 && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeParticipant(i)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <label
            htmlFor={`min-topics-${stageId}`}
            className="text-[11px] text-muted-foreground mb-1 block"
          >
            Tópicos discutidos
          </label>
          <Textarea
            id={`min-topics-${stageId}`}
            placeholder="Descreva os principais pontos abordados na reunião..."
            value={mainTopics}
            onChange={(e) => setMainTopics(e.target.value)}
            rows={4}
            className="text-sm"
          />
        </div>

        <div>
          <label
            htmlFor={`min-evidence-${stageId}`}
            className="text-[11px] text-muted-foreground mb-1 block"
          >
            Link da gravação (opcional)
          </label>
          <Input
            id={`min-evidence-${stageId}`}
            placeholder="https://..."
            value={evidenceUrl}
            onChange={(e) => setEvidenceUrl(e.target.value)}
            className="h-10 text-sm"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="h-9 min-h-[44px]"
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleMinutesSubmit}
            disabled={!meetingDate || !mainTopics.trim() || create.isPending}
            className="h-9 min-h-[44px]"
          >
            {create.isPending && (
              <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5" />
            )}
            Salvar ata
          </Button>
        </div>
      </div>
    );
  }

  // Simple record form
  return (
    <div
      className="mb-3 space-y-3 rounded-lg border border-primary/20 bg-primary/[0.02] p-3"
      role="form"
      aria-label={`Nova ${categoryLabels[category]}`}
    >
      <p className="text-xs font-medium text-primary">
        Nova {categoryLabels[category]}
      </p>
      <div>
        <label htmlFor={`rec-title-${stageId}`} className="sr-only">
          Título
        </label>
        <Input
          id={`rec-title-${stageId}`}
          placeholder="Título"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-10 text-sm"
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />
      </div>
      <div>
        <label htmlFor={`rec-desc-${stageId}`} className="sr-only">
          Descrição
        </label>
        <Textarea
          id={`rec-desc-${stageId}`}
          placeholder="Descrição curta (opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="text-sm"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label
            htmlFor={`rec-resp-${stageId}`}
            className="text-[11px] text-muted-foreground mb-1 block"
          >
            Responsável
          </label>
          <Select
            value={responsible}
            onValueChange={(v) => setResponsible(v as "client" | "bwild")}
          >
            <SelectTrigger className="h-10 text-sm" id={`rec-resp-${stageId}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="client">Cliente</SelectItem>
              <SelectItem value="bwild">Bwild</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label
            htmlFor={`rec-evidence-${stageId}`}
            className="text-[11px] text-muted-foreground mb-1 block"
          >
            Link evidência
          </label>
          <Input
            id={`rec-evidence-${stageId}`}
            placeholder="https://..."
            value={evidenceUrl}
            onChange={(e) => setEvidenceUrl(e.target.value)}
            className="h-10 text-sm"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={onClose}
          className="h-9 min-h-[44px]"
        >
          Cancelar
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!title.trim() || create.isPending}
          className="h-9 min-h-[44px]"
        >
          {create.isPending ? (
            <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5" />
          ) : null}
          Salvar
        </Button>
      </div>
    </div>
  );
}
