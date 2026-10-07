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

type Roles = Record<string, string[]>;

function fakeAdmin(roles: Roles, opts: { failRpc?: boolean } = {}) {
  const staff = (id: string) => (roles[id] ?? []).some((r) => r !== "customer");
  return {
    rpc(fn: string, args: Record<string, string>) {
      if (opts.failRpc) {
        return Promise.resolve({ data: null, error: { message: "boom" } });
      }
      if (fn === "is_staff") {
        return Promise.resolve({ data: staff(args._user_id), error: null });
      }
      if (fn === "has_role") {
        const has = (roles[args._user_id] ?? []).includes(args._role);
        return Promise.resolve({ data: has, error: null });
      }
      return Promise.resolve({ data: null, error: { message: "unknown rpc" } });
    },
  } as unknown as Parameters<typeof assertCanManageAccount>[0];
}

const roles: Roles = {
  admin: ["admin"],
  cs: ["cs"],
  engineer: ["engineer"],
  cliente: ["customer"],
};

Deno.test("colaborador comum não altera conta de admin", async () => {
  const err = await assertRejects(() =>
    assertCanManageAccount(fakeAdmin(roles), "cs", "admin")
  );
  assertEquals((err as { status: number }).status, 403);
});

Deno.test("colaborador comum não altera conta de outro colaborador", async () => {
  const err = await assertRejects(() =>
    assertCanManageAccount(fakeAdmin(roles), "cs", "engineer")
  );
  assertEquals((err as { status: number }).status, 403);
});

Deno.test("colaborador altera conta de cliente", async () => {
  await assertCanManageAccount(fakeAdmin(roles), "cs", "cliente");
});

Deno.test("admin altera conta da equipe", async () => {
  await assertCanManageAccount(fakeAdmin(roles), "admin", "engineer");
});

Deno.test("qualquer um altera a própria conta", async () => {
  await assertCanManageAccount(fakeAdmin(roles), "cs", "cs");
});

Deno.test("erro ao consultar papéis bloqueia (falha fechada)", async () => {
  const err = await assertRejects(() =>
    assertCanManageAccount(fakeAdmin(roles, { failRpc: true }), "admin", "engineer")
  );
  assertEquals((err as { status: number }).status, 500);
  await assertRejects(() => isAdminUser(fakeAdmin(roles, { failRpc: true }), "admin"));
});
