import { 
  FileText, 
  Send, 
  CheckCircle2, 
  XCircle, 
  Upload, 
  FileCheck, 
  CreditCard, 
  AlertCircle, 
  ClipboardList, 
  FolderPlus, 
  Settings, 
  UserPlus, 
  UserMinus,
  Edit,
  Clock,
  Activity
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useProjectEvents, type DomainEvent, EVENT_TYPES } from '@/hooks/useDomainEvents';

interface ActivityTimelineProps {
  projectId?: string;
  orgId?: string;
  maxItems?: number;
  showHeader?: boolean;
  className?: string;
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Agora';
  if (diffMins < 60) return `${diffMins}min atrás`;
  if (diffHours < 24) return `${diffHours}h atrás`;
  if (diffDays < 7) return `${diffDays}d atrás`;
  
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getEventConfig = (eventType: string): { 
  icon: React.ElementType; 
  color: string; 
  bgColor: string;
  label: string;
} => {
  const configs: Record<string, { icon: React.ElementType; color: string; bgColor: string; label: string }> = {
    // Formalizations
    [EVENT_TYPES.FORMALIZATION_CREATED]: { 
      icon: FileText, 
      color: 'text-blue-600', 
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
      label: 'Formalização criada'
    },
    [EVENT_TYPES.FORMALIZATION_UPDATED]: { 
      icon: Edit, 
      color: 'text-amber-600', 
      bgColor: 'bg-amber-100 dark:bg-amber-900/30',
      label: 'Formalização editada'
    },
    [EVENT_TYPES.FORMALIZATION_SENT]: { 
      icon: Send, 
      color: 'text-indigo-600', 
      bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
      label: 'Enviada para assinatura'
    },
    [EVENT_TYPES.FORMALIZATION_SIGNED]: { 
      icon: CheckCircle2, 
      color: 'text-green-600', 
      bgColor: 'bg-green-100 dark:bg-green-900/30',
      label: 'Assinatura registrada'
    },
    [EVENT_TYPES.FORMALIZATION_VOIDED]: { 
      icon: XCircle, 
      color: 'text-red-600', 
      bgColor: 'bg-red-100 dark:bg-red-900/30',
      label: 'Formalização anulada'
    },
    // Documents
    [EVENT_TYPES.DOCUMENT_UPLOADED]: { 
      icon: Upload, 
      color: 'text-cyan-600', 
      bgColor: 'bg-cyan-100 dark:bg-cyan-900/30',
      label: 'Documento enviado'
    },
    [EVENT_TYPES.DOCUMENT_VERSION_UPLOADED]: { 
      icon: Upload, 
      color: 'text-cyan-600', 
      bgColor: 'bg-cyan-100 dark:bg-cyan-900/30',
      label: 'Nova versão de documento'
    },
    [EVENT_TYPES.DOCUMENT_APPROVED]: { 
      icon: FileCheck, 
      color: 'text-green-600', 
      bgColor: 'bg-green-100 dark:bg-green-900/30',
      label: 'Documento aprovado'
    },
    // Payments
    [EVENT_TYPES.PAYMENT_CREATED]: { 
      icon: CreditCard, 
      color: 'text-purple-600', 
      bgColor: 'bg-purple-100 dark:bg-purple-900/30',
      label: 'Pagamento registrado'
    },
    [EVENT_TYPES.PAYMENT_RECEIVED]: { 
      icon: CheckCircle2, 
      color: 'text-green-600', 
      bgColor: 'bg-green-100 dark:bg-green-900/30',
      label: 'Pagamento recebido'
    },
    [EVENT_TYPES.PAYMENT_OVERDUE]: { 
      icon: AlertCircle, 
      color: 'text-red-600', 
      bgColor: 'bg-red-100 dark:bg-red-900/30',
      label: 'Pagamento em atraso'
    },
    // Pending Items
    [EVENT_TYPES.PENDING_ITEM_CREATED]: { 
      icon: ClipboardList, 
      color: 'text-amber-600', 
      bgColor: 'bg-amber-100 dark:bg-amber-900/30',
      label: 'Pendência criada'
    },
    [EVENT_TYPES.PENDING_ITEM_RESOLVED]: { 
      icon: CheckCircle2, 
      color: 'text-green-600', 
      bgColor: 'bg-green-100 dark:bg-green-900/30',
      label: 'Pendência resolvida'
    },
    [EVENT_TYPES.PENDING_ITEM_CANCELLED]: { 
      icon: XCircle, 
      color: 'text-muted-foreground', 
      bgColor: 'bg-muted',
      label: 'Pendência cancelada'
    },
    // Project
    [EVENT_TYPES.PROJECT_CREATED]: { 
      icon: FolderPlus, 
      color: 'text-primary', 
      bgColor: 'bg-primary/10',
      label: 'Projeto criado'
    },
    [EVENT_TYPES.PROJECT_UPDATED]: { 
      icon: Settings, 
      color: 'text-muted-foreground', 
      bgColor: 'bg-muted',
      label: 'Projeto atualizado'
    },
    [EVENT_TYPES.PROJECT_MEMBER_ADDED]: { 
      icon: UserPlus, 
      color: 'text-blue-600', 
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
      label: 'Membro adicionado'
    },
    [EVENT_TYPES.PROJECT_MEMBER_REMOVED]: { 
      icon: UserMinus, 
      color: 'text-red-600', 
      bgColor: 'bg-red-100 dark:bg-red-900/30',
      label: 'Membro removido'
    },
    // Weekly Reports
    [EVENT_TYPES.WEEKLY_REPORT_PUBLISHED]: { 
      icon: FileText, 
      color: 'text-green-600', 
      bgColor: 'bg-green-100 dark:bg-green-900/30',
      label: 'Relatório publicado'
    },
    [EVENT_TYPES.WEEKLY_REPORT_VIEWED]: { 
      icon: Activity, 
      color: 'text-muted-foreground', 
      bgColor: 'bg-muted',
      label: 'Relatório visualizado'
    },
  };

  return configs[eventType] || { 
    icon: Clock, 
    color: 'text-muted-foreground', 
    bgColor: 'bg-muted',
    label: eventType.replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  };
};

const getEventDescription = (event: DomainEvent): string => {
  const payload = event.payload as Record<string, unknown>;
  
  switch (event.event_type) {
    case EVENT_TYPES.FORMALIZATION_CREATED:
      return payload.title ? `"${payload.title}"` : 'Nova formalização';
    case EVENT_TYPES.FORMALIZATION_UPDATED: {
      const fields = payload.fields_updated as string[] | undefined;
      return fields?.length ? `Campos: ${fields.join(', ')}` : 'Conteúdo atualizado';
    }
    case EVENT_TYPES.FORMALIZATION_SENT:
      return payload.title ? `"${payload.title}"` : 'Enviada para coleta de assinaturas';
    case EVENT_TYPES.FORMALIZATION_SIGNED:
      return payload.party_name ? `por ${payload.party_name}` : 'Assinatura registrada';
    case EVENT_TYPES.PAYMENT_RECEIVED:
      return payload.amount ? `R$ ${Number(payload.amount).toLocaleString('pt-BR')}` : '';
    case EVENT_TYPES.DOCUMENT_UPLOADED:
    case EVENT_TYPES.DOCUMENT_VERSION_UPLOADED:
      return payload.filename ? `"${payload.filename}"` : '';
    case EVENT_TYPES.PROJECT_MEMBER_ADDED:
    case EVENT_TYPES.PROJECT_MEMBER_REMOVED:
      return payload.member_name ? `${payload.member_name}` : '';
    default:
      return payload.title ? String(payload.title) : '';
  }
};

function TimelineItem({ event, isLast }: { event: DomainEvent; isLast: boolean }) {
  const config = getEventConfig(event.event_type);
  const Icon = config.icon;
  const description = getEventDescription(event);

  return (
    <div className="relative pl-8 pb-6 last:pb-0">
      {/* Timeline line */}
      {!isLast && (
        <div className="absolute left-[13px] top-8 bottom-0 w-px bg-border" />
      )}
      
      {/* Icon */}
      <div className={`absolute left-0 top-0.5 w-7 h-7 rounded-full ${config.bgColor} flex items-center justify-center`}>
        <Icon className={`h-3.5 w-3.5 ${config.color}`} />
      </div>
      
      {/* Content */}
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-tight">{config.label}</p>
            {description && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {description}
              </p>
            )}
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
            {formatDate(event.created_at)}
          </span>
        </div>
        
        {/* Entity badge */}
        <Badge variant="outline" className="text-[10px] h-5 px-1.5 capitalize">
          {event.entity_type.replace(/_/g, ' ')}
        </Badge>
      </div>
    </div>
  );
}

