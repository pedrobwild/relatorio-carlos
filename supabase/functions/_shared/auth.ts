import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * Authenticate a request and return the user + admin client.
 * Throws { status, message } on failure.
 */
export async function authenticateRequest(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseServiceKey) {
    throw { status: 500, message: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' };
  }
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw { status: 401, message: 'Authorization required' };
  }

  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!anonKey) {
    throw { status: 500, message: 'Missing SUPABASE_ANON_KEY' };
  }
  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error } = await supabaseUser.auth.getUser();
  if (error || !user) {
    throw { status: 401, message: 'Invalid token' };
  }

  return { user, supabaseAdmin };
}

type AdminClient = SupabaseClient;

const permissionError = (what: string) => ({
  status: 500,
  message: `Falha ao verificar permissões (${what})`,
});

/** Lê um booleano de uma RPC de papel. Erro vira exceção: nunca liberar por falha. */
async function rpcFlag(
  supabaseAdmin: AdminClient,
  fn: 'is_staff' | 'has_role',
  args: Record<string, string>,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc(fn, args);
  if (error) throw permissionError(fn);
  return data === true;
}

/**
 * Os papéis vivem em três lugares (user_roles, users_profile.perfil,
 * profiles.role) e já divergiram em produção. Lê os dois últimos.
 */
async function readProfileRoles(supabaseAdmin: AdminClient, userId: string) {
  const [usersProfile, profile] = await Promise.all([
    supabaseAdmin
      .from('users_profile')
      .select('perfil, status')
      .eq('id', userId)
      .maybeSingle(),
    supabaseAdmin.from('profiles').select('role').eq('user_id', userId).maybeSingle(),
  ]);
  if (usersProfile.error) throw permissionError('users_profile');
  if (profile.error) throw permissionError('profiles');
  return {
    perfil: (usersProfile.data?.perfil as string | undefined) ?? null,
    status: (usersProfile.data?.status as string | undefined) ?? null,
    profileRole: (profile.data?.role as string | undefined) ?? null,
  };
}

export function isStaffUser(supabaseAdmin: AdminClient, userId: string) {
  return rpcFlag(supabaseAdmin, 'is_staff', { _user_id: userId });
}

/**
 * Admin de verdade: mesmo critério de admin_set_user_role (perfil admin e
 * ativo) além de user_roles. Só user_roles não basta: há contas admin só ali
 * (promovidas pela tela antiga) e admins desativados continuam com a linha.
 */
export async function isAdminUser(supabaseAdmin: AdminClient, userId: string) {
  if (!(await rpcFlag(supabaseAdmin, 'has_role', { _user_id: userId, _role: 'admin' }))) {
    return false;
  }
  const { perfil, status } = await readProfileRoles(supabaseAdmin, userId);
  return perfil === 'admin' && status === 'ativo';
}

/** Conta com qualquer papel além de cliente, em qualquer um dos três stores. */
export async function isPrivilegedAccount(supabaseAdmin: AdminClient, userId: string) {
  if (await isStaffUser(supabaseAdmin, userId)) return true;
  const { perfil, profileRole } = await readProfileRoles(supabaseAdmin, userId);
  return (perfil !== null && perfil !== 'customer') ||
    (profileRole !== null && profileRole !== 'customer');
}

/**
 * Contas da equipe só podem ser alteradas (senha, e-mail, exclusão) por
 * admin. Sem isso, qualquer colaborador redefiniria a senha de um admin e
 * assumiria a conta. Contas de cliente seguem liberadas para a equipe.
 * Throws { status, message } quando não pode.
 */
export async function assertCanManageAccount(
  supabaseAdmin: AdminClient,
  actorId: string,
  targetUserId: string,
) {
  // Mexer na própria conta não dá acesso a nada novo.
  if (actorId === targetUserId) return;
  if (!(await isPrivilegedAccount(supabaseAdmin, targetUserId))) return;
  if (await isAdminUser(supabaseAdmin, actorId)) return;
  throw { status: 403, message: 'Apenas administradores podem alterar contas da equipe' };
}
