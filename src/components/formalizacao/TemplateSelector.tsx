import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, FileText, Package, RefreshCw, Repeat, FileEdit } from "lucide-react";
import {
  FORMALIZATION_TYPE_LABELS,
  type FormalizationType,
} from "@/types/formalization";

interface TemplateSelectorProps {
  onSelect: (type: FormalizationType) => void;
}

const templates: {
  type: FormalizationType;
  icon: React.ReactNode;
  emoji: string;
  description: string;
  tags: string[];
}[] = [
  {
    type: "budget_item_swap",
    icon: <RefreshCw className="h-5 w-5" />,
    emoji: "💰",
    description:
      "Registra a troca de um item do orçamento por outro, documentando valores e motivos.",
    tags: ["Orçamento", "Troca"],
  },
  {
    type: "meeting_minutes",
    icon: <FileText className="h-5 w-5" />,
    emoji: "📝",
    description:
      "Documenta decisões e discussões de reuniões com registro de participantes e tópicos.",
    tags: ["Reunião", "Ata"],
  },
  {
    type: "exception_custody",
    icon: <Package className="h-5 w-5" />,
    emoji: "📦",
    description:
      "Formaliza a custódia temporária de itens, incluindo estado, local e responsabilidades.",
    tags: ["Custódia", "Item"],
  },
  {
    type: "scope_change",
    icon: <Repeat className="h-5 w-5" />,
    emoji: "🔄",
    description:
      "Registra alterações no escopo original do projeto com análise de impacto em prazo e custo.",
    tags: ["Escopo", "Aditivo"],
  },
  {
    type: "general",
    icon: <FileEdit className="h-5 w-5" />,
    emoji: "📄",
    description:
      "Documento genérico para registros que não se encaixam nos demais templates.",
    tags: ["Geral", "Livre"],
  },
];

export function TemplateSelector({ onSelect }: TemplateSelectorProps) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 mb-4">
          <FileText className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">Escolha o tipo</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Selecione o template que melhor se encaixa na situação
        </p>
      </div>

      <div className="grid gap-3">
        {templates.map((template, index) => (
          <Card
            key={template.type}
            className="cursor-pointer group hover:border-primary hover:shadow-md transition-all duration-200 overflow-hidden animate-fade-in opacity-0"
            style={{
              animationDelay: `${index * 100}ms`,
              animationFillMode: "forwards",
            }}
            onClick={() => onSelect(template.type)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && onSelect(template.type)}
            aria-label={`Selecionar ${FORMALIZATION_TYPE_LABELS[template.type]}`}
          >
            <CardContent className="p-0">
              <div className="flex items-center gap-4 p-4">
                {/* Icon */}
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 group-hover:scale-110 transition-all">
                  <span className="text-2xl" role="img" aria-hidden="true">
                    {template.emoji}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                      {FORMALIZATION_TYPE_LABELS[template.type]}
                    </h3>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {template.description}
                  </p>
                  <div className="flex gap-1.5 mt-2">
                    {template.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Arrow */}
                <ChevronRight className="h-5 w-5 text-muted-foreground/50 shrink-0 group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-center text-muted-foreground">
        Selecione um template para iniciar com conteúdo pré-preenchido
      </p>
    </div>
  );
}
