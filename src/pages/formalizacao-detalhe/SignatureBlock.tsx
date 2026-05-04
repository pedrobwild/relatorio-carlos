import { AlertTriangle, CheckCircle2, Loader2 } from'lucide-react';
import { Button } from'@/components/ui/button';
import { Card, CardContent } from'@/components/ui/card';
import { Checkbox } from'@/components/ui/checkbox';
import { Label } from'@/components/ui/label';

interface SignatureBlockProps {
 acknowledged: boolean;
 setAcknowledged: (v: boolean) => void;
 isPending: boolean;
 onAcknowledge: () => void;
}

export function SignatureBlock({ acknowledged, setAcknowledged, isPending, onAcknowledge }: SignatureBlockProps) {
 return (
 <Card className="border-amber-500/50 bg-amber-50/50">
 <CardContent className="p-6">
 <div className="flex items-start gap-3">
 <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
 <div className="flex-1 space-y-4">
 <div>
 <h3 className="font-medium text-amber-900">Sua ciência é necessária</h3>
 <p className="text-sm text-amber-700 mt-1">
 Leia o conteúdo da formalização e confirme sua ciência abaixo.
 </p>
 </div>
 <div className="flex items-start gap-3">
 <Checkbox
 id="acknowledge"
 checked={acknowledged}
 onCheckedChange={(checked) => setAcknowledged(checked === true)}
 aria-describedby="acknowledge-description"
 />
 <Label htmlFor="acknowledge" id="acknowledge-description" className="text-sm leading-relaxed cursor-pointer">
 Li e estou ciente do conteúdo desta formalização, concordando com os termos e condições apresentados.
 </Label>
 </div>
 <Button onClick={onAcknowledge} disabled={!acknowledged || isPending} aria-label="Confirmar ciência">
 {isPending ?'Registrando...' :'Li e estou ciente'}
 </Button>
 </div>
 </div>
 </CardContent>
 </Card>
 );
}

interface MobileSignatureBarProps {
 isPending: boolean;
 onQuickAcknowledge: () => void;
}

export function MobileSignatureBar({ isPending, onQuickAcknowledge }: MobileSignatureBarProps) {
 return (
 <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t shadow-lg sm:hidden animate-fade-in">
 <div className="flex items-center gap-3">
 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium text-amber-700">Ciência pendente</p>
 <p className="text-xs text-muted-foreground truncate">Leia e confirme sua ciência</p>
 </div>
 <Button onClick={onQuickAcknowledge} disabled={isPending} size="sm" className="shrink-0">
 {isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
 Dar ciência
 </Button>
 </div>
 </div>
 );
}
