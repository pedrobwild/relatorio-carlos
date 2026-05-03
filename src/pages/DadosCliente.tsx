import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Save, Building2, Loader2, Search, FileText, UserCog, Users, Clock } from 'lucide-react';
import { ProjectInfoDoc } from '@/components/project/ProjectInfoDoc';
import { useCepLookup, formatCep } from '@/hooks/useCepLookup';
import {
  ResponsiveTabsRoot,
  ResponsiveTabsList,
  ResponsiveTabsTrigger,
} from '@/components/mobile';
import { cn } from '@/lib/utils';

// ── Validações dos contatos (gerente predial e síndico) ──────────────
// Email RFC 5322 simplificado; telefone BR aceita 10 ou 11 dígitos
// (com ou sem máscara). Nome exige pelo menos 2 caracteres não vazios.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validateContactName(value: string | null): string | null {
  if (!value || !value.trim()) return null; // opcional
  if (value.trim().length < 2) return 'Nome muito curto';
  if (value.trim().length > 120) return 'Nome muito longo';
  return null;
}

function validateContactEmail(value: string | null): string | null {
  if (!value || !value.trim()) return null;
  if (!EMAIL_RE.test(value.trim())) return 'E-mail inválido';
  return null;
}

function validateContactPhone(value: string | null): string | null {
  if (!value || !value.trim()) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 11) {
    return 'Telefone deve ter 10 ou 11 dígitos';
  }
  return null;
}

interface ContactErrors {
  building_manager_name?: string;
  building_manager_email?: string;
  building_manager_phone?: string;
  syndic_name?: string;
  syndic_email?: string;
  syndic_phone?: string;
}

interface StudioData {
  project_id: string;
  nome_do_empreendimento: string | null;
  endereco_completo: string | null;
  bairro: string | null;
  cidade: string | null;
  cep: string | null;
  complemento: string | null;
  tamanho_imovel_m2: number | null;
  tipo_de_locacao: string | null;
  data_recebimento_chaves: string | null;
  building_manager_name: string | null;
  building_manager_email: string | null;
  building_manager_phone: string | null;
  syndic_name: string | null;
  syndic_email: string | null;
  syndic_phone: string | null;
  allowed_work_days: string[] | null;
  allowed_work_start_time: string | null;
  allowed_work_end_time: string | null;
}

interface ProjectBasic {
  name: string;
  unit_name: string | null;
}

interface DadosClienteProps {
  projectId?: string;
  embedded?: boolean;
}

const WEEK_DAYS: { value: string; label: string; short: string }[] = [
  { value: 'mon', label: 'Segunda', short: 'Seg' },
  { value: 'tue', label: 'Terça', short: 'Ter' },
  { value: 'wed', label: 'Quarta', short: 'Qua' },
  { value: 'thu', label: 'Quinta', short: 'Qui' },
  { value: 'fri', label: 'Sexta', short: 'Sex' },
  { value: 'sat', label: 'Sábado', short: 'Sáb' },
  { value: 'sun', label: 'Domingo', short: 'Dom' },
];

