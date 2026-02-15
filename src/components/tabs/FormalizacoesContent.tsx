import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, FileText, Search, Filter, Clock, CheckCircle2, XCircle, FileCheck, ChevronRight, Sparkles } from 'lucide-react';
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
import { useProjectNavigation } from '@/hooks/useProjectNavigation';
import { 
  FORMALIZATION_TYPE_LABELS, 
  FORMALIZATION_STATUS_LABELS,
  type FormalizationType,
  type FormalizationStatus 
} from '@/types/formalization';

const getStatusIcon = (status: FormalizationStatus) => {
  switch (status) {
    case 'signed': return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case 'pending_signatures': return <Clock className="h-4 w-4 text-amber-600" />;
    case 'draft': return <FileText className="h-4 w-4 text-muted-foreground" />;
    case 'voided': return <XCircle className="h-4 w-4 text-destructive" />;
    default: return <FileText className="h-4 w-4" />;
  }
};

const getStatusBadgeVariant = (status: FormalizationStatus): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case 'signed': return 'default';
    case 'pending_signatures': return 'secondary';
    case 'voided': return 'destructive';
    default: return 'outline';
  }
};

const getTypeIcon = (type: FormalizationType) => {
  switch (type) {
    case 'budget_item_swap': return '💰';
    case 'meeting_minutes': return '📝';
    case 'exception_custody': return '📦';
    case 'scope_change': return '🔄';
    default: return '📄';
  }
};

const formatDate = (dateString: string | null) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

function FormalizacaoSkeleton() {
  return (
    <Card><CardContent className="p-4">
      <div className="flex items-center justify-between gap-2 mb-3"><Skeleton className="h-5 w-32" /><Skeleton className="h-5 w-24" /></div>
      <Skeleton className="h-5 w-3/4 mb-2" /><Skeleton className="h-4 w-full mb-1" /><Skeleton className="h-4 w-2/3 mb-3" />
      <div className="flex items-center justify-between pt-2 border-t"><Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-12" /></div>
    </CardContent></Card>
  );
}

const FormalizacoesContent = () => {
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
    if (activeTab === 'pendentes' && f.status !== 'pending_signatures') return false;
    if (activeTab === 'finalizadas' && f.status !== 'signed') return false;
    if (searchTerm && !f.title?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (typeFilter !== 'all' && f.type !== typeFilter) return false;
    return true;
  }) || [];

  const pendingCount = formalizacoes?.filter(f => f.status === 'pending_signatures').length || 0;
  const signedCount = formalizacoes?.filter(f => f.status === 'signed').length || 0;

  return (
    <div>
      {/* Action bar */}
      {canCreate && (
        <div className="flex justify-end mb-4">
          <Button size="sm" onClick={() => navigate(paths.formalizacoesNova)} className="shrink-0 gap-1.5">
            <Plus className="h-4 w-4" /><span>Nova Formalização</span>
          </Button>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <button onClick={() => setActiveTab('pendentes')}
          className={`p-3 rounded-lg border text-left transition-all hover:shadow-sm ${activeTab === 'pendentes' ? 'border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20' : 'border-border hover:border-amber-500/30'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-amber-600" /><span className="text-sm font-medium">Pendentes</span></div>
            <span className="text-xl font-bold text-amber-600">{pendingCount}</span>
          </div>
        </button>
        <button onClick={() => setActiveTab('finalizadas')}
          className={`p-3 rounded-lg border text-left transition-all hover:shadow-sm ${activeTab === 'finalizadas' ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20' : 'border-border hover:border-green-500/30'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" /><span className="text-sm font-medium">Finalizadas</span></div>
            <span className="text-xl font-bold text-green-600">{signedCount}</span>
          </div>
        </button>
        <button onClick={() => setActiveTab('todas')}
          className={`p-3 rounded-lg border text-left transition-all hover:shadow-sm ${activeTab === 'todas' ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/30'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-medium">Todas</span></div>
            <span className="text-xl font-bold text-muted-foreground">{formalizacoes?.length || 0}</span>
          </div>
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar formalizações..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 h-10" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[200px] h-10"><Filter className="h-4 w-4 mr-2 text-muted-foreground" /><SelectValue placeholder="Filtrar por tipo" /></SelectTrigger>
          <SelectContent className="bg-background border shadow-lg">
            <SelectItem value="all">Todos os tipos</SelectItem>
            {Object.entries(FORMALIZATION_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => <FormalizacaoSkeleton key={i} />)}
        </div>
      ) : filteredFormalizacoes.length === 0 ? (
        <EmptyState
          variant="formalizations"
          title={activeTab === 'pendentes' ? 'Nenhuma pendência!' : 'Nenhuma formalização encontrada'}
          description={activeTab === 'pendentes' ? 'Você está em dia com todas as formalizações.' : canCreate ? 'Crie uma nova formalização para começar.' : 'As formalizações serão criadas pela equipe técnica.'}
          icon={activeTab === 'pendentes' ? Sparkles : undefined}
          action={activeTab !== 'pendentes' && canCreate ? { label: 'Nova formalização', onClick: () => navigate(paths.formalizacoesNova), icon: Plus } : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredFormalizacoes.map((formalizacao, index) => (
            <Link key={formalizacao.id} to={`${paths.formalizacoes}/${formalizacao.id}`} className="block group animate-fade-in opacity-0" style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'forwards' }}>
              <Card className="h-full group-hover:border-primary/50 group-hover:shadow-sm transition-all duration-200 overflow-hidden">
                <CardContent className="p-0">
                  <div className={`h-1 ${formalizacao.status === 'signed' ? 'bg-green-500' : formalizacao.status === 'pending_signatures' ? 'bg-amber-500' : formalizacao.status === 'voided' ? 'bg-destructive' : 'bg-muted'}`} />
                  <div className="p-4">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-1 flex-1 min-w-0">{formalizacao.title}</h3>
                      <Badge variant={getStatusBadgeVariant(formalizacao.status as FormalizationStatus)} className="text-xs gap-1 shrink-0">
                        {getStatusIcon(formalizacao.status as FormalizationStatus)}
                        {FORMALIZATION_STATUS_LABELS[formalizacao.status as FormalizationStatus]}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 flex-wrap">
                      <Badge variant="outline" className="text-xs font-normal gap-1 px-1.5 py-0 bg-background">
                        <span role="img" aria-label={formalizacao.type || ''}>{getTypeIcon(formalizacao.type as FormalizationType)}</span>
                        {FORMALIZATION_TYPE_LABELS[formalizacao.type as FormalizationType]}
                      </Badge>
                      <span>•</span>
                      <span>{formalizacao.locked_at ? `Travado ${formatDate(formalizacao.locked_at)}` : formatDate(formalizacao.created_at)}</span>
                      {formalizacao.parties_signed !== null && formalizacao.parties_total !== null && (
                        <><span>•</span><span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />{formalizacao.parties_signed}/{formalizacao.parties_total}</span></>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">{formalizacao.summary}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default FormalizacoesContent;
