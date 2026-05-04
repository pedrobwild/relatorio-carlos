import {
  Menu,
  Map,
  DollarSign,
  FolderOpen,
  ClipboardSignature,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { journeyCopy } from "@/constants/journeyCopy";
import { useState } from "react";

const navItems = [
  { key: "jornada", label: journeyCopy.tabs.jornada, icon: Map },
  { key: "financeiro", label: journeyCopy.tabs.financeiro, icon: DollarSign },
  { key: "documentos", label: journeyCopy.tabs.documentos, icon: FolderOpen },
  {
    key: "formalizacoes",
    label: journeyCopy.tabs.formalizacoes,
    icon: ClipboardSignature,
  },
  { key: "pendencias", label: journeyCopy.tabs.pendencias, icon: AlertCircle },
];

interface MobileNavDrawerProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  pendingCount: number;
}

export function MobileNavDrawer({
  activeTab,
  onTabChange,
  pendingCount,
}: MobileNavDrawerProps) {
  const [open, setOpen] = useState(false);
  const activeItem = navItems.find((i) => i.key === activeTab);
  const ActiveIcon = activeItem?.icon ?? Map;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-10 w-10 relative">
          <Menu className="h-5 w-5" />
          {pendingCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold">
              {pendingCount > 99 ? "99+" : pendingCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-base">Navegação</SheetTitle>
        </SheetHeader>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => {
                  onTabChange(item.key);
                  setOpen(false);
                }}
                className={cn(
                  "flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-left transition-colors min-h-[48px]",
                  isActive
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-foreground hover:bg-muted/60",
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="flex-1 text-sm">{item.label}</span>
                {item.key === "pendencias" && pendingCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold tabular-nums">
                    {pendingCount > 99 ? "99+" : pendingCount}
                  </span>
                )}
                {isActive && (
                  <span className="text-xs text-primary/70">Atual</span>
                )}
              </button>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
