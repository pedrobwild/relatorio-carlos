/* eslint-disable no-console */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsResponse, jsonResponse } from "../_shared/cors.ts";
import { authenticateRequest } from "../_shared/auth.ts";
import { logSystemError } from "../_shared/errorLogger.ts";

const FUNCTION_NAME = 'document-upload';

// Magic byte signatures for server-side MIME validation
const MAGIC_BYTES: Record<string, number[][]> = {
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]],                // %PDF
  'image/png': [[0x89, 0x50, 0x4E, 0x47]],                       // .PNG
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],                             // JFIF/EXIF
  'image/gif': [[0x47, 0x49, 0x46, 0x38]],                       // GIF8
  'image/webp': [[0x52, 0x49, 0x46, 0x46]],                      // RIFF (WebP)
  'application/zip': [[0x50, 0x4B, 0x03, 0x04]],                 // PK zip
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [[0x50, 0x4B, 0x03, 0x04]], // docx (zip)
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [[0x50, 0x4B, 0x03, 0x04]],       // xlsx (zip)
  'application/msword': [[0xD0, 0xCF, 0x11, 0xE0]],              // OLE2
  'application/vnd.ms-excel': [[0xD0, 0xCF, 0x11, 0xE0]],        // OLE2
};

function validateMagicBytes(buffer: ArrayBuffer, _claimedMime: string): boolean {
  const bytes = new Uint8Array(buffer).slice(0, 8);
  if (bytes.length < 3) return false;

  // Check if any known signature matches the actual bytes
  for (const [_mime, signatures] of Object.entries(MAGIC_BYTES)) {
    for (const sig of signatures) {
      if (sig.every((b, i) => bytes[i] === b)) {
        // Bytes match a known safe format → allow
        return true;
      }
    }
  }

  // No known signature matched → reject
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
    projectId = formData.get('projectId') as string;
    const documentType = formData.get('documentType') as string;
    const name = formData.get('name') as string;
    const description = formData.get('description') as string | null;

    if (!file || !projectId || !documentType || !name) {
      return jsonResponse({ error: 'Missing required fields: file, projectId, documentType, name', requestId }, 400);
    }

    // Check project access
    const { data: hasAccess } = await supabaseAdmin.rpc('has_project_access', {
      _user_id: auth.user.id,
      _project_id: projectId,
    });
    if (!hasAccess) {
      return jsonResponse({ error: 'No access to this project', requestId }, 403);
    }

    // Read file and validate magic bytes
    const fileBuffer = await file.arrayBuffer();

    if (!validateMagicBytes(fileBuffer, file.type)) {
      console.warn(`[${requestId}] Magic byte validation failed for ${file.name} (claimed: ${file.type})`);
      return jsonResponse({ 
        error: 'Tipo de arquivo não reconhecido. O conteúdo não corresponde a um formato permitido.', 
        requestId 
      }, 400);
    }

    const checksum = await computeSHA256(fileBuffer);

    console.log(`[${requestId}] File: ${file.name}, Size: ${file.size}, Checksum: ${checksum}`);

    // Generate storage path
    const timestamp = Date.now();
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${projectId}/${documentType}/${timestamp}_${sanitizedFilename}`;

    // Upload to storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from('project-documents')
      .upload(storagePath, fileBuffer, { contentType: file.type, upsert: false });

    if (uploadError) {
      console.error(`[${requestId}] Upload error:`, uploadError);
      await logSystemError(supabaseAdmin, FUNCTION_NAME, 'STORAGE_UPLOAD_FAILED', uploadError.message, {
        requestId, userId, projectId, requestPath, requestMethod,
        metadata: { documentType, fileName: file.name, fileSize: file.size },
      });
      return jsonResponse({ error: `Upload failed: ${uploadError.message}`, requestId }, 500);
    }

    // Create document record
    const { data: document, error: dbError } = await supabaseAdmin
      .from('project_documents')
      .insert({
        project_id: projectId,
        document_type: documentType,
        name,
        description,
        storage_path: storagePath,
        storage_bucket: 'project-documents',
        mime_type: file.type,
        size_bytes: file.size,
        uploaded_by: auth.user.id,
        checksum,
        status: 'pending',
        version: 1,
      })
      .select()
      .single();

    if (dbError) {
      console.error(`[${requestId}] DB error:`, dbError);
      await supabaseAdmin.storage.from('project-documents').remove([storagePath]);
      await logSystemError(supabaseAdmin, FUNCTION_NAME, 'DB_INSERT_FAILED', dbError.message, {
        requestId, userId, projectId, requestPath, requestMethod,
        metadata: { documentType, fileName: file.name },
      });
      return jsonResponse({ error: `Database error: ${dbError.message}`, requestId }, 500);
    }

    // Log domain event (best-effort)
    try {
      const { data: project } = await supabaseAdmin
        .from('projects')
        .select('org_id')
        .eq('id', projectId)
        .single();

      if (project?.org_id) {
        await supabaseAdmin.rpc('log_domain_event', {
          _org_id: project.org_id,
          _project_id: projectId,
          _entity_type: 'document',
          _entity_id: document.id,
          _event_type: 'DOCUMENT_UPLOADED',
          _payload: {
            document_type: documentType,
            name,
            checksum,
            size_bytes: file.size,
            request_id: requestId,
          },
        });
      }
    } catch (eventError) {
      console.error(`[${requestId}] Failed to log domain event:`, eventError);
    }

    console.log(`[${requestId}] Document uploaded successfully: ${document.id}`);

    return jsonResponse({
      success: true,
      requestId,
      document: {
        id: document.id,
        name: document.name,
        checksum: document.checksum,
        storage_path: document.storage_path,
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
