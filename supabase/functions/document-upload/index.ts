import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FUNCTION_NAME = 'document-upload';

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

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  let userId: string | undefined;
  let projectId: string | undefined;

  try {
    // Get authorization header for user context
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required', requestId }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's token for RLS
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
    projectId = formData.get('projectId') as string;
    const documentType = formData.get('documentType') as string;
    const name = formData.get('name') as string;
    const description = formData.get('description') as string | null;

    if (!file || !projectId || !documentType || !name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: file, projectId, documentType, name', requestId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check project access
    const { data: hasAccess } = await supabaseAdmin.rpc('has_project_access', { 
      _user_id: user.id, 
      _project_id: projectId 
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
    
    console.log(`[${requestId}] File: ${file.name}, Size: ${file.size}, Checksum: ${checksum}`);

    // Generate storage path
    const timestamp = Date.now();
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${projectId}/${documentType}/${timestamp}_${sanitizedFilename}`;

    // Upload to storage using admin client (bypasses RLS for service operations)
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
        metadata: { documentType, fileName: file.name, fileSize: file.size },
      });
      return new Response(
        JSON.stringify({ error: `Upload failed: ${uploadError.message}`, requestId }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create document record with checksum
    const { data: document, error: dbError } = await supabaseAdmin
      .from('project_documents')
      .insert({
        project_id: projectId,
        document_type: documentType,
        name: name,
        description: description,
        storage_path: storagePath,
        storage_bucket: 'project-documents',
        mime_type: file.type,
        size_bytes: file.size,
        uploaded_by: user.id,
        checksum: checksum,
        status: 'pending',
        version: 1,
      })
      .select()
      .single();

    if (dbError) {
      console.error(`[${requestId}] DB error:`, dbError);
      // Rollback: delete uploaded file
      await supabaseAdmin.storage.from('project-documents').remove([storagePath]);
      await logError(supabaseAdmin, 'DB_INSERT_FAILED', dbError.message, {
        requestId, userId, projectId, requestPath, requestMethod,
        metadata: { documentType, fileName: file.name },
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
            name: name,
            checksum: checksum,
            size_bytes: file.size,
            request_id: requestId,
          },
        });
      }
    } catch (eventError) {
      console.error(`[${requestId}] Failed to log domain event:`, eventError);
    }

    console.log(`[${requestId}] Document uploaded successfully: ${document.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        requestId,
        document: {
          id: document.id,
          name: document.name,
          checksum: document.checksum,
          storage_path: document.storage_path,
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