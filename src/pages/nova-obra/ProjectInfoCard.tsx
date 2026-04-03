import { Building2, Search, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useCepLookup, formatCep } from '@/hooks/useCepLookup';
import type { FormData } from './types';

interface ProjectInfoCardProps {
  formData: FormData;
  errors: Record<string, string>;
  onChange: (field: keyof FormData, value: string | boolean) => void;
}

export function ProjectInfoCard({ formData, errors, onChange }: ProjectInfoCardProps) {
  const { lookup, loading: cepLoading } = useCepLookup();

  const handleCepChange = (rawValue: string) => {
    const formatted = formatCep(rawValue);
    onChange('cep', formatted);

    const digits = rawValue.replace(/\D/g, '');
    if (digits.length === 8) {
      lookup(digits).then((result) => {
        if (result) {
          if (result.logradouro) onChange('address', result.logradouro);
          if (result.bairro) onChange('bairro', result.bairro);
          toast.success('Endereço preenchido automaticamente');
        }
      });
    }
  };

  const handleManualLookup = async () => {
    const result = await lookup(formData.cep);
    if (result) {
      if (result.logradouro) onChange('address', result.logradouro);
      if (result.bairro) onChange('bairro', result.bairro);
      toast.success('Endereço preenchido automaticamente');
    } else {
      toast.error('CEP não encontrado');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-body">
          <Building2 className="h-5 w-5" />
          Dados da Obra
        </CardTitle>
        <CardDescription>Informações básicas do projeto</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
            onCheckedChange={(checked) => onChange('is_project_phase', checked)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 space-y-1">
            <Label htmlFor="name">Condomínio *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => onChange('name', e.target.value)}
              placeholder="Ex: Hub Brooklyn"
              className={errors.name ? 'border-destructive' : ''}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="unit_name">Unidade</Label>
            <Input id="unit_name" value={formData.unit_name} onChange={(e) => onChange('unit_name', e.target.value)} placeholder="Ex: Apartamento 502" />
          </div>

          {/* CEP with auto-fill */}
          <div className="space-y-1">
            <Label htmlFor="cep">CEP</Label>
            <div className="flex gap-2">
              <Input
                id="cep"
                value={formData.cep}
                onChange={(e) => handleCepChange(e.target.value)}
                placeholder="00000-000"
                maxLength={9}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleManualLookup}
                disabled={cepLoading || !formData.cep}
                title="Buscar endereço pelo CEP"
              >
                {cepLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Digite o CEP para preencher automaticamente</p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="address">Endereço</Label>
            <Input id="address" value={formData.address} onChange={(e) => onChange('address', e.target.value)} placeholder="Endereço completo" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bairro">Bairro</Label>
            <Input id="bairro" value={formData.bairro} onChange={(e) => onChange('bairro', e.target.value)} placeholder="Ex: Pinheiros" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
