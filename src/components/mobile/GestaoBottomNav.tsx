import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Plus, CalendarDays, FolderOpen, Settings, MoreHorizontal } from "lucide-react";
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

/**
 * GestaoBottomNav — fixed bottom nav for /gestao routes on mobile.
 * Features a prominent FAB-style "Nova Obra" center button.
 */
export function GestaoBottomNav() {
  const location = useLocation();
  const { isAdmin } = useUserRole();
  const [moreOpen, setMoreOpen] = useState(false);

  const secondaryItems = [
    { label: "Calendário de Compras", icon: CalendarDays, to: "/gestao/calendario-compras" },
    { label: "Arquivos", icon: FolderOpen, to: "/gestao/arquivos" },
    ...(isAdmin
      ? [{ label: "Configurações", icon: Settings, to: "/admin" }]
      : []),
  ];

  const isSecondaryActive = secondaryItems.some((i) =>
    location.pathname.startsWith(i.to)
  );

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 border-t border-border bg-card/95 backdrop-blur-md pb-safe md:hidden"
      aria-label="Navegação gestão"
    >
      <div className="flex items-stretch justify-around h-14 relative">
        {/* Painel */}
        <NavLink
          to="/gestao"
          end
          className={({ isActive }) =>
            cn(
              "relative flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 text-[10px] font-medium transition-colors active:scale-[0.95]",
              isActive ? "text-primary" : "text-muted-foreground"
            )
          }
        >
          <LayoutDashboard className="h-5 w-5" />
          <span>Painel</span>
        </NavLink>

        {/* FAB - Nova Obra (center, elevated) */}
        <div className="flex flex-col items-center justify-center flex-1 min-w-0">
          <NavLink
            to="/gestao/nova-obra"
            className={({ isActive }) =>
              cn(
                "flex items-center justify-center h-12 w-12 rounded-full shadow-lg -mt-5 transition-all active:scale-[0.92]",
                isActive
                  ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )
            }
            aria-label="Nova Obra"
          >
            <Plus className="h-6 w-6" />
          </NavLink>
          <span className="text-[10px] font-medium text-primary mt-0.5">Nova</span>
        </div>

        {/* Mais */}
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <button
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 text-[10px] font-medium transition-colors active:scale-[0.95]",
                isSecondaryActive ? "text-primary" : "text-muted-foreground"
              )}
              aria-label="Mais opções"
            >
              <MoreHorizontal className="h-5 w-5" />
              <span>Mais</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
            <SheetHeader className="pb-2">
              <SheetTitle className="text-base">Ferramentas</SheetTitle>
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
                      "flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-left transition-colors min-h-[48px]",
                      isActive
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-foreground hover:bg-muted/60"
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className="flex-1 text-sm">{item.label}</span>
                    {isActive && (
                      <span className="text-xs text-primary/70">Atual</span>
                    )}
                  </NavLink>
                );
              })}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
