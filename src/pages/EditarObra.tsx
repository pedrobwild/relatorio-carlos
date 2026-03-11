import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, User, Calendar, DollarSign, Users, Save, Trash2, Plus, Loader2, UserPlus, X, Map, Mail, CheckCircle2, Link2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
 import { useUserRole } from '@/hooks/useUserRole';
 import { useDeleteProject } from '@/hooks/useDeleteProject';
import { format } from 'date-fns';
import bwildLogo from '@/assets/bwild-logo-dark.png';
import { useProjectMembers, ProjectRole } from '@/hooks/useProjectMembers';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Project {
  id: string;
  name: string;
  unit_name: string | null;
  address: string | null;
  planned_start_date: string | null;
  planned_end_date: string | null;
  actual_start_date: string | null;
  actual_end_date: string | null;
  contract_value: number | null;
  status: string;
  is_project_phase: boolean;
  date_briefing_arch: string | null;
  date_approval_3d: string | null;
  date_approval_exec: string | null;
  date_approval_obra: string | null;
  date_official_start: string | null;
  date_official_delivery: string | null;
  date_mobilization_start: string | null;
  contract_signing_date: string | null;
}

interface Customer {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  customer_user_id: string | null;
  invitation_sent_at: string | null;
  invitation_accepted_at: string | null;
}

interface Activity {
  id: string;
  description: string;
  planned_start: string;
  planned_end: string;
  actual_start: string | null;
  actual_end: string | null;
  weight: number;
  sort_order: number;
}

interface Payment {
  id: string;
  installment_number: number;
  description: string;
  amount: number;
  due_date: string | null;
  paid_at: string | null;
  payment_method: string | null;
}

interface Engineer {
  id: string;
  engineer_user_id: string;
  is_primary: boolean;
  display_name?: string;
  email?: string;
}

interface AvailableEngineer {
  user_id: string;
  display_name: string | null;
  email: string | null;
  role: string;
}

/** Button to link a customer's user account by looking up their email in profiles */
function CustomerLinkButton({ 
  customer, 
  projectId, 
  onLinked 
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
      // Look up user by email in profiles
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', customer.customer_email.toLowerCase().trim())
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile) {
        toast({
          title: 'Usuário não encontrado',
          description: `Nenhuma conta encontrada para ${customer.customer_email}. O cliente precisa criar uma conta primeiro.`,
          variant: 'destructive',
        });
        return;
      }

      // Link the user to the project customer record
      const { error: updateError } = await supabase
        .from('project_customers')
        .update({ customer_user_id: profile.user_id })
        .eq('id', customer.id);

      if (updateError) throw updateError;

      onLinked({ ...customer, customer_user_id: profile.user_id });
      toast({ title: 'Acesso vinculado!', description: `${customer.customer_name} agora tem acesso ao portal da obra.` });
    } catch (err: any) {
      console.error('Error linking customer:', err);
      toast({ title: 'Erro ao vincular', description: err.message, variant: 'destructive' });
    } finally {
      setLinking(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleLink} disabled={linking}>
      {linking ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Link2 className="h-3 w-3 mr-1" />}
      Vincular Acesso
    </Button>
  );
}

