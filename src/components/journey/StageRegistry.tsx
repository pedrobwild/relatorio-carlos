import { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  BookOpen, MessageSquare, Clock, Plus, ExternalLink,
  Trash2, User, Building2,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  useStageRecords,
  useCreateStageRecord,
  useDeleteStageRecord,
  type RecordCategory,
  type StageRecord,
} from '@/hooks/useStageRecords';
import { useAuth } from '@/hooks/useAuth';

/* ─── Tab config ─── */

const tabConfig: { value: RecordCategory; label: string; Icon: React.ElementType }[] = [
  { value: 'decision', label: 'Decisões', Icon: BookOpen },
  { value: 'conversation', label: 'Conversas', Icon: MessageSquare },
  { value: 'history', label: 'Histórico', Icon: Clock },
];

/* ─── Props ─── */

interface StageRegistryProps {
  stageId: string;
  projectId: string;
  isAdmin: boolean;
}

/* ─── Main ─── */

export function StageRegistry({ stageId, projectId, isAdmin }: StageRegistryProps) {
  const { data: records, isLoading } = useStageRecords(stageId, projectId);
  const [activeTab, setActiveTab] = useState<RecordCategory>('decision');
  const [showForm, setShowForm] = useState(false);

  const filtered = useMemo(
    () => (records || []).filter((r) => r.category === activeTab),
    [records, activeTab],
  );

  const counts = useMemo(() => {
    const map: Record<RecordCategory, number> = { decision: 0, conversation: 0, history: 0 };
    for (const r of records || []) map[r.category as RecordCategory]++;
    return map;
  }, [records]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          Registro da etapa
        </h3>
        {isAdmin && !showForm && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setShowForm(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Novo registro
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as RecordCategory)}>
        <TabsList className="w-full grid grid-cols-3 h-9">
          {tabConfig.map(({ value, label, Icon }) => (
            <TabsTrigger key={value} value={value} className="text-xs gap-1.5 data-[state=active]:shadow-sm">
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
              {counts[value] > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 min-w-[16px] px-1 text-[10px]">
                  {counts[value]}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {tabConfig.map(({ value }) => (
          <TabsContent key={value} value={value} className="mt-3">
            {showForm && activeTab === value && (
              <AddRecordForm
                stageId={stageId}
                projectId={projectId}
                category={value}
                onClose={() => setShowForm(false)}
              />
            )}

            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full rounded-lg" />
                <Skeleton className="h-16 w-full rounded-lg" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                Nenhum registro nesta categoria.
              </p>
            ) : (
              <ul className="space-y-2">
                {filtered.map((r) => (
                  <RecordItem key={r.id} record={r} isAdmin={isAdmin} stageId={stageId} />
                ))}
              </ul>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

/* ─── Record item ─── */

function RecordItem({ record, isAdmin, stageId }: { record: StageRecord; isAdmin: boolean; stageId: string }) {
  const deleteRecord = useDeleteStageRecord();

  return (
    <li className="group flex items-start gap-3 rounded-lg border border-border/60 bg-card p-3 transition-colors hover:bg-muted/20">
      {/* Responsible indicator */}
      <div className={cn(
        'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
        record.responsible === 'client'
          ? 'bg-primary/10 text-primary'
          : 'bg-muted text-muted-foreground',
      )}>
        {record.responsible === 'client'
          ? <User className="h-3.5 w-3.5" />
          : <Building2 className="h-3.5 w-3.5" />}
      </div>

      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate">{record.title}</span>
          {record.evidence_url && (
            <a
              href={record.evidence_url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-primary hover:text-primary/80"
              aria-label="Ver evidência"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
        {record.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{record.description}</p>
        )}
        <div className="flex items-center gap-3 pt-0.5">
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {format(parseISO(record.record_date), "dd MMM yyyy", { locale: ptBR })}
          </span>
          <Badge variant="outline" className="text-[10px] h-4 px-1.5 capitalize">
            {record.responsible === 'client' ? 'Cliente' : 'Bwild'}
          </Badge>
        </div>
      </div>

      {isAdmin && (
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
          onClick={() => deleteRecord.mutate({ id: record.id, stageId })}
          disabled={deleteRecord.isPending}
          aria-label="Remover registro"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </li>
  );
}

/* ─── Add form ─── */

function AddRecordForm({
  stageId,
  projectId,
  category,
  onClose,
}: {
  stageId: string;
  projectId: string;
  category: RecordCategory;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const create = useCreateStageRecord();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [responsible, setResponsible] = useState<'client' | 'bwild'>('bwild');
  const [evidenceUrl, setEvidenceUrl] = useState('');

  const handleSubmit = () => {
    if (!title.trim() || !user) return;
    create.mutate(
      {
        stage_id: stageId,
        project_id: projectId,
        category,
        title: title.trim(),
        description: description.trim() || undefined,
        responsible,
        evidence_url: evidenceUrl.trim() || undefined,
        created_by: user.id,
      },
      { onSuccess: () => onClose() },
    );
  };

  const categoryLabels: Record<RecordCategory, string> = {
    decision: 'decisão',
    conversation: 'conversa',
    history: 'registro',
  };

  return (
    <div className="mb-3 space-y-3 rounded-lg border border-primary/20 bg-primary/[0.02] p-3">
      <p className="text-xs font-medium text-primary">
        Nova {categoryLabels[category]}
      </p>
      <Input
        placeholder="Título"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="h-9 text-sm"
        autoFocus
      />
      <Textarea
        placeholder="Descrição curta (opcional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        className="text-sm"
      />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] text-muted-foreground mb-1 block">Responsável</label>
          <Select value={responsible} onValueChange={(v) => setResponsible(v as 'client' | 'bwild')}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="client">Cliente</SelectItem>
              <SelectItem value="bwild">Bwild</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground mb-1 block">Link evidência</label>
          <Input
            placeholder="https://..."
            value={evidenceUrl}
            onChange={(e) => setEvidenceUrl(e.target.value)}
            className="h-9 text-sm"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onClose} className="h-8">
          Cancelar
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!title.trim() || create.isPending}
          className="h-8"
        >
          Salvar
        </Button>
      </div>
    </div>
  );
}
