import { Building2, Search, Loader2, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useCepLookup, formatCep } from "@/hooks/useCepLookup";
import { AiFieldIndicator } from "./AiFieldIndicator";
import type { FormData } from "./types";

interface ProjectInfoCardProps {
  formData: FormData;
  errors: Record<string, string>;
  onChange: (field: keyof FormData, value: string | boolean) => void;
  aiPrefilledFields?: Set<string>;
  aiConflictFields?: Set<string>;
}

export function ProjectInfoCard({
  formData,
  errors,
  onChange,
  aiPrefilledFields = new Set(),
  aiConflictFields = new Set(),
}: ProjectInfoCardProps) {
  const { lookup, loading: cepLoading } = useCepLookup();

  const handleCepChange = (rawValue: string) => {
    const formatted = formatCep(rawValue);
    onChange("cep", formatted);

    const digits = rawValue.replace(/\D/g, "");
    if (digits.length === 8) {
      lookup(digits).then((result) => {
        if (result) {
          if (result.logradouro) onChange("address", result.logradouro);
          if (result.bairro) onChange("bairro", result.bairro);
          if (result.cidade) onChange("cidade_imovel", result.cidade);
          toast.success("Endereço preenchido automaticamente");
        } else {
          toast.error("CEP não encontrado. Preencha o endereço manualmente.");
        }
      });
    }
  };

  const handleManualLookup = async () => {
    const result = await lookup(formData.cep);
    if (result) {
      if (result.logradouro) onChange("address", result.logradouro);
      if (result.bairro) onChange("bairro", result.bairro);
      if (result.cidade) onChange("cidade_imovel", result.cidade);
      toast.success("Endereço preenchido automaticamente");
    } else {
      toast.error("CEP não encontrado");
    }
  };

  const ai = (field: string) => (
    <AiFieldIndicator
      fieldName={field}
      aiPrefilledFields={aiPrefilledFields}
      aiConflictFields={aiConflictFields}
    />
  );

  return (
    <div className="space-y-6">
      {/* Obra */}
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
                Ative se a obra ainda está em fase de aprovação (Projeto 3D →
                Executivo → Liberação)
              </p>
            </div>
            <Switch
              id="is_project_phase"
              checked={formData.is_project_phase}
              onCheckedChange={(checked) =>
                onChange("is_project_phase", checked)
              }
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1">
              <Label htmlFor="name" className="inline-flex items-center">
                Condomínio / Empreendimento *{ai("name")}
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => onChange("name", e.target.value)}
                placeholder="Ex: Hub Brooklyn"
                className={errors.name ? "border-destructive" : ""}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="unit_name" className="inline-flex items-center">
                Unidade / Apartamento
                {ai("unit_name")}
              </Label>
              <Input
                id="unit_name"
                value={formData.unit_name}
                onChange={(e) => onChange("unit_name", e.target.value)}
                placeholder="Ex: Apartamento 502"
              />
            </div>
            <div className="space-y-1">
              <Label
                htmlFor="nome_do_empreendimento"
                className="inline-flex items-center"
              >
                Nome do empreendimento
                {ai("nome_do_empreendimento")}
              </Label>
              <Input
                id="nome_do_empreendimento"
                value={formData.nome_do_empreendimento}
                onChange={(e) =>
                  onChange("nome_do_empreendimento", e.target.value)
                }
                placeholder="Ex: Residencial Park"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Imóvel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-body">
            <Home className="h-5 w-5" />
            Dados do Imóvel
          </CardTitle>
          <CardDescription>
            Endereço e características do imóvel que será reformado
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="cep" className="inline-flex items-center">
                CEP
                {ai("cep")}
              </Label>
              <div className="relative flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="cep"
                    value={formData.cep}
                    onChange={(e) => handleCepChange(e.target.value)}
                    placeholder="00000-000"
                    maxLength={9}
                    className={cn("flex-1", cepLoading && "pr-8")}
                  />
                  {cepLoading && (
                    <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleManualLookup}
                  disabled={cepLoading || !formData.cep}
                  title="Buscar endereço pelo CEP"
                >
                  {cepLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {cepLoading
                  ? "Buscando endereço…"
                  : "Digite o CEP para preencher automaticamente"}
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="complemento" className="inline-flex items-center">
                Complemento
                {ai("complemento")}
              </Label>
              <Input
                id="complemento"
                value={formData.complemento}
                onChange={(e) => onChange("complemento", e.target.value)}
                placeholder="Apto, Bloco"
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <Label htmlFor="address" className="inline-flex items-center">
                Endereço do imóvel
                {ai("address")}
              </Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => onChange("address", e.target.value)}
                placeholder="Rua, número"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="bairro" className="inline-flex items-center">
                Bairro
                {ai("bairro")}
              </Label>
              <Input
                id="bairro"
                value={formData.bairro}
                onChange={(e) => onChange("bairro", e.target.value)}
                placeholder="Ex: Pinheiros"
              />
            </div>

            <div className="space-y-1">
              <Label
                htmlFor="cidade_imovel"
                className="inline-flex items-center"
              >
                Cidade
                {ai("cidade_imovel")}
              </Label>
              <Input
                id="cidade_imovel"
                value={formData.cidade_imovel}
                onChange={(e) => onChange("cidade_imovel", e.target.value)}
                placeholder="Ex: São Paulo"
              />
            </div>

            <div className="space-y-1">
              <Label
                htmlFor="tamanho_imovel_m2"
                className="inline-flex items-center"
              >
                Metragem (m²)
                {ai("tamanho_imovel_m2")}
              </Label>
              <Input
                id="tamanho_imovel_m2"
                type="number"
                step="0.01"
                value={formData.tamanho_imovel_m2}
                onChange={(e) => onChange("tamanho_imovel_m2", e.target.value)}
                placeholder="Ex: 31"
              />
            </div>

            <div className="space-y-1">
              <Label
                htmlFor="tipo_de_locacao"
                className="inline-flex items-center"
              >
                Tipo de locação
                {ai("tipo_de_locacao")}
              </Label>
              <Select
                value={formData.tipo_de_locacao}
                onValueChange={(v) => onChange("tipo_de_locacao", v)}
              >
                <SelectTrigger id="tipo_de_locacao">
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

            <div className="space-y-1">
              <Label
                htmlFor="data_recebimento_chaves"
                className="inline-flex items-center"
              >
                Data recebimento das chaves
                {ai("data_recebimento_chaves")}
              </Label>
              <Input
                id="data_recebimento_chaves"
                type="date"
                value={formData.data_recebimento_chaves}
                onChange={(e) =>
                  onChange("data_recebimento_chaves", e.target.value)
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
