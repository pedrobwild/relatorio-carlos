import { useRef, useCallback, useEffect } from "react";
import { Bold, Italic, Underline, List, ListOrdered } from "lucide-react";
import { cn } from "@/lib/utils";

interface InlineRichEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
}

function TBtn({
  onClick,
  children,
  title,
}: {
  onClick: () => void;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      className="p-1 rounded transition-colors text-muted-foreground hover:bg-muted hover:text-foreground min-h-[28px] min-w-[28px] flex items-center justify-center"
    >
      {children}
    </button>
  );
}

export function InlineRichEditor({
  value,
  onChange,
  placeholder = "Digite aqui...",
  minHeight = "120px",
  className,
}: InlineRichEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!editorRef.current) return;
    // Only set innerHTML on first mount or when value changes externally
    if (!initializedRef.current) {
      const isHtml = /<[a-z][\s\S]*>/i.test(value);
      editorRef.current.innerHTML = isHtml
        ? value
        : value
            .split("\n\n")
            .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
            .join("") || "";
      initializedRef.current = true;
    }
  }, [value]);

  // Reset initialized flag when value is cleared externally
  useEffect(() => {
    if (!value && editorRef.current && editorRef.current.innerHTML !== "") {
      editorRef.current.innerHTML = "";
      initializedRef.current = false;
    }
  }, [value]);

  const exec = useCallback(
    (command: string) => {
      document.execCommand(command, false);
      editorRef.current?.focus();
      // Emit change
      onChange(editorRef.current?.innerHTML || "");
    },
    [onChange],
  );

  const handleInput = useCallback(() => {
    onChange(editorRef.current?.innerHTML || "");
  }, [onChange]);

  const isEmpty = !value || value === "<p><br></p>" || value === "<br>";

  return (
    <div
      className={cn("rounded-md border border-input bg-background", className)}
    >
      {/* Mini toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1 border-b border-input bg-muted/30">
        <TBtn onClick={() => exec("bold")} title="Negrito">
          <Bold className="w-3.5 h-3.5" />
        </TBtn>
        <TBtn onClick={() => exec("italic")} title="Itálico">
          <Italic className="w-3.5 h-3.5" />
        </TBtn>
        <TBtn onClick={() => exec("underline")} title="Sublinhado">
          <Underline className="w-3.5 h-3.5" />
        </TBtn>
        <div className="w-px h-4 bg-border mx-0.5" />
        <TBtn onClick={() => exec("insertUnorderedList")} title="Lista">
          <List className="w-3.5 h-3.5" />
        </TBtn>
        <TBtn onClick={() => exec("insertOrderedList")} title="Lista numerada">
          <ListOrdered className="w-3.5 h-3.5" />
        </TBtn>
      </div>

      {/* Editable area */}
      <div className="relative">
        {isEmpty && (
          <div className="absolute top-0 left-0 px-3 py-2 text-sm text-muted-foreground pointer-events-none">
            {placeholder}
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          className={cn(
            "px-3 py-2 text-sm outline-none",
            "prose prose-sm max-w-none",
            "text-foreground leading-relaxed",
            "[&_p]:mb-1 [&_ul]:pl-4 [&_ol]:pl-4 [&_li]:mb-0.5",
          )}
          style={{ minHeight }}
        />
      </div>
    </div>
  );
}
