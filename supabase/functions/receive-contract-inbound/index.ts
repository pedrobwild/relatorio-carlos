import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsResponse, jsonResponse } from "../_shared/cors.ts";

/**
 * receive-contract-inbound
 *
 * Receives a client contract PDF from Envision Build Guide and stores it
 * in the project-documents bucket + project_documents table.
 *
 * POST body:
 * {
 *   source_id: string,          // Envision project ID
 *   project_id?: string,        // Portal BWild project UUID (optional if source_id provided)
 *   file_name: string,          // e.g. "Contrato_ClienteX.pdf"
 *   file_base64: string,        // Base64-encoded PDF content
 *   mime_type?: string,         // defaults to "application/pdf"
 *   description?: string        // optional description
 * }
 *
 * Auth: x-integration-key header
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    // --- Auth ---
    const integrationKey = req.headers.get("x-integration-key");
    const expectedKey = Deno.env.get("INTEGRATION_API_KEY");

    if (!expectedKey) {
      return jsonResponse({ error: "INTEGRATION_API_KEY not configured" }, 500);
    }
    if (integrationKey !== expectedKey) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, 500);
    }

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json();
    const {
      source_id,
      project_id: directProjectId,
      file_name,
      file_base64,
      mime_type = "application/pdf",
      description,
    } = body;

    // --- Validate ---
    const errors: string[] = [];
    if (!source_id && !directProjectId) errors.push("source_id ou project_id é obrigatório");
    if (!file_name?.trim()) errors.push("file_name é obrigatório");
    if (!file_base64?.trim()) errors.push("file_base64 é obrigatório");

    if (errors.length > 0) {
      return jsonResponse({ error: "Validation failed", details: errors }, 400);
    }

    // --- Resolve project ID ---
    let projectId = directProjectId;

    if (!projectId && source_id) {
      const { data: project, error: lookupErr } = await db
        .from("projects")
        .select("id")
        .eq("external_id", source_id)
        .eq("external_system", "envision")
        .maybeSingle();

      if (lookupErr) {
        console.error("[receive-contract-inbound] Project lookup error:", lookupErr.message);
        return jsonResponse({ error: "Failed to lookup project: " + lookupErr.message }, 500);
      }

      if (!project) {
        return jsonResponse({
          error: `Project not found for source_id: ${source_id}`,
          hint: "Ensure the project was synced via sync-project-inbound first",
        }, 404);
      }

      projectId = project.id;
    }

    // --- Decode file ---
    const fileBytes = Uint8Array.from(atob(file_base64), (c) => c.charCodeAt(0));
    const fileSize = fileBytes.length;

    // Validate it's a reasonable PDF size (max 50MB)
    if (fileSize > 50 * 1024 * 1024) {
      return jsonResponse({ error: "File too large. Max 50MB." }, 400);
    }

    // --- Upload to storage ---
    const sanitizedName = file_name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${projectId}/contratos/${Date.now()}_${sanitizedName}`;
    const bucket = "project-documents";

    const { error: uploadErr } = await db.storage
      .from(bucket)
      .upload(storagePath, fileBytes, {
        contentType: mime_type,
        upsert: false,
      });

    if (uploadErr) {
      console.error("[receive-contract-inbound] Upload error:", uploadErr.message);
      return jsonResponse({ error: "Storage upload failed: " + uploadErr.message }, 500);
    }

    // --- Create project_documents record ---
    // Find an admin user for uploaded_by to satisfy FK constraint
    const { data: adminUser } = await db
      .from("users_profile")
      .select("id")
      .eq("perfil", "admin")
      .eq("status", "ativo")
      .limit(1)
      .single();

    if (!adminUser) {
      await db.storage.from(bucket).remove([storagePath]);
      return jsonResponse({ error: "No active admin user found for uploaded_by" }, 500);
    }

    const { data: docRecord, error: docErr } = await db
      .from("project_documents")
      .insert({
        project_id: projectId,
        document_type: "contrato",
        name: file_name.trim(),
        description: description || "Contrato do cliente recebido via integração Envision",
        storage_path: storagePath,
        storage_bucket: bucket,
        mime_type: mime_type,
        size_bytes: fileSize,
        status: "approved",
        uploaded_by: adminUser.id,
      })
      .select("id")
      .single();

    if (docErr) {
      console.error("[receive-contract-inbound] Document insert error:", docErr.message);
      // Try to clean up uploaded file
      await db.storage.from(bucket).remove([storagePath]);
      return jsonResponse({ error: "Document record failed: " + docErr.message }, 500);
    }

    // --- Log sync ---
    await db.from("integration_sync_log").insert({
      source_system: "envision",
      target_system: "portal_bwild",
      entity_type: "contract_document",
      source_id: source_id || projectId,
      target_id: docRecord.id,
      sync_status: "success",
      payload: { file_name, project_id: projectId, mime_type, size_bytes: fileSize },
      attempts: 1,
      synced_at: new Date().toISOString(),
    });

    return jsonResponse({
      status: "success",
      document_id: docRecord.id,
      project_id: projectId,
      storage_path: storagePath,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[receive-contract-inbound] Unexpected error:", errMsg);
    return jsonResponse({ error: errMsg }, 500);
  }
});
