import { useState } from "react";
import { Plus, Building2, Calendar, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { projectsRepo } from "@/infra/repositories";
import { toast } from "@/hooks/use-toast";

interface FormData {
  name: string;
  unit_name: string;
  address: string;
  planned_start_date: string;
  planned_end_date: string;
  contract_value: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
}

const EMPTY_FORM: FormData = {
  name: "",
  unit_name: "",
  address: "",
  planned_start_date: "",
  planned_end_date: "",
  contract_value: "",
  customer_name: "",
  customer_email: "",
  customer_phone: "",
};

export function CreateObraDialog({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendInvite, setSendInvite] = useState(true);
  const [formData, setFormData] = useState<FormData>({ ...EMPTY_FORM });

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData({ ...EMPTY_FORM });
    setSendInvite(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({
        title: "Erro",
        description: "Você precisa estar logado",
        variant: "destructive",
      });
      return;
    }

    if (
      !formData.name ||
      !formData.planned_start_date ||
      !formData.planned_end_date
    ) {
      toast({
        title: "Erro",
        description: "Preencha os campos obrigatórios da obra",
        variant: "destructive",
      });
      return;
    }

    if (!formData.customer_name || !formData.customer_email) {
      toast({
        title: "Erro",
        description: "Dados do cliente são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await projectsRepo.createProjectWithCustomer({
        name: formData.name,
        unit_name: formData.unit_name || null,
        address: formData.address || null,
        planned_start_date: formData.planned_start_date,
        planned_end_date: formData.planned_end_date,
        contract_value: formData.contract_value
          ? parseFloat(formData.contract_value)
          : null,
        created_by: user.id,
        customer_name: formData.customer_name,
        customer_email: formData.customer_email,
        customer_phone: formData.customer_phone || null,
        invitation_sent_at: sendInvite ? new Date().toISOString() : null,
      });

      if (error) throw error;

      toast({
        title: "Obra cadastrada!",
        description: sendInvite
          ? `Convite enviado para ${formData.customer_email}`
          : "Cliente cadastrado sem envio de convite",
      });

      resetForm();
      setOpen(false);
      onCreated();
    } catch (err: any) {
      console.error("Error creating project:", err);
      toast({
        title: "Erro ao cadastrar",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nova Obra
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cadastrar Nova Obra</DialogTitle>
          <DialogDescription>
            Preencha os dados do projeto e do cliente.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Project Info */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Dados da Obra
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label htmlFor="name">Nome do Projeto *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="Ex: Hub Brooklyn"
                  required
                />
              </div>
              <div>
                <Label htmlFor="unit_name">Unidade</Label>
                <Input
                  id="unit_name"
                  value={formData.unit_name}
                  onChange={(e) => handleChange("unit_name", e.target.value)}
                  placeholder="Ex: Apartamento 502"
                />
              </div>
              <div>
                <Label htmlFor="address">Endereço</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                  placeholder="Endereço completo"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Dates */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Cronograma
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="planned_start_date">Data de Início *</Label>
                <Input
                  id="planned_start_date"
                  type="date"
                  value={formData.planned_start_date}
                  onChange={(e) =>
                    handleChange("planned_start_date", e.target.value)
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="planned_end_date">Data de Término *</Label>
                <Input
                  id="planned_end_date"
                  type="date"
                  value={formData.planned_end_date}
                  onChange={(e) =>
                    handleChange("planned_end_date", e.target.value)
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="contract_value">Valor do Contrato (R$)</Label>
                <Input
                  id="contract_value"
                  type="number"
                  step="0.01"
                  value={formData.contract_value}
                  onChange={(e) =>
                    handleChange("contract_value", e.target.value)
                  }
                  placeholder="0,00"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Customer Info */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <User className="h-4 w-4" />
              Dados do Cliente
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label htmlFor="customer_name">Nome Completo *</Label>
                <Input
                  id="customer_name"
                  value={formData.customer_name}
                  onChange={(e) =>
                    handleChange("customer_name", e.target.value)
                  }
                  placeholder="Nome do cliente"
                  required
                />
              </div>
              <div>
                <Label htmlFor="customer_email">E-mail *</Label>
                <Input
                  id="customer_email"
                  type="email"
                  value={formData.customer_email}
                  onChange={(e) =>
                    handleChange("customer_email", e.target.value)
                  }
                  placeholder="cliente@email.com"
                  required
                />
              </div>
              <div>
                <Label htmlFor="customer_phone">Telefone</Label>
                <Input
                  id="customer_phone"
                  value={formData.customer_phone}
                  onChange={(e) =>
                    handleChange("customer_phone", e.target.value)
                  }
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="send_invite"
                  checked={sendInvite}
                  onChange={(e) => setSendInvite(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                <Label
                  htmlFor="send_invite"
                  className="text-caption cursor-pointer"
                >
                  Enviar convite de acesso por e-mail ao cadastrar
                </Label>
              </div>
              <p className="text-xs text-muted-foreground ml-7">
                O cliente receberá um e-mail com link para criar sua conta e
                acompanhar fotos, cronograma e documentos da obra pelo portal.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Cadastrar Obra
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
