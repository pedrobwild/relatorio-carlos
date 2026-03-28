import { NavLink } from "react-router-dom";
import { Home, Camera, DollarSign, MessageCircle } from "lucide-react";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Início", icon: Home, pathKey: "jornada" as const },
  { label: "Diário", icon: Camera, pathKey: "relatorio" as const },
  { label: "Financeiro", icon: DollarSign, pathKey: "financeiro" as const },
  { label: "Pendências", icon: MessageCircle, pathKey: "pendencias" as const },
];

/**
 * MobileBottomNav — fixed bottom navigation for mobile client users.
 * Shows 4 primary actions with ergonomic thumb-zone positioning.
 * Only rendered for non-staff (client) users on mobile viewports.
 */
export function MobileBottomNav() {
  const { paths } = useProjectNavigation();

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 border-t border-border bg-card/95 backdrop-blur-md pb-safe md:hidden"
      aria-label="Navegação principal"
    >
      <div className="flex items-stretch justify-around h-14">
        {navItems.map((item) => (
          <NavLink
            key={item.pathKey}
            to={paths[item.pathKey]}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 text-[10px] font-medium transition-colors",
                "active:scale-[0.95]",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground"
              )
            }
          >
            <item.icon className="h-5 w-5" />
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
