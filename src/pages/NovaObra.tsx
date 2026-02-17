import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, User, Calendar, DollarSign, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import bwildLogo from '@/assets/bwild-logo.png';
import { z } from 'zod';

// Validation schema
const formSchema = z.object({
  name: z.string().trim().min(1, 'Nome do projeto é obrigatório').max(200),
  unit_name: z.string().trim().max(100).optional(),
  address: z.string().trim().max(300).optional(),
  planned_start_date: z.string().optional(),
  planned_end_date: z.string().optional(),
  contract_value: z.string().optional(),
  customer_name: z.string().trim().min(1, 'Nome do cliente é obrigatório').max(200),
  customer_email: z.string().trim().email('E-mail inválido').max(255),
  customer_phone: z.string().trim().max(20).optional(),
  is_project_phase: z.boolean(),
}).refine((data) => {
  // If not in project phase, dates are required
  if (!data.is_project_phase) {
    return !!data.planned_start_date && !!data.planned_end_date;
  }
  return true;
}, {
  message: 'Datas de início e término são obrigatórias para obras em execução',
  path: ['planned_start_date'],
});

interface FormData {
  // Project info
  name: string;
  unit_name: string;
  address: string;
  planned_start_date: string;
  planned_end_date: string;
  contract_value: string;
  // Customer info
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  // Project phase
  is_project_phase: boolean;
}

