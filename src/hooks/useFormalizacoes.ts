import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { EVENT_TYPES } from "./useDomainEvents";
import { queryKeys } from "@/lib/queryKeys";
import { QUERY_TIMING } from "@/lib/queryClient";

type FormalizationInsert =
  Database["public"]["Tables"]["formalizations"]["Insert"];
type FormalizationUpdate =
  Database["public"]["Tables"]["formalizations"]["Update"];
type FormalizationWithDetails =
  Database["public"]["Views"]["formalizations_public_customer"]["Row"];

// Helper to log domain events
async function logDomainEvent(params: {
  orgId: string;
  projectId?: string | null;
  entityType: string;
  entityId: string;
  eventType: string;
  payload?: Record<string, unknown>;
}) {
  try {
    await supabase.rpc("log_domain_event", {
      _org_id: params.orgId,
      _project_id: params.projectId || "",
      _entity_type: params.entityType,
      _entity_id: params.entityId,
      _event_type: params.eventType,
      _payload: (params.payload ?? {}) as Json,
      _ip_address: undefined,
      _user_agent:
        typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    });
  } catch (e) {
    console.warn("Failed to log domain event:", e);
  }
}

export function useFormalizacoes(filters?: {
  status?: Database["public"]["Enums"]["formalization_status"];
  type?: Database["public"]["Enums"]["formalization_type"];
  projectId?: string;
}) {
  return useQuery({
    queryKey: queryKeys.formalizacoes.list(filters),
    staleTime: QUERY_TIMING.formalizacoes.staleTime,
    gcTime: QUERY_TIMING.formalizacoes.gcTime,
    queryFn: async () => {
      let query = supabase
        .from("formalizations_public_customer")
        .select("*")
        .order("last_activity_at", { ascending: false });

      if (filters?.status) {
        query = query.eq("status", filters.status);
      }
      if (filters?.type) {
        query = query.eq("type", filters.type);
      }
      if (filters?.projectId) {
        query = query.eq("project_id", filters.projectId);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return (data ?? []) as FormalizationWithDetails[];
    },
  });
}

export function useFormalizacao(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.formalizacoes.detail(id),
    staleTime: QUERY_TIMING.formalizacoes.staleTime,
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from("formalizations_public_customer")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      return (data as FormalizationWithDetails) ?? null;
    },
    enabled: !!id,
  });
}

export function useCreateFormalizacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: FormalizationInsert) => {
      const { data: result, error } = await supabase
        .from("formalizations")
        .insert(data)
        .select()
        .single();

      if (error) throw error;

      // Log domain event for creation
      await logDomainEvent({
        orgId: result.customer_org_id,
        projectId: result.project_id,
        entityType: "formalization",
        entityId: result.id,
        eventType: EVENT_TYPES.FORMALIZATION_CREATED,
        payload: {
          type: result.type,
          title: result.title,
          status: result.status,
        },
      });

      return result;
    },
    onSuccess: (result) => {
      // Scope invalidation to the affected project to avoid refetch storms
      // across unrelated obras open in other tabs.
      queryClient.invalidateQueries({
        queryKey: queryKeys.formalizacoes.list({
          projectId: result.project_id ?? undefined,
        }),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.formalizacoes.lists(),
      });
    },
  });
}

export function useUpdateFormalizacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: FormalizationUpdate;
    }) => {
      // Get current formalization for org_id and change tracking
      const { data: current } = await supabase
        .from("formalizations")
        .select("customer_org_id, project_id, title, summary, status")
        .eq("id", id)
        .maybeSingle();

      const { data: result, error } = await supabase
        .from("formalizations")
        .update(data)
        .eq("id", id)
        .select()
        .maybeSingle();

      if (error) throw error;

      if (!result)
        throw new Error(
          "Formalização não encontrada ou sem permissão de acesso",
        );

      // Log domain event for update
      if (current) {
        const changes: Record<string, { from: unknown; to: unknown }> = {};
        if (data.title && data.title !== current.title) {
          changes.title = { from: current.title, to: data.title };
        }
        if (data.summary && data.summary !== current.summary) {
          changes.summary = { from: current.summary, to: data.summary };
        }
        if (data.status && data.status !== current.status) {
          changes.status = { from: current.status, to: data.status };
        }

        await logDomainEvent({
          orgId: current.customer_org_id,
          projectId: current.project_id,
          entityType: "formalization",
          entityId: id,
          eventType: EVENT_TYPES.FORMALIZATION_UPDATED,
          payload: {
            changes,
            fields_updated: Object.keys(data),
          },
        });
      }

      return result;
    },
    onSuccess: (result, { id }) => {
      // Detail covers the edited record; lists() refreshes any list view
      // without nuking the cache of unrelated projects.
      queryClient.invalidateQueries({
        queryKey: queryKeys.formalizacoes.detail(id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.formalizacoes.list({
          projectId: result?.project_id ?? undefined,
        }),
      });
    },
  });
}

