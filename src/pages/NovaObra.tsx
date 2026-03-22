import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useProjectTemplates, type ProjectTemplate, type TemplateActivity } from '@/hooks/useProjectTemplates';
import { addBusinessDays } from '@/lib/businessDays';

import { formSchema, initialFormData, type FormData } from './nova-obra/types';
import { useNovaObraSubmit } from './nova-obra/useNovaObraSubmit';
import { TemplateSelectorCard } from './nova-obra/TemplateSelectorCard';
import { ProjectInfoCard } from './nova-obra/ProjectInfoCard';
import { ScheduleCard } from './nova-obra/ScheduleCard';
import { FinancialCard } from './nova-obra/FinancialCard';
import { CustomerCard } from './nova-obra/CustomerCard';

export default function NovaObra() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: templates } = useProjectTemplates();
  const { submit, user } = useNovaObraSubmit();

  const [loading, setLoading] = useState(false);
  const [sendInvite, setSendInvite] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<FormData>(initialFormData);

  const templateTotalDays = useMemo(() => {
    if (!selectedTemplate?.default_activities) return 0;
    return (selectedTemplate.default_activities as TemplateActivity[]).reduce((s, a) => s + a.durationDays, 0);
  }, [selectedTemplate]);

  const autoCalculateEndDate = (startDateStr: string) => {
    if (!startDateStr || templateTotalDays <= 0) return;
    const start = new Date(startDateStr + 'T00:00:00');
    const end = addBusinessDays(start, templateTotalDays - 1);
    setFormData(prev => ({ ...prev, planned_end_date: end.toISOString().split('T')[0] }));
  };

  const handleChange = (field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
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

    const result = formSchema.safeParse(formData);
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) newErrors[err.path[0] as string] = err.message;
      });
      setErrors(newErrors);
      toast({ title: 'Erro de validação', description: 'Verifique os campos obrigatórios', variant: 'destructive' });
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      await submit(formData, selectedTemplate, sendInvite);
      toast({
        title: 'Obra cadastrada!',
        description: formData.create_user
          ? 'Usuário criado e obra cadastrada com sucesso'
          : sendInvite
            ? `Convite enviado para ${formData.customer_email}`
            : 'Cliente cadastrado sem envio de convite',
      });
      navigate('/gestao');
    } catch (err: unknown) {
      console.error('Error creating project:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      toast({ title: 'Erro ao cadastrar', description: errorMessage, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
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
          {templates && templates.length > 0 && (
            <TemplateSelectorCard
              templates={templates}
              selectedTemplate={selectedTemplate}
              onSelectTemplate={setSelectedTemplate}
              formData={formData}
              onFormChange={handleChange}
              customFieldValues={customFieldValues}
              onCustomFieldChange={setCustomFieldValues}
            />
          )}

          <ProjectInfoCard formData={formData} errors={errors} onChange={handleChange} />
          <ScheduleCard formData={formData} onChange={handleChange} />
          <FinancialCard formData={formData} onChange={handleChange} />
          <CustomerCard formData={formData} errors={errors} sendInvite={sendInvite} onSendInviteChange={setSendInvite} onChange={handleChange} />

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => navigate('/gestao')} className="min-h-[44px]">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="min-h-[44px]">
              {loading ? 'Cadastrando...' : (
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
