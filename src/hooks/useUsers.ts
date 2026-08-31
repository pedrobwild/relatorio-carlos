import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole, AppRole } from "./useUserRole";
import { toast } from "@/hooks/use-toast";
import { describeSaveError } from "@/lib/saveErrors";

export interface UserWithRole {
  id: string;
  email: string;
  display_name: string | null;
  role: AppRole;
  created_at: string;
  customer_org_id: string | null;
}

export function useUsers() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isAdmin } = useUserRole();

  const fetchUsers = async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Fetch profiles with their roles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, display_name, email, customer_org_id, created_at");

      if (profilesError) throw profilesError;

      // Fetch roles for all users
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Combine profiles with roles
      const usersWithRoles: UserWithRole[] = (profiles || []).map((profile) => {
        const userRole = roles?.find((r) => r.user_id === profile.user_id);
        return {
          id: profile.user_id,
          email: profile.email || "",
          display_name: profile.display_name,
          role: (userRole?.role as AppRole) || "customer",
          created_at: profile.created_at,
          customer_org_id: profile.customer_org_id,
        };
      });

      setUsers(usersWithRoles);
      setError(null);
    } catch (err) {
      console.error("Error fetching users:", err);
      setError(
        err instanceof Error ? err.message : "Erro ao carregar usuários",
      );
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: AppRole) => {
    try {
      // RPC atômica: escreve os TRÊS stores de papel numa só transação
      // (user_roles, users_profile.perfil e profiles.role). Ver a migração
      // 20260831170000_admin_set_user_role_atomico.sql.
      //
      // Antes daqui saía um `update user_roles set role = X where user_id = Y`,
      // que gravava só o store que a UI lê. Toda promoção feita nesta tela
      // nascia divergente dos gates do banco — foi assim que a Bianca virou
      // admin na tela e continuou 'engineer' no banco, sem conseguir salvar
      // nenhum cronograma. E, sem filtrar a linha, o UPDATE ainda violava
      // UNIQUE (user_id, role) para quem tem mais de um papel.
      const response = await supabase.rpc("admin_set_user_role" as any, {
        p_user_id: userId,
        p_role: newRole,
      });

      if (response.error) {
        throw Object.assign(
          new Error(response.error.message || "Falha ao atualizar o papel"),
          response.error,
          { status: response.status, statusText: response.statusText },
        );
      }

      // Update local state
      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, role: newRole } : user,
        ),
      );

      toast({
        title: "Papel atualizado",
        description: `Usuário atualizado para ${newRole}`,
      });

      return true;
    } catch (err) {
      console.error("Error updating role:", err);
      // A RPC devolve o motivo em PT-BR ("Apenas administradores podem alterar
      // papéis de usuário"); mostrar isso é mais útil que um texto genérico.
      toast({
        title: "Erro",
        description: describeSaveError(err).message,
        variant: "destructive",
      });
      return false;
    }
  };

  const updateUserProfile = async (
    userId: string,
    data: { display_name?: string; email?: string },
  ) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session?.access_token}`,
          },
          body: JSON.stringify({ user_id: userId, ...data }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro ao atualizar usuário");
      }

      // Update local state
      setUsers((prev) =>
        prev.map((user) => (user.id === userId ? { ...user, ...data } : user)),
      );

      toast({
        title: "Usuário atualizado",
        description: "Os dados foram atualizados com sucesso",
      });

      return true;
    } catch (err) {
      console.error("Error updating user:", err);
      toast({
        title: "Erro",
        description:
          err instanceof Error
            ? err.message
            : "Não foi possível atualizar o usuário",
        variant: "destructive",
      });
      return false;
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session?.access_token}`,
          },
          body: JSON.stringify({ user_id: userId }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro ao deletar usuário");
      }

      // Update local state
      setUsers((prev) => prev.filter((user) => user.id !== userId));

      toast({
        title: "Usuário deletado",
        description: "O usuário foi removido com sucesso",
      });

      return true;
    } catch (err) {
      console.error("Error deleting user:", err);
      toast({
        title: "Erro",
        description:
          err instanceof Error
            ? err.message
            : "Não foi possível deletar o usuário",
        variant: "destructive",
      });
      return false;
    }
  };

  const resetUserPassword = async (userId: string, newPassword: string) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-user-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session?.access_token}`,
          },
          body: JSON.stringify({ user_id: userId, new_password: newPassword }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro ao redefinir senha");
      }

      toast({
        title: "Senha redefinida",
        description: "A senha do usuário foi alterada com sucesso",
      });

      return true;
    } catch (err) {
      console.error("Error resetting password:", err);
      toast({
        title: "Erro",
        description:
          err instanceof Error
            ? err.message
            : "Não foi possível redefinir a senha",
        variant: "destructive",
      });
      return false;
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [isAdmin]);

  return {
    users,
    loading,
    error,
    refetch: fetchUsers,
    updateUserRole,
    updateUserProfile,
    deleteUser,
    resetUserPassword,
  };
}
