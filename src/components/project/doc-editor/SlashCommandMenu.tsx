import { useState, useEffect, useRef, useCallback } from "react";
import {
  Heading1,
  Heading2,
  Heading3,
  Type,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code,
  Minus,
  Image,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { matchesSearch } from "@/lib/searchNormalize";

export interface SlashCommand {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

interface SlashCommandMenuProps {
  open: boolean;
  onClose: () => void;
  position: { top: number; left: number };
  commands: SlashCommand[];
}

export function SlashCommandMenu({
  open,
  onClose,
  position,
  commands,
}: SlashCommandMenuProps) {
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const filtered = commands.filter((c) =>
    matchesSearch(search, [c.label, c.description]),
  );

  useEffect(() => {
    setSearch("");
    setSelectedIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].action();
          onClose();
        }
      } else if (e.key === "Backspace" && search === "") {
        onClose();
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        setSearch((s) => s + e.key);
        setSelectedIndex(0);
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [open, search, selectedIndex, filtered, onClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  if (!open || filtered.length === 0) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-72 max-h-80 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg"
      style={{ top: position.top, left: position.left }}
    >
      {search && (
        <div className="px-3 py-2 border-b border-border">
          <span className="text-xs text-muted-foreground">Buscar: </span>
          <span className="text-xs font-medium">{search}</span>
        </div>
      )}
      <div className="py-1">
        {filtered.map((cmd, i) => (
          <button
            key={cmd.id}
            type="button"
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
              i === selectedIndex
                ? "bg-accent text-accent-foreground"
                : "hover:bg-muted",
            )}
            onMouseEnter={() => setSelectedIndex(i)}
            onMouseDown={(e) => {
              e.preventDefault();
              cmd.action();
              onClose();
            }}
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted text-muted-foreground shrink-0">
              {cmd.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{cmd.label}</div>
              <div className="text-xs text-muted-foreground truncate">
                {cmd.description}
              </div>
            </div>
            {cmd.shortcut && (
              <span className="text-xs text-muted-foreground font-mono">
                {cmd.shortcut}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export function useSlashCommands(
  editorRef: React.RefObject<HTMLDivElement | null>,
  exec: (cmd: string, val?: string) => void,
  execBlock: (tag: string) => void,
  onInput: () => void,
) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

  const removeSlashChar = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType === Node.TEXT_NODE && node.textContent) {
      const offset = range.startOffset;
      const text = node.textContent;
      // Find the slash before cursor
      const slashPos = text.lastIndexOf("/", offset);
      if (slashPos >= 0) {
        node.textContent = text.slice(0, slashPos) + text.slice(offset);
        const newRange = document.createRange();
        newRange.setStart(node, slashPos);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
      }
    }
  }, []);

  const insertCheckbox = useCallback(() => {
    removeSlashChar();
    const id = `chk-${Date.now()}`;
    const html = `<div class="doc-checklist-item" style="display:flex;align-items:flex-start;gap:8px;margin:4px 0;"><input type="checkbox" id="${id}" style="margin-top:4px;accent-color:hsl(var(--primary));width:16px;height:16px;cursor:pointer;" /><label for="${id}" contenteditable="true" style="flex:1;outline:none;">Item</label></div>`;
    document.execCommand("insertHTML", false, html);
    onInput();
  }, [removeSlashChar, onInput]);

  const commands: SlashCommand[] = [
    {
      id: "h1",
      label: "Título grande",
      description: "Título de seção principal",
      icon: <Heading1 className="w-4 h-4" />,
      shortcut: "#",
      action: () => {
        removeSlashChar();
        execBlock("h1");
      },
    },
    {
      id: "h2",
      label: "Título médio",
      description: "Subtítulo de seção",
      icon: <Heading2 className="w-4 h-4" />,
      shortcut: "##",
      action: () => {
        removeSlashChar();
        execBlock("h2");
      },
    },
    {
      id: "h3",
      label: "Título pequeno",
      description: "Subtítulo menor",
      icon: <Heading3 className="w-4 h-4" />,
      shortcut: "###",
      action: () => {
        removeSlashChar();
        execBlock("h3");
      },
    },
    {
      id: "text",
      label: "Texto normal",
      description: "Parágrafo de texto simples",
      icon: <Type className="w-4 h-4" />,
      action: () => {
        removeSlashChar();
        execBlock("p");
      },
    },
    {
      id: "ul",
      label: "Lista com marcadores",
      description: "Lista não ordenada",
      icon: <List className="w-4 h-4" />,
      action: () => {
        removeSlashChar();
        exec("insertUnorderedList");
      },
    },
    {
      id: "ol",
      label: "Lista numerada",
      description: "Lista ordenada",
      icon: <ListOrdered className="w-4 h-4" />,
      action: () => {
        removeSlashChar();
        exec("insertOrderedList");
      },
    },
    {
      id: "checklist",
      label: "Lista de verificação",
      description: "Checklist com caixas de seleção",
      icon: <CheckSquare className="w-4 h-4" />,
      action: insertCheckbox,
    },
    {
      id: "quote",
      label: "Citação",
      description: "Bloco de citação destacado",
      icon: <Quote className="w-4 h-4" />,
      action: () => {
        removeSlashChar();
        execBlock("blockquote");
      },
    },
    {
      id: "code",
      label: "Código",
      description: "Bloco de código mono-espaçado",
      icon: <Code className="w-4 h-4" />,
      action: () => {
        removeSlashChar();
        execBlock("pre");
      },
    },
    {
      id: "divider",
      label: "Linha divisória",
      description: "Separador horizontal",
      icon: <Minus className="w-4 h-4" />,
      action: () => {
        removeSlashChar();
        exec("insertHorizontalRule");
      },
    },
  ];

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "/" && !menuOpen) {
        // Defer to after the char is inserted
        setTimeout(() => {
          const sel = window.getSelection();
          if (!sel || sel.rangeCount === 0) return;
          const range = sel.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          setMenuPosition({
            top: rect.bottom + 4,
            left: rect.left,
          });
          setMenuOpen(true);
        }, 0);
      }
    },
    [menuOpen],
  );

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  return { menuOpen, menuPosition, commands, handleKeyDown, closeMenu };
}
