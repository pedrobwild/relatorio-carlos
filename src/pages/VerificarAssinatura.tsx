import { useState, useEffect } from'react';
import { useParams, Link } from'react-router-dom';
import { Shield, CheckCircle2, XCircle, Loader2, Clock, User, Hash, FileText, Globe, Monitor, ArrowLeft } from'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from'@/components/ui/card';
import { Badge } from'@/components/ui/badge';
import { Button } from'@/components/ui/button';
import { Separator } from'@/components/ui/separator';
import { invokeFunction } from'@/infra/edgeFunctions';
import bwildLogo from'@/assets/bwild-logo-dark.png';

interface VerificationResult {
 valid: boolean;
 formalization?: {
 id: string;
 title: string;
 type: string;
 status: string;
 locked_hash: string | null;
 locked_at: string | null;
 };
 party?: {
 display_name: string;
 role_label: string | null;
 party_type: string;
 email: string | null;
 };
 acknowledgement?: {
 acknowledged_at: string;
 acknowledged_by_email: string | null;
 signature_hash: string;
 ip_address: string | null;
 user_agent: string | null;
 };
 error?: string;
}

const formatDateTime = (dateString: string) => {
 const d = new Date(dateString);
 return {
 date: d.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' }),
 time: d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit', second:'2-digit' }),
 iso: d.toISOString(),
 };
};

const parseUserAgent = (ua: string | null) => {
 if (!ua) return { browser:'Desconhecido', os:'Desconhecido', device:'Desconhecido' };
 
 let browser ='Desconhecido';
 let os ='Desconhecido';
 let device ='Desktop';

 if (ua.includes('Chrome') && !ua.includes('Edg')) browser ='Chrome';
 else if (ua.includes('Firefox')) browser ='Firefox';
 else if (ua.includes('Safari') && !ua.includes('Chrome')) browser ='Safari';
 else if (ua.includes('Edg')) browser ='Edge';

 if (ua.includes('Windows')) os ='Windows';
 else if (ua.includes('Mac OS')) os ='macOS';
 else if (ua.includes('Linux')) os ='Linux';
 else if (ua.includes('Android')) os ='Android';
 else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) os ='iOS';

 if (ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone')) device ='Mobile';
 else if (ua.includes('iPad') || ua.includes('Tablet')) device ='Tablet';

 return { browser, os, device };
};

const FORMALIZATION_TYPE_LABELS: Record<string, string> = {
 budget_item_swap:'Troca de Item de Orçamento',
 meeting_minutes:'Ata de Reunião',
 exception_custody:'Custódia de Item',
 scope_change:'Alteração de Escopo',
 general:'Formalização Geral',
};

