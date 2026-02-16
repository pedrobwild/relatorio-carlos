import { Card, CardContent } from '@/components/ui/card';
import { Info } from 'lucide-react';

export function StageIntroCard() {
  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
            <Info className="h-4 w-4 text-primary" />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">O que acontece nesta etapa</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Nesta etapa, fazemos a Reunião de Briefing para entender suas necessidades e iniciar o Projeto 3D. Depois do briefing, você acompanha aqui as entregas, aprovações e próximos passos.
            </p>
          </div>
        </div>

        <ul className="space-y-2 pl-11">
          <li className="text-sm text-foreground flex items-start gap-2">
            <span className="shrink-0">✅</span>
            <span>Alinhamos objetivos, estilo e prioridades</span>
          </li>
          <li className="text-sm text-foreground flex items-start gap-2">
            <span className="shrink-0">📐</span>
            <span>Confirmamos informações técnicas necessárias</span>
          </li>
          <li className="text-sm text-foreground flex items-start gap-2">
            <span className="shrink-0">🧩</span>
            <span>Damos início ao Projeto 3D</span>
          </li>
        </ul>

        <p className="text-xs text-muted-foreground pl-11 italic">
          Quanto mais completas forem suas informações, mais rápido avançamos para o 3D.
        </p>
      </CardContent>
    </Card>
  );
}
