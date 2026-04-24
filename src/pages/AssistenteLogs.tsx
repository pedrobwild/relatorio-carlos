import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, FileBarChart, Search, Sparkles, AlertCircle, Clock, Database } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface LogRow {
  id: string;
  user_id: string;
  question: string;
  generated_sql: string | null;
  domain: string | null;
  rows_returned: number | null;
  latency_ms: number | null;
  tokens_input: number | null;
  tokens_output: number | null;
  model: string | null;
  status: string;
  error_message: string | null;
  answer_summary: string | null;
  created_at: string;
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "destructive" | "secondary" | "outline" }> = {
  success: { label: "Sucesso", variant: "default" },
  sql_blocked: { label: "SQL Bloqueado", variant: "destructive" },
  sql_error: { label: "Erro SQL", variant: "destructive" },
  llm_error: { label: "Erro LLM", variant: "destructive" },
  timeout: { label: "Timeout", variant: "destructive" },
  other: { label: "Outro", variant: "secondary" },
};

export default function AssistenteLogs() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [domainFilter, setDomainFilter] = useState<string>("all");
  const [userMap, setUserMap] = useState<Record<string, string>>({});

  useEffect(() => {
    document.title = "Logs do Assistente · BWild";
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("assistant_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      toast.error("Erro ao carregar logs");
      setLoading(false);
      return;
    }
    setLogs((data ?? []) as LogRow[]);

    // Carregar nomes dos usuários
    const userIds = [...new Set((data ?? []).map((l: LogRow) => l.user_id))];
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("users_profile")
        .select("id, nome, email")
        .in("id", userIds);
      const map: Record<string, string> = {};
      (profiles ?? []).forEach((p: { id: string; nome: string | null; email: string | null }) => {
        map[p.id] = p.nome ?? p.email ?? p.id.slice(0, 8);
      });
      setUserMap(map);
    }
    setLoading(false);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return logs.filter((l) => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (domainFilter !== "all" && l.domain !== domainFilter) return false;
      if (q && !(
        l.question.toLowerCase().includes(q) ||
        (l.answer_summary ?? "").toLowerCase().includes(q) ||
        (userMap[l.user_id] ?? "").toLowerCase().includes(q)
      )) return false;
      return true;
    });
  }, [logs, search, statusFilter, domainFilter, userMap]);

  const stats = useMemo(() => {
    const total = logs.length;
    const success = logs.filter((l) => l.status === "success").length;
    const errors = total - success;
    const avgLatency = total > 0 ? Math.round(logs.reduce((s, l) => s + (l.latency_ms ?? 0), 0) / total) : 0;
    const totalTokens = logs.reduce((s, l) => s + (l.tokens_input ?? 0) + (l.tokens_output ?? 0), 0);
    return { total, success, errors, avgLatency, totalTokens };
  }, [logs]);

  return (
    <div className="container max-w-7xl py-6 space-y-6">
      <header>
        <div className="flex items-center gap-2 mb-1">
          <FileBarChart className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Logs do Assistente IA</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Histórico técnico de todas as perguntas feitas ao assistente. Apenas equipe interna tem acesso.
        </p>
      </header>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
        <StatCard icon={Sparkles} label="Total" value={stats.total} />
        <StatCard icon={Sparkles} label="Sucesso" value={stats.success} accent="text-green-600" />
        <StatCard icon={AlertCircle} label="Erros" value={stats.errors} accent="text-destructive" />
        <StatCard icon={Clock} label="Latência média" value={`${stats.avgLatency}ms`} />
        <StatCard icon={Database} label="Tokens totais" value={stats.totalTokens.toLocaleString("pt-BR")} />
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por pergunta, resposta ou usuário..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="success">Sucesso</SelectItem>
              <SelectItem value="sql_blocked">SQL Bloqueado</SelectItem>
              <SelectItem value="sql_error">Erro SQL</SelectItem>
              <SelectItem value="llm_error">Erro LLM</SelectItem>
              <SelectItem value="timeout">Timeout</SelectItem>
              <SelectItem value="other">Outro</SelectItem>
            </SelectContent>
          </Select>
          <Select value={domainFilter} onValueChange={setDomainFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Domínio" />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="all">Todos os domínios</SelectItem>
              <SelectItem value="financeiro">Financeiro</SelectItem>
              <SelectItem value="compras">Compras</SelectItem>
              <SelectItem value="cronograma">Cronograma</SelectItem>
              <SelectItem value="ncs">NCs</SelectItem>
              <SelectItem value="pendencias">Pendências</SelectItem>
              <SelectItem value="cs">CS</SelectItem>
              <SelectItem value="outros">Outros</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum log encontrado com esses filtros.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Pergunta</TableHead>
                    <TableHead>Domínio</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Linhas</TableHead>
                    <TableHead className="text-right">Latência</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((l) => {
                    const statusInfo = STATUS_LABELS[l.status] ?? STATUS_LABELS.other;
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {new Date(l.created_at).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-xs">
                          {userMap[l.user_id] ?? l.user_id.slice(0, 8)}
                        </TableCell>
                        <TableCell className="max-w-[280px] truncate" title={l.question}>
                          {l.question}
                        </TableCell>
                        <TableCell>
                          {l.domain && (
                            <Badge variant="secondary" className="text-[10px]">
                              {l.domain}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusInfo.variant} className="text-[10px]">
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs">{l.rows_returned ?? "—"}</TableCell>
                        <TableCell className={cn("text-right text-xs", (l.latency_ms ?? 0) > 5000 && "text-destructive")}>
                          {l.latency_ms ? `${l.latency_ms}ms` : "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {((l.tokens_input ?? 0) + (l.tokens_output ?? 0)).toLocaleString("pt-BR")}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  accent?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </div>
        <div className={cn("text-xl font-bold", accent)}>{value}</div>
      </CardContent>
    </Card>
  );
}
