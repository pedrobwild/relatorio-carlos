import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  FileText,
  FolderOpen,
  DollarSign,
  ClipboardSignature,
  AlertCircle,
} from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  icon: typeof FileText;
  path: string;
  group: string;
}

export function GlobalSearchDialog() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { projectId, paths } = useProjectNavigation();
  const isMobile = useIsMobile();

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const search = useCallback(
    async (term: string) => {
      if (!term || term.length < 2 || !projectId) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const searchTerm = `%${term}%`;

        const [docsRes, formRes, pendingRes, filesRes] =
          await Promise.allSettled([
            supabase
              .from("project_documents")
              .select("id, name, document_type")
              .eq("project_id", projectId)
              .ilike("name", searchTerm)
              .limit(5),
            supabase
              .from("formalizations")
              .select("id, title, type")
              .eq("project_id", projectId)
              .ilike("title", searchTerm)
              .limit(5),
            supabase
              .from("pending_items")
              .select("id, title, type")
              .eq("project_id", projectId)
              .ilike("title", searchTerm)
              .limit(5),
            supabase
              .from("files")
              .select("id, original_name, category")
              .eq("project_id", projectId)
              .eq("status", "active")
              .ilike("original_name", searchTerm)
              .limit(5),
          ]);

        const items: SearchResult[] = [];

        if (docsRes.status === "fulfilled" && docsRes.value.data) {
          docsRes.value.data.forEach((d) =>
            items.push({
              id: d.id,
              title: d.name,
              subtitle: d.document_type,
              icon: FileText,
              path: `${paths.documentos}`,
              group: "Documentos",
            }),
          );
        }

        if (formRes.status === "fulfilled" && formRes.value.data) {
          formRes.value.data.forEach((f) =>
            items.push({
              id: f.id,
              title: f.title,
              subtitle: f.type,
              icon: ClipboardSignature,
              path: `${paths.formalizacoes}/${f.id}`,
              group: "Formalizações",
            }),
          );
        }

        if (pendingRes.status === "fulfilled" && pendingRes.value.data) {
          pendingRes.value.data.forEach((p) =>
            items.push({
              id: p.id,
              title: p.title,
              subtitle: p.type,
              icon: AlertCircle,
              path: paths.pendencias,
              group: "Pendências",
            }),
          );
        }

        if (filesRes.status === "fulfilled" && filesRes.value.data) {
          filesRes.value.data.forEach((f) =>
            items.push({
              id: f.id,
              title: f.original_name,
              subtitle: f.category ?? undefined,
              icon: FolderOpen,
              path: paths.documentos,
              group: "Arquivos",
            }),
          );
        }

        setResults(items);
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setLoading(false);
      }
    },
    [projectId, paths],
  );

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  const handleSelect = (path: string) => {
    setOpen(false);
    setQuery("");
    navigate(path);
  };

  // Group results
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    (acc[r.group] ??= []).push(r);
    return acc;
  }, {});

  return (
    <>
      {/* Desktop: text input style trigger */}
      {!isMobile && (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 h-8 px-3 rounded-md border border-input bg-background text-muted-foreground text-sm hover:bg-accent transition-colors w-48 lg:w-64"
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate flex-1 text-left">Buscar…</span>
          <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
            ⌘K
          </kbd>
        </button>
      )}

      {/* Mobile: icon button */}
      {isMobile && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpen(true)}
          className="h-9 w-9"
          aria-label="Buscar"
        >
          <Search className="h-4.5 w-4.5" />
        </Button>
      )}

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Buscar documentos, arquivos, pendências…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {query.length < 2 ? (
            <CommandEmpty>
              Digite ao menos 2 caracteres para buscar
            </CommandEmpty>
          ) : loading ? (
            <CommandEmpty>Buscando…</CommandEmpty>
          ) : results.length === 0 ? (
            <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
          ) : (
            Object.entries(grouped).map(([group, items]) => (
              <CommandGroup key={group} heading={group}>
                {items.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.title}
                    onSelect={() => handleSelect(item.path)}
                    className="cursor-pointer"
                  >
                    <item.icon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex flex-col min-w-0">
                      <span className="truncate text-sm">{item.title}</span>
                      {item.subtitle && (
                        <span className="text-xs text-muted-foreground truncate">
                          {item.subtitle}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
