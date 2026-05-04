import { Search, Filter, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import type { AuditoriaAcao } from "@/infra/repositories/auditoria.repository";

const ACOES: { value: AuditoriaAcao; label: string }[] = [
  { value: "create", label: "Criação" },
  { value: "update", label: "Atualização" },
  { value: "delete", label: "Remoção" },
];

interface AuditFiltersCardProps {
  search: string;
  setSearch: (v: string) => void;
  acao: string;
  setAcao: (v: string) => void;
  entidade: string;
  setEntidade: (v: string) => void;
  dateFrom: Date | undefined;
  setDateFrom: (v: Date | undefined) => void;
  dateTo: Date | undefined;
  setDateTo: (v: Date | undefined) => void;
  entityTypes: string[];
  onResetFilters: () => void;
  hasActiveFilters: boolean;
  setPage: (p: number) => void;
}

export function AuditFiltersCard({
  search,
  setSearch,
  acao,
  setAcao,
  entidade,
  setEntidade,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  entityTypes,
  onResetFilters,
  hasActiveFilters,
  setPage,
}: AuditFiltersCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Filtros
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onResetFilters}
              className="ml-auto h-7 text-xs"
            >
              Limpar filtros
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por entidade ou ID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>

          <Select
            value={acao}
            onValueChange={(v) => {
              setAcao(v === "all" ? "" : v);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Ação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as ações</SelectItem>
              {ACOES.map((a) => (
                <SelectItem key={a.value} value={a.value}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={entidade}
            onValueChange={(v) => {
              setEntidade(v === "all" ? "" : v);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Entidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as entidades</SelectItem>
              {entityTypes.map((type) => (
                <SelectItem key={type} value={type} className="capitalize">
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="justify-start text-left font-normal"
              >
                <Calendar className="h-4 w-4 mr-2" />
                {dateFrom || dateTo ? (
                  <span className="text-xs">
                    {dateFrom?.toLocaleDateString("pt-BR") || "..."} -{" "}
                    {dateTo?.toLocaleDateString("pt-BR") || "..."}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Período</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <div className="flex">
                <div className="p-2 border-r">
                  <p className="text-xs text-muted-foreground mb-2 px-2">De</p>
                  <CalendarComponent
                    mode="single"
                    selected={dateFrom}
                    onSelect={(d) => {
                      setDateFrom(d);
                      setPage(1);
                    }}
                  />
                </div>
                <div className="p-2">
                  <p className="text-xs text-muted-foreground mb-2 px-2">Até</p>
                  <CalendarComponent
                    mode="single"
                    selected={dateTo}
                    onSelect={(d) => {
                      setDateTo(d);
                      setPage(1);
                    }}
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </CardContent>
    </Card>
  );
}
