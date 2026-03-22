import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, Search, Calendar, User, Settings, Trash2, Eye, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useProjectsQuery } from '@/hooks/useProjectsQuery';
import type { ProjectWithCustomer } from '@/infra/repositories';
import { projectsRepo } from '@/infra/repositories';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseLocalDate } from '@/lib/activityStatus';

const statusColors: Record<string, string> = {
  active: 'bg-success/10 text-[hsl(var(--success))] border-success/20',
  completed: 'bg-primary/10 text-primary border-primary/20',
  paused: 'bg-warning/10 text-[hsl(var(--warning))] border-warning/20',
  cancelled: 'bg-destructive/10 text-destructive border-destructive/20',
};

const statusLabels: Record<string, string> = {
  active: 'Em andamento',
  completed: 'Concluída',
  paused: 'Pausada',
  cancelled: 'Cancelada',
};

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

function CreateObraDialog({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendInvite, setSendInvite] = useState(true);
  
  const [formData, setFormData] = useState<FormData>({
    name: '',
    unit_name: '',
    address: '',
    planned_start_date: '',
    planned_end_date: '',
    contract_value: '',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
  });

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData({
      name: '',
      unit_name: '',
      address: '',
      planned_start_date: '',
      planned_end_date: '',
      contract_value: '',
      customer_name: '',
      customer_email: '',
      customer_phone: '',
    });
    setSendInvite(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({ title: 'Erro', description: 'Você precisa estar logado', variant: 'destructive' });
      return;
    }

    if (!formData.name || !formData.planned_start_date || !formData.planned_end_date) {
      toast({ title: 'Erro', description: 'Preencha os campos obrigatórios da obra', variant: 'destructive' });
      return;
    }

    if (!formData.customer_name || !formData.customer_email) {
      toast({ title: 'Erro', description: 'Dados do cliente são obrigatórios', variant: 'destructive' });
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
        contract_value: formData.contract_value ? parseFloat(formData.contract_value) : null,
        created_by: user.id,
        customer_name: formData.customer_name,
        customer_email: formData.customer_email,
        customer_phone: formData.customer_phone || null,
        invitation_sent_at: sendInvite ? new Date().toISOString() : null,
      });

      if (error) throw error;

      toast({ 
        title: 'Obra cadastrada!', 
        description: sendInvite 
          ? `Convite enviado para ${formData.customer_email}` 
          : 'Cliente cadastrado sem envio de convite'
      });

      resetForm();
      setOpen(false);
      onCreated();
    } catch (err: any) {
      console.error('Error creating project:', err);
      toast({ 
        title: 'Erro ao cadastrar', 
        description: err.message, 
        variant: 'destructive' 
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
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Ex: Hub Brooklyn"
                  required
                />
              </div>
              <div>
                <Label htmlFor="unit_name">Unidade</Label>
                <Input
                  id="unit_name"
                  value={formData.unit_name}
                  onChange={(e) => handleChange('unit_name', e.target.value)}
                  placeholder="Ex: Apartamento 502"
                />
              </div>
              <div>
                <Label htmlFor="address">Endereço</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
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
                  onChange={(e) => handleChange('planned_start_date', e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="planned_end_date">Data de Término *</Label>
                <Input
                  id="planned_end_date"
                  type="date"
                  value={formData.planned_end_date}
                  onChange={(e) => handleChange('planned_end_date', e.target.value)}
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
                  onChange={(e) => handleChange('contract_value', e.target.value)}
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
                  onChange={(e) => handleChange('customer_name', e.target.value)}
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
                  onChange={(e) => handleChange('customer_email', e.target.value)}
                  placeholder="cliente@email.com"
                  required
                />
              </div>
              <div>
                <Label htmlFor="customer_phone">Telefone</Label>
                <Input
                  id="customer_phone"
                  value={formData.customer_phone}
                  onChange={(e) => handleChange('customer_phone', e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="send_invite"
                checked={sendInvite}
                onChange={(e) => setSendInvite(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <Label htmlFor="send_invite" className="text-caption cursor-pointer">
                Enviar convite de acesso por e-mail ao cadastrar
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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

function ObraCard({ 
  project, 
  onView, 
  onEdit,
  onDelete,
}: { 
  project: ProjectWithCustomer; 
  onView: () => void; 
  onEdit: () => void;
  onDelete: () => void;
}) {
  const daysRemaining = useMemo(() => {
    if (!project.planned_end_date) return null;
    return Math.ceil(
      (new Date(project.planned_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
  }, [project.planned_end_date]);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate">{project.name}</p>
            {project.unit_name && (
              <p className="text-sm text-muted-foreground truncate">{project.unit_name}</p>
            )}
            {project.customer_name && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <User className="h-3 w-3" /> {project.customer_name}
              </p>
            )}
            {project.planned_start_date && project.planned_end_date && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                <Calendar className="h-3 w-3" />
                <span>
                  {format(parseLocalDate(project.planned_start_date), 'dd/MM/yy', { locale: ptBR })} - {' '}
                  {format(parseLocalDate(project.planned_end_date), 'dd/MM/yy', { locale: ptBR })}
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant="outline" className={statusColors[project.status]}>
              {statusLabels[project.status]}
            </Badge>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px] h-11 w-11" onClick={onView}>
                <Eye className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px] h-11 w-11" onClick={onEdit}>
                <Settings className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px] h-11 w-11 text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Deletar obra?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação não pode ser desfeita. A obra <strong>{project.name}</strong> e todos os dados associados serão permanentemente removidos.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={onDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Deletar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ObrasTab() {
  const navigate = useNavigate();
  const { data: projects = [], isLoading: loading, error, refetch } = useProjectsQuery();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const filteredProjects = useMemo(() => projects.filter((p: ProjectWithCustomer) => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.unit_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  }), [projects, searchTerm, statusFilter]);

  const { activeCount, completedCount, pausedCount } = useMemo(() => ({
    activeCount: projects.filter((p: ProjectWithCustomer) => p.status === 'active').length,
    completedCount: projects.filter((p: ProjectWithCustomer) => p.status === 'completed').length,
    pausedCount: projects.filter((p: ProjectWithCustomer) => p.status === 'paused').length,
  }), [projects]);

  const handleDelete = async (projectId: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;

      toast({
        title: 'Obra deletada',
        description: 'A obra foi removida com sucesso',
      });

      refetch();
    } catch (err: any) {
      console.error('Error deleting project:', err);
      toast({
        title: 'Erro',
        description: err.message || 'Não foi possível deletar a obra',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with action */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Gerenciar Obras</h2>
        <CreateObraDialog onCreated={refetch} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-tiny text-muted-foreground uppercase tracking-wider">Total</p>
          <p className="text-h2 font-bold">{projects.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-tiny text-muted-foreground uppercase tracking-wider">Em andamento</p>
          <p className="text-h2 font-bold text-primary">{activeCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-tiny text-muted-foreground uppercase tracking-wider">Concluídas</p>
          <p className="text-h2 font-bold text-accent-foreground">{completedCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-tiny text-muted-foreground uppercase tracking-wider">Pausadas</p>
          <p className="text-h2 font-bold text-muted-foreground">{pausedCount}</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, cliente ou unidade..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={statusFilter === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(null)}
          >
            Todas
          </Button>
          <Button
            variant={statusFilter === 'active' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('active')}
          >
            Em andamento
          </Button>
          <Button
            variant={statusFilter === 'completed' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('completed')}
          >
            Concluídas
          </Button>
          <Button
            variant={statusFilter === 'paused' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('paused')}
          >
            Pausadas
          </Button>
        </div>
      </div>

      {/* Projects List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="h-24 animate-pulse bg-muted" />
          ))}
        </div>
      ) : error ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Erro ao carregar obras: {String(error)}</p>
        </Card>
      ) : filteredProjects.length === 0 ? (
        <Card className="p-8 text-center">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground mb-4">
            {searchTerm || statusFilter ? 'Nenhuma obra encontrada' : 'Nenhuma obra cadastrada'}
          </p>
        </Card>
      ) : (
        <>
          {/* Mobile: Cards */}
          <div className="sm:hidden space-y-3">
            {filteredProjects.map((project) => (
              <ObraCard
                key={project.id}
                project={project}
                onView={() => navigate(`/obra/${project.id}`)}
                onEdit={() => navigate(`/gestao/obra/${project.id}`)}
                onDelete={() => handleDelete(project.id)}
              />
            ))}
          </div>

          {/* Desktop: Table */}
          <Card className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Projeto</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProjects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{project.name}</p>
                        {project.unit_name && (
                          <p className="text-sm text-muted-foreground">{project.unit_name}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{project.customer_name || '—'}</TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {project.planned_start_date && project.planned_end_date
                          ? `${format(parseLocalDate(project.planned_start_date), 'dd/MM/yy', { locale: ptBR })} - ${format(parseLocalDate(project.planned_end_date), 'dd/MM/yy', { locale: ptBR })}`
                          : '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[project.status]}>
                        {statusLabels[project.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => navigate(`/obra/${project.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => navigate(`/gestao/obra/${project.id}`)}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Deletar obra?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação não pode ser desfeita. A obra <strong>{project.name}</strong> e todos os dados associados serão permanentemente removidos.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleDelete(project.id)}
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
