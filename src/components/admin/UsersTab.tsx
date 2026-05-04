import { useState } from "react";
import { Users, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useUsers } from "@/hooks/useUsers";
import type { AppRole } from "@/hooks/useUserRole";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CreateUserDialog } from "./users/CreateUserDialog";
import { UserCard } from "./users/UserCard";
import { RoleSelector } from "./users/RoleSelector";
import { EditUserDialog } from "./users/EditUserDialog";
import { ResetPasswordDialog } from "./users/ResetPasswordDialog";
import { DeleteUserAlert } from "./users/DeleteUserAlert";
import { matchesSearch } from "@/lib/searchNormalize";

export function UsersTab() {
  const {
    users,
    loading,
    error,
    updateUserRole,
    updateUserProfile,
    deleteUser,
    resetUserPassword,
    refetch,
  } = useUsers();
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<AppRole | null>(null);

  const filteredUsers = users.filter((user) => {
    const matchesQuery = matchesSearch(searchTerm, [
      user.email,
      user.display_name,
    ]);
    const matchesRole = !roleFilter || user.role === roleFilter;
    return matchesQuery && matchesRole;
  });

  const adminCount = users.filter((u) => u.role === "admin").length;
  const managerCount = users.filter((u) => u.role === "manager").length;
  const engineerCount = users.filter((u) => u.role === "engineer").length;
  const customerCount = users.filter((u) => u.role === "customer").length;

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    await updateUserRole(userId, newRole);
  };

  const handleDelete = async (userId: string) => {
    await deleteUser(userId);
  };

  const handleEdit = async (
    userId: string,
    data: { display_name?: string; email?: string },
  ) => {
    return await updateUserProfile(userId, data);
  };

  const handleResetPassword = async (userId: string, newPassword: string) => {
    return await resetUserPassword(userId, newPassword);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Gerenciar Usuários</h2>
        <CreateUserDialog onUserCreated={refetch} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="p-4">
          <p className="text-tiny text-muted-foreground uppercase tracking-wider">
            Total
          </p>
          <p className="text-h2 font-bold">{users.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-tiny text-muted-foreground uppercase tracking-wider">
            Admins
          </p>
          <p className="text-h2 font-bold text-destructive">{adminCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-tiny text-muted-foreground uppercase tracking-wider">
            Gestores
          </p>
          <p className="text-h2 font-bold text-secondary-foreground">
            {managerCount}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-tiny text-muted-foreground uppercase tracking-wider">
            Engenheiros
          </p>
          <p className="text-h2 font-bold text-primary">{engineerCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-tiny text-muted-foreground uppercase tracking-wider">
            Clientes
          </p>
          <p className="text-h2 font-bold text-accent-foreground">
            {customerCount}
          </p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {([null, "admin", "engineer", "manager", "customer"] as const).map(
            (r) => (
              <Button
                key={r ?? "all"}
                variant={roleFilter === r ? "default" : "outline"}
                size="sm"
                onClick={() => setRoleFilter(r)}
              >
                {r === null
                  ? "Todos"
                  : r === "admin"
                    ? "Admins"
                    : r === "engineer"
                      ? "Engenheiros"
                      : r === "manager"
                        ? "Gestores"
                        : "Clientes"}
              </Button>
            ),
          )}
        </div>
      </div>

      {/* Users List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="h-20 animate-pulse bg-muted" />
          ))}
        </div>
      ) : error ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            Erro ao carregar usuários: {error}
          </p>
        </Card>
      ) : filteredUsers.length === 0 ? (
        <Card className="p-8 text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">
            {searchTerm || roleFilter
              ? "Nenhum usuário encontrado"
              : "Nenhum usuário cadastrado"}
          </p>
        </Card>
      ) : (
        <>
          {/* Mobile: Cards */}
          <div className="sm:hidden space-y-3">
            {filteredUsers.map((user) => (
              <UserCard
                key={user.id}
                user={user}
                onRoleChange={handleRoleChange}
                onDelete={handleDelete}
                onEdit={handleEdit}
                onResetPassword={handleResetPassword}
              />
            ))}
          </div>

          {/* Desktop: Table */}
          <Card className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Data de Cadastro</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.display_name || "—"}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      {format(new Date(user.created_at), "dd/MM/yyyy", {
                        locale: ptBR,
                      })}
                    </TableCell>
                    <TableCell>
                      <RoleSelector
                        user={user}
                        onRoleChange={handleRoleChange}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <EditUserDialog user={user} onSave={handleEdit} />
                        <ResetPasswordDialog
                          user={user}
                          onReset={handleResetPassword}
                        />
                        <DeleteUserAlert
                          email={user.email}
                          onDelete={() => handleDelete(user.id)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
