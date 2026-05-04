import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Building2,
  ExternalLink,
  LifeBuoy,
  LogOut,
  Settings,
  User,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole, type AppRole } from "@/hooks/useUserRole";
import { useNotifications } from "@/hooks/useNotifications";
import { MobileNotificationsSheet } from "@/components/mobile/MobileNotificationsSheet";
import { buildSupportWhatsappUrl } from "@/config/contact";
import { cn } from "@/lib/utils";

const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  manager: "Gestor",
  engineer: "Engenheiro",
  arquitetura: "Arquitetura",
  gestor: "Supervisor",
  suprimentos: "Suprimentos",
  financeiro: "Financeiro",
  cs: "Customer Success",
  customer: "Cliente",
};

interface MobileProfileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileProfileSheet({ open, onOpenChange }: MobileProfileSheetProps) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { roles, isStaff, isAdmin } = useUserRole();
  const { unreadCount } = useNotifications();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const primaryRoleLabel = roles.length > 0 ? ROLE_LABELS[roles[0]] ?? roles[0] : null;
  const displayName = user?.email?.split("@")[0] ?? "Usuário";

  const close = () => onOpenChange(false);

  const handleSignOut = async () => {
    setConfirmSignOut(false);
    onOpenChange(false);
    try {
      await signOut();
    } finally {
      navigate("/auth", { replace: true });
    }
  };

  const items: Array<{
    id: string;
    label: string;
    icon: typeof User;
    onClick: () => void;
    rightSlot?: React.ReactNode;
    visible: boolean;
  }> = [
    {
      id: "minhas-obras",
      label: isStaff ? "Painel de obras" : "Minhas obras",
      icon: Building2,
      onClick: () => {
        close();
        navigate(isStaff ? "/gestao/painel-obras" : "/minhas-obras");
      },
      visible: true,
    },
    {
      id: "notificacoes",
      label: "Notificações",
      icon: Bell,
      onClick: () => setNotificationsOpen(true),
      rightSlot:
        unreadCount > 0 ? (
          <Badge
            variant="destructive"
            className="min-w-[20px] h-5 px-1.5 text-[10px] font-bold tabular-nums"
            aria-label={`${unreadCount} não lidas`}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        ) : null,
      visible: true,
    },
    {
      id: "suporte",
      label: "Suporte BWild",
      icon: LifeBuoy,
      onClick: () => {
        close();
        window.open(buildSupportWhatsappUrl(), "_blank", "noopener,noreferrer");
      },
      rightSlot: <ExternalLink className="h-4 w-4 text-muted-foreground" aria-hidden="true" />,
      visible: true,
    },
    {
      id: "configuracoes",
      label: "Configurações",
      icon: Settings,
      onClick: () => {
        close();
        navigate("/admin");
      },
      visible: isAdmin,
    },
  ];

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl pb-safe max-h-[88dvh] flex flex-col p-0"
        >
          <SheetHeader className="px-5 pt-4 pb-3 shrink-0 text-left">
            <SheetTitle className="text-base font-bold">Perfil</SheetTitle>
          </SheetHeader>

          {/* Identity card */}
          <div className="px-5 pb-4 shrink-0">
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-muted/40 border border-border-subtle">
              <span className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary shrink-0">
                <User className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
                {user?.email && (
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                )}
              </div>
              {primaryRoleLabel && (
                <Badge variant="secondary" className="text-[10px] px-2 py-0 h-5 font-medium shrink-0">
                  {primaryRoleLabel}
                </Badge>
              )}
            </div>
          </div>

          {/* Items list */}
          <nav className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
            {items
              .filter((item) => item.visible)
              .map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.onClick}
                  className={cn(
                    "flex items-center gap-3 w-full px-3 py-3 rounded-xl text-left",
                    "min-h-[52px] transition-all active:scale-[0.99]",
                    "hover:bg-muted/60 active:bg-muted",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                  )}
                >
                  <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-card border border-border-subtle text-foreground-muted shrink-0">
                    <item.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="flex-1 min-w-0 text-sm font-medium text-foreground">
                    {item.label}
                  </span>
                  {item.rightSlot}
                </button>
              ))}

            <button
              type="button"
              onClick={() => setConfirmSignOut(true)}
              className={cn(
                "flex items-center gap-3 w-full px-3 py-3 rounded-xl text-left mt-2",
                "min-h-[52px] transition-all active:scale-[0.99]",
                "hover:bg-destructive/5 active:bg-destructive/10",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destructive",
              )}
            >
              <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-destructive/10 text-destructive shrink-0">
                <LogOut className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="flex-1 min-w-0 text-sm font-semibold text-destructive">Sair</span>
            </button>
          </nav>
        </SheetContent>
      </Sheet>

      <MobileNotificationsSheet
        open={notificationsOpen}
        onOpenChange={setNotificationsOpen}
      />

      <AlertDialog open={confirmSignOut} onOpenChange={setConfirmSignOut}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair da sua conta?</AlertDialogTitle>
            <AlertDialogDescription>
              Suas pendências continuam aqui. Você pode entrar de novo a qualquer momento.
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
