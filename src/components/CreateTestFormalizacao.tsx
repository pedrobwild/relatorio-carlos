import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";

export function CreateTestFormalizacao() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);

  const createTestFormalizacao = async () => {
    if (!user) {
      toast.error("Você precisa estar logado para criar uma formalização");
      return;
    }

    setIsCreating(true);

    try {
      // Get user's profile to get customer_org_id
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("customer_org_id, display_name, email")
        .eq("user_id", user.id)
        .single();

      if (profileError || !profile) {
        toast.error("Perfil não encontrado. Faça logout e login novamente.");
        console.error("Profile error:", profileError);
        return;
      }

      // Create the formalization
      const { data: formalization, error: formalizationError } = await supabase
        .from("formalizations")
        .insert({
          customer_org_id: profile.customer_org_id,
          created_by: user.id,
          type: "budget_item_swap",
          status: "draft",
          title: "Teste - Troca de Revestimento",
          summary:
            "Substituição do porcelanato previsto por mármore conforme solicitação.",
          body_md: `## Troca de Item de Orçamento

**Item Original:** Porcelanato 60x60
**Valor Original:** R$ 5.000,00

**Item Substituto:** Mármore Polido
**Valor Substituto:** R$ 10.000,00

### Diferença de Valor
- Acréscimo: **R$ 5.000,00**

### Justificativa
Cliente solicitou upgrade do revestimento.`,
          data: {
            originalItem: "Porcelanato 60x60",
            originalValue: 5000,
            newItem: "Mármore Polido",
            newValue: 10000,
            difference: 5000,
          },
        })
        .select()
        .single();

      if (formalizationError) {
        console.error("Formalization error:", formalizationError);
        toast.error(
          "Erro ao criar formalização: " + formalizationError.message,
        );
        return;
      }

      // Add customer party
      const { error: customerPartyError } = await supabase
        .from("formalization_parties")
        .insert({
          formalization_id: formalization.id,
          party_type: "customer",
          display_name:
            profile.display_name || user.email?.split("@")[0] || "Cliente",
          email: profile.email || user.email,
          user_id: user.id,
          role_label: "Cliente",
          must_sign: true,
        });

      if (customerPartyError) {
        console.error("Customer party error:", customerPartyError);
      }

      // Add company party
      const { error: companyPartyError } = await supabase
        .from("formalization_parties")
        .insert({
          formalization_id: formalization.id,
          party_type: "company",
          display_name: "Bwild Engenharia",
          email: "contato@bwild.com.br",
          role_label: "Empresa",
          must_sign: true,
        });

      if (companyPartyError) {
        console.error("Company party error:", companyPartyError);
      }

      // Add creation event
      await supabase.from("formalization_events").insert({
        formalization_id: formalization.id,
        event_type: "created",
        actor_user_id: user.id,
        meta: { source: "test_data" },
      });

      toast.success("Formalização de teste criada com sucesso!");
      // Refresh the list
      queryClient.invalidateQueries({ queryKey: ["formalizacoes"] });
    } catch (error) {
      console.error("Error creating test formalization:", error);
      toast.error("Erro inesperado ao criar formalização");
    } finally {
      setIsCreating(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Criar Dados de Teste</CardTitle>
        <CardDescription className="text-xs">
          Crie uma formalização real no banco de dados para testar o fluxo de
          assinatura
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          onClick={createTestFormalizacao}
          disabled={isCreating}
          variant="outline"
          size="sm"
          className="w-full"
        >
          {isCreating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Criando...
            </>
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" />
              Criar Formalização de Teste
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
