import { useState } from'react';
import { Shield, User, Clock, Globe, Monitor, Hash, FileCheck, AlertTriangle, Download, Loader2 } from'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from'@/components/ui/card';
import { Badge } from'@/components/ui/badge';
import { Button } from'@/components/ui/button';
import { Separator } from'@/components/ui/separator';
import { useToast } from'@/hooks/use-toast';
import { formalizationsRepo } from'@/infra/repositories';
import { isSeedData as checkSeedData } from'@/pages/formalizacao-detalhe/types';

interface SignatureData {
 id: string;
 party_id: string;
 acknowledged: boolean;
 acknowledged_at: string;
 acknowledged_by_email: string | null;
 acknowledged_by_user_id: string | null;
 signature_hash: string | null;
 signature_text: string | null;
 user_agent: string | null;
 ip_address: string | null;
}

interface PartyData {
 id: string;
 display_name: string;
 email: string | null;
 party_type:'customer' |'company';
 role_label: string | null;
}

interface DigitalSignatureLogProps {
 formalizationId: string;
 signatures: SignatureData[];
 parties: PartyData[];
 documentHash: string | null;
 lockedAt: string | null;
}

const formatDateTime = (dateString: string) => {
 const date = new Date(dateString);
 return {
 date: date.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' }),
 time: date.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit', second:'2-digit' }),
 timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
 iso: date.toISOString(),
 };
};

const parseUserAgent = (ua: string | null) => {
 if (!ua) return { browser:'Desconhecido', os:'Desconhecido', device:'Desconhecido' };
 
 let browser ='Desconhecido';
 let os ='Desconhecido';
 let device ='Desktop';

 // Browser detection
 if (ua.includes('Chrome') && !ua.includes('Edg')) browser ='Chrome';
 else if (ua.includes('Firefox')) browser ='Firefox';
 else if (ua.includes('Safari') && !ua.includes('Chrome')) browser ='Safari';
 else if (ua.includes('Edg')) browser ='Edge';
 else if (ua.includes('Opera') || ua.includes('OPR')) browser ='Opera';

 // OS detection
 if (ua.includes('Windows')) os ='Windows';
 else if (ua.includes('Mac OS')) os ='macOS';
 else if (ua.includes('Linux')) os ='Linux';
 else if (ua.includes('Android')) os ='Android';
 else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) os ='iOS';

 // Device detection
 if (ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone')) device ='Mobile';
 else if (ua.includes('iPad') || ua.includes('Tablet')) device ='Tablet';

 return { browser, os, device };
};

// Use canonical isSeedData check from types module
const isSeedDataById = (id: string) => checkSeedData({ id });

