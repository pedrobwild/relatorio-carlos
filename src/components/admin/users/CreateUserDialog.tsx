import { useState, useEffect } from "react";
import { Plus, Loader2, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { getAccessToken } from "@/infra/edgeFunctions";
import { projectsRepo } from "@/infra/repositories";
import type { AppRole } from "@/hooks/useUserRole";
import {
  type IdentifierType,
  type ProjectOption,
  formatCPF,
  isValidCPF,
  cpfToEmail,
} from "./types";

export function CreateUserDialog({
  onUserCreated,
}: {
  onUserCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [identifierType, setIdentifierType] = useState<IdentifierType>("email");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<AppRole | undefined>(undefined);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  useEffect(() => {
    if (open) {
      setLoadingProjects(true);
      projectsRepo
        .getStaffProjects()
        .then(({ data }) =>
          setProjects(data?.map((p) => ({ id: p.id, name: p.name })) ?? []),
        )
        .catch((err) => console.error("Error fetching projects:", err))
        .finally(() => setLoadingProjects(false));
    }
  }, [open]);

  const toggleProject = (projectId: string) => {
    setSelectedProjects((prev) =>
      prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId],
    );
  };

  const handleIdentifierChange = (value: string) => {
    setIdentifier(identifierType === "cpf" ? formatCPF(value) : value);
  };

  const getEmailFromIdentifier = (): string => {
    return identifierType === "cpf" ? cpfToEmail(identifier) : identifier;
  };

  const validateIdentifier = (): boolean => {
    if (identifierType === "cpf") {
      if (!isValidCPF(identifier)) {
        toast({
          title: "CPF inválido",
          description: "Por favor, insira um CPF válido",
          variant: "destructive",
        });
        return false;
      }
    } else {
      if (!identifier || !identifier.includes("@")) {
        toast({
          title: "Email inválido",
          description: "Por favor, insira um email válido",
          variant: "destructive",
        });
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateIdentifier()) return;
    if (!role) {
      toast({
        title: "Erro",
        description: "Selecione uma permissão",
        variant: "destructive",
      });
      return;
    }
    if (!password || password.length < 6) {
      toast({
        title: "Erro",
        description: password
          ? "A senha deve ter pelo menos 6 caracteres"
          : "Senha é obrigatória",
        variant: "destructive",
      });
      return;
    }

    const email = getEmailFromIdentifier();
    setLoading(true);
    try {
      const token = await getAccessToken();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            email,
            password,
            display_name:
              displayName ||
              (identifierType === "cpf" ? identifier : email.split("@")[0]),
            role,
            cpf:
              identifierType === "cpf"
                ? identifier.replace(/\D/g, "")
                : undefined,
            project_ids: selectedProjects,
          }),
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Erro ao criar usuário");

      toast({
        title: "Usuário criado",
        description:
          identifierType === "cpf"
            ? `Usuário com CPF ${identifier} foi criado com sucesso`
            : `${email} foi criado com sucesso`,
      });

      setIdentifier("");
      setPassword("");
      setDisplayName("");
      setRole(undefined);
      setIdentifierType("email");
      setSelectedProjects([]);
      setOpen(false);
      onUserCreated();
    } catch (err) {
      console.error("Error creating user:", err);
      toast({
        title: "Erro",
        description:
          err instanceof Error
            ? err.message
            : "Não foi possível criar o usuário",
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
          Novo Usuário
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Novo Usuário</DialogTitle>
          <DialogDescription>
            Preencha os dados para criar uma nova conta de usuário.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tipo de Identificação *</Label>
              <Select
                value={identifierType}
                onValueChange={(v) => {
                  setIdentifierType(v as IdentifierType);
                  setIdentifier("");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="cpf">CPF</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="identifier">
                {identifierType === "email" ? "Email" : "CPF"} *
              </Label>
              <Input
                id="identifier"
                type="text"
                placeholder={
                  identifierType === "email"
                    ? "usuario@exemplo.com"
                    : "000.000.000-00"
                }
                value={identifier}
                onChange={(e) => handleIdentifierChange(e.target.value)}
                required
              />
              {identifierType === "cpf" && (
                <p className="text-xs text-muted-foreground">
                  O usuário fará login usando o CPF como identificador
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha *</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName">Nome de Exibição</Label>
              <Input
                id="displayName"
                type="text"
                placeholder="Nome do usuário"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Permissão *</Label>
              <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma permissão" />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="customer">Cliente</SelectItem>
                  <SelectItem value="engineer">Engenheiro</SelectItem>
                  <SelectItem value="manager">Gestor de Engenharia</SelectItem>
                  <SelectItem value="cs">Customer Success</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {role === "customer" && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Obras Vinculadas
                </Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Selecione as obras que este usuário poderá visualizar
                </p>
                {loadingProjects ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : projects.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-2 text-center">
                    Nenhuma obra disponível
                  </p>
                ) : (
                  <ScrollArea className="h-[150px] rounded-md border p-2">
                    <div className="space-y-2">
                      {projects.map((project) => (
                        <label
                          key={project.id}
                          className="flex items-start gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedProjects.includes(project.id)}
                            onCheckedChange={() => toggleProject(project.id)}
                          />
                          <span className="text-sm leading-tight">
                            {project.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  </ScrollArea>
                )}
                {selectedProjects.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {selectedProjects.length} obra(s) selecionada(s)
                  </p>
                )}
              </div>
            )}
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
              Criar Usuário
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
