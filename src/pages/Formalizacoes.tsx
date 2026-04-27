import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Sparkles, FileText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFormalizacoes } from '@/hooks/useFormalizacoes';
import { useUserRole } from '@/hooks/useUserRole';
import { useCan } from '@/hooks/useCan';
import { EmptyState } from '@/components/EmptyState';
import { useProjectNavigation } from '@/hooks/useProjectNavigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageContainer } from '@/components/layout/PageContainer';
import { ProjectSubNav } from '@/components/layout/ProjectSubNav';
import { FormalizacaoCard, FormalizacaoSkeleton } from '@/components/tabs/formalizacoes/FormalizacaoCard';
import { matchesSearch } from '@/lib/searchNormalize';
import { DesktopSidebar } from '@/components/tabs/formalizacoes/DesktopSidebar';
import { MobileFormalizacoes } from '@/components/tabs/formalizacoes/MobileFormalizacoes';
import { Card } from '@/components/ui/card';
export default function Formalizacoes() {
  const navigate = useNavigate();
  const { paths, projectId } = useProjectNavigation();
  const { isAdmin } = useUserRole();
  const { can } = useCan();
  const [activeTab, setActiveTab] = useState('pendentes');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const canCreate = can('formalizations:create');
  const { data: formalizacoes, isLoading } = useFormalizacoes({ projectId: projectId ?? undefined });

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
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Formalizações"
        backTo={paths.relatorio}
        maxWidth="xl"
        breadcrumbs={[
          { label: 'Minhas Obras', href: '/minhas-obras' },
          { label: 'Obra', href: paths.relatorio },
          { label: 'Formalizações' },
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
          {/* Desktop layout */}
          <div className="hidden lg:grid lg:grid-cols-[280px_1fr] lg:gap-6">
            <DesktopSidebar
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              typeFilter={typeFilter}
              setTypeFilter={setTypeFilter}
              pendingCount={pendingCount}
              signedCount={signedCount}
              totalCount={formalizacoes?.length || 0}
            />

            <div>
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
                        ? { label: 'Nova formalização', onClick: () => navigate(paths.formalizacoesNova), icon: Plus }
                        : undefined
                    }
                    icon={activeTab === 'pendentes' ? Sparkles : undefined}
                  />
                </Card>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {filteredFormalizacoes.map((f, i) => (
                    <FormalizacaoCard key={f.id} formalizacao={f} basePath={paths.formalizacoes} index={i} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Mobile layout */}
          <MobileFormalizacoes
            formalizacoes={filteredFormalizacoes}
            allFormalizacoes={formalizacoes || []}
            isLoading={isLoading}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            typeFilter={typeFilter}
            setTypeFilter={setTypeFilter}
            pendingCount={pendingCount}
            signedCount={signedCount}
            basePath={paths.formalizacoes}
            onCreateNew={() => navigate(paths.formalizacoesNova)}
            canCreate={canCreate}
            isStaff={isAdmin}
          />
        </PageContainer>
      </main>

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
