/**
 * PainelInternalNotesContext — compartilha a observação interna fixada
 * ("status atual") de cada obra com ObraRow / KanbanCard / visão mobile,
 * evitando passar o Map por toda a cadeia Tabela / Board / Kanban.
 *
 * O Map vem de `usePinnedInternalNotes` (uma única query para o painel);
 * para quem não tem `internal_notes:view` ele chega vazio.
 */
import { createContext, useContext } from "react";
import type { ProjectInternalNote } from "@/infra/repositories";

const Ctx = createContext<Map<string, ProjectInternalNote>>(new Map());

export const PainelInternalNotesProvider = Ctx.Provider;
/** Map completo — para listas que iteram obras sem um componente por item. */
export const usePainelPinnedNotes = () => useContext(Ctx);
export const usePainelPinnedNote = (projectId: string) =>
  useContext(Ctx).get(projectId);
