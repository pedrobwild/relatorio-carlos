import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Loader2, Copy, Check, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import bwildLogo from '@/assets/bwild-logo-dark.png';
import { getAccessToken } from '@/infra/edgeFunctions';

const AREAS = [
  { value: 'jornada', label: 'Jornada do Projeto', description: 'Timeline, etapas, checklist do cliente' },
  { value: 'financeiro', label: 'Financeiro', description: 'Pagamentos, boletos, parcelas' },
  { value: 'pendencias', label: 'Pendências', description: 'Decisões, aprovações, prazos do cliente' },
  { value: 'formalizacoes', label: 'Formalizações', description: 'Contratos, aditivos, assinaturas digitais' },
  { value: 'documentos', label: 'Documentos', description: 'Projeto 3D, Executivo, uploads, versões' },
  { value: 'cronograma', label: 'Cronograma', description: 'Gantt, atividades, marcos, progresso' },
  { value: 'relatorio', label: 'Relatório Semanal', description: 'KPIs, fotos, resumo executivo' },
  { value: 'gestao', label: 'Gestão de Obras', description: 'Dashboard, listagem, criação de obras' },
  { value: 'navegacao', label: 'Navegação Geral', description: 'Header, menus, rotas, mobile' },
  { value: 'onboarding', label: 'Onboarding do Cliente', description: 'Primeiro acesso, boas-vindas, orientações' },
];

export default function AdminUxInsights() {
  const navigate = useNavigate();
  const [selectedArea, setSelectedArea] = useState('');
  const [context, setContext] = useState('');
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const generate = useCallback(async () => {
    if (!selectedArea) {
      toast.error('Selecione uma área para análise');
      return;
    }

    setIsLoading(true);
    setResult('');

    abortRef.current = new AbortController();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada');

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ux-insights`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            area: AREAS.find(a => a.value === selectedArea)?.label ?? selectedArea,
            context: context.trim() || undefined,
          }),
          signal: abortRef.current.signal,
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(err.error || `Erro ${resp.status}`);
      }

      if (!resp.body) throw new Error('Sem resposta de stream');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              accumulated += content;
              setResult(accumulated);
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              accumulated += content;
              setResult(accumulated);
            }
          } catch { /* ignore */ }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      toast.error(err.message || 'Erro ao gerar sugestões');
    } finally {
      setIsLoading(false);
    }
  }, [selectedArea, context]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    toast.success('Copiado para a área de transferência');
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    setIsLoading(false);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/admin')}
              className="shrink-0"
              aria-label="Voltar"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <img src={bwildLogo} alt="Bwild" className="h-8" />
            <div>
              <h1 className="text-h3 font-bold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                UX Insights com IA
              </h1>
              <p className="text-tiny text-muted-foreground">
                Sugestões de melhorias de hierarquia, copywriting e UX
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Input Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configurar Análise</CardTitle>
            <CardDescription>
              Selecione a área do portal e adicione contexto opcional para sugestões mais direcionadas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Área do Portal</label>
              <Select value={selectedArea} onValueChange={setSelectedArea}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma área..." />
                </SelectTrigger>
                <SelectContent>
                  {AREAS.map(area => (
                    <SelectItem key={area.value} value={area.value}>
                      <div className="flex flex-col items-start">
                        <span>{area.label}</span>
                        <span className="text-xs text-muted-foreground">{area.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Contexto adicional (opcional)</label>
              <Textarea
                placeholder="Ex: Os clientes estão tendo dificuldade para encontrar os boletos pendentes..."
                value={context}
                onChange={(e) => setContext(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={generate}
                disabled={isLoading || !selectedArea}
                className="gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Gerar Sugestões
                  </>
                )}
              </Button>
              {isLoading && (
                <Button variant="outline" onClick={handleCancel}>
                  Cancelar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Result Section */}
        {(result || isLoading) && (
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">Sugestões de UX</CardTitle>
                {isLoading && (
                  <Badge variant="secondary" className="gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Gerando
                  </Badge>
                )}
              </div>
              {result && !isLoading && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={generate} className="gap-1">
                    <RefreshCw className="h-3.5 w-3.5" />
                    Regenerar
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1">
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? 'Copiado' : 'Copiar'}
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{result || '...'}</ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
