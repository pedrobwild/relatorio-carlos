import { Shield, User, Clock, Globe, Monitor, Hash, FileCheck, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

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
  party_type: 'customer' | 'company';
  role_label: string | null;
}

interface DigitalSignatureLogProps {
  signatures: SignatureData[];
  parties: PartyData[];
  documentHash: string | null;
  lockedAt: string | null;
}

const formatDateTime = (dateString: string) => {
  const date = new Date(dateString);
  return {
    date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    time: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    iso: date.toISOString(),
  };
};

const parseUserAgent = (ua: string | null) => {
  if (!ua) return { browser: 'Desconhecido', os: 'Desconhecido', device: 'Desconhecido' };
  
  let browser = 'Desconhecido';
  let os = 'Desconhecido';
  let device = 'Desktop';

  // Browser detection
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera';

  // OS detection
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  // Device detection
  if (ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone')) device = 'Mobile';
  else if (ua.includes('iPad') || ua.includes('Tablet')) device = 'Tablet';

  return { browser, os, device };
};

export function DigitalSignatureLog({ signatures, parties, documentHash, lockedAt }: DigitalSignatureLogProps) {
  const sortedSignatures = [...signatures].sort(
    (a, b) => new Date(a.acknowledged_at).getTime() - new Date(b.acknowledged_at).getTime()
  );

  const getPartyForSignature = (sig: SignatureData) => 
    parties.find(p => p.id === sig.party_id);

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
          <div className="p-4 bg-green-50/50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/50 rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-800 dark:text-green-300">
                Documento íntegro e verificado
              </span>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-green-700 dark:text-green-400">
                <span className="font-medium">Hash SHA-256:</span>{' '}
                <code className="font-mono bg-green-100 dark:bg-green-900/50 px-1 py-0.5 rounded text-[10px] break-all">
                  {documentHash}
                </code>
              </p>
              {lockedAt && (
                <p className="text-xs text-green-700 dark:text-green-400">
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
                  <div className="relative z-10 h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-green-700 dark:text-green-400">{index + 1}</span>
                  </div>

                  {/* Signature card */}
                  <div className="flex-1 p-4 bg-card border rounded-lg space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{party?.display_name || 'Desconhecido'}</p>
                          <p className="text-xs text-muted-foreground">
                            {party?.role_label || (party?.party_type === 'customer' ? 'Cliente' : 'Representante Empresa')}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
                        Assinado
                      </Badge>
                    </div>

                    {/* Signature statement */}
                    {sig.signature_text && (
                      <div className="p-3 bg-muted/50 rounded-md border-l-2 border-primary">
                        <p className="text-sm italic text-muted-foreground">"{sig.signature_text}"</p>
                      </div>
                    )}

                    <Separator />

                    {/* Technical details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {/* Date/Time */}
                      <div className="flex items-start gap-2">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="font-medium text-foreground">Data e Hora</p>
                          <p className="text-muted-foreground">
                            {dateTime.date} às {dateTime.time}
                          </p>
                          <p className="text-muted-foreground/70 text-[10px]">
                            ISO: {dateTime.iso}
                          </p>
                        </div>
                      </div>

                      {/* Email */}
                      <div className="flex items-start gap-2">
                        <User className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="font-medium text-foreground">E-mail</p>
                          <p className="text-muted-foreground">
                            {sig.acknowledged_by_email || party?.email || 'Não informado'}
                          </p>
                        </div>
                      </div>

                      {/* IP Address */}
                      <div className="flex items-start gap-2">
                        <Globe className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="font-medium text-foreground">Endereço IP</p>
                          <p className="text-muted-foreground font-mono">
                            {sig.ip_address || 'Não capturado'}
                          </p>
                        </div>
                      </div>

                      {/* Device */}
                      <div className="flex items-start gap-2">
                        <Monitor className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="font-medium text-foreground">Dispositivo</p>
                          <p className="text-muted-foreground">
                            {deviceInfo.browser} / {deviceInfo.os} / {deviceInfo.device}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Signature hash */}
                    {sig.signature_hash && (
                      <div className="pt-2 border-t">
                        <div className="flex items-start gap-2">
                          <Hash className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-xs text-foreground">Hash da Assinatura (SHA-256)</p>
                            <p className="text-[10px] text-muted-foreground font-mono break-all mt-1">
                              {sig.signature_hash}
                            </p>
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
