/**
 * Admin Health & Diagnostics Page
 * 
 * Provides system health checks, performance metrics, and diagnostic tools
 * for administrators to quickly identify and troubleshoot issues.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Activity, 
  Server, 
  Database, 
  HardDrive, 
  Shield, 
  Clock, 
  Copy, 
  Trash2, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  ExternalLink,
  Bug,
  FileText,
  Link as LinkIcon
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { getBuildInfo, getShortCommit, isDev, getSentryProjectUrl } from '@/lib/buildInfo';
import { 
  runFullDiagnostics, 
  measureLatency,
  type DiagnosticResult,
  type AuthCheckResult,
  type DbCheckResult,
  type StorageCheckResult,
  type RlsCheckResult
} from '@/infra/repositories/diagnostics.repository';
import { captureException } from '@/lib/errorMonitoring';
import { useUserRole } from '@/hooks/useUserRole';
import { QUERY_CACHE_VERSION } from '@/lib/queryPersister';

interface DiagnosticsState {
  loading: boolean;
  auth: AuthCheckResult | null;
  db: DbCheckResult | null;
  storage: StorageCheckResult | null;
  rls: RlsCheckResult | null;
  signedUrl: DiagnosticResult | null;
  totalLatencyMs: number;
  latencyHistory: number[];
  lastRun: Date | null;
}

const StatusBadge = ({ status }: { status: DiagnosticResult['status'] }) => {
  const config = {
    ok: { variant: 'default' as const, icon: CheckCircle, label: 'OK', className: 'bg-green-500 hover:bg-green-600' },
    warn: { variant: 'secondary' as const, icon: AlertTriangle, label: 'WARN', className: 'bg-yellow-500 hover:bg-yellow-600 text-black' },
    fail: { variant: 'destructive' as const, icon: XCircle, label: 'FAIL', className: '' },
  };
  
  const { icon: Icon, label, className } = config[status];
  
  return (
    <Badge variant={config[status].variant} className={className}>
      <Icon className="w-3 h-3 mr-1" />
      {label}
    </Badge>
  );
};

const DiagnosticCard = ({ 
  title, 
  icon: Icon, 
  result, 
  children 
}: { 
  title: string; 
  icon: React.ComponentType<{ className?: string }>; 
  result: DiagnosticResult | null;
  children?: React.ReactNode;
}) => (
  <Card>
    <CardHeader className="pb-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-muted-foreground" />
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>
        {result && <StatusBadge status={result.status} />}
      </div>
    </CardHeader>
    <CardContent>
      {result ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">{result.message}</p>
          {result.details && (
            <p className="text-xs text-muted-foreground">{result.details}</p>
          )}
          {result.latencyMs !== undefined && (
            <p className="text-xs text-muted-foreground">
              Latência: {result.latencyMs}ms
            </p>
          )}
          {children}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Aguardando execução...</p>
      )}
    </CardContent>
  </Card>
);

export default function AdminHealth() {
  const navigate = useNavigate();
  const { roles, isAdmin } = useUserRole();
  const buildInfo = getBuildInfo();
  const sentryUrl = getSentryProjectUrl();
  
  const [state, setState] = useState<DiagnosticsState>({
    loading: false,
    auth: null,
    db: null,
    storage: null,
    rls: null,
    signedUrl: null,
    totalLatencyMs: 0,
    latencyHistory: [],
    lastRun: null,
  });
  
  const runDiagnostics = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }));
    
    try {
      const results = await runFullDiagnostics();
      
      setState(prev => ({
        ...prev,
        loading: false,
        auth: results.auth,
        db: results.db,
        storage: results.storage,
        rls: results.rls,
        signedUrl: results.signedUrl,
        totalLatencyMs: results.totalLatencyMs,
        latencyHistory: [...prev.latencyHistory.slice(-4), results.totalLatencyMs],
        lastRun: new Date(),
      }));
      
      toast({
        title: 'Diagnóstico concluído',
        description: `Tempo total: ${results.totalLatencyMs}ms`,
      });
    } catch (error) {
      setState(prev => ({ ...prev, loading: false }));
      toast({
        title: 'Erro no diagnóstico',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
  }, []);
  
  // Run diagnostics on mount
  useEffect(() => {
    runDiagnostics();
  }, [runDiagnostics]);
  
  const clearLocalCaches = useCallback(() => {
    try {
      // Clear React Query cache
      queryClient.clear();
      
      // Clear known localStorage keys
      const keysToRemove = [
        `bwild-query-cache-v${QUERY_CACHE_VERSION}`,
        'portalViewState',
        'onboarding:',
        'supabase.auth.token',
      ];
      
      const allKeys = Object.keys(localStorage);
      let removedCount = 0;
      
      allKeys.forEach(key => {
        if (keysToRemove.some(pattern => key.startsWith(pattern) || key.includes(pattern))) {
          localStorage.removeItem(key);
          removedCount++;
        }
      });
      
      toast({
        title: 'Caches limpos',
        description: `${removedCount} itens removidos. Recarregando...`,
      });
      
      // Reload after short delay
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      toast({
        title: 'Erro ao limpar cache',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
  }, []);
  
  const copyDiagnosticReport = useCallback(() => {
    const report = {
      timestamp: new Date().toISOString(),
      build: {
        commit: buildInfo.commit,
        branch: buildInfo.branch,
        environment: buildInfo.environment,
        version: buildInfo.version,
      },
      user: {
        id: state.auth?.userId || 'unknown',
        roles: roles,
        isAdmin,
      },
      route: window.location.pathname,
      checks: {
        auth: state.auth ? { status: state.auth.status, message: state.auth.message } : null,
        db: state.db ? { status: state.db.status, message: state.db.message, latencyMs: state.db.latencyMs } : null,
        storage: state.storage ? { status: state.storage.status, message: state.storage.message } : null,
        rls: state.rls ? { 
          status: state.rls.status, 
          message: state.rls.message,
          checksCount: state.rls.checks.length,
          passedCount: state.rls.checks.filter(c => c.passed).length,
        } : null,
        signedUrl: state.signedUrl ? { status: state.signedUrl.status, message: state.signedUrl.message } : null,
      },
      performance: {
        totalLatencyMs: state.totalLatencyMs,
        avgLatencyMs: state.latencyHistory.length 
          ? Math.round(state.latencyHistory.reduce((a, b) => a + b, 0) / state.latencyHistory.length)
          : null,
        lastRun: state.lastRun?.toISOString() || null,
      },
      browser: {
        userAgent: navigator.userAgent,
        language: navigator.language,
        online: navigator.onLine,
      },
    };
    
    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    
    toast({
      title: 'Relatório copiado',
      description: 'JSON do diagnóstico copiado para a área de transferência',
    });
  }, [buildInfo, state, roles, isAdmin]);
  
  const emitTestError = useCallback(() => {
    if (!isDev() && buildInfo.environment === 'production') {
      toast({
        title: 'Não permitido',
        description: 'Eventos de teste só podem ser emitidos em dev/staging',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      captureException(new Error('[TEST] Health check diagnostic error'), {
        feature: 'diagnostics',
        action: 'test_error',
        extra: { triggeredAt: new Date().toISOString() },
      });
      
      toast({
        title: 'Erro de teste emitido',
        description: 'Verifique o console e/ou Sentry',
      });
    } catch (error) {
      toast({
        title: 'Falha ao emitir erro',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
  }, [buildInfo.environment]);
  
  const avgLatency = state.latencyHistory.length 
    ? Math.round(state.latencyHistory.reduce((a, b) => a + b, 0) / state.latencyHistory.length)
    : 0;
  
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Activity className="w-8 h-8" />
              Health & Diagnostics
            </h1>
            <p className="text-muted-foreground mt-1">
              Status do sistema e ferramentas de diagnóstico
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              onClick={() => navigate('/admin')}
            >
              Voltar ao Admin
            </Button>
            <Button 
              onClick={runDiagnostics} 
              disabled={state.loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${state.loading ? 'animate-spin' : ''}`} />
              {state.loading ? 'Executando...' : 'Executar Diagnóstico'}
            </Button>
          </div>
        </div>
        
        {/* Build Info Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-muted-foreground" />
                <CardTitle className="text-lg">Build Info</CardTitle>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(`${buildInfo.commit} | ${buildInfo.environment} | ${buildInfo.version}`);
                  toast({ title: 'Copiado!' });
                }}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Commit</p>
                <p className="font-mono font-medium">{getShortCommit()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Branch</p>
                <p className="font-medium">{buildInfo.branch}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Ambiente</p>
                <Badge variant={buildInfo.environment === 'production' ? 'destructive' : 'secondary'}>
                  {buildInfo.environment}
                </Badge>
              </div>
              <div>
                <p className="text-muted-foreground">Versão</p>
                <p className="font-medium">{buildInfo.version}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Service Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <DiagnosticCard 
            title="Autenticação" 
            icon={Shield} 
            result={state.auth}
          >
            {state.auth?.userId && (
              <p className="text-xs font-mono text-muted-foreground">
                User: {state.auth.userId.substring(0, 8)}...
              </p>
            )}
          </DiagnosticCard>
          
          <DiagnosticCard 
            title="Banco de Dados" 
            icon={Database} 
            result={state.db}
          />
          
          <DiagnosticCard 
            title="Storage" 
            icon={HardDrive} 
            result={state.storage}
          >
            {state.storage?.bucketsAccessible && state.storage.bucketsAccessible.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {state.storage.bucketsAccessible.map(bucket => (
                  <Badge key={bucket} variant="outline" className="text-xs">
                    {bucket}
                  </Badge>
                ))}
              </div>
            )}
          </DiagnosticCard>
          
          <DiagnosticCard 
            title="Signed URLs" 
            icon={LinkIcon} 
            result={state.signedUrl}
          />
          
          {/* RLS Checks Card (spans 2 columns) */}
          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-muted-foreground" />
                  <CardTitle className="text-lg">RLS Checks</CardTitle>
                </div>
                {state.rls && <StatusBadge status={state.rls.status} />}
              </div>
            </CardHeader>
            <CardContent>
              {state.rls ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">{state.rls.message}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
                    {state.rls.checks.map((check, idx) => (
                      <div 
                        key={idx} 
                        className={`p-2 rounded-md border ${check.passed ? 'border-green-200 bg-green-50 dark:bg-green-950/20' : 'border-red-200 bg-red-50 dark:bg-red-950/20'}`}
                      >
                        <div className="flex items-center gap-2">
                          {check.passed ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-600" />
                          )}
                          <span className="text-sm font-medium">{check.name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{check.details}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Aguardando execução...</p>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Performance Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-muted-foreground" />
              <CardTitle className="text-lg">Performance</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-muted-foreground text-sm">Última execução</p>
                <p className="text-2xl font-bold">{state.totalLatencyMs}ms</p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Média (últimas 5)</p>
                <p className="text-2xl font-bold">{avgLatency}ms</p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Execuções</p>
                <p className="text-2xl font-bold">{state.latencyHistory.length}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Última atualização</p>
                <p className="text-sm font-medium">
                  {state.lastRun ? state.lastRun.toLocaleTimeString('pt-BR') : '-'}
                </p>
              </div>
            </div>
            {state.latencyHistory.length > 0 && (
              <div className="mt-4 flex items-end gap-1 h-12">
                {state.latencyHistory.map((latency, idx) => (
                  <div 
                    key={idx}
                    className="bg-primary rounded-t flex-1"
                    style={{ 
                      height: `${Math.min(100, (latency / Math.max(...state.latencyHistory)) * 100)}%`,
                      minHeight: '4px'
                    }}
                    title={`${latency}ms`}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Tools Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ferramentas de Admin</CardTitle>
            <CardDescription>
              Ações de diagnóstico e manutenção
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Button 
                variant="outline" 
                className="h-auto py-4 flex-col gap-2"
                onClick={copyDiagnosticReport}
              >
                <FileText className="w-5 h-5" />
                <span>Copiar Relatório</span>
                <span className="text-xs text-muted-foreground">JSON para suporte</span>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-auto py-4 flex-col gap-2"
                onClick={clearLocalCaches}
              >
                <Trash2 className="w-5 h-5" />
                <span>Limpar Caches</span>
                <span className="text-xs text-muted-foreground">Query + localStorage</span>
              </Button>
              
              {(isDev() || buildInfo.environment !== 'production') && (
                <Button 
                  variant="outline" 
                  className="h-auto py-4 flex-col gap-2"
                  onClick={emitTestError}
                >
                  <Bug className="w-5 h-5" />
                  <span>Erro de Teste</span>
                  <span className="text-xs text-muted-foreground">Validar captura</span>
                </Button>
              )}
              
              {sentryUrl ? (
                <Button 
                  variant="outline" 
                  className="h-auto py-4 flex-col gap-2"
                  onClick={() => window.open(sentryUrl, '_blank')}
                >
                  <ExternalLink className="w-5 h-5" />
                  <span>Abrir Sentry</span>
                  <span className="text-xs text-muted-foreground">Dashboard de erros</span>
                </Button>
              ) : (
                <div className="border rounded-md p-4 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="text-sm">Sentry não configurado</span>
                  <span className="text-xs">Defina VITE_SENTRY_PROJECT_URL</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* Footer with instructions */}
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-2">Como usar durante incidentes:</h3>
            <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
              <li>Execute o diagnóstico completo clicando em "Executar Diagnóstico"</li>
              <li>Verifique se todos os checks estão OK (verde)</li>
              <li>Se houver FAIL/WARN, copie o relatório e envie ao suporte</li>
              <li>Se suspeitar de cache corrompido, use "Limpar Caches"</li>
              <li>Para validar captura de erros, use "Erro de Teste" (apenas dev/staging)</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
