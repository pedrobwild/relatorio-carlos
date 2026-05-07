/* eslint-disable no-console */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";

interface CleanupResult {
  success: boolean;
  processed: number;
  deleted: number;
  errors: string[];
  timestamp: string;
}

interface FileRecord {
  id: string;
  bucket: string;
  storage_path: string;
  status: string;
  deleted_at: string | null;
  expires_at: string | null;
}

// Grace period in days before physically removing deleted files
const DELETED_GRACE_PERIOD_DAYS = 7;

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Create admin client for cleanup operations
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  const result: CleanupResult = {
    success: true,
    processed: 0,
    deleted: 0,
    errors: [],
    timestamp: new Date().toISOString(),
  };

  try {
    // Check authorization - must be service role (cron) or admin user
    const authHeader = req.headers.get("Authorization");
    
    if (authHeader && authHeader !== `Bearer ${supabaseServiceKey}`) {
      // Validate user JWT and check for admin role
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
      
      if (authError || !user) {
        console.error("[files-cleanup] Auth error:", authError?.message);
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if user is admin
      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileError || profile?.role !== "admin") {
        console.error("[files-cleanup] Access denied for user:", user.id);
        return new Response(
          JSON.stringify({ error: "Forbidden: Admin access required" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("[files-cleanup] Triggered by admin user:", user.id);
    } else {
      console.log("[files-cleanup] Triggered by service role (cron)");
    }

    // Calculate threshold dates
    const now = new Date();
    const deletedThreshold = new Date(now.getTime() - DELETED_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

    console.log("[files-cleanup] Starting cleanup...");
    console.log("[files-cleanup] Deleted threshold:", deletedThreshold.toISOString());
    console.log("[files-cleanup] Expired threshold:", now.toISOString());

    // Find files to clean up:
    // 1. Deleted files past grace period
    // 2. Expired files (expires_at <= now)
    const { data: candidateFiles, error: selectError } = await supabaseAdmin
      .from("files")
      .select("id, bucket, storage_path, status, deleted_at, expires_at")
      .or(
        `and(status.eq.deleted,deleted_at.lt.${deletedThreshold.toISOString()}),` +
        `expires_at.lte.${now.toISOString()}`
      )
      .limit(100); // Process in batches to avoid timeout

    if (selectError) {
      console.error("[files-cleanup] Failed to fetch candidates:", selectError.message);
      throw new Error(`Failed to fetch files: ${selectError.message}`);
    }

    if (!candidateFiles || candidateFiles.length === 0) {
      console.log("[files-cleanup] No files to clean up");
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[files-cleanup] Found ${candidateFiles.length} files to process`);
    result.processed = candidateFiles.length;

    // Process each file
    for (const file of candidateFiles as FileRecord[]) {
      try {
        console.log(`[files-cleanup] Processing file: ${file.id} (${file.bucket}/${file.storage_path})`);

        // Remove from storage
        const { error: storageError } = await supabaseAdmin.storage
          .from(file.bucket)
          .remove([file.storage_path]);

        // Ignore "not found" errors (idempotent)
        if (storageError && !storageError.message.includes("not found")) {
          console.warn(`[files-cleanup] Storage error for ${file.id}:`, storageError.message);
          result.errors.push(`Storage error for ${file.id}: ${storageError.message}`);
          continue;
        }

        // Update file record
        const updateData: Record<string, unknown> = {
          status: "deleted",
          updated_at: now.toISOString(),
        };

        // Set deleted_at if not already set (for expired files)
        if (!file.deleted_at) {
          updateData.deleted_at = now.toISOString();
        }

        const { error: updateError } = await supabaseAdmin
          .from("files")
          .update(updateData)
          .eq("id", file.id);

        if (updateError) {
          console.warn(`[files-cleanup] Update error for ${file.id}:`, updateError.message);
          result.errors.push(`Update error for ${file.id}: ${updateError.message}`);
          continue;
        }

        // Log audit event if table exists
        try {
          await supabaseAdmin.from("auditoria").insert({
            acao: "delete",
            entidade: "files",
            entidade_id: file.id,
            obra_id: null,
            por_user_id: null,
            diff: {
              reason: file.expires_at && new Date(file.expires_at) <= now 
                ? "expired" 
                : "cleanup_grace_period",
              storage_path: file.storage_path,
              bucket: file.bucket,
            },
          });
        } catch (auditError) {
          // Audit logging is optional, don't fail the cleanup
          console.warn(`[files-cleanup] Audit log failed for ${file.id}:`, auditError);
        }

        result.deleted++;
        console.log(`[files-cleanup] Successfully cleaned up file: ${file.id}`);
      } catch (fileError) {
        const errorMsg = fileError instanceof Error ? fileError.message : String(fileError);
        console.error(`[files-cleanup] Error processing file ${file.id}:`, errorMsg);
        result.errors.push(`Error processing ${file.id}: ${errorMsg}`);
      }
    }

    console.log(`[files-cleanup] Cleanup complete. Deleted: ${result.deleted}/${result.processed}`);
    
    if (result.errors.length > 0) {
      console.warn(`[files-cleanup] Completed with ${result.errors.length} errors`);
      result.success = result.errors.length < result.processed; // Partial success
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[files-cleanup] Fatal error:", errorMsg);
    
    result.success = false;
    result.errors.push(errorMsg);
    
    return new Response(
      JSON.stringify(result),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
