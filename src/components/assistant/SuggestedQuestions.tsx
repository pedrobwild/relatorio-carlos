import { MessageCircleQuestion } from "lucide-react";

interface Props {
  questions: string[];
  onAsk: (q: string) => void;
  disabled?: boolean;
}

export function SuggestedQuestions({ questions, onAsk, disabled }: Props) {
  if (!questions || questions.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <MessageCircleQuestion className="h-3.5 w-3.5" />
        Perguntas sugeridas
      </div>
      <div className="flex flex-wrap gap-1.5">
        {questions.map((q) => (
          <button
            key={q}
            onClick={() => onAsk(q)}
            disabled={disabled}
            className="text-left text-xs px-2.5 py-1.5 rounded-full border border-border bg-card hover:bg-accent hover:border-primary/40 transition-colors disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
