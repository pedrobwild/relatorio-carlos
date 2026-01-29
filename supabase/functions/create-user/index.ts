import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create client with user's token to verify they're admin
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Verify the requesting user is an admin
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user has admin role
    const { data: roleData, error: roleError } = await userClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (roleError || roleData?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { email, password, display_name, role, cpf, project_ids } = await req.json()

    if (!email || !password || !role) {
      return new Response(
        JSON.stringify({ error: 'Email, password, and role are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate role - include all valid app_role values
    const validRoles = ['admin', 'engineer', 'customer', 'manager', 'suprimentos', 'financeiro', 'gestor']
    if (!validRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: 'Invalid role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create admin client with service role
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Check if user already exists
    const { data: existingUsers } = await adminClient
      .from('users_profile')
      .select('id')
      .eq('email', email)
      .limit(1)
    
    if (existingUsers && existingUsers.length > 0) {
      return new Response(
        JSON.stringify({ error: 'Usuário já existe com este email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create the user
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        display_name: display_name || email.split('@')[0],
        role,
        cpf: cpf || null,
      }
    })

    if (createError) {
      console.error('Error creating user:', createError)
      
      // Handle specific error cases
      if (createError.message?.includes('already been registered')) {
        return new Response(
          JSON.stringify({ error: 'Email já cadastrado no sistema' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!newUser.user) {
      return new Response(
        JSON.stringify({ error: 'Falha ao criar usuário' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update user_roles table with correct role (trigger creates with 'customer' by default)
    if (role !== 'customer') {
      const { error: updateRoleError } = await adminClient
        .from('user_roles')
        .update({ role })
        .eq('user_id', newUser.user.id)

      if (updateRoleError) {
        console.error('Error updating user_roles:', updateRoleError)
      }
    }

    // Update users_profile table with correct role (trigger creates with metadata role)
    const { error: updateProfileError } = await adminClient
      .from('users_profile')
      .update({ 
        perfil: role,
        nome: display_name || email.split('@')[0],
      })
      .eq('id', newUser.user.id)

    if (updateProfileError) {
      console.error('Error updating users_profile:', updateProfileError)
    }

    // Add user to selected projects as viewer
    if (project_ids && Array.isArray(project_ids) && project_ids.length > 0) {
      const projectMemberRecords = project_ids.map((projectId: string) => ({
        project_id: projectId,
        user_id: newUser.user!.id,
        role: 'viewer',
      }))

      const { error: projectMembersError } = await adminClient
        .from('project_members')
        .insert(projectMemberRecords)

      if (projectMembersError) {
        console.error('Error adding user to projects:', projectMembersError)
        // Don't fail the request, user was created successfully
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: {
          id: newUser.user?.id,
          email: newUser.user?.email,
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
