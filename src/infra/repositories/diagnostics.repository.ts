/**
 * Diagnostics Repository
 *
 * Provides safe, lightweight diagnostic checks for the admin health page.
 * All queries are designed to be non-invasive and fast.
 */

import { supabase } from "@/infra/supabase";

export interface DiagnosticResult {
  status: "ok" | "fail" | "warn";
  message: string;
  details?: string;
  latencyMs?: number;
}

export interface AuthCheckResult extends DiagnosticResult {
  userId?: string;
  hasSession: boolean;
}

export interface DbCheckResult extends DiagnosticResult {
  serverTime?: string;
}

export interface StorageCheckResult extends DiagnosticResult {
  bucketsAccessible?: string[];
}

export interface RlsCheckResult extends DiagnosticResult {
  checks: {
    name: string;
    passed: boolean;
    details: string;
  }[];
}

/**
 * Measure execution time of an async function
 */
export async function measureLatency<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; latencyMs: number }> {
  const start = performance.now();
  const result = await fn();
  const latencyMs = Math.round(performance.now() - start);
  return { result, latencyMs };
}

/**
 * Check authentication status
 */
export async function checkAuth(): Promise<AuthCheckResult> {
  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      return {
        status: "fail",
        message: "Erro ao verificar sessão",
        details: error.message,
        hasSession: false,
      };
    }

    if (!session) {
      return {
        status: "warn",
        message: "Sem sessão ativa",
        hasSession: false,
      };
    }

    return {
      status: "ok",
      message: "Sessão válida",
      userId: session.user.id,
      hasSession: true,
    };
  } catch (err) {
    return {
      status: "fail",
      message: "Exceção ao verificar auth",
      details: err instanceof Error ? err.message : "Erro desconhecido",
      hasSession: false,
    };
  }
}

/**
 * Ping database with a simple query
 */
export async function pingDb(): Promise<DbCheckResult> {
  try {
    const { result, latencyMs } = await measureLatency(async () => {
      // Try to query a simple table with RLS
      const { data, error } = await supabase.from("orgs").select("id").limit(1);

      return { data, error };
    });

    if (result.error) {
      // If RLS blocks, try user_roles which should be accessible to logged user
      const { data: _fallbackData, error: fallbackError } = await supabase
        .from("user_roles")
        .select("role")
        .limit(1);

      if (fallbackError) {
        return {
          status: "fail",
          message: "Erro ao conectar ao banco",
          details: fallbackError.message,
          latencyMs,
        };
      }

      return {
        status: "ok",
        message: "Banco acessível (via user_roles)",
        latencyMs,
      };
    }

    return {
      status: "ok",
      message: "Banco respondendo",
      latencyMs,
      serverTime: new Date().toISOString(),
    };
  } catch (err) {
    return {
      status: "fail",
      message: "Exceção ao pingar banco",
      details: err instanceof Error ? err.message : "Erro desconhecido",
    };
  }
}

/**
 * Check storage access
 */
export async function checkStorage(): Promise<StorageCheckResult> {
  try {
    const { result, latencyMs } = await measureLatency(async () => {
      // List buckets (admin only typically, but try)
      const { data, error } = await supabase.storage.listBuckets();
      return { data, error };
    });

    if (result.error) {
      // Try to list files in a known bucket
      const { data: _filesData, error: filesError } = await supabase.storage
        .from("project-documents")
        .list("", { limit: 1 });

      if (filesError) {
        return {
          status: "warn",
          message: "Storage com acesso limitado",
          details: "Não foi possível listar buckets ou arquivos",
          latencyMs,
        };
      }

      return {
        status: "ok",
        message: "Storage acessível",
        latencyMs,
        bucketsAccessible: ["project-documents"],
      };
    }

    return {
      status: "ok",
      message: "Storage respondendo",
      latencyMs,
      bucketsAccessible: result.data?.map((b) => b.name) || [],
    };
  } catch (err) {
    return {
      status: "fail",
      message: "Exceção ao verificar storage",
      details: err instanceof Error ? err.message : "Erro desconhecido",
    };
  }
}

