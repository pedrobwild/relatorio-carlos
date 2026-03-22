/**
 * Edge Functions Helper
 * 
 * Centralized edge function invocation helper.
 * Avoids direct supabase imports in components for edge function calls.
 */

import { supabase } from '@/infra/supabase';

/**
 * Invoke an edge function via supabase.functions.invoke
 */
export async function invokeFunction<T = unknown>(
  functionName: string,
  body?: Record<string, unknown>
): Promise<{ data: T | null; error: any }> {
  return supabase.functions.invoke<T>(functionName, { body });
}

/**
 * Invoke an edge function via fetch (for FormData uploads)
 */
export async function invokeFunctionRaw(
  functionName: string,
  options: RequestInit
): Promise<Response> {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(`${baseUrl}/functions/v1/${functionName}`, {
    ...options,
    headers,
  });
}

/**
 * Get current auth session token
 */
export async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}
