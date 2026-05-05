import {
  Clock,
  CheckCircle2,
  FileText,
  Plus,
  Search,
  Filter,
  Sparkles,
  FileCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FORMALIZATION_TYPE_LABELS } from "@/types/formalization";
import { FormalizacaoCard, FormalizacaoSkeleton } from "./FormalizacaoCard";

interface MobileFormalizacoesProps {
  formalizacoes: any[];
  allFormalizacoes: any[];
  isLoading: boolean;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  typeFilter: string;
  setTypeFilter: (v: string) => void;
  pendingCount: number;
  signedCount: number;
  basePath: string;
  onCreateNew: () => void;
  canCreate: boolean;
  isStaff: boolean;
}

export function MobileFormalizacoes({
  formalizacoes,
  isLoading,
  activeTab,
  setActiveTab,
  searchTerm,
  setSearchTerm,
  typeFilter,
  setTypeFilter,
  pendingCount,
  signedCount,
  basePath,
  onCreateNew,
  canCreate: _canCreate,
  isStaff,
}: MobileFormalizacoesProps) {
  return (
    <div className="lg:hidden space-y-5">
      {/* Info card */}
      <Card className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-primary/20 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <CardContent className="p-4 flex items-start gap-3 relative">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <FileCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium text-sm text-foreground">
              Proteção para ambas as partes
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Todas as combinações importantes ficam registradas com ciência
              formal.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setActiveTab("pendentes")}
          className={`p-3 rounded-lg border text-left transition-all hover:shadow-sm ${
            activeTab === "pendentes"
              ? "border-amber-500/50 bg-amber-50/50"
              : "border-border hover:border-amber-500/30"
          }`}
        >
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-600" />
            <span className="text-2xl font-bold text-amber-600">
              {pendingCount}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Aguardando ciência
          </p>
        </button>
        <button
          onClick={() => setActiveTab("finalizadas")}
          className={`p-3 rounded-lg border text-left transition-all hover:shadow-sm ${
            activeTab === "finalizadas"
              ? "border-green-500/50 bg-green-50/50"
              : "border-border hover:border-green-500/30"
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span className="text-2xl font-bold text-green-600">
              {signedCount}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Finalizadas</p>
        </button>
      </div>

      {/* Search and filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar formalizações..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-10"
            aria-label="Buscar formalizações"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger
            className="w-full sm:w-[200px] h-10"
            aria-label="Filtrar por tipo"
          >
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Filtrar por tipo" />
          </SelectTrigger>
          <SelectContent className="bg-background border shadow-lg">
            <SelectItem value="all">Todos os tipos</SelectItem>
            {Object.entries(FORMALIZATION_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 h-11">
          <TabsTrigger
            value="pendentes"
            className="relative gap-1.5 data-[state=active]:bg-amber-100"
          >
            <Clock className="h-3.5 w-3.5" />
            <span className="hidden xs:inline">Pendentes</span>
            {pendingCount > 0 && (
              <Badge
                variant="destructive"
                className="ml-1 h-5 px-1.5 text-[10px] animate-pulse"
              >
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="todas" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            <span className="hidden xs:inline">Todas</span>
          </TabsTrigger>
          <TabsTrigger
            value="finalizadas"
            className="gap-1.5 data-[state=active]:bg-green-100"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span className="hidden xs:inline">Finalizadas</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4 space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <FormalizacaoSkeleton key={i} />
              ))}
            </div>
          ) : formalizacoes.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  {activeTab === "pendentes" ? (
                    <Sparkles className="h-8 w-8 text-muted-foreground/50" />
                  ) : (
                    <FileText className="h-8 w-8 text-muted-foreground/50" />
                  )}
                </div>
                <p className="font-medium text-foreground">
                  {activeTab === "pendentes"
                    ? "Nenhuma pendência!"
                    : "Nenhuma formalização encontrada"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {activeTab === "pendentes"
                    ? "Você está em dia com todas as formalizações."
                    : "Crie uma nova formalização para começar."}
                </p>
                {activeTab !== "pendentes" && isStaff && (
                  <Button onClick={onCreateNew} className="mt-4" size="sm">
                    <Plus className="h-4 w-4 mr-1.5" />
                    Nova formalização
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            formalizacoes.map((f, i) => (
              <FormalizacaoCard
                key={f.id}
                formalizacao={f}
                basePath={basePath}
                index={i}
                showStatusLabel={false}
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
