/**
 * Formalizations Repository
 * 
 * Centralized data access for formalizations, parties, evidence, and events.
 */

import {
  supabase,
  executeQuery,
  executeListQuery,
  type RepositoryResult,
  type RepositoryListResult,
} from './base.repository';
import type { Json } from '@/integrations/supabase/types';

// ============================================================================
// Types
// ============================================================================

export interface CreateFormalizationInput {
  customer_org_id: string;
  created_by: string;
  type: string;
  status?: string;
  title: string;
  summary: string;
  body_md: string;
  data?: Json;
  project_id?: string;
}

export interface CreatePartyInput {
  formalization_id: string;
  display_name: string;
  email?: string | null;
  party_type: string;
  role_label?: string | null;
  must_sign?: boolean;
  user_id?: string | null;
}

export interface CreateEvidenceLinkInput {
  formalization_id: string;
  kind: string;
  url: string;
  description?: string | null;
  created_by: string;
}

// ============================================================================
// Repository Functions
// ============================================================================

/**
 * Create a formalization
 */
export async function createFormalization(
  input: CreateFormalizationInput
): Promise<RepositoryResult<{ id: string }>> {
  return executeQuery(async () => {
    const { data, error } = await supabase
      .from('formalizations')
      .insert({
        customer_org_id: input.customer_org_id,
        created_by: input.created_by,
        type: input.type as any,
        status: (input.status ?? 'draft') as any,
        title: input.title,
        summary: input.summary,
        body_md: input.body_md,
        data: input.data ?? {},
        project_id: input.project_id ?? null,
      })
      .select('id')
      .single();
    return { data, error };
  });
}

/**
 * Add a party to a formalization
 */
export async function addParty(
  input: CreatePartyInput
): Promise<RepositoryResult<{ id: string }>> {
  return executeQuery(async () => {
    const { data, error } = await supabase
      .from('formalization_parties')
      .insert({
        formalization_id: input.formalization_id,
        display_name: input.display_name,
        email: input.email ?? null,
        party_type: input.party_type as any,
        role_label: input.role_label ?? null,
        must_sign: input.must_sign ?? true,
        user_id: input.user_id ?? null,
      })
      .select('id')
      .single();
    return { data, error };
  });
}

/**
 * Add a formalization event
 */
export async function addEvent(
  formalizationId: string,
  eventType: string,
  actorUserId: string | null,
  meta: Json = {}
): Promise<RepositoryResult<null>> {
  return executeQuery(async () => {
    const { error } = await supabase
      .from('formalization_events')
      .insert({
        formalization_id: formalizationId,
        event_type: eventType as any,
        actor_user_id: actorUserId,
        meta,
      });
    return { data: null, error };
  });
}

/**
 * Add an evidence link
 */
export async function addEvidenceLink(
  input: CreateEvidenceLinkInput
): Promise<RepositoryResult<null>> {
  return executeQuery(async () => {
    const { error } = await supabase
      .from('formalization_evidence_links')
      .insert({
        formalization_id: input.formalization_id,
        kind: input.kind as any,
        url: input.url,
        description: input.description ?? null,
        created_by: input.created_by,
      });
    return { data: null, error };
  });
}

/**
 * Get user profile (customer_org_id, display_name, email)
 */
export async function getUserProfile(
  userId: string
): Promise<RepositoryResult<{ customer_org_id: string; display_name: string; email: string }>> {
  return executeQuery(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('customer_org_id, display_name, email')
      .eq('user_id', userId)
      .single();
    return { data, error };
  });
}

/**
 * Invoke signature certificate edge function
 */
export async function downloadSignatureCertificate(
  formalizationId: string,
  partyId: string
): Promise<{ data: any; error: any }> {
  return supabase.functions.invoke('signature-certificate', {
    body: { formalization_id: formalizationId, party_id: partyId },
  });
}
