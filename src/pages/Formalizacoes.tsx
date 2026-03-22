import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Search, Filter, ChevronRight, Sparkles, FileCheck, Clock, CheckCircle2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFormalizacoes } from '@/hooks/useFormalizacoes';
import { useUserRole } from '@/hooks/useUserRole';
import { useCan } from '@/hooks/useCan';
import { EmptyState } from '@/components/EmptyState';
import bwildLogo from '@/assets/bwild-logo-dark.png';
import { useProjectNavigation } from '@/hooks/useProjectNavigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageContainer } from '@/components/layout/PageContainer';
import { ProjectSubNav } from '@/components/layout/ProjectSubNav';
import { 
  FORMALIZATION_TYPE_LABELS, 
  FORMALIZATION_STATUS_LABELS,
  type FormalizationType,
  type FormalizationStatus 
} from '@/types/formalization';
import {
  getStatusIcon,
  getStatusBadgeVariant,
  getTypeIcon,
  formatFormalizationDate as formatDate,
} from '@/lib/formalizationHelpers';

function FormalizacaoSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-24" />
        </div>
        <Skeleton className="h-5 w-3/4 mb-2" />
        <Skeleton className="h-4 w-full mb-1" />
        <Skeleton className="h-4 w-2/3 mb-3" />
        <div className="flex items-center justify-between pt-2 border-t">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-12" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function Formalizacoes() {
  const navigate = useNavigate();
  const { paths } = useProjectNavigation();
  const { isAdmin } = useUserRole();
  const { can } = useCan();
  const [activeTab, setActiveTab] = useState('pendentes');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  
  const canCreate = can('formalizations:create');

  const { data: formalizacoes, isLoading } = useFormalizacoes();

  const filteredFormalizacoes = formalizacoes?.filter(f => {
    // Tab filter
    if (activeTab === 'pendentes' && f.status !== 'pending_signatures') return false;
    if (activeTab === 'finalizadas' && f.status !== 'signed') return false;

    // Search filter
    if (searchTerm && !f.title?.toLowerCase().includes(searchTerm.toLowerCase())) return false;

    // Type filter
    if (typeFilter !== 'all' && f.type !== typeFilter) return false;

    return true;
  }) || [];

  const pendingCount = formalizacoes?.filter(f => f.status === 'pending_signatures').length || 0;
  const signedCount = formalizacoes?.filter(f => f.status === 'signed').length || 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <PageHeader
        title="Formalizações"
        backTo={paths.relatorio}
        maxWidth="xl"
        breadcrumbs={[
          { label: "Minhas Obras", href: "/minhas-obras" },
          { label: "Obra", href: paths.relatorio },
          { label: "Formalizações" },
        ]}
      >
        {canCreate && (
          <Button 
            size="sm"
            onClick={() => navigate(paths.formalizacoesNova)} 
            aria-label="Criar nova formalização"
            className="shrink-0 gap-1.5 shadow-sm hover:shadow-md transition-all"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nova Formalização</span>
            <span className="sm:hidden">Nova</span>
          </Button>
        )}
      </PageHeader>
      <ProjectSubNav />

      <main className="py-6">
        <PageContainer maxWidth="xl">
        {/* Desktop: Two-column layout */}
        <div className="hidden lg:grid lg:grid-cols-[280px_1fr] lg:gap-6">
          {/* Left Sidebar */}
          <div className="space-y-4">
            {/* Info card */}
            <Card className="bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 border-primary/20 overflow-hidden relative">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              <CardContent className="p-4 relative">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                  <FileCheck className="h-5 w-5 text-primary" />
                </div>
                <p className="font-medium text-sm text-foreground mb-1">Proteção para ambas as partes</p>
                <p className="text-xs text-muted-foreground">
                  Todas as combinações importantes ficam registradas com ciência formal.
                </p>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <div className="space-y-2">
              <button 
                onClick={() => setActiveTab('pendentes')}
                className={`w-full p-3 rounded-lg border text-left transition-all hover:shadow-sm ${
                  activeTab === 'pendentes' 
                    ? 'border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20' 
                    : 'border-border hover:border-amber-500/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-medium">Aguardando ciência</span>
                  </div>
                  <span className="text-xl font-bold text-amber-600">{pendingCount}</span>
                </div>
              </button>
              <button 
                onClick={() => setActiveTab('finalizadas')}
                className={`w-full p-3 rounded-lg border text-left transition-all hover:shadow-sm ${
                  activeTab === 'finalizadas' 
                    ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20' 
                    : 'border-border hover:border-green-500/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">Finalizadas</span>
                  </div>
                  <span className="text-xl font-bold text-green-600">{signedCount}</span>
                </div>
              </button>
              <button 
                onClick={() => setActiveTab('todas')}
                className={`w-full p-3 rounded-lg border text-left transition-all hover:shadow-sm ${
                  activeTab === 'todas' 
                    ? 'border-primary/50 bg-primary/5' 
                    : 'border-border hover:border-primary/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Ver todas</span>
                  </div>
                  <span className="text-xl font-bold text-muted-foreground">{formalizacoes?.length || 0}</span>
                </div>
              </button>
            </div>

            {/* Type Filter */}
            <div className="p-3 rounded-lg border border-border bg-card">
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Filtrar por tipo</p>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full h-9" aria-label="Filtrar por tipo">
                  <SelectValue placeholder="Todos os tipos" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg">
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  {Object.entries(FORMALIZATION_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Right Content */}
          <div>
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar formalizações..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10"
                aria-label="Buscar formalizações"
              />
            </div>

            {/* Formalizações Grid */}
            {isLoading ? (
              <div className="grid grid-cols-2 gap-4">
                {[1, 2, 3, 4].map(i => <FormalizacaoSkeleton key={i} />)}
              </div>
            ) : filteredFormalizacoes.length === 0 ? (
              <Card className="border-dashed">
                <EmptyState
                  variant="formalizations"
                  title={activeTab === 'pendentes' ? 'Nenhuma pendência!' : 'Nenhuma formalização encontrada'}
                  description={
                    activeTab === 'pendentes'
                      ? 'Você está em dia com todas as formalizações.'
                      : canCreate
                        ? 'Crie uma nova formalização para começar.'
                        : 'As formalizações serão criadas pela equipe técnica.'
                  }
                  action={
                    activeTab !== 'pendentes' && canCreate
                      ? {
                          label: 'Nova formalização',
                          onClick: () => navigate(paths.formalizacoesNova),
                          icon: Plus,
                        }
                      : undefined
                  }
                  icon={activeTab === 'pendentes' ? Sparkles : undefined}
                />
              </Card>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {filteredFormalizacoes.map((formalizacao, index) => (
                  <Link 
                    key={formalizacao.id} 
                    to={`${paths.formalizacoes}/${formalizacao.id}`}
                    className="block group animate-fade-in opacity-0"
                    style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'forwards' }}
                  >
                    <Card className="h-full group-hover:border-primary/50 group-hover:shadow-sm transition-all duration-200 overflow-hidden">
                      <CardContent className="p-0">
                        <div className={`h-1 ${
                          formalizacao.status === 'signed' ? 'bg-green-500' :
                          formalizacao.status === 'pending_signatures' ? 'bg-amber-500' :
                          formalizacao.status === 'voided' ? 'bg-destructive' :
                          'bg-muted'
                        }`} />
                        
                        <div className="p-4">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <h3 className="font-semibold text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-1 flex-1 min-w-0">
                              {formalizacao.title}
                            </h3>
                            <Badge 
                              variant={getStatusBadgeVariant(formalizacao.status as FormalizationStatus)}
                              className="text-xs gap-1 shrink-0"
                            >
                              {getStatusIcon(formalizacao.status as FormalizationStatus)}
                              {FORMALIZATION_STATUS_LABELS[formalizacao.status as FormalizationStatus]}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 flex-wrap">
                            <Badge variant="outline" className="text-xs font-normal gap-1 px-1.5 py-0 bg-background">
                              <span role="img" aria-label={formalizacao.type || ''}>
                                {getTypeIcon(formalizacao.type as FormalizationType)}
                              </span>
                              {FORMALIZATION_TYPE_LABELS[formalizacao.type as FormalizationType]}
                            </Badge>
                            <span>•</span>
                            <span>
                              {formalizacao.locked_at 
                                ? `Travado ${formatDate(formalizacao.locked_at)}`
                                : formatDate(formalizacao.created_at)
                              }
                            </span>
                            {formalizacao.parties_signed !== null && formalizacao.parties_total !== null && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3" />
                                  {formalizacao.parties_signed}/{formalizacao.parties_total}
                                </span>
                              </>
                            )}
                          </div>
                          
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {formalizacao.summary}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Mobile Layout - Original */}
        <div className="lg:hidden space-y-5">
          {/* Info card */}
          <Card className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-primary/20 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <CardContent className="p-4 flex items-start gap-3 relative">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <FileCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm text-foreground">Proteção para ambas as partes</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Todas as combinações importantes ficam registradas com ciência formal.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => setActiveTab('pendentes')}
              className={`p-3 rounded-lg border text-left transition-all hover:shadow-sm ${
                activeTab === 'pendentes' 
                  ? 'border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20' 
                  : 'border-border hover:border-amber-500/30'
              }`}
            >
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600" />
                <span className="text-2xl font-bold text-amber-600">{pendingCount}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Aguardando ciência</p>
            </button>
            <button 
              onClick={() => setActiveTab('finalizadas')}
              className={`p-3 rounded-lg border text-left transition-all hover:shadow-sm ${
                activeTab === 'finalizadas' 
                  ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20' 
                  : 'border-border hover:border-green-500/30'
              }`}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-2xl font-bold text-green-600">{signedCount}</span>
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
              <SelectTrigger className="w-full sm:w-[200px] h-10" aria-label="Filtrar por tipo">
                <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg">
                <SelectItem value="all">Todos os tipos</SelectItem>
                {Object.entries(FORMALIZATION_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 h-11">
              <TabsTrigger value="pendentes" className="relative gap-1.5 data-[state=active]:bg-amber-100 dark:data-[state=active]:bg-amber-900/30">
                <Clock className="h-3.5 w-3.5" />
                <span className="hidden xs:inline">Pendentes</span>
                {pendingCount > 0 && (
                  <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px] animate-pulse">
                    {pendingCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="todas" className="gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                <span className="hidden xs:inline">Todas</span>
              </TabsTrigger>
              <TabsTrigger value="finalizadas" className="gap-1.5 data-[state=active]:bg-green-100 dark:data-[state=active]:bg-green-900/30">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span className="hidden xs:inline">Finalizadas</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-4 space-y-3">
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <FormalizacaoSkeleton key={i} />)}
                </div>
              ) : filteredFormalizacoes.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="p-8 text-center">
                    <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                      {activeTab === 'pendentes' ? (
                        <Sparkles className="h-8 w-8 text-muted-foreground/50" />
                      ) : (
                        <FileText className="h-8 w-8 text-muted-foreground/50" />
                      )}
                    </div>
                    <p className="font-medium text-foreground">
                      {activeTab === 'pendentes' 
                        ? 'Nenhuma pendência!' 
                        : 'Nenhuma formalização encontrada'}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {activeTab === 'pendentes' 
                        ? 'Você está em dia com todas as formalizações.' 
                        : 'Crie uma nova formalização para começar.'}
                    </p>
                    {activeTab !== 'pendentes' && isAdmin && (
                      <Button 
                        onClick={() => navigate(paths.formalizacoesNova)} 
                        className="mt-4"
                        size="sm"
                      >
                        <Plus className="h-4 w-4 mr-1.5" />
                        Nova formalização
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                filteredFormalizacoes.map((formalizacao, index) => (
                  <Link 
                    key={formalizacao.id} 
                    to={`${paths.formalizacoes}/${formalizacao.id}`}
                    className="block group animate-fade-in opacity-0"
                    style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'forwards' }}
                  >
                    <Card className="group-hover:border-primary/50 group-hover:shadow-sm transition-all duration-200 overflow-hidden">
                      <CardContent className="p-0">
                        <div className={`h-1 ${
                          formalizacao.status === 'signed' ? 'bg-green-500' :
                          formalizacao.status === 'pending_signatures' ? 'bg-amber-500' :
                          formalizacao.status === 'voided' ? 'bg-destructive' :
                          'bg-muted'
                        }`} />
                        
                        <div className="p-4">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <h3 className="font-semibold text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-1 flex-1 min-w-0">
                              {formalizacao.title}
                            </h3>
                            <Badge 
                              variant={getStatusBadgeVariant(formalizacao.status as FormalizationStatus)}
                              className="text-xs gap-1 shrink-0"
                            >
                              {getStatusIcon(formalizacao.status as FormalizationStatus)}
                              <span className="hidden xs:inline">
                                {FORMALIZATION_STATUS_LABELS[formalizacao.status as FormalizationStatus]}
                              </span>
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 flex-wrap">
                            <Badge variant="outline" className="text-xs font-normal gap-1 px-1.5 py-0 bg-background">
                              <span role="img" aria-label={formalizacao.type || ''}>
                                {getTypeIcon(formalizacao.type as FormalizationType)}
                              </span>
                              {FORMALIZATION_TYPE_LABELS[formalizacao.type as FormalizationType]}
                            </Badge>
                            <span>•</span>
                            <span>
                              {formalizacao.locked_at 
                                ? `Travado ${formatDate(formalizacao.locked_at)}`
                                : formatDate(formalizacao.created_at)
                              }
                            </span>
                            {formalizacao.parties_signed !== null && formalizacao.parties_total !== null && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3" />
                                  {formalizacao.parties_signed}/{formalizacao.parties_total}
                                </span>
                              </>
                            )}
                          </div>
                          
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {formalizacao.summary}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
        </PageContainer>
      </main>

      {/* Floating Action Button (Mobile) - Admin only */}
      {isAdmin && (
        <div className="fixed bottom-6 right-6 lg:hidden">
          <Button
            size="lg"
            onClick={() => navigate(paths.formalizacoesNova)}
            className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow p-0"
            aria-label="Nova formalização"
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>
      )}
    </div>
  );
}
