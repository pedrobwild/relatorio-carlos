import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { TableSkeleton, EmptyState } from '@/components/ui-premium';
import { Search, FileText, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { formatBRL } from '@/lib/formatBRL';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  requested: { label: 'Solicitado', className: 'bg-muted text-muted-foreground' },
  in_progress: { label: 'Em Produção', className: 'bg-primary/10 text-primary border-primary/20' },
  review: { label: 'Revisão', className: 'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/20' },
  waiting_info: { label: 'Aguardando Info', className: 'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/20' },
  blocked: { label: 'Bloqueado', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  ready: { label: 'Pronto', className: 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border-[hsl(var(--success))]/20' },
  sent_to_client: { label: 'Enviado ao Cliente', className: 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border-[hsl(var(--success))]/20' },
  approved: { label: 'Aprovado', className: 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border-[hsl(var(--success))]/20' },
  rejected: { label: 'Recusado', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  cancelled: { label: 'Cancelado', className: 'bg-muted text-muted-foreground' },
};

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  low: { label: 'Baixa', className: 'text-muted-foreground' },
  normal: { label: 'Normal', className: 'text-foreground' },
  high: { label: 'Alta', className: 'text-[hsl(var(--warning))]' },
  urgent: { label: 'Urgente', className: 'text-destructive' },
};

export default function Orcamentos() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data: orcamentos, isLoading } = useQuery({
    queryKey: ['orcamentos', 'list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orcamentos')
        .select(`
          id, sequential_code, project_name, client_name, internal_status, priority,
          due_at, created_at, updated_at, city, bairro, metragem,
          commercial_owner_id, estimator_owner_id
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const filtered = (orcamentos || []).filter((o) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      o.project_name?.toLowerCase().includes(s) ||
      o.client_name?.toLowerCase().includes(s) ||
      o.sequential_code?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orçamentos</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie os orçamentos recebidos do Envision Guide
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por projeto ou cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} columns={7} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={search ? 'Nenhum orçamento para esta busca' : 'Nenhum orçamento cadastrado'}
          description={search ? 'Tente outro termo de busca ou limpe o filtro.' : 'Os orçamentos recebidos do Envision aparecerão aqui.'}
          size="md"
        />
      ) : (
        <div className="rounded-md border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[60px] text-xs">Código</TableHead>
                <TableHead className="min-w-[180px] text-xs">Projeto / Cliente</TableHead>
                <TableHead className="w-[120px] text-center text-xs">Status</TableHead>
                <TableHead className="w-[80px] text-center text-xs">Prioridade</TableHead>
                <TableHead className="w-[100px] text-xs">Local</TableHead>
                <TableHead className="w-[100px] text-xs">Criado em</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((orc) => {
                const status = STATUS_CONFIG[orc.internal_status] || STATUS_CONFIG.requested;
                const prio = PRIORITY_CONFIG[orc.priority] || PRIORITY_CONFIG.normal;
                return (
                  <TableRow
                    key={orc.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/gestao/orcamentos/${orc.id}`)}
                  >
                    <TableCell>
                      <span className="text-xs font-mono text-muted-foreground">
                        {orc.sequential_code || '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{orc.project_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{orc.client_name}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={`${status.className} text-[10px] whitespace-nowrap`}>
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`text-xs font-medium ${prio.className}`}>{prio.label}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground truncate block max-w-[100px]">
                        {[orc.bairro, orc.city].filter(Boolean).join(', ') || '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {orc.created_at ? format(new Date(orc.created_at), 'dd/MM/yyyy') : '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => { e.stopPropagation(); navigate(`/gestao/orcamentos/${orc.id}`); }}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
