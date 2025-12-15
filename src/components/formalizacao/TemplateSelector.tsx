import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FORMALIZATION_TYPE_LABELS, type FormalizationType } from '@/types/formalization';

interface TemplateSelectorProps {
  onSelect: (type: FormalizationType) => void;
}

const templates: { type: FormalizationType; icon: string; description: string }[] = [
  {
    type: 'budget_item_swap',
    icon: '💰',
    description: 'Registra a troca de um item do orçamento por outro, documentando valores e motivos.',
  },
  {
    type: 'meeting_minutes',
    icon: '📝',
    description: 'Documenta decisões e discussões de reuniões com registro de participantes e tópicos.',
  },
  {
    type: 'exception_custody',
    icon: '📦',
    description: 'Formaliza a custódia temporária de itens, incluindo estado, local e responsabilidades.',
  },
];

export function TemplateSelector({ onSelect }: TemplateSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-lg font-semibold">Escolha o tipo de formalização</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Selecione o template que melhor se encaixa na situação
        </p>
      </div>

      <div className="grid gap-4">
        {templates.map((template) => (
          <Card 
            key={template.type}
            className="cursor-pointer hover:border-primary hover:bg-accent/50 transition-colors"
            onClick={() => onSelect(template.type)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onSelect(template.type)}
            aria-label={`Selecionar ${FORMALIZATION_TYPE_LABELS[template.type]}`}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <span className="text-3xl" role="img" aria-hidden="true">
                  {template.icon}
                </span>
                <CardTitle className="text-base">
                  {FORMALIZATION_TYPE_LABELS[template.type]}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>{template.description}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
