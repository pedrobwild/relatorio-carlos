import { useState, useEffect } from 'react';
import { Users, Search, ChevronDown, Check, Plus, Loader2, Trash2, Pencil, KeyRound, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useUsers, UserWithRole } from '@/hooks/useUsers';
import { AppRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const roleLabels: Record<AppRole, string> = {
  admin: 'Administrador',
  manager: 'Gestor de Engenharia',
  engineer: 'Engenheiro',
  customer: 'Cliente',
};

const roleColors: Record<AppRole, string> = {
  admin: 'bg-destructive/10 text-destructive border-destructive/20',
  manager: 'bg-accent/10 text-accent-foreground border-accent/20',
  engineer: 'bg-primary/10 text-primary border-primary/20',
  customer: 'bg-success/10 text-[hsl(var(--success))] border-success/20',
};

function RoleSelector({ 
  user, 
  onRoleChange 
}: { 
  user: UserWithRole; 
  onRoleChange: (userId: string, role: AppRole) => void;
}) {
  const roles: AppRole[] = ['admin', 'manager', 'engineer', 'customer'];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Badge variant="outline" className={roleColors[user.role]}>
            {roleLabels[user.role]}
          </Badge>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {roles.map((role) => (
          <DropdownMenuItem
            key={role}
            onClick={() => onRoleChange(user.id, role)}
            className="gap-2"
          >
            {user.role === role && <Check className="h-4 w-4" />}
            <Badge variant="outline" className={roleColors[role]}>
              {roleLabels[role]}
            </Badge>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EditUserDialog({ 
  user, 
  onSave 
}: { 
  user: UserWithRole; 
  onSave: (userId: string, data: { display_name?: string; email?: string }) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [displayName, setDisplayName] = useState(user.display_name || '');
  const [email, setEmail] = useState(user.email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const success = await onSave(user.id, {
      display_name: displayName,
      email,
    });
    
    if (success) {
      setOpen(false);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-11 w-11 min-h-[44px] min-w-[44px]">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Usuário</DialogTitle>
          <DialogDescription>
            Atualize os dados do usuário {user.email}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-displayName">Nome de Exibição</Label>
              <Input
                id="edit-displayName"
                type="text"
                placeholder="Nome do usuário"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                placeholder="usuario@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ 
  user, 
  onReset 
}: { 
  user: UserWithRole; 
  onReset: (userId: string, newPassword: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword.length < 6) {
      toast({
        title: 'Erro',
        description: 'A senha deve ter pelo menos 6 caracteres',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Erro',
        description: 'As senhas não coincidem',
        variant: 'destructive',
      });
      return;
    }
    
    setLoading(true);
    const success = await onReset(user.id, newPassword);
    
    if (success) {
      setNewPassword('');
      setConfirmPassword('');
      setOpen(false);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-11 w-11 min-h-[44px] min-w-[44px]" title="Redefinir senha">
          <KeyRound className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Redefinir Senha</DialogTitle>
          <DialogDescription>
            Defina uma nova senha para o usuário {user.display_name || user.email}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova Senha</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar Senha</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Digite a senha novamente"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Redefinir Senha
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UserCard({ 
  user, 
  onRoleChange,
  onDelete,
  onEdit,
  onResetPassword,
}: { 
  user: UserWithRole; 
  onRoleChange: (userId: string, role: AppRole) => void;
  onDelete: (userId: string) => void;
  onEdit: (userId: string, data: { display_name?: string; email?: string }) => Promise<boolean>;
  onResetPassword: (userId: string, newPassword: string) => Promise<boolean>;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate">
              {user.display_name || user.email}
            </p>
            <p className="text-sm text-muted-foreground truncate">{user.email}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Desde {format(new Date(user.created_at), "dd 'de' MMM, yyyy", { locale: ptBR })}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <RoleSelector user={user} onRoleChange={onRoleChange} />
            <EditUserDialog user={user} onSave={onEdit} />
            <ResetPasswordDialog user={user} onReset={onResetPassword} />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-11 w-11 min-h-[44px] min-w-[44px] text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Deletar usuário?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita. O usuário <strong>{user.email}</strong> será permanentemente removido.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => onDelete(user.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Deletar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type IdentifierType = 'email' | 'cpf';

function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function isValidCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1+$/.test(digits)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(digits[9])) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(digits[10])) return false;
  
  return true;
}

function cpfToEmail(cpf: string): string {
  const digits = cpf.replace(/\D/g, '');
  return `${digits}@cpf.bwild.com.br`;
}

interface ProjectOption {
  id: string;
  name: string;
}

function CreateUserDialog({ onUserCreated }: { onUserCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [identifierType, setIdentifierType] = useState<IdentifierType>('email');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<AppRole | undefined>(undefined);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Fetch projects when dialog opens
  useEffect(() => {
    if (open) {
      fetchProjects();
    }
  }, [open]);

  const fetchProjects = async () => {
    setLoadingProjects(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      setProjects(data || []);
    } catch (err) {
      console.error('Error fetching projects:', err);
    } finally {
      setLoadingProjects(false);
    }
  };

  const toggleProject = (projectId: string) => {
    setSelectedProjects(prev => 
      prev.includes(projectId) 
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    );
  };

  const handleIdentifierChange = (value: string) => {
    if (identifierType === 'cpf') {
      setIdentifier(formatCPF(value));
    } else {
      setIdentifier(value);
    }
  };

  const getEmailFromIdentifier = (): string => {
    if (identifierType === 'cpf') {
      return cpfToEmail(identifier);
    }
    return identifier;
  };

  const validateIdentifier = (): boolean => {
    if (identifierType === 'cpf') {
      if (!isValidCPF(identifier)) {
        toast({
          title: 'CPF inválido',
          description: 'Por favor, insira um CPF válido',
          variant: 'destructive',
        });
        return false;
      }
    } else {
      if (!identifier || !identifier.includes('@')) {
        toast({
          title: 'Email inválido',
          description: 'Por favor, insira um email válido',
          variant: 'destructive',
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
        title: 'Erro',
        description: 'Selecione uma permissão',
        variant: 'destructive',
      });
      return;
    }

    if (!password) {

    if (password.length < 6) {
      toast({
        title: 'Erro',
        description: 'A senha deve ter pelo menos 6 caracteres',
        variant: 'destructive',
      });
      return;
    }

    const email = getEmailFromIdentifier();

    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData.session?.access_token}`,
          },
          body: JSON.stringify({
            email,
            password,
            display_name: displayName || (identifierType === 'cpf' ? identifier : email.split('@')[0]),
            role,
            cpf: identifierType === 'cpf' ? identifier.replace(/\D/g, '') : undefined,
            project_ids: selectedProjects,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao criar usuário');
      }

      toast({
        title: 'Usuário criado',
        description: identifierType === 'cpf' 
          ? `Usuário com CPF ${identifier} foi criado com sucesso`
          : `${email} foi criado com sucesso`,
      });

      // Reset form
      setIdentifier('');
      setPassword('');
      setDisplayName('');
      setRole('customer');
      setIdentifierType('email');
      setSelectedProjects([]);
      setOpen(false);
      onUserCreated();

    } catch (err) {
      console.error('Error creating user:', err);
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Não foi possível criar o usuário',
        variant: 'destructive',
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
                  setIdentifier('');
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="cpf">CPF</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="identifier">
                {identifierType === 'email' ? 'Email' : 'CPF'} *
              </Label>
              <Input
                id="identifier"
                type="text"
                placeholder={identifierType === 'email' ? 'usuario@exemplo.com' : '000.000.000-00'}
                value={identifier}
                onChange={(e) => handleIdentifierChange(e.target.value)}
                required
              />
              {identifierType === 'cpf' && (
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
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Cliente</SelectItem>
                  <SelectItem value="engineer">Engenheiro</SelectItem>
                  <SelectItem value="manager">Gestor de Engenharia</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Project Selection - Show for customer role */}
            {role === 'customer' && (
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
                          <span className="text-sm leading-tight">{project.name}</span>
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
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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

export function UsersTab() {
  const { users, loading, error, updateUserRole, updateUserProfile, deleteUser, resetUserPassword, refetch } = useUsers();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<AppRole | null>(null);

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.display_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = !roleFilter || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const adminCount = users.filter(u => u.role === 'admin').length;
  const managerCount = users.filter(u => u.role === 'manager').length;
  const engineerCount = users.filter(u => u.role === 'engineer').length;
  const customerCount = users.filter(u => u.role === 'customer').length;

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    await updateUserRole(userId, newRole);
  };

  const handleDelete = async (userId: string) => {
    await deleteUser(userId);
  };

  const handleEdit = async (userId: string, data: { display_name?: string; email?: string }) => {
    return await updateUserProfile(userId, data);
  };

  const handleResetPassword = async (userId: string, newPassword: string) => {
    return await resetUserPassword(userId, newPassword);
  };

  return (
    <div className="space-y-6">
      {/* Header with action */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Gerenciar Usuários</h2>
        <CreateUserDialog onUserCreated={refetch} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="p-4">
          <p className="text-tiny text-muted-foreground uppercase tracking-wider">Total</p>
          <p className="text-h2 font-bold">{users.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-tiny text-muted-foreground uppercase tracking-wider">Admins</p>
          <p className="text-h2 font-bold text-destructive">{adminCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-tiny text-muted-foreground uppercase tracking-wider">Gestores</p>
          <p className="text-h2 font-bold text-secondary-foreground">{managerCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-tiny text-muted-foreground uppercase tracking-wider">Engenheiros</p>
          <p className="text-h2 font-bold text-primary">{engineerCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-tiny text-muted-foreground uppercase tracking-wider">Clientes</p>
          <p className="text-h2 font-bold text-accent-foreground">{customerCount}</p>
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
          <Button
            variant={roleFilter === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => setRoleFilter(null)}
          >
            Todos
          </Button>
          <Button
            variant={roleFilter === 'admin' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setRoleFilter('admin')}
          >
            Admins
          </Button>
          <Button
            variant={roleFilter === 'engineer' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setRoleFilter('engineer')}
          >
            Engenheiros
          </Button>
          <Button
            variant={roleFilter === 'manager' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setRoleFilter('manager')}
          >
            Gestores
          </Button>
          <Button
            variant={roleFilter === 'customer' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setRoleFilter('customer')}
          >
            Clientes
          </Button>
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
          <p className="text-muted-foreground">Erro ao carregar usuários: {error}</p>
        </Card>
      ) : filteredUsers.length === 0 ? (
        <Card className="p-8 text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">
            {searchTerm || roleFilter ? 'Nenhum usuário encontrado' : 'Nenhum usuário cadastrado'}
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
                      {user.display_name || '—'}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      {format(new Date(user.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <RoleSelector user={user} onRoleChange={handleRoleChange} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <EditUserDialog user={user} onSave={handleEdit} />
                        <ResetPasswordDialog user={user} onReset={handleResetPassword} />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-11 w-11 min-h-[44px] min-w-[44px] text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Deletar usuário?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação não pode ser desfeita. O usuário <strong>{user.email}</strong> será permanentemente removido.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleDelete(user.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Deletar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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
