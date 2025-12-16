import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FUNCTION_NAME = 'document-version-upload';

async function computeSHA256(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function logError(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
  errorCode: string,
  errorMessage: string,
  context: {
    requestId: string;
    userId?: string;
    projectId?: string;
    errorStack?: string;
    requestPath?: string;
    requestMethod?: string;
    metadata?: Record<string, unknown>;
  }
) {
  try {
    await supabaseAdmin.rpc('log_system_error', {
      p_error_code: errorCode,
      p_error_message: errorMessage,
      p_source: 'edge_function',
      p_function_name: FUNCTION_NAME,
      p_request_id: context.requestId,
      p_user_id: context.userId || null,
      p_project_id: context.projectId || null,
      p_error_stack: context.errorStack || null,
      p_request_path: context.requestPath || null,
      p_request_method: context.requestMethod || null,
      p_metadata: context.metadata || {},
    });
  } catch (logError) {
    console.error('Failed to log error to system_errors:', logError);
  }
}

serve(async (req) => {
  const requestId = crypto.randomUUID();
  const requestPath = new URL(req.url).pathname;
  const requestMethod = req.method;

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  let userId: string | undefined;
  let projectId: string | undefined;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required', requestId }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get user from token
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error(`[${requestId}] Auth error:`, userError);
      return new Response(
        JSON.stringify({ error: 'Invalid token', requestId }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    userId = user.id;

    // Check if user is staff
    const { data: isStaff } = await supabaseAdmin.rpc('is_staff', { _user_id: user.id });
    if (!isStaff) {
      return new Response(
        JSON.stringify({ error: 'Only staff can upload documents', requestId }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const parentDocumentId = formData.get('parentDocumentId') as string;
    const changeNotes = formData.get('changeNotes') as string | null;

    if (!file || !parentDocumentId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: file, parentDocumentId', requestId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get parent document to inherit metadata and calculate next version
    const { data: parentDoc, error: parentError } = await supabaseAdmin
      .from('project_documents')
      .select('*')
      .eq('id', parentDocumentId)
      .maybeSingle();

    if (parentError || !parentDoc) {
      console.error(`[${requestId}] Parent document error:`, parentError);
      return new Response(
        JSON.stringify({ error: 'Parent document not found', requestId }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
      _user_id: user.id, 
      _project_id: parentDoc.project_id 
    });
    if (!hasAccess) {
      return new Response(
        JSON.stringify({ error: 'No access to this project', requestId }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Read file and compute checksum
    const fileBuffer = await file.arrayBuffer();
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
      return new Response(
        JSON.stringify({ 
          error: `Este arquivo já existe como versão ${existingWithChecksum.version}. O checksum é idêntico.`,
          duplicateVersion: existingWithChecksum.version,
          requestId,
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate storage path
    const timestamp = Date.now();
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${parentDoc.project_id}/${parentDoc.document_type}/v${nextVersion}_${timestamp}_${sanitizedFilename}`;

    // Upload to storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from('project-documents')
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error(`[${requestId}] Upload error:`, uploadError);
      await logError(supabaseAdmin, 'STORAGE_UPLOAD_FAILED', uploadError.message, {
        requestId, userId, projectId, requestPath, requestMethod,
        metadata: { documentType: parentDoc.document_type, fileName: file.name, version: nextVersion },
      });
      return new Response(
        JSON.stringify({ error: `Upload failed: ${uploadError.message}`, requestId }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
        uploaded_by: user.id,
        checksum: checksum,
        status: 'pending',
        version: nextVersion,
        parent_document_id: rootDocumentId,
      })
      .select()
      .single();

    if (dbError) {
      console.error(`[${requestId}] DB error:`, dbError);
      await supabaseAdmin.storage.from('project-documents').remove([storagePath]);
      await logError(supabaseAdmin, 'DB_INSERT_FAILED', dbError.message, {
        requestId, userId, projectId, requestPath, requestMethod,
        metadata: { documentType: parentDoc.document_type, version: nextVersion },
      });
      return new Response(
        JSON.stringify({ error: `Database error: ${dbError.message}`, requestId }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log domain event
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
            checksum: checksum,
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

    return new Response(
      JSON.stringify({ 
        success: true,
        requestId,
        document: {
          id: newDocument.id,
          name: newDocument.name,
          version: newDocument.version,
          checksum: newDocument.checksum,
          storage_path: newDocument.storage_path,
          previous_checksum: parentDoc.checksum,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error(`[${requestId}] Unexpected error:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    await logError(supabaseAdmin, 'UNEXPECTED_ERROR', errorMessage, {
      requestId, userId, projectId, errorStack, requestPath, requestMethod,
    });
    
    return new Response(
      JSON.stringify({ error: errorMessage, requestId }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
