/**
 * GestorObraSelect — define o gestor responsável pela obra, onde o time olha.
 *
 * O gestor mora em `projects.painel_responsavel_id`: uma COLUNA, não uma
 * tabela de vínculo. Por construção não existe "segundo responsável" — cada
 * gravação substitui a anterior. É a mesma fonte que alimenta os cards e o
 * filtro "Resp." do Painel de Obras; obra sem gestor não aparece em nenhum
 * filtro por responsável.
 *
 * Até agora o campo só existia nas telas de cadastro (/gestao/obra/:id e o
 * wizard de nova obra), que ninguém abre no dia a dia — por isso quase
 * nenhuma obra tinha gestor. Este componente leva o controle para as telas
 * de uso: o cockpit da obra (/obra/:id), o cabeçalho de todas as páginas da
 * obra e o drawer do Painel de Obras.
 *
 * Só staff vê e edita: para o cliente o componente não renderiza nada.
 */
import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, UserCog } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useStaffUsers } from "@/hooks/useStaffUsers";
import { useUserRole } from "@/hooks/useUserRole";
import { projectsRepo } from "@/infra/repositories";
import { invalidateProjectQueries } from "@/lib/queryKeys";
import { captureError } from "@/lib/errorMonitoring";

/** Radix não aceita `value=""`; sentinela para "sem gestor". */
export const SEM_GESTOR = "__sem_gestor__";

export interface GestorObraSelectProps {
  projectId: string;
  /** Valor atual de `projects.painel_responsavel_id`. */
  gestorId: string | null | undefined;
  /**
   * "card" — bloco destacado, para o topo da página da obra.
   * "chip" — compacto, para cabeçalhos e drawers.
   */
  variant?: "card" | "chip";
  className?: string;
  /** Avisa o pai do novo valor já salvo (para atualizar estado local). */
  onSaved?: (gestorId: string | null) => void;
}

export function GestorObraSelect({
  projectId,
  gestorId,
  variant = "card",
  className,
  onSaved,
}: GestorObraSelectProps) {
  const { isStaff, loading: roleLoading } = useUserRole();
  const { data: staffUsers = [] } = useStaffUsers();
  // Espelha o valor do pai, mas responde na hora ao clique (otimista) e
  // volta atrás se o banco recusar.
  const [value, setValue] = useState<string | null>(gestorId ?? null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(gestorId ?? null);
  }, [gestorId]);

  if (roleLoading || !isStaff) return null;

  const nomeAtual = value
    ? (staffUsers.find((u) => u.id === value)?.nome ?? "Gestor")
    : null;

  const handleChange = async (next: string) => {
    const nextId = next === SEM_GESTOR ? null : next;
    if (nextId === value) return;
    const anterior = value;
    setValue(nextId);
    setSaving(true);
    const result = await projectsRepo.setGestorObra(projectId, nextId);
    setSaving(false);
    if (result.error) {
      setValue(anterior);
      captureError(result.error, {
        feature: "general",
        action: "set_gestor_obra",
        projectId,
      });
      toast.error("Não foi possível salvar o gestor da obra.");
      return;
    }
    // O gestor aparece nos cards e no filtro do Painel de Obras: as listas
    // de projects precisam recarregar para refletir a mudança.
    invalidateProjectQueries();
    onSaved?.(nextId);
    toast.success(
      nextId
        ? `Gestor da obra: ${staffUsers.find((u) => u.id === nextId)?.nome ?? "atualizado"}`
        : "Gestor da obra removido",
    );
  };

  const selectItems = (
    <SelectContent>
      <SelectItem value={SEM_GESTOR}>Sem gestor definido</SelectItem>
      {staffUsers.map((u) => (
        <SelectItem key={u.id} value={u.id}>
          {u.nome}
        </SelectItem>
      ))}
    </SelectContent>
  );

  if (variant === "chip") {
    return (
      <Select
        value={value ?? SEM_GESTOR}
        onValueChange={handleChange}
        disabled={saving}
      >
        <SelectTrigger
          aria-label="Gestor da obra"
          title={
            nomeAtual ? `Gestor da obra: ${nomeAtual}` : "Definir gestor da obra"
          }
          className={cn(
            "h-8 w-auto max-w-[200px] gap-1.5 rounded-full border px-3 text-xs font-medium",
            value
              ? "bg-secondary text-foreground border-border"
              : "bg-warning/10 text-warning border-warning/30",
            className,
          )}
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
          ) : (
            <UserCog className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="truncate">
            {nomeAtual ?? "Definir gestor"}
          </span>
        </SelectTrigger>
        {selectItems}
      </Select>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 shadow-sm",
        !value && "border-warning/40 bg-warning/5",
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-0.5">
          <Label
            htmlFor={`gestor-obra-${projectId}`}
            className="inline-flex items-center gap-2 text-sm font-semibold"
          >
            <UserCog className="h-4 w-4" />
            Gestor da obra
          </Label>
          <p className="text-xs text-muted-foreground">
            Um único responsável por obra. Aparece nos cards e alimenta o
            filtro por responsável no Painel de Obras.
          </p>
        </div>
        <div className="flex items-center gap-2 sm:shrink-0">
          {saving && (
            <Loader2
              className="h-4 w-4 animate-spin text-muted-foreground"
              aria-label="Salvando"
            />
          )}
          <Select
            value={value ?? SEM_GESTOR}
            onValueChange={handleChange}
            disabled={saving}
          >
            <SelectTrigger
              id={`gestor-obra-${projectId}`}
              className="w-full bg-background sm:w-64"
            >
              <SelectValue placeholder="Selecione o gestor" />
            </SelectTrigger>
            {selectItems}
          </Select>
        </div>
      </div>
      {!value && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-warning">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Sem gestor definido, esta obra não aparece em nenhum filtro por
          responsável.
        </p>
      )}
    </div>
  );
}
