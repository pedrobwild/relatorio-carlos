/**
 * TabHistorico — timeline de alterações da obra (audit log).
 *
 * Mostra entradas de `audit_logs` para o `projectId` em ordem cronológica
 * decrescente. Agrupa por dia e oferece filtro por entidade
 * (projects, pagamentos, documentos, etc.).
 *
 * Diff de UPDATE é renderizado de forma compacta: "campo: antigo → novo".
 * Para INSERT/DELETE, mostra um resumo da entidade (com fallback genérico).
 */
import { useMemo, useState } from 'react';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  History,
  FileText,
  DollarSign,
  ListChecks,
  ClipboardList,
  CalendarDays,
  Building2,
  ScrollText,
  PencilLine,
  PlusCircle,
  Trash2,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useProjectAuditLog,
  type AuditLogEntry,
  type AuditTableName,
} from '@/hooks/useProjectAuditLog';

interface TabHistoricoProps {
  projectId: string;
}

/** Configuração visual por tabela auditada. */
const TABLE_META: Record<
  string,
  { label: string; icon: typeof FileText; tone: string }
> = {
  projects: { label: 'Obra', icon: Building2, tone: 'bg-blue-50 text-blue-700' },
  project_documents: { label: 'Documentos', icon: FileText, tone: 'bg-violet-50 text-violet-700' },
  project_payments: { label: 'Pagamentos', icon: DollarSign, tone: 'bg-emerald-50 text-emerald-700' },
  project_daily_logs: { label: 'Diário de obra', icon: ClipboardList, tone: 'bg-amber-50 text-amber-700' },
  obra_tasks: { label: 'Atividades', icon: ListChecks, tone: 'bg-indigo-50 text-indigo-700' },
  journey_stage_records: { label: 'Etapas', icon: CalendarDays, tone: 'bg-teal-50 text-teal-700' },
  stage_dates: { label: 'Cronograma', icon: CalendarDays, tone: 'bg-cyan-50 text-cyan-700' },
  formalizations: { label: 'Formalizações', icon: ScrollText, tone: 'bg-rose-50 text-rose-700' },
};

const ACTION_META: Record<
  AuditLogEntry['action'],
  { label: string; icon: typeof PencilLine; tone: string }
> = {
  INSERT: { label: 'Criou', icon: PlusCircle, tone: 'text-emerald-700' },
  UPDATE: { label: 'Atualizou', icon: PencilLine, tone: 'text-blue-700' },
  DELETE: { label: 'Excluiu', icon: Trash2, tone: 'text-red-700' },
};

/** Colunas que poluem o diff e não agregam valor ao usuário final. */
const NOISE_COLUMNS = new Set(['updated_at', 'created_at', 'painel_ultima_atualizacao']);

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') {
    // Datas ISO viram leitura amigável
    if (/^\d{4}-\d{2}-\d{2}(T|$)/.test(value)) {
      try {
        return format(parseISO(value), "dd/MM/yyyy", { locale: ptBR });
      } catch {
        return value;
      }
    }
    return value.length > 80 ? value.slice(0, 80) + '…' : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value).slice(0, 80);
}

