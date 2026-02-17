/**
 * Admin Auditoria Page
 * 
 * Full audit log viewer for admin/managers.
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  History, 
  Download, 
  Search, 
  Filter, 
  Calendar,
  User,
  ChevronLeft,
  ChevronRight,
  Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { useAudits, useEntityTypes } from '@/hooks/useAuditoria';
import { formatAuditsForCSV, type AuditoriaWithUser, type AuditoriaAcao } from '@/infra/repositories/auditoria.repository';
import bwildLogo from '@/assets/bwild-logo.png';

const PAGE_SIZE = 20;

const ACOES: { value: AuditoriaAcao; label: string }[] = [
  { value: 'create', label: 'Criação' },
  { value: 'update', label: 'Atualização' },
  { value: 'delete', label: 'Remoção' },
];

const getActionConfig = (acao: string): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } => {
  const configs: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    create: { label: 'Criado', variant: 'default' },
    update: { label: 'Atualizado', variant: 'secondary' },
    delete: { label: 'Removido', variant: 'destructive' },
  };
  return configs[acao] || { label: acao, variant: 'outline' };
};

function AuditDetailModal({ audit }: { audit: AuditoriaWithUser }) {
  const actionConfig = getActionConfig(audit.acao);
  const userName = audit.users_profile?.nome || audit.users_profile?.email || 'Sistema';

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Eye className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Detalhes do Registro de Auditoria
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Metadata grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">ID</p>
              <code className="text-xs bg-muted px-2 py-1 rounded">{audit.id.slice(0, 8)}...</code>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Ação</p>
              <Badge variant={actionConfig.variant}>{actionConfig.label}</Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Data/Hora</p>
              <p className="text-sm">{new Date(audit.created_at).toLocaleString('pt-BR')}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Usuário</p>
              <p className="text-sm">{userName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Entidade</p>
              <Badge variant="outline" className="capitalize">{audit.entidade}</Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">ID Entidade</p>
              <code className="text-xs bg-muted px-2 py-1 rounded">{audit.entidade_id.slice(0, 8)}...</code>
            </div>
            {audit.obra_id && (
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground mb-1">Obra ID</p>
                <code className="text-xs bg-muted px-2 py-1 rounded">{audit.obra_id}</code>
              </div>
            )}
          </div>

          {/* Diff section */}
          {audit.diff && (
            <div>
              <p className="text-sm font-medium mb-2">Alterações (diff)</p>
              <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-64 border">
                {JSON.stringify(audit.diff, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TableLoading() {
  return (
    <TableBody>
      {[1, 2, 3, 4, 5].map((i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
          <TableCell><Skeleton className="h-6 w-20" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
          <TableCell><Skeleton className="h-8 w-8" /></TableCell>
        </TableRow>
      ))}
    </TableBody>
  );
}

export default function AdminAuditoria() {
  const navigate = useNavigate();
  
  // Filters state
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [acao, setAcao] = useState<string>('');
  const [entidade, setEntidade] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  // Build filters object
  const filters = useMemo(() => ({
    page,
    pageSize: PAGE_SIZE,
    search: search || undefined,
    acao: acao as AuditoriaAcao || undefined,
    entidade: entidade || undefined,
    date_from: dateFrom?.toISOString(),
    date_to: dateTo?.toISOString(),
  }), [page, search, acao, entidade, dateFrom, dateTo]);

  const { data, isLoading, error } = useAudits(filters);
  const { data: entityTypes = [] } = useEntityTypes();

  const audits = data?.data || [];
  const totalCount = data?.count || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Export to CSV
  const handleExportCSV = () => {
    if (audits.length === 0) return;
    
    const csv = formatAuditsForCSV(audits);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `auditoria_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Reset filters
  const handleResetFilters = () => {
    setSearch('');
    setAcao('');
    setEntidade('');
    setDateFrom(undefined);
    setDateTo(undefined);
    setPage(1);
  };

  const hasActiveFilters = search || acao || entidade || dateFrom || dateTo;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigate('/admin')}
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
            <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={audits.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Filters Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filtros
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={handleResetFilters} className="ml-auto h-7 text-xs">
                  Limpar filtros
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Search */}
              <div className="relative lg:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por entidade ou ID..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="pl-9"
                />
              </div>

              {/* Ação */}
              <Select value={acao} onValueChange={(v) => { setAcao(v === 'all' ? '' : v); setPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Ação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as ações</SelectItem>
                  {ACOES.map((a) => (
                    <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Entidade */}
              <Select value={entidade} onValueChange={(v) => { setEntidade(v === 'all' ? '' : v); setPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Entidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as entidades</SelectItem>
                  {entityTypes.map((type) => (
                    <SelectItem key={type} value={type} className="capitalize">{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Date Range */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start text-left font-normal">
                    <Calendar className="h-4 w-4 mr-2" />
                    {dateFrom || dateTo ? (
                      <span className="text-xs">
                        {dateFrom?.toLocaleDateString('pt-BR') || '...'} - {dateTo?.toLocaleDateString('pt-BR') || '...'}
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
                        onSelect={(d) => { setDateFrom(d); setPage(1); }}
                      />
                    </div>
                    <div className="p-2">
                      <p className="text-xs text-muted-foreground mb-2 px-2">Até</p>
                      <CalendarComponent
                        mode="single"
                        selected={dateTo}
                        onSelect={(d) => { setDateTo(d); setPage(1); }}
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </CardContent>
        </Card>

        {/* Results Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Registros de Auditoria</span>
              {!isLoading && (
                <Badge variant="secondary" className="text-xs">
                  {totalCount} registro{totalCount !== 1 ? 's' : ''}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="text-center py-8">
                <p className="text-destructive">Erro ao carregar dados de auditoria.</p>
              </div>
            ) : (
              <>
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[140px]">Data/Hora</TableHead>
                        <TableHead>Usuário</TableHead>
                        <TableHead className="w-[100px]">Ação</TableHead>
                        <TableHead>Entidade</TableHead>
                        <TableHead>ID Entidade</TableHead>
                        <TableHead className="w-[60px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    {isLoading ? (
                      <TableLoading />
                    ) : audits.length === 0 ? (
                      <TableBody>
                        <TableRow>
                          <TableCell colSpan={6} className="h-32 text-center">
                            <div className="flex flex-col items-center gap-2">
                              <History className="h-8 w-8 text-muted-foreground/30" />
                              <p className="text-muted-foreground">Nenhum registro encontrado</p>
                              {hasActiveFilters && (
                                <Button variant="link" size="sm" onClick={handleResetFilters}>
                                  Limpar filtros
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    ) : (
                      <TableBody>
                        {audits.map((audit) => {
                          const actionConfig = getActionConfig(audit.acao);
                          const userName = audit.users_profile?.nome || audit.users_profile?.email || 'Sistema';
                          
                          return (
                            <TableRow key={audit.id}>
                              <TableCell className="text-xs">
                                {new Date(audit.created_at).toLocaleString('pt-BR')}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                                    <User className="h-3 w-3" />
                                  </div>
                                  <span className="text-sm truncate max-w-[150px]">{userName}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={actionConfig.variant} className="text-xs">
                                  {actionConfig.label}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="capitalize text-xs">
                                  {audit.entidade}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <code className="text-xs bg-muted px-2 py-1 rounded">
                                  {audit.entidade_id.slice(0, 8)}...
                                </code>
                              </TableCell>
                              <TableCell>
                                <AuditDetailModal audit={audit} />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    )}
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-xs text-muted-foreground">
                      Página {page} de {totalPages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                      >
                        Próxima
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
