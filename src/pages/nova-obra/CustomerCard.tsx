import { User, KeyRound, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
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
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { AiFieldIndicator } from "./AiFieldIndicator";
import { formatCpf, formatRg } from "@/lib/documentValidation";
import type { FormData } from "./types";

interface CustomerCardProps {
  formData: FormData;
  errors: Record<string, string>;
  sendInvite: boolean;
  onSendInviteChange: (v: boolean) => void;
  onChange: (field: keyof FormData, value: string | boolean) => void;
  aiPrefilledFields?: Set<string>;
  aiConflictFields?: Set<string>;
}

export function CustomerCard({
  formData,
  errors,
  sendInvite,
  onSendInviteChange,
  onChange,
  aiPrefilledFields = new Set(),
  aiConflictFields = new Set(),
}: CustomerCardProps) {
  const [showPassword, setShowPassword] = useState(false);

  const ai = (field: string) => (
    <AiFieldIndicator
      fieldName={field}
      aiPrefilledFields={aiPrefilledFields}
      aiConflictFields={aiConflictFields}
    />
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-body">
          <User className="h-5 w-5" />
          Dados do Contratante
        </CardTitle>
        <CardDescription>
          Informações pessoais, documentos e criação de acesso ao portal
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 space-y-1">
            <Label htmlFor="customer_name" className="inline-flex items-center">
              Nome Completo *{ai("customer_name")}
            </Label>
            <Input
              id="customer_name"
              value={formData.customer_name}
              onChange={(e) => onChange("customer_name", e.target.value)}
              placeholder="Nome do cliente"
              className={errors.customer_name ? "border-destructive" : ""}
            />
            {errors.customer_name && (
              <p className="text-xs text-destructive">{errors.customer_name}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="nacionalidade" className="inline-flex items-center">
              Nacionalidade{ai("nacionalidade")}
            </Label>
            <Input
              id="nacionalidade"
              value={formData.nacionalidade}
              onChange={(e) => onChange("nacionalidade", e.target.value)}
              placeholder="Ex: brasileira"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="estado_civil" className="inline-flex items-center">
              Estado civil{ai("estado_civil")}
            </Label>
            <Input
              id="estado_civil"
              value={formData.estado_civil}
              onChange={(e) => onChange("estado_civil", e.target.value)}
              placeholder="Ex: casada"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="profissao" className="inline-flex items-center">
              Profissão{ai("profissao")}
            </Label>
            <Input
              id="profissao"
              value={formData.profissao}
              onChange={(e) => onChange("profissao", e.target.value)}
              placeholder="Ex: engenheira civil"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cpf" className="inline-flex items-center">
              CPF{ai("cpf")}
            </Label>
            <Input
              id="cpf"
              value={formData.cpf}
              onChange={(e) => onChange("cpf", formatCpf(e.target.value))}
              placeholder="000.000.000-00"
              maxLength={14}
              className={errors.cpf ? "border-destructive" : ""}
              aria-invalid={!!errors.cpf}
              aria-describedby={errors.cpf ? "cpf-error" : undefined}
            />
            {errors.cpf && (
              <p id="cpf-error" className="text-xs text-destructive">
                {errors.cpf}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="rg" className="inline-flex items-center">
              RG{ai("rg")}
            </Label>
            <Input
              id="rg"
              value={formData.rg}
              onChange={(e) => onChange("rg", formatRg(e.target.value))}
              placeholder="00.000.000-0"
              maxLength={12}
              className={errors.rg ? "border-destructive" : ""}
              aria-invalid={!!errors.rg}
              aria-describedby={errors.rg ? "rg-error" : undefined}
            />
            {errors.rg && (
              <p id="rg-error" className="text-xs text-destructive">
                {errors.rg}
              </p>
            )}
          </div>
          <div className="sm:col-span-2 space-y-1">
            <Label
              htmlFor="endereco_residencial"
              className="inline-flex items-center"
            >
              Endereço residencial{ai("endereco_residencial")}
            </Label>
            <Input
              id="endereco_residencial"
              value={formData.endereco_residencial}
              onChange={(e) => onChange("endereco_residencial", e.target.value)}
              placeholder="Rua, número, bairro, cidade/UF, CEP"
            />
          </div>
          <div className="space-y-1">
            <Label
              htmlFor="cidade_cliente"
              className="inline-flex items-center"
            >
              Cidade{ai("cidade_cliente")}
            </Label>
            <Input
              id="cidade_cliente"
              value={formData.cidade_cliente}
              onChange={(e) => onChange("cidade_cliente", e.target.value)}
              placeholder="Ex: São Paulo"
            />
          </div>
          <div className="space-y-1">
            <Label
              htmlFor="estado_cliente"
              className="inline-flex items-center"
            >
              Estado{ai("estado_cliente")}
            </Label>
            <Input
              id="estado_cliente"
              value={formData.estado_cliente}
              onChange={(e) => onChange("estado_cliente", e.target.value)}
              placeholder="Ex: SP"
            />
          </div>

          <Separator className="sm:col-span-2" />

          <div className="space-y-1">
            <Label
              htmlFor="customer_email"
              className="inline-flex items-center"
            >
              E-mail *{ai("customer_email")}
            </Label>
            <Input
              id="customer_email"
              type="email"
              value={formData.customer_email}
              onChange={(e) => onChange("customer_email", e.target.value)}
              placeholder="cliente@email.com"
              className={errors.customer_email ? "border-destructive" : ""}
            />
            {errors.customer_email && (
              <p className="text-xs text-destructive">
                {errors.customer_email}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label
              htmlFor="customer_phone"
              className="inline-flex items-center"
            >
              Telefone{ai("customer_phone")}
            </Label>
            <Input
              id="customer_phone"
              value={formData.customer_phone}
              onChange={(e) => onChange("customer_phone", e.target.value)}
              placeholder="(00) 00000-0000"
            />
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/50">
          <div className="space-y-0.5">
            <Label
              htmlFor="create_user"
              className="text-sm font-medium flex items-center gap-2"
            >
              <KeyRound className="h-4 w-4" />
              Criar acesso ao portal
            </Label>
            <p className="text-xs text-muted-foreground">
              Cria automaticamente o login do cliente com e-mail e senha
              definidos
            </p>
          </div>
          <Switch
            id="create_user"
            checked={formData.create_user}
            onCheckedChange={(checked) => onChange("create_user", checked)}
          />
        </div>

        {formData.create_user && (
          <div className="space-y-1">
            <Label htmlFor="customer_password">Senha do Cliente *</Label>
            <div className="relative">
              <Input
                id="customer_password"
                type={showPassword ? "text" : "password"}
                value={formData.customer_password}
                onChange={(e) => onChange("customer_password", e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className={
                  errors.customer_password
                    ? "border-destructive pr-10"
                    : "pr-10"
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
            {errors.customer_password && (
              <p className="text-xs text-destructive">
                {errors.customer_password}
              </p>
            )}
          </div>
        )}

        {!formData.create_user && (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="send_invite"
                checked={sendInvite}
                onChange={(e) => onSendInviteChange(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <Label
                htmlFor="send_invite"
                className="text-caption cursor-pointer"
              >
                Enviar convite de acesso por e-mail ao cadastrar
              </Label>
            </div>
            <p className="text-xs text-muted-foreground ml-7">
              O cliente receberá um e-mail com link para criar sua conta e
              acompanhar fotos, cronograma e documentos da obra pelo portal.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
