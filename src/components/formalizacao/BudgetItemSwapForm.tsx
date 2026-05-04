import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const schema = z.object({
  removedItemName: z.string().min(1, "Nome do item é obrigatório"),
  removedItemValue: z.number().min(0, "Valor deve ser positivo"),
  reason: z.string().min(10, "Descreva o motivo da troca"),
  newItemName: z.string().min(1, "Nome do novo item é obrigatório"),
  newItemValue: z.number().min(0, "Valor deve ser positivo"),
  impactOnSchedule: z.enum(["yes", "no"]),
  observations: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface BudgetItemSwapFormProps {
  onComplete: (data: {
    title: string;
    summary: string;
    body_md: string;
    data: Record<string, unknown>;
  }) => void;
  initialData?: { data: Record<string, unknown> };
}

export function BudgetItemSwapForm({
  onComplete,
  initialData,
}: BudgetItemSwapFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      removedItemName:
        ((
          initialData?.data?.removed_item as Record<string, unknown> | undefined
        )?.name as string) || "",
      removedItemValue:
        ((
          initialData?.data?.removed_item as Record<string, unknown> | undefined
        )?.value as number) || 0,
      reason: (initialData?.data?.reason as string) || "",
      newItemName:
        ((initialData?.data?.added_item as Record<string, unknown> | undefined)
          ?.name as string) || "",
      newItemValue:
        ((initialData?.data?.added_item as Record<string, unknown> | undefined)
          ?.value as number) || 0,
      impactOnSchedule: "no",
      observations: "",
    },
  });

  const onSubmit = (values: FormValues) => {
    const difference = values.newItemValue - values.removedItemValue;

    const title = `Troca de Item: ${values.removedItemName} → ${values.newItemName}`;
    const summary = `Substituição de "${values.removedItemName}" (R$ ${values.removedItemValue.toFixed(2)}) por "${values.newItemName}" (R$ ${values.newItemValue.toFixed(2)}). Diferença: R$ ${difference.toFixed(2)}.`;

    const body_md = `## Troca de Item do Orçamento

### Item Removido
- **Nome:** ${values.removedItemName}
- **Valor:** R$ ${values.removedItemValue.toFixed(2)}

### Item Adicionado
- **Nome:** ${values.newItemName}
- **Valor:** R$ ${values.newItemValue.toFixed(2)}

### Diferença de Valor
R$ ${difference.toFixed(2)} ${difference >= 0 ? "(acréscimo)" : "(desconto)"}

### Motivo da Troca
${values.reason}

### Impacto no Prazo
${values.impactOnSchedule === "yes" ? "Sim, há impacto no cronograma." : "Não há impacto no cronograma."}

${values.observations ? `### Observações\n${values.observations}` : ""}`;

    onComplete({
      title,
      summary,
      body_md,
      data: {
        removed_item: {
          name: values.removedItemName,
          value: values.removedItemValue,
        },
        added_item: {
          name: values.newItemName,
          value: values.newItemValue,
        },
        value_difference: difference,
        reason: values.reason,
        impact_on_schedule: values.impactOnSchedule === "yes",
        observations: values.observations,
      },
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-h3">Item Removido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="removedItemName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Item</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: Torneira Deca Quadrada"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="removedItemValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor (R$)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0,00"
                      {...field}
                      onChange={(e) =>
                        field.onChange(parseFloat(e.target.value) || 0)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <FormField
          control={form.control}
          name="reason"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Motivo da Troca</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Explique o motivo da substituição do item..."
                  className="min-h-[100px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-h3">Novo Item</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="newItemName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Item</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: Torneira Docol Quadrada"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="newItemValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor (R$)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0,00"
                      {...field}
                      onChange={(e) =>
                        field.onChange(parseFloat(e.target.value) || 0)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <FormField
          control={form.control}
          name="impactOnSchedule"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Há impacto no prazo?</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="no" />
                    <Label htmlFor="no">Não</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="yes" />
                    <Label htmlFor="yes">Sim</Label>
                  </div>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="observations"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observações (opcional)</FormLabel>
              <FormControl>
                <Textarea placeholder="Informações adicionais..." {...field} />
              </FormControl>
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
