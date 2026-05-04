import {
 FileText, Send, CheckCircle2, XCircle, Upload, FileCheck,
 CreditCard, AlertCircle, ClipboardList, FolderPlus, Settings,
 UserPlus, UserMinus, Edit, Clock, Activity,
} from'lucide-react';
import { EVENT_TYPES } from'@/hooks/useDomainEvents';

export interface EventConfig {
 icon: React.ElementType;
 color: string;
 bgColor: string;
 label: string;
}

const configs: Record<string, EventConfig> = {
 [EVENT_TYPES.FORMALIZATION_CREATED]: { icon: FileText, color:'text-blue-600', bgColor:'bg-blue-100', label:'Formalização criada' },
 [EVENT_TYPES.FORMALIZATION_UPDATED]: { icon: Edit, color:'text-amber-600', bgColor:'bg-amber-100', label:'Formalização editada' },
 [EVENT_TYPES.FORMALIZATION_SENT]: { icon: Send, color:'text-indigo-600', bgColor:'bg-indigo-100', label:'Enviada para assinatura' },
 [EVENT_TYPES.FORMALIZATION_SIGNED]: { icon: CheckCircle2, color:'text-green-600', bgColor:'bg-green-100', label:'Assinatura registrada' },
 [EVENT_TYPES.FORMALIZATION_VOIDED]: { icon: XCircle, color:'text-red-600', bgColor:'bg-red-100', label:'Formalização anulada' },
 [EVENT_TYPES.DOCUMENT_UPLOADED]: { icon: Upload, color:'text-cyan-600', bgColor:'bg-cyan-100', label:'Documento enviado' },
 [EVENT_TYPES.DOCUMENT_VERSION_UPLOADED]: { icon: Upload, color:'text-cyan-600', bgColor:'bg-cyan-100', label:'Nova versão de documento' },
 [EVENT_TYPES.DOCUMENT_APPROVED]: { icon: FileCheck, color:'text-green-600', bgColor:'bg-green-100', label:'Documento aprovado' },
 [EVENT_TYPES.PAYMENT_CREATED]: { icon: CreditCard, color:'text-purple-600', bgColor:'bg-purple-100', label:'Pagamento registrado' },
 [EVENT_TYPES.PAYMENT_RECEIVED]: { icon: CheckCircle2, color:'text-green-600', bgColor:'bg-green-100', label:'Pagamento recebido' },
 [EVENT_TYPES.PAYMENT_OVERDUE]: { icon: AlertCircle, color:'text-red-600', bgColor:'bg-red-100', label:'Pagamento em atraso' },
 [EVENT_TYPES.PENDING_ITEM_CREATED]: { icon: ClipboardList, color:'text-amber-600', bgColor:'bg-amber-100', label:'Pendência criada' },
 [EVENT_TYPES.PENDING_ITEM_RESOLVED]: { icon: CheckCircle2, color:'text-green-600', bgColor:'bg-green-100', label:'Pendência resolvida' },
 [EVENT_TYPES.PENDING_ITEM_CANCELLED]: { icon: XCircle, color:'text-muted-foreground', bgColor:'bg-muted', label:'Pendência cancelada' },
 [EVENT_TYPES.PROJECT_CREATED]: { icon: FolderPlus, color:'text-primary', bgColor:'bg-primary/10', label:'Projeto criado' },
 [EVENT_TYPES.PROJECT_UPDATED]: { icon: Settings, color:'text-muted-foreground', bgColor:'bg-muted', label:'Projeto atualizado' },
 [EVENT_TYPES.PROJECT_MEMBER_ADDED]: { icon: UserPlus, color:'text-blue-600', bgColor:'bg-blue-100', label:'Membro adicionado' },
 [EVENT_TYPES.PROJECT_MEMBER_REMOVED]: { icon: UserMinus, color:'text-red-600', bgColor:'bg-red-100', label:'Membro removido' },
 [EVENT_TYPES.WEEKLY_REPORT_PUBLISHED]: { icon: FileText, color:'text-green-600', bgColor:'bg-green-100', label:'Relatório publicado' },
 [EVENT_TYPES.WEEKLY_REPORT_VIEWED]: { icon: Activity, color:'text-muted-foreground', bgColor:'bg-muted', label:'Relatório visualizado' },
};

const defaultConfig: EventConfig = {
 icon: Clock,
 color:'text-muted-foreground',
 bgColor:'bg-muted',
 label:'',
};

export function getEventConfig(eventType: string): EventConfig {
 return configs[eventType] || {
 ...defaultConfig,
 label: eventType.replace(/[._]/g,'').replace(/\b\w/g, l => l.toUpperCase()),
 };
}

export const formatRelativeDate = (dateString: string) => {
 const date = new Date(dateString);
 const now = new Date();
 const diffMs = now.getTime() - date.getTime();
 const diffMins = Math.floor(diffMs / 60000);
 const diffHours = Math.floor(diffMs / 3600000);
 const diffDays = Math.floor(diffMs / 86400000);

 if (diffMins < 1) return'Agora';
 if (diffMins < 60) return`${diffMins}min atrás`;
 if (diffHours < 24) return`${diffHours}h atrás`;
 if (diffDays < 7) return`${diffDays}d atrás`;

 return date.toLocaleDateString('pt-BR', {
 day:'2-digit', month:'2-digit', year:'2-digit',
 hour:'2-digit', minute:'2-digit',
 });
};
