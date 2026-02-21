import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Building2, Shield, Settings, History, Activity, LayoutTemplate } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UsersTab } from '@/components/admin/UsersTab';
import { ObrasTab } from '@/components/admin/ObrasTab';
import { TemplatesTab } from '@/components/admin/TemplatesTab';
import { FilesCleanupCard } from '@/components/admin/FilesCleanupCard';
import bwildLogo from '@/assets/bwild-logo-dark.png';

export default function Admin() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('usuarios');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigate('/gestao')}
                className="shrink-0"
                aria-label="Voltar para gestão"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <img src={bwildLogo} alt="Bwild" className="h-8" />
              <div>
                <h1 className="text-h3 font-bold flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Administração
                </h1>
                <p className="text-tiny text-muted-foreground">
                  Gerenciar usuários, obras e permissões
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 max-w-2xl">
            <TabsTrigger value="usuarios" className="gap-2">
              <Users className="h-4 w-4" />
              Usuários
            </TabsTrigger>
            <TabsTrigger value="obras" className="gap-2">
              <Building2 className="h-4 w-4" />
              Obras
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2">
              <LayoutTemplate className="h-4 w-4" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="sistema" className="gap-2">
              <Settings className="h-4 w-4" />
              Sistema
            </TabsTrigger>
          </TabsList>

          <TabsContent value="usuarios">
            <UsersTab />
          </TabsContent>

          <TabsContent value="obras">
            <ObrasTab />
          </TabsContent>

          <TabsContent value="templates">
            <TemplatesTab />
          </TabsContent>

          <TabsContent value="sistema">
            <div className="space-y-6">
              <FilesCleanupCard />
              
              {/* Health & Diagnostics Link */}
              <div className="border rounded-lg p-4 bg-card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <Activity className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">Health & Diagnostics</h3>
                      <p className="text-sm text-muted-foreground">
                        Status do sistema, latência e ferramentas de debug
                      </p>
                    </div>
                  </div>
                  <Button onClick={() => navigate('/admin/health')} variant="outline">
                    Ver Status
                  </Button>
                </div>
              </div>
              
              {/* Auditoria Link */}
              <div className="border rounded-lg p-4 bg-card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <History className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium">Auditoria do Sistema</h3>
                      <p className="text-sm text-muted-foreground">
                        Visualize todas as alterações do sistema
                      </p>
                    </div>
                  </div>
                  <Button onClick={() => navigate('/admin/auditoria')}>
                    Ver Registros
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
