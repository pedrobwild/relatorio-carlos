import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";

const schema = z.object({
  itemName: z.string().min(1, "Nome do item é obrigatório"),
  itemBrand: z.string().optional(),
  itemModel: z.string().optional(),
  itemSerial: z.string().optional(),
  itemCondition: z.string().min(10, "Descreva o estado do item"),
  storageLocation: z.string().min(1, "Local de guarda é obrigatório"),
  estimatedDuration: z.string().min(1, "Prazo estimado é obrigatório"),
  responsibility: z
    .string()
    .min(10, "Descreva as responsabilidades e isenções"),
});

type FormValues = z.infer<typeof schema>;

interface ExceptionCustodyFormProps {
  onComplete: (data: {
    title: string;
    summary: string;
    body_md: string;
    data: Record<string, unknown>;
  }) => void;
  initialData?: { data: Record<string, unknown> };
}

export function ExceptionCustodyForm({
  onComplete,
  initialData,
}: ExceptionCustodyFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      itemName: "",
      itemBrand: "",
      itemModel: "",
      itemSerial: "",
      itemCondition: "",
      storageLocation: "",
      estimatedDuration: "",
      responsibility: "",
    },
  });

  const onSubmit = (values: FormValues) => {
    const itemDescription = [
      values.itemName,
      values.itemBrand && `(${values.itemBrand})`,
      values.itemModel && `- ${values.itemModel}`,
    ]
      .filter(Boolean)
      .join(" ");

    const title = `Custódia de Item: ${values.itemName}`;
    const summary = `Formalização de custódia de ${itemDescription}. Local: ${values.storageLocation}. Prazo estimado: ${values.estimatedDuration}.`;

    const body_md = `## Termo de Custódia de Item

### Identificação do Item
- **Nome:** ${values.itemName}
${values.itemBrand ? `- **Marca:** ${values.itemBrand}` : ""}
${values.itemModel ? `- **Modelo:** ${values.itemModel}` : ""}
${values.itemSerial ? `- **Número de Série:** ${values.itemSerial}` : ""}

### Estado do Item
${values.itemCondition}

### Local de Guarda
${values.storageLocation}

### Prazo Estimado de Custódia
${values.estimatedDuration}

### Responsabilidades e Isenções
${values.responsibility}

---

**Importante:** Este documento formaliza a custódia temporária do item descrito acima, estabelecendo responsabilidades e condições entre as partes.`;

    onComplete({
      title,
      summary,
      body_md,
      data: {
        item_name: values.itemName,
        item_brand: values.itemBrand || null,
        item_model: values.itemModel || null,
        item_serial: values.itemSerial || null,
        item_condition: values.itemCondition,
        storage_location: values.storageLocation,
        estimated_duration: values.estimatedDuration,
        responsibility: values.responsibility,
      },
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-h3">Identificação do Item</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="itemName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Item</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: Geladeira, Sofá, TV..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="itemBrand"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Marca (opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Samsung" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="itemModel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Modelo (opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: RF28R7351SR" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="itemSerial"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número de Série (opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Se houver" {...field} />
                  </FormControl>
                  <FormDescription>
                    Importante para itens de alto valor ou que precisam de
                    identificação única.
                  </FormDescription>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <FormField
          control={form.control}
          name="itemCondition"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Estado do Item</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Descreva o estado atual do item (conservação, funcionamento, danos existentes...)"
                  className="min-h-[100px]"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Documente qualquer dano ou desgaste pré-existente.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="storageLocation"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Local de Guarda</FormLabel>
              <FormControl>
                <Input
                  placeholder="Ex: Depósito central, Apartamento 502..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="estimatedDuration"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Prazo Estimado</FormLabel>
              <FormControl>
                <Input
                  placeholder="Ex: 30 dias, Até término da obra..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="responsibility"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Responsabilidades e Isenções</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Descreva as responsabilidades de cada parte e eventuais isenções..."
                  className="min-h-[120px]"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Ex: Quem é responsável por danos, condições de devolução, etc.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full min-h-[44px]"
          aria-label="Continuar para próximo passo"
        >
          Continuar
        </Button>
      </form>
    </Form>
  );
}