function TimelineLoading() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-start gap-3">
          <Skeleton className="h-7 w-7 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ActivityTimeline({ 
  projectId,
  orgId,
  maxItems = 20,
  showHeader = true,
  className = ''
}: ActivityTimelineProps) {
  const { events, isLoading, error } = useProjectEvents(projectId);
  
  const displayEvents = events.slice(0, maxItems);

  if (showHeader) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Atividade Recente
            {displayEvents.length > 0 && (
              <Badge variant="secondary" className="ml-auto text-xs">
                {displayEvents.length} {displayEvents.length === 1 ? 'evento' : 'eventos'}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TimelineContent 
            events={displayEvents} 
            isLoading={isLoading} 
            error={error}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={className}>
      <TimelineContent 
        events={displayEvents} 
        isLoading={isLoading} 
        error={error}
      />
    </div>
  );
}

function TimelineContent({ 
  events, 
  isLoading, 
  error 
}: { 
  events: DomainEvent[]; 
  isLoading: boolean; 
  error: Error | null;
}) {
  if (isLoading) {
    return <TimelineLoading />;
  }

  if (error) {
    return (
      <div className="text-center py-6">
        <AlertCircle className="h-8 w-8 text-destructive/50 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          Erro ao carregar atividades.
        </p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
          <Activity className="h-6 w-6 text-muted-foreground/50" />
        </div>
        <p className="text-sm text-muted-foreground">
          Nenhuma atividade registrada.
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          As ações do projeto aparecerão aqui.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="max-h-[400px] pr-4">
      <div className="space-y-0">
        {events.map((event, index) => (
          <TimelineItem 
            key={event.id} 
            event={event} 
            isLast={index === events.length - 1}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

// Compact version for sidebars
export function ActivityTimelineCompact({ 
  projectId,
  maxItems = 5 
}: { 
  projectId?: string;
  maxItems?: number;
}) {
  const { events, isLoading } = useProjectEvents(projectId);
  const displayEvents = events.slice(0, maxItems);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (displayEvents.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-4">
        Sem atividade recente
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {displayEvents.map((event) => {
        const config = getEventConfig(event.event_type);
        const Icon = config.icon;
        return (
          <div key={event.id} className="flex items-center gap-2 text-xs">
            <div className={`w-5 h-5 rounded-full ${config.bgColor} flex items-center justify-center shrink-0`}>
              <Icon className={`h-2.5 w-2.5 ${config.color}`} />
            </div>
            <span className="truncate flex-1">{config.label}</span>
            <span className="text-muted-foreground shrink-0">
              {formatDate(event.created_at)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
