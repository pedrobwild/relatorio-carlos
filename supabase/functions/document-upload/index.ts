import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function computeSHA256(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Get authorization header for user context
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's token for RLS
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    // Create admin client for service operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from token
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is staff
    const { data: isStaff } = await supabaseAdmin.rpc('is_staff', { _user_id: user.id });
    if (!isStaff) {
      return new Response(
        JSON.stringify({ error: 'Only staff can upload documents' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const projectId = formData.get('projectId') as string;
    const documentType = formData.get('documentType') as string;
    const name = formData.get('name') as string;
    const description = formData.get('description') as string | null;

    if (!file || !projectId || !documentType || !name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: file, projectId, documentType, name' }),
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
        JSON.stringify({ error: 'No access to this project' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Read file and compute checksum
    const fileBuffer = await file.arrayBuffer();
    const checksum = await computeSHA256(fileBuffer);
    
    console.log(`File: ${file.name}, Size: ${file.size}, Checksum: ${checksum}`);

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
      console.error('Upload error:', uploadError);
      return new Response(
        JSON.stringify({ error: `Upload failed: ${uploadError.message}` }),
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
      console.error('DB error:', dbError);
      // Rollback: delete uploaded file
      await supabaseAdmin.storage.from('project-documents').remove([storagePath]);
      return new Response(
        JSON.stringify({ error: `Database error: ${dbError.message}` }),
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
          },
        });
      }
    } catch (eventError) {
      console.error('Failed to log domain event:', eventError);
      // Don't fail the request for event logging issues
    }

    console.log(`Document uploaded successfully: ${document.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
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
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
