import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Plus, CalendarDays, FolderOpen, Settings, MoreHorizontal, Truck, CheckSquare, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";

/**
 * GestaoBottomNav — polished mobile-first bottom nav for /gestao routes.
 * Monday.com-inspired: colored active pill, elevated FAB, rich secondary drawer.
 */
export function GestaoBottomNav() {
  const location = useLocation();
  const { isAdmin } = useUserRole();
  const [moreOpen, setMoreOpen] = useState(false);

  const secondaryItems = [
    { label: "Fornecedores", icon: Truck, to: "/gestao/fornecedores", description: "Gerencie seus fornecedores" },
    { label: "Calendário de Obras", icon: CalendarDays, to: "/gestao/calendario-obras", description: "Atividades da semana em todas as obras" },
    { label: "Calendário de Compras", icon: CalendarDays, to: "/gestao/calendario-compras", description: "Acompanhe compras programadas" },
    { label: "Arquivos", icon: FolderOpen, to: "/gestao/arquivos", description: "Documentos e anexos" },
    ...(isAdmin
      ? [{ label: "Configurações", icon: Settings, to: "/admin", description: "Configurações do sistema" }]
      : []),
  ];

  const isSecondaryActive = secondaryItems.some((i) =>
    location.pathname.startsWith(i.to)
  );

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-shell md:hidden hide-on-keyboard"
      aria-label="Navegação gestão"
    >
      {/* Frosted glass bar */}
      <div className="border-t border-border-subtle bg-card/90 backdrop-blur-xl backdrop-saturate-150 pb-safe pl-safe pr-safe">
        <div className="flex items-end justify-around h-16 relative px-2">
          {/* Painel */}
          <NavLink
            to="/gestao"
            end
            className="relative flex flex-col items-center justify-center gap-1 flex-1 min-w-0 py-2 transition-all active:scale-[0.92]"
          >
            {({ isActive }) => (
              <>
                <div className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground"
                )}>
                  <LayoutDashboard className="h-5 w-5" />
                </div>
                <span className={cn(
                  "text-[10px] font-semibold leading-none transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}>
                  Painel
                </span>
                {isActive && (
                  <div className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />
                )}
              </>
            )}
          </NavLink>

          {/* Atividades */}
          <NavLink
            to="/gestao/atividades"
            className="relative flex flex-col items-center justify-center gap-1 flex-1 min-w-0 py-2 transition-all active:scale-[0.92]"
          >
            {({ isActive }) => (
              <>
                <div className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground"
                )}>
                  <CheckSquare className="h-5 w-5" />
                </div>
                <span className={cn(
                  "text-[10px] font-semibold leading-none transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}>
                  Atividades
                </span>
                {isActive && (
                  <div className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />
                )}
              </>
            )}
          </NavLink>

          {/* FAB - Nova Obra (center, elevated) */}
          <div className="flex flex-col items-center flex-1 min-w-0 -mt-3">
            <NavLink
              to="/gestao/nova-obra"
              className={({ isActive }) =>
                cn(
                  "flex items-center justify-center h-14 w-14 rounded-2xl shadow-lg transition-all active:scale-[0.90]",
                  "bg-gradient-to-br from-primary to-[hsl(var(--primary-dark))]",
                  "text-primary-foreground",
                  isActive
                    ? "ring-[3px] ring-primary/25 shadow-primary/30 shadow-xl scale-105"
                    : "hover:shadow-xl hover:shadow-primary/20"
                )
              }
              aria-label="Nova Obra"
            >
              <Plus className="h-6 w-6" strokeWidth={2.5} />
            </NavLink>
            <span className="text-[10px] font-bold text-primary mt-1 leading-none">Nova</span>
          </div>

          {/* NCs */}
          <NavLink
            to="/gestao/nao-conformidades"
            className="relative flex flex-col items-center justify-center gap-1 flex-1 min-w-0 py-2 transition-all active:scale-[0.92]"
          >
            {({ isActive }) => (
              <>
                <div className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground"
                )}>
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <span className={cn(
                  "text-[10px] font-semibold leading-none transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}>
                  NCs
                </span>
                {isActive && (
                  <div className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />
                )}
              </>
            )}
          </NavLink>

          {/* Mais */}
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger asChild>
              <button
                className={cn(
                  "relative flex flex-col items-center justify-center gap-1 flex-1 min-w-0 py-2 min-h-[44px] transition-all active:scale-[0.92]",
                )}
                aria-label="Mais opções"
              >
                <div className={cn(
                  "relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200",
                  isSecondaryActive
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground"
                )}>
                  <MoreHorizontal className="h-5 w-5" />
                  {isSecondaryActive && (
                    <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary" />
                  )}
                </div>
                <span className={cn(
                  "text-[10px] font-semibold leading-none transition-colors",
                  isSecondaryActive ? "text-primary" : "text-muted-foreground"
                )}>
                  Mais
                </span>
                {isSecondaryActive && (
                  <div className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />
                )}
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-3xl pb-safe">
              <SheetHeader className="pb-3">
                <SheetTitle className="text-base font-bold">Ferramentas</SheetTitle>
              </SheetHeader>
              <nav className="space-y-1">
                {secondaryItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname.startsWith(item.to);
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "flex items-center gap-3.5 w-full px-4 py-3.5 rounded-2xl text-left transition-all min-h-[52px] active:scale-[0.98]",
                        isActive
                          ? "bg-primary/10 border border-primary/20"
                          : "hover:bg-muted/60"
                      )}
                    >
                      <div className={cn(
                        "flex items-center justify-center w-10 h-10 rounded-xl shrink-0",
                        isActive
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className={cn(
                          "text-sm font-medium block",
                          isActive ? "text-primary font-semibold" : "text-foreground"
                        )}>
                          {item.label}
                        </span>
                        <span className="text-[11px] text-muted-foreground leading-tight">{item.description}</span>
                      </div>
                      {isActive && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 bg-primary/10 text-primary border-0 shrink-0">
                          Atual
                        </Badge>
                      )}
                    </NavLink>
                  );
                })}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
