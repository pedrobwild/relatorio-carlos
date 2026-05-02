import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Save, User, Building2, Loader2, Search, FileText } from 'lucide-react';
import { ProjectInfoDoc } from '@/components/project/ProjectInfoDoc';
import { useCepLookup, formatCep } from '@/hooks/useCepLookup';
import { formatCpf, formatRg, isValidCpf, isValidRg } from '@/lib/documentValidation';
import {
  ResponsiveTabsRoot,
  ResponsiveTabsList,
  ResponsiveTabsTrigger,
} from '@/components/mobile';
import { cn } from '@/lib/utils';

interface CustomerData {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  nacionalidade: string | null;
  estado_civil: string | null;
  profissao: string | null;
  cpf: string | null;
  rg: string | null;
  endereco_residencial: string | null;
  cidade: string | null;
  estado: string | null;
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
}

interface ProjectBasic {
  name: string;
  unit_name: string | null;
}

interface DadosClienteProps {
  /**
   * ID da obra. Quando ausente, é lido de `useParams` (uso como rota).
   * Quando informado (ex.: dentro de um Dialog no Painel de Obras),
   * o componente ignora o roteador e funciona como widget embutido.
   */
  projectId?: string;
  /**
   * Quando true, o componente é tratado como widget embutido em
   * Dialog/Sheet: o cabeçalho duplicado ("Dados do Cliente" + ação Salvar
   * inline) é omitido e a ação Salvar fica em uma barra sticky no rodapé,
   * compatível com a viewport mobile e safe areas.
   *
   * Use sempre que renderizar dentro de `DadosClienteDialog` ou
   * `MobileFullscreenSheet` — o invólucro já provê título/descrição.
   */
  embedded?: boolean;
}

