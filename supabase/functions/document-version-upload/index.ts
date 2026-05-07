/* eslint-disable no-console */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsResponse, jsonResponse } from "../_shared/cors.ts";
import { authenticateRequest } from "../_shared/auth.ts";
import { logSystemError } from "../_shared/errorLogger.ts";

const FUNCTION_NAME = 'document-version-upload';

// Magic byte signatures for server-side MIME validation.
// Mirrors document-upload — keep in sync.
const MAGIC_BYTES: Record<string, number[][]> = {
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47]],
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]],
  'application/zip': [[0x50, 0x4B, 0x03, 0x04]],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [[0x50, 0x4B, 0x03, 0x04]],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [[0x50, 0x4B, 0x03, 0x04]],
  'application/msword': [[0xD0, 0xCF, 0x11, 0xE0]],
  'application/vnd.ms-excel': [[0xD0, 0xCF, 0x11, 0xE0]],
};

function validateMagicBytes(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer).slice(0, 8);
  if (bytes.length < 3) return false;
  for (const signatures of Object.values(MAGIC_BYTES)) {
    for (const sig of signatures) {
      if (sig.every((b, i) => bytes[i] === b)) return true;
    }
  }
  return false;
}

async function computeSHA256(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  const requestId = crypto.randomUUID();
  const requestPath = new URL(req.url).pathname;
  const requestMethod = req.method;

  if (req.method === 'OPTIONS') return corsResponse();

  // deno-lint-ignore no-explicit-any
  let supabaseAdmin: any;
  let userId: string | undefined;
  let projectId: string | undefined;

  try {
    const auth = await authenticateRequest(req);
    supabaseAdmin = auth.supabaseAdmin;
    userId = auth.user.id;

    // Check if user is staff
    const { data: isStaff } = await supabaseAdmin.rpc('is_staff', { _user_id: auth.user.id });
    if (!isStaff) {
      return jsonResponse({ error: 'Only staff can upload documents', requestId }, 403);
    }

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const parentDocumentId = formData.get('parentDocumentId') as string;
    const changeNotes = formData.get('changeNotes') as string | null;

    if (!file || !parentDocumentId) {
      return jsonResponse({ error: 'Missing required fields: file, parentDocumentId', requestId }, 400);
    }

    // Get parent document to inherit metadata and calculate next version
    const { data: parentDoc, error: parentError } = await supabaseAdmin
      .from('project_documents')
      .select('*')
      .eq('id', parentDocumentId)
      .maybeSingle();

    if (parentError || !parentDoc) {
      console.error(`[${requestId}] Parent document error:`, parentError);
      return jsonResponse({ error: 'Parent document not found', requestId }, 404);
    }

    projectId = parentDoc.project_id;

    // Find the root document ID (for version chain)
    const rootDocumentId = parentDoc.parent_document_id || parentDoc.id;

    // Get all versions to calculate next version number
    const { data: allVersions } = await supabaseAdmin
      .from('project_documents')
      .select('version')
      .or(`id.eq.${rootDocumentId},parent_document_id.eq.${rootDocumentId}`)
      .order('version', { ascending: false });

    const nextVersion = (allVersions?.[0]?.version || parentDoc.version) + 1;

    // Check project access
    const { data: hasAccess } = await supabaseAdmin.rpc('has_project_access', {
      _user_id: auth.user.id,
      _project_id: parentDoc.project_id,
    });
    if (!hasAccess) {
      return jsonResponse({ error: 'No access to this project', requestId }, 403);
    }

    // Read file and compute checksum
    const fileBuffer = await file.arrayBuffer();

    // Server-side MIME validation via magic bytes — never trust the client.
    if (!validateMagicBytes(fileBuffer)) {
      console.warn(`[${requestId}] Magic byte validation failed for ${file.name} (claimed: ${file.type})`);
      return jsonResponse({
        error: 'Tipo de arquivo não reconhecido. O conteúdo não corresponde a um formato permitido.',
        requestId,
      }, 400);
    }

    const checksum = await computeSHA256(fileBuffer);

    console.log(`[${requestId}] Version upload - File: ${file.name}, Size: ${file.size}, Checksum: ${checksum}, Version: ${nextVersion}`);

    // Check if this exact file was already uploaded (duplicate detection)
    const { data: existingWithChecksum } = await supabaseAdmin
      .from('project_documents')
      .select('id, version')
      .eq('checksum', checksum)
      .or(`id.eq.${rootDocumentId},parent_document_id.eq.${rootDocumentId}`)
      .maybeSingle();

    if (existingWithChecksum) {
      return jsonResponse({
        error: `Este arquivo já existe como versão ${existingWithChecksum.version}. O checksum é idêntico.`,
        duplicateVersion: existingWithChecksum.version,
        requestId,
      }, 409);
    }

    // Generate storage path
    const timestamp = Date.now();
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${parentDoc.project_id}/${parentDoc.document_type}/v${nextVersion}_${timestamp}_${sanitizedFilename}`;

    // Upload to storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from('project-documents')
      .upload(storagePath, fileBuffer, { contentType: file.type, upsert: false });

    if (uploadError) {
      console.error(`[${requestId}] Upload error:`, uploadError);
      await logSystemError(supabaseAdmin, FUNCTION_NAME, 'STORAGE_UPLOAD_FAILED', uploadError.message, {
        requestId, userId, projectId, requestPath, requestMethod,
        metadata: { documentType: parentDoc.document_type, fileName: file.name, version: nextVersion },
      });
      return jsonResponse({ error: `Upload failed: ${uploadError.message}`, requestId }, 500);
    }

    // Create new version record
    const { data: newDocument, error: dbError } = await supabaseAdmin
      .from('project_documents')
      .insert({
        project_id: parentDoc.project_id,
        document_type: parentDoc.document_type,
        name: parentDoc.name,
        description: changeNotes || parentDoc.description,
        storage_path: storagePath,
        storage_bucket: 'project-documents',
        mime_type: file.type,
        size_bytes: file.size,
        uploaded_by: auth.user.id,
        checksum,
        status: 'pending',
        version: nextVersion,
        parent_document_id: rootDocumentId,
      })
      .select()
      .single();

    if (dbError) {
      console.error(`[${requestId}] DB error:`, dbError);
      await supabaseAdmin.storage.from('project-documents').remove([storagePath]);
      await logSystemError(supabaseAdmin, FUNCTION_NAME, 'DB_INSERT_FAILED', dbError.message, {
        requestId, userId, projectId, requestPath, requestMethod,
        metadata: { documentType: parentDoc.document_type, version: nextVersion },
      });
      return jsonResponse({ error: `Database error: ${dbError.message}`, requestId }, 500);
    }

    // Log domain event (best-effort)
    try {
      const { data: project } = await supabaseAdmin
        .from('projects')
        .select('org_id')
        .eq('id', parentDoc.project_id)
        .single();

      if (project?.org_id) {
        await supabaseAdmin.rpc('log_domain_event', {
          _org_id: project.org_id,
          _project_id: parentDoc.project_id,
          _entity_type: 'document',
          _entity_id: newDocument.id,
          _event_type: 'document.version_uploaded',
          _payload: {
            document_type: parentDoc.document_type,
            name: parentDoc.name,
            version: nextVersion,
            previous_version: parentDoc.version,
            checksum,
            previous_checksum: parentDoc.checksum,
            size_bytes: file.size,
            change_notes: changeNotes,
            root_document_id: rootDocumentId,
            request_id: requestId,
          },
        });
      }
    } catch (eventError) {
      console.error(`[${requestId}] Failed to log domain event:`, eventError);
    }

    console.log(`[${requestId}] Document version uploaded successfully: ${newDocument.id}, version ${nextVersion}`);

    return jsonResponse({
      success: true,
      requestId,
      document: {
        id: newDocument.id,
        name: newDocument.name,
        version: newDocument.version,
        checksum: newDocument.checksum,
        storage_path: newDocument.storage_path,
        previous_checksum: parentDoc.checksum,
      },
    });
  } catch (error: unknown) {
    // Handle auth errors thrown by authenticateRequest
    if (error && typeof error === 'object' && 'status' in error && 'message' in error) {
      const authErr = error as { status: number; message: string };
      return jsonResponse({ error: authErr.message, requestId }, authErr.status);
    }

    console.error(`[${requestId}] Unexpected error:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    if (supabaseAdmin) {
      await logSystemError(supabaseAdmin, FUNCTION_NAME, 'UNEXPECTED_ERROR', errorMessage, {
        requestId, userId, projectId, errorStack, requestPath, requestMethod,
      });
    }

    return jsonResponse({ error: errorMessage, requestId }, 500);
  }
});
