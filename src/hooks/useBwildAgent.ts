/**
 * BWild Assessor — TanStack Query hooks
 *
 * Fala com a Edge Function `bwild-agent` (orquestrador stateful) e com as
 * tabelas `project_state_memory` / `bwild_agent_events` via repositório.
 *
 * Spec autoritativa: docs/BWILD_AI_AGENTS_SPEC.yaml
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  invokeBwildAgent,
  type BwildAgentRequest,
  type BwildAgentResponse,
} from '@/infra/edgeFunctions';
import { agentMemoryRepo } from '@/infra/repositories';
import type {
  BwildAgentEvent,
  ProjectStateMemory,
} from '@/infra/repositories/agentMemory.repository';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from './useAuth';

/**
 * Snapshot atual da memória stateful do projeto.
 * Retorna `null` quando ainda não há memória (projeto sem eventos).
 */
export function useProjectStateMemoryQuery(projectId: string | undefined) {
  const { user } = useAuth();

  return useQuery<ProjectStateMemory | null>({
    queryKey: queryKeys.agent.state(projectId),
    queryFn: async () => {
      if (!projectId) return null;
      const result = await agentMemoryRepo.getProjectState(projectId);
      if (result.error) throw result.error;
      return result.data;
    },
    enabled: !!user && !!projectId,
    staleTime: 30 * 1000,
  });
}

/**
 * Histórico de eventos do agente (últimos N, mais recentes primeiro).
 */
export function useAgentEventsQuery(
  projectId: string | undefined,
  limit = 20,
) {
  const { user } = useAuth();

  return useQuery<BwildAgentEvent[]>({
    queryKey: queryKeys.agent.eventsList(projectId, limit),
    queryFn: async () => {
      if (!projectId) return [];
      const result = await agentMemoryRepo.listAgentEvents(projectId, { limit });
      if (result.error) throw result.error;
      return result.data;
    },
    enabled: !!user && !!projectId,
    staleTime: 15 * 1000,
  });
}

/**
 * Dispara um evento para o orquestrador BWild.
 * Em sucesso, invalida memória e histórico do projeto.
 */
export function useBwildAgentMutation(projectId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<BwildAgentResponse, Error, Omit<BwildAgentRequest, 'project_id'>>({
    mutationFn: async (input) => {
      if (!projectId) {
        throw new Error('projectId obrigatório para chamar o assessor BWild');
      }
      const { data, error } = await invokeBwildAgent({
        project_id: projectId,
        ...input,
      });
      if (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(message);
      }
      if (!data) {
        throw new Error('Resposta vazia do assessor BWild');
      }
      if (data.status !== 'success') {
        throw new Error(data.error ?? `Status do assessor: ${data.status}`);
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agent.state(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.agent.events(projectId) });
    },
    onError: (err) => {
      toast.error(err.message || 'Falha ao consultar o assessor BWild');
    },
  });
}
