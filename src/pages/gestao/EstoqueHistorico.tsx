import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  History,
  Search,
  Download,
  FileText,
  FileSpreadsheet,
  X,
  ArrowDownToLine,
  ArrowUpFromLine,
  Wrench,
  Building2,
  Warehouse,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import Papa from "papaparse";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState, PageSkeleton } from "@/components/ui/states";

// ─── Types ──────────────────────────────────────────────────────────────────

type StockItem = { id: string; name: string; unit: string; category: string | null };
type Project = { id: string; name: string };

type Movement = {
  id: string;
  item_id: string;
  movement_type: "entrada" | "saida" | "ajuste";
  quantity: number;
  movement_date: string;
  location_type: "estoque" | "obra";
  project_id: string | null;
  supplier_name: string | null;
  unit_cost: number | null;
  invoice_number: string | null;
  responsible_name: string | null;
  reason: string | null;
  notes: string | null;
  created_at: string;
};

const PAGE_SIZES = [25, 50, 100];

export default function EstoqueHistorico() {
  // Filtros
  const [search, setSearch] = useState("");
  const [itemFilter, setItemFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all"); // all | estoque | <projectId>
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(0);

  // Queries
  const itemsQ = useQuery({
    queryKey: ["stock", "items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_items")
        .select("id, name, unit, category")
        .order("name");
      if (error) throw error;
      return (data ?? []) as StockItem[];
    },
  });

  const projectsQ = useQuery({
    queryKey: ["stock", "projects-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Project[];
    },
  });

  const movementsQ = useQuery({
    queryKey: [
      "stock",
      "movements-history",
      itemFilter,
      projectFilter,
      typeFilter,
      dateFrom,
      dateTo,
    ],
    queryFn: async () => {
      let q = supabase
        .from("stock_movements")
        .select("*")
        .order("movement_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(2000);

      if (itemFilter !== "all") q = q.eq("item_id", itemFilter);
      if (typeFilter !== "all") q = q.eq("movement_type", typeFilter);
      if (projectFilter === "estoque") q = q.eq("location_type", "estoque");
      else if (projectFilter !== "all") {
        q = q.eq("location_type", "obra").eq("project_id", projectFilter);
      }
      if (dateFrom) q = q.gte("movement_date", dateFrom);
      if (dateTo) q = q.lte("movement_date", dateTo);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Movement[];
    },
  });

  const itemMap = useMemo(() => {
    const m = new Map<string, StockItem>();
    (itemsQ.data ?? []).forEach((it) => m.set(it.id, it));
    return m;
  }, [itemsQ.data]);

  const projectMap = useMemo(() => {
    const m = new Map<string, string>();
    (projectsQ.data ?? []).forEach((p) => m.set(p.id, p.name));
    return m;
  }, [projectsQ.data]);

  // Filtro de busca em texto livre (cliente)
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const all = movementsQ.data ?? [];
    if (!term) return all;
    return all.filter((m) => {
      const item = itemMap.get(m.item_id);
      const projectName = m.project_id ? projectMap.get(m.project_id) ?? "" : "";
      const hay = [
        item?.name,
        item?.category,
        projectName,
        m.supplier_name,
        m.invoice_number,
        m.responsible_name,
        m.reason,
        m.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [movementsQ.data, search, itemMap, projectMap]);

  // Paginação
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = useMemo(
    () => filtered.slice(safePage * pageSize, safePage * pageSize + pageSize),
    [filtered, safePage, pageSize],
  );

  // Resumo
  const summary = useMemo(() => {
    let entradas = 0;
    let saidas = 0;
    let ajustes = 0;
    filtered.forEach((m) => {
      if (m.movement_type === "entrada") entradas += Number(m.quantity);
      else if (m.movement_type === "saida") saidas += Number(m.quantity);
      else ajustes += Number(m.quantity);
    });
    return { total: filtered.length, entradas, saidas, ajustes };
  }, [filtered]);

  const hasFilter =
    !!search.trim() ||
    itemFilter !== "all" ||
    projectFilter !== "all" ||
    typeFilter !== "all" ||
    !!dateFrom ||
    !!dateTo;

  // ─── Export helpers ──────────────────────────────────────────────────────

  const buildExportRows = () =>
    filtered.map((m) => {
      const item = itemMap.get(m.item_id);
      const local =
        m.location_type === "estoque"
          ? "Estoque central"
          : m.project_id
          ? projectMap.get(m.project_id) ?? "Obra"
          : "Obra";
      return {
        Data: format(parseISO(m.movement_date), "dd/MM/yyyy", { locale: ptBR }),
        Tipo:
          m.movement_type === "entrada"
            ? "Entrada"
            : m.movement_type === "saida"
            ? "Saída"
            : "Ajuste",
        Item: item?.name ?? "—",
        Categoria: item?.category ?? "",
        Quantidade: Number(m.quantity).toLocaleString("pt-BR", {
          maximumFractionDigits: 3,
        }),
        Unidade: item?.unit ?? "",
        Local: local,
        Responsável: m.responsible_name ?? "",
        Motivo: m.reason ?? "",
        Fornecedor: m.supplier_name ?? "",
        NF: m.invoice_number ?? "",
        "Custo unit. (R$)":
          m.unit_cost != null
            ? Number(m.unit_cost).toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            : "",
        Observações: m.notes ?? "",
      };
    });

  const exportFileName = (ext: string) => {
    const parts = ["historico-estoque"];
    if (itemFilter !== "all") {
      const it = itemMap.get(itemFilter);
      if (it) parts.push(slug(it.name));
    }
    if (projectFilter === "estoque") parts.push("estoque-central");
    else if (projectFilter !== "all") {
      const name = projectMap.get(projectFilter);
      if (name) parts.push(slug(name));
    }
    parts.push(format(new Date(), "yyyyMMdd-HHmm"));
    return `${parts.join("_")}.${ext}`;
  };

  const exportCSV = () => {
    if (filtered.length === 0) {
      toast.info("Nenhum registro para exportar");
      return;
    }
    const csv = Papa.unparse(buildExportRows(), { delimiter: ";" });
    // BOM para Excel reconhecer UTF-8
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    triggerDownload(blob, exportFileName("csv"));
    toast.success(`${filtered.length} registros exportados (CSV)`);
  };

  const exportPDF = () => {
    if (filtered.length === 0) {
      toast.info("Nenhum registro para exportar");
      return;
    }

    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const now = format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR });

    // Cabeçalho
    doc.setFontSize(14);
    doc.text("Histórico de movimentações de estoque", 40, 40);
    doc.setFontSize(9);
    doc.setTextColor(110);

    const filterLines: string[] = [];
    if (itemFilter !== "all") {
      const it = itemMap.get(itemFilter);
      filterLines.push(`Item: ${it?.name ?? itemFilter}`);
    }
    if (projectFilter === "estoque") filterLines.push("Local: Estoque central");
    else if (projectFilter !== "all") {
      filterLines.push(`Obra: ${projectMap.get(projectFilter) ?? projectFilter}`);
    }
    if (typeFilter !== "all") filterLines.push(`Tipo: ${typeFilter}`);
    if (dateFrom || dateTo) {
      filterLines.push(`Período: ${dateFrom || "—"} a ${dateTo || "—"}`);
    }
    if (search.trim()) filterLines.push(`Busca: "${search.trim()}"`);
    filterLines.push(`Gerado em ${now}`);
    filterLines.push(
      `${summary.total} registros · Entradas ${fmt(summary.entradas)} · Saídas ${fmt(
        summary.saidas,
      )} · Ajustes ${fmt(summary.ajustes)}`,
    );

    doc.text(filterLines.join("  ·  "), 40, 58, { maxWidth: 760 });

    // Tabela
    const rows = buildExportRows();
    autoTable(doc, {
      startY: 80,
      head: [
        [
          "Data",
          "Tipo",
          "Item",
          "Qtd",
          "Un",
          "Local",
          "Responsável",
          "Motivo",
          "Fornecedor / NF",
        ],
      ],
      body: rows.map((r) => [
        r.Data,
        r.Tipo,
        r.Item,
        r.Quantidade,
        r.Unidade,
        r.Local,
        r.Responsável,
        r.Motivo,
        [r.Fornecedor, r.NF].filter(Boolean).join(" · "),
      ]),
      styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
      headStyles: { fillColor: [241, 245, 249], textColor: 30, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [250, 250, 252] },
      columnStyles: {
        0: { cellWidth: 55 },
        1: { cellWidth: 50 },
        2: { cellWidth: 150 },
        3: { cellWidth: 50, halign: "right" },
        4: { cellWidth: 30 },
        5: { cellWidth: 110 },
        6: { cellWidth: 90 },
        7: { cellWidth: 110 },
        8: { cellWidth: 130 },
      },
      didDrawPage: (data) => {
        const pageCount = doc.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(140);
        doc.text(
          `Página ${data.pageNumber} de ${pageCount}`,
          doc.internal.pageSize.getWidth() - 80,
          doc.internal.pageSize.getHeight() - 20,
        );
      },
    });

    doc.save(exportFileName("pdf"));
    toast.success(`${filtered.length} registros exportados (PDF)`);
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  const isLoading = movementsQ.isLoading || itemsQ.isLoading;

  return (
    <main className="max-w-6xl mx-auto px-4 py-6 space-y-5">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-h2 font-bold flex items-center gap-2">
            <History className="h-6 w-6" />
            Histórico de movimentações
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Filtre entradas, saídas e ajustes por item, obra e período. Exporte para CSV ou PDF.
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="gap-2" disabled={filtered.length === 0}>
              <Download className="h-4 w-4" />
              Exportar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={exportCSV}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              CSV (planilha)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportPDF}>
              <FileText className="h-4 w-4 mr-2" />
              PDF (relatório)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Movimentações" value={summary.total} />
        <SummaryCard label="Entradas" value={summary.entradas} tone="positive" />
        <SummaryCard label="Saídas" value={summary.saidas} tone="negative" />
        <SummaryCard label="Ajustes" value={summary.ajustes} tone="muted" />
      </div>

      {/* Filtros */}
      <div className="rounded-lg border bg-card p-3 space-y-3">
        <div className="flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Buscar por item, fornecedor, responsável, motivo, NF…"
              className="pl-9"
              aria-label="Buscar movimentações"
            />
          </div>
          <Select value={itemFilter} onValueChange={(v) => { setItemFilter(v); setPage(0); }}>
            <SelectTrigger className="md:w-[220px]" aria-label="Item">
              <SelectValue placeholder="Item" />
            </SelectTrigger>
            <SelectContent position="popper" className="max-h-[300px]">
              <SelectItem value="all">Todos os itens</SelectItem>
              {(itemsQ.data ?? []).map((it) => (
                <SelectItem key={it.id} value={it.id}>{it.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={projectFilter} onValueChange={(v) => { setProjectFilter(v); setPage(0); }}>
            <SelectTrigger className="md:w-[220px]" aria-label="Local">
              <SelectValue placeholder="Local" />
            </SelectTrigger>
            <SelectContent position="popper" className="max-h-[300px]">
              <SelectItem value="all">Todos os locais</SelectItem>
              <SelectItem value="estoque">Estoque central</SelectItem>
              {(projectsQ.data ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col md:flex-row gap-2 md:items-end">
          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(0); }}>
            <SelectTrigger className="md:w-[180px]" aria-label="Tipo">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="entrada">Entrada</SelectItem>
              <SelectItem value="saida">Saída</SelectItem>
              <SelectItem value="ajuste">Ajuste</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex flex-col gap-1">
            <Label htmlFor="from" className="text-xs text-muted-foreground">De</Label>
            <Input
              id="from"
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(0); }}
              className="md:w-[160px]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="to" className="text-xs text-muted-foreground">Até</Label>
            <Input
              id="to"
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
              className="md:w-[160px]"
            />
          </div>
          {hasFilter && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearch("");
                setItemFilter("all");
                setProjectFilter("all");
                setTypeFilter("all");
                setDateFrom("");
                setDateTo("");
                setPage(0);
              }}
              className="gap-1"
            >
              <X className="h-4 w-4" />
              Limpar filtros
            </Button>
          )}
        </div>
      </div>

      {/* Tabela */}
      {isLoading ? (
        <PageSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={History}
          title="Nenhuma movimentação encontrada"
          description={
            hasFilter
              ? "Ajuste os filtros para ver outros registros."
              : "Registre uma entrada ou saída para ver o histórico aqui."
          }
        />
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qtd.</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead>Responsável / Motivo</TableHead>
                  <TableHead>Fornecedor / NF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((m) => {
                  const item = itemMap.get(m.item_id);
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {format(parseISO(m.movement_date), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell><MovementBadge type={m.movement_type} /></TableCell>
                      <TableCell>
                        <div className="font-medium">{item?.name ?? "—"}</div>
                        {item?.category && (
                          <div className="text-xs text-muted-foreground">{item.category}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {Number(m.quantity).toLocaleString("pt-BR", { maximumFractionDigits: 3 })}{" "}
                        <span className="text-xs text-muted-foreground font-sans">{item?.unit}</span>
                      </TableCell>
                      <TableCell>
                        <LocationBadge
                          locationType={m.location_type}
                          projectName={m.project_id ? projectMap.get(m.project_id) : undefined}
                        />
                      </TableCell>
                      <TableCell className="text-xs">
                        {m.responsible_name && (
                          <div className="text-foreground">{m.responsible_name}</div>
                        )}
                        {m.reason && (
                          <div className="text-muted-foreground line-clamp-1">{m.reason}</div>
                        )}
                        {!m.responsible_name && !m.reason && (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {m.supplier_name || "—"}
                        {m.invoice_number ? ` · NF ${m.invoice_number}` : ""}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Paginação */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
            <div className="text-muted-foreground">
              Mostrando{" "}
              <span className="font-medium text-foreground">
                {safePage * pageSize + 1}–
                {Math.min((safePage + 1) * pageSize, filtered.length)}
              </span>{" "}
              de <span className="font-medium text-foreground">{filtered.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="page-size" className="text-xs text-muted-foreground">
                Por página
              </Label>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => { setPageSize(Number(v)); setPage(0); }}
              >
                <SelectTrigger id="page-size" className="w-[80px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  {PAGE_SIZES.map((s) => (
                    <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
                aria-label="Página anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums">
                {safePage + 1} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={safePage >= totalPages - 1}
                aria-label="Próxima página"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}

// ─── Sub-components & helpers ───────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "positive" | "negative" | "muted";
}) {
  const valueClass =
    tone === "positive"
      ? "text-green-700 dark:text-green-400"
      : tone === "negative"
      ? "text-destructive"
      : tone === "muted"
      ? "text-muted-foreground"
      : "text-foreground";
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold mt-1 tabular-nums ${valueClass}`}>
        {value.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}
      </div>
    </div>
  );
}

function MovementBadge({ type }: { type: "entrada" | "saida" | "ajuste" }) {
  if (type === "entrada") {
    return (
      <Badge className="gap-1 bg-green-600 hover:bg-green-600/90 text-white">
        <ArrowDownToLine className="h-3 w-3" /> Entrada
      </Badge>
    );
  }
  if (type === "saida") {
    return (
      <Badge variant="destructive" className="gap-1">
        <ArrowUpFromLine className="h-3 w-3" /> Saída
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1">
      <Wrench className="h-3 w-3" /> Ajuste
    </Badge>
  );
}

function LocationBadge({
  locationType,
  projectName,
}: {
  locationType: "estoque" | "obra";
  projectName?: string;
}) {
  if (locationType === "estoque") {
    return (
      <Badge variant="secondary" className="gap-1">
        <Warehouse className="h-3 w-3" /> Estoque central
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 max-w-[220px]">
      <Building2 className="h-3 w-3 shrink-0" />
      <span className="truncate">{projectName ?? "Obra"}</span>
    </Badge>
  );
}

function fmt(n: number) {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

function slug(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 40);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
