/**
 * Supabase Infrastructure Layer
 *
 * This module re-exports the Supabase client and provides
 * centralized utilities for database operations.
 */

export { supabase } from "@/integrations/supabase/client";

// Re-export types
export type { Database } from "@/integrations/supabase/types";
