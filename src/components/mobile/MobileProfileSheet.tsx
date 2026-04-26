import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Building2,
  ChevronRight,
  HeadphonesIcon,
  LogOut,
  Settings as SettingsIcon,
  User as UserIcon,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useNotifications } from '@/hooks/useNotifications';
import { getWhatsappSupportUrl } from '@/config/contact';
import { cn } from '@/lib/utils';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  manager: 'Gestor',
  engineer: 'Engenheiro',
  arquitetura: 'Arquitetura',
  gestor: 'Supervisor',
  suprimentos: 'Suprimentos',
  financeiro: 'Financeiro',
  cs: 'Customer Success',
  customer: 'Cliente',
};

interface MobileProfileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenNotifications?: () => void;
}

export function MobileProfileSheet({
  open,
  onOpenChange,
  onOpenNotifications,
}: MobileProfileSheetProps) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { roles, isAdmin, isStaff, isCustomer } = useUserRole();
  const { unreadCount } = useNotifications();
  const [confirmLogout, setConfirmLogout] = useState(false);

  const primaryRoleLabel = roles.length > 0 ? ROLE_LABELS[roles[0]] || roles[0] : null;
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuário';

  const handleNavigate = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } finally {
      onOpenChange(false);
      navigate('/auth', { replace: true });
    }
  };

  const handleNotifications = () => {
    onOpenChange(false);
    onOpenNotifications?.();
  };

  const handleSupport = () => {
    window.open(getWhatsappSupportUrl(), '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-safe max-h-[85dvh] overflow-y-auto">
          <SheetHeader className="text-left">
            <SheetTitle className="sr-only">Perfil</SheetTitle>
            <SheetDescription className="sr-only">
              Acesse suas informações, suporte e configurações.
            </SheetDescription>
          </SheetHeader>

          <div className="flex items-center gap-3 pb-4 pt-1 border-b border-border/60">
            <div className="flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 text-primary shrink-0">
              <UserIcon className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold truncate">{displayName}</p>
                {primaryRoleLabel && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 shrink-0 font-medium">
                    {primaryRoleLabel}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>

          <nav className="py-2 space-y-1">
            {isCustomer && (
              <ProfileItem
                icon={Building2}
                label="Minhas obras"
                onClick={() => handleNavigate('/minhas-obras')}
              />
            )}

            {onOpenNotifications && (
              <ProfileItem
                icon={Bell}
                label="Notificações"
                badge={unreadCount > 0 ? (unreadCount > 99 ? '99+' : String(unreadCount)) : undefined}
                onClick={handleNotifications}
              />
            )}

            <ProfileItem
              icon={HeadphonesIcon}
              label="Suporte BWild"
              hint="WhatsApp"
              onClick={handleSupport}
            />

            {(isStaff || isAdmin) && (
              <ProfileItem
                icon={SettingsIcon}
                label="Configurações"
                onClick={() => handleNavigate('/admin')}
              />
            )}

            <div className="pt-2 mt-2 border-t border-border/60">
              <ProfileItem
                icon={LogOut}
                label="Sair"
                destructive
                onClick={() => setConfirmLogout(true)}
              />
            </div>
          </nav>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmLogout} onOpenChange={setConfirmLogout}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair da sua conta?</AlertDialogTitle>
            <AlertDialogDescription>
              Suas pendências continuam aqui quando você voltar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSignOut}>Sair</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface ProfileItemProps {
  icon: typeof UserIcon;
  label: string;
  hint?: string;
  badge?: string;
  destructive?: boolean;
  onClick: () => void;
}

function ProfileItem({ icon: Icon, label, hint, badge, destructive, onClick }: ProfileItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 w-full px-2 py-3 min-h-[48px] rounded-xl text-left transition-colors',
        'hover:bg-muted/60 active:scale-[0.99]',
        destructive ? 'text-destructive' : 'text-foreground'
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center h-10 w-10 rounded-xl shrink-0',
          destructive ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium block truncate">{label}</span>
        {hint && <span className="text-[11px] text-muted-foreground block truncate">{hint}</span>}
      </div>
      {badge && (
        <span
          className="min-w-[20px] h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center shrink-0"
          aria-label={`${badge} notificações não lidas`}
        >
          {badge}
        </span>
      )}
      {!destructive && !badge && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
    </button>
  );
}
