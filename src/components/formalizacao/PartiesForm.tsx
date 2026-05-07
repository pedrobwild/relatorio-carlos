import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, User, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const partySchema = z.object({
  party_type: z.enum(["customer", "company"]),
  display_name: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email inválido"),
  role_label: z.string().optional(),
  must_sign: z.boolean(),
});

const schema = z
  .object({
    parties: z
      .array(partySchema)
      .min(2, "Adicione pelo menos um cliente e um representante da empresa"),
  })
  .refine((data) => data.parties.some((p) => p.party_type === "customer"), {
    message: "Adicione pelo menos um cliente",
    path: ["parties"],
  })
  .refine((data) => data.parties.some((p) => p.party_type === "company"), {
    message: "Adicione pelo menos um representante da empresa",
    path: ["parties"],
  });

type FormValues = z.infer<typeof schema>;

interface PartiesFormProps {
  onComplete: (parties: FormValues["parties"]) => void;
  initialParties?: FormValues["parties"];
}

export function PartiesForm({ onComplete, initialParties }: PartiesFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      parties: initialParties?.length
        ? initialParties
        : [
            {
              party_type: "customer",
              display_name: "",
              email: "",
              role_label: "Cliente",
              must_sign: true,
            },
            {
              party_type: "company",
              display_name: "",
              email: "",
              role_label: "Responsável",
              must_sign: true,
            },
          ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "parties",
  });

  const onSubmit = (values: FormValues) => {
    onComplete(values.parties);
  };

  const addParty = (type: "customer" | "company") => {
    append({
      party_type: type,
      display_name: "",
      email: "",
      role_label: type === "customer" ? "Cliente" : "Responsável",
      must_sign: true,
    });
  };

  const customerParties = fields.filter(
    (_, i) => form.watch(`parties.${i}.party_type`) === "customer",
  );
  const companyParties = fields.filter(
    (_, i) => form.watch(`parties.${i}.party_type`) === "company",
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="text-center mb-6">
          <h2 className="text-h2">Definir Partes</h2>
          <p className="text-caption mt-1">
            Adicione as pessoas que precisam dar ciência nesta formalização
          </p>
        </div>

        {/* Customer parties */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <CardTitle className="text-h3">Cliente</CardTitle>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addParty("customer")}
              aria-label="Adicionar cliente"
            >
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((field, index) => {
              if (form.watch(`parties.${index}.party_type`) !== "customer")
                return null;

              return (
                <div key={field.id} className="p-4 border rounded-lg space-y-4">
                  <div className="flex justify-between items-start">
                    <span className="text-caption font-medium">
                      Participante {customerParties.indexOf(field) + 1}
                    </span>
                    {fields.filter(
                      (f) =>
                        form.watch(
                          `parties.${fields.indexOf(f)}.party_type`,
                        ) === "customer",
                    ).length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(index)}
                        aria-label="Remover participante"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name={`parties.${index}.display_name`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome</FormLabel>
                          <FormControl>
                            <Input placeholder="Nome completo" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`parties.${index}.email`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="email@exemplo.com"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name={`parties.${index}.role_label`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Função (opcional)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ex: Proprietário, Responsável"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`parties.${index}.must_sign`}
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="font-normal">
                          Deve assinar
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Company parties */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <CardTitle className="text-h3">Empresa</CardTitle>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addParty("company")}
              aria-label="Adicionar representante"
            >
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((field, index) => {
              if (form.watch(`parties.${index}.party_type`) !== "company")
                return null;

              return (
                <div key={field.id} className="p-4 border rounded-lg space-y-4">
                  <div className="flex justify-between items-start">
                    <span className="text-caption font-medium">
                      Representante {companyParties.indexOf(field) + 1}
                    </span>
                    {fields.filter(
                      (f) =>
                        form.watch(
                          `parties.${fields.indexOf(f)}.party_type`,
                        ) === "company",
                    ).length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(index)}
                        aria-label="Remover representante"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name={`parties.${index}.display_name`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome</FormLabel>
                          <FormControl>
                            <Input placeholder="Nome completo" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`parties.${index}.email`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="email@exemplo.com"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name={`parties.${index}.role_label`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Função (opcional)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ex: Gerente, Engenheiro"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`parties.${index}.must_sign`}
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="font-normal">
                          Deve assinar
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>

        {form.formState.errors.parties && (
          <p className="text-sm text-destructive">
            {form.formState.errors.parties.message}
          </p>
        )}

        <Button
          type="submit"
          className="w-full min-h-[44px]"
          aria-label="Continuar para revisão"
        >
          Continuar
        </Button>
      </form>
    </Form>
  );
}