export function DigitalSignatureLog({ formalizationId, signatures, parties, documentHash, lockedAt }: DigitalSignatureLogProps) {
 const { toast } = useToast();
 const [downloadingPartyId, setDownloadingPartyId] = useState<string | null>(null);
 
 const isDemo = isSeedDataById(formalizationId);
 
 const sortedSignatures = [...signatures].sort(
 (a, b) => new Date(a.acknowledged_at).getTime() - new Date(b.acknowledged_at).getTime()
 );

 const getPartyForSignature = (sig: SignatureData) => 
 parties.find(p => p.id === sig.party_id);

 const handleDownloadCertificate = async (partyId: string, partyName: string) => {
 if (isDemo) {
 toast({
 title:'Dados de demonstração',
 description:'Certificados não estão disponíveis para dados de exemplo.',
 variant:'default',
 });
 return;
 }
 
 setDownloadingPartyId(partyId);
 try {
 const { data, error } = await formalizationsRepo.downloadSignatureCertificate(formalizationId, partyId);

 if (error) throw error;

 const blob = new Blob([data], { type:'application/pdf' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download =`certificado-assinatura-${partyName.replace(/\s+/g,'-').toLowerCase()}.pdf`;
 document.body.appendChild(a);
 a.click();
 document.body.removeChild(a);
 URL.revokeObjectURL(url);

 toast({
 title:'Certificado gerado',
 description:'O download do certificado foi iniciado.',
 });
 } catch (error) {
 console.error('Error downloading certificate:', error);
 toast({
 title:'Erro',
 description:'Não foi possível gerar o certificado.',
 variant:'destructive',
 });
 } finally {
 setDownloadingPartyId(null);
 }
 };

 if (signatures.length === 0) {
 return (
 <Card>
 <CardHeader className="pb-3">
 <CardTitle className="text-base flex items-center gap-2">
 <Shield className="h-4 w-4" />
 Log de Assinatura Digital
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
 <AlertTriangle className="h-5 w-5 text-muted-foreground" />
 <p className="text-sm text-muted-foreground">
 Nenhuma assinatura registrada até o momento.
 </p>
 </div>
 </CardContent>
 </Card>
 );
 }

 return (
 <Card>
 <CardHeader className="pb-3">
 <CardTitle className="text-base flex items-center gap-2">
 <Shield className="h-4 w-4" />
 Log de Assinatura Digital
 </CardTitle>
 <p className="text-xs text-muted-foreground mt-1">
 Registro de assinaturas eletrônicas com validade jurídica conforme Lei 14.063/2020
 </p>
 </CardHeader>
 <CardContent className="space-y-6">
 {/* Document integrity info */}
 {documentHash && (
 <div className="p-3 bg-green-50/50 border border-green-200 rounded-lg">
 <div className="flex items-center gap-2 mb-2">
 <FileCheck className="h-4 w-4 text-green-600 shrink-0" />
 <span className="text-sm font-medium text-green-800">
 Documento íntegro e verificado
 </span>
 </div>
 <div className="space-y-1.5 text-xs text-green-700">
 <div>
 <span className="font-medium">Hash SHA-256:</span>
 <code className="block font-mono bg-green-100 px-2 py-1.5 rounded text-[10px] mt-1 break-all leading-relaxed">
 {documentHash}
 </code>
 </div>
 {lockedAt && (
 <p>
 <span className="font-medium">Travado em:</span> {formatDateTime(lockedAt).date} às {formatDateTime(lockedAt).time}
 </p>
 )}
 </div>
 </div>
 )}

 {/* Signatures */}
 <div className="space-y-4">
 {sortedSignatures.map((sig, index) => {
 const party = getPartyForSignature(sig);
 const dateTime = formatDateTime(sig.acknowledged_at);
 const deviceInfo = parseUserAgent(sig.user_agent);

 return (
 <div key={sig.id} className="relative">
 {/* Timeline connector */}
 {index < sortedSignatures.length - 1 && (
 <div className="absolute left-4 top-10 bottom-0 w-px bg-border" />
 )}
 
 <div className="flex gap-4">
 {/* Timeline dot */}
 <div className="relative z-10 h-8 w-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
 <span className="text-xs font-bold text-green-700">{index + 1}</span>
 </div>

 {/* Signature card */}
 <div className="flex-1 p-3 sm:p-4 bg-card border rounded-lg space-y-3">
 {/* Header */}
 <div className="space-y-3">
 <div className="flex items-center justify-between gap-2">
 <div className="flex items-center gap-2.5 min-w-0">
 <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
 <User className="h-4 w-4 text-primary" />
 </div>
 <div className="min-w-0">
 <p className="font-medium text-sm truncate">{party?.display_name ||'Desconhecido'}</p>
 <p className="text-xs text-muted-foreground truncate">
 {party?.role_label || (party?.party_type ==='customer' ?'Cliente' :'Representante Empresa')}
 </p>
 </div>
 </div>
 <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 shrink-0 text-[10px] px-2">
 Assinado
 </Badge>
 </div>
 <Button
 variant="outline"
 size="sm"
 onClick={() => handleDownloadCertificate(sig.party_id, party?.display_name ||'assinatura')}
 disabled={downloadingPartyId === sig.party_id}
 className="w-full h-9 text-xs"
 >
 {downloadingPartyId === sig.party_id ? (
 <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
 ) : (
 <Download className="h-3.5 w-3.5 mr-1.5" />
 )}
 Baixar Certificado
 </Button>
 </div>

 {/* Signature statement */}
 {sig.signature_text && (
 <div className="p-2.5 bg-muted/50 rounded-md border-l-2 border-primary">
 <p className="text-xs sm:text-sm italic text-muted-foreground leading-relaxed">"{sig.signature_text}"</p>
 </div>
 )}

 <Separator />

 {/* Technical details */}
 <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
 {/* Date/Time */}
 <div className="flex items-start gap-1.5">
 <Clock className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
 <div className="min-w-0">
 <p className="font-medium text-foreground">Data e Hora</p>
 <p className="text-muted-foreground">
 {dateTime.date} às {dateTime.time}
 </p>
 </div>
 </div>

 {/* Email */}
 <div className="flex items-start gap-1.5">
 <User className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
 <div className="min-w-0">
 <p className="font-medium text-foreground">E-mail</p>
 <p className="text-muted-foreground truncate">
 {sig.acknowledged_by_email || party?.email ||'Não informado'}
 </p>
 </div>
 </div>

 {/* IP Address */}
 <div className="flex items-start gap-1.5">
 <Globe className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
 <div className="min-w-0">
 <p className="font-medium text-foreground">IP</p>
 <p className="text-muted-foreground font-mono text-[10px]">
 {sig.ip_address ||'Não capturado'}
 </p>
 </div>
 </div>

 {/* Device */}
 <div className="flex items-start gap-1.5">
 <Monitor className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
 <div className="min-w-0">
 <p className="font-medium text-foreground">Dispositivo</p>
 <p className="text-muted-foreground truncate">
 {deviceInfo.browser} · {deviceInfo.device}
 </p>
 </div>
 </div>
 </div>

 {/* Signature hash */}
 {sig.signature_hash && (
 <div className="pt-2 border-t">
 <div className="flex items-start gap-1.5">
 <Hash className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
 <div className="flex-1 min-w-0">
 <p className="font-medium text-[11px] text-foreground">Hash da Assinatura</p>
 <code className="block text-[9px] text-muted-foreground font-mono break-all mt-0.5 bg-muted/50 px-1.5 py-1 rounded leading-relaxed">
 {sig.signature_hash}
 </code>
 </div>
 </div>
 </div>
 )}
 </div>
 </div>
 </div>
 );
 })}
 </div>

 {/* Legal footer */}
 <div className="pt-4 border-t">
 <p className="text-[10px] text-muted-foreground leading-relaxed">
 <strong>Aviso Legal:</strong> Este registro de assinatura eletrônica possui validade jurídica nos termos da 
 Lei nº 14.063/2020 e Medida Provisória nº 2.200-2/2001. A integridade do documento é garantida por hash 
 criptográfico SHA-256. Os dados de identificação (IP, dispositivo, data/hora) são coletados automaticamente 
 no momento da assinatura e servem como evidência de autenticidade.
 </p>
 </div>
 </CardContent>
 </Card>
 );
}
