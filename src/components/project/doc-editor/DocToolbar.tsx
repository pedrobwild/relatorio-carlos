import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
  Link,
  Quote,
  Code,
  Minus,
  Save,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

function ToolbarButton({
  onClick,
  children,
  title,
  active,
}: {
  onClick: () => void;
  children: React.ReactNode;
  title: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      className={cn(
        "p-1.5 rounded transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-5 bg-border mx-1" />;
}

interface DocToolbarProps {
  exec: (cmd: string, val?: string) => void;
  execBlock: (tag: string) => void;
  onInsertLink: () => void;
  saving: boolean;
  saved: boolean;
  onManualSave: () => void;
}

export function DocToolbar({
  exec,
  execBlock,
  onInsertLink,
  saving,
  saved,
  onManualSave,
}: DocToolbarProps) {
  return (
    <div className="sticky top-0 z-10 bg-background border border-border rounded-t-lg">
      <div className="flex items-center gap-0.5 px-3 py-2 flex-wrap">
        <ToolbarButton onClick={() => exec("undo")} title="Desfazer">
          <Undo className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec("redo")} title="Refazer">
          <Redo className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton onClick={() => execBlock("h1")} title="Título grande">
          <Heading1 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => execBlock("h2")} title="Título médio">
          <Heading2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => execBlock("h3")} title="Título pequeno">
          <Heading3 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => execBlock("p")} title="Texto normal">
          <span className="text-xs font-medium">T</span>
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton onClick={() => exec("bold")} title="Negrito">
          <Bold className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec("italic")} title="Itálico">
          <Italic className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec("underline")} title="Sublinhado">
          <Underline className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec("strikeThrough")} title="Riscado">
          <Strikethrough className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          onClick={() => exec("insertUnorderedList")}
          title="Lista com marcadores"
        >
          <List className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => exec("insertOrderedList")}
          title="Lista numerada"
        >
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          onClick={() => exec("justifyLeft")}
          title="Alinhar à esquerda"
        >
          <AlignLeft className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => exec("justifyCenter")}
          title="Centralizar"
        >
          <AlignCenter className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => exec("justifyRight")}
          title="Alinhar à direita"
        >
          <AlignRight className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton onClick={onInsertLink} title="Inserir link">
          <Link className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => execBlock("blockquote")} title="Citação">
          <Quote className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => execBlock("pre")} title="Código">
          <Code className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => exec("insertHorizontalRule")}
          title="Linha divisória"
        >
          <Minus className="w-4 h-4" />
        </ToolbarButton>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Salvo
            </span>
          )}
          {saving && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Salvando...
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={onManualSave}
            disabled={saving}
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            Salvar
          </Button>
        </div>
      </div>
    </div>
  );
}
