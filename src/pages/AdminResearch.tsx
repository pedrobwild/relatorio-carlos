import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  Loader2,
  Copy,
  Check,
  Globe,
  Globe2,
  Layers,
  ExternalLink,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";

const SUGGESTED_QUERIES = [
  "Quais funcionalidades de acompanhamento de obra os melhores softwares do mercado oferecem para o cliente final?",
  "Como softwares como Procore e Buildertrend gerenciam aprovações e decisões do cliente?",
  "Quais são as melhores práticas de UX para dashboards de gestão de obras?",
  "Como implementar um sistema de notificações inteligentes para obras?",
  "Quais funcionalidades de gestão financeira são essenciais em softwares de construção?",
  "Como softwares de construção implementam galeria de fotos e progresso visual?",
];

export default function AdminResearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [searchFocus, setSearchFocus] = useState("all");
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<{
    content: string;
    citations: string[];
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<
    Array<{ query: string; content: string; citations: string[] }>
  >([]);

  const handleSearch = useCallback(
    async (searchQuery?: string) => {
      const q = searchQuery || query;
      if (!q.trim()) {
        toast.error("Digite uma pesquisa");
        return;
      }

      setIsSearching(true);
      setResult(null);

      try {
        const { data, error } = await supabase.functions.invoke(
          "perplexity-research",
          {
            body: { query: q, searchFocus },
          },
        );

        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || "Falha na pesquisa");

        const res = { content: data.content, citations: data.citations || [] };
        setResult(res);
        setHistory((prev) => [{ query: q, ...res }, ...prev.slice(0, 9)]);
      } catch (err: any) {
        console.error("Research error:", err);
        toast.error(err.message || "Erro na pesquisa");
      } finally {
        setIsSearching(false);
      }
    },
    [query, searchFocus],
  );

  const copyResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending"copied" reset on unmount so we don't update state after teardown.
  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current) clearTimeout(copyResetTimerRef.current);
    };
  }, []);

  const handleCopy = useCallback(() => {
    if (!result) return;
    navigator.clipboard.writeText(result.content);
    setCopied(true);
    toast.success("Copiado!");
    if (copyResetTimerRef.current) clearTimeout(copyResetTimerRef.current);
    copyResetTimerRef.current = setTimeout(() => setCopied(false), 2000);
  }, [result]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Pesquisa de Referências</h1>
          </div>
          <Badge variant="secondary" className="ml-auto text-xs">
            Powered by Perplexity
          </Badge>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Search Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="h-4 w-4 text-primary" />
              Pesquisar funcionalidades e referências
            </CardTitle>
            <CardDescription>
              Use IA para pesquisar funcionalidades de softwares de gestão de
              obras do mercado
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Ex: Como os melhores softwares de gestão de obras implementam o acompanhamento em tempo real para o cliente?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={3}
              className="resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                  handleSearch();
              }}
            />

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <ToggleGroup
                type="single"
                value={searchFocus}
                onValueChange={(v) => v && setSearchFocus(v)}
                size="sm"
              >
                <ToggleGroupItem value="all" className="text-xs gap-1.5">
                  <Layers className="h-3.5 w-3.5" /> Todos
                </ToggleGroupItem>
                <ToggleGroupItem value="national" className="text-xs gap-1.5">
                  <Globe className="h-3.5 w-3.5" /> Brasil
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="international"
                  className="text-xs gap-1.5"
                >
                  <Globe2 className="h-3.5 w-3.5" /> Internacional
                </ToggleGroupItem>
              </ToggleGroup>

              <Button
                onClick={() => handleSearch()}
                disabled={isSearching || !query.trim()}
                className="ml-auto gap-2"
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                {isSearching ? "Pesquisando..." : "Pesquisar"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Suggested Queries */}
        {!result && !isSearching && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground font-medium">
              Sugestões de pesquisa:
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {SUGGESTED_QUERIES.map((sq, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setQuery(sq);
                    handleSearch(sq);
                  }}
                  className="text-left p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors text-sm text-foreground/80"
                >
                  {sq}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {isSearching && (
          <Card>
            <CardContent className="py-12 flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Pesquisando referências de mercado...
              </p>
            </CardContent>
          </Card>
        )}

        {/* Result */}
        {result && (
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Resultado</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="gap-1.5"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? "Copiado" : "Copiar"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown>{result.content}</ReactMarkdown>
              </div>

              {result.citations.length > 0 && (
                <div className="border-t border-border pt-4 mt-4">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Fontes ({result.citations.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {result.citations.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline bg-primary/5 px-2 py-1 rounded"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {new URL(url).hostname.replace("www.", "")}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* History */}
        {history.length > 1 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground font-medium">
              Pesquisas anteriores:
            </p>
            <div className="space-y-2">
              {history.slice(1).map((h, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setQuery(h.query);
                    setResult({ content: h.content, citations: h.citations });
                  }}
                  className="w-full text-left p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors text-sm truncate"
                >
                  {h.query}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