export default function DadosCliente({ projectId: propProjectId, embedded = false }: DadosClienteProps = {}) {
  const params = useParams<{ projectId: string }>();
  const projectId = propProjectId ?? params.projectId;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'imovel' | 'info'>('imovel');
  const [studio, setStudio] = useState<StudioData | null>(null);
  const [project, setProject] = useState<ProjectBasic | null>(null);
  const { lookup: lookupCep, loading: cepLoading } = useCepLookup();

  useEffect(() => {
    if (projectId) fetchData();
  }, [projectId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [studioRes, projectRes] = await Promise.all([
        supabase.from('project_studio_info').select('*').eq('project_id', projectId!).maybeSingle(),
        supabase.from('projects').select('name, unit_name').eq('id', projectId!).single(),
      ]);

      if (studioRes.data) {
        setStudio(studioRes.data as StudioData);
      } else {
        setStudio({
          project_id: projectId!,
          nome_do_empreendimento: null,
          endereco_completo: null,
          bairro: null,
          cidade: null,
          cep: null,
          complemento: null,
          tamanho_imovel_m2: null,
          tipo_de_locacao: null,
          data_recebimento_chaves: null,
          building_manager_name: null,
          building_manager_email: null,
          building_manager_phone: null,
          syndic_name: null,
          syndic_email: null,
          syndic_phone: null,
          allowed_work_days: null,
          allowed_work_start_time: null,
          allowed_work_end_time: null,
        });
      }
      if (projectRes.data) setProject(projectRes.data);
    } catch (err) {
      console.error('Error fetching client data:', err);
      toast.error('Erro ao carregar dados do cliente');
    } finally {
      setLoading(false);
    }
  };

  const contactErrors: ContactErrors = {
    building_manager_name: validateContactName(studio?.building_manager_name ?? null) ?? undefined,
    building_manager_email: validateContactEmail(studio?.building_manager_email ?? null) ?? undefined,
    building_manager_phone: validateContactPhone(studio?.building_manager_phone ?? null) ?? undefined,
    syndic_name: validateContactName(studio?.syndic_name ?? null) ?? undefined,
    syndic_email: validateContactEmail(studio?.syndic_email ?? null) ?? undefined,
    syndic_phone: validateContactPhone(studio?.syndic_phone ?? null) ?? undefined,
  };
  const hasContactErrors = Object.values(contactErrors).some(Boolean);

  const handleSave = async () => {
    if (!projectId) return;
    if (hasContactErrors) {
      toast.error('Corrija os campos de contato destacados antes de salvar');
      setActiveTab('info');
      return;
    }
    setSaving(true);
    try {
      if (studio) {
        const { error: studioErr } = await supabase
          .from('project_studio_info')
          .upsert({
            project_id: projectId,
            nome_do_empreendimento: studio.nome_do_empreendimento,
            endereco_completo: studio.endereco_completo,
            bairro: studio.bairro,
            cidade: studio.cidade,
            cep: studio.cep,
            complemento: studio.complemento,
            tamanho_imovel_m2: studio.tamanho_imovel_m2,
            tipo_de_locacao: studio.tipo_de_locacao,
            data_recebimento_chaves: studio.data_recebimento_chaves,
            building_manager_name: studio.building_manager_name,
            building_manager_email: studio.building_manager_email,
            building_manager_phone: studio.building_manager_phone,
            syndic_name: studio.syndic_name,
            syndic_email: studio.syndic_email,
            syndic_phone: studio.syndic_phone,
            allowed_work_days: studio.allowed_work_days,
            allowed_work_start_time: studio.allowed_work_start_time,
            allowed_work_end_time: studio.allowed_work_end_time,
          } as any, { onConflict: 'project_id' });
        if (studioErr) throw studioErr;
      }

      toast.success('Dados salvos com sucesso');
    } catch (err) {
      console.error('Error saving client data:', err);
      toast.error('Erro ao salvar dados');
    } finally {
      setSaving(false);
    }
  };

  const updateStudio = (field: keyof StudioData, value: string | number | string[] | null) => {
    if (!studio) return;
    setStudio({ ...studio, [field]: value });
  };

  const handleCepChange = (rawValue: string) => {
    const formatted = formatCep(rawValue);
    updateStudio('cep', formatted || null);

    const digits = rawValue.replace(/\D/g, '');
    if (digits.length === 8) {
      lookupCep(digits).then((result) => {
        if (result && studio) {
          setStudio((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              cep: formatted,
              endereco_completo: result.logradouro || prev.endereco_completo,
              bairro: result.bairro || prev.bairro,
              cidade: result.cidade || prev.cidade,
            };
          });
          toast.success('Endereço preenchido automaticamente');
        }
      });
    }
  };

  const handleManualCepLookup = async () => {
    if (!studio?.cep) return;
    const result = await lookupCep(studio.cep);
    if (result) {
      setStudio((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          endereco_completo: result.logradouro || prev.endereco_completo,
          bairro: result.bairro || prev.bairro,
          cidade: result.cidade || prev.cidade,
        };
      });
      toast.success('Endereço preenchido automaticamente');
    } else {
      toast.error('CEP não encontrado');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'mx-auto w-full',
        embedded ? 'max-w-3xl px-4 pt-3 pb-4 md:px-6 md:pt-4' : 'max-w-4xl p-4 md:p-6',
        'pb-[calc(80px+env(safe-area-inset-bottom,0px))]',
      )}
    >
      {!embedded && (
        <div className="flex items-center justify-between mb-5">
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-foreground truncate">Dados do Cliente</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Informações do imóvel e do projeto
            </p>
          </div>
        </div>
      )}

      <ResponsiveTabsRoot
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'imovel' | 'info')}
        className="w-full"
      >
        <ResponsiveTabsList ariaLabel="Seções dos dados do cliente" className="md:w-auto">
          <ResponsiveTabsTrigger value="imovel">
            <Building2 className="h-4 w-4" />
            Imóvel
          </ResponsiveTabsTrigger>
          <ResponsiveTabsTrigger value="info">
            <FileText className="h-4 w-4" />
            Informações do Projeto
          </ResponsiveTabsTrigger>
        </ResponsiveTabsList>
      </ResponsiveTabsRoot>

      <div className="mt-4 space-y-6">

      {/* ── Imóvel ── */}
      {activeTab === 'imovel' && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Imóvel
          </CardTitle>
          <CardDescription>Dados do imóvel que será reformado</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Unidade / Apartamento *</Label>
              <Input
                value={project?.name || ''}
                disabled
                className="bg-muted"
                placeholder="Nome da obra"
              />
            </div>
            <div>
              <Label>Metragem</Label>
              <Input
                type="number"
                step="0.01"
                value={studio?.tamanho_imovel_m2 ?? ''}
                onChange={(e) => updateStudio('tamanho_imovel_m2', e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="Ex: 31m²"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Empreendimento *</Label>
              <Input
                value={studio?.nome_do_empreendimento || ''}
                onChange={(e) => updateStudio('nome_do_empreendimento', e.target.value || null)}
                placeholder="Nome do empreendimento"
              />
            </div>

            <div>
              <Label>CEP</Label>
              <div className="flex gap-2">
                <Input
                  value={studio?.cep || ''}
                  onChange={(e) => handleCepChange(e.target.value)}
                  placeholder="00000-000"
                  maxLength={9}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleManualCepLookup}
                  disabled={cepLoading || !studio?.cep}
                  title="Buscar endereço pelo CEP"
                >
                  {cepLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Digite o CEP para preencher o endereço automaticamente
              </p>
            </div>

            <div>
              <Label>Complemento</Label>
              <Input
                value={studio?.complemento || ''}
                onChange={(e) => updateStudio('complemento', e.target.value || null)}
                placeholder="Apto, Bloco"
              />
            </div>

            <div className="sm:col-span-2">
              <Label>Endereço do imóvel *</Label>
              <Input
                value={studio?.endereco_completo || ''}
                onChange={(e) => updateStudio('endereco_completo', e.target.value || null)}
                placeholder="Rua, número"
              />
            </div>
            <div>
              <Label>Bairro</Label>
              <Input
                value={studio?.bairro || ''}
                onChange={(e) => updateStudio('bairro', e.target.value || null)}
                placeholder="Ex: Jardins"
              />
            </div>
            <div>
              <Label>Cidade</Label>
              <Input
                value={studio?.cidade || ''}
                onChange={(e) => updateStudio('cidade', e.target.value || null)}
                placeholder="Ex: São Paulo"
              />
            </div>
            <div>
              <Label>Tipo de locação</Label>
              <Select
                value={studio?.tipo_de_locacao || ''}
                onValueChange={(v) => updateStudio('tipo_de_locacao', v || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Residencial">Residencial</SelectItem>
                  <SelectItem value="Comercial">Comercial</SelectItem>
                  <SelectItem value="Apartamento">Apartamento</SelectItem>
                  <SelectItem value="Casa">Casa</SelectItem>
                  <SelectItem value="Studio">Studio</SelectItem>
                  <SelectItem value="Cobertura">Cobertura</SelectItem>
                  <SelectItem value="Sala Comercial">Sala Comercial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data recebimento das chaves</Label>
              <Input
                type="date"
                value={studio?.data_recebimento_chaves || ''}
                onChange={(e) => updateStudio('data_recebimento_chaves', e.target.value || null)}
              />
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      {/* ── Informações do Projeto ── */}
      {activeTab === 'info' && projectId && (
        <div className="space-y-6">
          {/* Contato gerente predial */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCog className="h-5 w-5" />
                Contato gerente predial
              </CardTitle>
              <CardDescription>Responsável pela administração do edifício</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="bm-name">Nome</Label>
                  <Input
                    id="bm-name"
                    value={studio?.building_manager_name || ''}
                    onChange={(e) => updateStudio('building_manager_name', e.target.value || null)}
                    placeholder="Nome completo"
                    aria-invalid={!!contactErrors.building_manager_name}
                    aria-describedby={contactErrors.building_manager_name ? 'bm-name-err' : undefined}
                    className={contactErrors.building_manager_name ? 'border-destructive focus-visible:ring-destructive' : ''}
                  />
                  {contactErrors.building_manager_name && (
                    <p id="bm-name-err" className="text-xs text-destructive mt-1">{contactErrors.building_manager_name}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="bm-email">E-mail</Label>
                  <Input
                    id="bm-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={studio?.building_manager_email || ''}
                    onChange={(e) => updateStudio('building_manager_email', e.target.value || null)}
                    placeholder="email@exemplo.com"
                    aria-invalid={!!contactErrors.building_manager_email}
                    aria-describedby={contactErrors.building_manager_email ? 'bm-email-err' : undefined}
                    className={contactErrors.building_manager_email ? 'border-destructive focus-visible:ring-destructive' : ''}
                  />
                  {contactErrors.building_manager_email && (
                    <p id="bm-email-err" className="text-xs text-destructive mt-1">{contactErrors.building_manager_email}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="bm-phone">Telefone</Label>
                  <Input
                    id="bm-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={studio?.building_manager_phone || ''}
                    onChange={(e) => updateStudio('building_manager_phone', e.target.value || null)}
                    placeholder="(11) 99999-9999"
                    aria-invalid={!!contactErrors.building_manager_phone}
                    aria-describedby={contactErrors.building_manager_phone ? 'bm-phone-err' : undefined}
                    className={contactErrors.building_manager_phone ? 'border-destructive focus-visible:ring-destructive' : ''}
                  />
                  {contactErrors.building_manager_phone && (
                    <p id="bm-phone-err" className="text-xs text-destructive mt-1">{contactErrors.building_manager_phone}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contato síndico */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Contato síndico
              </CardTitle>
              <CardDescription>Síndico do condomínio</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="syn-name">Nome</Label>
                  <Input
                    id="syn-name"
                    value={studio?.syndic_name || ''}
                    onChange={(e) => updateStudio('syndic_name', e.target.value || null)}
                    placeholder="Nome completo"
                    aria-invalid={!!contactErrors.syndic_name}
                    aria-describedby={contactErrors.syndic_name ? 'syn-name-err' : undefined}
                    className={contactErrors.syndic_name ? 'border-destructive focus-visible:ring-destructive' : ''}
                  />
                  {contactErrors.syndic_name && (
                    <p id="syn-name-err" className="text-xs text-destructive mt-1">{contactErrors.syndic_name}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="syn-email">E-mail</Label>
                  <Input
                    id="syn-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={studio?.syndic_email || ''}
                    onChange={(e) => updateStudio('syndic_email', e.target.value || null)}
                    placeholder="email@exemplo.com"
                    aria-invalid={!!contactErrors.syndic_email}
                    aria-describedby={contactErrors.syndic_email ? 'syn-email-err' : undefined}
                    className={contactErrors.syndic_email ? 'border-destructive focus-visible:ring-destructive' : ''}
                  />
                  {contactErrors.syndic_email && (
                    <p id="syn-email-err" className="text-xs text-destructive mt-1">{contactErrors.syndic_email}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="syn-phone">Telefone</Label>
                  <Input
                    id="syn-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={studio?.syndic_phone || ''}
                    onChange={(e) => updateStudio('syndic_phone', e.target.value || null)}
                    placeholder="(11) 99999-9999"
                    aria-invalid={!!contactErrors.syndic_phone}
                    aria-describedby={contactErrors.syndic_phone ? 'syn-phone-err' : undefined}
                    className={contactErrors.syndic_phone ? 'border-destructive focus-visible:ring-destructive' : ''}
                  />
                  {contactErrors.syndic_phone && (
                    <p id="syn-phone-err" className="text-xs text-destructive mt-1">{contactErrors.syndic_phone}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dias e horários permitidos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Dias e horários permitidos para trabalho
              </CardTitle>
              <CardDescription>
                Selecione os dias da semana e a janela de horário liberada pelo condomínio
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="mb-2 block">Dias da semana</Label>
                <ToggleGroup
                  type="multiple"
                  value={studio?.allowed_work_days || []}
                  onValueChange={(value) =>
                    updateStudio('allowed_work_days', value.length ? value : null)
                  }
                  className="flex flex-wrap justify-start gap-2"
                >
                  {WEEK_DAYS.map((day) => (
                    <ToggleGroupItem
                      key={day.value}
                      value={day.value}
                      aria-label={day.label}
                      className="min-w-[56px]"
                    >
                      {day.short}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Horário de início</Label>
                  <Input
                    type="time"
                    value={studio?.allowed_work_start_time || ''}
                    onChange={(e) =>
                      updateStudio('allowed_work_start_time', e.target.value || null)
                    }
                  />
                </div>
                <div>
                  <Label>Horário de término</Label>
                  <Input
                    type="time"
                    value={studio?.allowed_work_end_time || ''}
                    onChange={(e) =>
                      updateStudio('allowed_work_end_time', e.target.value || null)
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Rich text livre */}
          <ProjectInfoDoc projectId={projectId} />
        </div>
      )}
      </div>

      {/* ── Sticky save bar ── */}
      <div
        className={cn(
          'sticky bottom-0 -mx-4 md:-mx-6 mt-6',
          'bg-background/95 backdrop-blur border-t border-border-subtle',
          'pl-safe pr-safe pb-safe',
        )}
      >
        <div className="px-4 md:px-6 py-3 flex items-center justify-end gap-2">
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || hasContactErrors}
            title={hasContactErrors ? 'Corrija os campos de contato destacados' : undefined}
            size="lg"
            className="min-w-[140px] h-11"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar
          </Button>
        </div>
      </div>
    </div>
  );
}
