import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ProjectRole = "owner" | "engineer" | "viewer" | "customer";

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: ProjectRole;
  created_at: string;
  user_email?: string;
  user_name?: string;
}

interface AddMemberParams {
  projectId: string;
  userId: string;
  role: ProjectRole;
}

interface UpdateRoleParams {
  memberId: string;
  role: ProjectRole;
}

interface RemoveMemberParams {
  memberId: string;
}

export function useProjectMembers(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["project-members", projectId];

  // Fetch members of a project
  const {
    data: members = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!projectId) return [];

      const { data, error } = await supabase
        .from("project_members")
        .select(
          `
          id,
          project_id,
          user_id,
          role,
          created_at
        `,
        )
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Fetch user details from profiles
      const userIds = data.map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, email")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

      return data.map((member) => ({
        ...member,
        role: member.role as ProjectRole,
        user_email: profileMap.get(member.user_id)?.email,
        user_name: profileMap.get(member.user_id)?.display_name,
      })) as ProjectMember[];
    },
    enabled: !!projectId,
  });

  // Pre-flight helper: fail fast for UX before hitting RLS
  const assertCanManage = async (targetProjectId: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Não autenticado");
    const { data: canManage } = await supabase.rpc("can_manage_project", {
      _user_id: user.id,
      _project_id: targetProjectId,
    });
    if (!canManage) throw new Error("Sem permissão para gerenciar membros");
    return user;
  };

  // Add a member to the project
  const addMemberMutation = useMutation({
    mutationFn: async ({ projectId: pid, userId, role }: AddMemberParams) => {
      await assertCanManage(pid);

      const { data, error } = await supabase
        .from("project_members")
        .insert({ project_id: pid, user_id: userId, role })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Membro adicionado com sucesso");
    },
    onError: (error: Error) => {
      console.error("Error adding member:", error);
      if (error.message.includes("duplicate")) {
        toast.error("Este usuário já é membro do projeto");
      } else {
        toast.error("Erro ao adicionar membro");
      }
    },
  });

  // Update member role
  const updateRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: UpdateRoleParams) => {
      // Resolve project_id from member row, then pre-flight
      const { data: member, error: lookupErr } = await supabase
        .from("project_members")
        .select("project_id")
        .eq("id", memberId)
        .single();
      if (lookupErr || !member) throw new Error("Membro não encontrado");
      await assertCanManage(member.project_id);

      const { data, error } = await supabase
        .from("project_members")
        .update({ role })
        .eq("id", memberId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Função atualizada com sucesso");
    },
    onError: (error: Error) => {
      console.error("Error updating role:", error);
      toast.error("Erro ao atualizar função");
    },
  });

  // Remove member from project
  const removeMemberMutation = useMutation({
    mutationFn: async ({ memberId }: RemoveMemberParams) => {
      // Resolve project_id from member row, then pre-flight
      const { data: member, error: lookupErr } = await supabase
        .from("project_members")
        .select("project_id")
        .eq("id", memberId)
        .single();
      if (lookupErr || !member) throw new Error("Membro não encontrado");
      await assertCanManage(member.project_id);

      const { error } = await supabase
        .from("project_members")
        .delete()
        .eq("id", memberId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Membro removido com sucesso");
    },
    onError: (error: Error) => {
      console.error("Error removing member:", error);
      toast.error("Erro ao remover membro");
    },
  });

  return {
    members,
    isLoading,
    error,
    refetch,
    addMember: (params: AddMemberParams) =>
      addMemberMutation.mutateAsync(params),
    updateRole: (params: UpdateRoleParams) =>
      updateRoleMutation.mutateAsync(params),
    removeMember: (params: RemoveMemberParams) =>
      removeMemberMutation.mutateAsync(params),
    isAddingMember: addMemberMutation.isPending,
    isUpdatingRole: updateRoleMutation.isPending,
    isRemovingMember: removeMemberMutation.isPending,
  };
}
