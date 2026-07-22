/**
 * Health card: lists customers that would fall into "Projeto não encontrado".
 *
 * Two buckets:
 *  a) `project_customers` rows with no matching user in `auth.users` (email typos).
 *     Detected as rows with `customer_user_id IS NULL` — the auto-link trigger
 *     fills that column whenever a matching auth user exists, so a persistent
 *     NULL means the email does not match any account.
 *  b) Users with role `customer` that have 0 active, non-deleted projects
 *     accessible via `project_customers` or `project_members`.
 */
import { useEffect, useState } from "react";
import { AlertTriangle, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface OrphanCustomerRow {
  project_id: string;
  customer_email: string | null;
  customer_name: string | null;
}
interface CustomerWithoutProject {
  user_id: string;
  email: string | null;
}

export function CustomersWithoutProjectCard() {
  const [loading, setLoading] = useState(false);
  const [orphans, setOrphans] = useState<OrphanCustomerRow[]>([]);
  const [noProject, setNoProject] = useState<CustomerWithoutProject[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      // (a) project_customers com customer_user_id NULL → e-mail sem match.
      const { data: orphansData, error: orphansErr } = await supabase
        .from("project_customers")
        .select("project_id, customer_email, customer_name")
        .is("customer_user_id", null)
        .not("customer_email", "is", null);
      if (orphansErr) throw orphansErr;

      // (b) customers com zero obras ativas visíveis. Precisamos do lado
      // do banco porque o RLS esconderia se rodássemos como o próprio user.
      // Fazemos duas queries e cruzamos no client.
      const { data: customerRoles, error: rolesErr } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "customer");
      if (rolesErr) throw rolesErr;

      const customerIds = (customerRoles ?? []).map((r) => r.user_id);
      let noProjList: CustomerWithoutProject[] = [];
      if (customerIds.length > 0) {
        // Obras ativas não deletadas linkadas via project_customers
        const { data: pc } = await supabase
          .from("project_customers")
          .select("customer_user_id, projects!inner(id, status, deleted_at)")
          .in("customer_user_id", customerIds);
        const active = new Set<string>();
        for (const row of pc ?? []) {
          const proj = (row as unknown as {
            customer_user_id: string;
            projects: { status: string; deleted_at: string | null };
          });
          if (
            proj.projects &&
            proj.projects.deleted_at == null &&
            proj.projects.status === "active"
          ) {
            active.add(proj.customer_user_id);
          }
        }
        const { data: pm } = await supabase
          .from("project_members")
          .select("user_id, projects!inner(id, status, deleted_at)")
          .in("user_id", customerIds);
        for (const row of pm ?? []) {
          const proj = (row as unknown as {
            user_id: string;
            projects: { status: string; deleted_at: string | null };
          });
          if (
            proj.projects &&
            proj.projects.deleted_at == null &&
            proj.projects.status === "active"
          ) {
            active.add(proj.user_id);
          }
        }
        const missing = customerIds.filter((id) => !active.has(id));
        if (missing.length > 0) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("user_id, email:display_name")
            .in("user_id", missing);
          const profMap = new Map(
            (profs ?? []).map((p) => [p.user_id, (p as { email?: string }).email ?? null]),
          );
          noProjList = missing.map((id) => ({
            user_id: id,
            email: profMap.get(id) ?? null,
          }));
        }
      }

      setOrphans(orphansData ?? []);
      setNoProject(noProjList);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const total = orphans.length + noProject.length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />
          Clientes sem obra ativa
          {total > 0 && (
            <Badge variant="destructive" className="ml-2">
              {total}
            </Badge>
          )}
        </CardTitle>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          {loading ? "Verificando…" : "Recarregar"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {error && (
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        )}
        <section>
          <h4 className="font-medium mb-1">
            E-mails de cliente sem conta correspondente ({orphans.length})
          </h4>
          {orphans.length === 0 ? (
            <p className="text-muted-foreground">Nenhum registro.</p>
          ) : (
            <ul className="space-y-1 max-h-48 overflow-auto">
              {orphans.map((o) => (
                <li
                  key={`${o.project_id}-${o.customer_email}`}
                  className="font-mono text-xs"
                >
                  {o.customer_email}
                  {o.customer_name && (
                    <span className="text-muted-foreground">
                      {" "}
                      — {o.customer_name}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h4 className="font-medium mb-1">
            Contas com role customer e 0 obras ativas ({noProject.length})
          </h4>
          {noProject.length === 0 ? (
            <p className="text-muted-foreground">Nenhum registro.</p>
          ) : (
            <ul className="space-y-1 max-h-48 overflow-auto">
              {noProject.map((c) => (
                <li key={c.user_id} className="font-mono text-xs">
                  {c.email ?? c.user_id}
                </li>
              ))}
            </ul>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
