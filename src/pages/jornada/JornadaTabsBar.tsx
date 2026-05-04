import {
  Map,
  DollarSign,
  FolderOpen,
  ClipboardSignature,
  AlertCircle,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { journeyCopy } from "@/constants/journeyCopy";
import { prefetchForTab } from "@/lib/prefetch";

interface JornadaTabsBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  projectId?: string;
  pendingCount: number;
}

export function JornadaTabsBar({
  activeTab,
  onTabChange,
  projectId,
  pendingCount,
}: JornadaTabsBarProps) {
  return (
    <div className="sticky top-[57px] z-40 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="max-w-5xl mx-auto">
        <Tabs value={activeTab} onValueChange={onTabChange}>
          <div className="px-3 sm:px-6 md:px-8 overflow-x-auto scrollbar-hide">
            <TabsList
              className="bg-transparent h-auto p-0 gap-0 w-full whitespace-nowrap"
              aria-label="Navegação do projeto"
            >
              <TabsTrigger value="jornada" className="portal-tab-trigger">
                <Map className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                <span className="hidden sm:inline">
                  {journeyCopy.tabs.jornada}
                </span>
                <span className="sm:hidden">Jornada</span>
              </TabsTrigger>
              <TabsTrigger
                value="financeiro"
                className="portal-tab-trigger"
                onMouseEnter={() => prefetchForTab("financeiro", projectId)}
                onFocus={() => prefetchForTab("financeiro", projectId)}
              >
                <DollarSign className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                <span className="hidden sm:inline">
                  {journeyCopy.tabs.financeiro}
                </span>
                <span className="sm:hidden">Financeiro</span>
              </TabsTrigger>
              <TabsTrigger
                value="documentos"
                className="portal-tab-trigger"
                onMouseEnter={() => prefetchForTab("documentos", projectId)}
                onFocus={() => prefetchForTab("documentos", projectId)}
              >
                <FolderOpen className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                <span className="hidden sm:inline">
                  {journeyCopy.tabs.documentos}
                </span>
                <span className="sm:hidden">Docs</span>
              </TabsTrigger>
              <TabsTrigger
                value="formalizacoes"
                className="portal-tab-trigger"
                onMouseEnter={() => prefetchForTab("formalizacoes", projectId)}
                onFocus={() => prefetchForTab("formalizacoes", projectId)}
              >
                <ClipboardSignature className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                <span className="hidden sm:inline">
                  {journeyCopy.tabs.formalizacoes}
                </span>
                <span className="sm:hidden">Formal.</span>
              </TabsTrigger>
              <TabsTrigger
                value="pendencias"
                className="portal-tab-trigger relative"
                onMouseEnter={() => prefetchForTab("pendencias", projectId)}
                onFocus={() => prefetchForTab("pendencias", projectId)}
              >
                <AlertCircle className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                <span className="hidden sm:inline">
                  {journeyCopy.tabs.pendencias}
                </span>
                <span className="sm:hidden">Pendências</span>
                {pendingCount > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold tabular-nums">
                    {pendingCount > 99 ? "99+" : pendingCount}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