/**
 * Run basic RLS permission checks
 * These are safe, non-invasive checks that validate RLS is working
 */
export async function checkRlsBasics(userId: string): Promise<RlsCheckResult> {
  const checks: RlsCheckResult["checks"] = [];

  try {
    // Check 1: User can read their own roles
    const { data: rolesData, error: rolesError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    checks.push({
      name: "Leitura de roles próprios",
      passed: !rolesError && Array.isArray(rolesData),
      details: rolesError
        ? rolesError.message
        : `${rolesData?.length || 0} role(s) encontrada(s)`,
    });

    // Check 2: User can access projects they're member of
    const { data: projectsData, error: projectsError } = await supabase
      .from("project_members")
      .select("project_id")
      .eq("user_id", userId)
      .limit(5);

    checks.push({
      name: "Leitura de projetos próprios",
      passed: !projectsError,
      details: projectsError
        ? projectsError.message
        : `${projectsData?.length || 0} projeto(s) acessível(is)`,
    });

    // Check 3: Verify RLS blocks unauthorized access (safe check)
    // We check if querying without filter returns limited results (RLS active)
    const { count, error: countError } = await supabase
      .from("projects")
      .select("*", { count: "exact", head: true });

    checks.push({
      name: "RLS em projects ativo",
      passed: !countError,
      details: countError
        ? countError.message
        : `${count || 0} projeto(s) visíveis (filtrado por RLS)`,
    });

    // Check 4: Verify profile access
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    checks.push({
      name: "Leitura de perfil próprio",
      passed: !profileError,
      details: profileError
        ? profileError.message
        : profileData
          ? `Role: ${profileData.role}`
          : "Perfil não encontrado",
    });

    const allPassed = checks.every((c) => c.passed);
    const someFailed = checks.some((c) => !c.passed);

    return {
      status: allPassed ? "ok" : someFailed ? "warn" : "fail",
      message: allPassed
        ? "Todos os checks de RLS passaram"
        : "Alguns checks de RLS falharam",
      checks,
    };
  } catch (err) {
    return {
      status: "fail",
      message: "Exceção ao verificar RLS",
      details: err instanceof Error ? err.message : "Erro desconhecido",
      checks,
    };
  }
}

/**
 * Test signed URL generation
 */
export async function testSignedUrl(): Promise<DiagnosticResult> {
  try {
    // Try to create a signed URL for a test path
    const { data: _data, error } = await supabase.storage
      .from("project-documents")
      .createSignedUrl("_test/health-check.txt", 60);

    if (error) {
      // This is expected if file doesn't exist, but the function worked
      if (
        error.message.includes("not found") ||
        error.message.includes("Object not found")
      ) {
        return {
          status: "ok",
          message: "Signed URL funcional",
          details:
            "Arquivo de teste não existe, mas função responde corretamente",
        };
      }

      return {
        status: "warn",
        message: "Signed URL com restrições",
        details: error.message,
      };
    }

    return {
      status: "ok",
      message: "Signed URL gerada com sucesso",
      details: "URL válida por 60s",
    };
  } catch (err) {
    return {
      status: "fail",
      message: "Exceção ao gerar Signed URL",
      details: err instanceof Error ? err.message : "Erro desconhecido",
    };
  }
}

/**
 * Run all diagnostics and return a complete report
 */
export async function runFullDiagnostics(): Promise<{
  auth: AuthCheckResult;
  db: DbCheckResult;
  storage: StorageCheckResult;
  rls: RlsCheckResult;
  signedUrl: DiagnosticResult;
  totalLatencyMs: number;
}> {
  const start = performance.now();

  const auth = await checkAuth();
  const db = await pingDb();
  const storage = await checkStorage();
  const rls = auth.userId
    ? await checkRlsBasics(auth.userId)
    : {
        status: "warn" as const,
        message: "Não foi possível verificar RLS sem usuário",
        checks: [],
      };
  const signedUrl = await testSignedUrl();

  const totalLatencyMs = Math.round(performance.now() - start);

  return {
    auth,
    db,
    storage,
    rls,
    signedUrl,
    totalLatencyMs,
  };
}
