import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, FileText, Search, Filter, Clock, CheckCircle2, AlertCircle, XCircle, FileCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFormalizacoes } from '@/hooks/useFormalizacoes';
import bwildLogo from '@/assets/bwild-logo.png';
import { 
  FORMALIZATION_TYPE_LABELS, 
  FORMALIZATION_STATUS_LABELS,
  type FormalizationType,
  type FormalizationStatus 
} from '@/types/formalization';

const getStatusIcon = (status: FormalizationStatus) => {
  switch (status) {
    case 'signed':
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case 'pending_signatures':
      return <Clock className="h-4 w-4 text-amber-600" />;
    case 'draft':
      return <FileText className="h-4 w-4 text-muted-foreground" />;
    case 'voided':
      return <XCircle className="h-4 w-4 text-destructive" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
};

const getStatusBadgeVariant = (status: FormalizationStatus): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case 'signed':
      return 'default';
    case 'pending_signatures':
      return 'secondary';
    case 'voided':
      return 'destructive';
    default:
      return 'outline';
  }
};

const getTypeIcon = (type: FormalizationType) => {
  switch (type) {
    case 'budget_item_swap':
      return '💰';
    case 'meeting_minutes':
      return '📝';
    case 'exception_custody':
      return '📦';
    case 'scope_change':
      return '🔄';
    default:
      return '📄';
  }
};

const formatDate = (dateString: string | null) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export default function Formalizacoes() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('pendentes');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigate('/')}
                aria-label="Voltar para o início"
                className="rounded-full"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <img src={bwildLogo} alt="Bwild" className="h-8" />
              <span className="text-muted-foreground">|</span>
              <h1 className="text-lg font-semibold">Formalizações</h1>
            </div>
            <Button onClick={() => navigate('/formalizacoes/nova')} aria-label="Criar nova formalização">
              <Plus className="h-4 w-4 mr-2" />
              Nova
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Info card */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex items-start gap-3">
            <FileCheck className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Isso protege os dois lados:</strong> combinações importantes ficam registradas com ciência.
            </p>
          </CardContent>
        </Card>

        {/* Search and filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar formalizações..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              aria-label="Buscar formalizações"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-[200px]" aria-label="Filtrar por tipo">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filtrar por tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {Object.entries(FORMALIZATION_TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pendentes" className="relative">
              Pendentes
              {pendingCount > 0 && (
                <Badge variant="destructive" className="ml-2 h-5 px-1.5 text-xs">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="todas">Todas</TabsTrigger>
            <TabsTrigger value="finalizadas">Finalizadas</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4 space-y-3">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando...
              </div>
            ) : filteredFormalizacoes.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma formalização encontrada</p>
                  {activeTab === 'pendentes' && (
                    <p className="text-sm mt-2">Você não possui formalizações pendentes de ciência.</p>
                  )}
                </CardContent>
              </Card>
            ) : (
              filteredFormalizacoes.map((formalizacao) => (
                <Link 
                  key={formalizacao.id} 
                  to={`/formalizacoes/${formalizacao.id}`}
                  className="block"
                >
                  <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl" role="img" aria-label={formalizacao.type || ''}>
                          {getTypeIcon(formalizacao.type as FormalizationType)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-medium truncate">{formalizacao.title}</h3>
                            <Badge variant={getStatusBadgeVariant(formalizacao.status as FormalizationStatus)}>
                              {getStatusIcon(formalizacao.status as FormalizationStatus)}
                              <span className="ml-1">
                                {FORMALIZATION_STATUS_LABELS[formalizacao.status as FormalizationStatus]}
                              </span>
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {formalizacao.summary}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span>{FORMALIZATION_TYPE_LABELS[formalizacao.type as FormalizationType]}</span>
                            <span>•</span>
                            <span>
                              {formalizacao.locked_at 
                                ? `Travado em ${formatDate(formalizacao.locked_at)}`
                                : `Criado em ${formatDate(formalizacao.created_at)}`
                              }
                            </span>
                            {formalizacao.parties_signed !== null && formalizacao.parties_total !== null && (
                              <>
                                <span>•</span>
                                <span>{formalizacao.parties_signed}/{formalizacao.parties_total} assinaturas</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
