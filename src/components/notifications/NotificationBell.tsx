import { useMemo, useState } from 'react';
import { Bell, CheckCheck, FileText, DollarSign, AlertCircle, Layers, ClipboardSignature, TrendingUp, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useNotifications } from '@/hooks/useNotifications';
import { useNavigate, useLocation } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { getUrgencyCategory, isBlockingNotification } from '@/constants/notificationUrgency';
import type { Notification } from '@/infra/repositories/notifications.repository';

const typeConfig: Record<string, { icon: typeof Bell; className: string }> = {
  payment_due: { icon: DollarSign, className: 'text-warning' },
  payment_overdue: { icon: DollarSign, className: 'text-destructive' },
  formalization_pending: { icon: ClipboardSignature, className: 'text-primary' },
  document_uploaded: { icon: FileText, className: 'text-success' },
  stage_changed: { icon: Layers, className: 'text-primary' },
  pending_item_created: { icon: AlertCircle, className: 'text-warning' },
  report_published: { icon: TrendingUp, className: 'text-success' },
  general: { icon: Info, className: 'text-muted-foreground' },
};

function formatNotificationTime(createdAt: string): string {
  const parsedDate = new Date(createdAt);
  if (Number.isNaN(parsedDate.getTime())) {
    return 'Agora há pouco';
  }
  return formatDistanceToNow(parsedDate, { addSuffix: true, locale: ptBR });
}

function NotificationItem({
  notification,
  onRead,
  onNavigate,
}: {
  notification: Notification;
  onRead: (id: string) => void;
  onNavigate: (url: string) => void;
}) {
  const config = typeConfig[notification.type] ?? typeConfig.general;
  const Icon = config.icon;
  const isUnread = !notification.read_at;
  const isBlocking = isBlockingNotification(notification.type);

  const handleClick = () => {
    if (isUnread) onRead(notification.id);
    if (notification.action_url) onNavigate(notification.action_url);
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'w-full text-left px-3 py-2.5 flex items-start gap-2.5 hover:bg-accent/50 transition-colors rounded-md',
        isUnread && 'bg-primary/5',
        isUnread && isBlocking && 'bg-destructive/5 border-l-2 border-destructive'
      )}
    >
      <div className={cn('mt-0.5 shrink-0', config.className)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm leading-tight', isUnread ? 'font-semibold text-foreground' : 'text-foreground/80')}>
          {notification.title}
        </p>
        {notification.body && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notification.body}</p>
        )}
        <p className="text-[10px] text-muted-foreground/70 mt-1">
          {formatNotificationTime(notification.created_at)}
        </p>
      </div>
      {isUnread && (
        <span
          className={cn(
            'w-2 h-2 rounded-full shrink-0 mt-1.5',
            isBlocking ? 'bg-destructive animate-pulse' : 'bg-primary'
          )}
        />
      )}
    </button>
  );
}

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>('all');

  const actionNotifications = notifications.filter(n => getUrgencyCategory(n.type) === 'action');
  const updateNotifications = notifications.filter(n => getUrgencyCategory(n.type) === 'update');

  const unreadActionCount = actionNotifications.filter(n => !n.read_at).length;

  const handleNavigate = (url: string) => {
    navigate(url);
  };

  const displayedNotifications =
    activeTab === 'actions'
      ? actionNotifications
      : activeTab === 'updates'
        ? updateNotifications
        : notifications;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-11 w-11 sm:h-9 sm:w-9 rounded-full hover:bg-primary/10 shrink-0"
          aria-label={`Notificações${unreadCount > 0 ? ` (${unreadCount} não lidas)` : ''}`}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className={cn(
                'absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 text-[10px] font-bold flex items-center justify-center',
                unreadActionCount > 0 && 'animate-pulse'
              )}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 sm:w-96 p-0" sideOffset={8}>
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Notificações</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="text-xs text-primary hover:text-primary/80 h-auto py-1 px-2"
            >
              <CheckCheck className="w-3.5 h-3.5 mr-1" />
              Marcar todas
            </Button>
          )}
        </div>

        {/* Urgency Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full rounded-none border-b border-border bg-transparent h-auto p-0">
            <TabsTrigger
              value="all"
              className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none min-h-[36px] text-xs"
            >
              Todas
              {unreadCount > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-4 min-w-[16px] px-1 text-[10px]">
                  {unreadCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="actions"
              className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-destructive data-[state=active]:bg-transparent data-[state=active]:shadow-none min-h-[36px] text-xs"
            >
              Ações
              {unreadActionCount > 0 && (
                <Badge variant="destructive" className="ml-1.5 h-4 min-w-[16px] px-1 text-[10px] animate-pulse">
                  {unreadActionCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="updates"
              className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none min-h-[36px] text-xs"
            >
              Atualizações
            </TabsTrigger>
          </TabsList>

          {['all', 'actions', 'updates'].map(tab => (
            <TabsContent key={tab} value={tab} className="mt-0">
              <ScrollArea className="max-h-[360px]">
                {displayedNotifications.length === 0 ? (
                  <div className="py-10 text-center">
                    <Bell className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {tab === 'actions'
                        ? 'Nenhuma ação pendente'
                        : tab === 'updates'
                          ? 'Nenhuma atualização'
                          : 'Nenhuma notificação'}
                    </p>
                    {tab === 'actions' && (
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        Tudo certo! Nenhuma decisão bloqueando sua obra.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="p-1 space-y-0.5">
                    {displayedNotifications.map((n) => (
                      <NotificationItem
                        key={n.id}
                        notification={n}
                        onRead={markAsRead}
                        onNavigate={handleNavigate}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
