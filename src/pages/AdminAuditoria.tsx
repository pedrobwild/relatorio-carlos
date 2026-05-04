/**
 * Admin Auditoria Page
 *
 * Full audit log viewer for admin/managers.
 */

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, History, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAudits, useEntityTypes } from "@/hooks/useAuditoria";
import {
  formatAuditsForCSV,
  type AuditoriaAcao,
} from "@/infra/repositories/auditoria.repository";
import { AuditFiltersCard } from "@/components/audit/AuditFiltersCard";
import { AuditTable } from "@/components/audit/AuditTable";
import bwildLogo from "@/assets/bwild-logo-dark.png";

const PAGE_SIZE = 20;

export default function AdminAuditoria() {
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [acao, setAcao] = useState<string>("");
  const [entidade, setEntidade] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const filters = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      search: search || undefined,
      acao: (acao as AuditoriaAcao) || undefined,
      entidade: entidade || undefined,
      date_from: dateFrom?.toISOString(),
      date_to: dateTo?.toISOString(),
    }),
    [page, search, acao, entidade, dateFrom, dateTo],
  );

  const { data, isLoading, error } = useAudits(filters);
  const { data: entityTypes = [] } = useEntityTypes();

  const audits = data?.data || [];
  const totalCount = data?.count || 0;

  const handleExportCSV = () => {
    if (audits.length === 0) return;
    const csv = formatAuditsForCSV(audits);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `auditoria_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleResetFilters = () => {
    setSearch("");
    setAcao("");
    setEntidade("");
    setDateFrom(undefined);
    setDateTo(undefined);
    setPage(1);
  };

  const hasActiveFilters = !!(search || acao || entidade || dateFrom || dateTo);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/admin")}
                className="shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <img src={bwildLogo} alt="Bwild" className="h-8" />
              <div>
                <h1 className="text-lg font-bold flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Auditoria
                </h1>
                <p className="text-xs text-muted-foreground">
                  Trilha de alterações do sistema
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={audits.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <AuditFiltersCard
          search={search}
          setSearch={setSearch}
          acao={acao}
          setAcao={setAcao}
          entidade={entidade}
          setEntidade={setEntidade}
          dateFrom={dateFrom}
          setDateFrom={setDateFrom}
          dateTo={dateTo}
          setDateTo={setDateTo}
          entityTypes={entityTypes}
          onResetFilters={handleResetFilters}
          hasActiveFilters={hasActiveFilters}
          setPage={setPage}
        />

        <AuditTable
          audits={audits}
          isLoading={isLoading}
          error={error}
          totalCount={totalCount}
          page={page}
          setPage={setPage}
          pageSize={PAGE_SIZE}
          hasActiveFilters={hasActiveFilters}
          onResetFilters={handleResetFilters}
        />
      </main>
    </div>
  );
}
