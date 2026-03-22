import { Building2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { FormData } from './types';

interface ProjectInfoCardProps {
  formData: FormData;
  errors: Record<string, string>;
  onChange: (field: keyof FormData, value: string | boolean) => void;
}

export function ProjectInfoCard({ formData, errors, onChange }: ProjectInfoCardProps) {
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
          <div className="space-y-1">
            <Label htmlFor="address">Endereço</Label>
            <Input id="address" value={formData.address} onChange={(e) => onChange('address', e.target.value)} placeholder="Endereço completo" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bairro">Bairro</Label>
            <Input id="bairro" value={formData.bairro} onChange={(e) => onChange('bairro', e.target.value)} placeholder="Ex: Pinheiros" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cep">CEP</Label>
            <Input id="cep" value={formData.cep} onChange={(e) => onChange('cep', e.target.value)} placeholder="00000-000" maxLength={9} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