/** Section to add a new customer to a project that has none */
function AddCustomerSection({ 
  projectId, 
  onAdded 
}: { 
  projectId: string; 
  onAdded: (c: Customer) => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [adding, setAdding] = useState(false);
  const { toast } = useToast();

  const handleAdd = async () => {
    if (!name || !email) {
      toast({ title: 'Preencha nome e e-mail do cliente', variant: 'destructive' });
      return;
    }

    setAdding(true);
    try {
      // Check if user already exists
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', email.toLowerCase().trim())
        .maybeSingle();

      const { data: newCustomer, error } = await supabase
        .from('project_customers')
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
        title: 'Cliente adicionado!',
        description: profile?.user_id
          ? `${name} foi adicionado e já possui acesso ao portal.`
          : `${name} foi adicionado. O acesso será vinculado quando ele fizer login.`,
      });
    } catch (err: any) {
      console.error('Error adding customer:', err);
      toast({ title: 'Erro ao adicionar cliente', description: err.message, variant: 'destructive' });
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Nenhum cliente vinculado a esta obra. Adicione um cliente para que ele possa acessar o portal.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <Label>Nome completo *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do cliente" />
        </div>
        <div>
          <Label>E-mail *</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@email.com" />
        </div>
        <div>
          <Label>Telefone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" />
        </div>
      </div>
      <Button onClick={handleAdd} disabled={adding || !name || !email}>
        {adding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
        Adicionar Cliente
      </Button>
    </div>
  );
}

export default function EditarObra() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
   const { isAdmin } = useUserRole();
   const deleteProjectMutation = useDeleteProject();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('geral');
  
  // Data states
  const [project, setProject] = useState<Project | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [availableEngineers, setAvailableEngineers] = useState<AvailableEngineer[]>([]);
  const [selectedEngineer, setSelectedEngineer] = useState<string>('');
  const [addingEngineer, setAddingEngineer] = useState(false);
   const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // Project members hook
  const { members, addMember, removeMember, updateRole, isAddingMember, isRemovingMember } = useProjectMembers(projectId);
  
  // New item forms
  const [newActivity, setNewActivity] = useState({ description: '', planned_start: '', planned_end: '', weight: '5' });
  const [newPayment, setNewPayment] = useState({ description: '', amount: '', due_date: '', dueDatePending: false, payment_method: '' });

  useEffect(() => {
    if (projectId) {
      fetchAllData();
    }
  }, [projectId]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      // Fetch project
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
      
      if (projectError) throw projectError;
      setProject(projectData);

      // Fetch customer
      const { data: customerData } = await supabase
        .from('project_customers')
        .select('*')
        .eq('project_id', projectId)
        .single();
      
      setCustomer(customerData || null);

      // Fetch activities
      const { data: activitiesData } = await supabase
        .from('project_activities')
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true });
      
      setActivities(activitiesData || []);

      // Fetch payments
      const { data: paymentsData } = await supabase
        .from('project_payments')
        .select('*')
        .eq('project_id', projectId)
        .order('installment_number', { ascending: true });
      
      setPayments(paymentsData || []);

      // Fetch engineers with profile info
      const { data: engineersData } = await supabase
        .from('project_engineers')
        .select('*, profiles:engineer_user_id(display_name, email)')
        .eq('project_id', projectId);
      
      setEngineers((engineersData || []).map(e => ({
        ...e,
        display_name: (e.profiles as any)?.display_name,
        email: (e.profiles as any)?.email,
      })));

      // Fetch available engineers (staff users not already in this project)
      const { data: staffProfiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, email, role')
        .in('role', ['admin', 'manager', 'engineer']);
      
      const assignedUserIds = new Set((engineersData || []).map(e => e.engineer_user_id));
      const memberUserIds = new Set(members.map(m => m.user_id));
      
      setAvailableEngineers(
        (staffProfiles || []).filter(p => !assignedUserIds.has(p.user_id) && !memberUserIds.has(p.user_id))
      );

    } catch (err: any) {
      console.error('Error fetching data:', err);
      toast({ title: 'Erro ao carregar dados', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Refetch available engineers when members change
  useEffect(() => {
    if (projectId && !loading) {
      fetchAvailableEngineers();
    }
  }, [members]);

  const fetchAvailableEngineers = async () => {
    try {
      const { data: staffProfiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, email, role')
        .in('role', ['admin', 'manager', 'engineer']);
      
      const memberUserIds = new Set(members.map(m => m.user_id));
      const engineerUserIds = new Set(engineers.map(e => e.engineer_user_id));
      
      setAvailableEngineers(
        (staffProfiles || []).filter(p => !memberUserIds.has(p.user_id) && !engineerUserIds.has(p.user_id))
      );
    } catch (err) {
      console.error('Error fetching available engineers:', err);
    }
  };

  const handleAddMember = async (role: ProjectRole = 'engineer') => {
    if (!selectedEngineer || !projectId) return;
    
    setAddingEngineer(true);
    try {
      await addMember({ projectId, userId: selectedEngineer, role });
      setSelectedEngineer('');
      await fetchAvailableEngineers();
    } catch (err) {
      console.error('Error adding member:', err);
    } finally {
      setAddingEngineer(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      await removeMember({ memberId });
    } catch (err) {
      console.error('Error removing member:', err);
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: ProjectRole) => {
    try {
      await updateRole({ memberId, role: newRole });
    } catch (err) {
      console.error('Error updating role:', err);
    }
  };

  const handleProjectChange = (field: keyof Project, value: string | number | boolean | null) => {
    if (project) {
      setProject({ ...project, [field]: value });
    }
  };

  const handleCustomerChange = (field: keyof Customer, value: string | null) => {
    if (customer) {
      setCustomer({ ...customer, [field]: value });
    }
  };

  const saveProject = async () => {
    if (!project) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          name: project.name,
          unit_name: project.unit_name,
          address: project.address,
          bairro: (project as any).bairro || null,
          cep: (project as any).cep || null,
          planned_start_date: project.planned_start_date || null,
          planned_end_date: project.planned_end_date || null,
          actual_start_date: project.actual_start_date,
          actual_end_date: project.actual_end_date,
          contract_value: project.contract_value,
          status: project.status,
          is_project_phase: project.is_project_phase,
          date_briefing_arch: project.date_briefing_arch || null,
          date_approval_3d: project.date_approval_3d || null,
          date_approval_exec: project.date_approval_exec || null,
          date_approval_obra: project.date_approval_obra || null,
          date_official_start: project.date_official_start || null,
          date_official_delivery: project.date_official_delivery || null,
          date_mobilization_start: project.date_mobilization_start || null,
          contract_signing_date: project.contract_signing_date || null,
        } as any)
        .eq('id', project.id);

      if (error) throw error;

      // Update customer if exists
      if (customer) {
        const { error: customerError } = await supabase
          .from('project_customers')
          .update({
            customer_name: customer.customer_name,
            customer_email: customer.customer_email,
            customer_phone: customer.customer_phone,
          })
          .eq('id', customer.id);

        if (customerError) throw customerError;
      }

      toast({ title: 'Salvo!', description: 'Dados da obra atualizados.' });
    } catch (err: any) {
      console.error('Error saving:', err);
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Activity functions
  const addActivity = async () => {
    if (!newActivity.description || !newActivity.planned_start || !newActivity.planned_end) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }

    try {
      const nextOrder = activities.length > 0 ? Math.max(...activities.map(a => a.sort_order)) + 1 : 1;
      
      const { data, error } = await supabase
        .from('project_activities')
        .insert({
          project_id: projectId,
          description: newActivity.description,
          planned_start: newActivity.planned_start,
          planned_end: newActivity.planned_end,
          weight: parseFloat(newActivity.weight) || 5,
          sort_order: nextOrder,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      
      setActivities([...activities, data]);
      setNewActivity({ description: '', planned_start: '', planned_end: '', weight: '5' });
      toast({ title: 'Atividade adicionada!' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const updateActivity = async (id: string, field: string, value: string | number | null) => {
    try {
      const { error } = await supabase
        .from('project_activities')
        .update({ [field]: value })
        .eq('id', id);

      if (error) throw error;
      
      setActivities(activities.map(a => a.id === id ? { ...a, [field]: value } : a));
    } catch (err: any) {
      toast({ title: 'Erro ao atualizar', description: err.message, variant: 'destructive' });
    }
  };

  const deleteActivity = async (id: string) => {
    try {
      const { error } = await supabase
        .from('project_activities')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setActivities(activities.filter(a => a.id !== id));
      toast({ title: 'Atividade removida' });
    } catch (err: any) {
      toast({ title: 'Erro ao remover', description: err.message, variant: 'destructive' });
    }
  };

  // Payment functions
  const addPayment = async () => {
    if (!newPayment.description || !newPayment.amount) {
      toast({ title: 'Preencha descrição e valor', variant: 'destructive' });
      return;
    }
    if (!newPayment.dueDatePending && !newPayment.due_date) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }

    try {
      const nextInstallment = payments.length > 0 ? Math.max(...payments.map(p => p.installment_number)) + 1 : 1;
      
      const { data, error } = await supabase
        .from('project_payments')
        .insert({
          project_id: projectId,
          installment_number: nextInstallment,
          description: newPayment.description,
          amount: parseFloat(newPayment.amount),
          due_date: newPayment.dueDatePending ? null : newPayment.due_date,
          payment_method: newPayment.payment_method || null,
        } as any)
        .select()
        .single();

      if (error) throw error;
      
      setPayments([...payments, data]);
      setNewPayment({ description: '', amount: '', due_date: '', dueDatePending: false, payment_method: '' });
      toast({ title: 'Parcela adicionada!' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const updatePayment = async (id: string, field: string, value: string | number | null) => {
    try {
      const { error } = await supabase
        .from('project_payments')
        .update({ [field]: value })
        .eq('id', id);

      if (error) throw error;
      
      setPayments(payments.map(p => p.id === id ? { ...p, [field]: value } : p));
    } catch (err: any) {
      toast({ title: 'Erro ao atualizar', description: err.message, variant: 'destructive' });
    }
  };

  const togglePaymentPaid = async (payment: Payment) => {
    try {
      const newPaidAt = payment.paid_at ? null : new Date().toISOString();
      
      const { error } = await supabase
        .from('project_payments')
        .update({ paid_at: newPaidAt })
        .eq('id', payment.id);

      if (error) throw error;
      
      setPayments(payments.map(p => p.id === payment.id ? { ...p, paid_at: newPaidAt } : p));
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

   const handleDeleteProject = async () => {
     if (!projectId) return;
     
     try {
       await deleteProjectMutation.mutateAsync(projectId);
       navigate('/gestao');
     } catch (error) {
       // Error is handled by the mutation
     }
   };
 
  const deletePayment = async (id: string) => {
    try {
      const { error } = await supabase
        .from('project_payments')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setPayments(payments.filter(p => p.id !== id));
      toast({ title: 'Parcela removida' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Obra não encontrada</p>
      </div>
    );
  }

  const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);
  const paidPayments = payments.filter(p => p.paid_at).reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/gestao')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-h3 font-bold">{project.name}</h1>
                <p className="text-tiny text-muted-foreground">Editar dados da obra</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => navigate(`/obra/${projectId}`)}>
                Ver Portal
              </Button>
              <Button onClick={saveProject} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar
              </Button>
               {isAdmin && (
                 <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                   <AlertDialogTrigger asChild>
                     <Button variant="destructive" size="icon">
                       <Trash2 className="h-4 w-4" />
                     </Button>
                   </AlertDialogTrigger>
                   <AlertDialogContent>
                     <AlertDialogHeader>
                       <AlertDialogTitle>Excluir Obra</AlertDialogTitle>
                       <AlertDialogDescription>
                         Tem certeza que deseja excluir a obra "{project.name}"? 
                         Esta ação é irreversível e excluirá todos os dados relacionados 
                         (atividades, pagamentos, documentos, formalizações, etc).
                       </AlertDialogDescription>
                     </AlertDialogHeader>
                     <AlertDialogFooter>
                       <AlertDialogCancel>Cancelar</AlertDialogCancel>
                       <AlertDialogAction
                         onClick={handleDeleteProject}
                         className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                         disabled={deleteProjectMutation.isPending}
                       >
                         {deleteProjectMutation.isPending ? (
                           <Loader2 className="h-4 w-4 animate-spin mr-2" />
                         ) : null}
                         Excluir Definitivamente
                       </AlertDialogAction>
                     </AlertDialogFooter>
                   </AlertDialogContent>
                 </AlertDialog>
               )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="geral" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Dados Gerais</span>
            </TabsTrigger>
            <TabsTrigger value="atividades" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Atividades</span>
            </TabsTrigger>
            <TabsTrigger value="pagamentos" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Pagamentos</span>
            </TabsTrigger>
            <TabsTrigger value="equipe" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Equipe</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab: Dados Gerais */}
          <TabsContent value="geral" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-body">
                  <Building2 className="h-5 w-5" />
                  Informações do Projeto
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <Label>Condomínio *</Label>
                    <Input
                      value={project.name}
                      onChange={(e) => handleProjectChange('name', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Unidade</Label>
                    <Input
                      value={project.unit_name || ''}
                      onChange={(e) => handleProjectChange('unit_name', e.target.value || null)}
                    />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={project.status} onValueChange={(v) => handleProjectChange('status', v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Em andamento</SelectItem>
                        <SelectItem value="paused">Pausada</SelectItem>
                        <SelectItem value="completed">Concluída</SelectItem>
                        <SelectItem value="cancelled">Cancelada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Endereço</Label>
                    <Input
                      value={project.address || ''}
                      onChange={(e) => handleProjectChange('address', e.target.value || null)}
                    />
                  </div>
                  <div>
                    <Label>Bairro</Label>
                    <Input
                      value={(project as any).bairro || ''}
                      onChange={(e) => handleProjectChange('bairro' as any, e.target.value || null)}
                    />
                  </div>
                  <div>
                    <Label>CEP</Label>
                    <Input
                      value={(project as any).cep || ''}
                      onChange={(e) => handleProjectChange('cep' as any, e.target.value || null)}
                      placeholder="00000-000"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Project Phase Toggle */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-body">
                  <Map className="h-5 w-5" />
                  Fase do Projeto
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/50">
                  <div className="space-y-0.5">
                    <Label htmlFor="is_project_phase" className="text-sm font-medium">
                      Obra em fase de projeto
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Ative se a obra ainda está em fase de aprovação (Projeto 3D → Executivo → Liberação)
                    </p>
                  </div>
                  <Switch
                    id="is_project_phase"
                    checked={project.is_project_phase}
                    onCheckedChange={(checked) => handleProjectChange('is_project_phase', checked)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-body">
                  <Calendar className="h-5 w-5" />
                  Cronograma
                </CardTitle>
                {project.is_project_phase && (
                  <CardDescription>
                    Obra em fase de projeto. As datas podem ser definidas ou marcadas como "Em definição".
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Início Previsto {!project.is_project_phase && '*'}</Label>
                    {project.is_project_phase && (
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="start_date_undefined"
                          checked={!project.planned_start_date}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              handleProjectChange('planned_start_date', null);
                            }
                          }}
                        />
                        <Label htmlFor="start_date_undefined" className="text-xs text-muted-foreground cursor-pointer">
                          Em definição
                        </Label>
                      </div>
                    )}
                    {(!project.is_project_phase || project.planned_start_date) ? (
                      <Input
                        type="date"
                        value={project.planned_start_date || ''}
                        onChange={(e) => handleProjectChange('planned_start_date', e.target.value || null)}
                      />
                    ) : (
                      <div className="h-10 flex items-center px-3 rounded-md border border-input bg-muted/50 text-muted-foreground text-sm">
                        Em definição
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Término Previsto {!project.is_project_phase && '*'}</Label>
                    {project.is_project_phase && (
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="end_date_undefined"
                          checked={!project.planned_end_date}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              handleProjectChange('planned_end_date', null);
                            }
                          }}
                        />
                        <Label htmlFor="end_date_undefined" className="text-xs text-muted-foreground cursor-pointer">
                          Em definição
                        </Label>
                      </div>
                    )}
                    {(!project.is_project_phase || project.planned_end_date) ? (
                      <Input
                        type="date"
                        value={project.planned_end_date || ''}
                        onChange={(e) => handleProjectChange('planned_end_date', e.target.value || null)}
                      />
                    ) : (
                      <div className="h-10 flex items-center px-3 rounded-md border border-input bg-muted/50 text-muted-foreground text-sm">
                        Em definição
                      </div>
                    )}
                  </div>
                  <div>
                    <Label>Início Real</Label>
                    <Input
                      type="date"
                      value={project.actual_start_date || ''}
                      onChange={(e) => handleProjectChange('actual_start_date', e.target.value || null)}
                    />
                  </div>
                  <div>
                    <Label>Término Real</Label>
                    <Input
                      type="date"
                      value={project.actual_end_date || ''}
                      onChange={(e) => handleProjectChange('actual_end_date', e.target.value || null)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-body">
                  <Calendar className="h-5 w-5" />
                  Datas Marco
                </CardTitle>
                <CardDescription>
                  Datas dos marcos principais do projeto. Podem ser preenchidas posteriormente.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Briefing Arquitetura</Label>
                    <Input
                      type="date"
                      value={project.date_briefing_arch || ''}
                      onChange={(e) => handleProjectChange('date_briefing_arch', e.target.value || null)}
                    />
                  </div>
                  <div>
                    <Label>Aprovação Projeto 3D</Label>
                    <Input
                      type="date"
                      value={project.date_approval_3d || ''}
                      onChange={(e) => handleProjectChange('date_approval_3d', e.target.value || null)}
                    />
                  </div>
                  <div>
                    <Label>Aprovação Projeto Executivo</Label>
                    <Input
                      type="date"
                      value={project.date_approval_exec || ''}
                      onChange={(e) => handleProjectChange('date_approval_exec', e.target.value || null)}
                    />
                  </div>
                  <div>
                    <Label>Aprovação da Obra</Label>
                    <Input
                      type="date"
                      value={project.date_approval_obra || ''}
                      onChange={(e) => handleProjectChange('date_approval_obra', e.target.value || null)}
                    />
                  </div>
                  <div>
                    <Label>Início Mobilização</Label>
                    <Input
                      type="date"
                      value={project.date_mobilization_start || ''}
                      onChange={(e) => handleProjectChange('date_mobilization_start', e.target.value || null)}
                    />
                  </div>
                  <div>
                    <Label>Início Oficial</Label>
                    <Input
                      type="date"
                      value={project.date_official_start || ''}
                      onChange={(e) => handleProjectChange('date_official_start', e.target.value || null)}
                    />
                  </div>
                  <div>
                    <Label>Entrega Oficial</Label>
                    <Input
                      type="date"
                      value={project.date_official_delivery || ''}
                      onChange={(e) => handleProjectChange('date_official_delivery', e.target.value || null)}
                    />
                  </div>
                  <div>
                    <Label>Assinatura do Contrato</Label>
                    <Input
                      type="date"
                      value={project.contract_signing_date || ''}
                      onChange={(e) => handleProjectChange('contract_signing_date', e.target.value || null)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-body">
                  <DollarSign className="h-5 w-5" />
                  Financeiro
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div>
                  <Label>Valor do Contrato (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={project.contract_value || ''}
                    onChange={(e) => handleProjectChange('contract_value', e.target.value ? parseFloat(e.target.value) : null)}
                  />
                </div>
              </CardContent>
            </Card>

            {customer && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-body">
                    <User className="h-5 w-5" />
                    Dados do Cliente
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <Label>Nome Completo</Label>
                      <Input
                        value={customer.customer_name}
                        onChange={(e) => handleCustomerChange('customer_name', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>E-mail</Label>
                      <Input
                        type="email"
                        value={customer.customer_email}
                        onChange={(e) => handleCustomerChange('customer_email', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Telefone</Label>
                      <Input
                        value={customer.customer_phone || ''}
                        onChange={(e) => handleCustomerChange('customer_phone', e.target.value || null)}
                      />
                    </div>
                  </div>
                  {customer.customer_user_id || customer.invitation_accepted_at ? (
                    <Badge className="bg-green-500/10 text-green-600">
                      Cadastrado no portal
                    </Badge>
                  ) : customer.invitation_sent_at ? (
                    <Badge variant="outline">
                      Convite enviado em {format(new Date(customer.invitation_sent_at), 'dd/MM/yyyy')}
                    </Badge>
                  ) : null}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tab: Atividades */}
          <TabsContent value="atividades" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Cronograma de Atividades</CardTitle>
                <CardDescription>
                  {activities.length} atividades cadastradas
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Add new activity form */}
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 mb-6 p-4 bg-muted/50 rounded-lg">
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Descrição</Label>
                    <Input
                      placeholder="Nome da atividade"
                      value={newActivity.description}
                      onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Início</Label>
                    <Input
                      type="date"
                      value={newActivity.planned_start}
                      onChange={(e) => setNewActivity({ ...newActivity, planned_start: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Término</Label>
                    <Input
                      type="date"
                      value={newActivity.planned_end}
                      onChange={(e) => setNewActivity({ ...newActivity, planned_end: e.target.value })}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={addActivity} className="w-full">
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar
                    </Button>
                  </div>
                </div>

                {/* Activities table */}
                {activities.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">#</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Início Prev.</TableHead>
                        <TableHead>Término Prev.</TableHead>
                        <TableHead>Início Real</TableHead>
                        <TableHead>Término Real</TableHead>
                        <TableHead className="w-16">Peso</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activities.map((activity) => (
                        <TableRow key={activity.id}>
                          <TableCell className="text-muted-foreground">{activity.sort_order}</TableCell>
                          <TableCell>
                            <Input
                              value={activity.description}
                              onChange={(e) => updateActivity(activity.id, 'description', e.target.value)}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="date"
                              value={activity.planned_start}
                              onChange={(e) => updateActivity(activity.id, 'planned_start', e.target.value)}
                              className="h-8 w-32"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="date"
                              value={activity.planned_end}
                              onChange={(e) => updateActivity(activity.id, 'planned_end', e.target.value)}
                              className="h-8 w-32"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="date"
                              value={activity.actual_start || ''}
                              onChange={(e) => updateActivity(activity.id, 'actual_start', e.target.value || null)}
                              className="h-8 w-32"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="date"
                              value={activity.actual_end || ''}
                              onChange={(e) => updateActivity(activity.id, 'actual_end', e.target.value || null)}
                              className="h-8 w-32"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="1"
                              max="100"
                              value={activity.weight}
                              onChange={(e) => updateActivity(activity.id, 'weight', parseFloat(e.target.value))}
                              className="h-8 w-16"
                            />
                          </TableCell>
                          <TableCell>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remover atividade?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta ação não pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteActivity(activity.id)}>
                                    Remover
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma atividade cadastrada. Adicione a primeira acima.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Pagamentos */}
          <TabsContent value="pagamentos" className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="p-4">
                <p className="text-tiny text-muted-foreground">Valor Total</p>
                <p className="text-h3 font-bold">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPayments)}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-tiny text-muted-foreground">Pago</p>
                <p className="text-h3 font-bold text-green-600">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(paidPayments)}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-tiny text-muted-foreground">A Receber</p>
                <p className="text-h3 font-bold text-amber-600">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPayments - paidPayments)}
                </p>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Parcelas</CardTitle>
                <CardDescription>
                  {payments.length} parcelas cadastradas
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Add new payment form */}
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 mb-6 p-4 bg-muted/50 rounded-lg">
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Descrição</Label>
                    <Input
                      placeholder="Ex: Parcela de entrada"
                      value={newPayment.description}
                      onChange={(e) => setNewPayment({ ...newPayment, description: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Valor (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0,00"
                      value={newPayment.amount}
                      onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Forma de Pagamento</Label>
                    <Select value={newPayment.payment_method} onValueChange={(v) => setNewPayment({ ...newPayment, payment_method: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="boleto">Boleto</SelectItem>
                        <SelectItem value="pix">PIX</SelectItem>
                        <SelectItem value="transferencia">Transferência</SelectItem>
                        <SelectItem value="cartao">Cartão</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Vencimento</Label>
                    <div className="space-y-2">
                      <Input
                        type="date"
                        value={newPayment.due_date}
                        onChange={(e) => setNewPayment({ ...newPayment, due_date: e.target.value, dueDatePending: false })}
                        disabled={newPayment.dueDatePending}
                        className={newPayment.dueDatePending ? 'opacity-50' : ''}
                      />
                      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newPayment.dueDatePending}
                          onChange={(e) => setNewPayment({ ...newPayment, dueDatePending: e.target.checked, due_date: '' })}
                          className="rounded"
                        />
                        Em definição
                      </label>
                    </div>
                  </div>
                  <div className="sm:col-span-5 flex justify-end">
                    <Button onClick={addPayment}>
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar Parcela
                    </Button>
                  </div>
                </div>

                {/* Payments table */}
                {payments.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Parcela</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="w-28">Valor</TableHead>
                        <TableHead>Forma Pgto</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell className="font-medium">#{payment.installment_number}</TableCell>
                          <TableCell>
                            <Input
                              value={payment.description}
                              onChange={(e) => updatePayment(payment.id, 'description', e.target.value)}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={payment.amount}
                              onChange={(e) => updatePayment(payment.id, 'amount', parseFloat(e.target.value))}
                              className="h-8 w-28"
                            />
                          </TableCell>
                          <TableCell>
                            <Select 
                              value={payment.payment_method || ''} 
                              onValueChange={(v) => updatePayment(payment.id, 'payment_method', v || null)}
                            >
                              <SelectTrigger className="h-8 w-32">
                                <SelectValue placeholder="—" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="boleto">Boleto</SelectItem>
                                <SelectItem value="pix">PIX</SelectItem>
                                <SelectItem value="transferencia">Transferência</SelectItem>
                                <SelectItem value="cartao">Cartão</SelectItem>
                                <SelectItem value="cheque">Cheque</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <Input
                                type="date"
                                value={payment.due_date || ''}
                                onChange={(e) => updatePayment(payment.id, 'due_date', e.target.value || null)}
                                className="h-8 w-36"
                                disabled={!payment.due_date && payment.due_date !== ''}
                              />
                              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={payment.due_date === null}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      updatePayment(payment.id, 'due_date', null);
                                    } else {
                                      updatePayment(payment.id, 'due_date', format(new Date(), 'yyyy-MM-dd'));
                                    }
                                  }}
                                  className="rounded"
                                />
                                Em definição
                              </label>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant={payment.paid_at ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => togglePaymentPaid(payment)}
                              className={payment.paid_at ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                            >
                              {payment.paid_at ? 'Pago' : 'Marcar pago'}
                            </Button>
                          </TableCell>
                          <TableCell>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remover parcela?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta ação não pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deletePayment(payment.id)}>
                                    Remover
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma parcela cadastrada. Adicione a primeira acima.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Equipe */}
          <TabsContent value="equipe" className="space-y-6">
            {/* Add Member Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Adicionar Membro
                </CardTitle>
                <CardDescription>
                  Selecione um engenheiro disponível para adicionar à equipe do projeto
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <Select value={selectedEngineer} onValueChange={setSelectedEngineer}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um engenheiro..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableEngineers.length > 0 ? (
                          availableEngineers.map((eng) => (
                            <SelectItem key={eng.user_id} value={eng.user_id}>
                              <div className="flex items-center gap-2">
                                <span>{eng.display_name || eng.email || 'Sem nome'}</span>
                                <span className="text-muted-foreground text-xs">({eng.role})</span>
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
                    onClick={() => handleAddMember('engineer')} 
                    disabled={!selectedEngineer || addingEngineer || isAddingMember}
                  >
                    {(addingEngineer || isAddingMember) ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    Adicionar
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Project Members (from project_members table) */}
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
                      <div key={member.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{member.user_name || 'Sem nome'}</p>
                            <p className="text-sm text-muted-foreground">{member.user_email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Select 
                            value={member.role} 
                            onValueChange={(value) => handleUpdateRole(member.id, value as ProjectRole)}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="owner">Responsável</SelectItem>
                              <SelectItem value="engineer">Engenheiro</SelectItem>
                              <SelectItem value="viewer">Visualizador</SelectItem>
                              <SelectItem value="customer">Cliente</SelectItem>
                            </SelectContent>
                          </Select>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                disabled={isRemovingMember}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover membro?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {member.user_name || member.user_email} será removido do projeto.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleRemoveMember(member.id)}>
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

            {/* Legacy Engineers (from project_engineers table) */}
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
                      <div key={engineer.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{engineer.display_name || 'Sem nome'}</p>
                            <p className="text-sm text-muted-foreground">{engineer.email}</p>
                          </div>
                        </div>
                        {engineer.is_primary && (
                          <Badge>Principal</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Customer Access Management */}
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
                          <p className="text-sm text-muted-foreground">{customer.customer_email}</p>
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
                            projectId={projectId!}
                            onLinked={(updatedCustomer) => setCustomer(updatedCustomer)}
                          />
                        )}
                      </div>
                    </div>
                    {!customer.customer_user_id && (
                      <p className="text-xs text-muted-foreground">
                        <Mail className="h-3 w-3 inline mr-1" />
                        O cliente ainda não tem acesso ao portal. Clique em "Vincular Acesso" para buscar a conta pelo e-mail cadastrado, ou o acesso será vinculado automaticamente quando o cliente fizer login.
                      </p>
                    )}
                  </div>
                ) : (
                  <AddCustomerSection projectId={projectId!} onAdded={(newCustomer) => setCustomer(newCustomer)} />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
