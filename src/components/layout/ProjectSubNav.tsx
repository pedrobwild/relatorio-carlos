import { useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  DollarSign,
  FolderOpen,
  ClipboardSignature,
  AlertCircle,
  FileText,
  Box,
  Ruler,
  Map,
} from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  /** Only show for staff roles */
  staffOnly?: boolean;
}

interface ProjectSubNavProps {
  className?: string;
  /** Show staff-only items */
  showStaffItems?: boolean;
}

/**
 * ProjectSubNav — horizontal sub-navigation for obra internal pages.
 * Shows all available sections within a project with active state.
 * Sticky below the page header.
 */
export function ProjectSubNav({ className, showStaffItems = false }: ProjectSubNavProps) {
  const { paths, projectId } = useProjectNavigation();

  if (!projectId) return null;

  const navItems: NavItem[] = [
    { label: "Resumo", path: paths.relatorio, icon: BarChart3 },
    { label: "Financeiro", path: paths.financeiro, icon: DollarSign },
    { label: "Documentos", path: paths.documentos, icon: FolderOpen },
    { label: "Formalizações", path: paths.formalizacoes, icon: ClipboardSignature },
    { label: "Pendências", path: paths.pendencias, icon: AlertCircle },
    { label: "Contrato", path: paths.contrato, icon: FileText },
    { label: "Projeto 3D", path: paths.projeto3D, icon: Box },
    { label: "Executivo", path: paths.executivo, icon: Ruler },
    { label: "Jornada", path: paths.jornada, icon: Map },
  ];

  const visibleItems = showStaffItems
    ? navItems
    : navItems.filter((item) => !item.staffOnly);

  return (
    <div
      className={cn(
        "sticky top-[57px] z-40 bg-background/95 backdrop-blur-sm border-b border-border",
        className
      )}
    >
      <div className="max-w-5xl mx-auto">
        <ScrollArea className="w-full">
          <nav
            className="flex items-center gap-1 px-4 sm:px-6 md:px-8 py-1.5"
            aria-label="Navegação do projeto"
          >
            {visibleItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === paths.relatorio}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm whitespace-nowrap transition-colors text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  activeClassName="text-primary font-medium bg-primary/10 hover:bg-primary/10 hover:text-primary"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
          <ScrollBar orientation="horizontal" className="h-1" />
        </ScrollArea>
      </div>
    </div>
  );
}
