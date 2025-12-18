import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Shield, Search, ChevronDown, Check, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import bwildLogo from '@/assets/bwild-logo.png';

const roleLabels: Record<AppRole, string> = {
  admin: 'Administrador',
  engineer: 'Engenheiro',
  customer: 'Cliente',
};

const roleColors: Record<AppRole, string> = {
  admin: 'bg-red-500/10 text-red-600 border-red-500/20',
  engineer: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  customer: 'bg-green-500/10 text-green-600 border-green-500/20',
};

function RoleSelector({ 
  user, 
  onRoleChange 
}: { 
  user: UserWithRole; 
  onRoleChange: (userId: string, role: AppRole) => void;
}) {
  const roles: AppRole[] = ['admin', 'engineer', 'customer'];

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

function UserCard({ 
  user, 
  onRoleChange 
}: { 
  user: UserWithRole; 
  onRoleChange: (userId: string, role: AppRole) => void;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate">
              {user.display_name || user.email}
            </p>
            <p className="text-sm text-muted-foreground truncate">{user.email}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Desde {format(new Date(user.created_at), "dd 'de' MMM, yyyy", { locale: ptBR })}
            </p>
          </div>
          <RoleSelector user={user} onRoleChange={onRoleChange} />
        </div>
      </CardContent>
    </Card>
  );
}

function CreateUserDialog({ onUserCreated }: { onUserCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<AppRole>('customer');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: 'Erro',
        description: 'Email e senha são obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: 'Erro',
        description: 'A senha deve ter pelo menos 6 caracteres',
        variant: 'destructive',
      });
      return;
    }

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
            display_name: displayName || email.split('@')[0],
            role,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao criar usuário');
      }

      toast({
        title: 'Usuário criado',
        description: `${email} foi criado com sucesso`,
      });

      // Reset form
      setEmail('');
      setPassword('');
      setDisplayName('');
      setRole('customer');
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
          <span className="hidden sm:inline">Novo Usuário</span>
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
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="usuario@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
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
                  <SelectItem value="customer">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={roleColors.customer}>Cliente</Badge>
                    </div>
                  </SelectItem>
                  <SelectItem value="engineer">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={roleColors.engineer}>Engenheiro</Badge>
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={roleColors.admin}>Administrador</Badge>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
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

export default function Admin() {
  const navigate = useNavigate();
  const { users, loading, error, updateUserRole, refetch } = useUsers();
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
  const engineerCount = users.filter(u => u.role === 'engineer').length;
  const customerCount = users.filter(u => u.role === 'customer').length;

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    await updateUserRole(userId, newRole);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="container max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigate('/gestao')}
                className="shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <img src={bwildLogo} alt="Bwild" className="h-8" />
              <div>
                <h1 className="text-h3 font-bold">Administração</h1>
                <p className="text-tiny text-muted-foreground">
                  Gerenciar usuários e permissões
                </p>
              </div>
            </div>
            <CreateUserDialog onUserCreated={refetch} />
          </div>
        </div>
      </header>

      <main className="container max-w-6xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Card className="p-4">
            <p className="text-tiny text-muted-foreground uppercase tracking-wider">Total</p>
            <p className="text-h2 font-bold">{users.length}</p>
          </Card>
          <Card className="p-4">
            <p className="text-tiny text-muted-foreground uppercase tracking-wider">Admins</p>
            <p className="text-h2 font-bold text-red-600">{adminCount}</p>
          </Card>
          <Card className="p-4">
            <p className="text-tiny text-muted-foreground uppercase tracking-wider">Engenheiros</p>
            <p className="text-h2 font-bold text-blue-600">{engineerCount}</p>
          </Card>
          <Card className="p-4">
            <p className="text-tiny text-muted-foreground uppercase tracking-wider">Clientes</p>
            <p className="text-h2 font-bold text-green-600">{customerCount}</p>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
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
                    <TableHead className="text-right">Role</TableHead>
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
                      <TableCell className="text-right">
                        <RoleSelector user={user} onRoleChange={handleRoleChange} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
