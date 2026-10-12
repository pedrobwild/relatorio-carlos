/**
 * Formulário compacto da Ficha da obra (dentro da gaveta).
 *
 * Grava só o que mudou: quem edita o telefone da portaria no celular não
 * sobrescreve o que outra pessoa acabou de preencher em outro campo.
 */
import { useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { InlineRichEditor } from "@/components/ui/inline-rich-editor";
import { cn } from "@/lib/utils";
import {
  WORK_DAYS,
  contactEmailError,
  contactPhoneError,
  fichaFormFromInfo,
  fichaPatch,
  workWindowError,
  type FichaForm,
  type FichaInfo,
  type FichaTextField,
  type WorkDay,
} from "@/lib/fichaObra";
import type { StudioInfoPatch } from "@/infra/repositories/studioInfo.repository";

const WEEKDAYS_ONLY: WorkDay[] = ["mon", "tue", "wed", "thu", "fri"];

const PHONE_FIELDS: FichaTextField[] = ["syndic_phone", "building_manager_phone", "concierge_phone", "property_admin_phone"];
const EMAIL_FIELDS: FichaTextField[] = ["syndic_email", "building_manager_email", "property_admin_email"];

interface ContactGroup {
  title: string;
  name: FichaTextField;
  namePlaceholder: string;
  phone: FichaTextField;
  email?: FichaTextField;
}

const CONTACTS: ContactGroup[] = [
  { title: "Síndico", name: "syndic_name", namePlaceholder: "Nome", phone: "syndic_phone", email: "syndic_email" },
  {
    title: "Gerente predial",
    name: "building_manager_name",
    namePlaceholder: "Nome",
    phone: "building_manager_phone",
    email: "building_manager_email",
  },
  { title: "Portaria", name: "concierge_name", namePlaceholder: "Nome ou turno (ex.: Portaria 24h)", phone: "concierge_phone" },
  {
    title: "Administradora",
    name: "property_admin_name",
    namePlaceholder: "Empresa ou contato",
    phone: "property_admin_phone",
    email: "property_admin_email",
  },
];

interface Props {
  /** O que está gravado hoje (null = obra ainda sem ficha). */
  info: FichaInfo | null;
  saving: boolean;
  onCancel: () => void;
  /** Recebe só os campos alterados. Não é chamado quando nada mudou. */
  onSave: (patch: StudioInfoPatch) => void;
}

export function FichaObraForm({ info, saving, onCancel, onSave }: Props) {
  const uid = useId();
  const [form, setForm] = useState<FichaForm>(() => fichaFormFromInfo(info));
  const [submitted, setSubmitted] = useState(false);

  const set = (field: FichaTextField, value: string) => setForm((f) => ({ ...f, [field]: value }));
  const toggleDay = (day: WorkDay) =>
    setForm((f) => ({
      ...f,
      allowed_work_days: f.allowed_work_days.includes(day)
        ? f.allowed_work_days.filter((d) => d !== day)
        : [...f.allowed_work_days, day],
    }));

  // Só o que mudou é gravado — e só o que mudou é validado: um telefone
  // antigo fora do padrão não impede de corrigir outro campo pelo celular.
  const patch = useMemo(() => fichaPatch(info, form), [info, form]);
  const windowChanged =
    "allowed_work_days" in patch || "allowed_work_start_time" in patch || "allowed_work_end_time" in patch;
  const windowError = windowChanged
    ? workWindowError(form.allowed_work_days, form.allowed_work_start_time, form.allowed_work_end_time)
    : null;
  const fieldError = (field: FichaTextField): string | null => {
    if (!(field in patch)) return null;
    if (PHONE_FIELDS.includes(field)) return contactPhoneError(form[field]);
    if (EMAIL_FIELDS.includes(field)) return contactEmailError(form[field]);
    return null;
  };
  const hasErrors = !!windowError || [...PHONE_FIELDS, ...EMAIL_FIELDS].some((f) => fieldError(f));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (hasErrors) return;
    if (Object.keys(patch).length === 0) {
      onCancel();
      return;
    }
    onSave(patch);
  };

  /** Campo de texto com rótulo; mostra o erro depois da primeira tentativa de salvar. */
  const field = (
    name: FichaTextField,
    label: string,
    props: React.ComponentProps<typeof Input> = {},
  ) => {
    const id = `${uid}-${name}`;
    const error = submitted ? fieldError(name) : null;
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>{label}</Label>
        <Input
          id={id}
          value={form[name]}
          onChange={(e) => set(name, e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-erro` : undefined}
          className={cn("min-h-[44px]", error && "border-destructive focus-visible:ring-destructive")}
          {...props}
        />
        {error && (
          <p id={`${id}-erro`} role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
    );
  };

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col" aria-label="Editar ficha da obra">
      <div className="min-h-0 flex-1 space-y-7 overflow-y-auto p-5">
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-foreground">Endereço</legend>
          {field("nome_do_empreendimento", "Empreendimento", { placeholder: "Nome do prédio" })}
          {field("endereco_completo", "Endereço", { placeholder: "Rua, número", autoComplete: "street-address" })}
          <div className="grid grid-cols-2 gap-3">
            {field("complemento", "Complemento", { placeholder: "Apto, bloco" })}
            {field("bairro", "Bairro")}
          </div>
          {field("cidade", "Cidade")}
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-foreground">Chaves</legend>
          <div className="grid grid-cols-2 gap-3">
            {field("data_recebimento_chaves", "Recebidas em", { type: "date" })}
            {field("keys_received_by", "Quem recebeu", { placeholder: "Nome de quem da Bwild recebeu" })}
          </div>
          {field("key_location", "Onde estão", { placeholder: "Ex.: portaria, com o zelador, cofre na entrada…", maxLength: 300 })}
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-foreground">Fechadura eletrônica</legend>
          {field("electronic_lock_password", "Senha", { placeholder: "Ex.: 1234#", maxLength: 50, autoComplete: "off" })}
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-foreground">Condomínio</legend>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span id={`${uid}-dias`} className="text-sm font-medium leading-none text-foreground">
                Dias permitidos
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => setForm((f) => ({ ...f, allowed_work_days: WEEKDAYS_ONLY }))}
              >
                Seg a sex
              </Button>
            </div>
            <div role="group" aria-labelledby={`${uid}-dias`} className="flex flex-wrap gap-2">
              {WORK_DAYS.map((d) => {
                const on = form.allowed_work_days.includes(d.value);
                return (
                  <button
                    key={d.value}
                    type="button"
                    aria-pressed={on}
                    aria-label={d.label}
                    onClick={() => toggleDay(d.value)}
                    className={cn(
                      "min-h-[44px] min-w-[48px] rounded-full border px-3 text-sm font-medium transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-foreground hover:bg-muted",
                    )}
                  >
                    {d.short}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field("allowed_work_start_time", "Das", { type: "time" })}
            {field("allowed_work_end_time", "Até", { type: "time" })}
          </div>
          {submitted && windowError && (
            <p role="alert" className="text-xs text-destructive">
              {windowError}
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-liberacao`}>Como pedir a liberação da equipe</Label>
            <Textarea
              id={`${uid}-liberacao`}
              value={form.access_release_process}
              onChange={(e) => set("access_release_process", e.target.value)}
              rows={4}
              placeholder={"Para quem enviar, com quantos dias de antecedência e quais documentos.\nEx.: e-mail para a administradora com nome e RG de cada um, 2 dias úteis antes."}
            />
          </div>

          <div className="space-y-1.5">
            <span id={`${uid}-acesso`} className="text-sm font-medium leading-none text-foreground">
              Acesso no dia
            </span>
            <div role="group" aria-labelledby={`${uid}-acesso`}>
              <InlineRichEditor
                value={form.provider_access_instructions}
                onChange={(html) => setForm((f) => ({ ...f, provider_access_instructions: html }))}
                placeholder="Como a equipe entra: identificar-se na portaria, elevador de serviço, onde estacionar…"
                minHeight="96px"
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-foreground">Contatos</legend>
          {CONTACTS.map((c) => (
            <div key={c.name} role="group" aria-label={c.title} className="space-y-3 rounded-lg border border-border p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{c.title}</p>
              {field(c.name, "Nome", { placeholder: c.namePlaceholder })}
              {field(c.phone, "Telefone", { type: "tel", inputMode: "tel", placeholder: "(11) 99999-9999" })}
              {c.email && field(c.email, "E-mail", { type: "email", inputMode: "email", placeholder: "nome@dominio.com" })}
            </div>
          ))}
        </fieldset>
      </div>

      <div className="space-y-2 border-t border-border p-4">
        {submitted && hasErrors && (
          <p role="alert" className="text-sm text-destructive">
            Corrija os campos destacados para salvar.
          </p>
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="min-h-[48px] flex-1" onClick={onCancel} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" className="min-h-[48px] flex-1" disabled={saving}>
            {saving ? "Salvando…" : "Salvar ficha"}
          </Button>
        </div>
      </div>
    </form>
  );
}
