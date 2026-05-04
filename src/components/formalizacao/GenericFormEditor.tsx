import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface GenericFormEditorProps {
  onComplete: (data: {
    title: string;
    summary: string;
    body_md: string;
    data: Record<string, unknown>;
  }) => void;
  initialData: { title: string; summary: string; body_md: string };
}

export function GenericFormEditor({
  onComplete,
  initialData,
}: GenericFormEditorProps) {
  const [title, setTitle] = useState(initialData.title);
  const [summary, setSummary] = useState(initialData.summary);
  const [bodyMd, setBodyMd] = useState(initialData.body_md);

  const handleSubmit = () => {
    if (!title.trim() || !summary.trim()) return;
    onComplete({
      title: title.trim(),
      summary: summary.trim(),
      body_md: bodyMd.trim(),
      data: {},
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-2">
        <h2 className="text-xl font-semibold">Dados da Formalização</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Preencha ou ajuste o conteúdo pré-preenchido pelo template
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Título *</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título da formalização"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="summary">Resumo *</Label>
          <Input
            id="summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Breve descrição"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="body">Conteúdo (Markdown)</Label>
          <Textarea
            id="body"
            value={bodyMd}
            onChange={(e) => setBodyMd(e.target.value)}
            placeholder="Conteúdo detalhado em formato Markdown..."
            className="min-h-[300px] font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            O template já vem pré-preenchido. Substitua os campos entre
            [colchetes] com as informações reais.
          </p>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t">
        <Button
          onClick={handleSubmit}
          disabled={!title.trim() || !summary.trim()}
          className="min-h-[44px]"
        >
          Continuar
        </Button>
      </div>
    </div>
  );
}