export default function NovaObra() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [sendInvite, setSendInvite] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
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
    is_project_phase: false,
  });

  const handleChange = (field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when field changes
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({ title: 'Erro', description: 'Você precisa estar logado', variant: 'destructive' });
      return;
    }

    // Validate with Zod
    const result = formSchema.safeParse(formData);
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) {
          newErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(newErrors);
      toast({ title: 'Erro de validação', description: 'Verifique os campos obrigatórios', variant: 'destructive' });
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      // 1. Create project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          name: formData.name.trim(),
          unit_name: formData.unit_name.trim() || null,
          address: formData.address.trim() || null,
          planned_start_date: formData.planned_start_date || null,
          planned_end_date: formData.planned_end_date || null,
          contract_value: formData.contract_value ? parseFloat(formData.contract_value) : null,
          created_by: user.id,
          is_project_phase: formData.is_project_phase,
        })
        .select()
        .single();

      if (projectError) {
        console.error('Project creation error:', projectError);
        throw new Error('Falha ao criar projeto: ' + projectError.message);
      }

      // 2. Add current user as engineer (legacy table for backwards compatibility)
      const { error: engineerError } = await supabase
        .from('project_engineers')
        .insert({
          project_id: project.id,
          engineer_user_id: user.id,
          is_primary: true,
        });

      if (engineerError) {
        console.error('Engineer assignment error:', engineerError);
        // Don't throw - project is created, just log
      }

      // 3. Add current user to project_members as owner (required for can_manage_project)
      const { error: memberError } = await supabase
        .from('project_members')
        .insert({
          project_id: project.id,
          user_id: user.id,
          role: 'owner',
        });

      if (memberError) {
        console.error('Member assignment error:', memberError);
        // Don't throw - project is created, just log
      }

      // 4. Add customer
      const { error: customerError } = await supabase
        .from('project_customers')
        .insert({
          project_id: project.id,
          customer_name: formData.customer_name.trim(),
          customer_email: formData.customer_email.trim().toLowerCase(),
          customer_phone: formData.customer_phone.trim() || null,
          invitation_sent_at: sendInvite ? new Date().toISOString() : null,
        });

      if (customerError) {
        console.error('Customer creation error:', customerError);
        // Don't throw - project is created, just log
      }

      // 5. Initialize project journey if in project phase
      if (formData.is_project_phase) {
        const { error: journeyError } = await supabase
          .rpc('initialize_project_journey', { p_project_id: project.id });
        
        if (journeyError) {
          console.error('Journey initialization error:', journeyError);
          // Don't throw - project is created, just log
        }
      }

      toast({ 
        title: 'Obra cadastrada!', 
        description: sendInvite 
          ? `Convite enviado para ${formData.customer_email}` 
          : 'Cliente cadastrado sem envio de convite'
      });

      navigate('/gestao');
    } catch (err: unknown) {
      console.error('Error creating project:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      toast({ 
        title: 'Erro ao cadastrar', 
        description: errorMessage, 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/gestao')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-h3 font-bold">Nova Obra</h1>
              <p className="text-tiny text-muted-foreground">Cadastre uma nova obra</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Project Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-body">
                <Building2 className="h-5 w-5" />
                Dados da Obra
              </CardTitle>
              <CardDescription>Informações básicas do projeto</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Project Phase Toggle */}
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
                  checked={formData.is_project_phase}
                  onCheckedChange={(checked) => handleChange('is_project_phase', checked)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1">
                  <Label htmlFor="name">Nome do Projeto *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="Ex: Hub Brooklyn"
                    className={errors.name ? 'border-destructive' : ''}
                  />
                  {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
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
            </CardContent>
          </Card>

          {/* Dates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-body">
                <Calendar className="h-5 w-5" />
                Cronograma
              </CardTitle>
              <CardDescription>Datas previstas de início e término</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
          {formData.is_project_phase && (
            <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg mb-4">
              <p>Obra em fase de projeto. As datas podem ser definidas agora ou marcadas como "Em definição".</p>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="planned_start_date">
                Data de Início {!formData.is_project_phase && '*'}
              </Label>
              {formData.is_project_phase && (
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="start_date_undefined"
                    checked={formData.planned_start_date === ''}
                    onChange={(e) => handleChange('planned_start_date', e.target.checked ? '' : '')}
                    className="h-4 w-4 rounded border-border"
                  />
                  <Label htmlFor="start_date_undefined" className="text-caption cursor-pointer text-muted-foreground">
                    Em definição
                  </Label>
                </div>
              )}
              {(!formData.is_project_phase || formData.planned_start_date !== '') && (
                    <Input
                      id="planned_start_date"
                      type="date"
                      value={formData.planned_start_date}
                      onChange={(e) => handleChange('planned_start_date', e.target.value)}
                      required={!formData.is_project_phase}
                    />
              )}
              {formData.is_project_phase && formData.planned_start_date === '' && (
                <div className="h-10 flex items-center px-3 rounded-md border border-input bg-muted/50 text-muted-foreground text-sm">
                  Em definição
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="planned_end_date">
                Data de Término {!formData.is_project_phase && '*'}
              </Label>
              {formData.is_project_phase && (
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="end_date_undefined"
                    checked={formData.planned_end_date === ''}
                    onChange={(e) => handleChange('planned_end_date', e.target.checked ? '' : '')}
                    className="h-4 w-4 rounded border-border"
                  />
                  <Label htmlFor="end_date_undefined" className="text-caption cursor-pointer text-muted-foreground">
                    Em definição
                  </Label>
                </div>
              )}
              {(!formData.is_project_phase || formData.planned_end_date !== '') && (
                    <Input
                      id="planned_end_date"
                      type="date"
                      value={formData.planned_end_date}
                      onChange={(e) => handleChange('planned_end_date', e.target.value)}
                      required={!formData.is_project_phase}
                    />
              )}
              {formData.is_project_phase && formData.planned_end_date === '' && (
                <div className="h-10 flex items-center px-3 rounded-md border border-input bg-muted/50 text-muted-foreground text-sm">
                  Em definição
                </div>
              )}
                </div>
          </div>
            </CardContent>
          </Card>

          {/* Financial */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-body">
                <DollarSign className="h-5 w-5" />
                Financeiro
              </CardTitle>
              <CardDescription>Valor do contrato (opcional)</CardDescription>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>

          {/* Customer Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-body">
                <User className="h-5 w-5" />
                Dados do Cliente
              </CardTitle>
              <CardDescription>
                O cliente receberá um convite para acessar o portal
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1">
                  <Label htmlFor="customer_name">Nome Completo *</Label>
                  <Input
                    id="customer_name"
                    value={formData.customer_name}
                    onChange={(e) => handleChange('customer_name', e.target.value)}
                    placeholder="Nome do cliente"
                    className={errors.customer_name ? 'border-destructive' : ''}
                  />
                  {errors.customer_name && <p className="text-xs text-destructive">{errors.customer_name}</p>}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="customer_email">E-mail *</Label>
                  <Input
                    id="customer_email"
                    type="email"
                    value={formData.customer_email}
                    onChange={(e) => handleChange('customer_email', e.target.value)}
                    placeholder="cliente@email.com"
                    className={errors.customer_email ? 'border-destructive' : ''}
                  />
                  {errors.customer_email && <p className="text-xs text-destructive">{errors.customer_email}</p>}
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

              <Separator />

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
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => navigate('/gestao')}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                'Cadastrando...'
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Cadastrar Obra
                </>
              )}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
