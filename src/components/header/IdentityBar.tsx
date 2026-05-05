import { Link } from "react-router-dom";
import bwildLogo from "@/assets/bwild-logo-dark.png";
import { ArrowLeft, Bell, Building2, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ProjectWithCustomer } from "@/infra/repositories";

interface IdentityBarProps {
  projectName: string;
  unitName: string;
  clientName: string;
  address?: string;
  bairro?: string;
  cep?: string;
  otherProjects: ProjectWithCustomer[];
  pendenciasStats: { total: number; overdueCount: number; urgentCount: number };
  pendenciasPath: string;
  onGoBack: () => void;
  onProjectSwitch: (id: string) => void;
}

export function IdentityBar({
  projectName,
  unitName,
  clientName,
  address,
  bairro,
  cep,
  otherProjects,
  pendenciasStats,
  pendenciasPath,
  onGoBack,
  onProjectSwitch,
}: IdentityBarProps) {
  const addressParts = [address, bairro, cep].filter(Boolean);

  return (
    <div className="px-6 py-3.5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={onGoBack}
          className="h-9 w-9 shrink-0 rounded-full hover:bg-accent"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <img src={bwildLogo} alt="Bwild" className="h-8 w-auto shrink-0" />
        <Separator orientation="vertical" className="h-6" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 text-left hover:bg-accent rounded-lg px-3 py-2 transition-colors group min-w-0">
              <div className="min-w-0">
                <h1 className="text-base font-bold leading-tight text-foreground group-hover:text-primary transition-colors truncate">
                  {projectName} – {unitName}
                </h1>
                {clientName && (
                  <p className="text-caption mt-0.5 truncate">
                    Cliente: {clientName}
                  </p>
                )}
                {addressParts.length > 0 && (
                  <p className="text-xs text-muted-foreground truncate">
                    {addressParts.join(" · ")}
                  </p>
                )}
              </div>
              {otherProjects.length > 0 && (
                <ChevronsUpDown className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
              )}
            </button>
          </DropdownMenuTrigger>
          {otherProjects.length > 0 && (
            <DropdownMenuContent align="start" className="w-72 bg-popover">
              <DropdownMenuLabel className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Trocar de Obra
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {otherProjects.map((project) => (
                <DropdownMenuItem
                  key={project.id}
                  onClick={() => onProjectSwitch(project.id)}
                  className="flex flex-col items-start gap-0.5 cursor-pointer"
                >
                  <span className="font-medium">
                    {project.name}{" "}
                    {project.unit_name && `– ${project.unit_name}`}
                  </span>
                  {project.customer_name && (
                    <span className="text-xs text-muted-foreground">
                      Cliente: {project.customer_name}
                    </span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          )}
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        <Link
          to={pendenciasPath}
          className={cn(
            "flex items-center gap-2 px-3.5 py-2 rounded-full transition-all font-semibold text-sm border hover:shadow-sm active:scale-[0.97]",
            pendenciasStats.overdueCount > 0
              ? "bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20"
              : pendenciasStats.urgentCount > 0
                ? "bg-warning/10 text-warning border-warning/20 hover:bg-warning/20"
                : "bg-secondary text-foreground border-border hover:bg-accent",
          )}
          aria-label={`${pendenciasStats.total} pendências`}
        >
          <Bell className="w-4 h-4" />
          <span className="text-sm">Pendências</span>
          <Badge
            variant={
              pendenciasStats.overdueCount > 0 ? "destructive" : "secondary"
            }
            className={cn(
              "min-w-5 h-5 px-1.5 text-xs font-bold",
              pendenciasStats.overdueCount > 0
                ? ""
                : pendenciasStats.urgentCount > 0
                  ? "bg-warning text-warning-foreground"
                  : "bg-muted-foreground text-white",
            )}
          >
            {pendenciasStats.total}
          </Badge>
        </Link>
      </div>
    </div>
  );
}
