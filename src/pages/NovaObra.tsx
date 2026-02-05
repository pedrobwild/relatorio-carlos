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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({ title: 'Erro', description: 'Você precisa estar logado', variant: 'destructive' });
      return;
    }

    // Validation
    if (!formData.name) {
      toast({ title: 'Erro', description: 'Nome do projeto é obrigatório', variant: 'destructive' });
      return;
    }

    // Datas são obrigatórias apenas quando não está em fase de projeto
    if (!formData.is_project_phase && (!formData.planned_start_date || !formData.planned_end_date)) {
      toast({ title: 'Erro', description: 'Datas de início e término são obrigatórias para obras em execução', variant: 'destructive' });
      return;
    }

    if (!formData.customer_name || !formData.customer_email) {
      toast({ title: 'Erro', description: 'Dados do cliente são obrigatórios', variant: 'destructive' });
      return;
    }

    setLoading(true);

    try {
      // 1. Create project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          name: formData.name,
          unit_name: formData.unit_name || null,
          address: formData.address || null,
          planned_start_date: formData.planned_start_date || null,
          planned_end_date: formData.planned_end_date || null,
          contract_value: formData.contract_value ? parseFloat(formData.contract_value) : null,
          created_by: user.id,
          is_project_phase: formData.is_project_phase,
        })
        .select()
        .single();

      if (projectError) throw projectError;

      // 2. Add current user as engineer
      const { error: engineerError } = await supabase
        .from('project_engineers')
        .insert({
          project_id: project.id,
          engineer_user_id: user.id,
          is_primary: true,
        });

      if (engineerError) throw engineerError;

      // 3. Add customer
      const { error: customerError } = await supabase
        .from('project_customers')
        .insert({
          project_id: project.id,
          customer_name: formData.customer_name,
          customer_email: formData.customer_email,
          customer_phone: formData.customer_phone || null,
          invitation_sent_at: sendInvite ? new Date().toISOString() : null,
        });

      if (customerError) throw customerError;

      toast({ 
        title: 'Obra cadastrada!', 
        description: sendInvite 
          ? `Convite enviado para ${formData.customer_email}` 
          : 'Cliente cadastrado sem envio de convite'
      });

      navigate('/gestao');
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="container max-w-3xl mx-auto px-4 py-3">
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

      <main className="container max-w-3xl mx-auto px-4 py-6">
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
