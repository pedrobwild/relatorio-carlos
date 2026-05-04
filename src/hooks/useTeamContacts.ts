import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TeamContact {
  id: string;
  project_id: string;
  role_type: "engenharia" | "arquitetura" | "relacionamento";
  display_name: string;
  phone: string | null;
  email: string | null;
  crea: string | null;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
}

export type TeamContactInput = Omit<
  TeamContact,
  "id" | "created_at" | "updated_at"
>;

const ROLE_LABELS: Record<string, string> = {
  engenharia: "Engenharia",
  arquitetura: "Arquitetura",
  relacionamento: "Relacionamento",
};

// Default contacts when none exist in database
const getDefaultContacts = (
  projectId: string,
): Omit<TeamContact, "id" | "created_at" | "updated_at">[] => [
  {
    project_id: projectId,
    role_type: "engenharia",
    display_name: "Lucas Tresmondi",
    phone: "(99) 99999-9999",
    email: "lucas@bwild.com.br",
    crea: "5071459470-SP",
    photo_url: null,
  },
  {
    project_id: projectId,
    role_type: "arquitetura",
    display_name: "Lorena Alves",
    phone: "(99) 99999-9999",
    email: "lorena@bwild.com.br",
    crea: null,
    photo_url: null,
  },
  {
    project_id: projectId,
    role_type: "relacionamento",
    display_name: "Victorya Capponi",
    phone: "(99) 99999-9999",
    email: "victorya@bwild.com.br",
    crea: null,
    photo_url: null,
  },
];

export function useTeamContacts(projectId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["teamContacts", projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const { data, error } = await supabase
        .from("project_team_contacts")
        .select("*")
        .eq("project_id", projectId)
        .order("role_type");

      if (error) throw error;
      return (data || []) as TeamContact[];
    },
    enabled: !!projectId,
  });

  // Return merged data with defaults for missing roles
  const contacts = query.data || [];
  const mergedContacts = ["engenharia", "arquitetura", "relacionamento"].map(
    (roleType) => {
      const existing = contacts.find((c) => c.role_type === roleType);
      if (existing) return existing;

      const defaults = getDefaultContacts(projectId || "");
      const defaultContact = defaults.find((d) => d.role_type === roleType);
      return {
        ...defaultContact,
        id: `default-${roleType}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as TeamContact;
    },
  );

  const upsertMutation = useMutation({
    mutationFn: async (contact: TeamContactInput) => {
      const { data, error } = await supabase
        .from("project_team_contacts")
        .upsert(
          {
            project_id: contact.project_id,
            role_type: contact.role_type,
            display_name: contact.display_name,
            phone: contact.phone,
            email: contact.email,
            crea: contact.crea,
            photo_url: contact.photo_url,
          },
          { onConflict: "project_id,role_type" },
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teamContacts", projectId] });
      toast.success("Contato atualizado com sucesso");
    },
    onError: (error) => {
      console.error("Error saving contact:", error);
      toast.error("Erro ao salvar contato");
    },
  });

  const uploadPhotoMutation = useMutation({
    mutationFn: async ({
      file,
      roleType,
    }: {
      file: File;
      roleType: string;
    }) => {
      if (!projectId) throw new Error("Project ID is required");

      const fileExt = file.name.split(".").pop();
      const filePath = `${projectId}/team/${roleType}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("project-documents")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("project-documents").getPublicUrl(filePath);

      return publicUrl;
    },
    onError: (error) => {
      console.error("Error uploading photo:", error);
      toast.error("Erro ao enviar foto");
    },
  });

  return {
    contacts: mergedContacts,
    isLoading: query.isLoading,
    error: query.error,
    upsertContact: upsertMutation.mutateAsync,
    isUpserting: upsertMutation.isPending,
    uploadPhoto: uploadPhotoMutation.mutateAsync,
    isUploading: uploadPhotoMutation.isPending,
    roleLabels: ROLE_LABELS,
  };
}
