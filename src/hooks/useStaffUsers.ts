import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StaffUser {
  id: string;
  nome: string;
  email: string;
  perfil: string;
}

/** Pessoas que podem ser escolhidas como coordenadores de uma obra. */
const COORDENADORES_OBRA_EMAILS = new Set([
  "gabriellafranco@bwild.com.br",
  "bruna.sampaio@bewild.com.br",
]);

export function isCoordenadorObra(user: StaffUser): boolean {
  return COORDENADORES_OBRA_EMAILS.has(user.email.trim().toLowerCase());
}

export function filterCoordenadoresObra(users: StaffUser[]): StaffUser[] {
  return users.filter(isCoordenadorObra);
}

/** Mantém a coordenador atual visível em cadastros antigos, sem oferecer
 * outras pessoas como novas escolhas. */
export function buildCoordenadorOptions(
  users: StaffUser[],
  currentId?: string | null,
): StaffUser[] {
  const elegiveis = filterCoordenadoresObra(users);
  const atual = currentId ? users.find((user) => user.id === currentId) : undefined;
  if (!atual || elegiveis.some((user) => user.id === atual.id)) return elegiveis;
  return [atual, ...elegiveis];
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
