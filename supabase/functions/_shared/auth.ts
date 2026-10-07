import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

/** Só o que as travas de papel usam do client admin (facilita testar). */
type AdminClient = {
  rpc: (
    fn: string,
    args: Record<string, string>,
  ) => PromiseLike<{ data: unknown; error: unknown }>;
};

/** Lê um booleano de uma RPC de papel. Erro vira exceção: nunca liberar por falha. */
async function rpcFlag(
  supabaseAdmin: AdminClient,
  fn: 'is_staff' | 'has_role',
  args: Record<string, string>,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc(fn, args);
  if (error) {
    throw { status: 500, message: `Falha ao verificar permissões (${fn})` };
  }
  return data === true;
}

export function isStaffUser(supabaseAdmin: AdminClient, userId: string) {
  return rpcFlag(supabaseAdmin, 'is_staff', { _user_id: userId });
}

export function isAdminUser(supabaseAdmin: AdminClient, userId: string) {
  return rpcFlag(supabaseAdmin, 'has_role', { _user_id: userId, _role: 'admin' });
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
  if (!(await isStaffUser(supabaseAdmin, targetUserId))) return;
  if (await isAdminUser(supabaseAdmin, actorId)) return;
  throw { status: 403, message: 'Apenas administradores podem alterar contas da equipe' };
}