export function useSendForSignature() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Get formalization for org_id
      const { data: formalization } = await supabase
        .from("formalizations")
        .select("customer_org_id, project_id, title")
        .eq("id", id)
        .single();

      // Compute hash to lock the content
      const { data: hash, error: hashError } = await supabase.rpc(
        "compute_formalization_hash",
        { p_formalization_id: id },
      );

      if (hashError) throw hashError;

      // Update status and set locked_hash
      const { data: result, error } = await supabase
        .from("formalizations")
        .update({
          status: "pending_signatures",
          locked_hash: hash,
          locked_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      const userId = (await supabase.auth.getUser()).data.user?.id;

      // Add formalization event
      await supabase.from("formalization_events").insert({
        formalization_id: id,
        event_type: "sent_for_signature",
        actor_user_id: userId,
        meta: { locked_hash: hash },
      });

      // Log domain event
      if (formalization) {
        await logDomainEvent({
          orgId: formalization.customer_org_id,
          projectId: formalization.project_id,
          entityType: "formalization",
          entityId: id,
          eventType: EVENT_TYPES.FORMALIZATION_SENT,
          payload: {
            title: formalization.title,
            locked_hash: hash,
          },
        });
      }

      // Send email notifications to parties
      const portalUrl = window.location.origin;
      try {
        const { error: emailError } = await supabase.functions.invoke(
          "send-signature-request",
          {
            body: { formalizationId: id, portalUrl },
          },
        );
        if (emailError) {
          console.warn("Failed to send signature request emails:", emailError);
        }
      } catch (e) {
        console.warn("Error invoking send-signature-request:", e);
      }

      return result;
    },
    onSuccess: (result, id) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.formalizacoes.detail(id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.formalizacoes.list({
          projectId: result?.project_id ?? undefined,
        }),
      });
    },
  });
}

export function useAddParty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      data: Database["public"]["Tables"]["formalization_parties"]["Insert"],
    ) => {
      const { data: result, error } = await supabase
        .from("formalization_parties")
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.formalizacoes.detail(result.formalization_id),
      });
    },
  });
}

async function getClientIp(): Promise<string> {
  try {
    const { data, error } = await supabase.functions.invoke("get-client-ip");
    if (error) throw error;
    return data?.ip || "unknown";
  } catch (e) {
    console.warn("Could not get client IP:", e);
    return "unknown";
  }
}

export function useAcknowledge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      formalizationId,
      partyId,
      signatureText,
    }: {
      formalizationId: string;
      partyId: string;
      signatureText?: string;
    }) => {
      const user = (await supabase.auth.getUser()).data.user;

      // Get formalization data for domain event
      const { data: formalization } = await supabase
        .from("formalizations")
        .select("customer_org_id, project_id, title, locked_hash")
        .eq("id", formalizationId)
        .single();

      // Get party display name
      const { data: party } = await supabase
        .from("formalization_parties")
        .select("display_name, party_type")
        .eq("id", partyId)
        .single();

      const clientIp = await getClientIp();
      const timestamp = new Date().toISOString();

      // Create signature hash
      const signatureData = [
        formalization?.locked_hash || formalizationId,
        partyId,
        timestamp,
        user?.id || user?.email,
        clientIp,
        navigator.userAgent,
      ].join("|");

      const encoder = new TextEncoder();
      const data = encoder.encode(signatureData);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const signatureHash = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const { data: result, error } = await supabase
        .from("formalization_acknowledgements")
        .insert({
          formalization_id: formalizationId,
          party_id: partyId,
          acknowledged: true,
          acknowledged_at: timestamp,
          acknowledged_by_user_id: user?.id,
          acknowledged_by_email: user?.email,
          signature_text: signatureText,
          signature_hash: signatureHash,
          user_agent: navigator.userAgent,
          ip_address: clientIp,
        })
        .select()
        .single();

      if (error) throw error;

      // Add formalization event
      await supabase.from("formalization_events").insert({
        formalization_id: formalizationId,
        event_type: "signed_by_party",
        actor_user_id: user?.id,
        meta: {
          party_id: partyId,
          signature_hash: signatureHash,
          ip_address: clientIp,
          user_agent: navigator.userAgent,
          email: user?.email,
        },
      });

      // Log domain event
      if (formalization) {
        await logDomainEvent({
          orgId: formalization.customer_org_id,
          projectId: formalization.project_id,
          entityType: "formalization",
          entityId: formalizationId,
          eventType: EVENT_TYPES.FORMALIZATION_SIGNED,
          payload: {
            title: formalization.title,
            party_id: partyId,
            party_name: party?.display_name,
            party_type: party?.party_type,
            signature_hash: signatureHash,
          },
        });
      }

      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.formalizacoes.detail(result.formalization_id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.formalizacoes.lists(),
      });
      // Invalidate pending items so the Pendências tab updates immediately
      queryClient.invalidateQueries({ queryKey: queryKeys.pendingItems.all });
    },
  });
}

export function useDeleteFormalizacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Get formalization for domain event logging
      const { data: formalization } = await supabase
        .from("formalizations")
        .select("customer_org_id, project_id, title")
        .eq("id", id)
        .single();

      // Child records are deleted automatically via ON DELETE CASCADE
      const { error } = await supabase
        .from("formalizations")
        .delete()
        .eq("id", id);

      if (error) throw error;

      // Log domain event
      if (formalization) {
        await logDomainEvent({
          orgId: formalization.customer_org_id,
          projectId: formalization.project_id,
          entityType: "formalization",
          entityId: id,
          eventType: "formalization.deleted",
          payload: {
            title: formalization.title,
          },
        });
      }

      return { id };
    },
    onSuccess: () => {
      // Delete is rare and may affect any list view → use the broad key here.
      queryClient.invalidateQueries({ queryKey: queryKeys.formalizacoes.all });
    },
  });
}
