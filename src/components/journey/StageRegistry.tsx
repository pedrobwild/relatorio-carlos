import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  BookOpen, MessageSquare, Clock, Plus, ExternalLink,
  Trash2, User, Building2, AlertCircle, RefreshCw,
  Users, X,
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
import { useCompleteStage } from '@/hooks/useProjectJourney';

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
  /** When true, only shows conversation/minutes records with direct minutes form */
  minutesOnly?: boolean;
  /** Stage name — used to detect briefing stage for auto-completion */
  stageName?: string;
}

/* ─── Main ─── */

export function StageRegistry({ stageId, projectId, isAdmin, minutesOnly = false, stageName }: StageRegistryProps) {
  const { data: records, isLoading, isError, refetch } = useStageRecords(stageId, projectId);
  const [activeTab, setActiveTab] = useState<RecordCategory>(minutesOnly ? 'conversation' : 'decision');
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
    <section className="space-y-3" aria-label="Registro da etapa">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" aria-hidden />
          Registro da etapa
        </h3>
        {isAdmin && !showForm && (
          <Button
            size="sm"
            variant="outline"
            className="h-9 gap-1.5 text-xs min-h-[44px]"
            onClick={() => setShowForm(true)}
            aria-label="Adicionar novo registro"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Novo registro
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as RecordCategory)}>
        {!minutesOnly && (
          <TabsList className="w-full grid grid-cols-3 h-10">
            {tabConfig.map(({ value, label, Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="text-xs gap-1.5 data-[state=active]:shadow-sm min-h-[40px]"
                aria-label={`${label}${counts[value] > 0 ? ` (${counts[value]})` : ''}`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                <span className="hidden sm:inline">{label}</span>
                {counts[value] > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 min-w-[16px] px-1 text-[10px]">
                    {counts[value]}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        )}

        {(minutesOnly ? tabConfig.filter(t => t.value === 'conversation') : tabConfig).map(({ value }) => (
          <TabsContent key={value} value={value} className={minutesOnly ? "mt-0" : "mt-3"}>
            {showForm && activeTab === value && (
              <AddRecordForm
                stageId={stageId}
                projectId={projectId}
                category={value}
                onClose={() => setShowForm(false)}
                minutesOnly={minutesOnly}
                stageName={stageName}
              />
            )}

            {isLoading ? (
              <div className="space-y-2" aria-busy="true" aria-label="Carregando registros">
                <Skeleton className="h-16 w-full rounded-lg" />
                <Skeleton className="h-16 w-full rounded-lg" />
              </div>
            ) : isError ? (
              <div className="flex flex-col items-center gap-3 py-6" role="alert">
                <AlertCircle className="h-8 w-8 text-destructive/60" aria-hidden />
                <p className="text-sm text-muted-foreground">Erro ao carregar registros.</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 gap-1.5 min-h-[44px]"
                  onClick={() => refetch()}
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  Tentar novamente
                </Button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6" role="status">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  {value === 'decision' && <BookOpen className="h-5 w-5 text-muted-foreground" aria-hidden />}
                  {value === 'conversation' && <MessageSquare className="h-5 w-5 text-muted-foreground" aria-hidden />}
                  {value === 'history' && <Clock className="h-5 w-5 text-muted-foreground" aria-hidden />}
                </div>
                <p className="text-sm font-medium text-foreground">
                  {value === 'decision' && 'Nenhuma decisão registrada'}
                  {value === 'conversation' && 'Nenhuma conversa registrada'}
                  {value === 'history' && 'Nenhum registro ainda'}
                </p>
                <p className="text-xs text-muted-foreground max-w-[240px] text-center">
                  {isAdmin
                    ? 'Clique em "Novo registro" para adicionar.'
                    : 'Os registros aparecerão aqui conforme o projeto avança.'}
                </p>
              </div>
            ) : (
              <ul className="space-y-2" role="list" aria-label={`Lista de ${value === 'decision' ? 'decisões' : value === 'conversation' ? 'conversas' : 'registros'}`}>
                {filtered.map((r) => (
                  <RecordItem key={r.id} record={r} isAdmin={isAdmin} stageId={stageId} />
                ))}
              </ul>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}

/* ─── Record item ─── */

function RecordItem({ record, isAdmin, stageId }: { record: StageRecord; isAdmin: boolean; stageId: string }) {
  const deleteRecord = useDeleteStageRecord();
  const [expanded, setExpanded] = useState(false);
  const hasLongContent = !!record.description && record.description.length > 120;

  return (
    <li
      className={cn(
        'group flex items-start gap-3 rounded-lg border border-border/60 bg-card p-3 transition-colors hover:bg-muted/20 focus-within:ring-2 focus-within:ring-primary/30 focus-within:ring-offset-1',
        hasLongContent && 'cursor-pointer',
      )}
      onClick={() => hasLongContent && setExpanded(prev => !prev)}
      role={hasLongContent ? 'button' : undefined}
      tabIndex={hasLongContent ? 0 : undefined}
      onKeyDown={hasLongContent ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(prev => !prev); } } : undefined}
      aria-expanded={hasLongContent ? expanded : undefined}
    >
      {/* Responsible indicator */}
      <div
        className={cn(
          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
          record.responsible === 'client'
            ? 'bg-primary/10 text-primary'
            : 'bg-muted text-muted-foreground',
        )}
        aria-hidden
      >
        {record.responsible === 'client'
          ? <User className="h-3.5 w-3.5" />
          : <Building2 className="h-3.5 w-3.5" />}
      </div>

      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate">{record.title}</span>
        </div>
        {record.description && (
          <p className={cn(
            'text-xs text-muted-foreground whitespace-pre-wrap',
            !expanded && 'line-clamp-2',
          )}>
            {record.description}
          </p>
        )}
        {hasLongContent && !expanded && (
          <span className="text-xs text-primary font-medium">Ver mais</span>
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
          className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 md:transition-opacity text-muted-foreground hover:text-destructive min-h-[44px] min-w-[44px]"
          onClick={(e) => { e.stopPropagation(); deleteRecord.mutate({ id: record.id, stageId }); }}
          disabled={deleteRecord.isPending}
          aria-label={`Remover registro: ${record.title}`}
        >
          {deleteRecord.isPending ? (
            <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
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
  minutesOnly,
  stageName,
}: {
  stageId: string;
  projectId: string;
  category: RecordCategory;
  onClose: () => void;
  minutesOnly?: boolean;
  stageName?: string;
}) {
  const { user } = useAuth();
  const create = useCreateStageRecord();
  const completeStage = useCompleteStage();
  const isBriefingStage = stageName?.toLowerCase().includes('briefing') ?? false;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [responsible, setResponsible] = useState<'client' | 'bwild'>('bwild');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [isMinutesMode, setIsMinutesMode] = useState(minutesOnly ?? false);

  // Meeting minutes state
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [participants, setParticipants] = useState<{ name: string; role: string }[]>([{ name: '', role: '' }]);
  const [mainTopics, setMainTopics] = useState('');

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

  const handleMinutesSubmit = () => {
    if (!meetingDate || !mainTopics.trim() || !user) return;

    const dateFormatted = format(parseISO(meetingDate), "dd MMM yyyy", { locale: ptBR });
    const participantsList = participants
      .filter(p => p.name.trim())
      .map(p => `${p.name.trim()}${p.role.trim() ? ` (${p.role.trim()})` : ''}`)
      .join(', ');

    const generatedTitle = `Ata de Reunião — ${dateFormatted}${meetingTime ? ` às ${meetingTime}` : ''}`;
    const generatedDescription = [
      participantsList ? `Participantes: ${participantsList}` : '',
      mainTopics.trim(),
    ].filter(Boolean).join('\n\n');

    create.mutate(
      {
        stage_id: stageId,
        project_id: projectId,
        category: 'conversation',
        title: generatedTitle,
        description: generatedDescription,
        responsible: 'bwild',
        evidence_url: evidenceUrl.trim() || undefined,
        created_by: user.id,
        record_date: meetingDate,
      },
      {
        onSuccess: () => {
          if (isBriefingStage) {
            completeStage.mutate({ stageId, projectId });
            toast.success('Ata salva! Etapa de Briefing concluída.');
          }
          onClose();
        },
      },
    );
  };

  const addParticipant = () => setParticipants(prev => [...prev, { name: '', role: '' }]);
  const removeParticipant = (i: number) => setParticipants(prev => prev.filter((_, idx) => idx !== i));
  const updateParticipant = (i: number, field: 'name' | 'role', value: string) =>
    setParticipants(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p));

  const categoryLabels: Record<RecordCategory, string> = {
    decision: 'decisão',
    conversation: 'conversa',
    history: 'registro',
  };

  // Show minutes mode toggle for conversation category
  if (category === 'conversation' && !isMinutesMode && !minutesOnly) {
    return (
      <div className="mb-3 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setIsMinutesMode(true)}
            className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/[0.02] p-4 text-left transition-colors hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary min-h-[44px]"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Ata de reunião</p>
              <p className="text-xs text-muted-foreground">Registre participantes e tópicos</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => { /* keep isMinutesMode false, show simple form */ setTitle(''); setDescription(''); }}
            className="flex items-center gap-3 rounded-lg border border-border/60 bg-card p-4 text-left transition-colors hover:bg-muted/20 focus-visible:outline-2 focus-visible:outline-primary min-h-[44px]"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Registro simples</p>
              <p className="text-xs text-muted-foreground">Título e descrição livre</p>
            </div>
          </button>
        </div>
        <div className="flex justify-end">
          <Button size="sm" variant="ghost" onClick={onClose} className="h-9 min-h-[44px]">
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  // Meeting minutes form
  if (isMinutesMode) {
    return (
      <div className="mb-3 space-y-3 rounded-lg border border-primary/20 bg-primary/[0.02] p-3" role="form" aria-label="Nova ata de reunião">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-primary flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" aria-hidden />
            Ata de reunião
          </p>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setIsMinutesMode(false)} aria-label="Voltar">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={`min-date-${stageId}`} className="text-[11px] text-muted-foreground mb-1 block">Data da reunião</label>
            <Input id={`min-date-${stageId}`} type="date" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} className="h-10 text-sm" autoFocus />
          </div>
          <div>
            <label htmlFor={`min-time-${stageId}`} className="text-[11px] text-muted-foreground mb-1 block">Horário (opcional)</label>
            <Input id={`min-time-${stageId}`} type="time" value={meetingTime} onChange={e => setMeetingTime(e.target.value)} className="h-10 text-sm" />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-muted-foreground">Participantes</span>
            <Button type="button" size="sm" variant="ghost" className="h-6 text-[11px] px-2 gap-1" onClick={addParticipant}>
              <Plus className="h-3 w-3" /> Adicionar
            </Button>
          </div>
          <div className="space-y-2">
            {participants.map((p, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input placeholder="Nome" value={p.name} onChange={e => updateParticipant(i, 'name', e.target.value)} className="h-9 text-sm flex-1" />
                <Input placeholder="Cargo (opcional)" value={p.role} onChange={e => updateParticipant(i, 'role', e.target.value)} className="h-9 text-sm flex-1" />
                {participants.length > 1 && (
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeParticipant(i)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor={`min-topics-${stageId}`} className="text-[11px] text-muted-foreground mb-1 block">Tópicos discutidos</label>
          <Textarea id={`min-topics-${stageId}`} placeholder="Descreva os principais pontos abordados na reunião..." value={mainTopics} onChange={e => setMainTopics(e.target.value)} rows={4} className="text-sm" />
        </div>

        <div>
          <label htmlFor={`min-evidence-${stageId}`} className="text-[11px] text-muted-foreground mb-1 block">Link da gravação (opcional)</label>
          <Input id={`min-evidence-${stageId}`} placeholder="https://..." value={evidenceUrl} onChange={e => setEvidenceUrl(e.target.value)} className="h-10 text-sm" />
        </div>

        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onClose} className="h-9 min-h-[44px]">Cancelar</Button>
          <Button size="sm" onClick={handleMinutesSubmit} disabled={!meetingDate || !mainTopics.trim() || create.isPending} className="h-9 min-h-[44px]">
            {create.isPending && <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5" />}
            Salvar ata
          </Button>
        </div>
      </div>
    );
  }

  // Simple record form (default for decision/history, or when user picks "simple" for conversation)
  return (
    <div className="mb-3 space-y-3 rounded-lg border border-primary/20 bg-primary/[0.02] p-3" role="form" aria-label={`Nova ${categoryLabels[category]}`}>
      <p className="text-xs font-medium text-primary">
        Nova {categoryLabels[category]}
      </p>
      <div>
        <label htmlFor={`rec-title-${stageId}`} className="sr-only">Título</label>
        <Input
          id={`rec-title-${stageId}`}
          placeholder="Título"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-10 text-sm"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        />
      </div>
      <div>
        <label htmlFor={`rec-desc-${stageId}`} className="sr-only">Descrição</label>
        <Textarea
          id={`rec-desc-${stageId}`}
          placeholder="Descrição curta (opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="text-sm"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor={`rec-resp-${stageId}`} className="text-[11px] text-muted-foreground mb-1 block">Responsável</label>
          <Select value={responsible} onValueChange={(v) => setResponsible(v as 'client' | 'bwild')}>
            <SelectTrigger className="h-10 text-sm" id={`rec-resp-${stageId}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="client">Cliente</SelectItem>
              <SelectItem value="bwild">Bwild</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label htmlFor={`rec-evidence-${stageId}`} className="text-[11px] text-muted-foreground mb-1 block">Link evidência</label>
          <Input
            id={`rec-evidence-${stageId}`}
            placeholder="https://..."
            value={evidenceUrl}
            onChange={(e) => setEvidenceUrl(e.target.value)}
            className="h-10 text-sm"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onClose} className="h-9 min-h-[44px]">
          Cancelar
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!title.trim() || create.isPending}
          className="h-9 min-h-[44px]"
        >
          {create.isPending ? (
            <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5" />
          ) : null}
          Salvar
        </Button>
      </div>
    </div>
  );
}
