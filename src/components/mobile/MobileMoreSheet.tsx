import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  MoreHorizontal,
  Map,
  FolderOpen,
  ClipboardSignature,
  ShoppingCart,
  Search,
  Eye,
  FileText,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { cn } from "@/lib/utils";

interface MoreItem {
  label: string;
  icon: typeof Map;
  to: string;
}

export function MobileMoreSheet() {
  const [open, setOpen] = useState(false);
  const { paths } = useProjectNavigation();
  const location = useLocation();

  const items: MoreItem[] = [
    { label: "Jornada do Cliente", icon: Map, to: paths.jornada },
    { label: "Compras", icon: ShoppingCart, to: paths.compras },
    { label: "Vistorias", icon: Eye, to: paths.vistorias },
    { label: "Documentos", icon: FolderOpen, to: paths.documentos },
    { label: "Formalizações", icon: ClipboardSignature, to: paths.formalizacoes },
    { label: "Contrato", icon: FileText, to: paths.contrato },
  ];

  const isAnyActive = items.some((i) => location.pathname.startsWith(i.to));

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className={cn(
            "relative flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 text-[10px] font-medium transition-colors active:scale-[0.95]",
            isAnyActive ? "text-primary" : "text-muted-foreground"
          )}
          aria-label="Mais opções"
        >
          <MoreHorizontal className="h-5 w-5" />
          <span className="truncate">Mais</span>
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-base">Ferramentas</SheetTitle>
        </SheetHeader>
        <nav className="space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
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
  );
}
