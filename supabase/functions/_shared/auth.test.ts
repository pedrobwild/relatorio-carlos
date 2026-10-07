// Deno tests das travas de papel usadas pelas edge functions de usuários.
//
// Guardam a escalada de privilégio corrigida em 2026-10: qualquer
// colaborador conseguia redefinir a senha / trocar o e-mail / apagar a conta
// de um admin (e assim assumi-la). Agora conta da equipe só é alterada por
// admin; contas de cliente seguem liberadas para a equipe. Erro ao consultar
// papéis nunca libera (falha fechada).

import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { assertCanManageAccount, isAdminUser } from "./auth.ts";

interface Account {
  /** user_roles */
  roles: string[];
  /** users_profile.perfil / status */
  perfil?: string;
  status?: string;
  /** profiles.role */
  profileRole?: string;
}

function fakeAdmin(accounts: Record<string, Account>, opts: { fail?: boolean } = {}) {
  const err = { message: "boom" };
  const staff = (id: string) =>
    (accounts[id]?.roles ?? []).some((r) => r !== "customer");
  const client = {
    rpc(fn: string, args: Record<string, string>) {
      if (opts.fail) return Promise.resolve({ data: null, error: err });
      if (fn === "is_staff") {
        return Promise.resolve({ data: staff(args._user_id), error: null });
      }
      if (fn === "has_role") {
        const has = (accounts[args._user_id]?.roles ?? []).includes(args._role);
        return Promise.resolve({ data: has, error: null });
      }
      return Promise.resolve({ data: null, error: { message: "unknown rpc" } });
    },
    from(table: string) {
      return {
        select: () => ({
          eq: (_col: string, id: string) => ({
            maybeSingle: () => {
              if (opts.fail) return Promise.resolve({ data: null, error: err });
              const a = accounts[id];
              if (!a) return Promise.resolve({ data: null, error: null });
              const data = table === "users_profile"
                ? { perfil: a.perfil ?? a.roles[0], status: a.status ?? "ativo" }
                : { role: a.profileRole ?? a.roles[0] };
              return Promise.resolve({ data, error: null });
            },
          }),
        }),
      };
    },
  };
  return client as unknown as Parameters<typeof assertCanManageAccount>[0];
}

const accounts: Record<string, Account> = {
  admin: { roles: ["admin"] },
  cs: { roles: ["cs"] },
  engineer: { roles: ["engineer"] },
  cliente: { roles: ["customer"] },
  // Promovida só em user_roles pela tela antiga: não é admin de verdade.
  adminSoEmUserRoles: { roles: ["admin"], perfil: "customer", profileRole: "customer" },
  // Admin desativado continua com a linha em user_roles.
  adminInativo: { roles: ["admin"], status: "inativo" },
  // Rebaixada só em user_roles: segue admin nos outros stores.
  exAdminDivergente: { roles: ["customer"], perfil: "admin", profileRole: "admin" },
};

const expectStatus = async (p: () => Promise<unknown>, status: number) => {
  const err = await assertRejects(p);
  assertEquals((err as { status: number }).status, status);
};

Deno.test("colaborador comum não altera conta de admin", async () => {
  await expectStatus(() => assertCanManageAccount(fakeAdmin(accounts), "cs", "admin"), 403);
});

Deno.test("colaborador comum não altera conta de outro colaborador", async () => {
  await expectStatus(() => assertCanManageAccount(fakeAdmin(accounts), "cs", "engineer"), 403);
});

Deno.test("colaborador altera conta de cliente", async () => {
  await assertCanManageAccount(fakeAdmin(accounts), "cs", "cliente");
});

Deno.test("admin altera conta da equipe", async () => {
  await assertCanManageAccount(fakeAdmin(accounts), "admin", "engineer");
});

Deno.test("qualquer um altera a própria conta", async () => {
  await assertCanManageAccount(fakeAdmin(accounts), "cs", "cs");
});

Deno.test("admin só em user_roles ou inativo não é admin", async () => {
  assertEquals(await isAdminUser(fakeAdmin(accounts), "admin"), true);
  assertEquals(await isAdminUser(fakeAdmin(accounts), "adminSoEmUserRoles"), false);
  assertEquals(await isAdminUser(fakeAdmin(accounts), "adminInativo"), false);
  await expectStatus(
    () => assertCanManageAccount(fakeAdmin(accounts), "adminSoEmUserRoles", "admin"),
    403,
  );
  await expectStatus(
    () => assertCanManageAccount(fakeAdmin(accounts), "adminInativo", "engineer"),
    403,
  );
});

Deno.test("conta com papel de equipe em qualquer store fica protegida", async () => {
  await expectStatus(
    () => assertCanManageAccount(fakeAdmin(accounts), "cs", "exAdminDivergente"),
    403,
  );
});

Deno.test("erro ao consultar papéis bloqueia (falha fechada)", async () => {
  await expectStatus(
    () => assertCanManageAccount(fakeAdmin(accounts, { fail: true }), "admin", "engineer"),
    500,
  );
  await assertRejects(() => isAdminUser(fakeAdmin(accounts, { fail: true }), "admin"));
});