export default function VerificarAssinatura() {
 const { hash } = useParams<{ hash: string }>();
 const [loading, setLoading] = useState(true);
 const [result, setResult] = useState<VerificationResult | null>(null);

 useEffect(() => {
 async function verify() {
 if (!hash) {
 setResult({ valid: false, error:'Hash não fornecido' });
 setLoading(false);
 return;
 }

 try {
 // Call verification edge function
 const { data, error } = await invokeFunction('verify-signature', { signature_hash: hash });

 if (error) throw error;
 setResult(data as VerificationResult);
 } catch (err) {
 console.error('Verification error:', err);
 setResult({ valid: false, error:'Erro ao verificar assinatura' });
 } finally {
 setLoading(false);
 }
 }

 verify();
 }, [hash]);

 return (
 <div className="min-h-screen bg-background">
 {/* Header */}
 <header className="bg-background/95 backdrop-blur-sm border-b">
 <div className="mx-auto px-4 py-4">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <img src={bwildLogo} alt="Bwild" className="h-8" />
 <span className="text-muted-foreground">|</span>
 <span className="text-sm font-medium">Verificação de Assinatura</span>
 </div>
 <Button variant="ghost" size="sm" asChild>
 <Link to="/">
 <ArrowLeft className="h-4 w-4 mr-2" />
 Voltar
 </Link>
 </Button>
 </div>
 </div>
 </header>

 <main className="mx-auto px-4 py-8 max-w-2xl">
 {loading ? (
 <Card>
 <CardContent className="py-16 flex flex-col items-center justify-center">
 <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
 <p className="text-muted-foreground">Verificando assinatura...</p>
 </CardContent>
 </Card>
 ) : result?.valid ? (
 <div className="space-y-6">
 {/* Success Banner */}
 <Card className="border-green-500/50 bg-green-50/50">
 <CardContent className="py-8 flex flex-col items-center text-center">
 <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
 <CheckCircle2 className="h-10 w-10 text-green-600" />
 </div>
 <h1 className="text-2xl font-bold text-green-800 mb-2">
 Assinatura Válida
 </h1>
 <p className="text-green-700">
 Esta assinatura digital foi verificada e é autêntica.
 </p>
 </CardContent>
 </Card>

 {/* Document Info */}
 <Card>
 <CardHeader className="pb-3">
 <CardTitle className="text-base flex items-center gap-2">
 <FileText className="h-4 w-4" />
 Documento
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-3">
 <div>
 <p className="text-sm font-medium">{result.formalization?.title}</p>
 <p className="text-xs text-muted-foreground">
 {FORMALIZATION_TYPE_LABELS[result.formalization?.type ||''] || result.formalization?.type}
 </p>
 </div>
 <div className="text-xs text-muted-foreground">
 <p>ID: {result.formalization?.id}</p>
 </div>
 </CardContent>
 </Card>

 {/* Signatory Info */}
 <Card>
 <CardHeader className="pb-3">
 <CardTitle className="text-base flex items-center gap-2">
 <User className="h-4 w-4" />
 Signatário
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-3">
 <div>
 <p className="font-medium">{result.party?.display_name}</p>
 <p className="text-sm text-muted-foreground">
 {result.party?.role_label || (result.party?.party_type ==='customer' ?'Cliente' :'Representante Empresa')}
 </p>
 </div>
 {result.acknowledgement?.acknowledged_by_email && (
 <p className="text-sm text-muted-foreground">
 E-mail: {result.acknowledgement.acknowledged_by_email}
 </p>
 )}
 </CardContent>
 </Card>

 {/* Signature Details */}
 <Card>
 <CardHeader className="pb-3">
 <CardTitle className="text-base flex items-center gap-2">
 <Shield className="h-4 w-4" />
 Detalhes da Assinatura
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 {result.acknowledgement && (
 <>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
 <div className="flex items-start gap-2">
 <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
 <div>
 <p className="font-medium">Data e Hora</p>
 <p className="text-muted-foreground">
 {formatDateTime(result.acknowledgement.acknowledged_at).date} às {formatDateTime(result.acknowledgement.acknowledged_at).time}
 </p>
 </div>
 </div>
 <div className="flex items-start gap-2">
 <Globe className="h-4 w-4 text-muted-foreground mt-0.5" />
 <div>
 <p className="font-medium">Endereço IP</p>
 <p className="text-muted-foreground font-mono text-xs">
 {result.acknowledgement.ip_address ||'Não capturado'}
 </p>
 </div>
 </div>
 <div className="flex items-start gap-2 sm:col-span-2">
 <Monitor className="h-4 w-4 text-muted-foreground mt-0.5" />
 <div>
 <p className="font-medium">Dispositivo</p>
 {(() => {
 const device = parseUserAgent(result.acknowledgement.user_agent);
 return (
 <p className="text-muted-foreground">
 {device.browser} / {device.os} / {device.device}
 </p>
 );
 })()}
 </div>
 </div>
 </div>

 <Separator />

 <div className="flex items-start gap-2">
 <Hash className="h-4 w-4 text-muted-foreground mt-0.5" />
 <div className="flex-1 min-w-0">
 <p className="font-medium text-sm">Hash da Assinatura (SHA-256)</p>
 <p className="text-[10px] text-muted-foreground font-mono break-all mt-1 bg-muted/50 p-2 rounded">
 {result.acknowledgement.signature_hash}
 </p>
 </div>
 </div>

 {result.formalization?.locked_hash && (
 <div className="flex items-start gap-2">
 <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
 <div className="flex-1 min-w-0">
 <p className="font-medium text-sm">Hash do Documento (SHA-256)</p>
 <p className="text-[10px] text-muted-foreground font-mono break-all mt-1 bg-muted/50 p-2 rounded">
 {result.formalization.locked_hash}
 </p>
 </div>
 </div>
 )}
 </>
 )}
 </CardContent>
 </Card>

 {/* Legal Notice */}
 <Card>
 <CardContent className="py-4">
 <p className="text-[10px] text-muted-foreground leading-relaxed">
 <strong>Validade Jurídica:</strong> Esta verificação confirma a autenticidade da assinatura eletrônica 
 nos termos da Lei nº 14.063/2020 e Medida Provisória nº 2.200-2/2001. A integridade do documento é 
 garantida por função hash criptográfica SHA-256.
 </p>
 </CardContent>
 </Card>
 </div>
 ) : (
 <Card className="border-red-500/50 bg-red-50/50">
 <CardContent className="py-16 flex flex-col items-center text-center">
 <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
 <XCircle className="h-10 w-10 text-red-600" />
 </div>
 <h1 className="text-2xl font-bold text-red-800 mb-2">
 Assinatura Não Encontrada
 </h1>
 <p className="text-red-700 mb-6">
 {result?.error ||'Não foi possível verificar esta assinatura.'}
 </p>
 <Button variant="outline" asChild>
 <Link to="/">Voltar ao início</Link>
 </Button>
 </CardContent>
 </Card>
 )}
 </main>
 </div>
 );
}
