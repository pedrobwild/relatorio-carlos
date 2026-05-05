import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  meetingDate: z.string().min(1, "Data é obrigatória"),
  meetingTime: z.string().min(1, "Hora é obrigatória"),
  participants: z
    .array(
      z.object({
        name: z.string().min(1, "Nome é obrigatório"),
        role: z.string().optional(),
      }),
    )
    .min(1, "Adicione pelo menos um participante"),
  mainTopics: z.string().min(10, "Descreva os tópicos discutidos"),
  sensitiveTopics: z.object({
    additives: z.boolean(),
    scope: z.boolean(),
    deadlines: z.boolean(),
    warranty: z.boolean(),
  }),
  recordingLink: z.string().url("URL inválida").optional().or(z.literal("")),
  acknowledgement: z.boolean().refine((val) => val === true, {
    message: "Você deve declarar ciência do que foi discutido",
  }),
});

type FormValues = z.infer<typeof schema>;

interface MeetingMinutesFormProps {
  onComplete: (data: {
    title: string;
    summary: string;
    body_md: string;
    data: Record<string, unknown>;
  }) => void;
  initialData?: { data: Record<string, unknown> };
}

export function MeetingMinutesForm({
  onComplete,
  initialData: _initialData,
}: MeetingMinutesFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      meetingDate: "",
      meetingTime: "",
      participants: [{ name: "", role: "" }],
      mainTopics: "",
      sensitiveTopics: {
        additives: false,
        scope: false,
        deadlines: false,
        warranty: false,
      },
      recordingLink: "",
      acknowledgement: false,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "participants",
  });

  const onSubmit = (values: FormValues) => {
    const sensitiveList: string[] = [];
    if (values.sensitiveTopics.additives) sensitiveList.push("Aditivos");
    if (values.sensitiveTopics.scope) sensitiveList.push("Escopo");
    if (values.sensitiveTopics.deadlines) sensitiveList.push("Prazos");
    if (values.sensitiveTopics.warranty) sensitiveList.push("Garantia");

    const dateFormatted = new Date(values.meetingDate).toLocaleDateString(
      "pt-BR",
    );
    const title = `Ata de Reunião - ${dateFormatted}`;
    const summary = `Reunião realizada em ${dateFormatted} às ${values.meetingTime} com ${values.participants.length} participante(s).${sensitiveList.length > 0 ? ` Tópicos sensíveis: ${sensitiveList.join(", ")}.` : ""}`;

    const participantsList = values.participants
      .map((p) => `- ${p.name}${p.role ? ` (${p.role})` : ""}`)
      .join("\n");

    const body_md = `## Ata de Reunião

### Informações Gerais
- **Data:** ${dateFormatted}
- **Horário:** ${values.meetingTime}

### Participantes
${participantsList}

### Tópicos Discutidos
${values.mainTopics}

${sensitiveList.length > 0 ? `### Tópicos Sensíveis Abordados\n${sensitiveList.map((t) => `- ${t}`).join("\n")}` : ""}

${values.recordingLink ? `### Link da Gravação\n${values.recordingLink}` : ""}

---

**Declaração:** Declaro estar ciente do que foi discutido e dos riscos/condições apresentados nesta reunião.`;

    onComplete({
      title,
      summary,
      body_md,
      data: {
        meeting_date: values.meetingDate,
        meeting_time: values.meetingTime,
        participants: values.participants,
        main_topics: values.mainTopics,
        sensitive_topics: values.sensitiveTopics,
        recording_link: values.recordingLink || null,
      },
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-h3">Data e Hora</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="meetingDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="meetingTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hora</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-h3">Participantes</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ name: "", role: "" })}
              aria-label="Adicionar participante"
            >
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="flex gap-2 items-start">
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <FormField
                    control={form.control}
                    name={`participants.${index}.name`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input placeholder="Nome" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`participants.${index}.role`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input placeholder="Cargo (opcional)" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                {fields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    aria-label="Remover participante"
                    className="min-h-[44px] min-w-[44px]"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <FormField
          control={form.control}
          name="mainTopics"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tópicos Principais</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Descreva os principais tópicos discutidos na reunião..."
                  className="min-h-[150px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-h3">Tópicos Sensíveis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <FormField
              control={form.control}
              name="sensitiveTopics.additives"
              render={({ field }) => (
                <FormItem className="flex items-center space-x-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className="font-normal">Aditivos</FormLabel>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sensitiveTopics.scope"
              render={({ field }) => (
                <FormItem className="flex items-center space-x-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className="font-normal">Escopo</FormLabel>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sensitiveTopics.deadlines"
              render={({ field }) => (
                <FormItem className="flex items-center space-x-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className="font-normal">Prazos</FormLabel>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sensitiveTopics.warranty"
              render={({ field }) => (
                <FormItem className="flex items-center space-x-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className="font-normal">Garantia</FormLabel>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <FormField
          control={form.control}
          name="recordingLink"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Link da Gravação (opcional)</FormLabel>
              <FormControl>
                <Input type="url" placeholder="https://..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4">
            <FormField
              control={form.control}
              name="acknowledgement"
              render={({ field }) => (
                <FormItem className="flex items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      aria-describedby="acknowledgement-description"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel
                      id="acknowledgement-description"
                      className="font-medium"
                    >
                      Declaro ciente do que foi discutido e dos riscos/condições
                    </FormLabel>
                    <FormDescription>
                      Ao marcar esta opção, você confirma que compreende todos
                      os pontos abordados na reunião.
                    </FormDescription>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

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
