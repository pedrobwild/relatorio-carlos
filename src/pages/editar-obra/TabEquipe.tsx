import { useState } from "react";
import {
  Plus,
  User,
  UserPlus,
  X,
  Link2,
  Mail,
  CheckCircle2,
  Loader2,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { ProjectRole } from "@/hooks/useProjectMembers";
import type { Customer, Engineer, AvailableEngineer } from "./types";

const roleDescriptions: Record<string, { label: string; description: string }> =
  {
    owner: {
      label: "Responsável",
      description: "Acesso total: edita cronograma, financeiro e equipe",
    },
    engineer: {
      label: "Engenheiro",
      description: "Gerencia cronograma, vistorias e atividades",
    },
    viewer: {
      label: "Visualizador",
      description: "Apenas visualiza fotos, cronograma e documentos",
    },
    customer: {
      label: "Cliente",
      description: "Acesso ao portal do cliente com acompanhamento",
    },
  };

interface ProjectMember {
  id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  role: string;
}

interface TabEquipeProps {
  projectId: string;
  customer: Customer | null;
  engineers: Engineer[];
  availableEngineers: AvailableEngineer[];
  members: ProjectMember[];
  isAddingMember: boolean;
  isRemovingMember: boolean;
  canManageMembers: boolean;
  onAddMember: (userId: string, role?: ProjectRole) => Promise<void>;
  onRemoveMember: (memberId: string) => Promise<void>;
  onUpdateRole: (memberId: string, role: ProjectRole) => Promise<void>;
  onCustomerLinked: (c: Customer) => void;
  onCustomerAdded: (c: Customer) => void;
}

export function TabEquipe({
  projectId,
  customer,
  engineers,
  availableEngineers,
  members,
  isAddingMember,
  isRemovingMember,
  canManageMembers,
  onAddMember,
  onRemoveMember,
  onUpdateRole,
  onCustomerLinked,
  onCustomerAdded,
}: TabEquipeProps) {
  const [selectedEngineer, setSelectedEngineer] = useState("");
  const [addingEngineer, setAddingEngineer] = useState(false);

  const handleAdd = async () => {
    if (!selectedEngineer) return;
    setAddingEngineer(true);
    try {
      await onAddMember(selectedEngineer, "engineer");
      setSelectedEngineer("");
    } finally {
      setAddingEngineer(false);
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-6">
        {/* Add Member */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Adicionar Membro
            </CardTitle>
            <CardDescription>
              Selecione um engenheiro disponível para adicionar à equipe do
              projeto
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Select
                  value={selectedEngineer}
                  onValueChange={setSelectedEngineer}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um engenheiro..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableEngineers.length > 0 ? (
                      availableEngineers.map((eng) => (
                        <SelectItem key={eng.user_id} value={eng.user_id}>
                          <div className="flex items-center gap-2">
                            <span>
                              {eng.display_name || eng.email || "Sem nome"}
                            </span>
                            <span className="text-muted-foreground text-xs">
                              ({eng.role})
                            </span>
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="_empty" disabled>
                        Nenhum engenheiro disponível
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleAdd}
                disabled={
                  !canManageMembers ||
                  !selectedEngineer ||
                  addingEngineer ||
                  isAddingMember
                }
              >
                {addingEngineer || isAddingMember ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Adicionar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Members */}
        <Card>
          <CardHeader>
            <CardTitle>Membros do Projeto</CardTitle>
            <CardDescription>
              Equipe atribuída ao projeto com suas funções
            </CardDescription>
          </CardHeader>
          <CardContent>
            {members.length > 0 ? (
              <div className="space-y-3">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {member.user_name || "Sem nome"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {member.user_email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={member.role}
                        onValueChange={(v) =>
                          onUpdateRole(member.id, v as ProjectRole)
                        }
                        disabled={!canManageMembers}
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(roleDescriptions).map(
                            ([value, { label, description }]) => (
                              <SelectItem key={value} value={value}>
                                <div className="flex flex-col">
                                  <span>{label}</span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {description}
                                  </span>
                                </div>
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            disabled={!canManageMembers || isRemovingMember}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover membro?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {member.user_name || member.user_email} será
                              removido do projeto.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => onRemoveMember(member.id)}
                            >
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Nenhum membro adicionado. Use o seletor acima para adicionar.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Legacy Engineers */}
        {engineers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Engenheiros Legados</CardTitle>
              <CardDescription>
                Engenheiros atribuídos pelo sistema antigo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {engineers.map((engineer) => (
                  <div
                    key={engineer.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {engineer.display_name || "Sem nome"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {engineer.email}
                        </p>
                      </div>
                    </div>
                    {engineer.is_primary && <Badge>Principal</Badge>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Customer Access */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Acesso do Cliente
            </CardTitle>
            <CardDescription>
              Vincule o cliente à obra para que ele acesse o portal
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {customer ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{customer.customer_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {customer.customer_email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {customer.customer_user_id ? (
                      <Badge className="bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border-[hsl(var(--success))]/20">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Acesso vinculado
                      </Badge>
                    ) : (
                      <CustomerLinkButton
                        customer={customer}
                        projectId={projectId}
                        onLinked={onCustomerLinked}
                      />
                    )}
                  </div>
                </div>
                {!customer.customer_user_id && (
                  <p className="text-xs text-muted-foreground">
                    <Mail className="h-3 w-3 inline mr-1" />O cliente ainda não
                    tem acesso ao portal. Clique em "Vincular Acesso" para
                    buscar a conta pelo e-mail cadastrado, ou o acesso será
                    vinculado automaticamente quando o cliente fizer login.
                  </p>
                )}
              </div>
            ) : (
              <AddCustomerSection
                projectId={projectId}
                onAdded={onCustomerAdded}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}

/** Button to link a customer's user account by looking up their email in profiles */
function CustomerLinkButton({
  customer,
  projectId,
  onLinked,
}: {
  customer: Customer;
  projectId: string;
  onLinked: (c: Customer) => void;
}) {
  const [linking, setLinking] = useState(false);
  const { toast } = useToast();

  const handleLink = async () => {
    setLinking(true);
    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", customer.customer_email.toLowerCase().trim())
        .maybeSingle();
      if (profileError) throw profileError;
      if (!profile) {
        toast({
          title: "Usuário não encontrado",
          description: `Nenhuma conta encontrada para ${customer.customer_email}. O cliente precisa criar uma conta primeiro.`,
          variant: "destructive",
        });
        return;
      }
      const { error: updateError } = await supabase
        .from("project_customers")
        .update({ customer_user_id: profile.user_id })
        .eq("id", customer.id);
      if (updateError) throw updateError;
      onLinked({ ...customer, customer_user_id: profile.user_id });
      toast({
        title: "Acesso vinculado!",
        description: `${customer.customer_name} agora tem acesso ao portal da obra.`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro";
      console.error("Error linking customer:", err);
      toast({
        title: "Erro ao vincular",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLinking(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleLink} disabled={linking}>
      {linking ? (
        <Loader2 className="h-3 w-3 animate-spin mr-1" />
      ) : (
        <Link2 className="h-3 w-3 mr-1" />
      )}
      Vincular Acesso
    </Button>
  );
}

/** Section to add a new customer to a project */
function AddCustomerSection({
  projectId,
  onAdded,
}: {
  projectId: string;
  onAdded: (c: Customer) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [adding, setAdding] = useState(false);
  const { toast } = useToast();

  const handleAdd = async () => {
    if (!name || !email) {
      toast({
        title: "Preencha nome e e-mail do cliente",
        variant: "destructive",
      });
      return;
    }
    setAdding(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", email.toLowerCase().trim())
        .maybeSingle();
      const { data: newCustomer, error } = await supabase
        .from("project_customers")
        .insert({
          project_id: projectId,
          customer_name: name,
          customer_email: email,
          customer_phone: phone || null,
          customer_user_id: profile?.user_id || null,
        })
        .select()
        .single();
      if (error) throw error;
      onAdded(newCustomer);
      toast({
        title: "Cliente adicionado!",
        description: profile?.user_id
          ? `${name} foi adicionado e já possui acesso ao portal.`
          : `${name} foi adicionado. O acesso será vinculado quando ele fizer login.`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro";
      console.error("Error adding customer:", err);
      toast({
        title: "Erro ao adicionar cliente",
        description: message,
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Nenhum cliente vinculado a esta obra. Adicione um cliente para que ele
        possa acessar o portal.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <Label>Nome completo *</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do cliente"
          />
        </div>
        <div>
          <Label>E-mail *</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="cliente@email.com"
          />
        </div>
        <div>
          <Label>Telefone</Label>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(00) 00000-0000"
          />
        </div>
      </div>
      <Button onClick={handleAdd} disabled={adding || !name || !email}>
        {adding ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <UserPlus className="h-4 w-4 mr-2" />
        )}
        Adicionar Cliente
      </Button>
    </div>
  );
}
