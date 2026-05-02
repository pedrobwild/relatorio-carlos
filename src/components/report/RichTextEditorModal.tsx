import { useState, useRef, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Paintbrush,
  Highlighter,
  Undo2,
  Redo2,
  Type,
  Strikethrough,
  Save,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileFullscreenSheet } from "@/components/mobile";

interface RichTextEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onSave: (html: string) => void;
  title?: string;
}

const FONT_SIZES = [
  { label: "Pequeno", value: "2" },
  { label: "Normal", value: "3" },
  { label: "Médio", value: "4" },
  { label: "Grande", value: "5" },
  { label: "Muito grande", value: "6" },
];

const TEXT_COLORS = [
  "#1a1a1a", "#374151", "#6b7280",
  "#7c3aed", "#6d28d9", "#4c1d95",
  "#dc2626", "#ea580c", "#d97706",
  "#16a34a", "#0891b2", "#2563eb",
];

const HIGHLIGHT_COLORS = [
  "transparent",
  "#fef08a", "#fed7aa", "#fecaca",
  "#bbf7d0", "#bae6fd", "#ddd6fe",
  "#fbcfe8", "#e5e7eb",
];

function ToolbarButton({
  onClick,
  active,
  children,
  title,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault(); // keep focus in editor
        onClick();
      }}
      title={title}
      className={cn(
        "p-1.5 rounded-md transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center",
        active
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

export function RichTextEditorModal({
  open,
  onOpenChange,
  value,
  onSave,
  title = "Editar Resumo Executivo",
}: RichTextEditorModalProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState("3");
  const isMobile = useIsMobile();

  // Initialize editor content when modal opens
  // Use requestAnimationFrame to wait for the Radix portal to mount the DOM
  useEffect(() => {
    if (!open) return;
    const setContent = () => {
      if (!editorRef.current) return;
      const isHtml = /<[a-z][\s\S]*>/i.test(value);
      if (isHtml) {
        editorRef.current.innerHTML = value;
      } else {
        const html = value
          .split("\n\n")
          .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
          .join("");
        editorRef.current.innerHTML = html || "<p><br></p>";
      }
    };
    // Try immediately, then retry after paint in case portal hasn't mounted yet
    if (editorRef.current) {
      setContent();
    } else {
      requestAnimationFrame(() => requestAnimationFrame(setContent));
    }
  }, [open, value]);

  const exec = useCallback((command: string, val?: string) => {
    document.execCommand(command, false, val);
    editorRef.current?.focus();
  }, []);

  const handleFontSize = (size: string) => {
    setFontSize(size);
    exec("fontSize", size);
  };

  const handleTextColor = (color: string) => {
    exec("foreColor", color);
  };

  const handleHighlight = (color: string) => {
    if (color === "transparent") {
      exec("removeFormat");
    } else {
      exec("hiliteColor", color);
    }
  };

  const handleSave = () => {
    const html = editorRef.current?.innerHTML || "";
    onSave(html);
    onOpenChange(false);
  };

  // ── Toolbar — duas variantes responsivas ──────────────────────────
  // Desktop: linha única com todos os grupos visíveis.
  // Mobile : ações essenciais (B / I / U / lista) inline; o restante
  //          (cor, destaque, alinhamento, tamanho, riscado, undo/redo)
  //          fica num popover "Mais" para evitar wrap de toolbar e
  //          preservar área de edição confortável.
  const DesktopToolbar = (
    <div className="px-3 py-2 border-b border-border bg-muted/30 flex flex-wrap items-center gap-0.5">
      {/* Undo / Redo */}
      <ToolbarButton onClick={() => exec("undo")} title="Desfazer">
        <Undo2 className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => exec("redo")} title="Refazer">
        <Redo2 className="w-4 h-4" />
      </ToolbarButton>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Font Size */}
      <Select value={fontSize} onValueChange={handleFontSize}>
        <SelectTrigger className="w-[120px] h-8 text-xs border-border">
          <Type className="w-3.5 h-3.5 mr-1.5 shrink-0" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FONT_SIZES.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Format */}
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

      <div className="w-px h-5 bg-border mx-1" />

      {/* Text Color */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            title="Cor do texto"
            className="p-1.5 rounded-md transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Paintbrush className="w-4 h-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start">
          <p className="text-xs font-medium text-muted-foreground mb-2">Cor do texto</p>
          <div className="grid grid-cols-6 gap-1.5">
            {TEXT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleTextColor(color);
                }}
                className="w-6 h-6 rounded-md border border-border hover:scale-110 transition-transform"
                style={{ backgroundColor: color }}
                aria-label={`Cor ${color}`}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Highlight */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            title="Destaque"
            className="p-1.5 rounded-md transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Highlighter className="w-4 h-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start">
          <p className="text-xs font-medium text-muted-foreground mb-2">Cor de destaque</p>
          <div className="grid grid-cols-5 gap-1.5">
            {HIGHLIGHT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleHighlight(color);
                }}
                className={cn(
                  "w-6 h-6 rounded-md border border-border hover:scale-110 transition-transform",
                  color === "transparent" && "bg-[repeating-conic-gradient(#ccc_0%_25%,transparent_0%_50%)] bg-[length:8px_8px]"
                )}
                style={color !== "transparent" ? { backgroundColor: color } : undefined}
                aria-label={color === "transparent" ? "Remover destaque" : `Destacar com ${color}`}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Lists */}
      <ToolbarButton onClick={() => exec("insertUnorderedList")} title="Lista com marcadores">
        <List className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => exec("insertOrderedList")} title="Lista numerada">
        <ListOrdered className="w-4 h-4" />
      </ToolbarButton>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Alignment */}
      <ToolbarButton onClick={() => exec("justifyLeft")} title="Alinhar à esquerda">
        <AlignLeft className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => exec("justifyCenter")} title="Centralizar">
        <AlignCenter className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => exec("justifyRight")} title="Alinhar à direita">
        <AlignRight className="w-4 h-4" />
      </ToolbarButton>
    </div>
  );

  const MobileToolbar = (
    <div
      className="px-2 py-1.5 border-b border-border bg-muted/30 flex items-center gap-0.5 overflow-x-auto scrollbar-hide"
      role="toolbar"
      aria-label="Formatação de texto"
    >
      <ToolbarButton onClick={() => exec("bold")} title="Negrito">
        <Bold className="w-5 h-5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => exec("italic")} title="Itálico">
        <Italic className="w-5 h-5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => exec("underline")} title="Sublinhado">
        <Underline className="w-5 h-5" />
      </ToolbarButton>
      <div className="w-px h-5 bg-border mx-1 shrink-0" aria-hidden />
      <ToolbarButton onClick={() => exec("insertUnorderedList")} title="Lista">
        <List className="w-5 h-5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => exec("insertOrderedList")} title="Lista numerada">
        <ListOrdered className="w-5 h-5" />
      </ToolbarButton>
      <div className="w-px h-5 bg-border mx-1 shrink-0" aria-hidden />
      <ToolbarButton onClick={() => exec("undo")} title="Desfazer">
        <Undo2 className="w-5 h-5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => exec("redo")} title="Refazer">
        <Redo2 className="w-5 h-5" />
      </ToolbarButton>

      {/* Mais — concentra ações secundárias e evita overflow horizontal. */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            title="Mais opções de formatação"
            aria-label="Mais opções de formatação"
            className="ml-auto shrink-0 p-1.5 rounded-md min-h-[40px] min-w-[40px] flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[280px] p-3 space-y-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Tamanho</p>
            <Select value={fontSize} onValueChange={handleFontSize}>
              <SelectTrigger className="h-10 text-sm">
                <Type className="w-4 h-4 mr-2 shrink-0" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_SIZES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Estilo</p>
            <div className="flex items-center gap-1">
              <ToolbarButton onClick={() => exec("strikeThrough")} title="Riscado">
                <Strikethrough className="w-5 h-5" />
              </ToolbarButton>
              <ToolbarButton onClick={() => exec("justifyLeft")} title="Alinhar à esquerda">
                <AlignLeft className="w-5 h-5" />
              </ToolbarButton>
              <ToolbarButton onClick={() => exec("justifyCenter")} title="Centralizar">
                <AlignCenter className="w-5 h-5" />
              </ToolbarButton>
              <ToolbarButton onClick={() => exec("justifyRight")} title="Alinhar à direita">
                <AlignRight className="w-5 h-5" />
              </ToolbarButton>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Cor do texto</p>
            <div className="grid grid-cols-6 gap-2">
              {TEXT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); handleTextColor(color); }}
                  className="w-7 h-7 rounded-md border border-border"
                  style={{ backgroundColor: color }}
                  aria-label={`Cor ${color}`}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Destaque</p>
            <div className="grid grid-cols-5 gap-2">
              {HIGHLIGHT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); handleHighlight(color); }}
                  className={cn(
                    "w-7 h-7 rounded-md border border-border",
                    color === "transparent" && "bg-[repeating-conic-gradient(#ccc_0%_25%,transparent_0%_50%)] bg-[length:8px_8px]"
                  )}
                  style={color !== "transparent" ? { backgroundColor: color } : undefined}
                  aria-label={color === "transparent" ? "Remover destaque" : `Destacar com ${color}`}
                />
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );

  const EditorArea = (
    <div
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label={title}
      className={cn(
        "min-h-[280px] outline-none",
        "prose prose-sm max-w-none",
        "text-foreground leading-[1.7]",
        "[&_p]:mb-3 [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:mb-1",
        "[&_p]:text-sm [&_li]:text-sm",
        "focus:outline-none"
      )}
    />
  );

  // ── Mobile: full-screen sheet com header sticky (Salvar inline) e
  //    toolbar compacta. Sem modal centralizado, sem footer redundante.
  if (isMobile) {
    return (
      <MobileFullscreenSheet
        open={open}
        onOpenChange={onOpenChange}
        title={title}
        closeAriaLabel="Cancelar e voltar"
        bodyClassName="flex flex-col"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="h-11">
              Cancelar
            </Button>
            <Button onClick={handleSave} className="h-11 min-w-[120px]">
              <Save className="w-4 h-4 mr-2" />
              Aplicar
            </Button>
          </div>
        }
      >
        {MobileToolbar}
        <div className="flex-1 min-h-0 overflow-auto px-4 py-3">
          {EditorArea}
        </div>
      </MobileFullscreenSheet>
    );
  }

  // ── Desktop: dialog centralizado (preserva o comportamento original).
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 py-4 border-b border-border">
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
        </DialogHeader>

        {DesktopToolbar}

        {/* Editor area */}
        <div className="flex-1 overflow-auto px-5 py-4 min-h-[300px] max-h-[55vh]">
          {EditorArea}
        </div>

        {/* Footer */}
        <DialogFooter className="px-5 py-3 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