function formatGroupLabel(dateStr: string): string {
  const d = parseISO(dateStr);
  if (isToday(d)) return 'Hoje';
  if (isYesterday(d)) return 'Ontem';
  return format(d, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
}

/** Agrupa entradas por data (YYYY-MM-DD). */
function groupByDay(entries: AuditLogEntry[]): Array<{ day: string; items: AuditLogEntry[] }> {
  const map = new Map<string, AuditLogEntry[]>();
  for (const entry of entries) {
    const day = entry.created_at.slice(0, 10);
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(entry);
  }
  return Array.from(map.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([day, items]) => ({ day, items }));
}

/** Resumo human-readable de um INSERT (escolhe um campo descritivo). */
function summarizeInsert(entry: AuditLogEntry): string {
  const v = entry.new_values ?? {};
  const candidate = (v.name ?? v.title ?? v.description ?? v.notes) as string | undefined;
  return candidate ? `"${formatValue(candidate)}"` : `#${entry.record_id.slice(0, 8)}`;
}

function summarizeDelete(entry: AuditLogEntry): string {
  const v = entry.old_values ?? {};
  const candidate = (v.name ?? v.title ?? v.description ?? v.notes) as string | undefined;
  return candidate ? `"${formatValue(candidate)}"` : `#${entry.record_id.slice(0, 8)}`;
}

function AuditEntry({ entry }: { entry: AuditLogEntry }) {
  const tableMeta = TABLE_META[entry.table_name] ?? {
    label: entry.table_name,
    icon: FileText,
    tone: 'bg-gray-50 text-gray-700',
  };
  const actionMeta = ACTION_META[entry.action];
  const TableIcon = tableMeta.icon;
  const ActionIcon = actionMeta.icon;
  const time = format(parseISO(entry.created_at), 'HH:mm', { locale: ptBR });

  const visibleChanges = (entry.changed_columns ?? [])
    .filter((c) => !NOISE_COLUMNS.has(c))
    .slice(0, 6);

  return (
    <div className="flex gap-3 py-3">
      <div className={`shrink-0 h-9 w-9 rounded-full flex items-center justify-center ${tableMeta.tone}`}>
        <TableIcon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs">
            {tableMeta.label}
          </Badge>
          <span className={`flex items-center gap-1 text-sm font-medium ${actionMeta.tone}`}>
            <ActionIcon className="h-3.5 w-3.5" />
            {actionMeta.label}
          </span>
          <span className="text-xs text-muted-foreground">
            {entry.changed_by_email ?? 'Sistema'} · {time}
          </span>
        </div>

        {entry.action === 'INSERT' && (
          <p className="text-sm text-foreground/80 mt-1">
            Novo registro: <span className="font-medium">{summarizeInsert(entry)}</span>
          </p>
        )}
        {entry.action === 'DELETE' && (
          <p className="text-sm text-foreground/80 mt-1">
            Removido: <span className="font-medium">{summarizeDelete(entry)}</span>
          </p>
        )}
        {entry.action === 'UPDATE' && visibleChanges.length > 0 && (
          <ul className="mt-1 space-y-0.5 text-sm">
            {visibleChanges.map((col) => {
              const oldVal = entry.old_values?.[col];
              const newVal = entry.new_values?.[col];
              return (
                <li key={col} className="text-foreground/80">
                  <span className="font-medium">{col}</span>:{' '}
                  <span className="text-muted-foreground line-through">{formatValue(oldVal)}</span>{' '}
                  <span aria-hidden>→</span>{' '}
                  <span className="text-foreground">{formatValue(newVal)}</span>
                </li>
              );
            })}
            {(entry.changed_columns?.length ?? 0) > visibleChanges.length && (
              <li className="text-xs text-muted-foreground">
                +{(entry.changed_columns!.length - visibleChanges.length)} outras alterações
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

const FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'Todas as entidades' },
  { value: 'projects', label: 'Obra' },
  { value: 'project_payments', label: 'Pagamentos' },
  { value: 'project_documents', label: 'Documentos' },
  { value: 'project_daily_logs', label: 'Diário de obra' },
  { value: 'obra_tasks', label: 'Atividades' },
  { value: 'journey_stage_records', label: 'Etapas' },
  { value: 'stage_dates', label: 'Cronograma' },
  { value: 'formalizations', label: 'Formalizações' },
];

export function TabHistorico({ projectId }: TabHistoricoProps) {
  const [filter, setFilter] = useState<string>('all');

  const { data, isLoading, error } = useProjectAuditLog(projectId, {
    tableName: filter === 'all' ? undefined : (filter as AuditTableName),
  });

  const grouped = useMemo(() => groupByDay(data ?? []), [data]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="h-5 w-5" />
          Histórico de alterações
        </CardTitle>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Carregando histórico…
          </div>
        )}
        {error && (
          <p className="text-sm text-red-600 py-4">
            Não foi possível carregar o histórico.
          </p>
        )}
        {!isLoading && !error && grouped.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Nenhuma alteração registrada ainda para esta obra.
          </p>
        )}
        {!isLoading && !error && grouped.length > 0 && (
          <div className="space-y-6">
            {grouped.map(({ day, items }) => (
              <div key={day}>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2 sticky top-0 bg-background/80 backdrop-blur py-1">
                  {formatGroupLabel(day)}
                </h3>
                <div className="divide-y">
                  {items.map((entry) => (
                    <AuditEntry key={entry.id} entry={entry} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
