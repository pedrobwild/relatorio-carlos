import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, User, Calendar, DollarSign, Send, LayoutTemplate, ChevronDown, ChevronUp, KeyRound, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProjectTemplates, type ProjectTemplate, type TemplateActivity, type TemplateCustomField } from '@/hooks/useProjectTemplates';
import { addBusinessDays, isWeekend } from '@/lib/businessDays';

import { z } from 'zod';

// Validation schema
const formSchema = z.object({
  name: z.string().trim().min(1, 'Condomínio é obrigatório').max(200),
  unit_name: z.string().trim().max(100).optional(),
  address: z.string().trim().max(300).optional(),
  bairro: z.string().trim().max(100).optional(),
  cep: z.string().trim().max(10).optional(),
  planned_start_date: z.string().optional(),
  planned_end_date: z.string().optional(),
  contract_signing_date: z.string().optional(),
  contract_value: z.string().optional(),
  num_installments: z.string().optional(),
  installment_value: z.string().optional(),
  payment_method: z.string().optional(),
  payment_status: z.string().optional(),
  customer_name: z.string().trim().min(1, 'Nome do cliente é obrigatório').max(200),
  customer_email: z.string().trim().email('E-mail inválido').max(255),
  customer_phone: z.string().trim().max(20).optional(),
  customer_password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres').max(72),
  is_project_phase: z.boolean(),
  create_user: z.boolean(),
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
  bairro: string;
  cep: string;
  planned_start_date: string;
  planned_end_date: string;
  contract_signing_date: string;
  contract_value: string;
  num_installments: string;
  installment_value: string;
  payment_method: string;
  payment_status: string;
  // Customer info
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_password: string;
  // Project phase
  is_project_phase: boolean;
  // Create user
  create_user: boolean;
}

export default function NovaObra() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: templates } = useProjectTemplates();
  const [loading, setLoading] = useState(false);
  const [sendInvite, setSendInvite] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);
  const [showActivityPreview, setShowActivityPreview] = useState(false);
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState('__all__');
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState<FormData>({
    name: '',
    unit_name: '',
    address: '',
    bairro: '',
    cep: '',
    planned_start_date: '',
    planned_end_date: '',
    contract_signing_date: '',
    contract_value: '',
    num_installments: '',
    installment_value: '',
    payment_method: '',
    payment_status: 'pending',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    customer_password: '',
    is_project_phase: false,
    create_user: true,
  });

  // Calculate total business days from template activities
  const templateTotalDays = useMemo(() => {
    if (!selectedTemplate?.default_activities) return 0;
    return (selectedTemplate.default_activities as TemplateActivity[]).reduce((s, a) => s + a.durationDays, 0);
  }, [selectedTemplate]);

  // Auto-calculate end date when start date changes and template is selected
  const autoCalculateEndDate = (startDateStr: string) => {
    if (!startDateStr || templateTotalDays <= 0) return;
    const start = new Date(startDateStr + 'T00:00:00');
    // addBusinessDays adds N days; we need totalDays - 1 since start counts as day 1
    const end = addBusinessDays(start, templateTotalDays - 1);
    const fmt = (d: Date) => d.toISOString().split('T')[0];
    setFormData(prev => ({ ...prev, planned_end_date: fmt(end) }));
  };

  const handleChange = (field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when field changes
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
    // Auto-calculate end date when start date changes with template selected
    if (field === 'planned_start_date' && typeof value === 'string' && selectedTemplate) {
      autoCalculateEndDate(value);
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
      // 0. Create user account if enabled
      let createdUserId: string | null = null;
      if (formData.create_user) {
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
              email: formData.customer_email.trim().toLowerCase(),
              password: formData.customer_password,
              display_name: formData.customer_name.trim(),
              role: 'customer',
            }),
          }
        );

        const userResult = await response.json();
        
        if (!response.ok) {
          throw new Error(userResult.error || 'Falha ao criar usuário');
        }
        
        createdUserId = userResult.user?.id || null;
      }

      // 1. Create project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          name: formData.name.trim(),
          unit_name: formData.unit_name.trim() || null,
          address: formData.address.trim() || null,
          bairro: formData.bairro.trim() || null,
          cep: formData.cep.trim() || null,
          planned_start_date: formData.planned_start_date || null,
          planned_end_date: formData.planned_end_date || null,
          contract_signing_date: formData.contract_signing_date || null,
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
      }

      // 4. Add customer
      const { error: customerError } = await supabase
        .from('project_customers')
        .insert({
          project_id: project.id,
          customer_name: formData.customer_name.trim(),
          customer_email: formData.customer_email.trim().toLowerCase(),
          customer_phone: formData.customer_phone.trim() || null,
          customer_user_id: createdUserId || null,
          invitation_sent_at: sendInvite ? new Date().toISOString() : null,
        });

      if (customerError) {
        console.error('Customer creation error:', customerError);
      }

      // 5. If user was created, also add as project member viewer
      if (createdUserId) {
        const { error: viewerError } = await supabase
          .from('project_members')
          .insert({
            project_id: project.id,
            user_id: createdUserId,
            role: 'viewer',
          });
        if (viewerError) {
          console.error('Viewer assignment error:', viewerError);
        }
      }

      // 6. Initialize project journey if in project phase
      if (formData.is_project_phase) {
        const { error: journeyError } = await supabase
          .rpc('initialize_project_journey', { p_project_id: project.id });
        
        if (journeyError) {
          console.error('Journey initialization error:', journeyError);
        }
      }

      // 7. Create activities from template if selected (with auto-predecessors)
      if (selectedTemplate && Array.isArray(selectedTemplate.default_activities) && selectedTemplate.default_activities.length > 0) {
        const activities = selectedTemplate.default_activities as { description: string; durationDays: number; weight: number }[];
        const startDate = formData.planned_start_date ? new Date(formData.planned_start_date + 'T00:00:00') : new Date();
        
        // Skip to next weekday if starting on weekend
        let currentDate = new Date(startDate);
        if (isWeekend(currentDate)) {
          currentDate = addBusinessDays(currentDate, 0);
          currentDate.setDate(currentDate.getDate() + 1);
          while (isWeekend(currentDate)) currentDate.setDate(currentDate.getDate() + 1);
        }

        // First pass: generate IDs and dates
        const activityIds: string[] = [];
        const rows = activities.map((act, idx) => {
          const actId = crypto.randomUUID();
          activityIds.push(actId);
          const actStart = new Date(currentDate);
          const actEnd = addBusinessDays(actStart, act.durationDays - 1);
          // Next activity starts on the next business day after this one ends
          currentDate = addBusinessDays(actEnd, 1);
          const fmt = (d: Date) => d.toISOString().split('T')[0];
          return {
            id: actId,
            project_id: project.id,
            description: act.description,
            planned_start: fmt(actStart),
            planned_end: fmt(actEnd),
            weight: act.weight,
            sort_order: idx,
            created_by: user!.id,
            predecessor_ids: idx > 0 ? [activityIds[idx - 1]] : [],
          };
        });

        const { error: actError } = await supabase
          .from('project_activities')
          .insert(rows as any);
        if (actError) {
          console.error('Activities creation error:', actError);
        }
      }

      // 8. Create payment installments if financial info provided
      if (formData.num_installments && parseInt(formData.num_installments) > 0) {
        const numInstallments = parseInt(formData.num_installments);
        const installmentAmount = formData.installment_value 
          ? parseFloat(formData.installment_value) 
          : (formData.contract_value ? parseFloat(formData.contract_value) / numInstallments : 0);
        
        const paymentRows = Array.from({ length: numInstallments }, (_, i) => ({
          project_id: project.id,
          installment_number: i + 1,
          description: `Parcela ${i + 1}/${numInstallments}${formData.payment_method ? ` - ${formData.payment_method}` : ''}`,
          amount: installmentAmount,
          due_date: null,
          paid_at: formData.payment_status === 'paid' ? new Date().toISOString() : null,
        }));

        const { error: paymentError } = await supabase
          .from('project_payments')
          .insert(paymentRows);
        if (paymentError) {
          console.error('Payment creation error:', paymentError);
        }
      }

      // 9. Increment template usage counter
      if (selectedTemplate) {
        const { error: usageError } = await supabase.rpc('increment_template_usage', { p_template_id: selectedTemplate.id });
        if (usageError) console.error('Usage tracking error:', usageError);
      }

      toast({ 
        title: 'Obra cadastrada!', 
        description: formData.create_user 
          ? `Usuário criado e obra cadastrada com sucesso`
          : sendInvite 
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
            <Button variant="ghost" size="icon" onClick={() => navigate('/gestao')} className="min-h-[44px] min-w-[44px] h-11 w-11" aria-label="Voltar">
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
          {/* Template Selector */}
          {templates && templates.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-body">
                  <LayoutTemplate className="h-5 w-5" />
                  Template
                </CardTitle>
                <CardDescription>Selecione um template para preencher automaticamente</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Category filter */}
                {(() => {
                  const cats = [...new Set((templates ?? []).map(t => t.category || 'geral'))].sort();
                  return cats.length > 1 ? (
                    <div className="flex gap-1.5 flex-wrap mb-3">
                      <Badge
                        variant={templateCategoryFilter === '__all__' ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => setTemplateCategoryFilter('__all__')}
                      >
                        Todos
                      </Badge>
                      {cats.map(c => (
                        <Badge
                          key={c}
                          variant={templateCategoryFilter === c ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => setTemplateCategoryFilter(c)}
                        >
                          {c.charAt(0).toUpperCase() + c.slice(1)}
                        </Badge>
                      ))}
                    </div>
                  ) : null;
                })()}
                <Select
                  onValueChange={(id) => {
                    const tpl = templates.find((t) => t.id === id);
                    if (tpl) {
                      setSelectedTemplate(tpl);
                      setShowActivityPreview(false);
                      setFormData((prev) => {
                        const updated = {
                          ...prev,
                          is_project_phase: tpl.is_project_phase,
                          contract_value: tpl.default_contract_value?.toString() ?? prev.contract_value,
                        };
                        return updated;
                      });
                      // Auto-calculate end date if start date exists
                      if (formData.planned_start_date && Array.isArray(tpl.default_activities) && tpl.default_activities.length > 0) {
                        const totalDays = (tpl.default_activities as TemplateActivity[]).reduce((s, a) => s + a.durationDays, 0);
                        if (totalDays > 0) {
                          const start = new Date(formData.planned_start_date + 'T00:00:00');
                          const end = addBusinessDays(start, totalDays - 1);
                          setFormData(prev => ({ ...prev, planned_end_date: end.toISOString().split('T')[0] }));
                        }
                      }
                      toast({ title: `Template "${tpl.name}" aplicado` });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha um template (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {(templates ?? [])
                      .filter(t => templateCategoryFilter === '__all__' || (t.category || 'geral') === templateCategoryFilter)
                      .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                        {t.description ? ` — ${t.description}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedTemplate && Array.isArray(selectedTemplate.default_activities) && selectedTemplate.default_activities.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary">
                        {selectedTemplate.default_activities.length} atividades
                      </Badge>
                      <Badge variant="outline">
                        {templateTotalDays} dias úteis
                      </Badge>
                      {selectedTemplate.default_activities.reduce((s, a) => s + (a as TemplateActivity).weight, 0) > 0 && (
                        <Badge variant="outline">
                          {selectedTemplate.default_activities.reduce((s, a) => s + (a as TemplateActivity).weight, 0)}% peso total
                        </Badge>
                      )}
                    </div>
                    {/* Mini-Gantt timeline preview */}
                    <div className="rounded-lg border p-3 mt-1 bg-muted/30">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Timeline estimada</p>
                      <div className="space-y-1">
                        {(() => {
                          const acts = selectedTemplate.default_activities as TemplateActivity[];
                          const cumDays: number[] = [];
                          let acc = 0;
                          acts.forEach(a => { cumDays.push(acc); acc += a.durationDays; });
                          const total = acc;
                          return acts.map((act, i) => (
                            <div key={i} className="flex items-center gap-2 group/bar">
                              <span className="text-[10px] text-muted-foreground w-5 text-right shrink-0">{i + 1}</span>
                              <div className="flex-1 h-4 relative rounded-sm overflow-hidden bg-muted">
                                <div
                                  className="absolute top-0 h-full rounded-sm bg-primary/60 group-hover/bar:bg-primary/80 transition-colors"
                                  style={{
                                    left: `${(cumDays[i] / total) * 100}%`,
                                    width: `${Math.max((act.durationDays / total) * 100, 2)}%`,
                                  }}
                                  title={`${act.description} — ${act.durationDays}d`}
                                />
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                      <div className="flex justify-between mt-1.5">
                        <span className="text-[10px] text-muted-foreground">Dia 1</span>
                        <span className="text-[10px] text-muted-foreground">Dia {templateTotalDays}</span>
                      </div>
                    </div>

                    <Collapsible open={showActivityPreview} onOpenChange={setShowActivityPreview}>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-1 h-7 text-xs px-2">
                          {showActivityPreview ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          {showActivityPreview ? 'Ocultar' : 'Ver'} detalhes
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="rounded-lg border overflow-hidden mt-2">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">#</TableHead>
                                <TableHead className="text-xs">Atividade</TableHead>
                                <TableHead className="text-xs w-16 text-right">Dias</TableHead>
                                <TableHead className="text-xs w-16 text-right">Peso</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(selectedTemplate.default_activities as TemplateActivity[]).map((act, i) => (
                                <TableRow key={i}>
                                  <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                                  <TableCell className="text-sm">{act.description}</TableCell>
                                  <TableCell className="text-sm text-right">{act.durationDays}</TableCell>
                                  <TableCell className="text-sm text-right">{act.weight}%</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Custom Fields */}
                    {selectedTemplate.custom_fields && (selectedTemplate.custom_fields as TemplateCustomField[]).length > 0 && (
                      <div className="space-y-3 mt-3 p-3 rounded-lg border bg-muted/30">
                        <p className="text-xs font-medium text-muted-foreground">Campos do template</p>
                        {(selectedTemplate.custom_fields as TemplateCustomField[]).map((field) => (
                          <div key={field.key} className="space-y-1">
                            <Label className="text-sm">{field.label} {field.required && '*'}</Label>
                            {field.type === 'select' && field.options ? (
                              <Select
                                value={customFieldValues[field.key] ?? ''}
                                onValueChange={(v) => setCustomFieldValues(prev => ({ ...prev, [field.key]: v }))}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {field.options.map(opt => (
                                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input
                                type={field.type === 'number' ? 'number' : 'text'}
                                value={customFieldValues[field.key] ?? ''}
                                onChange={(e) => setCustomFieldValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                                placeholder={field.label}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

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
                  <Label htmlFor="name">Condomínio *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="Ex: Hub Brooklyn"
                    className={errors.name ? 'border-destructive' : ''}
                  />
                  {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="unit_name">Unidade</Label>
                  <Input
                    id="unit_name"
                    value={formData.unit_name}
                    onChange={(e) => handleChange('unit_name', e.target.value)}
                    placeholder="Ex: Apartamento 502"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="address">Endereço</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => handleChange('address', e.target.value)}
                    placeholder="Endereço completo"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="bairro">Bairro</Label>
                  <Input
                    id="bairro"
                    value={formData.bairro}
                    onChange={(e) => handleChange('bairro', e.target.value)}
                    placeholder="Ex: Pinheiros"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cep">CEP</Label>
                  <Input
                    id="cep"
                    value={formData.cep}
                    onChange={(e) => handleChange('cep', e.target.value)}
                    placeholder="00000-000"
                    maxLength={9}
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
              <CardDescription>
                {formData.is_project_phase 
                  ? 'Datas macro do projeto e assinatura do contrato' 
                  : 'Datas previstas de início e término'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.is_project_phase && (
                <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg mb-4">
                  <p>Obra em fase de projeto. As datas podem ser definidas agora ou marcadas como "Em definição".</p>
                </div>
              )}

              {/* Contract signing date - only for project phase */}
              {formData.is_project_phase && (
                <div className="space-y-2">
                  <Label htmlFor="contract_signing_date">Data de Assinatura do Contrato</Label>
                  {formData.is_project_phase && (
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        id="contract_date_undefined"
                        checked={formData.contract_signing_date === ''}
                        onChange={(e) => handleChange('contract_signing_date', e.target.checked ? '' : '')}
                        className="h-4 w-4 rounded border-border"
                      />
                      <Label htmlFor="contract_date_undefined" className="text-caption cursor-pointer text-muted-foreground">
                        Em definição
                      </Label>
                    </div>
                  )}
                  {formData.contract_signing_date !== '' ? (
                    <Input
                      id="contract_signing_date"
                      type="date"
                      value={formData.contract_signing_date}
                      onChange={(e) => handleChange('contract_signing_date', e.target.value)}
                    />
                  ) : (
                    <Input
                      id="contract_signing_date"
                      disabled
                      placeholder="Em definição"
                      value=""
                    />
                  )}
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
              <CardDescription>Dados financeiros e condições de pagamento</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="contract_value">Valor Total do Contrato (R$)</Label>
                  <Input
                    id="contract_value"
                    type="number"
                    step="0.01"
                    value={formData.contract_value}
                    onChange={(e) => handleChange('contract_value', e.target.value)}
                    placeholder="0,00"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="num_installments">Número de Parcelas</Label>
                  <Input
                    id="num_installments"
                    type="number"
                    min="1"
                    max="120"
                    value={formData.num_installments}
                    onChange={(e) => {
                      handleChange('num_installments', e.target.value);
                      // Auto-calculate installment value
                      if (formData.contract_value && e.target.value) {
                        const total = parseFloat(formData.contract_value);
                        const n = parseInt(e.target.value);
                        if (total > 0 && n > 0) {
                          handleChange('installment_value', (total / n).toFixed(2));
                        }
                      }
                    }}
                    placeholder="Ex: 12"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="installment_value">Valor da Parcela (R$)</Label>
                  <Input
                    id="installment_value"
                    type="number"
                    step="0.01"
                    value={formData.installment_value}
                    onChange={(e) => handleChange('installment_value', e.target.value)}
                    placeholder="0,00"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="payment_method">Forma de Pagamento</Label>
                  <Select
                    value={formData.payment_method}
                    onValueChange={(v) => handleChange('payment_method', v)}
                  >
                    <SelectTrigger id="payment_method">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="boleto">Boleto</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="transferencia">Transferência</SelectItem>
                      <SelectItem value="cartao">Cartão de Crédito</SelectItem>
                      <SelectItem value="financiamento">Financiamento</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="payment_status">Status do Pagamento</Label>
                  <Select
                    value={formData.payment_status}
                    onValueChange={(v) => handleChange('payment_status', v)}
                  >
                    <SelectTrigger id="payment_status">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="partial">Parcialmente Pago</SelectItem>
                      <SelectItem value="paid">Pago</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
                Informações do cliente e criação de acesso ao portal
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

              {/* Create User Toggle */}
              <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/50">
                <div className="space-y-0.5">
                  <Label htmlFor="create_user" className="text-sm font-medium flex items-center gap-2">
                    <KeyRound className="h-4 w-4" />
                    Criar acesso ao portal
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Cria automaticamente o login do cliente com e-mail e senha definidos
                  </p>
                </div>
                <Switch
                  id="create_user"
                  checked={formData.create_user}
                  onCheckedChange={(checked) => handleChange('create_user', checked)}
                />
              </div>

              {formData.create_user && (
                <div className="space-y-1">
                  <Label htmlFor="customer_password">Senha do Cliente *</Label>
                  <div className="relative">
                    <Input
                      id="customer_password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.customer_password}
                      onChange={(e) => handleChange('customer_password', e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className={errors.customer_password ? 'border-destructive pr-10' : 'pr-10'}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </div>
                  {errors.customer_password && <p className="text-xs text-destructive">{errors.customer_password}</p>}
                </div>
              )}

              {!formData.create_user && (
                <>
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
                </>
              )}
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => navigate('/gestao')} className="min-h-[44px]">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="min-h-[44px]">
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