export default function DadosCliente({ projectId: propProjectId, embedded = false }: DadosClienteProps = {}) {
  const params = useParams<{ projectId: string }>();
  const projectId = propProjectId ?? params.projectId;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'contratante' | 'imovel' | 'info'>('contratante');
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [studio, setStudio] = useState<StudioData | null>(null);
  const [project, setProject] = useState<ProjectBasic | null>(null);
  const { lookup: lookupCep, loading: cepLoading } = useCepLookup();

  useEffect(() => {
    if (projectId) fetchData();
  }, [projectId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [customerRes, studioRes, projectRes] = await Promise.all([
        supabase.from('project_customers').select('*').eq('project_id', projectId!).maybeSingle(),
        supabase.from('project_studio_info').select('*').eq('project_id', projectId!).maybeSingle(),
        supabase.from('projects').select('name, unit_name').eq('id', projectId!).single(),
      ]);

      if (customerRes.data) setCustomer(customerRes.data as CustomerData);
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

  const handleSave = async () => {
    if (!projectId) return;
    // Validate CPF/RG before saving
    if (customer?.cpf && !isValidCpf(customer.cpf)) {
      toast.error('CPF inválido. Corrija antes de salvar.');
      return;
    }
    if (customer?.rg && !isValidRg(customer.rg)) {
      toast.error('RG inválido. Corrija antes de salvar.');
      return;
    }
    setSaving(true);
    try {
      if (customer) {
        const { id, ...rest } = customer;
        const { error: custErr } = await supabase
          .from('project_customers')
          .update({
            customer_name: rest.customer_name,
            customer_email: rest.customer_email,
            customer_phone: rest.customer_phone,
            nacionalidade: rest.nacionalidade,
            estado_civil: rest.estado_civil,
            profissao: rest.profissao,
            cpf: rest.cpf,
            rg: rest.rg,
            endereco_residencial: rest.endereco_residencial,
            cidade: rest.cidade,
            estado: rest.estado,
          })
          .eq('id', id);
        if (custErr) throw custErr;
      }

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
          }, { onConflict: 'project_id' });
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

  const updateCustomer = (field: keyof CustomerData, value: string | null) => {
    if (!customer) return;
    setCustomer({ ...customer, [field]: value });
  };

  const updateStudio = (field: keyof StudioData, value: string | number | null) => {
    if (!studio) return;
    setStudio({ ...studio, [field]: value });
  };

  const handleCepChange = (rawValue: string) => {
    const formatted = formatCep(rawValue);
    updateStudio('cep', formatted || null);

    // Auto-lookup when 8 digits entered
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
        // Quando embutido (dialog/sheet) o invólucro já tem padding e
        // largura; aqui só damos um respiro lateral consistente. Quando
        // usado como página standalone, mantemos o layout original.
        embedded ? 'max-w-3xl px-4 pt-3 pb-4 md:px-6 md:pt-4' : 'max-w-4xl p-4 md:p-6',
        // Reserva espaço inferior para a sticky bar de Salvar não cobrir
        // o último campo. ~80px = 64px barra + 16px folga (mais safe-area).
        'pb-[calc(80px+env(safe-area-inset-bottom,0px))]',
      )}
    >
      {/* Header inline — só quando NÃO está embutido (rota /obra/:id/dados-cliente). */}
      {!embedded && (
        <div className="flex items-center justify-between mb-5">
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-foreground truncate">Dados do Cliente</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Informações cadastrais do contratante e do imóvel
            </p>
          </div>
        </div>
      )}

      <ResponsiveTabsRoot
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'contratante' | 'imovel' | 'info')}
        className="w-full"
      >
        <ResponsiveTabsList ariaLabel="Seções dos dados do cliente" className="md:w-auto">
          <ResponsiveTabsTrigger value="contratante">
            <User className="h-4 w-4" />
            Contratante
          </ResponsiveTabsTrigger>
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

      {/* ── Cliente (Contratante) ── */}
      {activeTab === 'contratante' && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Contratante
          </CardTitle>
          <CardDescription>Dados pessoais e de contato do cliente</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {customer ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label>Nome completo *</Label>
                <Input
                  value={customer.customer_name}
                  onChange={(e) => updateCustomer('customer_name', e.target.value)}
                  placeholder="Nome completo"
                />
              </div>
              <div>
                <Label>Nacionalidade</Label>
                <Input
                  value={customer.nacionalidade || ''}
                  onChange={(e) => updateCustomer('nacionalidade', e.target.value || null)}
                  placeholder="Ex: brasileira"
                />
              </div>
              <div>
                <Label>Estado civil</Label>
                <Input
                  value={customer.estado_civil || ''}
                  onChange={(e) => updateCustomer('estado_civil', e.target.value || null)}
                  placeholder="Ex: casada"
                />
              </div>
              <div>
                <Label>Profissão</Label>
                <Input
                  value={customer.profissao || ''}
                  onChange={(e) => updateCustomer('profissao', e.target.value || null)}
                  placeholder="Ex: engenheira civil"
                />
              </div>
              <div>
                <Label>CPF *</Label>
                <Input
                  value={customer.cpf || ''}
                  onChange={(e) => updateCustomer('cpf', formatCpf(e.target.value) || null)}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  className={customer.cpf && !isValidCpf(customer.cpf) ? 'border-destructive' : ''}
                />
                {customer.cpf && !isValidCpf(customer.cpf) && (
                  <p className="text-xs text-destructive mt-1">CPF inválido</p>
                )}
              </div>
              <div>
                <Label>RG *</Label>
                <Input
                  value={customer.rg || ''}
                  onChange={(e) => updateCustomer('rg', formatRg(e.target.value) || null)}
                  placeholder="00.000.000-0"
                  maxLength={12}
                  className={customer.rg && !isValidRg(customer.rg) ? 'border-destructive' : ''}
                />
                {customer.rg && !isValidRg(customer.rg) && (
                  <p className="text-xs text-destructive mt-1">RG inválido</p>
                )}
              </div>
              <div className="sm:col-span-2">
                <Label>Endereço residencial *</Label>
                <Input
                  value={customer.endereco_residencial || ''}
                  onChange={(e) => updateCustomer('endereco_residencial', e.target.value || null)}
                  placeholder="Rua, número, bairro, cidade/UF, CEP"
                />
              </div>
              <div>
                <Label>Cidade</Label>
                <Input
                  value={customer.cidade || ''}
                  onChange={(e) => updateCustomer('cidade', e.target.value || null)}
                  placeholder="Ex: São Paulo"
                />
              </div>
              <div>
                <Label>Estado</Label>
                <Input
                  value={customer.estado || ''}
                  onChange={(e) => updateCustomer('estado', e.target.value || null)}
                  placeholder="Ex: SP"
                />
              </div>
              <div>
                <Label>E-mail *</Label>
                <Input
                  type="email"
                  value={customer.customer_email}
                  onChange={(e) => updateCustomer('customer_email', e.target.value)}
                  placeholder="seu@email.com"
                />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input
                  value={customer.customer_phone || ''}
                  onChange={(e) => updateCustomer('customer_phone', e.target.value || null)}
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Nenhum cliente cadastrado para esta obra.</p>
          )}
        </CardContent>
      </Card>
      )}

      {/* ── Obra (Imóvel) ── */}
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

            {/* CEP with auto-fill */}
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
        <ProjectInfoDoc projectId={projectId} />
      )}
      </div>

      {/* ── Sticky save bar ──────────────────────────────────────────────
          Mantém "Salvar" sempre acessível mesmo em formulários longos no
          mobile. Em DadosClienteDialog (mobile full-screen), esta barra
          fica colada acima da safe-area inferior; no desktop standalone,
          fica colada ao rodapé do scroller dentro do container. */}
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
            disabled={saving}
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
