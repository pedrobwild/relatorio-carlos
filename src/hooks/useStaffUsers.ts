import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StaffUser {
  id: string;
  nome: string;
  email: string;
  perfil: string;
}

/** Pessoas que podem ser escolhidas como coordenadoras de uma obra. */
const COORDENADORAS_OBRA_EMAILS = new Set([
  "gabriellafranco@bwild.com.br",
  "bruna.sampaio@bewild.com.br",
]);

export function isCoordenadoraObra(user: StaffUser): boolean {
  return COORDENADORAS_OBRA_EMAILS.has(user.email.trim().toLowerCase());
}

export function filterCoordenadorasObra(users: StaffUser[]): StaffUser[] {
  return users.filter(isCoordenadoraObra);
}

// Mantém alinhado com a função SQL `is_staff()` para que o seletor de
// responsável mostre todos os perfis internos (não só admin/engineer).
const STAFF_ROLES = [
  "admin",
  "engineer",
  "manager",
  "gestor",
  "suprimentos",
  "financeiro",
  "cs",
  "arquitetura",
] as const;

export function useStaffUsers() {
  return useQuery({
    queryKey: ["staff-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users_profile")
        .select("id, nome, email, perfil")
        .in("perfil", STAFF_ROLES)
        .eq("status", "ativo")
        .order("nome");
      if (error) throw error;
      return (data || []) as StaffUser[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
